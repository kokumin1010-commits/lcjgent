import { TRPCError } from "@trpc/server";

let poolInstance: any = null;

export async function getBrandDayPool() {
  if (poolInstance) return poolInstance;
  const mysql = await import("mysql2/promise");
  if (!process.env.DATABASE_URL) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "ブランドデーDB接続が設定されていません / 品牌日数据库未配置",
    });
  }
  poolInstance = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 8,
  });
  return poolInstance;
}

export function resetBrandDayPoolForTests() {
  poolInstance = null;
}
