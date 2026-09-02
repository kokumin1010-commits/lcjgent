/**
 * LCF ranking permanent-retirement maintenance router.
 * Temporary: remove this router immediately after production reports zero rows,
 * zero original screenshots and zero transient encrypted backup objects.
 */
import crypto from "crypto";
import { gzipSync, gunzipSync } from "zlib";
import mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, t } from "./_core/trpc";
import { verifyFestivalAdminRequest } from "./festivalAuthRouter";
import { storageDelete, storageGet, storageListKeys, storagePut } from "./storage";

const CONFIRM_PHRASE = "DELETE_LCF_RANKING_COMPLETELY_2026";
const LOCK_NAME = "lcj:lcf:ranking-retirement";
const BACKUP_PREFIX = "private/lcf-ranking-retirement/current";
const MANIFEST_KEY = `${BACKUP_PREFIX}/manifest.json.gz.enc`;
const ENCRYPTION_MAGIC = Buffer.from("LCFR1", "ascii");

type RankingRow = Record<string, unknown> & {
  id: number;
  screenshotUrl?: string | null;
};

type ScreenshotBackup = {
  rowId: number;
  originalKey: string;
  encryptedKey: string;
  plaintextSha256: string;
  encryptedSha256: string;
  bytes: number;
  contentType: string;
};

type RetirementManifest = {
  format: "lcf-ranking-retirement-transient";
  version: 1;
  operationId: string;
  createdAt: string;
  rowCount: number;
  rows: RankingRow[];
  screenshots: ScreenshotBackup[];
};

const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const admin = await verifyFestivalAdminRequest(ctx.req, (ctx as any).user);
  if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
  return next({ ctx: { ...ctx, lcfAdmin: admin } as any });
});

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return mysql.createPool(process.env.DATABASE_URL);
}

function encryptionSecret(): string {
  const secret = process.env.DATABASE_BACKUP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("DATABASE_BACKUP_ENCRYPTION_KEY must be configured with at least 32 characters");
  }
  return secret;
}

function encryptTransient(plaintext: Buffer): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(encryptionSecret(), salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([ENCRYPTION_MAGIC, salt, iv, tag, ciphertext]);
}

function decryptTransient(encrypted: Buffer): Buffer {
  if (!encrypted.subarray(0, ENCRYPTION_MAGIC.length).equals(ENCRYPTION_MAGIC)) {
    throw new Error("Invalid ranking retirement backup format");
  }
  let offset = ENCRYPTION_MAGIC.length;
  const salt = encrypted.subarray(offset, offset + 16); offset += 16;
  const iv = encrypted.subarray(offset, offset + 12); offset += 12;
  const tag = encrypted.subarray(offset, offset + 16); offset += 16;
  const key = crypto.scryptSync(encryptionSecret(), salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted.subarray(offset)), decipher.final()]);
}

function sha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function screenshotKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/ranking-screenshots/";
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const key = url.slice(index + 1).split(/[?#]/, 1)[0] || null;
  return key?.startsWith("ranking-screenshots/") ? key : null;
}

async function fetchStorageObject(key: string): Promise<{ data: Buffer; contentType: string }> {
  const signed = await storageGet(key);
  const response = await fetch(signed.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to read storage object ${key}: HTTP ${response.status}`);
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function storageObjectExists(key: string): Promise<boolean> {
  try {
    const signed = await storageGet(key);
    const response = await fetch(signed.url, { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-store" });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}

async function putAndVerifyEncrypted(key: string, encrypted: Buffer): Promise<string> {
  await storagePut(key, encrypted, "application/octet-stream");
  const verified = await fetchStorageObject(key);
  const expected = sha256(encrypted);
  if (sha256(verified.data) !== expected || verified.data.length !== encrypted.length) {
    throw new Error(`Transient backup verification failed for ${key}`);
  }
  return expected;
}

async function tableExists(pool: mysql.Pool): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lcf_ranking_submissions'`,
  ) as any;
  return Number(rows?.[0]?.count || 0) > 0;
}

async function loadManifest(): Promise<RetirementManifest | null> {
  if (!(await storageObjectExists(MANIFEST_KEY))) return null;
  const encrypted = await fetchStorageObject(MANIFEST_KEY);
  return JSON.parse(gunzipSync(decryptTransient(encrypted.data)).toString("utf8")) as RetirementManifest;
}

async function deleteOriginalScreenshots(manifest: RetirementManifest): Promise<number> {
  let deleted = 0;
  for (const screenshot of manifest.screenshots) {
    await storageDelete(screenshot.originalKey);
    if (await storageObjectExists(screenshot.originalKey)) {
      throw new Error(`Original ranking screenshot still exists after delete: ${screenshot.originalKey}`);
    }
    deleted += 1;
  }
  return deleted;
}

export const rankingRetirementRouter = router({
  status: festivalAdminProcedure.query(async () => {
    const pool = getPool();
    try {
      const exists = await tableExists(pool);
      let rowCount = 0;
      const screenshotCount = (await storageListKeys("ranking-screenshots/")).length;
      if (exists) {
        const [rows] = await pool.query(
          `SELECT COUNT(*) AS rowCount FROM lcf_ranking_submissions`,
        ) as any;
        rowCount = Number(rows?.[0]?.rowCount || 0);
      }
      return {
        tableExists: exists,
        rowCount,
        screenshotCount,
        transientBackupPresent: await storageObjectExists(MANIFEST_KEY),
      };
    } finally {
      await pool.end();
    }
  }),

  execute: festivalAdminProcedure
    .input(z.object({ confirmPhrase: z.literal(CONFIRM_PHRASE) }))
    .mutation(async () => {
      const pool = getPool();
      const connection = await pool.getConnection();
      let lockAcquired = false;
      try {
        const [lockRows] = await connection.query(`SELECT GET_LOCK(?, 60) AS acquired`, [LOCK_NAME]) as any;
        lockAcquired = Number(lockRows?.[0]?.acquired || 0) === 1;
        if (!lockAcquired) throw new TRPCError({ code: "CONFLICT", message: "ランキング削除処理が実行中です" });

        const existingManifest = await loadManifest();
        const exists = await tableExists(pool);
        if (!exists) {
          return { success: true, rowCount: 0, screenshotCount: 0, transientBackupPresent: Boolean(existingManifest) };
        }

        const [rows] = await connection.query(`SELECT * FROM lcf_ranking_submissions ORDER BY id ASC`) as any;
        let manifest = existingManifest;
        if (!manifest && rows.length > 0) {
          const operationId = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomBytes(4).toString("hex")}`;
          const screenshots: ScreenshotBackup[] = [];
          const rankingRows = rows as RankingRow[];
          const allOriginalKeys = await storageListKeys("ranking-screenshots/");
          for (const originalKey of allOriginalKeys) {
            const row = rankingRows.find((candidate) => screenshotKey(candidate.screenshotUrl) === originalKey);
            const original = await fetchStorageObject(originalKey);
            const plaintextSha256 = sha256(original.data);
            const encrypted = encryptTransient(original.data);
            const rowId = Number(row?.id || 0);
            const encryptedKey = `${BACKUP_PREFIX}/screenshots/${rowId}-${plaintextSha256.slice(0, 16)}.enc`;
            const encryptedSha256 = await putAndVerifyEncrypted(encryptedKey, encrypted);
            screenshots.push({
              rowId,
              originalKey,
              encryptedKey,
              plaintextSha256,
              encryptedSha256,
              bytes: original.data.length,
              contentType: original.contentType,
            });
          }
          manifest = {
            format: "lcf-ranking-retirement-transient",
            version: 1,
            operationId,
            createdAt: new Date().toISOString(),
            rowCount: rows.length,
            rows,
            screenshots,
          };
          const encryptedManifest = encryptTransient(gzipSync(Buffer.from(JSON.stringify(manifest), "utf8"), { level: 9 }));
          await putAndVerifyEncrypted(MANIFEST_KEY, encryptedManifest);
          const verifiedManifest = await loadManifest();
          if (!verifiedManifest || verifiedManifest.rowCount !== rows.length || verifiedManifest.screenshots.length !== screenshots.length) {
            throw new Error("Transient ranking manifest round-trip verification failed");
          }
          manifest = verifiedManifest;
        }

        await connection.beginTransaction();
        await connection.query(`DELETE FROM lcf_ranking_submissions`);
        await connection.commit();

        const deletedScreenshots = manifest ? await deleteOriginalScreenshots(manifest) : 0;
        return {
          success: true,
          rowCount: rows.length,
          screenshotCount: deletedScreenshots,
          transientBackupPresent: Boolean(manifest),
        };
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        if (lockAcquired) await connection.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]).catch(() => undefined);
        connection.release();
        await pool.end();
      }
    }),

  finalize: festivalAdminProcedure
    .input(z.object({ confirmPhrase: z.literal(CONFIRM_PHRASE) }))
    .mutation(async () => {
      const pool = getPool();
      try {
        const manifest = await loadManifest();
        const exists = await tableExists(pool);
        if (exists) {
          const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM lcf_ranking_submissions`) as any;
          if (Number(rows?.[0]?.count || 0) !== 0) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ランキングデータが残っています" });
          }
          await pool.query(`DROP TABLE lcf_ranking_submissions`);
        }
        if (manifest) await deleteOriginalScreenshots(manifest);
        for (const key of await storageListKeys(`${BACKUP_PREFIX}/`)) await storageDelete(key);
        const tableStillExists = await tableExists(pool);
        const remainingOriginalScreenshots = await storageListKeys("ranking-screenshots/");
        const remainingTransientBackups = await storageListKeys(`${BACKUP_PREFIX}/`);
        const transientBackupPresent = remainingTransientBackups.length > 0;
        if (tableStillExists || remainingOriginalScreenshots.length > 0 || transientBackupPresent) {
          throw new Error("Ranking retirement final verification failed");
        }
        return {
          success: true,
          tableExists: false,
          rowCount: 0,
          screenshotCount: 0,
          transientBackupPresent: false,
        };
      } finally {
        await pool.end();
      }
    }),
});
