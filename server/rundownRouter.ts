import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import mysql from "mysql2/promise";

let pool: mysql.Pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL || "",
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

// Initialize tables
async function initRundownTables() {
  const p = getPool();
  const tables = [
    `CREATE TABLE IF NOT EXISTS rundown_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      liverId INT DEFAULT NULL,
      liverName VARCHAR(255) DEFAULT NULL,
      liveDate DATE NOT NULL,
      startTime VARCHAR(10) DEFAULT NULL,
      endTime VARCHAR(10) DEFAULT NULL,
      platform VARCHAR(50) DEFAULT 'TikTok',
      theme VARCHAR(500) DEFAULT NULL,
      operatorName VARCHAR(255) DEFAULT NULL,
      shopName VARCHAR(255) DEFAULT 'LCJ店舗',
      status ENUM('draft','ready','live','completed','cancelled') DEFAULT 'draft',
      notes TEXT DEFAULT NULL,
      createdBy INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rundown_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId INT NOT NULL,
      slotOrder INT NOT NULL DEFAULT 0,
      timeSlot VARCHAR(50) DEFAULT NULL,
      durationMinutes INT DEFAULT NULL,
      section VARCHAR(255) DEFAULT NULL,
      productId INT DEFAULT NULL,
      productName VARCHAR(500) DEFAULT NULL,
      productNameCn VARCHAR(500) DEFAULT NULL,
      brandName VARCHAR(255) DEFAULT NULL,
      imageUrl TEXT DEFAULT NULL,
      productLink VARCHAR(1000) DEFAULT NULL,
      selfSiteLink VARCHAR(1000) DEFAULT NULL,
      theme VARCHAR(500) DEFAULT NULL,
      bundleCombo TEXT DEFAULT NULL,
      listPrice DECIMAL(14,2) DEFAULT NULL,
      livePrice DECIMAL(14,2) DEFAULT NULL,
      costPrice DECIMAL(14,2) DEFAULT NULL,
      purchasePrice DECIMAL(14,2) DEFAULT NULL,
      commissionRate DECIMAL(10,2) DEFAULT NULL,
      bundlePrice VARCHAR(500) DEFAULT NULL,
      shopAndFormat VARCHAR(500) DEFAULT NULL,
      estimatedGmv DECIMAL(14,2) DEFAULT NULL,
      playStrategy TEXT DEFAULT NULL,
      recommendReason TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rundown_checklist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId INT NOT NULL,
      checkItem VARCHAR(500) NOT NULL,
      category ENUM('product','equipment','account','other') DEFAULT 'other',
      isChecked TINYINT DEFAULT 0,
      checkedBy VARCHAR(255) DEFAULT NULL,
      checkedAt TIMESTAMP DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rundown_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId INT NOT NULL,
      actualStartTime VARCHAR(10) DEFAULT NULL,
      actualEndTime VARCHAR(10) DEFAULT NULL,
      totalGmv DECIMAL(12,2) DEFAULT 0,
      totalOrders INT DEFAULT 0,
      totalViewers INT DEFAULT 0,
      peakViewers INT DEFAULT 0,
      avgViewers INT DEFAULT 0,
      newFollowers INT DEFAULT 0,
      conversionRate DECIMAL(5,2) DEFAULT NULL,
      topProducts JSON DEFAULT NULL,
      lessonsLearned TEXT DEFAULT NULL,
      improvements TEXT DEFAULT NULL,
      csvImportData JSON DEFAULT NULL,
      reviewStatus ENUM('pending','completed') DEFAULT 'pending',
      reviewedBy VARCHAR(255) DEFAULT NULL,
      reviewedAt TIMESTAMP DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rundown_review_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reviewId INT NOT NULL,
      sessionId INT NOT NULL,
      rundownItemId INT DEFAULT NULL,
      productName VARCHAR(500) DEFAULT NULL,
      actualGmv DECIMAL(12,2) DEFAULT 0,
      actualOrders INT DEFAULT 0,
      actualUnitsSold INT DEFAULT 0,
      refundAmount DECIMAL(12,2) DEFAULT 0,
      refundCount INT DEFAULT 0,
      notes TEXT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const sql of tables) {
    try { await p.query(sql); } catch (e: any) {
      if (!e.message?.includes('already exists')) console.error('rundown table init error:', e.message);
    }
  }
  // Alter existing column to TEXT if needed
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN imageUrl TEXT DEFAULT NULL'); } catch (e: any) { /* ignore */ }
  // Expand DECIMAL columns to handle larger values
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN listPrice DECIMAL(14,2) DEFAULT NULL'); } catch (e: any) { /* ignore */ }
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN livePrice DECIMAL(14,2) DEFAULT NULL'); } catch (e: any) { /* ignore */ }
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN costPrice DECIMAL(14,2) DEFAULT NULL'); } catch (e: any) { /* ignore */ }
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN purchasePrice DECIMAL(14,2) DEFAULT NULL'); } catch (e: any) { /* ignore */ }
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN commissionRate DECIMAL(10,2) DEFAULT NULL'); } catch (e: any) { /* ignore */ }
  try { await p.query('ALTER TABLE rundown_items MODIFY COLUMN estimatedGmv DECIMAL(14,2) DEFAULT NULL'); } catch (e: any) { /* ignore */ }
}

// Run init on import
initRundownTables().catch(console.error);

export const rundownRouter = router({
  // ========== SESSION CRUD ==========
  getSessions: protectedProcedure.input(z.object({
    liverId: z.number().optional(),
    status: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(20),
  }).optional()).query(async ({ input }) => {
    const p = getPool();
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (input?.liverId) { where += ' AND liverId = ?'; params.push(input.liverId); }
    if (input?.status) { where += ' AND status = ?'; params.push(input.status); }
    if (input?.dateFrom) { where += ' AND liveDate >= ?'; params.push(input.dateFrom); }
    if (input?.dateTo) { where += ' AND liveDate <= ?'; params.push(input.dateTo); }
    const page = input?.page || 1;
    const pageSize = input?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const [rows] = await p.query(`SELECT * FROM rundown_sessions ${where} ORDER BY liveDate DESC, startTime DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]) as any;
    const [countRows] = await p.query(`SELECT COUNT(*) as total FROM rundown_sessions ${where}`, params) as any;
    return { sessions: rows, total: countRows[0].total };
  }),

  getSessionById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const p = getPool();
    const [sessions] = await p.query('SELECT * FROM rundown_sessions WHERE id = ?', [input.id]) as any;
    if (!sessions.length) return null;
    const [items] = await p.query('SELECT * FROM rundown_items WHERE sessionId = ? ORDER BY slotOrder ASC', [input.id]) as any;
    const [checklist] = await p.query('SELECT * FROM rundown_checklist WHERE sessionId = ? ORDER BY category, id', [input.id]) as any;
    const [reviews] = await p.query('SELECT * FROM rundown_reviews WHERE sessionId = ?', [input.id]) as any;
    const review = reviews.length ? reviews[0] : null;
    let reviewItems: any[] = [];
    if (review) {
      const [ri] = await p.query('SELECT * FROM rundown_review_items WHERE reviewId = ? ORDER BY id', [review.id]) as any;
      reviewItems = ri;
    }
    return { session: sessions[0], items, checklist, review, reviewItems };
  }),

  createSession: protectedProcedure.input(z.object({
    title: z.string().min(1),
    liverId: z.number().optional(),
    liverName: z.string().optional(),
    liveDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    platform: z.string().default('TikTok'),
    theme: z.string().optional(),
    operatorName: z.string().optional(),
    shopName: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const p = getPool();
    const [result] = await p.query(
      `INSERT INTO rundown_sessions (title, liverId, liverName, liveDate, startTime, endTime, platform, theme, operatorName, shopName, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.title, input.liverId || null, input.liverName || null, input.liveDate, input.startTime || null, input.endTime || null, input.platform, input.theme || null, input.operatorName || null, input.shopName || 'LCJ店舗', input.notes || null, (ctx.user as any)?.id || 0]
    ) as any;
    // Create default checklist items
    const defaultChecklist = [
      { item: '商品サンプル確認', category: 'product' },
      { item: '商品リンク動作確認', category: 'product' },
      { item: '価格設定確認', category: 'product' },
      { item: 'クーポン設定確認', category: 'product' },
      { item: 'カメラ・照明チェック', category: 'equipment' },
      { item: 'マイク音声チェック', category: 'equipment' },
      { item: 'ネット回線速度確認', category: 'equipment' },
      { item: 'TikTokアカウントログイン確認', category: 'account' },
      { item: 'ライブ配信テスト', category: 'account' },
      { item: '台本・トークポイント確認', category: 'other' },
      { item: '衣装・メイク準備', category: 'other' },
    ];
    for (const c of defaultChecklist) {
      await p.query('INSERT INTO rundown_checklist (sessionId, checkItem, category) VALUES (?, ?, ?)', [result.insertId, c.item, c.category]);
    }
    return { id: result.insertId, success: true };
  }),

  updateSession: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    liverId: z.number().optional(),
    liverName: z.string().optional(),
    liveDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    platform: z.string().optional(),
    theme: z.string().optional(),
    operatorName: z.string().optional(),
    shopName: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    const fields: string[] = [];
    const values: any[] = [];
    const { id, ...rest } = input;
    for (const [key, val] of Object.entries(rest)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
    }
    if (fields.length === 0) return { success: true };
    values.push(id);
    await p.query(`UPDATE rundown_sessions SET ${fields.join(', ')} WHERE id = ?`, values);
    return { success: true };
  }),

  deleteSession: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const p = getPool();
    await p.query('DELETE FROM rundown_items WHERE sessionId = ?', [input.id]);
    await p.query('DELETE FROM rundown_checklist WHERE sessionId = ?', [input.id]);
    await p.query('DELETE FROM rundown_review_items WHERE sessionId = ?', [input.id]);
    await p.query('DELETE FROM rundown_reviews WHERE sessionId = ?', [input.id]);
    await p.query('DELETE FROM rundown_sessions WHERE id = ?', [input.id]);
    return { success: true };
  }),

  // ========== RUNDOWN ITEMS CRUD ==========
  addItem: protectedProcedure.input(z.object({
    sessionId: z.number(),
    slotOrder: z.number().optional(),
    timeSlot: z.string().optional(),
    durationMinutes: z.number().optional(),
    section: z.string().optional(),
    productId: z.number().optional(),
    productName: z.string().optional(),
    productNameCn: z.string().optional(),
    brandName: z.string().optional(),
    imageUrl: z.string().optional(),
    productLink: z.string().optional(),
    selfSiteLink: z.string().optional(),
    theme: z.string().optional(),
    bundleCombo: z.string().optional(),
    listPrice: z.number().optional(),
    livePrice: z.number().optional(),
    costPrice: z.number().optional(),
    purchasePrice: z.number().optional(),
    commissionRate: z.number().optional(),
    bundlePrice: z.string().optional(),
    shopAndFormat: z.string().optional(),
    estimatedGmv: z.number().optional(),
    playStrategy: z.string().optional(),
    recommendReason: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    // Get next slot order if not provided
    let slotOrder = input.slotOrder;
    if (!slotOrder) {
      const [maxRows] = await p.query('SELECT COALESCE(MAX(slotOrder), 0) + 1 as nextOrder FROM rundown_items WHERE sessionId = ?', [input.sessionId]) as any;
      slotOrder = maxRows[0].nextOrder;
    }
    const [result] = await p.query(
      `INSERT INTO rundown_items (sessionId, slotOrder, timeSlot, durationMinutes, section, productId, productName, productNameCn, brandName, imageUrl, productLink, selfSiteLink, theme, bundleCombo, listPrice, livePrice, costPrice, purchasePrice, commissionRate, bundlePrice, shopAndFormat, estimatedGmv, playStrategy, recommendReason, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.sessionId, slotOrder, input.timeSlot || null, input.durationMinutes || null, input.section || null, input.productId || null, input.productName || null, input.productNameCn || null, input.brandName || null, input.imageUrl || null, input.productLink || null, input.selfSiteLink || null, input.theme || null, input.bundleCombo || null, input.listPrice || null, input.livePrice || null, input.costPrice || null, input.purchasePrice || null, input.commissionRate || null, input.bundlePrice || null, input.shopAndFormat || null, input.estimatedGmv || null, input.playStrategy || null, input.recommendReason || null, input.notes || null]
    ) as any;
    return { id: result.insertId, success: true };
  }),

  updateItem: protectedProcedure.input(z.object({
    id: z.number(),
    slotOrder: z.union([z.number(), z.string()]).nullable().optional(),
    timeSlot: z.string().nullable().optional(),
    durationMinutes: z.union([z.number(), z.string()]).nullable().optional(),
    section: z.string().nullable().optional(),
    productId: z.union([z.number(), z.string()]).nullable().optional(),
    productName: z.string().nullable().optional(),
    productNameCn: z.string().nullable().optional(),
    brandName: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    productLink: z.string().nullable().optional(),
    selfSiteLink: z.string().nullable().optional(),
    theme: z.string().nullable().optional(),
    bundleCombo: z.string().nullable().optional(),
    listPrice: z.union([z.number(), z.string()]).nullable().optional(),
    livePrice: z.union([z.number(), z.string()]).nullable().optional(),
    costPrice: z.union([z.number(), z.string()]).nullable().optional(),
    purchasePrice: z.union([z.number(), z.string()]).nullable().optional(),
    commissionRate: z.union([z.number(), z.string()]).nullable().optional(),
    bundlePrice: z.string().nullable().optional(),
    shopAndFormat: z.string().nullable().optional(),
    estimatedGmv: z.union([z.number(), z.string()]).nullable().optional(),
    playStrategy: z.string().nullable().optional(),
    recommendReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    const { id, ...rest } = input;
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(rest)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
    }
    if (fields.length === 0) return { success: true };
    values.push(id);
    await p.query(`UPDATE rundown_items SET ${fields.join(', ')} WHERE id = ?`, values);
    return { success: true };
  }),

  deleteItem: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const p = getPool();
    await p.query('DELETE FROM rundown_items WHERE id = ?', [input.id]);
    return { success: true };
  }),

  reorderItems: protectedProcedure.input(z.object({
    sessionId: z.number(),
    itemIds: z.array(z.number()),
  })).mutation(async ({ input }) => {
    const p = getPool();
    for (let i = 0; i < input.itemIds.length; i++) {
      await p.query('UPDATE rundown_items SET slotOrder = ? WHERE id = ? AND sessionId = ?', [i + 1, input.itemIds[i], input.sessionId]);
    }
    return { success: true };
  }),

  // ========== PRODUCT SEARCH (from selection center) ==========
  searchProducts: protectedProcedure.input(z.object({
    query: z.string().min(1),
    limit: z.number().default(20),
  })).query(async ({ input }) => {
    const p = getPool();
    const search = `%${input.query}%`;
    const [rows] = await p.query(
      `SELECT id, productName, productNameCn, brandName, price, costPrice, commissionValue, commissionType, images, productLink, purchasePrice, marketPrice, mechanism, historicalLowestPrice, suggestedPrice
       FROM selection_products 
       WHERE deletedAt IS NULL AND (productName LIKE ? OR productNameCn LIKE ? OR brandName LIKE ? OR barcode LIKE ? OR productId LIKE ?)
       ORDER BY createdAt DESC LIMIT ?`,
      [search, search, search, search, search, input.limit]
    ) as any;
    return rows.map((r: any) => ({
      ...r,
      images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
    }));
  }),

  // ========== CHECKLIST ==========
  updateChecklist: protectedProcedure.input(z.object({
    id: z.number(),
    isChecked: z.number(),
    checkedBy: z.string().optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    await p.query('UPDATE rundown_checklist SET isChecked = ?, checkedBy = ?, checkedAt = NOW() WHERE id = ?', [input.isChecked, input.checkedBy || null, input.id]);
    return { success: true };
  }),

  addChecklistItem: protectedProcedure.input(z.object({
    sessionId: z.number(),
    checkItem: z.string(),
    category: z.string().default('other'),
  })).mutation(async ({ input }) => {
    const p = getPool();
    const [result] = await p.query('INSERT INTO rundown_checklist (sessionId, checkItem, category) VALUES (?, ?, ?)', [input.sessionId, input.checkItem, input.category]) as any;
    return { id: result.insertId, success: true };
  }),

  deleteChecklistItem: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const p = getPool();
    await p.query('DELETE FROM rundown_checklist WHERE id = ?', [input.id]);
    return { success: true };
  }),

  // ========== REVIEW (POST-STREAM) ==========
  createOrUpdateReview: protectedProcedure.input(z.object({
    sessionId: z.number(),
    actualStartTime: z.string().optional(),
    actualEndTime: z.string().optional(),
    totalGmv: z.number().optional(),
    totalOrders: z.number().optional(),
    totalViewers: z.number().optional(),
    peakViewers: z.number().optional(),
    avgViewers: z.number().optional(),
    newFollowers: z.number().optional(),
    conversionRate: z.number().optional(),
    topProducts: z.any().optional(),
    lessonsLearned: z.string().optional(),
    improvements: z.string().optional(),
    reviewedBy: z.string().optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    const [existing] = await p.query('SELECT id FROM rundown_reviews WHERE sessionId = ?', [input.sessionId]) as any;
    if (existing.length > 0) {
      const { sessionId, ...rest } = input;
      const fields: string[] = [];
      const values: any[] = [];
      for (const [key, val] of Object.entries(rest)) {
        if (val !== undefined) {
          if (key === 'topProducts') { fields.push(`${key} = ?`); values.push(JSON.stringify(val)); }
          else { fields.push(`${key} = ?`); values.push(val); }
        }
      }
      fields.push('reviewStatus = ?', 'reviewedAt = NOW()');
      values.push('completed');
      values.push(existing[0].id);
      await p.query(`UPDATE rundown_reviews SET ${fields.join(', ')} WHERE id = ?`, values);
      return { id: existing[0].id, success: true };
    } else {
      const [result] = await p.query(
        `INSERT INTO rundown_reviews (sessionId, actualStartTime, actualEndTime, totalGmv, totalOrders, totalViewers, peakViewers, avgViewers, newFollowers, conversionRate, topProducts, lessonsLearned, improvements, reviewStatus, reviewedBy, reviewedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, NOW())`,
        [input.sessionId, input.actualStartTime || null, input.actualEndTime || null, input.totalGmv || 0, input.totalOrders || 0, input.totalViewers || 0, input.peakViewers || 0, input.avgViewers || 0, input.newFollowers || 0, input.conversionRate || null, input.topProducts ? JSON.stringify(input.topProducts) : null, input.lessonsLearned || null, input.improvements || null, input.reviewedBy || null]
      ) as any;
      // Update session status to completed
      await p.query('UPDATE rundown_sessions SET status = ? WHERE id = ?', ['completed', input.sessionId]);
      return { id: result.insertId, success: true };
    }
  }),

  // Import TikTok CSV data for review
  importTikTokCsv: protectedProcedure.input(z.object({
    sessionId: z.number(),
    csvData: z.array(z.object({
      productName: z.string().optional(),
      gmv: z.number().optional(),
      orders: z.number().optional(),
      unitsSold: z.number().optional(),
      refundAmount: z.number().optional(),
      refundCount: z.number().optional(),
    })),
    summary: z.object({
      totalGmv: z.number().optional(),
      totalOrders: z.number().optional(),
      totalViewers: z.number().optional(),
      peakViewers: z.number().optional(),
    }).optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    // Get or create review
    let [existing] = await p.query('SELECT id FROM rundown_reviews WHERE sessionId = ?', [input.sessionId]) as any;
    let reviewId: number;
    if (existing.length > 0) {
      reviewId = existing[0].id;
      await p.query('UPDATE rundown_reviews SET csvImportData = ?, totalGmv = COALESCE(?, totalGmv), totalOrders = COALESCE(?, totalOrders), totalViewers = COALESCE(?, totalViewers), peakViewers = COALESCE(?, peakViewers) WHERE id = ?',
        [JSON.stringify(input.csvData), input.summary?.totalGmv || null, input.summary?.totalOrders || null, input.summary?.totalViewers || null, input.summary?.peakViewers || null, reviewId]);
    } else {
      const [result] = await p.query(
        `INSERT INTO rundown_reviews (sessionId, csvImportData, totalGmv, totalOrders, totalViewers, peakViewers, reviewStatus) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [input.sessionId, JSON.stringify(input.csvData), input.summary?.totalGmv || 0, input.summary?.totalOrders || 0, input.summary?.totalViewers || 0, input.summary?.peakViewers || 0]
      ) as any;
      reviewId = result.insertId;
    }
    // Delete old review items and insert new ones
    await p.query('DELETE FROM rundown_review_items WHERE reviewId = ?', [reviewId]);
    // Try to match CSV items with rundown items
    const [rundownItems] = await p.query('SELECT id, productName, productNameCn FROM rundown_items WHERE sessionId = ?', [input.sessionId]) as any;
    for (const item of input.csvData) {
      let matchedItemId: number | null = null;
      if (item.productName && rundownItems.length > 0) {
        const match = rundownItems.find((ri: any) =>
          (ri.productName && item.productName && ri.productName.includes(item.productName)) ||
          (ri.productNameCn && item.productName && ri.productNameCn.includes(item.productName)) ||
          (item.productName && ri.productName && item.productName.includes(ri.productName))
        );
        if (match) matchedItemId = match.id;
      }
      await p.query(
        'INSERT INTO rundown_review_items (reviewId, sessionId, rundownItemId, productName, actualGmv, actualOrders, actualUnitsSold, refundAmount, refundCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [reviewId, input.sessionId, matchedItemId, item.productName || null, item.gmv || 0, item.orders || 0, item.unitsSold || 0, item.refundAmount || 0, item.refundCount || 0]
      );
    }
    return { reviewId, itemsImported: input.csvData.length, success: true };
  }),

  // ========== DUPLICATE SESSION (for template reuse) ==========
  duplicateSession: protectedProcedure.input(z.object({
    sessionId: z.number(),
    newDate: z.string(),
    newTitle: z.string().optional(),
  })).mutation(async ({ input }) => {
    const p = getPool();
    const [sessions] = await p.query('SELECT * FROM rundown_sessions WHERE id = ?', [input.sessionId]) as any;
    if (!sessions.length) throw new Error('Session not found');
    const s = sessions[0];
    const [result] = await p.query(
      `INSERT INTO rundown_sessions (title, liverId, liverName, liveDate, startTime, endTime, platform, theme, operatorName, shopName, notes, status, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [input.newTitle || s.title, s.liverId, s.liverName, input.newDate, s.startTime, s.endTime, s.platform, s.theme, s.operatorName, s.shopName, s.notes, s.createdBy]
    ) as any;
    const newId = result.insertId;
    // Copy items
    const [items] = await p.query('SELECT * FROM rundown_items WHERE sessionId = ? ORDER BY slotOrder', [input.sessionId]) as any;
    for (const item of items) {
      await p.query(
        `INSERT INTO rundown_items (sessionId, slotOrder, timeSlot, durationMinutes, section, productId, productName, productNameCn, brandName, imageUrl, productLink, selfSiteLink, theme, bundleCombo, listPrice, livePrice, costPrice, purchasePrice, commissionRate, bundlePrice, shopAndFormat, estimatedGmv, playStrategy, recommendReason, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, item.slotOrder, item.timeSlot, item.durationMinutes, item.section, item.productId, item.productName, item.productNameCn, item.brandName, item.imageUrl, item.productLink, item.selfSiteLink, item.theme, item.bundleCombo, item.listPrice, item.livePrice, item.costPrice, item.purchasePrice, item.commissionRate, item.bundlePrice, item.shopAndFormat, item.estimatedGmv, item.playStrategy, item.recommendReason, item.notes]
      );
    }
    // Copy checklist
    const [checklist] = await p.query('SELECT * FROM rundown_checklist WHERE sessionId = ?', [input.sessionId]) as any;
    for (const c of checklist) {
      await p.query('INSERT INTO rundown_checklist (sessionId, checkItem, category) VALUES (?, ?, ?)', [newId, c.checkItem, c.category]);
    }
    return { id: newId, success: true };
  }),

  // ========== AI REVIEW SUMMARY ==========
  generateReviewSummary: protectedProcedure.input(z.object({
    sessionId: z.number(),
    totalGmv: z.number().optional(),
    totalOrders: z.number().optional(),
    totalViewers: z.number().optional(),
    peakViewers: z.number().optional(),
    avgViewers: z.number().optional(),
    newFollowers: z.number().optional(),
    actualStartTime: z.string().optional(),
    actualEndTime: z.string().optional(),
    lessonsLearned: z.string().optional(),
    improvements: z.string().optional(),
    productData: z.array(z.object({
      productName: z.string(),
      gmv: z.number(),
      orders: z.number(),
      unitsSold: z.number(),
    })).optional(),
    liverName: z.string().optional(),
    title: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { sessionId, productData, lessonsLearned, improvements, liverName, title, ...metrics } = input;
    
    // Build context for AI
    let context = `## ライブ配信復盤データ\n`;
    if (title) context += `タイトル: ${title}\n`;
    if (liverName) context += `ライバー: ${liverName}\n`;
    if (metrics.actualStartTime) context += `配信時間: ${metrics.actualStartTime}〜${metrics.actualEndTime || '?'}\n`;
    context += `\n### 実績数値\n`;
    if (metrics.totalGmv) context += `- 総GMV: ¥${metrics.totalGmv.toLocaleString()}\n`;
    if (metrics.totalOrders) context += `- 注文数: ${metrics.totalOrders}件\n`;
    if (metrics.totalViewers) context += `- 累計視聴者: ${metrics.totalViewers}人\n`;
    if (metrics.peakViewers) context += `- ピーク視聴者: ${metrics.peakViewers}人\n`;
    if (metrics.avgViewers) context += `- 平均視聴者: ${metrics.avgViewers}人\n`;
    if (metrics.newFollowers) context += `- 新規フォロワー: ${metrics.newFollowers}人\n`;
    if (metrics.totalGmv && metrics.totalOrders) {
      context += `- 平均単価: ¥${Math.round(metrics.totalGmv / metrics.totalOrders).toLocaleString()}\n`;
    }
    if (metrics.totalGmv && metrics.totalViewers) {
      context += `- 視聴者あたりGMV: ¥${(metrics.totalGmv / metrics.totalViewers).toFixed(1)}\n`;
    }
    
    if (productData && productData.length > 0) {
      context += `\n### 商品別実績 (${productData.length}品)\n`;
      const sorted = [...productData].sort((a, b) => b.gmv - a.gmv);
      sorted.forEach((p, i) => {
        context += `${i + 1}. ${p.productName} - GMV: ¥${p.gmv.toLocaleString()}, 注文: ${p.orders}件, 販売数: ${p.unitsSold}件\n`;
      });
    }
    
    if (lessonsLearned) context += `\n### ライバーの振り返り\n${lessonsLearned}\n`;
    if (improvements) context += `\n### ライバーの改善提案\n${improvements}\n`;
    
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはライブコマースの専門アナリストです。配信復盤データを分析し、主播と運営が直感的に理解できる簡潔なレポートを作成してください。

以下の形式で日本語と中国語の両方で回答してください：

## 🌟 今回のハイライト / 本次亮点
(良かった点を2-3個、具体的な数字を交えて)

## ⚠️ 課題・改善点 / 问题与不足
(問題点を2-3個、具体的な数字を交えて)

## 💡 次回への提案 / 下次建议
(実行可能な改善提案を2-3個)

## 📊 総合評価
(総合スコア: A/B/C/Dと一行コメント)

注意:
- 具体的な数字を使って分析する
- ライブコマースの業界標準と比較する（例: 視聴者あたりGMVの目安は¥5-10）
- 商品ラインナップの有効性を評価する
- ライバーの振り返りがあればそれも考慮する
- 簡潔で読みやすく、箇条書きで`
        },
        {
          role: "user",
          content: context
        }
      ],
    });
    const summary = result.choices?.[0]?.message?.content || "分析できませんでした";
    
    // Save summary to DB
    const p = getPool();
    try {
      await p.query('UPDATE rundown_reviews SET lessonsLearned = CONCAT(IFNULL(lessonsLearned, \'\'), \'\\n\\n--- AI分析レポート ---\\n\', ?) WHERE sessionId = ?', [summary, sessionId]);
    } catch (e) {
      console.error('[generateReviewSummary] DB save error:', e);
    }
    
    return { summary };
  }),

  // ========== ANALYZE LIVE DASHBOARD SCREENSHOT ==========
  analyzeLiveDashboard: protectedProcedure.input(z.object({
    imageUrl: z.string(),
  })).mutation(async ({ input }) => {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a data extraction assistant. Extract numerical data from TikTok Live Dashboard screenshots. Return ONLY valid JSON with the following fields (use null if not found):
{
  "totalGmv": number (total GMV in the currency shown, e.g. 9155),
  "totalOrders": number (归因成交件数 / orders),
  "totalViewers": number (浏览人数 / cumulative viewers, convert K to number e.g. 2.08K = 2080),
  "peakViewers": number (peak concurrent viewers if shown),
  "averageViewers": number (平均视聴者 if shown),
  "newFollowers": number (新规フォロワー / new followers),
  "startTime": string (HH:MM format, e.g. "18:59"),
  "endTime": string (HH:MM format, e.g. "22:05"),
  "impressions": number (曝光次数, convert K e.g. 6.16K = 6160),
  "views": number (观看次数, convert K),
  "hourlyGmv": number (每小时GMV, convert K),
  "hourlyImpressions": number (每小时曝光次数, convert K),
  "cpmGmv": number (千次曝光成交金额, convert K),
  "avgWatchDuration": number (平均观看时长 in seconds),
  "commentRate": string (评论率 as percentage string e.g. "14.53%"),
  "followRate": string (关注率 as percentage string e.g. "0.16%"),
  "duration": string (时长 as text e.g. "3小时5分钟45秒")
}
Convert K/万 to actual numbers. Only return the JSON object, no explanation.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please extract all data from this TikTok Live Dashboard screenshot:" },
            { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } }
          ]
        }
      ],
    });
    const content = result.choices?.[0]?.message?.content || "{}";
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try {
      return JSON.parse(jsonStr);
    } catch {
      console.error('[analyzeLiveDashboard] Failed to parse LLM response:', content);
      return { error: 'Failed to parse response', raw: content };
    }
  }),
  // ========== GET LIVERS (for dropdown) ==========
  getLivers: protectedProcedure.query(async () => {
    const p = getPool();
    try {
      const [rows] = await p.query('SELECT id, name FROM livers WHERE isActive = 1 ORDER BY name ASC') as any;
      return rows;
    } catch { return []; }
  }),
});
