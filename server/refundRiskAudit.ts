import { createHash, timingSafeEqual } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";

const KEY_SHA256 = "7f9f9d995370f2efb79a6556ca0f91feaeb2bad9fc6b4b31c138fa0db2bb09b2";

function verifyKey(value: string): void {
  const actual = Buffer.from(createHash("sha256").update(value.trim()).digest("hex"));
  const expected = Buffer.from(KEY_SHA256);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("unauthorized");
  }
}

async function queryRows(connection: mysql.Connection, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [rows] = await connection.query<RowDataPacket[]>(sql, params);
  return rows;
}

export async function getRefundRiskAuditSnapshot() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");

  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const [
      storeUploads,
      mallOrderStatus,
      mallMemberRisk,
      tiktokShopRefunds,
      tiktokProductRefunds,
      tiktokOverview,
    ] = await Promise.all([
      queryRows(connection, `
        SELECT id, storeId, dataType, year, month, fileName, recordCount, uploadedBy, uploadedAt,
          SHA2(COALESCE(dataJson, ''), 256) AS dataSha256,
          COALESCE(JSON_LENGTH(dataJson), 0) AS jsonRowCount,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(dataJson, '$[0].GMV.value')), '0') AS DECIMAL(20,2)) AS summaryGmv,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(dataJson, '$[0].返金.value')), '0') AS DECIMAL(20,2)) AS summaryRefund,
          CASE WHEN JSON_EXTRACT(dataJson, '$[0]._recoveryEvidence') IS NULL THEN 0 ELSE 1 END AS hasRecoveryEvidence
        FROM store_data_uploads
        ORDER BY year DESC, month DESC, storeId, dataType, uploadedAt DESC, id DESC
      `),
      queryRows(connection, `
        SELECT status, COUNT(*) AS orderCount,
          COALESCE(SUM(totalAmount), 0) AS totalAmount,
          COALESCE(SUM(pointsUsed), 0) AS pointsUsed,
          MIN(createdAt) AS firstOrderAt,
          MAX(createdAt) AS lastOrderAt
        FROM mall_orders
        GROUP BY status
        ORDER BY status
      `),
      queryRows(connection, `
        SELECT lineUserId,
          COUNT(*) AS totalOrders,
          SUM(status = 'cancelled') AS cancelledOrders,
          SUM(status = 'refunded') AS refundedOrders,
          COALESCE(SUM(totalAmount), 0) AS totalOrderedAmount,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN totalAmount ELSE 0 END), 0) AS cancelledOrderAmount,
          COALESCE(SUM(CASE WHEN status = 'refunded' THEN totalAmount ELSE 0 END), 0) AS refundedOrderAmount,
          ROUND(100 * SUM(status IN ('cancelled', 'refunded')) / COUNT(*), 2) AS adverseOrderRate,
          MAX(CASE WHEN status IN ('cancelled', 'refunded') THEN COALESCE(cancelledAt, updatedAt) END) AS latestAdverseAt
        FROM mall_orders
        GROUP BY lineUserId
        HAVING SUM(status IN ('cancelled', 'refunded')) > 0
        ORDER BY refundedOrderAmount DESC, cancelledOrderAmount DESC, adverseOrderRate DESC, totalOrders DESC
        LIMIT 500
      `),
      queryRows(connection, `
        SELECT COALESCE(NULLIF(TRIM(shopName), ''), '(unknown)') AS shopName,
          COUNT(DISTINCT orderId) AS affectedOrders,
          COALESCE(SUM(returnQuantity), 0) AS returnedQuantity,
          COALESCE(SUM(refundQuantity), 0) AS refundedQuantity,
          COALESCE(SUM(price * refundQuantity), 0) AS estimatedRefundAmount,
          MIN(orderCreatedAt) AS firstOrderAt,
          MAX(orderCreatedAt) AS lastOrderAt
        FROM tiktok_commission_orders
        WHERE COALESCE(returnQuantity, 0) > 0 OR COALESCE(refundQuantity, 0) > 0
        GROUP BY COALESCE(NULLIF(TRIM(shopName), ''), '(unknown)')
        ORDER BY estimatedRefundAmount DESC, refundedQuantity DESC
        LIMIT 500
      `),
      queryRows(connection, `
        SELECT COALESCE(NULLIF(TRIM(shopName), ''), '(unknown)') AS shopName,
          productId, LEFT(productName, 255) AS productName,
          COUNT(DISTINCT orderId) AS affectedOrders,
          COALESCE(SUM(returnQuantity), 0) AS returnedQuantity,
          COALESCE(SUM(refundQuantity), 0) AS refundedQuantity,
          COALESCE(SUM(price * refundQuantity), 0) AS estimatedRefundAmount
        FROM tiktok_commission_orders
        WHERE COALESCE(returnQuantity, 0) > 0 OR COALESCE(refundQuantity, 0) > 0
        GROUP BY COALESCE(NULLIF(TRIM(shopName), ''), '(unknown)'), productId, productName
        ORDER BY estimatedRefundAmount DESC, refundedQuantity DESC
        LIMIT 1000
      `),
      queryRows(connection, `
        SELECT COUNT(*) AS rowsTotal,
          COUNT(DISTINCT orderId) AS orderCount,
          COUNT(DISTINCT shopName) AS shopCount,
          COALESCE(SUM(returnQuantity), 0) AS returnedQuantity,
          COALESCE(SUM(refundQuantity), 0) AS refundedQuantity,
          COALESCE(SUM(price * refundQuantity), 0) AS estimatedRefundAmount,
          MIN(orderCreatedAt) AS firstOrderAt,
          MAX(orderCreatedAt) AS lastOrderAt
        FROM tiktok_commission_orders
      `),
    ]);

    const recoveredSummaryRefund = storeUploads.reduce((sum, row) => sum + Number(row.summaryRefund || 0), 0);
    const exactBreakdownRows = storeUploads.filter((row) => Number(row.recordCount || 0) > 1 && Number(row.summaryRefund || 0) > 0).length;

    return {
      capturedAt: new Date().toISOString(),
      database: { connected: true },
      storeUploads,
      recoveredSummary: {
        refundTotal: recoveredSummaryRefund,
        rowsWithRefundBreakdown: exactBreakdownRows,
        evidenceOnlyRows: storeUploads.filter((row) => Number(row.hasRecoveryEvidence || 0) === 1).length,
      },
      mallOrderStatus,
      mallMemberRisk,
      tiktokCommission: {
        overview: tiktokOverview[0] || {},
        shopRefunds: tiktokShopRefunds,
        productRefunds: tiktokProductRefunds,
        buyerIdentityAvailable: false,
        estimatedAmountMethod: "price * refundQuantity",
      },
      containsPersonalData: false,
    };
  } finally {
    await connection.end();
  }
}

export const refundRiskAuditRouter = router({
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .query(async ({ input }) => {
      verifyKey(input.key);
      return getRefundRiskAuditSnapshot();
    }),
});
