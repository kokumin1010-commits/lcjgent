import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import mysql from "mysql2/promise";
let pool: mysql.Pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL || "",
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return pool;
}

let tableCreated = false;

async function ensureTable() {
  if (tableCreated) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId VARCHAR(255) DEFAULT NULL,
      productName VARCHAR(500) DEFAULT NULL,
      startPrice DECIMAL(10,2) DEFAULT NULL,
      finalPrice DECIMAL(10,2) DEFAULT NULL,
      liverName VARCHAR(255) DEFAULT NULL,
      auctionDate DATE DEFAULT NULL,
      note TEXT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      createdBy INT DEFAULT NULL
    )
  `);
  tableCreated = true;
}

export const auctionRouter = router({
  list: protectedProcedure.input(z.object({
    productId: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    await ensureTable();
    const pool = getPool();
    let sql = "SELECT * FROM auction_records ORDER BY auctionDate DESC, createdAt DESC";
    let params: any[] = [];
    if (input?.productId) {
      sql = "SELECT * FROM auction_records WHERE productId = ? ORDER BY auctionDate DESC, createdAt DESC";
      params = [input.productId];
    }
    const [rows] = await pool.query(sql, params);
    return rows as any[];
  }),

  create: protectedProcedure.input(z.object({
    productId: z.string().optional(),
    productName: z.string().optional(),
    startPrice: z.number().optional(),
    finalPrice: z.number().optional(),
    liverName: z.string().optional(),
    auctionDate: z.string().optional(),
    note: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    await ensureTable();
    const pool = getPool();
    await pool.query(
      `INSERT INTO auction_records (productId, productName, startPrice, finalPrice, liverName, auctionDate, note, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.productId || null, input.productName || null, input.startPrice || null, input.finalPrice || null, input.liverName || null, input.auctionDate || null, input.note || null, (ctx.user as any)?.id || null]
    );
    return { success: true };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    productId: z.string().optional(),
    productName: z.string().optional(),
    startPrice: z.number().optional(),
    finalPrice: z.number().optional(),
    liverName: z.string().optional(),
    auctionDate: z.string().optional(),
    note: z.string().optional(),
  })).mutation(async ({ input }) => {
    await ensureTable();
    const pool = getPool();
    const { id, ...data } = input;
    const sets: string[] = [];
    const params: any[] = [];
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        params.push(val);
      }
    });
    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE auction_records SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await ensureTable();
    const pool = getPool();
    await pool.query("DELETE FROM auction_records WHERE id = ?", [input.id]);
    return { success: true };
  }),
});
