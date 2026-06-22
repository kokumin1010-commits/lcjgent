import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import mysql from "mysql2/promise";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// Direct mysql2 connection pool (bypass drizzle issues on Railway)
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

export const selectionCenterRouter = router({
  // ========== Setup / Migration ==========
  setupTables: protectedProcedure.mutation(async () => {
    const pool = getPool();
    const createStatements = [
      `CREATE TABLE IF NOT EXISTS selection_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parentId INT DEFAULT NULL,
        sortOrder INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS selection_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productName VARCHAR(255) NOT NULL,
        barcode VARCHAR(100) DEFAULT NULL,
        brandName VARCHAR(255) DEFAULT NULL,
        brandId INT DEFAULT NULL,
        categoryId INT DEFAULT NULL,
        price DECIMAL(10,2) DEFAULT NULL,
        marketPrice DECIMAL(10,2) DEFAULT NULL,
        costPrice DECIMAL(10,2) DEFAULT NULL,
        commissionType ENUM('percentage','fixed') DEFAULT 'percentage',
        commissionValue DECIMAL(10,2) DEFAULT NULL,
        images JSON DEFAULT NULL,
        videos JSON DEFAULT NULL,
        productLink VARCHAR(500) DEFAULT NULL,
        sellingPoints TEXT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        stock INT DEFAULT 0,
        supplierContact VARCHAR(255) DEFAULT NULL,
        status ENUM('draft','online','offline') DEFAULT 'draft',
        createdBy INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt TIMESTAMP DEFAULT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS anchor_selections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        liverId INT NOT NULL,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sc_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        anchorId INT NOT NULL,
        productId INT NOT NULL,
        liveDate DATE NOT NULL,
        startTime VARCHAR(10) DEFAULT NULL,
        endTime VARCHAR(10) DEFAULT NULL,
        durationMinutes INT DEFAULT NULL,
        slotOrder INT DEFAULT NULL,
        status ENUM('pending','confirmed','done','cancelled') DEFAULT 'pending',
        createdBy INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS selection_performances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        liverId INT NOT NULL,
        scheduleId INT DEFAULT NULL,
        liveDate DATE NOT NULL,
        gmv DECIMAL(12,2) DEFAULT 0,
        salesCount INT DEFAULT 0,
        avgViewers INT DEFAULT 0,
        commissionAmount DECIMAL(10,2) DEFAULT 0,
        remark TEXT DEFAULT NULL,
        status ENUM('draft','confirmed') DEFAULT 'draft',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS selection_settlements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        liverId INT NOT NULL,
        periodStart DATE NOT NULL,
        periodEnd DATE NOT NULL,
        totalGmv DECIMAL(12,2) DEFAULT 0,
        totalCommission DECIMAL(10,2) DEFAULT 0,
        settledPerformanceIds JSON DEFAULT NULL,
        status ENUM('pending','confirmed','paid') DEFAULT 'pending',
        paidAt TIMESTAMP DEFAULT NULL,
        createdBy INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];
    const results: string[] = [];
    for (const stmt of createStatements) {
      try {
        await pool.query(stmt);
        const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
        results.push(`OK: ${tableName}`);
      } catch (e: any) {
        results.push(`FAIL: ${e.message}`);
      }
    }
    return { results };
  }),

  // ========== Dashboard ==========
  getDashboard: protectedProcedure.query(async () => {
    try {
      const pool = getPool();
      const [prodRows] = await pool.query('SELECT COUNT(*) as count FROM selection_products WHERE deletedAt IS NULL') as any;
      const [onlineRows] = await pool.query("SELECT COUNT(*) as count FROM selection_products WHERE status = 'online' AND deletedAt IS NULL") as any;
      const [selRows] = await pool.query('SELECT COUNT(*) as count FROM anchor_selections') as any;
      const [schedRows] = await pool.query("SELECT COUNT(*) as count FROM sc_schedules WHERE status = 'confirmed'") as any;
      const [gmvRows] = await pool.query('SELECT COALESCE(SUM(gmv), 0) as total FROM selection_performances') as any;
      return {
        totalProducts: Number(prodRows[0]?.count || 0),
        onlineProducts: Number(onlineRows[0]?.count || 0),
        totalSelections: Number(selRows[0]?.count || 0),
        confirmedSchedules: Number(schedRows[0]?.count || 0),
        totalGmv: String(gmvRows[0]?.total || '0'),
      };
    } catch (e: any) {
      console.error('[getDashboard] Error:', e.message);
      return { totalProducts: 0, onlineProducts: 0, totalSelections: 0, confirmedSchedules: 0, totalGmv: '0' };
    }
  }),

  // ========== Categories ==========
  getCategories: protectedProcedure.query(async () => {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT id, name, parentId, sortOrder, createdAt, updatedAt FROM selection_categories ORDER BY sortOrder ASC');
      return rows;
    } catch (e: any) {
      console.error('[getCategories] Error:', e.message, e.code, e.errno);
      throw new Error(`getCategories failed: ${e.message} | code=${e.code} | errno=${e.errno}`);
    }
  }),

  createCategory: protectedProcedure.input(z.object({
    name: z.string(),
    parentId: z.number().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO selection_categories (name, parentId, sortOrder) VALUES (?, ?, ?)',
      [input.name, input.parentId || null, input.sortOrder || 0]
    ) as any;
    return { id: result.insertId };
  }),

  // ========== Products ==========
  getProducts: protectedProcedure.input(z.object({
    search: z.string().optional(),
    status: z.enum(["draft", "online", "offline"]).optional(),
    categoryId: z.number().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(50),
  })).query(async ({ input }) => {
    const pool = getPool();
    let where = 'WHERE deletedAt IS NULL';
    const params: any[] = [];
    if (input.status) { where += ' AND status = ?'; params.push(input.status); }
    if (input.categoryId) { where += ' AND categoryId = ?'; params.push(input.categoryId); }
    if (input.search) { where += ' AND (productName LIKE ? OR brandName LIKE ? OR barcode LIKE ?)'; params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`); }
    const offset = (input.page - 1) * input.pageSize;
    const [items] = await pool.query(`SELECT * FROM selection_products ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, input.pageSize, offset]) as any;
    const [countResult] = await pool.query(`SELECT COUNT(*) as count FROM selection_products ${where}`, params) as any;
    return { items, total: Number(countResult[0]?.count || 0) };
  }),

  createProduct: protectedProcedure.input(z.object({
    productName: z.string(),
    barcode: z.string().optional(),
    brandName: z.string(),
    brandId: z.number().optional(),
    categoryId: z.number().optional(),
    price: z.string().optional(),
    marketPrice: z.string().optional(),
    costPrice: z.string().optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.string().optional(),
    images: z.any().optional(),
    videos: z.any().optional(),
    productLink: z.string().optional(),
    sellingPoints: z.string().optional(),
    description: z.string().optional(),
    stock: z.number().optional(),
    supplierContact: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO selection_products (productName, barcode, brandName, brandId, categoryId, price, marketPrice, costPrice, commissionType, commissionValue, images, videos, productLink, sellingPoints, description, stock, supplierContact, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.productName, input.barcode || null, input.brandName, input.brandId || null, input.categoryId || null, input.price || null, input.marketPrice || null, input.costPrice || null, input.commissionType || 'percentage', input.commissionValue || null, input.images ? JSON.stringify(input.images) : null, input.videos ? JSON.stringify(input.videos) : null, input.productLink || null, input.sellingPoints || null, input.description || null, input.stock || 0, input.supplierContact || null, (ctx.user as any)?.id || 0]
    ) as any;
    return { id: result.insertId };
  }),

  updateProduct: protectedProcedure.input(z.object({
    id: z.number(),
    productName: z.string().optional(),
    barcode: z.string().optional(),
    brandName: z.string().optional(),
    brandId: z.number().optional(),
    categoryId: z.number().optional(),
    price: z.string().optional(),
    marketPrice: z.string().optional(),
    costPrice: z.string().optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.string().optional(),
    images: z.any().optional(),
    videos: z.any().optional(),
    productLink: z.string().optional(),
    sellingPoints: z.string().optional(),
    description: z.string().optional(),
    stock: z.number().optional(),
    supplierContact: z.string().optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const { id, ...data } = input;
    const setClauses: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(key === 'images' || key === 'videos' ? JSON.stringify(value) : value);
      }
    }
    if (setClauses.length === 0) return { success: true };
    params.push(id);
    await pool.query(`UPDATE selection_products SET ${setClauses.join(', ')} WHERE id = ?`, params);
    return { success: true };
  }),

  updateProductStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "online", "offline"]),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    await pool.query('UPDATE selection_products SET status = ? WHERE id = ?', [input.status, input.id]);
    return { success: true };
  }),

  deleteProduct: protectedProcedure.input(z.object({
    id: z.number(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    await pool.query('UPDATE selection_products SET deletedAt = NOW() WHERE id = ?', [input.id]);
    return { success: true };
  }),

  // ========== Schedules ==========
  getSchedules: protectedProcedure.query(async () => {
    const pool = getPool();
    const [schedules] = await pool.query('SELECT * FROM sc_schedules ORDER BY liveDate DESC') as any;
    const productIds = [...new Set(schedules.map((s: any) => s.productId))];
    let products: any[] = [];
    if (productIds.length > 0) {
      const [prods] = await pool.query(`SELECT * FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds) as any;
      products = prods;
    }
    return schedules.map((s: any) => ({ ...s, product: products.find((p: any) => p.id === s.productId) }));
  }),

  createSchedule: protectedProcedure.input(z.object({
    productId: z.number(),
    anchorId: z.number(),
    liveDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    durationMinutes: z.number().optional(),
    slotOrder: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO sc_schedules (anchorId, productId, liveDate, startTime, endTime, durationMinutes, slotOrder, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [input.anchorId, input.productId, input.liveDate, input.startTime || null, input.endTime || null, input.durationMinutes || null, input.slotOrder || null, (ctx.user as any)?.id || 0]
    ) as any;
    return { id: result.insertId };
  }),

  updateSchedule: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "done", "cancelled"]).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    durationMinutes: z.number().optional(),
    slotOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const { id, ...data } = input;
    const setClauses: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) { setClauses.push(`${key} = ?`); params.push(value); }
    }
    if (setClauses.length === 0) return { success: true };
    params.push(id);
    await pool.query(`UPDATE sc_schedules SET ${setClauses.join(', ')} WHERE id = ?`, params);
    return { success: true };
  }),

  // ========== Performances ==========
  getPerformances: protectedProcedure.query(async () => {
    const pool = getPool();
    const [perfs] = await pool.query('SELECT * FROM selection_performances ORDER BY liveDate DESC') as any;
    const productIds = [...new Set(perfs.map((p: any) => p.productId))];
    let products: any[] = [];
    if (productIds.length > 0) {
      const [prods] = await pool.query(`SELECT * FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds) as any;
      products = prods;
    }
    return perfs.map((p: any) => ({ ...p, product: products.find((pr: any) => pr.id === p.productId) }));
  }),

  createPerformance: protectedProcedure.input(z.object({
    productId: z.number(),
    liverId: z.number(),
    scheduleId: z.number().optional(),
    liveDate: z.string(),
    gmv: z.string().optional(),
    salesCount: z.number().optional(),
    avgViewers: z.number().optional(),
    commissionAmount: z.string().optional(),
    remark: z.string().optional(),
    status: z.enum(["draft", "confirmed"]).optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO selection_performances (productId, liverId, scheduleId, liveDate, gmv, salesCount, avgViewers, commissionAmount, remark, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [input.productId, input.liverId, input.scheduleId || null, input.liveDate, input.gmv || '0', input.salesCount || 0, input.avgViewers || 0, input.commissionAmount || '0', input.remark || null, input.status || 'draft']
    ) as any;
    return { id: result.insertId };
  }),

  // ========== Settlements ==========
  getSettlements: protectedProcedure.query(async () => {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM selection_settlements ORDER BY createdAt DESC') as any;
    return rows;
  }),

  generateSettlement: protectedProcedure.input(z.object({
    liverId: z.number(),
    periodStart: z.string(),
    periodEnd: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const [perfs] = await pool.query(
      "SELECT * FROM selection_performances WHERE liverId = ? AND status = 'confirmed' AND liveDate >= ? AND liveDate <= ?",
      [input.liverId, input.periodStart, input.periodEnd]
    ) as any;
    const totalGmv = perfs.reduce((sum: number, p: any) => sum + Number(p.gmv || 0), 0);
    const totalCommission = perfs.reduce((sum: number, p: any) => sum + Number(p.commissionAmount || 0), 0);
    const [result] = await pool.query(
      'INSERT INTO selection_settlements (liverId, periodStart, periodEnd, totalGmv, totalCommission, settledPerformanceIds, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.liverId, input.periodStart, input.periodEnd, String(totalGmv), String(totalCommission), JSON.stringify(perfs.map((p: any) => p.id)), (ctx.user as any)?.id || 0]
    ) as any;
    return { id: result.insertId, totalGmv: String(totalGmv), totalCommission: String(totalCommission) };
  }),

  updateSettlementStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "paid"]),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    if (input.status === "paid") {
      await pool.query('UPDATE selection_settlements SET status = ?, paidAt = NOW() WHERE id = ?', [input.status, input.id]);
    } else {
      await pool.query('UPDATE selection_settlements SET status = ? WHERE id = ?', [input.status, input.id]);
    }
    return { success: true };
  }),

  // ========== Liver-facing endpoints ==========
  getLiverAvailableProducts: publicProcedure.input(z.object({
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const pool = getPool();
    let where = "WHERE status = 'online' AND deletedAt IS NULL";
    const params: any[] = [];
    if (input.search) { where += ' AND (productName LIKE ? OR brandName LIKE ? OR barcode LIKE ?)'; params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`); }
    const [rows] = await pool.query(`SELECT * FROM selection_products ${where} ORDER BY createdAt DESC`, params) as any;
    return rows;
  }),

  liverSelectProduct: publicProcedure.input(z.object({
    productId: z.number(),
    liverId: z.number(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const [existing] = await pool.query('SELECT id FROM anchor_selections WHERE productId = ? AND liverId = ?', [input.productId, input.liverId]) as any;
    if (existing.length > 0) throw new Error("既に選品済みです");
    const [result] = await pool.query('INSERT INTO anchor_selections (productId, liverId) VALUES (?, ?)', [input.productId, input.liverId]) as any;
    return { id: result.insertId };
  }),

  getLiverMySelections: publicProcedure.input(z.object({
    liverId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    if (!input.liverId) return [];
    const [selections] = await pool.query('SELECT * FROM anchor_selections WHERE liverId = ? ORDER BY createdAt DESC', [input.liverId]) as any;
    const productIds = selections.map((s: any) => s.productId);
    if (productIds.length === 0) return [];
    const [products] = await pool.query(`SELECT * FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds) as any;
    return selections.map((s: any) => {
      const p = products.find((pr: any) => pr.id === s.productId);
      return { ...s, productName: p?.productName, brandName: p?.brandName, commissionType: p?.commissionType, commissionValue: p?.commissionValue };
    });
  }),

  getLiverMyPerformance: publicProcedure.input(z.object({
    liverId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    if (!input.liverId) return [];
    const [perfs] = await pool.query('SELECT * FROM selection_performances WHERE liverId = ? ORDER BY liveDate DESC', [input.liverId]) as any;
    const productIds = [...new Set(perfs.map((p: any) => p.productId))];
    if (productIds.length === 0) return perfs;
    const [products] = await pool.query(`SELECT * FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds) as any;
    return perfs.map((p: any) => ({ ...p, productName: products.find((pr: any) => pr.id === p.productId)?.productName }));
  }),

  // Get active livers for dropdown
  getLivers: publicProcedure.query(async () => {
    const pool = getPool();
    try {
      const [rows] = await pool.query('SELECT id, name FROM livers WHERE isActive = 1 ORDER BY name ASC') as any;
      return rows;
    } catch (e) {
      // livers table might not exist in this DB
      return [];
    }
  }),

  // Get all selections (admin view)
  getSelections: protectedProcedure.query(async () => {
    const pool = getPool();
    const [selections] = await pool.query('SELECT * FROM anchor_selections ORDER BY createdAt DESC') as any;
    if (selections.length === 0) return [];
    const productIds = [...new Set(selections.map((s: any) => s.productId))];
    const liverIds = [...new Set(selections.map((s: any) => s.liverId))];
    const [products] = await pool.query(`SELECT id, productName, brandName, commissionType, commissionValue, price FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds) as any;
    let livers: any[] = [];
    if (liverIds.length > 0) {
      try {
        const [liverRows] = await pool.query(`SELECT id, name FROM livers WHERE id IN (${liverIds.map(() => '?').join(',')})`, liverIds) as any;
        livers = liverRows;
      } catch (e) { /* livers table might not exist in this DB */ }
    }
    return selections.map((s: any) => {
      const p = products.find((pr: any) => pr.id === s.productId);
      const l = livers.find((lr: any) => lr.id === s.liverId);
      return { ...s, productName: p?.productName, brandName: p?.brandName, commissionType: p?.commissionType, commissionValue: p?.commissionValue, price: p?.price, liverName: l?.name || `ID:${s.liverId}` };
    });
  }),

  // Delete a selection
  deleteSelection: protectedProcedure.input(z.object({
    id: z.number(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    await pool.query('DELETE FROM anchor_selections WHERE id = ?', [input.id]);
    return { success: true };
  }),

  // ========== Barcode Lookup ==========
  getProductByBarcode: publicProcedure.input(z.object({
    barcode: z.string().min(1),
  })).query(async ({ input }) => {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM selection_products WHERE barcode = ? LIMIT 1', [input.barcode.trim()]) as any;
    if (rows.length === 0) return null;
    const product = rows[0];
    // Parse images JSON if needed
    if (product.images && typeof product.images === 'string') {
      try { product.images = JSON.parse(product.images); } catch { product.images = []; }
    }
    return product;
  }),

  // ========== Image Upload ==========
  uploadProductImage: protectedProcedure.input(z.object({
    fileName: z.string(),
    mimeType: z.string(),
    base64Data: z.string(),
  })).mutation(async ({ input }) => {
    const buffer = Buffer.from(input.base64Data, "base64");
    const ext = input.fileName.split(".").pop() || "jpg";
    const fileKey = `selection-products/${Date.now()}-${nanoid(8)}.${ext}`;
    const { url, key } = await storagePut(fileKey, buffer, input.mimeType);
    return { url, key };
  }),
});
