import crypto from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import mysql from "mysql2/promise";
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAILY_HOUR_JST = 3;
const DAILY_MINUTE_JST = 15;
const BACKUP_VERSION = 1;
const DAILY_KEEP = 14;
const WEEKLY_KEEP = 8;
const MONTHLY_KEEP = 12;
let backupRunning = false;
let schedulerStarted = false;

type Normalized = null | string | number | boolean | Normalized[] | { [key: string]: Normalized };

type BackupTable = {
  name: string;
  createTable: string;
  rowCount: number;
  rows: Normalized[];
};

function normalizeValue(value: unknown): Normalized {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return { __lcjType: "bigint", value: value.toString() };
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return { __lcjType: "date", value: value.toISOString() };
  if (Buffer.isBuffer(value)) return { __lcjType: "buffer", base64: value.toString("base64") };
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return String(value);
}

function getStorageConfig() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const region = process.env.AWS_S3_REGION || "auto";
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET are required for database backups");
  }
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: Boolean(endpoint),
    }),
  };
}

function getEncryptionKey(): Buffer {
  const secret = process.env.DB_BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("DB_BACKUP_ENCRYPTION_KEY or JWT_SECRET with at least 16 characters is required");
  }
  return crypto.scryptSync(secret, "lcjgent-railway-mysql-backup-v1", 32);
}

function encryptBackup(compressed: Buffer): { encrypted: Buffer; plaintextSha256: string; encryptedSha256: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const header = Buffer.from("LCJDBK1", "ascii");
  const encrypted = Buffer.concat([header, iv, authTag, ciphertext]);
  return {
    encrypted,
    plaintextSha256: crypto.createHash("sha256").update(compressed).digest("hex"),
    encryptedSha256: crypto.createHash("sha256").update(encrypted).digest("hex"),
  };
}

function verifyEncryptedBackup(encrypted: Buffer, expectedTables: number, expectedRows: number): void {
  const header = encrypted.subarray(0, 7).toString("ascii");
  if (header !== "LCJDBK1") throw new Error("invalid encrypted backup header");
  const iv = encrypted.subarray(7, 19);
  const authTag = encrypted.subarray(19, 35);
  const ciphertext = encrypted.subarray(35);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const payload = JSON.parse(gunzipSync(compressed).toString("utf8")) as { tableCount?: number; rowCount?: number; tables?: unknown[] };
  if (payload.tableCount !== expectedTables || payload.rowCount !== expectedRows || payload.tables?.length !== expectedTables) {
    throw new Error(`backup round-trip mismatch tables=${payload.tableCount}/${expectedTables} rows=${payload.rowCount}/${expectedRows}`);
  }
}

function jstParts(now = new Date()) {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
  };
}

function timestampForKey(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

async function ensureBackupRunTable(connection: mysql.Connection): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS \`db_backup_runs\` (
    \`id\` bigint NOT NULL AUTO_INCREMENT,
    \`runId\` varchar(64) NOT NULL,
    \`reason\` varchar(32) NOT NULL,
    \`status\` varchar(20) NOT NULL,
    \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completedAt\` timestamp NULL DEFAULT NULL,
    \`tableCount\` int NOT NULL DEFAULT 0,
    \`rowCount\` bigint NOT NULL DEFAULT 0,
    \`compressedBytes\` bigint NOT NULL DEFAULT 0,
    \`encryptedBytes\` bigint NOT NULL DEFAULT 0,
    \`checksum\` char(64) DEFAULT NULL,
    \`objectKeys\` json DEFAULT NULL,
    \`errorMessage\` text DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`db_backup_runs_runId_unique\` (\`runId\`),
    KEY \`db_backup_runs_status_completed_idx\` (\`status\`, \`completedAt\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function collectDatabaseBackup(connection: mysql.Connection) {
  const [tableRows] = await connection.query<mysql.RowDataPacket[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const names = tableRows.map((row) => String(Object.values(row)[0])).sort();
  const tables: BackupTable[] = [];
  let totalRows = 0;

  for (const name of names) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`unsafe table name: ${name}`);
    const [createRows] = await connection.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE \`${name}\``);
    const createTable = String(createRows[0]?.["Create Table"] || Object.values(createRows[0] || {})[1] || "");
    const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${name}\``);
    const normalizedRows = rows.map((row) => normalizeValue(row));
    totalRows += normalizedRows.length;
    tables.push({ name, createTable, rowCount: normalizedRows.length, rows: normalizedRows });
  }

  const payload = {
    format: "lcjgent-database-backup",
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    source: "railway-mysql-private-network",
    tableCount: tables.length,
    rowCount: totalRows,
    tables,
  };
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const compressed = gzipSync(json, { level: 9 });
  return { compressed, tableCount: tables.length, rowCount: totalRows };
}

async function uploadAndVerify(client: S3Client, bucket: string, key: string, body: Buffer, metadata: Record<string, string>) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/octet-stream",
    CacheControl: "private, no-store, max-age=0",
    Metadata: metadata,
  }));
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (Number(head.ContentLength || 0) !== body.length) {
    throw new Error(`uploaded backup size mismatch for ${key}`);
  }
}

async function listAll(client: S3Client, bucket: string, prefix: string): Promise<_Object[]> {
  const objects: _Object[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
    objects.push(...(result.Contents || []));
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function prunePrefix(client: S3Client, bucket: string, prefix: string, keep: number): Promise<void> {
  const objects = (await listAll(client, bucket, prefix))
    .filter((item) => item.Key)
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));
  const expired = objects.slice(keep).map((item) => ({ Key: item.Key! }));
  for (let index = 0; index < expired.length; index += 1000) {
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: expired.slice(index, index + 1000), Quiet: true } }));
  }
}

export async function runDatabaseBackup(reason = "scheduled"): Promise<void> {
  if (backupRunning || process.env.DISABLE_DATABASE_BACKUP === "1") return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for database backups");
  backupRunning = true;
  const runId = crypto.randomUUID();
  const connection = await mysql.createConnection(databaseUrl);
  let runRecorded = false;

  try {
    await ensureBackupRunTable(connection);
    await connection.execute(
      "INSERT INTO `db_backup_runs` (`runId`, `reason`, `status`) VALUES (?, ?, 'running')",
      [runId, reason],
    );
    runRecorded = true;

    const { compressed, tableCount, rowCount } = await collectDatabaseBackup(connection);
    const { encrypted, plaintextSha256, encryptedSha256 } = encryptBackup(compressed);
    verifyEncryptedBackup(encrypted, tableCount, rowCount);
    const { client, bucket } = getStorageConfig();
    const now = new Date();
    const parts = jstParts(now);
    const stamp = timestampForKey(now);
    const keys = [`private/db-backups/daily/lcjgent-${stamp}.json.gz.enc`];
    if (reason.startsWith("startup") || parts.dayOfWeek === 0) keys.push(`private/db-backups/weekly/lcjgent-${stamp}.json.gz.enc`);
    if (reason.startsWith("startup") || parts.day === 1) keys.push(`private/db-backups/monthly/lcjgent-${stamp}.json.gz.enc`);

    for (const key of keys) {
      await uploadAndVerify(client, bucket, key, encrypted, {
        format: "lcjdbk1",
        tables: String(tableCount),
        rows: String(rowCount),
        "plaintext-sha256": plaintextSha256,
        "encrypted-sha256": encryptedSha256,
      });
    }

    await prunePrefix(client, bucket, "private/db-backups/daily/", DAILY_KEEP);
    await prunePrefix(client, bucket, "private/db-backups/weekly/", WEEKLY_KEEP);
    await prunePrefix(client, bucket, "private/db-backups/monthly/", MONTHLY_KEEP);

    await connection.execute(
      `UPDATE \`db_backup_runs\` SET
        \`status\` = 'success', \`completedAt\` = CURRENT_TIMESTAMP,
        \`tableCount\` = ?, \`rowCount\` = ?, \`compressedBytes\` = ?,
        \`encryptedBytes\` = ?, \`checksum\` = ?, \`objectKeys\` = ?
       WHERE \`runId\` = ?`,
      [tableCount, rowCount, compressed.length, encrypted.length, encryptedSha256, JSON.stringify(keys), runId],
    );
    console.log(`[DatabaseBackup] success runId=${runId} tables=${tableCount} rows=${rowCount} bytes=${encrypted.length} keys=${keys.length} roundTripVerified=true`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000);
    if (runRecorded) {
      await connection.execute(
        "UPDATE `db_backup_runs` SET `status` = 'failed', `completedAt` = CURRENT_TIMESTAMP, `errorMessage` = ? WHERE `runId` = ?",
        [message, runId],
      ).catch(() => undefined);
    }
    console.error(`[DatabaseBackup] failed runId=${runId}`, error);
  } finally {
    await connection.end();
    backupRunning = false;
  }
}

async function runStartupBackupIfNeeded(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureBackupRunTable(connection);
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT completedAt FROM `db_backup_runs` WHERE status = 'success' ORDER BY completedAt DESC LIMIT 1",
    );
    const [verifiedRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT completedAt FROM `db_backup_runs` WHERE status = 'success' AND reason = 'startup-verified-v2' ORDER BY completedAt DESC LIMIT 1",
    );
    const last = rows[0]?.completedAt ? new Date(rows[0].completedAt).getTime() : 0;
    const hasVerifiedV2 = Boolean(verifiedRows[0]?.completedAt);
    if (!hasVerifiedV2 || !last || Date.now() - last > 20 * 60 * 60 * 1000) {
      await runDatabaseBackup(hasVerifiedV2 ? "startup" : "startup-verified-v2");
    }
  } finally {
    await connection.end();
  }
}

function millisecondsUntilNextDailyRun(now = new Date()): number {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  let targetUtc = Date.UTC(year, month, day, DAILY_HOUR_JST, DAILY_MINUTE_JST) - JST_OFFSET_MS;
  if (targetUtc <= now.getTime()) targetUtc += 24 * 60 * 60 * 1000;
  return targetUtc - now.getTime();
}

function scheduleNextDailyRun(): void {
  const delay = millisecondsUntilNextDailyRun();
  const timer = setTimeout(async () => {
    await runDatabaseBackup("scheduled");
    scheduleNextDailyRun();
  }, delay);
  timer.unref?.();
  console.log(`[DatabaseBackup] next daily run in ${Math.round(delay / 60000)} minutes (03:15 JST)`);
}

export function startDatabaseBackupScheduler(): void {
  if (schedulerStarted || process.env.DISABLE_DATABASE_BACKUP === "1") return;
  schedulerStarted = true;
  const startupTimer = setTimeout(() => {
    runStartupBackupIfNeeded().catch((error) => console.error("[DatabaseBackup] startup check failed", error));
  }, 30_000);
  startupTimer.unref?.();
  scheduleNextDailyRun();
}
