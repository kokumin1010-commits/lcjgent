import type mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  AuctionRecordValidationError,
  canonicalAuctionRecordInput,
  normalizeAuctionRounds,
} from "@shared/auctionRecordPersistence";

const UPDATE_COLUMNS = [
  "productId",
  "productName",
  "chineseName",
  "startPrice",
  "finalPrice",
  "totalGmv",
  "totalOrders",
  "auctionCount",
  "liverName",
  "auctionDate",
  "note",
  "roundsJson",
  "livestreamId",
] as const;

const CREATE_COLUMNS = [...UPDATE_COLUMNS, "createdBy"] as const;

function badRequest(error: unknown): never {
  if (error instanceof AuctionRecordValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

function canonical(
  rawInput: Record<string, unknown>,
  options: { requireIdentity?: boolean; requireDate?: boolean } = {},
): Record<string, unknown> {
  try {
    return canonicalAuctionRecordInput(rawInput, options);
  } catch (error) {
    return badRequest(error);
  }
}

export async function createAuctionRecord(
  pool: mysql.Pool,
  rawInput: Record<string, unknown>,
  createdBy: number | null,
): Promise<{ id: number; success: true }> {
  const data = canonical(rawInput, { requireIdentity: true, requireDate: true });
  data.createdBy = createdBy;
  if (data.auctionCount === undefined) data.auctionCount = 0;
  if (data.roundsJson === undefined) data.roundsJson = null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const columns = [...CREATE_COLUMNS];
    const values = columns.map((column) => data[column] ?? null);
    const placeholders = columns.map(() => "?").join(", ");
    const [result] = await connection.query(
      `INSERT INTO auction_records (${columns.join(", ")}) VALUES (${placeholders})`,
      values,
    ) as [mysql.ResultSetHeader, unknown];
    const id = Number(result.insertId);
    if (!Number.isInteger(id) || id <= 0 || result.affectedRows !== 1) {
      throw new Error("拍卖记录创建失败 / 拍卖記録の作成に失敗しました");
    }
    await connection.commit();
    return { id, success: true };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("[createAuctionRecord] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateAuctionRecord(
  pool: mysql.Pool,
  id: number,
  rawInput: Record<string, unknown>,
): Promise<{ success: true }> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "拍卖记录ID无效 / 拍卖記録IDが正しくありません" });
  }
  const data = canonical(rawInput);
  const columns = UPDATE_COLUMNS.filter((column) => data[column] !== undefined);
  if (columns.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "没有可保存的修改 / 保存できる変更がありません" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      "SELECT id FROM auction_records WHERE id = ? LIMIT 1 FOR UPDATE",
      [id],
    ) as [Array<{ id: number }>, unknown];
    if (existingRows.length !== 1) {
      throw new TRPCError({ code: "NOT_FOUND", message: "拍卖记录不存在 / 拍卖記録が存在しません" });
    }

    const assignments = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => data[column] ?? null);
    const [result] = await connection.query(
      `UPDATE auction_records SET ${assignments} WHERE id = ?`,
      [...values, id],
    ) as [mysql.ResultSetHeader, unknown];
    if (result.affectedRows !== 1) {
      throw new Error("拍卖记录更新失败 / 拍卖記録の更新に失敗しました");
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("[updateAuctionRecord] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

function validateRoundPosition(roundIndex: number): void {
  if (!Number.isInteger(roundIndex) || roundIndex < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "拍卖明细位置无效 / 拍卖明細の位置が正しくありません" });
  }
}

function summarizeRounds(roundsInput: unknown[]) {
  const rounds = normalizeAuctionRounds(roundsInput.map((round, index) => ({ ...(round as Record<string, unknown>), roundNumber: index + 1 })));
  const positivePrices = rounds.map(round => round.salePrice).filter(price => price > 0);
  return {
    roundsJson: JSON.stringify(rounds),
    auctionCount: rounds.length,
    startPrice: rounds[0]?.startPrice ?? null,
    finalPrice: positivePrices.length ? Math.round(positivePrices.reduce((sum, price) => sum + price, 0) / positivePrices.length) : null,
  };
}

export async function updateAuctionRound(
  pool: mysql.Pool,
  recordId: number,
  roundIndex: number,
  rawRound: Record<string, unknown>,
): Promise<{ success: true; auctionCount: number }> {
  validateRoundPosition(roundIndex);
  let replacement;
  try {
    replacement = normalizeAuctionRounds([rawRound])[0];
  } catch (error) {
    return badRequest(error);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT id, roundsJson FROM auction_records WHERE id = ? LIMIT 1 FOR UPDATE", [recordId]) as [Array<{ id: number; roundsJson: unknown }>, unknown];
    const existing = rows[0];
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "拍卖记录不存在 / 拍卖記録が存在しません" });
    const rounds = normalizeAuctionRounds(existing.roundsJson);
    if (!replacement || roundIndex >= rounds.length) throw new TRPCError({ code: "NOT_FOUND", message: "拍卖明细不存在 / 拍卖明細が存在しません" });
    rounds[roundIndex] = replacement;
    const summary = summarizeRounds(rounds);
    const [result] = await connection.query(
      "UPDATE auction_records SET roundsJson = ?, auctionCount = ?, startPrice = ?, finalPrice = ? WHERE id = ?",
      [summary.roundsJson, summary.auctionCount, summary.startPrice, summary.finalPrice, recordId],
    ) as [mysql.ResultSetHeader, unknown];
    if (result.affectedRows !== 1) throw new Error("拍卖明细更新失败 / 拍卖明細の更新に失敗しました");
    await connection.commit();
    return { success: true, auctionCount: summary.auctionCount };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[updateAuctionRound] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteAuctionRound(
  pool: mysql.Pool,
  recordId: number,
  roundIndex: number,
): Promise<{ success: true; auctionCount: number }> {
  validateRoundPosition(roundIndex);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT id, roundsJson FROM auction_records WHERE id = ? LIMIT 1 FOR UPDATE", [recordId]) as [Array<{ id: number; roundsJson: unknown }>, unknown];
    const existing = rows[0];
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "拍卖记录不存在 / 拍卖記録が存在しません" });
    const rounds = normalizeAuctionRounds(existing.roundsJson);
    if (roundIndex >= rounds.length) throw new TRPCError({ code: "NOT_FOUND", message: "拍卖明细不存在 / 拍卖明細が存在しません" });
    rounds.splice(roundIndex, 1);
    const summary = summarizeRounds(rounds);
    const [result] = await connection.query(
      "UPDATE auction_records SET roundsJson = ?, auctionCount = ?, startPrice = ?, finalPrice = ? WHERE id = ?",
      [summary.roundsJson, summary.auctionCount, summary.startPrice, summary.finalPrice, recordId],
    ) as [mysql.ResultSetHeader, unknown];
    if (result.affectedRows !== 1) throw new Error("拍卖明细删除失败 / 拍卖明細の削除に失敗しました");
    await connection.commit();
    return { success: true, auctionCount: summary.auctionCount };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[deleteAuctionRound] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}
