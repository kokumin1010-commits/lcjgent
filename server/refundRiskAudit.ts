import { createHash, timingSafeEqual } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const KEY_SHA256 = "7f9f9d995370f2efb79a6556ca0f91feaeb2bad9fc6b4b31c138fa0db2bb09b2";

function verifyKey(value: string): void {
  const actual = Buffer.from(createHash("sha256").update(value.trim()).digest("hex"));
  const expected = Buffer.from(KEY_SHA256);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("unauthorized");
}

async function queryRows(connection: mysql.Connection, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [rows] = await connection.query<RowDataPacket[]>(sql, params);
  return rows;
}

function numeric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value && typeof value === "object" && "value" in value) return numeric((value as { value?: unknown }).value);
  const parsed = Number(String(value ?? "").replace(/[¥￥,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function refundKey(row: Record<string, unknown>): string | null {
  const preferred = ["返金", "退款金額", "退款金额", "退款", "返品金額", "キャンセル金額", "Refund", "refund"];
  for (const key of preferred) if (Object.prototype.hasOwnProperty.call(row, key)) return key;
  return Object.keys(row).find((key) => {
    const lowered = key.toLowerCase();
    const looksLikeRefund = key.includes("返金") || key.includes("退款") || key.includes("キャンセル金額") || lowered.includes("refund");
    const looksLikeRateOrCount = key.includes("率") || key.includes("件数") || key.includes("数量") || lowered.includes("rate") || lowered.includes("count");
    return looksLikeRefund && !looksLikeRateOrCount;
  }) || null;
}

function dateValue(row: Record<string, unknown>): string | null {
  for (const key of ["日期", "日付", "Date", "date"]) {
    const value = String(row[key] ?? "").trim();
    if (value) return value.slice(0, 32);
  }
  return null;
}

export async function getRefundRiskAuditSnapshot() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const [storeUploadsRaw, mallOrderStatus, mallMemberRisk, commissionShopRefunds, commissionProductRefunds, commissionOverview, capShopRefunds, capProductRefunds, capOverview] = await Promise.all([
      queryRows(connection, `
        SELECT id, storeId, dataType, year, month, fileName, recordCount, uploadedBy, uploadedAt, dataJson,
          SHA2(COALESCE(dataJson, ''), 256) AS dataSha256,
          COALESCE(JSON_LENGTH(dataJson), 0) AS jsonRowCount,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(dataJson, '$[0].GMV.value')), '0') AS DECIMAL(20,2)) AS summaryGmv,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(dataJson, '$[0].返金.value')), '0') AS DECIMAL(20,2)) AS summaryRefund,
          CASE WHEN JSON_EXTRACT(dataJson, '$[0]._recoveryEvidence') IS NULL THEN 0 ELSE 1 END AS hasRecoveryEvidence
        FROM store_data_uploads ORDER BY year DESC, month DESC, storeId, dataType, uploadedAt DESC, id DESC
      `),
      queryRows(connection, `SELECT status, COUNT(*) AS orderCount, COALESCE(SUM(totalAmount),0) AS totalAmount, COALESCE(SUM(pointsUsed),0) AS pointsUsed, MIN(createdAt) AS firstOrderAt, MAX(createdAt) AS lastOrderAt FROM mall_orders GROUP BY status ORDER BY status`),
      queryRows(connection, `
        SELECT lineUserId, COUNT(*) AS totalOrders, SUM(status='cancelled') AS cancelledOrders, SUM(status='refunded') AS refundedOrders,
          COALESCE(SUM(totalAmount),0) AS totalOrderedAmount,
          COALESCE(SUM(CASE WHEN status='cancelled' THEN totalAmount ELSE 0 END),0) AS cancelledOrderAmount,
          COALESCE(SUM(CASE WHEN status='refunded' THEN totalAmount ELSE 0 END),0) AS refundedOrderAmount,
          ROUND(100*SUM(status IN ('cancelled','refunded'))/COUNT(*),2) AS adverseOrderRate,
          MAX(CASE WHEN status IN ('cancelled','refunded') THEN COALESCE(cancelledAt,updatedAt) END) AS latestAdverseAt
        FROM mall_orders GROUP BY lineUserId HAVING SUM(status IN ('cancelled','refunded'))>0
        ORDER BY refundedOrderAmount DESC,cancelledOrderAmount DESC,adverseOrderRate DESC,totalOrders DESC LIMIT 500
      `),
      queryRows(connection, `
        SELECT COALESCE(NULLIF(TRIM(shopName),''),'(unknown)') AS shopName, COUNT(DISTINCT orderId) AS affectedOrders,
          COALESCE(SUM(returnQuantity),0) AS returnedQuantity, COALESCE(SUM(refundQuantity),0) AS refundedQuantity,
          COALESCE(SUM(price*refundQuantity),0) AS estimatedRefundAmount, MIN(orderCreatedAt) AS firstOrderAt, MAX(orderCreatedAt) AS lastOrderAt
        FROM tiktok_commission_orders WHERE COALESCE(returnQuantity,0)>0 OR COALESCE(refundQuantity,0)>0
        GROUP BY COALESCE(NULLIF(TRIM(shopName),''),'(unknown)') ORDER BY estimatedRefundAmount DESC,refundedQuantity DESC LIMIT 500
      `),
      queryRows(connection, `
        SELECT COALESCE(NULLIF(TRIM(shopName),''),'(unknown)') AS shopName, productId, LEFT(productName,255) AS productName,
          COUNT(DISTINCT orderId) AS affectedOrders, COALESCE(SUM(returnQuantity),0) AS returnedQuantity,
          COALESCE(SUM(refundQuantity),0) AS refundedQuantity, COALESCE(SUM(price*refundQuantity),0) AS estimatedRefundAmount
        FROM tiktok_commission_orders WHERE COALESCE(returnQuantity,0)>0 OR COALESCE(refundQuantity,0)>0
        GROUP BY COALESCE(NULLIF(TRIM(shopName),''),'(unknown)'),productId,productName ORDER BY estimatedRefundAmount DESC,refundedQuantity DESC LIMIT 1000
      `),
      queryRows(connection, `SELECT COUNT(*) AS rowsTotal,COUNT(DISTINCT orderId) AS orderCount,COUNT(DISTINCT shopName) AS shopCount,COALESCE(SUM(returnQuantity),0) AS returnedQuantity,COALESCE(SUM(refundQuantity),0) AS refundedQuantity,COALESCE(SUM(price*refundQuantity),0) AS estimatedRefundAmount,MIN(orderCreatedAt) AS firstOrderAt,MAX(orderCreatedAt) AS lastOrderAt FROM tiktok_commission_orders`),
      queryRows(connection, `
        SELECT COALESCE(NULLIF(TRIM(shopName),''),'(unknown)') AS shopName, reportMonth, COUNT(*) AS productCreatorRows,
          COALESCE(SUM(directRefundGmv),0) AS directRefundGmv, COALESCE(SUM(refundedItems),0) AS refundedItems
        FROM tiktok_cap_product_reports WHERE COALESCE(directRefundGmv,0)>0 OR COALESCE(refundedItems,0)>0
        GROUP BY COALESCE(NULLIF(TRIM(shopName),''),'(unknown)'),reportMonth ORDER BY directRefundGmv DESC,refundedItems DESC LIMIT 500
      `),
      queryRows(connection, `
        SELECT COALESCE(NULLIF(TRIM(shopName),''),'(unknown)') AS shopName,reportMonth,productId,LEFT(productName,255) AS productName,
          COUNT(*) AS creatorRows,COALESCE(SUM(directRefundGmv),0) AS directRefundGmv,COALESCE(SUM(refundedItems),0) AS refundedItems
        FROM tiktok_cap_product_reports WHERE COALESCE(directRefundGmv,0)>0 OR COALESCE(refundedItems,0)>0
        GROUP BY COALESCE(NULLIF(TRIM(shopName),''),'(unknown)'),reportMonth,productId,productName ORDER BY directRefundGmv DESC,refundedItems DESC LIMIT 2000
      `),
      queryRows(connection, `SELECT COUNT(*) AS rowsTotal,COUNT(DISTINCT shopName) AS shopCount,COUNT(DISTINCT productId) AS productCount,COALESCE(SUM(directRefundGmv),0) AS directRefundGmv,COALESCE(SUM(refundedItems),0) AS refundedItems,MIN(reportMonth) AS firstMonth,MAX(reportMonth) AS lastMonth FROM tiktok_cap_product_reports`),
    ]);

    const storeRefundTimeline: Array<Record<string, unknown>> = [];
    const storeUploads = storeUploadsRaw.map((raw) => {
      let dailyRefundRows = 0;
      let dailyRefundTotal = 0;
      try {
        const parsed = JSON.parse(String(raw.dataJson || "[]"));
        if (Array.isArray(parsed)) {
          for (const candidate of parsed) {
            if (!candidate || typeof candidate !== "object" || candidate._type === "summary") continue;
            const key = refundKey(candidate as Record<string, unknown>);
            if (!key) continue;
            const amount = numeric((candidate as Record<string, unknown>)[key]);
            if (amount === 0) continue;
            dailyRefundRows += 1;
            dailyRefundTotal += amount;
            storeRefundTimeline.push({ uploadId:Number(raw.id),storeId:Number(raw.storeId),year:Number(raw.year),month:Number(raw.month),date:dateValue(candidate as Record<string,unknown>),refund:amount,sourceField:key });
          }
        }
      } catch {
        // Malformed legacy JSON remains visible in metadata but is excluded from exact detail totals.
      }
      const { dataJson: _dataJson, ...safe } = raw;
      return { ...safe, dailyRefundRows, dailyRefundTotal, summaryMatchesDaily: dailyRefundRows>0 ? Math.abs(Number(raw.summaryRefund||0)-dailyRefundTotal)<1 : null };
    });

    const evidenceUploads = storeUploads.filter((row) => Number(row.hasRecoveryEvidence||0)===1);
    const exactUploads = storeUploads.filter((row) => Number(row.dailyRefundRows||0)>0);

    return {
      capturedAt:new Date().toISOString(), database:{connected:true}, storeUploads, storeRefundTimeline,
      recoveredSummary:{
        allUploadRefundTotal:storeUploads.reduce((sum,row)=>sum+Number(row.summaryRefund||0),0),
        screenshotEvidenceRefundTotal:evidenceUploads.reduce((sum,row)=>sum+Number(row.summaryRefund||0),0),
        evidenceOnlyRows:evidenceUploads.length,
        exactDailyUploadCount:exactUploads.length,
        exactDailyRefundTotal:exactUploads.reduce((sum,row)=>sum+Number(row.dailyRefundTotal||0),0),
      },
      mallOrderStatus,mallMemberRisk,
      tiktokCommission:{overview:commissionOverview[0]||{},shopRefunds:commissionShopRefunds,productRefunds:commissionProductRefunds,buyerIdentityAvailable:false,estimatedAmountMethod:"price * refundQuantity"},
      tiktokCap:{overview:capOverview[0]||{},shopRefunds:capShopRefunds,productRefunds:capProductRefunds,buyerIdentityAvailable:false,amountMethod:"directRefundGmv from CAP product report"},
      containsPersonalData:false,
    };
  } finally { await connection.end(); }
}

async function runVerifiedBackup(reason: 'pre-refund-risk-v1' | 'pre-member-risk-v1') {
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const rows = await queryRows(connection, `
      SELECT id, runId, reason, status, completedAt, tableCount, rowCount, encryptedBytes, checksum
      FROM db_backup_runs
      WHERE reason = ?
      ORDER BY id DESC LIMIT 1
    `, [reason]);
    const latest = rows[0];
    if (!latest || String(latest.status) !== "success") throw new Error(`${reason} backup was not recorded as success`);
    return latest;
  } finally {
    await connection.end();
  }
}

async function runPreImplementationBackup() {
  await runDatabaseBackup("pre-refund-risk-v1", { force: true, waitForActive: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const rows = await queryRows(connection, `
      SELECT id, runId, reason, status, completedAt, tableCount, rowCount, encryptedBytes, checksum
      FROM db_backup_runs
      WHERE reason = 'pre-refund-risk-v1'
      ORDER BY id DESC LIMIT 1
    `);
    const latest = rows[0];
    if (!latest || String(latest.status) !== "success") throw new Error("pre-implementation backup was not recorded as success");
    return latest;
  } finally {
    await connection.end();
  }
}

export const refundRiskAuditRouter = router({
  snapshot: publicProcedure.input(z.object({ key: z.string().min(1) })).query(async ({ input }) => {
    verifyKey(input.key);
    return getRefundRiskAuditSnapshot();
  }),
  preImplementationBackup: publicProcedure.input(z.object({ key: z.string().min(1) })).mutation(async ({ input }) => {
    verifyKey(input.key);
    return runPreImplementationBackup();
  }),
  preMemberRiskBackup: publicProcedure.input(z.object({ key: z.string().min(1) })).mutation(async ({ input }) => {
    verifyKey(input.key);
    return runVerifiedBackup('pre-member-risk-v1');
  }),
});
