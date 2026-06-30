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
        tags JSON DEFAULT NULL,
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
    let where = 'WHERE sp.deletedAt IS NULL';
    const params: any[] = [];
    if (input.status) { where += ' AND sp.status = ?'; params.push(input.status); }
    if (input.categoryId) { where += ' AND sp.categoryId = ?'; params.push(input.categoryId); }
    if (input.search) { where += ' AND (sp.productName LIKE ? OR sp.brandName LIKE ? OR sp.barcode LIKE ?)'; params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`); }
    const offset = (input.page - 1) * input.pageSize;
    let items: any[];
    try {
      const [rows] = await pool.query(`SELECT sp.*, b.hasTikTokBackend FROM selection_products sp LEFT JOIN brands b ON sp.brandId = b.id ${where} ORDER BY sp.createdAt DESC LIMIT ? OFFSET ?`, [...params, input.pageSize, offset]) as any;
      items = rows;
    } catch (e: any) {
      // Fallback if hasTikTokBackend column doesn't exist yet
      console.warn('[getProducts] JOIN fallback:', e.message);
      const [rows] = await pool.query(`SELECT sp.* FROM selection_products sp ${where} ORDER BY sp.createdAt DESC LIMIT ? OFFSET ?`, [...params, input.pageSize, offset]) as any;
      items = rows;
    }
    const [countResult] = await pool.query(`SELECT COUNT(*) as count FROM selection_products sp ${where}`, params) as any;
    return { items, total: Number(countResult[0]?.count || 0) };
  }),

  createProduct: protectedProcedure.input(z.object({
    productName: z.string(),
    productId: z.string().optional(),
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
    talentExclusive: z.number().optional(),
    exclusiveLiverIds: z.array(z.number()).optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO selection_products (productName, productId, barcode, brandName, brandId, categoryId, price, marketPrice, costPrice, commissionType, commissionValue, images, videos, productLink, sellingPoints, description, stock, supplierContact, talentExclusive, exclusiveLiverIds, tags, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.productName, input.productId || null, input.barcode || null, input.brandName, input.brandId || null, input.categoryId || null, input.price || null, input.marketPrice || null, input.costPrice || null, input.commissionType || 'percentage', input.commissionValue || null, input.images ? JSON.stringify(input.images) : null, input.videos ? JSON.stringify(input.videos) : null, input.productLink || null, input.sellingPoints || null, input.description || null, input.stock || 0, input.supplierContact || null, input.talentExclusive || 0, input.exclusiveLiverIds ? JSON.stringify(input.exclusiveLiverIds) : null, input.tags ? JSON.stringify(input.tags) : null, (ctx.user as any)?.id || 0]
    ) as any;
    return { id: result.insertId };
  }),

  updateProduct: protectedProcedure.input(z.object({
    id: z.number(),
    productName: z.string().optional(),
    productId: z.string().optional(),
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
    talentExclusive: z.number().optional(),
    exclusiveLiverIds: z.array(z.number()).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const { id, ...data } = input;
    const setClauses: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(key === 'images' || key === 'videos' || key === 'exclusiveLiverIds' || key === 'tags' ? JSON.stringify(value) : value);
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

  // Delete a schedule
  deleteSchedule: protectedProcedure.input(z.object({
    id: z.number(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    await pool.query('DELETE FROM sc_schedules WHERE id = ?', [input.id]);
    return { success: true };
  }),

  // Batch create schedules from liver's selected products
  batchCreateSchedules: protectedProcedure.input(z.object({
    anchorId: z.number(),
    liveDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    productIds: z.array(z.number()).optional(),
    brandTimes: z.record(z.string(), z.object({ startTime: z.string().optional(), endTime: z.string().optional() })).optional(),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    let productIds = input.productIds;
    if (!productIds || productIds.length === 0) {
      const [selections] = await pool.query('SELECT productId FROM anchor_selections WHERE liverId = ?', [input.anchorId]) as any;
      productIds = selections.map((s: any) => s.productId);
    }
    if (productIds.length === 0) throw new Error('该主播没有已选商品');
    const [products] = await pool.query(`SELECT id, productName, brandName FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds) as any;
    const brandGroups: Record<string, any[]> = {};
    for (const p of products) {
      const brand = p.brandName || '未分类';
      if (!brandGroups[brand]) brandGroups[brand] = [];
      brandGroups[brand].push(p);
    }
    let slotOrder = 1;
    const createdIds: number[] = [];
    for (const [brand, prods] of Object.entries(brandGroups)) {
      // Use per-brand time if available, otherwise fall back to global time
      const brandTime = input.brandTimes?.[brand];
      const startTime = brandTime?.startTime || input.startTime || null;
      const endTime = brandTime?.endTime || input.endTime || null;
      for (const p of prods) {
        const [result] = await pool.query(
          'INSERT INTO sc_schedules (anchorId, productId, liveDate, startTime, endTime, slotOrder, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [input.anchorId, p.id, input.liveDate, startTime, endTime, slotOrder, (ctx.user as any)?.id || 0]
        ) as any;
        createdIds.push(result.insertId);
        slotOrder++;
      }
    }
    return { success: true, count: createdIds.length, ids: createdIds };
  }),

  // Get liver's selected products grouped by brand
  getLiverProductsByBrand: publicProcedure.input(z.object({
    liverId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    if (!input.liverId) return [];
    const [selections] = await pool.query('SELECT productId FROM anchor_selections WHERE liverId = ?', [input.liverId]) as any;
    const productIds = selections.map((s: any) => s.productId);
    if (productIds.length === 0) return [];
    const [products] = await pool.query(`SELECT id, productName, brandName, price, commissionType, commissionValue FROM selection_products WHERE id IN (${productIds.map(() => '?').join(',')}) AND deletedAt IS NULL AND status = 'online'`, productIds) as any;
    const brandGroups: Record<string, any[]> = {};
    for (const p of products) {
      const brand = p.brandName || '\u672a\u5206\u7c7b';
      if (!brandGroups[brand]) brandGroups[brand] = [];
      brandGroups[brand].push(p);
    }
    return Object.entries(brandGroups).map(([brand, prods]) => ({ brand, products: prods }));
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
    let where = "WHERE sp.status = 'online' AND sp.deletedAt IS NULL";
    const params: any[] = [];
    if (input.search) { where += ' AND (sp.productName LIKE ? OR sp.brandName LIKE ? OR sp.barcode LIKE ?)'; params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`); }
    let rows: any[];
    try {
      const [result] = await pool.query(`SELECT sp.*, b.hasTikTokBackend FROM selection_products sp LEFT JOIN brands b ON sp.brandId = b.id ${where} ORDER BY sp.createdAt DESC`, params) as any;
      rows = result;
    } catch (e: any) {
      // Fallback if hasTikTokBackend column doesn't exist yet
      console.warn('[getLiverAvailableProducts] JOIN fallback:', e.message);
      const [result] = await pool.query(`SELECT sp.* FROM selection_products sp ${where} ORDER BY sp.createdAt DESC`, params) as any;
      rows = result;
    }
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

  // ========== Product Performance History (全商品パフォーマンス一覧) ==========
  getProductPerformanceHistory: protectedProcedure.input(z.object({
    brandId: z.number().optional(),
    search: z.string().optional(),
    streamerName: z.string().optional(),
  })).query(async ({ input }) => {
    const pool = getPool();
    
    // Get all products grouped by productName with daily breakdown
    // Each row = one product in one livestream (one CSV upload)
    let where = '1=1';
    const params: any[] = [];
    if (input.brandId) {
      where += ' AND bl.brandId = ?';
      params.push(input.brandId);
    }
    if (input.streamerName) {
      where += ' AND TRIM(bl.streamerName) = ?';
      params.push(input.streamerName.trim());
    }
    if (input.search) {
      where += ' AND lp.productName LIKE ?';
      params.push(`%${input.search}%`);
    }
    
    // Get detailed per-livestream data for all products
    const [rows] = await pool.query(`
      SELECT 
        lp.productName,
        lp.directGmv,
        lp.grossRevenue,
        lp.itemsSold,
        lp.customers,
        lp.unitPrice,
        lp.productImpressions,
        lp.productClicks,
        lp.ctr,
        lp.ctor,
        bl.livestreamDate,
        bl.streamerName,
        bl.id as livestreamId,
        bl.brandId
      FROM livestream_products lp
      JOIN brand_livestreams bl ON lp.livestreamId = bl.id
      WHERE ${where}
      ORDER BY lp.productName ASC, bl.livestreamDate DESC
    `, params) as any;
    
    // Group by productName
    const productMap = new Map<string, {
      productName: string;
      totalGmv: number;
      totalItemsSold: number;
      totalImpressions: number;
      totalClicks: number;
      avgUnitPrice: number;
      livestreamCount: number;
      history: Array<{
        date: string;
        streamerName: string;
        livestreamId: number;
        gmv: number;
        itemsSold: number;
        unitPrice: number;
        impressions: number;
        clicks: number;
        ctr: string;
        ctor: string;
      }>;
    }>();
    
    for (const row of rows) {
      const name = row.productName;
      if (!productMap.has(name)) {
        productMap.set(name, {
          productName: name,
          totalGmv: 0,
          totalItemsSold: 0,
          totalImpressions: 0,
          totalClicks: 0,
          avgUnitPrice: 0,
          livestreamCount: 0,
          history: [],
        });
      }
      const product = productMap.get(name)!;
      const gmv = Number(row.directGmv || row.grossRevenue || 0);
      const itemsSold = Number(row.itemsSold || 0);
      const impressions = Number(row.productImpressions || 0);
      const clicks = Number(row.productClicks || 0);
      const unitPrice = Number(row.unitPrice || 0);
      
      product.totalGmv += gmv;
      product.totalItemsSold += itemsSold;
      product.totalImpressions += impressions;
      product.totalClicks += clicks;
      product.livestreamCount++;
      
      product.history.push({
        date: row.livestreamDate ? new Date(row.livestreamDate).toISOString() : '',
        streamerName: row.streamerName || '',
        livestreamId: row.livestreamId,
        gmv,
        itemsSold,
        unitPrice,
        impressions,
        clicks,
        ctr: row.ctr || '',
        ctor: row.ctor || '',
      });
    }
    
    // Calculate avg unit price and anomaly detection
    const results = Array.from(productMap.values()).map(p => {
      const pricesWithValues = p.history.filter(h => h.unitPrice > 0);
      p.avgUnitPrice = pricesWithValues.length > 0 
        ? Math.round(pricesWithValues.reduce((sum, h) => sum + h.unitPrice, 0) / pricesWithValues.length)
        : 0;
      
      // Anomaly detection: compare last 7 days vs prior 7 days
      const sortedHistory = [...p.history].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      const recent = sortedHistory.filter(h => new Date(h.date) >= sevenDaysAgo);
      const prior = sortedHistory.filter(h => {
        const d = new Date(h.date);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      });
      
      let impressionSpike = false;
      let clickSpike = false;
      let highImpLowSales = false;
      
      if (recent.length > 0 && prior.length > 0) {
        const recentAvgImp = recent.reduce((s, h) => s + h.impressions, 0) / recent.length;
        const priorAvgImp = prior.reduce((s, h) => s + h.impressions, 0) / prior.length;
        const recentAvgClicks = recent.reduce((s, h) => s + h.clicks, 0) / recent.length;
        const priorAvgClicks = prior.reduce((s, h) => s + h.clicks, 0) / prior.length;
        
        // >50% increase = spike
        if (priorAvgImp > 0 && recentAvgImp > priorAvgImp * 1.5) impressionSpike = true;
        if (priorAvgClicks > 0 && recentAvgClicks > priorAvgClicks * 1.5) clickSpike = true;
      }
      
      // High impressions but low GMV (top 30% impressions but bottom 30% GMV conversion)
      if (p.totalImpressions > 1000 && p.totalItemsSold > 0) {
        const conversionRate = p.totalGmv / p.totalImpressions;
        if (conversionRate < 0.5) highImpLowSales = true; // Less than ¥0.5 GMV per impression
      }
      
      return { ...p, impressionSpike, clickSpike, highImpLowSales };
    });
    
    // Sort by total GMV descending
    results.sort((a, b) => b.totalGmv - a.totalGmv);
    
    return results;
  }),

  // ========== CSV Import History with Download ==========
  getAllImportHistory: protectedProcedure.input(z.object({
    brandId: z.number().optional(),
  })).query(async ({ input }) => {
    const pool = getPool();
    
    let query = `
      SELECT 
        cih.id,
        cih.livestreamId,
        cih.fileName,
        cih.productCount,
        cih.totalGmv,
        cih.importedByName,
        cih.createdAt,
        cih.fileUrl,
        bl.livestreamDate,
        bl.streamerName,
        bl.brandId
      FROM csv_import_history cih
      JOIN brand_livestreams bl ON cih.livestreamId = bl.id
    `;
    const params: any[] = [];
    if (input.brandId) {
      query += ' WHERE bl.brandId = ?';
      params.push(input.brandId);
    }
    query += ' ORDER BY cih.createdAt DESC';
    
    try {
      const [rows] = await pool.query(query, params) as any;
      return rows;
    } catch (e: any) {
      // fileUrl column might not exist yet - fallback without it
      const fallbackQuery = `
        SELECT 
          cih.id,
          cih.livestreamId,
          cih.fileName,
          cih.productCount,
          cih.totalGmv,
          cih.importedByName,
          cih.createdAt,
          NULL as fileUrl,
          bl.livestreamDate,
          bl.streamerName,
          bl.brandId
        FROM csv_import_history cih
        JOIN brand_livestreams bl ON cih.livestreamId = bl.id
        ${input.brandId ? 'WHERE bl.brandId = ?' : ''}
        ORDER BY cih.createdAt DESC
      `;
      const [rows] = await pool.query(fallbackQuery, params) as any;
      return rows;
    }
  }),

  // ========== Daily Performance View (日別ビュー) ==========
  getDailyPerformanceView: protectedProcedure.input(z.object({
    brandId: z.number().optional(),
    streamerName: z.string().optional(),
  })).query(async ({ input }) => {
    const pool = getPool();
    let where = '1=1';
    const params: any[] = [];
    if (input.brandId) {
      where += ' AND bl.brandId = ?';
      params.push(input.brandId);
    }
    if (input.streamerName) {
      where += ' AND TRIM(bl.streamerName) = ?';
      params.push(input.streamerName.trim());
    }
    
    // Group by livestream (each livestream = one date + streamer combo)
    const [rows] = await pool.query(`
      SELECT 
        bl.id as livestreamId,
        bl.livestreamDate,
        bl.streamerName,
        bl.brandId,
        SUM(lp.directGmv) as totalGmv,
        SUM(lp.itemsSold) as totalItems,
        SUM(lp.productImpressions) as totalImpressions,
        SUM(lp.productClicks) as totalClicks,
        COUNT(DISTINCT lp.productName) as productCount
      FROM livestream_products lp
      JOIN brand_livestreams bl ON lp.livestreamId = bl.id
      WHERE ${where}
      GROUP BY bl.id
      ORDER BY bl.livestreamDate DESC
    `, params) as any;
    
    return rows.map((r: any) => ({
      livestreamId: r.livestreamId,
      date: r.livestreamDate ? new Date(r.livestreamDate).toISOString() : '',
      streamerName: r.streamerName || '',
      brandId: r.brandId,
      totalGmv: Number(r.totalGmv || 0),
      totalItems: Number(r.totalItems || 0),
      totalImpressions: Number(r.totalImpressions || 0),
      totalClicks: Number(r.totalClicks || 0),
      productCount: Number(r.productCount || 0),
    }));
  }),

  // ========== Get unique streamer names for filter ==========
  getStreamerNames: protectedProcedure.query(async () => {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT DISTINCT TRIM(streamerName) as name, COUNT(*) as count
      FROM brand_livestreams
      WHERE streamerName IS NOT NULL AND streamerName != ''
      GROUP BY TRIM(streamerName)
      ORDER BY count DESC
    `) as any;
    return rows.map((r: any) => ({ name: r.name, count: Number(r.count) }));
  }),

  // ========== Daily View Detail (products for a specific livestream) ==========
  getDailyViewProducts: protectedProcedure.input(z.object({
    livestreamId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        lp.productName,
        lp.directGmv,
        lp.itemsSold,
        lp.productImpressions,
        lp.productClicks,
        lp.ctr,
        lp.ctor,
        lp.unitPrice
      FROM livestream_products lp
      WHERE lp.livestreamId = ?
      ORDER BY lp.directGmv DESC
    `, [input.livestreamId]) as any;
    
    return rows.map((r: any) => ({
      productName: r.productName,
      gmv: Number(r.directGmv || 0),
      itemsSold: Number(r.itemsSold || 0),
      impressions: Number(r.productImpressions || 0),
      clicks: Number(r.productClicks || 0),
      ctr: r.ctr || '',
      ctor: r.ctor || '',
      unitPrice: Number(r.unitPrice || 0),
    }));
  }),

  // ========== Brand Performance Summary (for 主播選品) ==========
  getBrandPerformanceSummary: protectedProcedure.input(z.object({
    brandName: z.string(),
  })).query(async ({ input }) => {
    const pool = getPool();
    const searchTerm = `%${input.brandName.trim()}%`;
    const [rows] = await pool.query(`
      SELECT 
        lp.productName,
        lp.directGmv,
        lp.grossRevenue,
        lp.itemsSold,
        lp.productImpressions,
        lp.productClicks,
        lp.ctr,
        lp.ctor,
        lp.unitPrice,
        bl.livestreamDate,
        bl.streamerName
      FROM livestream_products lp
      JOIN brand_livestreams bl ON lp.livestreamId = bl.id
      WHERE lp.productName LIKE ?
      ORDER BY bl.livestreamDate DESC
      LIMIT 500
    `, [searchTerm]) as any;
    if (rows.length === 0) return { found: false, products: [], summary: null };
    const productMap = new Map<string, {
      productName: string;
      totalGmv: number;
      totalSales: number;
      totalImpressions: number;
      totalClicks: number;
      streamCount: number;
      avgUnitPrice: number;
      lastStreamDate: string;
    }>();
    let totalGmv = 0, totalSales = 0, totalImpressions = 0, totalClicks = 0, totalStreams = 0;
    for (const row of rows) {
      const name = row.productName;
      const gmv = Number(row.directGmv || row.grossRevenue || 0);
      const sales = Number(row.itemsSold || 0);
      const imp = Number(row.productImpressions || 0);
      const clicks = Number(row.productClicks || 0);
      totalGmv += gmv;
      totalSales += sales;
      totalImpressions += imp;
      totalClicks += clicks;
      totalStreams++;
      if (!productMap.has(name)) {
        productMap.set(name, {
          productName: name, totalGmv: 0, totalSales: 0, totalImpressions: 0,
          totalClicks: 0, streamCount: 0, avgUnitPrice: 0, lastStreamDate: '',
        });
      }
      const p = productMap.get(name)!;
      p.totalGmv += gmv;
      p.totalSales += sales;
      p.totalImpressions += imp;
      p.totalClicks += clicks;
      p.streamCount++;
      if (!p.lastStreamDate || new Date(row.livestreamDate) > new Date(p.lastStreamDate)) {
        p.lastStreamDate = row.livestreamDate ? new Date(row.livestreamDate).toISOString() : '';
      }
      if (Number(row.unitPrice) > 0) p.avgUnitPrice = Number(row.unitPrice);
    }
    const products = Array.from(productMap.values()).sort((a, b) => b.totalGmv - a.totalGmv).slice(0, 20);
    return {
      found: true,
      summary: { totalGmv, totalSales, totalImpressions, totalClicks, totalStreams,
        avgCtr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0',
      },
      products,
    };
  }),

  // ========== Add fileUrl column migration ==========
  migrateAddFileUrl: protectedProcedure.mutation(async () => {
    const pool = getPool();
    try {
      await pool.query(`ALTER TABLE csv_import_history ADD COLUMN fileUrl VARCHAR(500) DEFAULT NULL`);
      return { success: true, message: 'fileUrl column added' };
    } catch (e: any) {
      if (e.message.includes('Duplicate column')) {
        return { success: true, message: 'fileUrl column already exists' };
      }
      return { success: false, message: e.message };
    }
  }),

  migrateAddTags: protectedProcedure.mutation(async () => {
    const pool = getPool();
    try {
      await pool.query(`ALTER TABLE selection_products ADD COLUMN tags JSON DEFAULT NULL AFTER supplierContact`);
      return { success: true, message: 'tags column added' };
    } catch (e: any) {
      if (e.message.includes('Duplicate column')) {
        return { success: true, message: 'tags column already exists' };
      }
      return { success: false, message: e.message };
    }
  }),
});
