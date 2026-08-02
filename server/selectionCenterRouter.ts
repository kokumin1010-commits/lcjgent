import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import mysql from "mysql2/promise";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { jwtVerify } from "jose";
import { ENV } from "./_core/env";

// Direct mysql2 connection pool (bypass drizzle issues on Railway)
let _pool: mysql.Pool | null = null;
export function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

// Auto-init: create tables on import (runs once at server startup)
(async () => {
  try {
    if (process.env.DATABASE_URL) {
      const pool = mysql.createPool(process.env.DATABASE_URL);
      await pool.query(`CREATE TABLE IF NOT EXISTS product_bundles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bundleName VARCHAR(255) NOT NULL,
        bundleNameCn VARCHAR(255) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        price DECIMAL(10,2) DEFAULT NULL,
        marketPrice DECIMAL(10,2) DEFAULT NULL,
        stock INT DEFAULT 0,
        images JSON DEFAULT NULL,
        status ENUM('draft','online','offline') DEFAULT 'draft',
        createdBy INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt TIMESTAMP DEFAULT NULL
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS bundle_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bundleId INT NOT NULL,
        productId INT DEFAULT 0,
        productName VARCHAR(500) DEFAULT NULL,
        quantity INT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bundle (bundleId),
        INDEX idx_product (productId)
      )`);
      console.log('[SelectionCenter] product_bundles & bundle_items tables ensured');
      await pool.end();
    }
  } catch (e: any) {
    console.log('[SelectionCenter] Auto-init tables skipped:', e.message);
  }
})();

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
      `CREATE TABLE IF NOT EXISTS product_bundles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bundleName VARCHAR(255) NOT NULL,
        bundleNameCn VARCHAR(255) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        price DECIMAL(10,2) DEFAULT NULL,
        marketPrice DECIMAL(10,2) DEFAULT NULL,
        stock INT DEFAULT 0,
        images JSON DEFAULT NULL,
        status ENUM('draft','online','offline') DEFAULT 'draft',
        createdBy INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt TIMESTAMP DEFAULT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS bundle_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bundleId INT NOT NULL,
        productId INT DEFAULT 0,
        productName VARCHAR(500) DEFAULT NULL,
        quantity INT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bundle (bundleId),
        INDEX idx_product (productId)
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
    // Add historicalLowestPrice column if not exists
    try {
      await pool.query(`ALTER TABLE selection_products ADD COLUMN historicalLowestPrice DECIMAL(10,2) DEFAULT NULL`);
      results.push('OK: added historicalLowestPrice column');
    } catch (e: any) {
      if (!e.message.includes('Duplicate column')) results.push(`INFO: historicalLowestPrice: ${e.message}`);
    }
    // Add discountRate column if not exists
    try {
      await pool.query(`ALTER TABLE selection_products ADD COLUMN discountRate DECIMAL(5,2) DEFAULT NULL`);
      results.push('OK: added discountRate column');
    } catch (e: any) {
      if (!e.message.includes('Duplicate column')) results.push(`INFO: discountRate: ${e.message}`);
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
      const [rows] = await pool.query('SELECT id, name, nameCn, parentId, sortOrder, createdAt, updatedAt FROM selection_categories ORDER BY sortOrder ASC');
      return rows;
    } catch (e: any) {
      // Fallback if nameCn column doesn't exist yet
      if (e.message?.includes('Unknown column') && e.message?.includes('nameCn')) {
        const pool = getPool();
        const [rows] = await pool.query('SELECT id, name, NULL as nameCn, parentId, sortOrder, createdAt, updatedAt FROM selection_categories ORDER BY sortOrder ASC');
        return rows;
      }
      console.error('[getCategories] Error:', e.message, e.code, e.errno);
      throw new Error(`getCategories failed: ${e.message} | code=${e.code} | errno=${e.errno}`);
    }
  }),

  createCategory: protectedProcedure.input(z.object({
    name: z.string(),
    nameCn: z.string().optional(),
    parentId: z.number().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO selection_categories (name, nameCn, parentId, sortOrder) VALUES (?, ?, ?, ?)',
      [input.name, input.nameCn || null, input.parentId || null, input.sortOrder || 0]
    ) as any;
    return { id: result.insertId };
  }),

  updateCategory: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    nameCn: z.string().nullable().optional(),
    parentId: z.number().nullable().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const { id, ...data } = input;
    const setClauses: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (setClauses.length === 0) return { success: true };
    params.push(id);
    await pool.query(`UPDATE selection_categories SET ${setClauses.join(', ')} WHERE id = ?`, params);
    return { success: true };
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
    productNameCn: z.string().optional(),
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
    selfOperated: z.number().optional(),
    purchasePrice: z.string().optional(),
    shippingFee: z.string().optional(),
    platformFee: z.string().optional(),
    deliveryTime: z.string().optional(),
    suggestedPrice: z.string().optional(),
    mechanism: z.string().optional(),
    historicalLowestPrice: z.string().optional(),
    discountRate: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const totalCost = (Number(input.purchasePrice) || 0) + (Number(input.shippingFee) || 0) + (Number(input.platformFee) || 0);
    try {
      const [result] = await pool.query(
        `INSERT INTO selection_products (productName, productNameCn, productId, barcode, brandName, brandId, categoryId, price, marketPrice, costPrice, commissionType, commissionValue, images, videos, productLink, sellingPoints, description, stock, supplierContact, talentExclusive, exclusiveLiverIds, tags, selfOperated, purchasePrice, shippingFee, platformFee, totalCost, deliveryTime, suggestedPrice, mechanism, historicalLowestPrice, discountRate, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [input.productName, input.productNameCn || null, input.productId || null, input.barcode || null, input.brandName, input.brandId || null, input.categoryId || null, input.price || null, input.marketPrice || null, input.costPrice || null, input.commissionType || 'percentage', input.commissionValue || null, input.images ? JSON.stringify(input.images) : null, input.videos ? JSON.stringify(input.videos) : null, input.productLink || null, input.sellingPoints || null, input.description || null, input.stock || 0, input.supplierContact || null, input.talentExclusive || 0, input.exclusiveLiverIds ? JSON.stringify(input.exclusiveLiverIds) : null, input.tags ? JSON.stringify(input.tags) : null, input.selfOperated || 0, input.purchasePrice || null, input.shippingFee || null, input.platformFee || null, totalCost > 0 ? String(totalCost) : null, input.deliveryTime || null, input.suggestedPrice || null, input.mechanism || null, input.historicalLowestPrice || null, input.discountRate || null, (ctx.user as any)?.id || 0]
      ) as any;
      return { id: result.insertId };
    } catch (e: any) {
      // Fallback: if discountRate or historicalLowestPrice column doesn't exist, add it and retry
      if (e.message?.includes('Unknown column') && (e.message?.includes('discountRate') || e.message?.includes('historicalLowestPrice'))) {
        console.warn('[createProduct] Adding missing columns and retrying');
        try { await pool.query(`ALTER TABLE selection_products ADD COLUMN historicalLowestPrice DECIMAL(10,2) DEFAULT NULL`); } catch (_) {}
        try { await pool.query(`ALTER TABLE selection_products ADD COLUMN discountRate DECIMAL(5,2) DEFAULT NULL`); } catch (_) {}
        const [result] = await pool.query(
          `INSERT INTO selection_products (productName, productNameCn, productId, barcode, brandName, brandId, categoryId, price, marketPrice, costPrice, commissionType, commissionValue, images, videos, productLink, sellingPoints, description, stock, supplierContact, talentExclusive, exclusiveLiverIds, tags, selfOperated, purchasePrice, shippingFee, platformFee, totalCost, deliveryTime, suggestedPrice, mechanism, historicalLowestPrice, discountRate, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.productName, input.productNameCn || null, input.productId || null, input.barcode || null, input.brandName, input.brandId || null, input.categoryId || null, input.price || null, input.marketPrice || null, input.costPrice || null, input.commissionType || 'percentage', input.commissionValue || null, input.images ? JSON.stringify(input.images) : null, input.videos ? JSON.stringify(input.videos) : null, input.productLink || null, input.sellingPoints || null, input.description || null, input.stock || 0, input.supplierContact || null, input.talentExclusive || 0, input.exclusiveLiverIds ? JSON.stringify(input.exclusiveLiverIds) : null, input.tags ? JSON.stringify(input.tags) : null, input.selfOperated || 0, input.purchasePrice || null, input.shippingFee || null, input.platformFee || null, totalCost > 0 ? String(totalCost) : null, input.deliveryTime || null, input.suggestedPrice || null, input.mechanism || null, input.historicalLowestPrice || null, input.discountRate || null, (ctx.user as any)?.id || 0]
        ) as any;
        return { id: result.insertId };
      }
      // Fallback: if other new columns don't exist yet, use only the original base columns
      if (e.message?.includes('Unknown column')) {
        console.warn('[createProduct] Fallback: inserting with base columns only due to:', e.message);
        const [result] = await pool.query(
          `INSERT INTO selection_products (productName, barcode, brandName, brandId, categoryId, price, marketPrice, costPrice, commissionType, commissionValue, images, videos, productLink, sellingPoints, description, stock, supplierContact, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.productName, input.barcode || null, input.brandName, input.brandId || null, input.categoryId || null, input.price || null, input.marketPrice || null, input.costPrice || null, input.commissionType || 'percentage', input.commissionValue || null, input.images ? JSON.stringify(input.images) : null, input.videos ? JSON.stringify(input.videos) : null, input.productLink || null, input.sellingPoints || null, input.description || null, input.stock || 0, input.supplierContact || null, (ctx.user as any)?.id || 0]
        ) as any;
        return { id: result.insertId };
      }
      throw e;
    }
  }),

  updateProduct: protectedProcedure.input(z.object({
    id: z.number(),
    productName: z.string().optional(),
    productNameCn: z.string().nullable().optional(),
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
    selfOperated: z.number().optional(),
    purchasePrice: z.string().nullable().optional(),
    shippingFee: z.string().nullable().optional(),
    platformFee: z.string().nullable().optional(),
    deliveryTime: z.string().nullable().optional(),
    suggestedPrice: z.string().nullable().optional(),
    mechanism: z.string().nullable().optional(),
    historicalLowestPrice: z.string().nullable().optional(),
    discountRate: z.string().nullable().optional(),
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
    // Auto-calculate totalCost if any cost component is provided
    if (data.purchasePrice !== undefined || data.shippingFee !== undefined || data.platformFee !== undefined) {
      const totalCost = (Number(data.purchasePrice) || 0) + (Number(data.shippingFee) || 0) + (Number(data.platformFee) || 0);
      setClauses.push('totalCost = ?');
      params.push(totalCost > 0 ? String(totalCost) : null);
    }
    if (setClauses.length === 0) return { success: true };
    params.push(id);
    try {
      await pool.query(`UPDATE selection_products SET ${setClauses.join(', ')} WHERE id = ?`, params);
    } catch (e: any) {
      if (e.message?.includes('Unknown column') && (e.message?.includes('historicalLowestPrice') || e.message?.includes('discountRate'))) {
        // Auto-add columns and retry
        try { await pool.query(`ALTER TABLE selection_products ADD COLUMN historicalLowestPrice DECIMAL(10,2) DEFAULT NULL`); } catch (_) {}
        try { await pool.query(`ALTER TABLE selection_products ADD COLUMN discountRate DECIMAL(5,2) DEFAULT NULL`); } catch (_) {}
        await pool.query(`UPDATE selection_products SET ${setClauses.join(', ')} WHERE id = ?`, params);
      } else {
        throw e;
      }
    }
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
    liveDate: z.string().optional(),
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
    
    // Fetch manual historicalLowestPrice from selection_products
    const productNames = results.map(r => r.productName);
    let manualPriceMap = new Map<string, number>();
    let productIdMap = new Map<string, number>();
    if (productNames.length > 0) {
      try {
        const [spRows] = await pool.query(
          `SELECT id, productName, historicalLowestPrice FROM selection_products WHERE productName IN (${productNames.map(() => '?').join(',')}) AND deletedAt IS NULL`,
          productNames
        ) as any;
        for (const row of spRows) {
          if (row.historicalLowestPrice) {
            manualPriceMap.set(row.productName, Number(row.historicalLowestPrice));
          }
          if (!productIdMap.has(row.productName)) {
            productIdMap.set(row.productName, row.id);
          }
        }
      } catch (e) { /* ignore if column doesn't exist yet */ }
    }
    
    return results.map(r => ({
      ...r,
      manualLowestPrice: manualPriceMap.get(r.productName) || null,
      selectionProductId: productIdMap.get(r.productName) || null,
    }));
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

  // AI画像認識で商品情報を自動抽出
  analyzeProductImage: protectedProcedure
    .input(z.object({
      base64Data: z.string(),
      mimeType: z.string().default('image/jpeg'),
    }))
    .mutation(async ({ input }) => {
      const { base64Data, mimeType } = input;
      const imageUrl = `data:${mimeType};base64,${base64Data}`;

      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `あなたは商品提案書・商品手卡の画像を分析する専門家です。\n画像から以下の情報を正確に抽出してJSON形式で返してください。\n情報が見つからない場合はnullを返してください。\n\n【重要なルール】\n1. 商品名は画像に記載されている原文そのまま（日本語・中国語・英語いずれも）を抽出すること。翻訳しないこと。\n2. 「通常価格」「定価」「市場価格」→ marketPrice に入れる\n3. 「ライブ配信価格」「配信価格」「ライブ販売価格」「直播价」→ price（販売価格）に入れる\n4. 「仕入価格」「原価」→ costPrice に入れる\n5. 価格は税込表記の数値のみ（円記号・税込表記を除去）\n\n抽出する項目:\n- productName: 製品名（画像に記載の原文そのまま。日本語/中国語/英語いずれもそのまま記載）\n- brandName: ブランド名（原文そのまま）\n- price: ライブ配信価格/販売価格（数値のみ）\n- marketPrice: 通常価格/定価/市場価格（数値のみ）\n- costPrice: 仕入価格（数値のみ）\n- category: 商品カテゴリ（例: LED美顔器、シャンプー、ドライヤー等）\n- stock: 在庫数（数値のみ、「300台以上」→300）\n- sellingPoints: コアセールスポイント（箇条書きをまとめた文章）\n- targetAudience: ターゲット層の説明\n- specifications: 仕様・スペック\n- commissionInfo: ライセンス料/配分率の情報\n- barcode: バーコード/JANコード（あれば）\n- productLink: 商品リンク（あれば）\n- description: 商品の総合説明（ターゲット層+セールスポイントを含む詳細説明）`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "この商品手卡/提案書の画像から商品情報を抽出してください。" },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "product_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                productName: { anyOf: [{ type: "string" }, { type: "null" }], description: "製品名" },
                brandName: { anyOf: [{ type: "string" }, { type: "null" }], description: "ブランド名" },
                price: { anyOf: [{ type: "number" }, { type: "null" }], description: "販売価格" },
                marketPrice: { anyOf: [{ type: "number" }, { type: "null" }], description: "通常価格" },
                costPrice: { anyOf: [{ type: "number" }, { type: "null" }], description: "仕入価格" },
                category: { anyOf: [{ type: "string" }, { type: "null" }], description: "商品カテゴリ" },
                stock: { anyOf: [{ type: "number" }, { type: "null" }], description: "在庫数" },
                sellingPoints: { anyOf: [{ type: "string" }, { type: "null" }], description: "セールスポイント" },
                targetAudience: { anyOf: [{ type: "string" }, { type: "null" }], description: "ターゲット層" },
                specifications: { anyOf: [{ type: "string" }, { type: "null" }], description: "仕様" },
                commissionInfo: { anyOf: [{ type: "string" }, { type: "null" }], description: "佣金情報" },
                barcode: { anyOf: [{ type: "string" }, { type: "null" }], description: "バーコード" },
                productLink: { anyOf: [{ type: "string" }, { type: "null" }], description: "商品リンク" },
                description: { anyOf: [{ type: "string" }, { type: "null" }], description: "商品説明" },
              },
              required: ["productName", "brandName", "price", "marketPrice", "costPrice", "category", "stock", "sellingPoints", "targetAudience", "specifications", "commissionInfo", "barcode", "productLink", "description"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("AI分析に失敗しました。画像を確認してください。");
      }

      try {
        const extracted = JSON.parse(content);
        return { success: true, data: extracted };
      } catch {
        throw new Error("AI応答の解析に失敗しました。");
      }
    }),

  // ========== 品牌管理×样品中心 双方向連携 ==========

  // 1. 特定ブランドのselection_products一覧を取得（品牌管理から样品中心の商品を参照する用）
  getSelectionProductsForBrand: protectedProcedure.input(z.object({
    brandId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, productName, barcode, brandName, brandId, price, marketPrice, costPrice,
              commissionType, commissionValue, images, status, stock, sellingPoints, productLink,
              createdAt
       FROM selection_products
       WHERE brandId = ? AND deletedAt IS NULL
       ORDER BY createdAt DESC`,
      [input.brandId]
    ) as any;
    return rows.map((r: any) => ({
      ...r,
      images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
    }));
  }),

  // 2. 样品中心の商品を品牌管理の商品パフォーマンス（brand_products）に追加する
  addSelectionProductToBrand: protectedProcedure.input(z.object({
    selectionProductId: z.number(),
    brandId: z.number(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    // selection_productsから商品情報を取得
    const [spRows] = await pool.query(
      `SELECT * FROM selection_products WHERE id = ? AND deletedAt IS NULL`,
      [input.selectionProductId]
    ) as any;
    if (spRows.length === 0) {
      throw new Error("样品中心の商品が見つかりません");
    }
    const sp = spRows[0];
    // 既にbrand_productsに同名の商品がないかチェック
    const [existing] = await pool.query(
      `SELECT id FROM brand_products WHERE brandId = ? AND productName = ? AND deletedAt IS NULL`,
      [input.brandId, sp.productName]
    ) as any;
    if (existing.length > 0) {
      throw new Error("この商品は既に品牌管理に登録されています");
    }
    // brand_productsに追加
    const images = sp.images ? (typeof sp.images === 'string' ? JSON.parse(sp.images) : sp.images) : [];
    const [result] = await pool.query(
      `INSERT INTO brand_products (brandId, productName, listPrice, specialPrice, commissionRate, imageUrls, remarks, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        input.brandId,
        sp.productName,
        sp.marketPrice ? Math.round(Number(sp.marketPrice)) : null,
        sp.price ? Math.round(Number(sp.price)) : null,
        sp.commissionValue ? `${sp.commissionValue}%` : null,
        images.length > 0 ? JSON.stringify(images.slice(0, 2)) : null,
        `样品中心から追加 (ID: ${sp.id})`,
      ]
    ) as any;
    return { success: true, brandProductId: result.insertId };
  }),

  // 3. 品牌管理の商品パフォーマンスデータを取得（样品中心から参照する用）
  getBrandProductsForSelection: protectedProcedure.input(z.object({
    brandId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT bp.id, bp.productName, bp.listPrice, bp.specialPrice, bp.commissionRate,
              bp.imageUrls, bp.influencer, bp.createdAt
       FROM brand_products bp
       WHERE bp.brandId = ? AND bp.deletedAt IS NULL
       ORDER BY bp.createdAt DESC`,
      [input.brandId]
    ) as any;
    return rows.map((r: any) => ({
      ...r,
      imageUrls: r.imageUrls ? (typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : r.imageUrls) : [],
    }));
  }),

  // 4. 品牌管理の商品パフォーマンス（ライブ配信実績）を样品中心から参照する
  getBrandLivePerformanceForSelection: protectedProcedure.input(z.object({
    brandId: z.number(),
  })).query(async ({ input }) => {
    const pool = getPool();
    // brand_livestreamsとlivestream_productsから実績データを取得
    const [rows] = await pool.query(
      `SELECT 
        lp.productName,
        SUM(COALESCE(lp.directGmv, lp.grossRevenue, 0)) as totalGmv,
        SUM(COALESCE(lp.itemsSold, 0)) as totalSales,
        SUM(COALESCE(lp.productImpressions, 0)) as totalImpressions,
        SUM(COALESCE(lp.productClicks, 0)) as totalClicks,
        COUNT(*) as streamCount,
        MAX(bl.livestreamDate) as lastStreamDate,
        AVG(lp.unitPrice) as avgUnitPrice
       FROM livestream_products lp
       JOIN brand_livestreams bl ON lp.livestreamId = bl.id
       WHERE bl.brandId = ?
       GROUP BY lp.productName
       ORDER BY totalGmv DESC
       LIMIT 50`,
      [input.brandId]
    ) as any;
    // サマリー計算
    let totalGmv = 0, totalSales = 0, totalImpressions = 0, totalClicks = 0;
    for (const row of rows) {
      totalGmv += Number(row.totalGmv || 0);
      totalSales += Number(row.totalSales || 0);
      totalImpressions += Number(row.totalImpressions || 0);
      totalClicks += Number(row.totalClicks || 0);
    }
    return {
      summary: {
        totalGmv,
        totalSales,
        totalImpressions,
        totalClicks,
        productCount: rows.length,
      },
      products: rows.map((r: any) => ({
        productName: r.productName,
        totalGmv: Number(r.totalGmv || 0),
        totalSales: Number(r.totalSales || 0),
        totalImpressions: Number(r.totalImpressions || 0),
        totalClicks: Number(r.totalClicks || 0),
        streamCount: Number(r.streamCount || 0),
        lastStreamDate: r.lastStreamDate ? new Date(r.lastStreamDate).toISOString() : null,
        avgUnitPrice: Number(r.avgUnitPrice || 0),
      })),
    };
  }),

  // 5. 品牌管理の商品を样品中心に一括インポート
  importBrandProductsToSelection: protectedProcedure.input(z.object({
    brandId: z.number(),
    productIds: z.array(z.number()),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const [bpRows] = await pool.query(
      `SELECT * FROM brand_products WHERE id IN (?) AND brandId = ? AND deletedAt IS NULL`,
      [input.productIds, input.brandId]
    ) as any;
    if (bpRows.length === 0) {
      throw new Error("インポートする商品が見つかりません");
    }
    // ブランド名を取得
    const [brandRows] = await pool.query(
      `SELECT companyName FROM brands WHERE id = ?`,
      [input.brandId]
    ) as any;
    const brandName = brandRows[0]?.companyName || '';
    let imported = 0;
    for (const bp of bpRows) {
      // 既に同名の商品がselection_productsにないかチェック
      const [existing] = await pool.query(
        `SELECT id FROM selection_products WHERE productName = ? AND brandId = ? AND deletedAt IS NULL`,
        [bp.productName, input.brandId]
      ) as any;
      if (existing.length > 0) continue; // スキップ
      const images = bp.imageUrls ? (typeof bp.imageUrls === 'string' ? JSON.parse(bp.imageUrls) : bp.imageUrls) : [];
      await pool.query(
        `INSERT INTO selection_products (productName, brandName, brandId, price, marketPrice, images, status, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, NOW(), NOW())`,
        [
          bp.productName,
          brandName,
          input.brandId,
          bp.specialPrice || bp.listPrice || null,
          bp.listPrice || null,
          images.length > 0 ? JSON.stringify(images) : null,
          (ctx.user as any)?.id || 0,
        ]
      );
      imported++;
    }
    return { success: true, imported, skipped: bpRows.length - imported };
  }),

  // ========== Procurement Management (仕入れ管理) ==========

  getProcurementOrders: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      status: z.enum(['pending', 'ordered', 'received', 'completed', 'cancelled']).optional(),
      year: z.number().optional(),
      month: z.number().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const pool = getPool();
      const filters = input || {};
      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (filters.brandId) {
        where += ' AND brandId = ?';
        params.push(filters.brandId);
      }
      if (filters.status) {
        where += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.year && filters.month) {
        where += ' AND YEAR(orderDate) = ? AND MONTH(orderDate) = ?';
        params.push(filters.year, filters.month);
      } else if (filters.year) {
        where += ' AND YEAR(orderDate) = ?';
        params.push(filters.year);
      }
      const countParams = [...params];
      params.push(filters.limit || 100, filters.offset || 0);
      const [rows] = await pool.query(
        `SELECT * FROM procurement_orders ${where} ORDER BY orderDate DESC, id DESC LIMIT ? OFFSET ?`,
        params
      ) as any;
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM procurement_orders ${where}`,
        countParams
      ) as any;
      return { orders: rows, total: countResult[0]?.total || 0 };
    }),

  createProcurementOrder: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      brandName: z.string(),
      productId: z.number().optional(),
      productName: z.string(),
      quantity: z.number().min(1),
      unitCost: z.number().min(0),
      orderDate: z.string(), // YYYY-MM-DD
      status: z.enum(['pending', 'ordered', 'received', 'completed', 'cancelled']).default('pending'),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const totalCost = input.quantity * input.unitCost;
      const [result] = await pool.query(
        `INSERT INTO procurement_orders (brandId, brandName, productId, productName, quantity, unitCost, totalCost, orderDate, status, memo, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.brandId,
          input.brandName,
          input.productId || null,
          input.productName,
          input.quantity,
          input.unitCost,
          totalCost,
          input.orderDate,
          input.status,
          input.memo || null,
          (ctx.user as any)?.id || 0,
        ]
      ) as any;
      return { success: true, id: result.insertId };
    }),

  updateProcurementOrder: protectedProcedure
    .input(z.object({
      id: z.number(),
      quantity: z.number().min(1).optional(),
      unitCost: z.number().min(0).optional(),
      status: z.enum(['pending', 'ordered', 'received', 'completed', 'cancelled']).optional(),
      memo: z.string().optional(),
      orderDate: z.string().optional(),
      qtyPerOrder: z.number().min(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      // Ensure ENUM includes 'completed'
      try {
        await pool.query(`ALTER TABLE procurement_orders MODIFY COLUMN status ENUM('pending','ordered','received','completed','cancelled') NOT NULL DEFAULT 'pending'`);
      } catch (e) { /* ignore if already updated */ }
      const updates: string[] = [];
      const params: any[] = [];
      if (input.status !== undefined) {
        updates.push('status = ?');
        params.push(input.status);
      }
      if (input.memo !== undefined) {
        updates.push('memo = ?');
        params.push(input.memo);
      }
      if (input.orderDate !== undefined) {
        updates.push('orderDate = ?');
        params.push(input.orderDate);
      }
      if (input.quantity !== undefined) {
        updates.push('quantity = ?');
        params.push(input.quantity);
      }
      if (input.unitCost !== undefined) {
        updates.push('unitCost = ?');
        params.push(input.unitCost);
      }
      if (input.qtyPerOrder !== undefined) {
        updates.push('qtyPerOrder = ?');
        params.push(input.qtyPerOrder);
      }
      // Recalculate quantity (採購数) when qtyPerOrder changes: quantity = itemTotalQty * qtyPerOrder
      if (input.qtyPerOrder !== undefined) {
        const [current2] = await pool.query(
          'SELECT bundleId, quantity, qtyPerOrder FROM procurement_orders WHERE id = ?',
          [input.id]
        ) as any;
        if (current2.length > 0) {
          let itemTotalQty: number;
          if (current2[0].bundleId) {
            // Fukubukuro: sum of bundle_items quantities
            const [bundleItems] = await pool.query(
              'SELECT SUM(quantity) as totalQty FROM bundle_items WHERE bundleId = ?',
              [current2[0].bundleId]
            ) as any;
            itemTotalQty = Number(bundleItems[0]?.totalQty || 0);
          } else {
            // Non-bundle: derive base item qty from current quantity / current qtyPerOrder
            const currentQtyPerOrder = Number(current2[0].qtyPerOrder || 1);
            itemTotalQty = Math.round(Number(current2[0].quantity || 0) / currentQtyPerOrder) || 1;
          }
          const newQty = itemTotalQty * input.qtyPerOrder;
          updates.push('quantity = ?');
          params.push(newQty);
        }
      }
      // Recalculate totalCost if quantity or unitCost changed
      if (input.quantity !== undefined || input.unitCost !== undefined || input.qtyPerOrder !== undefined) {
        // Fetch current values after quantity recalculation
        const [current] = await pool.query(
          'SELECT quantity, unitCost, bundleId, qtyPerOrder FROM procurement_orders WHERE id = ?',
          [input.id]
        ) as any;
        if (current.length > 0) {
          let qty: number;
          if (input.qtyPerOrder !== undefined) {
            // Use the same logic as above
            let itemTotalQty: number;
            if (current[0].bundleId) {
              const [bundleItems] = await pool.query(
                'SELECT SUM(quantity) as totalQty FROM bundle_items WHERE bundleId = ?',
                [current[0].bundleId]
              ) as any;
              itemTotalQty = Number(bundleItems[0]?.totalQty || 0);
            } else {
              const currentQtyPerOrder = Number(current[0].qtyPerOrder || 1);
              itemTotalQty = Math.round(Number(current[0].quantity || 0) / currentQtyPerOrder) || 1;
            }
            qty = itemTotalQty * input.qtyPerOrder;
          } else {
            qty = input.quantity ?? Number(current[0].quantity);
          }
          const cost = input.unitCost ?? Number(current[0].unitCost);
          updates.push('totalCost = ?');
          params.push(qty * cost);
        }
      }
      if (updates.length === 0) return { success: false, message: 'No fields to update' };
      params.push(input.id);
      await pool.query(
        `UPDATE procurement_orders SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      return { success: true };
    }),

  deleteProcurementOrder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query('DELETE FROM procurement_orders WHERE id = ?', [input.id]);
      return { success: true };
    }),

  getProcurementSummary: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const pool = getPool();
      const filters = input || {};
      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (filters.year && filters.month) {
        where += ' AND YEAR(orderDate) = ? AND MONTH(orderDate) = ?';
        params.push(filters.year, filters.month);
      } else if (filters.year) {
        where += ' AND YEAR(orderDate) = ?';
        params.push(filters.year);
      }
      // Brand-level summary
      const [brandSummary] = await pool.query(
        `SELECT brandId, brandName, 
                COUNT(*) as orderCount,
                SUM(totalCost) as totalAmount,
                SUM(quantity) as totalQuantity
         FROM procurement_orders ${where}
         GROUP BY brandId, brandName
         ORDER BY totalAmount DESC`,
        params
      ) as any;
      // Monthly trend
      const [monthlyTrend] = await pool.query(
        `SELECT YEAR(orderDate) as year, MONTH(orderDate) as month,
                SUM(totalCost) as totalAmount,
                COUNT(*) as orderCount,
                SUM(quantity) as totalQuantity
         FROM procurement_orders ${where}
         GROUP BY YEAR(orderDate), MONTH(orderDate)
         ORDER BY year DESC, month DESC
         LIMIT 12`,
        params
      ) as any;
      // Grand total
      const [grandTotal] = await pool.query(
        `SELECT SUM(totalCost) as totalAmount, COUNT(*) as orderCount, SUM(quantity) as totalQuantity
         FROM procurement_orders ${where}`,
        params
      ) as any;
      return {
        brandSummary: brandSummary || [],
        monthlyTrend: monthlyTrend || [],
        grandTotal: grandTotal[0] || { totalAmount: 0, orderCount: 0, totalQuantity: 0 },
      };
    }),

  // ========== Product Cost Management (原価管理) ==========

  // 商品検索（仕入れ用 - ブランド名・商品名で検索）
  searchProductsForProcurement: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      brandId: z.number().optional(),
      brandIds: z.array(z.number()).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let where = 'WHERE sp.deletedAt IS NULL';
      const params: any[] = [];
      if (input.brandIds && input.brandIds.length > 0) {
        where += ` AND sp.brandId IN (${input.brandIds.map(() => '?').join(',')})`;
        params.push(...input.brandIds);
      } else if (input.brandId) {
        where += ' AND sp.brandId = ?';
        params.push(input.brandId);
      }
      if (input.search) {
        where += ' AND (sp.productName LIKE ? OR sp.productNameCn LIKE ? OR sp.brandName LIKE ? OR sp.barcode LIKE ? OR sp.productId LIKE ? OR CAST(sp.id AS CHAR) LIKE ?)';
        params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`);
      }
      params.push(input.limit);
      const [rows] = await pool.query(
        `SELECT sp.id, sp.productName, sp.productNameCn, sp.brandId, sp.brandName, sp.price, sp.purchasePrice, sp.barcode, sp.productId, sp.images
         FROM selection_products sp ${where}
         ORDER BY sp.productName ASC LIMIT ?`,
        params
      ) as any;
      return rows || [];
    }),

  // 原価登録
  registerProductCost: protectedProcedure
    .input(z.object({
      productId: z.number(),
      productName: z.string(),
      brandId: z.number(),
      brandName: z.string(),
      unitCost: z.number().min(0),
      currency: z.string().default('JPY'),
      supplier: z.string().optional(),
      effectiveDate: z.string(), // YYYY-MM-DD
      memo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      // Insert cost history
      await pool.query(
        `INSERT INTO product_cost_history (productId, productName, brandId, brandName, unitCost, currency, supplier, effectiveDate, memo, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.productId,
          input.productName,
          input.brandId,
          input.brandName,
          input.unitCost,
          input.currency,
          input.supplier || null,
          input.effectiveDate,
          input.memo || null,
          (ctx.user as any)?.id || 0,
        ]
      );
      // Also update selection_products.purchasePrice
      try {
        await pool.query(
          `UPDATE selection_products SET purchasePrice = ? WHERE id = ?`,
          [input.unitCost, input.productId]
        );
      } catch (e) {
        // Ignore if column doesn't exist
      }
      return { success: true };
    }),

  // 原価履歴取得
  getProductCostHistory: protectedProcedure
    .input(z.object({
      productId: z.number().optional(),
      brandId: z.number().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const pool = getPool();
      const filters = input || {};
      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (filters.productId) {
        where += ' AND productId = ?';
        params.push(filters.productId);
      }
      if (filters.brandId) {
        where += ' AND brandId = ?';
        params.push(filters.brandId);
      }
      params.push(filters.limit || 50);
      const [rows] = await pool.query(
        `SELECT pch.*, sp.images as productImages FROM product_cost_history pch LEFT JOIN selection_products sp ON pch.productId = sp.id ${where.replace(/WHERE/,'WHERE').replace(/productId/g,'pch.productId').replace(/brandId/g,'pch.brandId')} ORDER BY pch.effectiveDate DESC, pch.id DESC LIMIT ?`,
        params
      ) as any;
      return (rows || []).map((r: any) => {
        let imageUrl = null;
        if (r.productImages) {
          try {
            const imgs = typeof r.productImages === 'string' ? JSON.parse(r.productImages) : r.productImages;
            if (Array.isArray(imgs) && imgs.length > 0) imageUrl = imgs[0];
          } catch {}
        }
        return { ...r, imageUrl, productImages: undefined };
      });
    }),

  // 最新原価取得（商品IDで）
  getLatestProductCost: protectedProcedure
    .input(z.object({
      productId: z.number(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT unitCost FROM product_cost_history WHERE productId = ? ORDER BY effectiveDate DESC, id DESC LIMIT 1`,
        [input.productId]
      ) as any;
      if (rows.length > 0) return { unitCost: Number(rows[0].unitCost) };
      // Fallback to selection_products.purchasePrice
      const [productRows] = await pool.query(
        `SELECT purchasePrice FROM selection_products WHERE id = ?`,
        [input.productId]
      ) as any;
      if (productRows.length > 0 && productRows[0].purchasePrice) {
        return { unitCost: Number(productRows[0].purchasePrice) };
      }
      return { unitCost: 0 };
    }),

  // バッチ発注（複数商品を一括発注）
  createBatchProcurementOrders: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      brandName: z.string(),
      orderDate: z.string(),
      status: z.enum(['pending', 'ordered', 'received', 'completed', 'cancelled']).default('pending'),
      memo: z.string().optional(),
      liveRoom: z.string().optional(),
      shopName: z.string().optional(),
      productLink: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productName: z.string(),
        quantity: z.number().min(0),
        unitCost: z.number().min(0).default(0),
        pendingPaymentQty: z.number().min(0).optional(), // 待支付订单数
        pendingShipQty: z.number().min(0).optional(), // 待发货订单数
        qtyPerOrder: z.number().min(1).optional(), // 每单数量（福利时可能是2）
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      // Ensure new columns exist
      try {
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS liveRoom VARCHAR(100) DEFAULT NULL`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS shopName VARCHAR(255) DEFAULT NULL`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS productLink TEXT DEFAULT NULL`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS orderStatus VARCHAR(100) DEFAULT NULL`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS pendingPaymentQty INT DEFAULT 0`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS pendingShipQty INT DEFAULT 0`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS qtyPerOrder INT DEFAULT 1`);
        await pool.query(`ALTER TABLE procurement_orders MODIFY COLUMN status ENUM('pending','ordered','received','completed','cancelled') NOT NULL DEFAULT 'pending'`);
      } catch (e) { /* columns may already exist */ }
      const results: number[] = [];
      for (const item of input.items) {
        const totalCost = item.quantity * item.unitCost;
        const [result] = await pool.query(
          `INSERT INTO procurement_orders (brandId, brandName, productId, productName, quantity, unitCost, totalCost, orderDate, status, memo, liveRoom, shopName, productLink, pendingPaymentQty, pendingShipQty, qtyPerOrder, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.brandId,
            input.brandName,
            item.productId || null,
            item.productName,
            item.quantity || ((item.pendingPaymentQty || 0) + (item.pendingShipQty || 0)) * (item.qtyPerOrder || 1),
            item.unitCost,
            totalCost,
            input.orderDate,
            input.status,
            input.memo || null,
            input.liveRoom || null,
            input.shopName || null,
            input.productLink || null,
            item.pendingPaymentQty || 0,
            item.pendingShipQty || 0,
            item.qtyPerOrder || 1,
            (ctx.user as any)?.id || 0,
          ]
        ) as any;
        results.push(result.insertId);
      }
      return { success: true, ids: results, count: results.length };
    }),

  // ========== 公開カタログ（ライバー勧誘用） ==========
  // ブランド一覧（商品数付き）- ログイン不要
  getCatalogBrands: publicProcedure.query(async () => {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        sp.brandId,
        sp.brandName,
        COUNT(*) as productCount,
        GROUP_CONCAT(DISTINCT sp.categoryId) as categoryIds
      FROM selection_products sp
      WHERE sp.status = 'online' AND sp.deletedAt IS NULL
      GROUP BY sp.brandId, sp.brandName
      ORDER BY productCount DESC
    `) as any;
    // ブランドロゴも取得
    const brandIds = rows.map((r: any) => r.brandId).filter(Boolean);
    let brandLogos: Record<number, string> = {};
    if (brandIds.length > 0) {
      const [brands] = await pool.query(
        `SELECT id, logoUrl, category, larkCategory FROM brands WHERE id IN (${brandIds.map(() => '?').join(',')})`,
        brandIds
      ) as any;
      for (const b of brands) {
        brandLogos[b.id] = b.logoUrl || '';
      }
    }
    // 同名ブランドを合併（FLORASIS/花西子、栄進製薬/Dietmaruなど表記揺れを統合）
    const normalizeKey = (name: string): string => {
      const n = name.toLowerCase().replace(/[\s\(\)（）/／・]+/g, '');
      // FLORASIS / 花西子 / 玉容花養 系統
      if (n.includes('florasis') || n.includes('花西子') || n.includes('玉容花養')) return 'florasis';
      // 栄進製薬 / Dietmaru / ellecime 系統
      if (n.includes('栄進') || n.includes('dietmaru') || n.includes('ellecime') || n.includes('荣进')) return 'eishin';
      // 方里 / FUNNY / SIINONO 系統
      if (n.includes('方里') || n.includes('funny') || n.includes('siinono') || n.includes('ファンリー')) return 'funny';
      // 星睿肌 / RikaReal / リコアセラム 系統
      if (n.includes('星睿肌') || n.includes('rikareal') || n.includes('リカリアル') || n.includes('リコアセラム') || n.includes('ricoaserum')) return 'rikareal';
      return n;
    };
    const merged: Record<string, { brandIds: number[]; brandName: string; productCount: number; logoUrl: string }> = {};
    for (const r of rows) {
      const key = normalizeKey(r.brandName);
      if (merged[key]) {
        merged[key].brandIds.push(r.brandId);
        merged[key].productCount += Number(r.productCount);
        // ロゴがあるものを優先
        if (!merged[key].logoUrl && brandLogos[r.brandId]) {
          merged[key].logoUrl = brandLogos[r.brandId];
        }
        // 商品数が多い方の名前を使う
        if (Number(r.productCount) > merged[key].productCount - Number(r.productCount)) {
          merged[key].brandName = r.brandName;
        }
      } else {
        merged[key] = {
          brandIds: [r.brandId],
          brandName: r.brandName,
          productCount: Number(r.productCount),
          logoUrl: brandLogos[r.brandId] || '',
        };
      }
    }
    return Object.values(merged)
      .sort((a, b) => b.productCount - a.productCount)
      .map(m => ({
        brandId: m.brandIds[0], // 代表ID
        brandIds: m.brandIds, // 全ID（商品取得用）
        brandName: m.brandName,
        productCount: m.productCount,
        logoUrl: m.logoUrl,
      }));
  }),

  // カタログ商品一覧 - ログイン不要だが、ライバー認証済みなら卸値・報酬率も返す
  getCatalogProducts: publicProcedure.input(z.object({
    brandId: z.number().optional(),
    brandIds: z.array(z.number()).optional(),
    search: z.string().optional(),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
  })).query(async ({ input, ctx }) => {
    const pool = getPool();
    let where = "WHERE sp.status = 'online' AND sp.deletedAt IS NULL";
    const params: any[] = [];
    // brandIds配列対応（合併ブランド用）
    if (input.brandIds && input.brandIds.length > 0) {
      where += ` AND sp.brandId IN (${input.brandIds.map(() => '?').join(',')})`;
      params.push(...input.brandIds);
    } else if (input.brandId) {
      where += ' AND sp.brandId = ?';
      params.push(input.brandId);
    }
    if (input.search) {
      // Split search query by spaces and match each word (AND logic)
      const searchWords = input.search.trim().split(/\s+/).filter(w => w.length > 0);
      if (searchWords.length === 1) {
        where += ' AND (sp.productName LIKE ? OR sp.brandName LIKE ? OR sp.sellingPoints LIKE ?)';
        params.push(`%${searchWords[0]}%`, `%${searchWords[0]}%`, `%${searchWords[0]}%`);
      } else if (searchWords.length > 1) {
        // Each word must match in productName OR brandName OR sellingPoints
        const wordConditions = searchWords.map(() => 
          '(sp.productName LIKE ? OR sp.brandName LIKE ? OR sp.sellingPoints LIKE ?)'
        ).join(' AND ');
        where += ` AND (${wordConditions})`;
        for (const word of searchWords) {
          params.push(`%${word}%`, `%${word}%`, `%${word}%`);
        }
      }
    }
    // 合計件数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM selection_products sp ${where}`,
      params
    ) as any;
    const total = countResult[0]?.total || 0;

    // ライバー認証チェック（トークンがあれば卸値・報酬率も返す）
    let isAuthenticated = false;
    let liverId: number | null = null;
    try {
      const authHeader = (ctx as any).req?.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const secret = new TextEncoder().encode(ENV.cookieSecret);
        const { payload } = await jwtVerify(token, secret);
        if (payload && (payload.type === 'liver' || payload.role === 'admin')) {
          isAuthenticated = true;
          if (payload.liverId) liverId = Number(payload.liverId);
        }
      }
      // 管理者セッションもチェック
      if (!isAuthenticated && (ctx as any).user) {
        isAuthenticated = true;
      }
    } catch {
      // 認証失敗は無視（公開情報のみ返す）
    }

    // 商品一覧
    const selectFields = isAuthenticated
      ? `sp.id, sp.productName, sp.brandName, sp.brandId,
         sp.price, sp.marketPrice, sp.images,
         sp.commissionType, sp.commissionValue,
         sp.purchasePrice,
         sp.sellingPoints, sp.productLink, sp.stock,
         sp.categoryId`
      : `sp.id, sp.productName, sp.brandName, sp.brandId,
         sp.price, sp.marketPrice, sp.images,
         sp.sellingPoints, sp.productLink, sp.stock,
         sp.categoryId`;

    const [products] = await pool.query(
      `SELECT ${selectFields}
      FROM selection_products sp
      ${where}
      ORDER BY sp.createdAt DESC
      LIMIT ? OFFSET ?`,
      [...params, input.limit, input.offset]
    ) as any;
    return { products, total, isAuthenticated, liverId };
  }),

  // カタログ統計情報（公開）- ログイン不要
  getCatalogStats: publicProcedure.query(async () => {
    const pool = getPool();
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as totalProducts,
        COUNT(DISTINCT categoryId) as totalCategories
      FROM selection_products
      WHERE status = 'online' AND deletedAt IS NULL
    `) as any;
    // ブランド数は合併後の数をカウント（getCatalogBrandsと同じロジック）
    const [brandRows] = await pool.query(`
      SELECT brandName FROM selection_products
      WHERE status = 'online' AND deletedAt IS NULL
      GROUP BY brandName
    `) as any;
    const normalizeKey = (name: string): string => {
      const n = name.toLowerCase().replace(/[\s\(\)（）/／・]+/g, '');
      if (n.includes('florasis') || n.includes('花西子')) return 'florasis';
      if (n.includes('栄進') || n.includes('dietmaru')) return 'eishin';
      return n;
    };
    const uniqueBrands = new Set(brandRows.map((r: any) => normalizeKey(r.brandName)));
    return {
      totalProducts: Number(stats[0]?.totalProducts || 0),
      totalBrands: uniqueBrands.size,
      totalCategories: Number(stats[0]?.totalCategories || 0),
    };
  }),

  // 原価履歴削除
  deleteProductCostHistory: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query(`DELETE FROM product_cost_history WHERE id = ?`, [input.id]);
      return { success: true };
    }),

  // 原価履歴更新
  updateProductCostHistory: protectedProcedure
    .input(z.object({
      id: z.number(),
      unitCost: z.number().min(0).optional(),
      effectiveDate: z.string().optional(),
      memo: z.string().optional(),
      supplier: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      const updates: string[] = [];
      const params: any[] = [];
      if (input.unitCost !== undefined) { updates.push('unitCost = ?'); params.push(input.unitCost); }
      if (input.effectiveDate !== undefined) { updates.push('effectiveDate = ?'); params.push(input.effectiveDate); }
      if (input.memo !== undefined) { updates.push('memo = ?'); params.push(input.memo); }
      if (input.supplier !== undefined) { updates.push('supplier = ?'); params.push(input.supplier); }
      if (updates.length === 0) return { success: false };
      params.push(input.id);
      await pool.query(
        `UPDATE product_cost_history SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      // Also update selection_products.purchasePrice if unitCost changed
      if (input.unitCost !== undefined) {
        try {
          const [rows] = await pool.query(`SELECT productId FROM product_cost_history WHERE id = ?`, [input.id]) as any;
          if (rows.length > 0) {
            await pool.query(`UPDATE selection_products SET purchasePrice = ? WHERE id = ?`, [input.unitCost, rows[0].productId]);
          }
        } catch (e) { /* ignore */ }
      }
      return { success: true };
    }),

  // ========== Bundle (套组) Management ==========
  getBundles: protectedProcedure.input(z.object({
    search: z.string().optional(),
    status: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    const pool = getPool();
    let where = 'WHERE pb.deletedAt IS NULL';
    const params: any[] = [];
    if (input?.search) {
      where += ' AND (pb.bundleName LIKE ? OR pb.bundleNameCn LIKE ?)';
      params.push(`%${input.search}%`, `%${input.search}%`);
    }
    if (input?.status && input.status !== 'all') {
      where += ' AND pb.status = ?';
      params.push(input.status);
    }
    const [rows] = await pool.query(`SELECT pb.* FROM product_bundles pb ${where} ORDER BY pb.createdAt DESC`, params) as any;
    const bundles = [];
    for (const bundle of rows) {
      const [items] = await pool.query(
        `SELECT bi.*, COALESCE(sp.productName, bi.productName) as productName, sp.productNameCn, sp.price, sp.images, sp.brandName, sp.stock as productStock
         FROM bundle_items bi LEFT JOIN selection_products sp ON bi.productId = sp.id WHERE bi.bundleId = ?`,
        [bundle.id]
      ) as any;
      bundles.push({ ...bundle, items });
    }
    return bundles;
  }),

  getBundleById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM product_bundles WHERE id = ? AND deletedAt IS NULL`, [input.id]) as any;
    if (!rows[0]) return null;
    const [items] = await pool.query(
      `SELECT bi.*, COALESCE(sp.productName, bi.productName) as productName, sp.productNameCn, sp.price, sp.images, sp.brandName, sp.stock as productStock
       FROM bundle_items bi LEFT JOIN selection_products sp ON bi.productId = sp.id WHERE bi.bundleId = ?`,
      [input.id]
    ) as any;
    return { ...rows[0], items };
  }),

  createBundle: protectedProcedure.input(z.object({
    bundleName: z.string(),
    bundleNameCn: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    marketPrice: z.number().optional(),
    stock: z.number().optional(),
    images: z.array(z.string()).optional(),
    status: z.enum(['draft', 'online', 'offline']).optional(),
    items: z.array(z.object({ productId: z.number(), quantity: z.number().default(1) })),
  })).mutation(async ({ input, ctx }) => {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO product_bundles (bundleName, bundleNameCn, description, price, marketPrice, stock, images, status, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.bundleName, input.bundleNameCn || null, input.description || null, input.price || null, input.marketPrice || null, input.stock || 0, JSON.stringify(input.images || []), input.status || 'draft', (ctx.user as any)?.id || 0]
    ) as any;
    const bundleId = result.insertId;
    for (const item of input.items) {
      await pool.query(`INSERT INTO bundle_items (bundleId, productId, quantity) VALUES (?, ?, ?)`, [bundleId, item.productId, item.quantity]);
    }
    return { id: bundleId };
  }),

  updateBundle: protectedProcedure.input(z.object({
    id: z.number(),
    bundleName: z.string().optional(),
    bundleNameCn: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    marketPrice: z.number().optional(),
    stock: z.number().optional(),
    images: z.array(z.string()).optional(),
    status: z.enum(['draft', 'online', 'offline']).optional(),
    items: z.array(z.object({ productId: z.number(), quantity: z.number().default(1) })).optional(),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const updates: string[] = [];
    const params: any[] = [];
    if (input.bundleName !== undefined) { updates.push('bundleName = ?'); params.push(input.bundleName); }
    if (input.bundleNameCn !== undefined) { updates.push('bundleNameCn = ?'); params.push(input.bundleNameCn); }
    if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
    if (input.price !== undefined) { updates.push('price = ?'); params.push(input.price); }
    if (input.marketPrice !== undefined) { updates.push('marketPrice = ?'); params.push(input.marketPrice); }
    if (input.stock !== undefined) { updates.push('stock = ?'); params.push(input.stock); }
    if (input.images !== undefined) { updates.push('images = ?'); params.push(JSON.stringify(input.images)); }
    if (input.status !== undefined) { updates.push('status = ?'); params.push(input.status); }
    if (updates.length > 0) {
      params.push(input.id);
      await pool.query(`UPDATE product_bundles SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    if (input.items !== undefined) {
      await pool.query(`DELETE FROM bundle_items WHERE bundleId = ?`, [input.id]);
      for (const item of input.items) {
        await pool.query(`INSERT INTO bundle_items (bundleId, productId, quantity) VALUES (?, ?, ?)`, [input.id, item.productId, item.quantity]);
      }
    }
    return { success: true };
  }),

  deleteBundle: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const pool = getPool();
    await pool.query(`UPDATE product_bundles SET deletedAt = NOW() WHERE id = ?`, [input.id]);
    return { success: true };
  }),

  getBundlesForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT pb.id, pb.bundleName, pb.bundleNameCn, pb.price, pb.status, bi.quantity
       FROM bundle_items bi JOIN product_bundles pb ON bi.bundleId = pb.id
       WHERE bi.productId = ? AND pb.deletedAt IS NULL`,
      [input.productId]
    ) as any;
    return rows;
  }),

  getOnlineBundles: publicProcedure.query(async () => {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT pb.* FROM product_bundles pb WHERE pb.status = 'online' AND pb.deletedAt IS NULL ORDER BY pb.createdAt DESC`
    ) as any;
    const bundles = [];
    for (const bundle of rows) {
      const [items] = await pool.query(
        `SELECT bi.*, COALESCE(sp.productName, bi.productName) as productName, sp.productNameCn, sp.price, sp.images, sp.brandName
         FROM bundle_items bi LEFT JOIN selection_products sp ON bi.productId = sp.id WHERE bi.bundleId = ?`,
        [bundle.id]
      ) as any;
      bundles.push({ ...bundle, items });
    }
    return bundles;
  }),

  // ========== 福袋識別機能 ==========
  // テキスト解析: 福袋テキストを行ごとに分割し、selection_productsとマッチング
  parseFukubukuroText: protectedProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      const lines = input.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      // 1行目が「福袋」なら除外
      const productLines = lines[0]?.includes('福袋') ? lines.slice(1) : lines;
      const results: Array<{
        inputName: string;
        matched: boolean;
        product?: { id: number; productName: string; brandId: number; brandName: string; price: number | null; images: string | null };
      }> = [];
      for (const name of productLines) {
        if (!name) continue;
        // LIKE検索でマッチング
        const [rows] = await pool.query(
          `SELECT id, productName, brandId, brandName, price, images FROM selection_products WHERE deletedAt IS NULL AND (productName LIKE ? OR productNameCn LIKE ?) LIMIT 1`,
          [`%${name}%`, `%${name}%`]
        ) as any;
        if (rows.length > 0) {
          results.push({ inputName: name, matched: true, product: rows[0] });
        } else {
          results.push({ inputName: name, matched: false });
        }
      }
      return { items: results, totalLines: productLines.length };
    }),

  // 福袋発注作成: bundle + bundle_items + procurement_order(bundleId付き)を一括作成
  createFukubukuroOrder: protectedProcedure
    .input(z.object({
      bundleName: z.string(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productName: z.string(),
        quantity: z.number().default(1),
      })),
      orderDate: z.string(),
      status: z.enum(['pending', 'ordered', 'received', 'completed', 'cancelled']).default('pending'),
      memo: z.string().optional(),
      liveRoom: z.string().optional(),
      shopName: z.string().optional(),
      brandId: z.number().optional(),
      brandName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      // 1. bundleIdカラムが存在するか確認・追加
      try {
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS bundleId INT DEFAULT NULL`);
      } catch (e) { /* column may already exist */ }
      try {
        await pool.query(`CREATE INDEX idx_procurement_bundle ON procurement_orders (bundleId)`);
      } catch (e) { /* index may already exist */ }

      // 2. product_bundles にバンドル作成
      const [bundleResult] = await pool.query(
        `INSERT INTO product_bundles (bundleName, description, status, createdBy) VALUES (?, ?, 'draft', ?)`,
        [input.bundleName, `福袋: ${input.items.length}品`, (ctx.user as any)?.id || 0]
      ) as any;
      const bundleId = bundleResult.insertId;

      // 3. bundle_items に各商品を登録（productNameカラムを追加して未登録商品も記録）
      try {
        await pool.query(`ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS productName VARCHAR(500) DEFAULT NULL`);
      } catch (e) { /* column may already exist */ }
      for (const item of input.items) {
        await pool.query(
          `INSERT INTO bundle_items (bundleId, productId, quantity, productName) VALUES (?, ?, ?, ?)`,
          [bundleId, item.productId || 0, item.quantity, item.productName]
        );
      }

      // 4. procurement_order を作成（bundleId付き）
      try {
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS liveRoom VARCHAR(100) DEFAULT NULL`);
        await pool.query(`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS shopName VARCHAR(255) DEFAULT NULL`);
      } catch (e) { /* columns may already exist */ }

      const effectiveBrandId = input.brandId || 0;
      const effectiveBrandName = input.brandName || '福袋';
            const totalQty = input.items.reduce((sum, i) => sum + i.quantity, 0);
      const [orderResult] = await pool.query(
        `INSERT INTO procurement_orders (brandId, brandName, productId, productName, quantity, unitCost, totalCost, orderDate, status, memo, liveRoom, shopName, bundleId, qtyPerOrder, createdBy)
         VALUES (?, ?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          effectiveBrandId,
          effectiveBrandName,
          `🎁 ${input.bundleName} (${input.items.length}品)`,
          totalQty,
          input.orderDate,
          input.status,
          input.memo || null,
          input.liveRoom || null,
          input.shopName || null,
          bundleId,
          (ctx.user as any)?.id || 0,
        ]
      ) as any;

      return { success: true, bundleId, orderId: orderResult.insertId, itemCount: input.items.length };
    }),

  // 福袋に未登録商品を新規追加
  addProductForFukubukuro: protectedProcedure
    .input(z.object({
      productName: z.string(),
      brandId: z.number().optional(),
      brandName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const [result] = await pool.query(
        `INSERT INTO selection_products (productName, brandId, brandName, status, createdBy) VALUES (?, ?, ?, 'draft', ?)`,
        [input.productName, input.brandId || null, input.brandName || null, (ctx.user as any)?.id || 0]
      ) as any;
      return { id: result.insertId, productName: input.productName, brandId: input.brandId, brandName: input.brandName };
    }),

  // 福袋発注の商品リストを更新
  updateFukubukuroOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      bundleId: z.number(),
      bundleName: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productName: z.string(),
        quantity: z.number().default(1),
      })),
      orderDate: z.string().optional(),
      status: z.enum(['pending', 'ordered', 'received', 'completed', 'cancelled']).optional(),
      memo: z.string().optional(),
      liveRoom: z.string().optional(),
      shopName: z.string().optional(),
      brandName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      // Ensure ENUM includes 'completed'
      try {
        await pool.query(`ALTER TABLE procurement_orders MODIFY COLUMN status ENUM('pending','ordered','received','completed','cancelled') NOT NULL DEFAULT 'pending'`);
      } catch (e) { /* ignore */ }
      // 1. bundle_items を全削除して再挿入
      await pool.query(`DELETE FROM bundle_items WHERE bundleId = ?`, [input.bundleId]);
      try {
        await pool.query(`ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS productName VARCHAR(500) DEFAULT NULL`);
      } catch (e) { /* column may already exist */ }
      for (const item of input.items) {
        await pool.query(
          `INSERT INTO bundle_items (bundleId, productId, quantity, productName) VALUES (?, ?, ?, ?)`,
          [input.bundleId, item.productId || 0, item.quantity, item.productName]
        );
      }

      // 2. product_bundles のバンドル名を更新
      if (input.bundleName) {
        await pool.query(
          `UPDATE product_bundles SET bundleName = ?, description = ? WHERE id = ?`,
          [input.bundleName, `福袋: ${input.items.length}品`, input.bundleId]
        );
      }

      // 3. procurement_orders を更新
      const itemTotalQty = input.items.reduce((sum, i) => sum + i.quantity, 0);
      // Get current qtyPerOrder to calculate final quantity
      const [orderRow] = await pool.query('SELECT qtyPerOrder FROM procurement_orders WHERE id = ?', [input.orderId]) as any;
      const currentQtyPerOrder = Number(orderRow[0]?.qtyPerOrder || 1);
      const totalQty = itemTotalQty * currentQtyPerOrder;
      const productName = `🎁 ${input.bundleName || ''} (${input.items.length}品)`;
      const updates: string[] = ['productName = ?', 'quantity = ?'];
      const params: any[] = [productName, totalQty];
      if (input.orderDate) { updates.push('orderDate = ?'); params.push(input.orderDate); }
      if (input.status) { updates.push('status = ?'); params.push(input.status); }
      if (input.memo !== undefined) { updates.push('memo = ?'); params.push(input.memo || null); }
      if (input.liveRoom !== undefined) { updates.push('liveRoom = ?'); params.push(input.liveRoom || null); }
      if (input.shopName !== undefined) { updates.push('shopName = ?'); params.push(input.shopName || null); }
      if (input.brandName !== undefined) { updates.push('brandName = ?'); params.push(input.brandName || null); }
      params.push(input.orderId);
      await pool.query(`UPDATE procurement_orders SET ${updates.join(', ')} WHERE id = ?`, params);

      return { success: true, itemCount: input.items.length };
    }),
  // ブランド一括上下架
  bulkUpdateBrandStatus: protectedProcedure.input(z.object({
    brandName: z.string(),
    status: z.enum(["online", "offline"]),
  })).mutation(async ({ input }) => {
    const pool = getPool();
    const [result] = await pool.query(
      "UPDATE selection_products SET status = ? WHERE brandName = ? AND deletedAt IS NULL",
      [input.status, input.brandName]
    ) as any;
    return { success: true, affectedCount: result.affectedRows || 0 };
  }),
});
