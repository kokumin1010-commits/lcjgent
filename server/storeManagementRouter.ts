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

  // Latest month with restored/uploaded store data
  latestDataPeriod: protectedProcedure.query(async () => {
    await ensureStoreTables();
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT year, month
       FROM store_data_uploads
       WHERE dataType = 'shop_stats' AND recordCount > 0
       ORDER BY year DESC, month DESC, uploadedAt DESC
       LIMIT 1`
    );
    const latest = (rows as any[])[0];
    return latest
      ? { year: Number(latest.year), month: Number(latest.month) }
      : { year: null, month: null };
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

  getAllSummary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      await ensureStoreTables();
      const conn = await pool.getConnection();
      try {
        const [stores] = await conn.query('SELECT * FROM managed_stores WHERE isActive = 1 ORDER BY id');
        const [allData] = await conn.query(
          'SELECT * FROM store_data_uploads WHERE year = ? AND month = ?',
          [input.year, input.month]
        );
        return (stores as any[]).map(store => {
          const storeData = (allData as any[]).filter(d => d.storeId === store.id && d.dataType === 'shop_stats');
          let gmv = 0, gmvPct = 0, orders = 0, customers = 0, refund = 0;
          let liveGmv = 0, videoGmv = 0, organicGmv = 0, adGmv = 0, mallGmv = 0;
          if (storeData.length > 0) {
            try {
              const parsed = JSON.parse(storeData[0].dataJson);
              const summary = parsed.find((r: any) => r._type === 'summary') || {};
              const gmvObj = summary['GMV'] || {};
              const ordersObj = summary['注文'] || summary['订单数'] || {};
              const customersObj = summary['カスタマー数'] || summary['客户数'] || {};
              gmv = typeof gmvObj === 'object' ? (gmvObj.value || 0) : (gmvObj || 0);
              gmvPct = typeof gmvObj === 'object' ? (gmvObj.pct || 0) : 0;
              orders = typeof ordersObj === 'object' ? (ordersObj.value || 0) : (ordersObj || 0);
              customers = typeof customersObj === 'object' ? (customersObj.value || 0) : (customersObj || 0);
              const refundObj = summary['返金'] || summary['退款金額'] || summary['退款金额'] || summary['退款'] || summary['返品金額'] || summary['キャンセル金額'] || summary['Refund'] || summary['refund'] || {};
              refund = typeof refundObj === 'object' ? (refundObj.value || 0) : (refundObj || 0);
              // Extract GMV channel breakdown inside try
              const liveGmvObj = summary['直播GMV'] || summary['ライブGMV'] || summary['Live GMV'] || summary['直播'] || {};
              const videoGmvObj = summary['短视频GMV'] || summary['ショート動画GMV'] || summary['Video GMV'] || summary['短视频'] || {};
              const organicGmvObj = summary['自然流量GMV'] || summary['オーガニックGMV'] || summary['Organic GMV'] || {};
              const adGmvObj = summary['广告GMV'] || summary['広告GMV'] || summary['Ad GMV'] || summary['广告'] || {};
              const mallGmvObj = summary['商城GMV'] || summary['モールGMV'] || summary['Mall GMV'] || summary['商城'] || {};
              liveGmv = typeof liveGmvObj === 'object' ? (liveGmvObj.value || 0) : (Number(liveGmvObj) || 0);
              videoGmv = typeof videoGmvObj === 'object' ? (videoGmvObj.value || 0) : (Number(videoGmvObj) || 0);
              organicGmv = typeof organicGmvObj === 'object' ? (organicGmvObj.value || 0) : (Number(organicGmvObj) || 0);
              adGmv = typeof adGmvObj === 'object' ? (adGmvObj.value || 0) : (Number(adGmvObj) || 0);
              mallGmv = typeof mallGmvObj === 'object' ? (mallGmvObj.value || 0) : (Number(mallGmvObj) || 0);
              // Try other refund-related fields
              const allKeys = Object.keys(summary);
              const refundKey = allKeys.find(k => k.includes('退') || k.includes('返') || k.includes('キャンセル') || k.toLowerCase().includes('refund') || k.toLowerCase().includes('cancel'));
              if (refundKey) {
                const val = summary[refundKey];
                const refundVal = typeof val === 'object' ? (val.value || 0) : (Number(val) || 0);
                if (refundVal > 0) refund = refundVal;
              }
            } catch(e) {}
          }
          const returnRate = Number(gmv) > 0 ? (Number(refund) / Number(gmv) * 100) : 0;
          return { id: store.id, name: store.name, platform: store.platform, country: store.country, operatorName: store.operatorName, gmv: Number(gmv), gmvPct, orders: Number(orders), customers: Number(customers), refund: Number(refund), returnRate: Math.round(returnRate * 100) / 100, channels: { live: Number(liveGmv), video: Number(videoGmv), organic: Number(organicGmv), ad: Number(adGmv), mall: Number(mallGmv) } };
        });
      } finally { conn.release(); }
    }),
});
