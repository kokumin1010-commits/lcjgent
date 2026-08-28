import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import {
  buildLiverAdEffectDashboard,
  type LinkedAdInvestmentInput,
  type LiverAdEffectDashboard,
} from "../shared/liverAdEffect";

let poolInstance: Pool | null = null;

export class LiverAdEffectPersistenceError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "LiverAdEffectPersistenceError";
  }
}

interface LivestreamRow extends RowDataPacket {
  id: number;
  livestreamDate: Date | string;
  brandName: string | null;
  adCost: number | string | null;
  salesAmount: number | string | null;
  manualSalesAmount: number | string | null;
  gmv: number | string | null;
  orderCount: number | null;
  itemsSold: number | null;
  viewerCount: number | null;
  duration: number | null;
}

interface ProductQuantityRow extends RowDataPacket {
  livestreamId: number;
  productItemsSold: number | string;
  evidenceCount: number | string;
}

interface LinkedAdRow extends RowDataPacket {
  livestreamId: number;
  adType: "live" | "clip" | "mixed";
  totalBudget: number | string;
  liveBudget: number | string | null;
}

interface LockedLivestreamRow extends RowDataPacket {
  id: number;
  liverId: number | null;
  deletedAt: Date | string | null;
}

export interface LiverAdEffectPool {
  query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(sql: string, values?: unknown[]): Promise<[T, unknown]>;
  getConnection(): Promise<PoolConnection>;
}

function getPool(): Pool {
  if (!poolInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
    poolInstance = mysql.createPool({
      uri: databaseUrl,
      connectionLimit: 3,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return poolInstance;
}

function getJstMonthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - jstOffsetMs),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0) - jstOffsetMs),
  };
}

function placeholders(ids: number[]): string {
  return ids.map(() => "?").join(", ");
}

export async function getLiverAdEffectDashboard(
  liverId: number,
  yearMonth: string,
  injectedPool?: LiverAdEffectPool,
): Promise<LiverAdEffectDashboard> {
  const activePool = injectedPool || getPool();
  const { start, end } = getJstMonthRange(yearMonth);

  const [livestreamRows] = await activePool.query<LivestreamRow[]>(
    `SELECT
       bl.id,
       bl.livestreamDate,
       b.name AS brandName,
       bl.adCost,
       bl.salesAmount,
       bl.manualSalesAmount,
       bl.gmv,
       bl.orderCount,
       bl.itemsSold,
       bl.viewerCount,
       bl.duration
     FROM brand_livestreams bl
     LEFT JOIN brands b ON b.id = bl.brandId
     WHERE bl.liverId = ?
       AND bl.deletedAt IS NULL
       AND bl.livestreamDate >= ?
       AND bl.livestreamDate < ?
     ORDER BY bl.livestreamDate DESC, bl.id DESC`,
    [liverId, start, end],
  );

  if (livestreamRows.length === 0) {
    return buildLiverAdEffectDashboard([]);
  }

  const livestreamIds = livestreamRows.map((row) => Number(row.id));
  const idPlaceholders = placeholders(livestreamIds);

  const [productRows] = await activePool.query<ProductQuantityRow[]>(
    `SELECT
       livestreamId,
       SUM(CASE
         WHEN itemsSold IS NOT NULL THEN itemsSold
         WHEN quantity IS NOT NULL THEN quantity
         ELSE 0
       END) AS productItemsSold,
       SUM(CASE WHEN itemsSold IS NOT NULL OR quantity IS NOT NULL THEN 1 ELSE 0 END) AS evidenceCount
     FROM livestream_products
     WHERE livestreamId IN (${idPlaceholders})
     GROUP BY livestreamId`,
    livestreamIds,
  );

  const [linkedAdRows] = await activePool.query<LinkedAdRow[]>(
    `SELECT livestreamId, adType, totalBudget, liveBudget
     FROM ad_investment_records
     WHERE livestreamId IN (${idPlaceholders})
     ORDER BY livestreamId, id`,
    livestreamIds,
  );

  const quantitiesByLivestream = new Map<number, number | null>();
  for (const row of productRows) {
    const evidenceCount = Number(row.evidenceCount);
    quantitiesByLivestream.set(
      Number(row.livestreamId),
      Number.isFinite(evidenceCount) && evidenceCount > 0 ? Number(row.productItemsSold) : null,
    );
  }

  const linkedAdsByLivestream = new Map<number, LinkedAdInvestmentInput[]>();
  for (const row of linkedAdRows) {
    const livestreamId = Number(row.livestreamId);
    const current = linkedAdsByLivestream.get(livestreamId) || [];
    current.push({
      adType: row.adType,
      totalBudget: row.totalBudget,
      liveBudget: row.liveBudget,
    });
    linkedAdsByLivestream.set(livestreamId, current);
  }

  return buildLiverAdEffectDashboard(livestreamRows.map((row) => ({
    id: Number(row.id),
    livestreamDate: row.livestreamDate,
    brandName: row.brandName,
    nativeAdCost: row.adCost,
    linkedAds: linkedAdsByLivestream.get(Number(row.id)) || [],
    salesAmount: row.salesAmount,
    manualSalesAmount: row.manualSalesAmount,
    gmv: row.gmv,
    orderCount: row.orderCount,
    itemsSold: row.itemsSold,
    productItemsSold: quantitiesByLivestream.get(Number(row.id)) ?? null,
    viewerCount: row.viewerCount,
    durationMinutes: row.duration,
  })));
}

export async function updateOwnLivestreamAdCost(
  liverId: number,
  livestreamId: number,
  adCost: number | null,
  injectedPool?: LiverAdEffectPool,
): Promise<{ success: true }> {
  const activePool = injectedPool || getPool();
  const connection = await activePool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<LockedLivestreamRow[]>(
      `SELECT id, liverId, deletedAt
       FROM brand_livestreams
       WHERE id = ?
       FOR UPDATE`,
      [livestreamId],
    );

    const row = rows[0];
    if (!row || row.deletedAt) {
      throw new LiverAdEffectPersistenceError("NOT_FOUND", "直播记录不存在 / 配信記録が見つかりません");
    }
    if (Number(row.liverId) !== liverId) {
      throw new LiverAdEffectPersistenceError("FORBIDDEN", "不能修改其他主播的直播记录 / 他のライバーの記録は変更できません");
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE brand_livestreams
       SET adCost = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ? AND liverId = ? AND deletedAt IS NULL`,
      [adCost, livestreamId, liverId],
    );

    if (result.affectedRows !== 1) {
      throw new LiverAdEffectPersistenceError("INTERNAL_SERVER_ERROR", "广告费保存失败 / 広告費の保存に失敗しました");
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
