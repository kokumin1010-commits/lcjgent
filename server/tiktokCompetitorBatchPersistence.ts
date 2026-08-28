import { TRPCError } from '@trpc/server';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { calculateDiscountRate, type ImportParseResult } from './tiktokCompetitorDaily.js';

export type CompetitorBatchActor = {
  id: number | null;
  name: string;
};

export type CompetitorBatchOperator = {
  id: number;
  name: string;
};

export type CommitCompetitorBatchInput = {
  date: string;
  source: 'kalodata_export' | 'manual';
  fileName: string | null;
  fileUrl: string | null;
  fileKey: string | null;
  fileSha256: string;
  fileSize: number;
  rowCount: number;
  parsed: ImportParseResult;
  actor: CompetitorBatchActor;
  operators: CompetitorBatchOperator[];
};

type PoolLike = Pick<Pool, 'query' | 'getConnection'>;

function safeJson(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

async function existingSuccessfulBatch(pool: Pick<Pool, 'query'> | PoolConnection, input: Pick<CommitCompetitorBatchInput, 'date' | 'fileSha256'>) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,sourceFileName,sourceFileUrl,sourceFileKey,sourceFileSize,importedAt
       FROM tiktok_competitor_ranking_snapshots
      WHERE snapshotDate=? AND market='JP' AND sourceFileSha256=? AND status='success'
      ORDER BY id DESC LIMIT 1`,
    [input.date, input.fileSha256],
  );
  return rows[0] || null;
}

async function insertAudit(connection: PoolConnection, input: {
  snapshotId: number;
  reportIds: number[];
  preservedReportIds: number[];
  batch: CommitCompetitorBatchInput;
}) {
  await connection.query(
    `INSERT INTO tiktok_competitor_audit_logs
      (entityType,entityId,action,afterJson,actorId,actorName)
     VALUES ('snapshot',?,'ranking_batch_imported',?,?,?)`,
    [
      input.snapshotId,
      safeJson({
        date: input.batch.date,
        fileName: input.batch.fileName,
        fileSha256: input.batch.fileSha256,
        shops: input.batch.parsed.shops.length,
        top5: input.batch.parsed.top5.map((shop) => shop.shopName),
        reportIds: input.reportIds,
        preservedReportIds: input.preservedReportIds,
      }),
      input.batch.actor.id,
      input.batch.actor.name,
    ],
  );
}

async function createMissingReport(connection: PoolConnection, input: {
  batch: CommitCompetitorBatchInput;
  snapshotId: number;
  operator: CompetitorBatchOperator;
  shopRankingIds: Map<number, number>;
}) {
  const [existingRows] = await connection.query<RowDataPacket[]>(
    `SELECT id,status,rankingSnapshotId FROM tiktok_competitor_reports
      WHERE reportDate=? AND market='JP' AND assignedStaffId=? LIMIT 1 FOR UPDATE`,
    [input.batch.date, input.operator.id],
  );
  if (existingRows[0]) {
    return { reportId: Number(existingRows[0].id), created: false };
  }

  const [reportResult] = await connection.query(
    `INSERT INTO tiktok_competitor_reports
      (reportDate,market,rankingSnapshotId,assignedStaffId,assignedStaffName,status,createdById,createdByName)
     VALUES (?,'JP',?,?,?,'draft',?,?)`,
    [input.batch.date, input.snapshotId, input.operator.id, input.operator.name, input.batch.actor.id, input.batch.actor.name],
  );
  const reportId = Number((reportResult as any).insertId);
  if (!reportId) throw new Error('竞品日报创建失败：未返回日报ID');

  for (const shop of input.batch.parsed.top5) {
    const [reportShopResult] = await connection.query(
      `INSERT INTO tiktok_competitor_report_shops
        (reportId,shopRankingId,externalShopId,shopName,shopUrl,rankingPosition,unitsSold,gmv,isPrimary)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [reportId, input.shopRankingIds.get(shop.rankingPosition) || null, shop.externalShopId, shop.shopName, shop.shopUrl, shop.rankingPosition, shop.unitsSold, shop.gmv],
    );
    const reportShopId = Number((reportShopResult as any).insertId);
    if (!reportShopId) throw new Error('竞品日报店铺创建失败：未返回店铺ID');
    for (let index = 0; index < 3; index += 1) {
      const product = shop.products[index] || null;
      await connection.query(
        `INSERT INTO tiktok_competitor_report_products
          (reportId,reportShopId,productRank,externalProductId,productName,productUrl,originalPrice,livePrice,discountRate,unitsSold,gmv,clickRate,conversionRate,heatEvidence,screenshotUrlsJson,screenshotKeysJson,sourceJson)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,JSON_ARRAY(),JSON_ARRAY(),?)`,
        [
          reportId,
          reportShopId,
          index + 1,
          product?.externalProductId || null,
          product?.productName || null,
          product?.productUrl || null,
          product?.originalPrice ?? null,
          product?.livePrice ?? null,
          calculateDiscountRate(product?.originalPrice ?? null, product?.livePrice ?? null),
          product?.unitsSold ?? null,
          product?.gmv ?? null,
          product?.clickRate ?? null,
          product?.conversionRate ?? null,
          product?.heatEvidence || null,
          safeJson(product?.raw || null),
        ],
      );
    }
  }
  await connection.query(
    `INSERT INTO tiktok_competitor_audit_logs
      (entityType,entityId,reportId,action,afterJson,actorId,actorName)
     VALUES ('report',?,?,'report_generated_from_ranking',?,?,?)`,
    [
      reportId,
      reportId,
      safeJson({ snapshotId: input.snapshotId, shopCount: input.batch.parsed.top5.length, productSlots: 15 }),
      input.batch.actor.id,
      input.batch.actor.name,
    ],
  );
  return { reportId, created: true };
}

export async function findDuplicateCompetitorBatch(pool: Pick<Pool, 'query'>, date: string, fileSha256: string) {
  const row = await existingSuccessfulBatch(pool, { date, fileSha256 });
  return row ? {
    snapshotId: Number(row.id),
    sourceFileName: row.sourceFileName ? String(row.sourceFileName) : null,
    sourceFileUrl: row.sourceFileUrl ? String(row.sourceFileUrl) : null,
    sourceFileKey: row.sourceFileKey ? String(row.sourceFileKey) : null,
    sourceFileSize: row.sourceFileSize === null ? null : Number(row.sourceFileSize),
    importedAt: row.importedAt,
  } : null;
}

export async function commitCompetitorRankingBatch(pool: PoolLike, input: CommitCompetitorBatchInput) {
  const duplicate = await findDuplicateCompetitorBatch(pool, input.date, input.fileSha256);
  if (duplicate) return { duplicate: true as const, ...duplicate };

  const [syncResult] = await pool.query(
    `INSERT INTO tiktok_competitor_sync_logs
      (snapshotDate,market,source,status,queryJson,sourceFileName,sourceFileSha256,sourceFileSize,rowCount,shopCount,productCount,actorId,actorName)
     VALUES (?,'JP',?,'running',?,?,?,?,?,?,?,?,?)`,
    [
      input.date,
      input.source,
      safeJson({ market: 'JP', strategy: 'top5-shops-top3-products', mode: 'append-batch' }),
      input.fileName,
      input.fileSha256,
      input.fileSize,
      input.rowCount,
      input.parsed.shops.length,
      input.parsed.top5.reduce((sum, shop) => sum + shop.products.length, 0),
      input.actor.id,
      input.actor.name,
    ],
  );
  const syncLogId = Number((syncResult as any).insertId);
  let connection: PoolConnection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const existing = await existingSuccessfulBatch(connection, input);
    if (existing) {
      await connection.rollback();
      await pool.query(
        `UPDATE tiktok_competitor_sync_logs
            SET status='skipped',completedAt=CURRENT_TIMESTAMP,errorCode='DUPLICATE_FILE',errorMessage=?,snapshotId=?
          WHERE id=?`,
        [`同一天已导入相同文件：${String(existing.sourceFileName || `#${existing.id}`).slice(0, 255)}`, Number(existing.id), syncLogId],
      );
      return { duplicate: true as const, snapshotId: Number(existing.id), sourceFileName: existing.sourceFileName ? String(existing.sourceFileName) : null };
    }

    const [oldRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM tiktok_competitor_ranking_snapshots
        WHERE snapshotDate=? AND market='JP' AND isCurrent=1 ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [input.date],
    );
    const oldId = oldRows[0] ? Number(oldRows[0].id) : null;
    const [snapshotResult] = await connection.query(
      `INSERT INTO tiktok_competitor_ranking_snapshots
        (snapshotDate,market,source,sourceFileName,sourceFileUrl,sourceFileKey,sourceFileSha256,sourceFileSize,queryJson,status,rowCount,shopCount,productCount,isCurrent,supersedesId,importedById,importedByName)
       VALUES (?,'JP',?,?,?,?,?,?,?,'success',?,?,?,1,?,?,?)`,
      [
        input.date,
        input.source,
        input.fileName,
        input.fileUrl,
        input.fileKey,
        input.fileSha256,
        input.fileSize,
        safeJson({ market: 'JP', strategy: 'top5-shops-top3-products', mode: 'append-batch' }),
        input.rowCount,
        input.parsed.shops.length,
        input.parsed.top5.reduce((sum, shop) => sum + shop.products.length, 0),
        oldId,
        input.actor.id,
        input.actor.name,
      ],
    );
    const snapshotId = Number((snapshotResult as any).insertId);
    if (!snapshotId) throw new Error('排名批次创建失败：未返回快照ID');

    const shopRankingIds = new Map<number, number>();
    for (const shop of input.parsed.shops) {
      const [shopResult] = await connection.query(
        `INSERT INTO tiktok_competitor_shop_rankings
          (snapshotId,externalShopId,shopName,shopUrl,rankingPosition,unitsSold,gmv,revenueGrowthRate,currency,isPrimaryTop5,rawJson)
         VALUES (?,?,?,?,?,?,?,?, 'JPY',?,?)`,
        [snapshotId, shop.externalShopId, shop.shopName, shop.shopUrl, shop.rankingPosition, shop.unitsSold, shop.gmv, shop.revenueGrowthRate, shop.rankingPosition <= 5 ? 1 : 0, safeJson(shop.raw)],
      );
      const shopRankingId = Number((shopResult as any).insertId);
      if (!shopRankingId) throw new Error('排名批次店铺创建失败：未返回店铺ID');
      shopRankingIds.set(shop.rankingPosition, shopRankingId);
      for (const [index, product] of shop.products.entries()) {
        await connection.query(
          `INSERT INTO tiktok_competitor_snapshot_products
            (snapshotId,shopRankingId,productRank,externalProductId,productName,productUrl,originalPrice,livePrice,discountRate,unitsSold,gmv,clickRate,conversionRate,heatEvidence,rawJson)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            snapshotId,
            shopRankingId,
            index + 1,
            product.externalProductId,
            product.productName,
            product.productUrl,
            product.originalPrice,
            product.livePrice,
            calculateDiscountRate(product.originalPrice, product.livePrice),
            product.unitsSold,
            product.gmv,
            product.clickRate,
            product.conversionRate,
            product.heatEvidence,
            safeJson(product.raw),
          ],
        );
      }
    }

    const reportIds: number[] = [];
    const createdReportIds: number[] = [];
    const preservedReportIds: number[] = [];
    for (const operator of input.operators) {
      const report = await createMissingReport(connection, { batch: input, snapshotId, operator, shopRankingIds });
      reportIds.push(report.reportId);
      if (report.created) createdReportIds.push(report.reportId);
      else preservedReportIds.push(report.reportId);
    }

    if (oldId) {
      const [updateResult] = await connection.query(
        `UPDATE tiktok_competitor_ranking_snapshots SET isCurrent=0
          WHERE id=? AND snapshotDate=? AND market='JP' AND isCurrent=1`,
        [oldId, input.date],
      );
      if (Number((updateResult as any).affectedRows) !== 1) {
        throw new Error('旧排名批次状态发生并发变化，请刷新后重试');
      }
    }
    const [syncUpdateResult] = await connection.query(
      `UPDATE tiktok_competitor_sync_logs
          SET status='success',completedAt=CURRENT_TIMESTAMP,rowCount=?,shopCount=?,productCount=?,snapshotId=?
        WHERE id=? AND status='running'`,
      [input.rowCount, input.parsed.shops.length, input.parsed.top5.reduce((sum, shop) => sum + shop.products.length, 0), snapshotId, syncLogId],
    );
    if (Number((syncUpdateResult as any).affectedRows) !== 1) {
      throw new Error('同步日志状态更新失败');
    }
    await insertAudit(connection, { snapshotId, reportIds, preservedReportIds, batch: input });
    await connection.commit();
    return {
      duplicate: false as const,
      snapshotId,
      reportIds,
      createdReportIds,
      preservedReportIds,
      morningOperatorCount: input.operators.length,
      top5: input.parsed.top5.map((shop) => shop.shopName),
      warnings: input.parsed.warnings,
    };
  } catch (error) {
    if (connection) await connection.rollback();
    if ((error as any)?.code === 'ER_DUP_ENTRY') {
      const existing = await findDuplicateCompetitorBatch(pool, input.date, input.fileSha256);
      await pool.query(
        `UPDATE tiktok_competitor_sync_logs
            SET status='skipped',completedAt=CURRENT_TIMESTAMP,errorCode='DUPLICATE_FILE',errorMessage=?,snapshotId=?
          WHERE id=?`,
        ['同一天已导入相同文件', existing?.snapshotId || null, syncLogId],
      ).catch(() => undefined);
      if (existing) return { duplicate: true as const, ...existing };
    }
    await pool.query(
      `UPDATE tiktok_competitor_sync_logs
          SET status='failed',completedAt=CURRENT_TIMESTAMP,errorCode='IMPORT_FAILED',errorMessage=?
        WHERE id=?`,
      [String(error instanceof Error ? error.message : error).slice(0, 4000), syncLogId],
    ).catch(() => undefined);
    throw error instanceof TRPCError ? error : new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '排名批次保存失败，已回滚，旧文件和日报均未覆盖', cause: error });
  } finally {
    connection?.release();
  }
}
