import { createHash } from "node:crypto";
import type mysql from "mysql2/promise";
import { storageDelete, storageGet } from "./storage";
import { parseCashflowReceiptUrls } from "./cashflowHelpers";

const RECEIPT_OBJECT_REF_PREFIX = "cashflow-receipt-object:";
const LEGACY_RECEIPT_REF_PREFIX = "cashflow-legacy-receipt:";
const CLEANUP_STALE_MINUTES = 5;
const CLEANUP_CLAIM_STALE_MINUTES = 10;

export type CashflowReceiptFile = {
  attachmentId: string;
  url: string;
  contentType: string;
  fileName: string;
};

type ReceiptMetadata = {
  id: number;
  cashflowId: number;
  storageKey: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  status: string;
};

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

export function makeCashflowReceiptObjectRef(id: number): string {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid receipt object id");
  return `${RECEIPT_OBJECT_REF_PREFIX}${id}`;
}

export function parseCashflowReceiptObjectId(value: string): number | null {
  if (!value.startsWith(RECEIPT_OBJECT_REF_PREFIX)) return null;
  const id = Number(value.slice(RECEIPT_OBJECT_REF_PREFIX.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function cashflowReceiptAttachmentId(value: string): string {
  const objectId = parseCashflowReceiptObjectId(value);
  if (objectId) return makeCashflowReceiptObjectRef(objectId);
  return `${LEGACY_RECEIPT_REF_PREFIX}${createHash("sha256").update(value).digest("hex")}`;
}

export function maskCashflowReceiptUrls(value: unknown): string | null {
  const count = parseCashflowReceiptUrls(value).length;
  return count > 0
    ? JSON.stringify(Array.from({ length: count }, (_, index) => `private-receipt:${index + 1}`))
    : null;
}

export async function ensureCashflowReceiptStorageSchema(pool: mysql.Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_receipt_objects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cashflowId INT NOT NULL,
    storageKey VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    originalFileName VARCHAR(255) NOT NULL,
    contentType VARCHAR(100) NOT NULL,
    fileSize BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_upload',
    actorUserId INT DEFAULT NULL,
    cleanupAttempts INT NOT NULL DEFAULT 0,
    lastError VARCHAR(500) DEFAULT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activatedAt TIMESTAMP NULL DEFAULT NULL,
    deletedAt TIMESTAMP NULL DEFAULT NULL,
    cleanedAt TIMESTAMP NULL DEFAULT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cashflow_receipt_storage_key (storageKey),
    INDEX idx_cashflow_receipt_cashflow (cashflowId, status),
    INDEX idx_cashflow_receipt_cleanup (status, updatedAt)
  )`);
}

export async function stageCashflowReceiptObject(pool: mysql.Pool, input: {
  cashflowId: number;
  storageKey: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  actorUserId: number | null;
}): Promise<{ id: number; receiptRef: string }> {
  const [result] = await pool.query(
    `INSERT INTO cashflow_receipt_objects
      (cashflowId, storageKey, originalFileName, contentType, fileSize, sha256, status, actorUserId)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_upload', ?)`,
    [input.cashflowId, input.storageKey, input.originalFileName, input.contentType, input.fileSize, input.sha256, input.actorUserId],
  ) as any;
  const id = Number(result.insertId);
  return { id, receiptRef: makeCashflowReceiptObjectRef(id) };
}

export async function activateCashflowReceiptObject(
  connection: mysql.PoolConnection,
  attachmentId: number,
): Promise<void> {
  const [result] = await connection.query(
    `UPDATE cashflow_receipt_objects
        SET status = 'active', activatedAt = COALESCE(activatedAt, NOW()), lastError = NULL
      WHERE id = ? AND status IN ('pending_upload', 'cleanup_pending', 'cleanup_failed')`,
    [attachmentId],
  ) as any;
  if (Number(result.affectedRows || 0) !== 1) {
    throw new Error("[CF_RECEIPT_METADATA_ACTIVATE_FAILED] 付款凭证元数据激活失败");
  }
}

async function findReceiptReference(pool: mysql.Pool, receiptRef: string): Promise<number | null> {
  const [rows] = await pool.query(
    `SELECT id, receiptUrl
       FROM company_cashflows
      WHERE deletedAt IS NULL AND receiptUrl LIKE ?
      LIMIT 20`,
    [`%${receiptRef}%`],
  ) as any;
  const match = (rows as any[]).find((row) => parseCashflowReceiptUrls(row.receiptUrl).includes(receiptRef));
  return match ? Number(match.id) : null;
}

async function cleanupReceiptMetadataRow(pool: mysql.Pool, row: ReceiptMetadata): Promise<"active" | "cleaned" | "failed"> {
  const [claimResult] = await pool.query(
    `UPDATE cashflow_receipt_objects
        SET status = 'cleanup_claimed', cleanupAttempts = cleanupAttempts + 1, lastError = NULL
      WHERE id = ?
        AND (
          status IN ('pending_upload', 'cleanup_pending', 'cleanup_failed')
          OR (status = 'cleanup_claimed' AND updatedAt < DATE_SUB(NOW(), INTERVAL ${CLEANUP_CLAIM_STALE_MINUTES} MINUTE))
        )`,
    [row.id],
  ) as any;
  if (Number(claimResult.affectedRows || 0) !== 1) {
    const [statusRows] = await pool.query(
      `SELECT status FROM cashflow_receipt_objects WHERE id = ? LIMIT 1`,
      [row.id],
    ) as any;
    return statusRows[0]?.status === "active" || statusRows[0]?.status === "retained_deleted"
      ? "active"
      : "failed";
  }

  const receiptRef = makeCashflowReceiptObjectRef(Number(row.id));
  const referencedCashflowId = await findReceiptReference(pool, receiptRef);
  if (referencedCashflowId) {
    await pool.query(
      `UPDATE cashflow_receipt_objects
          SET status = 'active', cashflowId = ?, activatedAt = COALESCE(activatedAt, NOW()), lastError = NULL
        WHERE id = ? AND status = 'cleanup_claimed'`,
      [referencedCashflowId, row.id],
    );
    return "active";
  }

  try {
    await storageDelete(String(row.storageKey));
    const [result] = await pool.query(
      `UPDATE cashflow_receipt_objects
          SET status = 'cleaned', cleanedAt = NOW(), lastError = NULL
        WHERE id = ? AND status = 'cleanup_claimed'`,
      [row.id],
    ) as any;
    return Number(result.affectedRows || 0) === 1 ? "cleaned" : "failed";
  } catch (error) {
    await pool.query(
      `UPDATE cashflow_receipt_objects
          SET status = 'cleanup_failed', lastError = ?
        WHERE id = ? AND status = 'cleanup_claimed'`,
      [safeErrorMessage(error), row.id],
    );
    return "failed";
  }
}

export async function recoverFailedCashflowReceiptUpload(pool: mysql.Pool, input: {
  attachmentId: number;
  receiptRef: string;
  error: unknown;
}): Promise<{ referenced: boolean; cleaned: boolean }> {
  const referencedCashflowId = await findReceiptReference(pool, input.receiptRef);
  if (referencedCashflowId) {
    const [result] = await pool.query(
      `UPDATE cashflow_receipt_objects
          SET status = 'active', cashflowId = ?, activatedAt = COALESCE(activatedAt, NOW()), lastError = NULL
        WHERE id = ? AND status IN ('pending_upload', 'cleanup_pending', 'cleanup_failed', 'active')`,
      [referencedCashflowId, input.attachmentId],
    ) as any;
    if (Number(result.affectedRows || 0) === 1) return { referenced: true, cleaned: false };
    return { referenced: false, cleaned: false };
  }

  await pool.query(
    `UPDATE cashflow_receipt_objects
        SET status = 'cleanup_pending', lastError = ?
      WHERE id = ? AND status IN ('pending_upload', 'cleanup_pending', 'cleanup_failed')`,
    [safeErrorMessage(input.error), input.attachmentId],
  );
  const [rows] = await pool.query(
    `SELECT id, cashflowId, storageKey, originalFileName, contentType, fileSize, sha256, status
       FROM cashflow_receipt_objects WHERE id = ? LIMIT 1`,
    [input.attachmentId],
  ) as any;
  if (!rows[0]) return { referenced: false, cleaned: false };
  const outcome = await cleanupReceiptMetadataRow(pool, rows[0]);
  return { referenced: outcome === "active", cleaned: outcome === "cleaned" };
}

export async function retryPendingCashflowReceiptCleanup(pool: mysql.Pool, limit = 20): Promise<{
  checked: number;
  active: number;
  cleaned: number;
  failed: number;
}> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const [rows] = await pool.query(
    `SELECT id, cashflowId, storageKey, originalFileName, contentType, fileSize, sha256, status
       FROM cashflow_receipt_objects
      WHERE status IN ('cleanup_pending', 'cleanup_failed')
         OR (status = 'pending_upload' AND updatedAt < DATE_SUB(NOW(), INTERVAL ${CLEANUP_STALE_MINUTES} MINUTE))
         OR (status = 'cleanup_claimed' AND updatedAt < DATE_SUB(NOW(), INTERVAL ${CLEANUP_CLAIM_STALE_MINUTES} MINUTE))
      ORDER BY updatedAt ASC, id ASC
      LIMIT ${safeLimit}`,
  ) as any;
  const result = { checked: 0, active: 0, cleaned: 0, failed: 0 };
  for (const row of rows as ReceiptMetadata[]) {
    result.checked += 1;
    const outcome = await cleanupReceiptMetadataRow(pool, row);
    result[outcome] += 1;
  }
  return result;
}

function inferLegacyContentType(value: string): string {
  const pathname = (() => {
    try { return new URL(value).pathname; } catch { return value; }
  })().toLowerCase();
  if (pathname.endsWith(".pdf")) return "application/pdf";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function inferLegacyFileName(value: string, index: number): string {
  try {
    const name = decodeURIComponent(new URL(value).pathname.split("/").pop() || "");
    return name || `legacy-receipt-${index + 1}`;
  } catch {
    return value.split("/").pop() || `legacy-receipt-${index + 1}`;
  }
}

function storageKeyFromLegacyUrl(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "") || null;
  const candidates = [process.env.AWS_S3_PUBLIC_URL, process.env.AWS_S3_ENDPOINT]
    .filter((item): item is string => Boolean(item))
    .map((item) => item.replace(/\/+$/, ""));
  const directPrefix = candidates.find((prefix) => value.startsWith(`${prefix}/`));
  if (!directPrefix) return null;
  let key = value.slice(directPrefix.length + 1);
  if (directPrefix === process.env.AWS_S3_ENDPOINT?.replace(/\/+$/, "")) {
    const bucket = String(process.env.AWS_S3_BUCKET || "");
    if (bucket && key.startsWith(`${bucket}/`)) key = key.slice(bucket.length + 1);
  }
  try { return decodeURIComponent(key); } catch { return key; }
}

export async function resolveCashflowReceiptFiles(
  pool: mysql.Pool,
  cashflowId: number,
  receiptUrl: unknown,
): Promise<CashflowReceiptFile[]> {
  const refs = parseCashflowReceiptUrls(receiptUrl);
  const objectIds = refs.map(parseCashflowReceiptObjectId).filter((id): id is number => id !== null);
  const metadataById = new Map<number, ReceiptMetadata>();
  if (objectIds.length > 0) {
    const placeholders = objectIds.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT id, cashflowId, storageKey, originalFileName, contentType, fileSize, sha256, status
         FROM cashflow_receipt_objects
        WHERE cashflowId = ? AND status = 'active' AND id IN (${placeholders})`,
      [cashflowId, ...objectIds],
    ) as any;
    for (const row of rows as ReceiptMetadata[]) metadataById.set(Number(row.id), row);
  }

  const files: CashflowReceiptFile[] = [];
  for (let index = 0; index < refs.length; index += 1) {
    const ref = refs[index];
    const objectId = parseCashflowReceiptObjectId(ref);
    if (objectId) {
      const metadata = metadataById.get(objectId);
      if (!metadata) continue;
      const signed = await storageGet(String(metadata.storageKey));
      files.push({
        attachmentId: makeCashflowReceiptObjectRef(objectId),
        url: signed.url,
        contentType: String(metadata.contentType),
        fileName: String(metadata.originalFileName),
      });
      continue;
    }

    const storageKey = storageKeyFromLegacyUrl(ref);
    const resolvedUrl = storageKey ? (await storageGet(storageKey)).url : ref;
    files.push({
      attachmentId: cashflowReceiptAttachmentId(ref),
      url: resolvedUrl,
      contentType: inferLegacyContentType(ref),
      fileName: inferLegacyFileName(ref, index),
    });
  }
  return files;
}

export async function getCashflowReceiptMetadataForAudit(
  connection: mysql.PoolConnection,
  receiptRef: string,
): Promise<ReceiptMetadata | null> {
  const objectId = parseCashflowReceiptObjectId(receiptRef);
  if (!objectId) return null;
  const [rows] = await connection.query(
    `SELECT id, cashflowId, storageKey, originalFileName, contentType, fileSize, sha256, status
       FROM cashflow_receipt_objects WHERE id = ? LIMIT 1 FOR UPDATE`,
    [objectId],
  ) as any;
  return rows[0] || null;
}

export async function retainDeletedCashflowReceiptObject(
  connection: mysql.PoolConnection,
  receiptRef: string,
): Promise<void> {
  const objectId = parseCashflowReceiptObjectId(receiptRef);
  if (!objectId) return;
  await connection.query(
    `UPDATE cashflow_receipt_objects
        SET status = 'retained_deleted', deletedAt = NOW(), lastError = NULL
      WHERE id = ? AND status = 'active'`,
    [objectId],
  );
}
