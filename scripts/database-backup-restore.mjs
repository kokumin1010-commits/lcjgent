import crypto from "node:crypto";
import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import mysql from "mysql2/promise";

function usage() {
  console.error("Usage: node scripts/database-backup-restore.mjs <backup.json.gz.enc> [--verify-only | --apply] [--allow-nonempty]");
  process.exit(2);
}

const backupPath = process.argv[2];
const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify-only") || !apply;
const allowNonempty = process.argv.includes("--allow-nonempty");
if (!backupPath) usage();

function getEncryptionKey() {
  const secret = process.env.DB_BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("DB_BACKUP_ENCRYPTION_KEY or JWT_SECRET with at least 16 characters is required");
  }
  return crypto.scryptSync(secret, "lcjgent-railway-mysql-backup-v1", 32);
}

function decryptBackup(encrypted) {
  const header = encrypted.subarray(0, 7).toString("ascii");
  if (header !== "LCJDBK1") throw new Error("Invalid backup header");
  const iv = encrypted.subarray(7, 19);
  const authTag = encrypted.subarray(19, 35);
  const ciphertext = encrypted.subarray(35);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function reviveValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value !== "object") return value;
  if (value.__lcjType === "bigint") return String(value.value);
  if (value.__lcjType === "date") return new Date(String(value.value));
  if (value.__lcjType === "buffer") return Buffer.from(String(value.base64), "base64");
  return JSON.stringify(value);
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe identifier: ${value}`);
  return `\`${value}\``;
}

const encrypted = await fs.readFile(backupPath);
const encryptedSha256 = crypto.createHash("sha256").update(encrypted).digest("hex");
const compressed = decryptBackup(encrypted);
const payload = JSON.parse(gunzipSync(compressed).toString("utf8"));

if (payload?.format !== "lcjgent-database-backup" || payload?.version !== 1 || !Array.isArray(payload?.tables)) {
  throw new Error("Unsupported backup format");
}
const computedRows = payload.tables.reduce((sum, table) => sum + Number(table.rowCount || 0), 0);
if (payload.tableCount !== payload.tables.length || payload.rowCount !== computedRows) {
  throw new Error(`Manifest mismatch tables=${payload.tableCount}/${payload.tables.length} rows=${payload.rowCount}/${computedRows}`);
}

const verification = {
  ok: true,
  encryptedSha256,
  createdAt: payload.createdAt,
  source: payload.source,
  tableCount: payload.tableCount,
  rowCount: payload.rowCount,
  mode: verifyOnly ? "verify-only" : "apply",
};

if (verifyOnly) {
  console.log(JSON.stringify(verification, null, 2));
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required with --apply");
const connection = await mysql.createConnection(databaseUrl);

try {
  const [existingRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  if (existingRows.length > 0 && !allowNonempty) {
    throw new Error(`Target database is not empty (${existingRows.length} tables). Refusing restore without --allow-nonempty.`);
  }

  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of payload.tables) {
    const tableName = quoteIdentifier(String(table.name));
    if (typeof table.createTable !== "string" || !/^CREATE TABLE/i.test(table.createTable.trim())) {
      throw new Error(`Invalid CREATE TABLE statement for ${table.name}`);
    }
    await connection.query(table.createTable).catch((error) => {
      if (!(allowNonempty && error?.code === "ER_TABLE_EXISTS_ERROR")) throw error;
    });

    const rows = Array.isArray(table.rows) ? table.rows : [];
    for (let offset = 0; offset < rows.length; offset += 100) {
      const batch = rows.slice(offset, offset + 100);
      if (batch.length === 0) continue;
      const columns = Object.keys(batch[0]);
      if (columns.length === 0) continue;
      for (const row of batch) {
        const rowColumns = Object.keys(row);
        if (rowColumns.length !== columns.length || rowColumns.some((column, index) => column !== columns[index])) {
          throw new Error(`Inconsistent row columns in ${table.name}`);
        }
      }
      const placeholders = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
      const values = batch.flatMap((row) => columns.map((column) => reviveValue(row[column])));
      const insertMode = allowNonempty ? "INSERT IGNORE" : "INSERT";
      await connection.query(
        `${insertMode} INTO ${tableName} (${columns.map(quoteIdentifier).join(",")}) VALUES ${placeholders}`,
        values,
      );
    }
  }
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");

  const mismatches = [];
  let restoredRows = 0;
  for (const table of payload.tables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(String(table.name))}`);
    const actual = Number(rows[0]?.count || 0);
    restoredRows += actual;
    if ((!allowNonempty && actual !== table.rowCount) || (allowNonempty && actual < table.rowCount)) {
      mismatches.push({ table: table.name, expectedAtLeast: table.rowCount, actual });
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`Restore verification failed: ${JSON.stringify(mismatches.slice(0, 20))}`);
  }
  console.log(JSON.stringify({ ...verification, restoredRows, mismatchCount: 0 }, null, 2));
} finally {
  await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => undefined);
  await connection.end();
}
