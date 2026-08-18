/**
 * Store Management Router - 店铺管理系统
 * 
 * 全屏店铺管理：店铺CRUD、运营人员指定、CSV数据导入、KPI展示
 */
import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc.js';

let poolInstance: any = null;
async function getPool() {
  if (poolInstance) return poolInstance;
  const mysql = await import('mysql2/promise');
  poolInstance = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return poolInstance;
}

async function ensureStoreTables() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS managed_stores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      platform VARCHAR(100) NOT NULL DEFAULT 'tiktok_shop',
      country VARCHAR(100) NOT NULL DEFAULT 'japan',
      storeUrl VARCHAR(500),
      operatorId INT,
      operatorName VARCHAR(255),
      operator2Id INT,
      operator2Name VARCHAR(255),
      notes TEXT,
      isActive TINYINT(1) DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_data_uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      storeId INT NOT NULL,
      dataType ENUM('shop_stats', 'products', 'ads') NOT NULL,
      year INT NOT NULL,
      month INT NOT NULL,
      dataJson LONGTEXT,
      fileName VARCHAR(255),
      recordCount INT DEFAULT 0,
      uploadedBy VARCHAR(255),
      uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_store_period (storeId, year, month, dataType)
    )
  `).catch(() => {});
  await pool.query("ALTER TABLE managed_stores ADD COLUMN avatarUrl VARCHAR(500)").catch(() => {});
}

export const storeManagementRouter = router({
  // List all stores
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureStoreTables();
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT * FROM managed_stores WHERE isActive = 1 ORDER BY platform, name'
    );
    return rows as any[];
  }),

  // Create store
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      platform: z.string().default('tiktok_shop'),
      country: z.string().default('japan'),
      storeUrl: z.string().optional(),
      operatorId: z.number().optional(),
      operatorName: z.string().optional(),
      operator2Id: z.number().optional(),
      operator2Name: z.string().optional(),
      notes: z.string().optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const [result] = await pool.query(
        `INSERT INTO managed_stores (name, platform, country, storeUrl, operatorId, operatorName, operator2Id, operator2Name, notes, avatarUrl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.name, input.platform, input.country, input.storeUrl || null,
         input.operatorId || null, input.operatorName || null,
         input.operator2Id || null, input.operator2Name || null,
         input.notes || null,
         input.avatarUrl || null]
      );
      return { id: (result as any).insertId };
    }),

  // Update store
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      platform: z.string().optional(),
      country: z.string().optional(),
      storeUrl: z.string().optional(),
      operatorId: z.number().nullable().optional(),
      operatorName: z.string().nullable().optional(),
      operator2Id: z.number().nullable().optional(),
      operator2Name: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      const { id, ...fields } = input;
      const sets: string[] = [];
      const params: any[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          sets.push(`${key} = ?`);
          params.push(val);
        }
      }
      if (sets.length === 0) return { success: true };
      params.push(id);
      await pool.query(`UPDATE managed_stores SET ${sets.join(', ')} WHERE id = ?`, params);
      return { success: true };
    }),

  // Delete store (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      await pool.query('UPDATE managed_stores SET isActive = 0 WHERE id = ?', [input.id]);
      return { success: true };
    }),

  // Upload CSV data
  uploadData: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      dataType: z.enum(['shop_stats', 'products', 'ads']),
      year: z.number(),
      month: z.number(),
      data: z.array(z.record(z.string(), z.any())),
      fileName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureStoreTables();
      const pool = await getPool();
      // Delete existing data for same store/period/type (replace)
      await pool.query(
        'DELETE FROM store_data_uploads WHERE storeId = ? AND year = ? AND month = ? AND dataType = ?',
        [input.storeId, input.year, input.month, input.dataType]
      );
      // Insert new data
      await pool.query(
        `INSERT INTO store_data_uploads (storeId, dataType, year, month, dataJson, fileName, recordCount, uploadedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.storeId, input.dataType, input.year, input.month,
         JSON.stringify(input.data), input.fileName || null,
         input.data.length, (ctx as any).user?.name || 'Unknown']
      );
      return { success: true, recordCount: input.data.length };
    }),

  // Get store data for a specific period
  getData: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      year: z.number(),
      month: z.number(),
      dataType: z.enum(['shop_stats', 'products', 'ads']).optional(),
    }))
    .query(async ({ input }) => {
      await ensureStoreTables();
      const pool = await getPool();
      let where = 'WHERE storeId = ? AND year = ? AND month = ?';
      const params: any[] = [input.storeId, input.year, input.month];
      if (input.dataType) {
        where += ' AND dataType = ?';
        params.push(input.dataType);
      }
      const [rows] = await pool.query(
        `SELECT id, dataType, year, month, dataJson, fileName, recordCount, uploadedBy, uploadedAt
         FROM store_data_uploads ${where} ORDER BY uploadedAt DESC`,
        params
      );
      return (rows as any[]).map(r => ({
        ...r,
        data: r.dataJson ? JSON.parse(r.dataJson) : [],
        dataJson: undefined,
      }));
    }),

  // Get upload history for a store
  getUploadHistory: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const [rows] = await pool.query(
        `SELECT id, dataType, year, month, fileName, recordCount, uploadedBy, uploadedAt
         FROM store_data_uploads WHERE storeId = ? ORDER BY uploadedAt DESC LIMIT 50`,
        [input.storeId]
      );
      return rows as any[];
    }),

  // Delete uploaded data
  deleteData: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      await pool.query('DELETE FROM store_data_uploads WHERE id = ?', [input.id]);
      return { success: true };
    }),

  // Get staff list for operator assignment
  getStaffList: protectedProcedure.query(async () => {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, name, email FROM staff WHERE isActive = "active" ORDER BY name'
    );
    return rows as any[];
  }),
});
