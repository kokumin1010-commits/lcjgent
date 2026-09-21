import { TRPCError } from "@trpc/server";
import type mysql from "mysql2/promise";
import { ensureSelectionProductPersistenceSchema } from "./selectionProductPersistence";

export async function archiveSelectionPriceHistory(
  pool: mysql.Pool,
  input: { id: number; reason: string },
  actorUserId: number,
): Promise<{ success: true; archived: true; idempotent: boolean }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT ph.id, ph.productId, ph.price, ph.archivedAt, sp.historicalLowestPrice
       FROM selection_price_history ph
       INNER JOIN selection_products sp ON sp.id = ph.productId AND sp.deletedAt IS NULL
       WHERE ph.id = ? LIMIT 1 FOR UPDATE`,
      [input.id],
    ) as [Array<{
      id: number;
      productId: number;
      price: string | number;
      archivedAt: Date | null;
      historicalLowestPrice: string | number | null;
    }>, unknown];
    if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "价格历史不存在" });
    if (rows[0].archivedAt) {
      await connection.rollback();
      return { success: true, archived: true, idempotent: true };
    }

    const [archiveResult] = await connection.query(
      `UPDATE selection_price_history
       SET archivedAt = CURRENT_TIMESTAMP, archivedBy = ?, archiveReason = ?
       WHERE id = ? AND archivedAt IS NULL`,
      [actorUserId, input.reason, input.id],
    ) as [mysql.ResultSetHeader, unknown];
    if (archiveResult.affectedRows !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "价格历史状态已变化，请刷新后重试" });
    }

    const [minRows] = await connection.query(
      "SELECT MIN(price) as minPrice FROM selection_price_history WHERE productId = ? AND archivedAt IS NULL",
      [rows[0].productId],
    ) as [Array<{ minPrice: string | number | null }>, unknown];
    const currentMinimum = Number(rows[0].historicalLowestPrice || 0);
    const archivedPrice = Number(rows[0].price);
    const remainingMinimum = minRows[0]?.minPrice === null || minRows[0]?.minPrice === undefined
      ? null
      : Number(minRows[0].minPrice);
    const newMinimum = currentMinimum > 0 && Math.abs(currentMinimum - archivedPrice) > 0.000001
      ? (remainingMinimum && remainingMinimum > 0 ? Math.min(currentMinimum, remainingMinimum) : currentMinimum)
      : remainingMinimum;
    await connection.query(
      "UPDATE selection_products SET historicalLowestPrice = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND deletedAt IS NULL",
      [newMinimum, rows[0].productId],
    );
    await connection.commit();
    return { success: true, archived: true, idempotent: false };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[archiveSelectionPriceHistory] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}
