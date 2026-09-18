import { createHash, timingSafeEqual } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { ensureStoreBusinessUpgradeReady } from "./storeBusinessUpgrade";
import { inspectStoreAdReportPdf } from "./storeAdReportPdf";
import { storagePut } from "./storage";

const AUTH_TOKEN_SHA256 = "a30ef1873ba13eabc0d59213c1900e3715ac0a0091e85ed0b923d23f344e104e";
const EXPECTED_FILE_SHA256 = "16b798850a6e402d577e15d26a90cdff3b1e6b2462d91d0bb10345c2349c6b58";
const EXPECTED_FILE_SIZE = 571_489;
const TARGET_STORE_NAME = "buzzdrop";

let pool: Pool | null = null;
function getPool(): Pool {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  pool = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 2 });
  return pool;
}

export function authorizeOneTimeMiavieImport(token: unknown): boolean {
  const actualHex = createHash("sha256").update(String(token || "")).digest("hex");
  return timingSafeEqual(Buffer.from(actualHex, "hex"), Buffer.from(AUTH_TOKEN_SHA256, "hex"));
}

export async function importOneTimeMiavieAdReport(input: unknown) {
  await ensureStoreBusinessUpgradeReady();
  const payload = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fileBase64 = payload.fileBase64;
  if (typeof fileBase64 !== "string" || !fileBase64.length || fileBase64.length > 30_000_000) {
    throw new Error("PDF payload is missing or too large");
  }
  const brandName = String(payload.brandName || "").trim();
  const title = String(payload.title || "").trim();
  const periodStart = String(payload.periodStart || "");
  const periodEnd = String(payload.periodEnd || "");
  const totalGmv = Number(payload.totalGmv);
  const adSpend = Number(payload.adSpend);
  const orderCount = Number(payload.orderCount);
  if (!brandName || brandName.length > 255 || !title || title.length > 255) throw new Error("Report identity is invalid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
    throw new Error("Report period is invalid");
  }
  if (![totalGmv, adSpend, orderCount].every(Number.isFinite) || totalGmv < 0 || adSpend < 0 || !Number.isInteger(orderCount) || orderCount < 0) {
    throw new Error("Report metrics are invalid");
  }
  const buffer = Buffer.from(fileBase64, "base64");
  const inspected = await inspectStoreAdReportPdf({
    buffer,
    fileName: "【MIAVIE】商品GMVMAX広告データレポート_【07.23〜08.31】.pdf",
    declaredMimeType: "application/pdf",
  });
  if (inspected.sha256 !== EXPECTED_FILE_SHA256 || inspected.fileSize !== EXPECTED_FILE_SIZE) {
    throw new Error("PDF evidence does not match the authorized file");
  }

  const db = getPool();
  const [storeRows] = await db.query<RowDataPacket[]>(
    "SELECT id,name FROM managed_stores WHERE isActive=1 AND LOWER(TRIM(name))=? ORDER BY id",
    [TARGET_STORE_NAME]
  );
  if (storeRows.length !== 1) throw new Error("Target store must resolve to exactly one active record");
  const storeId = Number(storeRows[0].id);

  const [existingRows] = await db.query<RowDataPacket[]>(
    `SELECT id,storeId,brandName,title,periodStart,periodEnd,pageCount
       FROM store_ad_reports
      WHERE fileSha256=? AND deletedAt IS NULL
      LIMIT 2`,
    [EXPECTED_FILE_SHA256]
  );
  if (existingRows.length) {
    const existing = existingRows[0];
    if (Number(existing.storeId) !== storeId) throw new Error("Authorized PDF already belongs to another store");
    return {
      success: true,
      duplicate: true,
      id: Number(existing.id),
      storeId,
      storeName: String(storeRows[0].name),
      brandName: String(existing.brandName),
      title: String(existing.title),
      pageCount: Number(existing.pageCount),
    };
  }

  const storageKey = `private/store-ad-reports/${storeId}/${Date.now()}-${EXPECTED_FILE_SHA256.slice(0, 16)}-miavie-gmv-max-2026-07-23-2026-08-31.pdf`;
  await storagePut(storageKey, buffer, inspected.mimeType);
  const [result] = await db.query(
    `INSERT INTO store_ad_reports
      (storeId,brandName,title,reportType,periodStart,periodEnd,totalGmv,adSpend,orderCount,roas,
       fileName,fileSha256,fileSize,mimeType,pageCount,storageKey,createdById,createdByName)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      storeId,
      brandName,
      title,
      "product_gmv_max",
      periodStart,
      periodEnd,
      totalGmv,
      adSpend,
      orderCount,
      totalGmv / adSpend,
      inspected.fileName,
      inspected.sha256,
      inspected.fileSize,
      inspected.mimeType,
      inspected.pageCount,
      storageKey,
      null,
      "用户授权的一次性导入",
    ]
  );
  return {
    success: true,
    duplicate: false,
    id: Number((result as any).insertId),
    storeId,
    storeName: String(storeRows[0].name),
    brandName,
    periodStart,
    periodEnd,
    totalGmv,
    adSpend,
    orderCount,
    roas: Number((totalGmv / adSpend).toFixed(4)),
    pageCount: inspected.pageCount,
    fileSha256: inspected.sha256,
  };
}
