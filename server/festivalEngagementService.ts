/**
 * 第2回LCFの事前マッチングと自己申告GMVを支える共通基盤。
 * 既存表は変更せず、新規表だけを冪等作成する。証拠画像はprivate keyで保存する。
 */
import { createHash } from "node:crypto";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { storageGet, storagePut } from "./storage";

export const SECOND_EDITION_EVENT_YEAR = "2026-02";
export const SECOND_EDITION_EVENT_DATES = ["2026-12-08", "2026-12-09"] as const;
export const GMV_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

let engagementPool: Pool | null = null;
let schemaPromise: Promise<void> | null = null;

export function getFestivalEngagementPool(): Pool {
  if (!engagementPool) {
    if (!process.env.DATABASE_URL) throw new Error("Database not available");
    engagementPool = mysql.createPool(process.env.DATABASE_URL);
  }
  return engagementPool;
}

async function performSchemaUpgrade(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS festival_match_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    requestCode VARCHAR(32) NOT NULL,
    eventYear VARCHAR(10) NOT NULL,
    creatorAccountId INT NOT NULL,
    creatorApplicationId INT NOT NULL,
    brandProfileId INT NOT NULL,
    productId INT NOT NULL,
    brandOwnerAccountId INT NULL,
    activeKey VARCHAR(160) NULL,
    message TEXT NOT NULL,
    plannedDate TIMESTAMP NULL,
    contactShareConsent TINYINT(1) NOT NULL DEFAULT 0,
    creatorContactSnapshot VARCHAR(500) NULL,
    brandContactSnapshot VARCHAR(500) NULL,
    status ENUM('requested','needs_info','approved','declined','cancelled','completed') NOT NULL DEFAULT 'requested',
    brandReply TEXT NULL,
    reviewedByAccountId INT NULL,
    reviewedAt TIMESTAMP NULL,
    completedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_festival_match_code (requestCode),
    UNIQUE KEY uq_festival_match_active_key (activeKey),
    INDEX idx_festival_match_creator (eventYear, creatorAccountId, status, updatedAt),
    INDEX idx_festival_match_brand (eventYear, brandProfileId, status, updatedAt),
    INDEX idx_festival_match_product (eventYear, productId, status, updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS festival_match_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    matchRequestId BIGINT NOT NULL,
    senderAccountId INT NOT NULL,
    senderRole ENUM('creator','brand','admin') NOT NULL,
    message TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_festival_match_message (matchRequestId, createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS festival_gmv_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportCode VARCHAR(32) NOT NULL,
    eventYear VARCHAR(10) NOT NULL,
    reportDate CHAR(10) NOT NULL,
    creatorAccountId INT NOT NULL,
    creatorApplicationId INT NOT NULL,
    matchRequestId BIGINT NOT NULL,
    supersedesReportId BIGINT NULL,
    brandProfileId INT NOT NULL,
    productId INT NOT NULL,
    submittedAmount DECIMAL(14,2) NOT NULL,
    verifiedAmount DECIMAL(14,2) NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'JPY',
    orderCount INT NULL,
    liveUrl VARCHAR(1000) NULL,
    note TEXT NULL,
    evidenceStorageKey VARCHAR(1000) NOT NULL,
    evidenceFileName VARCHAR(500) NOT NULL,
    evidenceMimeType VARCHAR(100) NOT NULL,
    evidenceByteSize INT NOT NULL,
    evidenceSha256 CHAR(64) NOT NULL,
    activeEvidenceSha256 CHAR(64) NULL,
    activeLiveUrlHash CHAR(64) NULL,
    status ENUM('submitted','needs_revision','verified','voided') NOT NULL DEFAULT 'submitted',
    reviewedByAccountId INT NULL,
    reviewedAt TIMESTAMP NULL,
    reviewNote TEXT NULL,
    submittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_festival_gmv_code (reportCode),
    UNIQUE KEY uq_festival_gmv_active_evidence (activeEvidenceSha256),
    UNIQUE KEY uq_festival_gmv_active_live_url (activeLiveUrlHash),
    INDEX idx_festival_gmv_creator_date (eventYear, creatorAccountId, reportDate, status),
    INDEX idx_festival_gmv_review_queue (eventYear, status, submittedAt),
    INDEX idx_festival_gmv_match (matchRequestId, reportDate),
    INDEX idx_festival_gmv_supersedes (supersedesReportId),
    INDEX idx_festival_gmv_evidence_hash (eventYear, evidenceSha256)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS festival_gmv_adjustments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportId BIGINT NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('applied','voided') NOT NULL DEFAULT 'applied',
    actorAdminId INT NOT NULL,
    voidedByAdminId INT NULL,
    voidedReason TEXT NULL,
    voidedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_festival_gmv_adjustment_report (reportId, status, createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS festival_engagement_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    eventYear VARCHAR(10) NOT NULL,
    actorAccountId INT NULL,
    actorRole ENUM('creator','brand','admin','system') NOT NULL,
    entityType ENUM('matching','gmv_report','gmv_adjustment','evidence') NOT NULL,
    entityId VARCHAR(64) NOT NULL,
    action VARCHAR(100) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    reason TEXT NULL,
    ipAddress VARCHAR(45) NULL,
    userAgent VARCHAR(500) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_festival_engagement_entity (entityType, entityId, createdAt),
    INDEX idx_festival_engagement_actor (actorAccountId, createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function ensureFestivalEngagementSchema(pool: Pool = getFestivalEngagementPool()): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = performSchemaUpgrade(pool).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function safeEvidenceFileName(fileName: string): string {
  return String(fileName || "gmv-evidence.png")
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-180) || "gmv-evidence.png";
}

function decodeEvidenceBase64(base64Data: string): Buffer {
  const compact = String(base64Data || "").replace(/\s+/g, "");
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new Error("証拠画像の形式が正しくありません");
  }
  const buffer = Buffer.from(compact, "base64");
  if (!buffer.length) throw new Error("証拠画像が空です");
  if (buffer.length > GMV_EVIDENCE_MAX_BYTES) throw new Error("証拠画像は8MB以下にしてください");
  return buffer;
}

function assertEvidenceImage(buffer: Buffer, mimeType: string): void {
  const normalized = mimeType.toLowerCase();
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const valid = (normalized === "image/jpeg" && jpeg)
    || (normalized === "image/png" && png)
    || (normalized === "image/webp" && webp);
  if (!valid) throw new Error("JPEG・PNG・WebPの証拠画像だけアップロードできます");
}

export function inspectFestivalGmvEvidence(base64Data: string, mimeType: string): {
  buffer: Buffer;
  mimeType: string;
  byteSize: number;
  sha256: string;
} {
  const buffer = decodeEvidenceBase64(base64Data);
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
  assertEvidenceImage(buffer, normalizedMimeType);
  return {
    buffer,
    mimeType: normalizedMimeType,
    byteSize: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function storeFestivalGmvEvidence(input: {
  eventYear: string;
  accountId: number;
  fileName: string;
  mimeType: string;
  base64Data: string;
}): Promise<{ key: string; fileName: string; mimeType: string; byteSize: number; sha256: string }> {
  const inspected = inspectFestivalGmvEvidence(input.base64Data, input.mimeType);
  const fileName = safeEvidenceFileName(input.fileName);
  const key = `private/lcf/gmv/${input.eventYear}/${input.accountId}/${inspected.sha256}-${fileName}`;
  await storagePut(key, inspected.buffer, inspected.mimeType);
  return { key, fileName, mimeType: inspected.mimeType, byteSize: inspected.byteSize, sha256: inspected.sha256 };
}

export async function getFestivalGmvEvidenceUrl(key: string): Promise<string> {
  if (!key.startsWith("private/lcf/gmv/")) throw new Error("証拠画像キーが正しくありません");
  return (await storageGet(key)).url;
}

export type FestivalEngagementAuditInput = {
  eventYear?: string;
  actorAccountId?: number | null;
  actorRole: "creator" | "brand" | "admin" | "system";
  entityType: "matching" | "gmv_report" | "gmv_adjustment" | "evidence";
  entityId: string | number;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  req?: any;
};

export async function writeFestivalEngagementAudit(
  connection: Pool | PoolConnection,
  input: FestivalEngagementAuditInput,
): Promise<void> {
  const ipAddress = input.req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || input.req?.socket?.remoteAddress
    || null;
  const userAgent = input.req?.headers?.["user-agent"]?.slice(0, 500) || null;
  await connection.query(
    `INSERT INTO festival_engagement_audit_logs
      (eventYear, actorAccountId, actorRole, entityType, entityId, action, beforeJson, afterJson, reason, ipAddress, userAgent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.eventYear || SECOND_EDITION_EVENT_YEAR,
      input.actorAccountId ?? null,
      input.actorRole,
      input.entityType,
      String(input.entityId),
      input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.reason ?? null,
      ipAddress,
      userAgent,
    ],
  );
}
