import type mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  AuctionRecordValidationError,
  canonicalAuctionRecordInput,
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
