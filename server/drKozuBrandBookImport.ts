import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { storagePutFile, storageReadBuffer } from "./storage.js";

const IMPORT_KEY = "buzzdrop-drkozu-brand-book-2026-v5";
const EXPECTED_SHA256 = "d390b78a9afa81c7e53452abfa4d771ddbca1a5f3ebfa048db1280a6dd9de509";
const EXPECTED_SIZE = 8_293_906;
const FILE_NAME = "Dr.Kozu_Brand_Book_JP_2026_v5.pdf";
const SOURCE_PATH = resolve(process.cwd(), "server/recoveryData", FILE_NAME);
const STORAGE_KEY = `private/brand-files/drkozu/${EXPECTED_SHA256.slice(0, 16)}-${FILE_NAME}`;
const LEASE_MINUTES = 10;
const HEARTBEAT_MS = 2 * 60_000;

let poolInstance: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (poolInstance) return poolInstance;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Dr.Kozu brand-book import");
  const mysql = await import("mysql2/promise");
  poolInstance = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 3 });
  return poolInstance;
}

async function ensureMarkerTable(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_asset_import_markers (
    importKey VARCHAR(120) NOT NULL PRIMARY KEY,
    sourceSha256 CHAR(64) NOT NULL,
    status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    claimToken VARCHAR(64) NULL,
    claimVersion BIGINT NOT NULL DEFAULT 0,
    brandId INT NULL,
    storeId INT NULL,
    brandFileId INT NULL,
    storageKey VARCHAR(512) NULL,
    errorCode VARCHAR(80) NULL,
    leaseUntil TIMESTAMP NULL,
    attemptCount INT NOT NULL DEFAULT 0,
    completedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_brand_asset_import_status (status, leaseUntil)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [claimColumns] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='brand_asset_import_markers' AND COLUMN_NAME='claimToken'`,
  );
  if (!claimColumns.length) {
    try {
      await pool.query(`ALTER TABLE brand_asset_import_markers ADD COLUMN claimToken VARCHAR(64) NULL AFTER status`);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const message = error instanceof Error ? error.message : String(error);
      if (code !== "ER_DUP_FIELDNAME" && !/duplicate column/i.test(message)) throw error;
    }
  }
  const [versionColumns] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='brand_asset_import_markers' AND COLUMN_NAME='claimVersion'`,
  );
  if (!versionColumns.length) {
    try {
      await pool.query(`ALTER TABLE brand_asset_import_markers ADD COLUMN claimVersion BIGINT NOT NULL DEFAULT 0 AFTER claimToken`);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const message = error instanceof Error ? error.message : String(error);
      if (code !== "ER_DUP_FIELDNAME" && !/duplicate column/i.test(message)) throw error;
    }
  }
}

async function verifySourceFile(): Promise<{ size: number; sha256: string }> {
  const fileStat = await stat(SOURCE_PATH);
  if (!fileStat.isFile() || fileStat.size !== EXPECTED_SIZE) throw new Error("DRKOZU_BRAND_BOOK_SOURCE_SIZE_MISMATCH");
  const buffer = await readFile(SOURCE_PATH);
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("DRKOZU_BRAND_BOOK_SOURCE_NOT_PDF");
  if (!buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1").includes("%%EOF")) {
    throw new Error("DRKOZU_BRAND_BOOK_SOURCE_INCOMPLETE");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== EXPECTED_SHA256) throw new Error("DRKOZU_BRAND_BOOK_SOURCE_HASH_MISMATCH");
  return { size: fileStat.size, sha256 };
}

async function resolveTarget(connection: PoolConnection): Promise<{ brandId: number; storeId: number; actorId: number }> {
  const [brandRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM brands
      WHERE deletedAt IS NULL
        AND LOWER(REPLACE(REPLACE(TRIM(name), '.', ''), ' ', ''))='drkozu'
      ORDER BY id`,
  );
  if (brandRows.length !== 1) throw new Error("DRKOZU_BRAND_TARGET_NOT_UNIQUE");
  const brandId = Number(brandRows[0].id);
  const [storeRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM managed_stores WHERE isActive=1 AND LOWER(TRIM(name))='buzzdrop' ORDER BY id`,
  );
  if (storeRows.length !== 1) throw new Error("BUZZDROP_STORE_TARGET_NOT_UNIQUE");
  const storeId = Number(storeRows[0].id);
  const [relationRows] = await connection.query<RowDataPacket[]>(
    `SELECT 1 AS linked FROM managed_store_brands WHERE storeId=? AND brandId=? LIMIT 1`,
    [storeId, brandId],
  );
  if (!relationRows.length) throw new Error("BUZZDROP_DRKOZU_RELATION_MISSING");
  const [adminRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`,
  );
  const actorId = Number(adminRows[0]?.id || 0);
  if (!actorId) throw new Error("BRAND_BOOK_SYSTEM_ACTOR_MISSING");
  return { brandId, storeId, actorId };
}

async function completedMarkerIsHealthy(connection: Pick<PoolConnection, "query">): Promise<{
  hasCompleted: boolean;
  healthy: boolean;
  brandFileId?: number;
  claimVersion?: number;
}> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT marker.brandFileId,marker.claimVersion,
            EXISTS(SELECT 1 FROM brand_files file
              WHERE file.id=marker.brandFileId AND file.deletedAt IS NULL
                AND file.fileKey=? AND file.fileSize=? AND file.fileName=?
                AND file.fileUrl=CONCAT('/api/brand-files/', file.id)
                AND file.mimeType='application/pdf') AS fileSaved,
            EXISTS(SELECT 1 FROM managed_store_brands relation
              WHERE relation.storeId=marker.storeId AND relation.brandId=marker.brandId) AS relationVerified
       FROM brand_asset_import_markers marker
      WHERE marker.importKey=? AND marker.sourceSha256=? AND marker.status='completed' LIMIT 1`,
    [STORAGE_KEY, EXPECTED_SIZE, FILE_NAME, IMPORT_KEY, EXPECTED_SHA256],
  );
  const row = rows[0];
  const healthy = Number(row?.fileSaved || 0) === 1 && Number(row?.relationVerified || 0) === 1;
  return {
    hasCompleted: Boolean(row),
    healthy,
    brandFileId: Number(row?.brandFileId || 0) || undefined,
    claimVersion: Number(row?.claimVersion || 0),
  };
}

async function claimImport(connection: PoolConnection, claimToken: string): Promise<number | null> {
  await connection.query(
    `INSERT IGNORE INTO brand_asset_import_markers (importKey,sourceSha256,status)
     VALUES (?,?,'pending')`,
    [IMPORT_KEY, EXPECTED_SHA256],
  );
  const [result] = await connection.query(
    `UPDATE brand_asset_import_markers
        SET status='processing',claimToken=?,claimVersion=claimVersion+1,
            leaseUntil=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE),
            attemptCount=attemptCount+1,errorCode=NULL,completedAt=NULL
      WHERE importKey=? AND sourceSha256=? AND status<>'completed'
        AND (status IN ('pending','failed') OR leaseUntil IS NULL OR leaseUntil<CURRENT_TIMESTAMP)`,
    [claimToken, LEASE_MINUTES, IMPORT_KEY, EXPECTED_SHA256],
  );
  if (Number((result as { affectedRows?: number }).affectedRows || 0) !== 1) return null;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT claimVersion FROM brand_asset_import_markers
      WHERE importKey=? AND sourceSha256=? AND status='processing' AND claimToken=? FOR UPDATE`,
    [IMPORT_KEY, EXPECTED_SHA256, claimToken],
  );
  const claimVersion = Number(rows[0]?.claimVersion || 0);
  if (!claimVersion) throw new Error("DRKOZU_BRAND_BOOK_CLAIM_VERSION_MISSING");
  return claimVersion;
}

function startLeaseHeartbeat(pool: Pool, claimToken: string, claimVersion: number): {
  assertOwned: () => Promise<void>;
  stop: () => void;
} {
  let lost = false;
  let inFlight: Promise<void> | null = null;
  const renew = async () => {
    if (lost) throw new Error("DRKOZU_BRAND_BOOK_IMPORT_CLAIM_LOST");
    const [result] = await pool.query(
      `UPDATE brand_asset_import_markers
          SET leaseUntil=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE)
        WHERE importKey=? AND sourceSha256=? AND status='processing' AND claimToken=? AND claimVersion=?`,
      [LEASE_MINUTES, IMPORT_KEY, EXPECTED_SHA256, claimToken, claimVersion],
    );
    if (Number((result as { affectedRows?: number }).affectedRows || 0) !== 1) {
      lost = true;
      throw new Error("DRKOZU_BRAND_BOOK_IMPORT_CLAIM_LOST");
    }
  };
  const heartbeat = () => {
    if (inFlight || lost) return;
    inFlight = renew()
      .catch(() => {
        lost = true;
        console.error("[DrKozuBrandBook] lease heartbeat failed", {
          code: "DRKOZU_BRAND_BOOK_IMPORT_CLAIM_LOST",
          claimVersion,
        });
      })
      .finally(() => { inFlight = null; });
  };
  const timer = setInterval(heartbeat, HEARTBEAT_MS);
  timer.unref?.();
  return {
    assertOwned: async () => {
      if (inFlight) await inFlight;
      await renew();
    },
    stop: () => clearInterval(timer),
  };
}

async function finishFailed(pool: Pool, claimToken: string, claimVersion: number, error: unknown): Promise<boolean> {
  const code = error instanceof Error ? error.message.slice(0, 80) : "DRKOZU_BRAND_BOOK_IMPORT_FAILED";
  try {
    const [result] = await pool.query(
      `UPDATE brand_asset_import_markers
          SET status='failed',errorCode=?,leaseUntil=NULL,claimToken=NULL
        WHERE importKey=? AND sourceSha256=? AND status='processing' AND claimToken=? AND claimVersion=?`,
      [code, IMPORT_KEY, EXPECTED_SHA256, claimToken, claimVersion],
    );
    return Number((result as { affectedRows?: number }).affectedRows || 0) === 1;
  } catch {
    console.error("[DrKozuBrandBook] failed-state persistence unavailable", {
      code: "DRKOZU_BRAND_BOOK_FAILURE_STATE_WRITE_FAILED",
      claimVersion,
    });
    return false;
  }
}

async function verifyStoredObject(): Promise<void> {
  const stored = await storageReadBuffer(STORAGE_KEY);
  if (stored.data.length !== EXPECTED_SIZE) throw new Error("DRKOZU_BRAND_BOOK_STORED_SIZE_MISMATCH");
  const sha256 = createHash("sha256").update(stored.data).digest("hex");
  if (sha256 !== EXPECTED_SHA256) throw new Error("DRKOZU_BRAND_BOOK_STORED_HASH_MISMATCH");
}

export async function importDrKozuBrandBook(): Promise<{ status: "completed" | "already_completed" | "busy"; brandFileId?: number }> {
  const source = await verifySourceFile();
  const pool = await getPool();
  await ensureMarkerTable(pool);
  const completedHealth = await completedMarkerIsHealthy(pool as unknown as Pick<PoolConnection, "query">);
  if (completedHealth.hasCompleted) {
    let storedObjectHealthy = false;
    if (completedHealth.healthy) {
      try {
        await verifyStoredObject();
        storedObjectHealthy = true;
      } catch {
        storedObjectHealthy = false;
      }
    }
    if (completedHealth.healthy && storedObjectHealthy) {
      return { status: "already_completed", brandFileId: completedHealth.brandFileId };
    }
    const [resetResult] = await pool.query(
      `UPDATE brand_asset_import_markers
          SET status='failed',errorCode='COMPLETED_STATE_INVALID',completedAt=NULL,leaseUntil=NULL,claimToken=NULL
        WHERE importKey=? AND sourceSha256=? AND status='completed' AND claimVersion=?`,
      [IMPORT_KEY, EXPECTED_SHA256, completedHealth.claimVersion || 0],
    );
    if (Number((resetResult as { affectedRows?: number }).affectedRows || 0) !== 1) {
      return { status: "busy" };
    }
  }
  const claimToken = randomUUID();
  const claimConnection = await pool.getConnection();
  let claimVersion: number | null = null;
  try {
    await claimConnection.beginTransaction();
    claimVersion = await claimImport(claimConnection, claimToken);
    await claimConnection.commit();
  } catch (error) {
    await claimConnection.rollback();
    throw error;
  } finally {
    claimConnection.release();
  }
  if (!claimVersion) return { status: "busy" };

  const lease = startLeaseHeartbeat(pool, claimToken, claimVersion);
  try {
    await lease.assertOwned();
    const targetCheck = await pool.getConnection();
    try {
      await resolveTarget(targetCheck);
    } finally {
      targetCheck.release();
    }
    await storagePutFile(STORAGE_KEY, SOURCE_PATH, "application/pdf");
    await verifyStoredObject();
    await lease.assertOwned();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const target = await resolveTarget(connection);
      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT id,fileName,fileUrl,fileSize,mimeType FROM brand_files
          WHERE brandId=? AND deletedAt IS NULL AND fileKey=?
          ORDER BY id LIMIT 1 FOR UPDATE`,
        [target.brandId, STORAGE_KEY],
      );
      const existing = existingRows[0];
      let brandFileId = Number(existing?.id || 0);
      if (brandFileId) {
        const canonicalUrl = `/api/brand-files/${brandFileId}`;
        const metadataChanged =
          String(existing.fileName || "") !== FILE_NAME ||
          String(existing.fileUrl || "") !== canonicalUrl ||
          Number(existing.fileSize || 0) !== source.size ||
          String(existing.mimeType || "") !== "application/pdf";
        if (metadataChanged) {
          await connection.query(
            `UPDATE brand_files
                SET fileName=?,fileUrl=?,fileSize=?,mimeType=?
              WHERE id=? AND brandId=? AND deletedAt IS NULL AND fileKey=?`,
            [FILE_NAME, canonicalUrl, source.size, "application/pdf", brandFileId, target.brandId, STORAGE_KEY],
          );
          await connection.query(
            `INSERT INTO brand_edit_logs
              (brandId,actionType,entityType,entityId,entityName,changeDescription,newValue,userId,userName)
             VALUES (?,'update','memo',?,?,?,?,?,?)`,
            [
              target.brandId,
              brandFileId,
              FILE_NAME,
              `Dr.Kozuブランドブック「${FILE_NAME}」の保存メタデータを検証済み状態へ修復しました`,
              JSON.stringify({ sha256: source.sha256, fileSize: source.size, storeId: target.storeId, source: "verified-metadata-repair" }),
              target.actorId,
              "系统导入（用户确认）",
            ],
          );
        }
      }
      if (!brandFileId) {
        const [collisionRows] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM brand_files
            WHERE brandId=? AND deletedAt IS NULL AND fileName=?
            ORDER BY id LIMIT 1 FOR UPDATE`,
          [target.brandId, FILE_NAME],
        );
        if (collisionRows.length) throw new Error("DRKOZU_BRAND_BOOK_NAME_COLLISION");
        const [insertResult] = await connection.query(
          `INSERT INTO brand_files
            (brandId,fileName,fileUrl,fileKey,fileSize,mimeType,uploadedBy,uploadedByName)
           VALUES (?,?,?,?,?,?,?,?)`,
          [target.brandId, FILE_NAME, "/api/brand-files/pending", STORAGE_KEY, source.size, "application/pdf", target.actorId, "系统导入（用户确认）"],
        );
        brandFileId = Number((insertResult as { insertId?: number }).insertId || 0);
        if (!brandFileId) throw new Error("DRKOZU_BRAND_BOOK_FILE_INSERT_FAILED");
        await connection.query(
          `UPDATE brand_files SET fileUrl=? WHERE id=? AND brandId=?`,
          [`/api/brand-files/${brandFileId}`, brandFileId, target.brandId],
        );
        await connection.query(
          `INSERT INTO brand_edit_logs
            (brandId,actionType,entityType,entityId,entityName,changeDescription,newValue,userId,userName)
           VALUES (?,'create','memo',?,?,?,?,?,?)`,
          [
            target.brandId,
            brandFileId,
            FILE_NAME,
            `BUZZDROP关联品牌Dr.Kozuにブランドブック「${FILE_NAME}」を保存しました`,
            JSON.stringify({ sha256: source.sha256, fileSize: source.size, storeId: target.storeId, source: "user-confirmed-pdf-import" }),
            target.actorId,
            "系统导入（用户确认）",
          ],
        );
      }
      const [completionResult] = await connection.query(
        `UPDATE brand_asset_import_markers
            SET status='completed',brandId=?,storeId=?,brandFileId=?,storageKey=?,errorCode=NULL,
                leaseUntil=NULL,claimToken=NULL,completedAt=CURRENT_TIMESTAMP
          WHERE importKey=? AND sourceSha256=? AND status='processing' AND claimToken=? AND claimVersion=?`,
        [target.brandId, target.storeId, brandFileId, STORAGE_KEY, IMPORT_KEY, EXPECTED_SHA256, claimToken, claimVersion],
      );
      if (Number((completionResult as { affectedRows?: number }).affectedRows || 0) !== 1) {
        throw new Error("DRKOZU_BRAND_BOOK_IMPORT_CLAIM_LOST");
      }
      await connection.commit();
      return { status: "completed", brandFileId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    const failurePersisted = await finishFailed(pool, claimToken, claimVersion, error);
    if (!failurePersisted) {
      console.warn("[DrKozuBrandBook] failure was not written because ownership was lost", {
        code: "DRKOZU_BRAND_BOOK_FAILURE_CLAIM_LOST",
        claimVersion,
      });
    }
    throw error;
  } finally {
    lease.stop();
  }
}

export async function getDrKozuBrandBookImportHealth(): Promise<{
  healthy: boolean;
  status: string;
  fileSaved: boolean;
  relationVerified: boolean;
}> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT marker.status,
              EXISTS(SELECT 1 FROM brand_files file
                WHERE file.id=marker.brandFileId AND file.deletedAt IS NULL
                  AND file.fileKey=? AND file.fileSize=? AND file.fileName=?
                  AND file.fileUrl=CONCAT('/api/brand-files/', file.id)
                  AND file.mimeType='application/pdf') AS fileSaved,
              EXISTS(SELECT 1 FROM managed_store_brands relation
                WHERE relation.storeId=marker.storeId AND relation.brandId=marker.brandId) AS relationVerified
         FROM brand_asset_import_markers marker
        WHERE marker.importKey=? AND marker.sourceSha256=? LIMIT 1`,
      [STORAGE_KEY, EXPECTED_SIZE, FILE_NAME, IMPORT_KEY, EXPECTED_SHA256],
    );
    const row = rows[0] || {};
    const fileSaved = Number(row.fileSaved || 0) === 1;
    const relationVerified = Number(row.relationVerified || 0) === 1;
    const status = String(row.status || "pending");
    return { healthy: status === "completed" && fileSaved && relationVerified, status, fileSaved, relationVerified };
  } catch {
    return { healthy: false, status: "unavailable", fileSaved: false, relationVerified: false };
  }
}

export const DRKOZU_BRAND_BOOK_IMPORT = Object.freeze({
  importKey: IMPORT_KEY,
  sha256: EXPECTED_SHA256,
  fileName: FILE_NAME,
  fileSize: EXPECTED_SIZE,
  storageKey: STORAGE_KEY,
  leaseMinutes: LEASE_MINUTES,
});
