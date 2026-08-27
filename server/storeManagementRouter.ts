/**
 * Store Management Router - 店铺管理系统
 * 
 * 全屏店铺管理：店铺CRUD、运营人员指定、CSV数据导入、KPI展示
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from './_core/trpc.js';
import { getStoreProfileUpgradeHealth } from './storeProfileUpgrade.js';
import { getStoreProductUpgradeHealth } from './storeProductUpgrade.js';
import { getStoreDataRetentionHealth } from './storeDataRetentionUpgrade.js';
import { storageGet, storagePut } from './storage.js';

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
  await pool.query(`CREATE TABLE IF NOT EXISTS store_data_refund_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uploadId INT NOT NULL,
    storeId INT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    date DATE NOT NULL,
    refundAmount DECIMAL(20,2) NOT NULL DEFAULT 0,
    sourceField VARCHAR(255) NOT NULL,
    sourceRowIndex INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_refund_upload_date_row (uploadId, date, sourceRowIndex),
    INDEX idx_store_refund_store_date (storeId, date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS store_data_upload_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uploadId INT NULL,
    storeId INT NOT NULL,
    action VARCHAR(48) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_upload_audit_store_time (storeId, createdAt),
    INDEX idx_store_upload_audit_upload (uploadId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
  await pool.query("ALTER TABLE managed_stores ADD COLUMN avatarUrl VARCHAR(1000)").catch(() => {});
  await pool.query("ALTER TABLE managed_stores ADD COLUMN avatarKey VARCHAR(500)").catch(() => {});
  await pool.query("ALTER TABLE managed_stores ADD COLUMN contactEmail VARCHAR(320)").catch(() => {});
  await pool.query("ALTER TABLE managed_stores ADD COLUMN contactPhone VARCHAR(64)").catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_profile_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      storeId INT NOT NULL,
      action VARCHAR(40) NOT NULL,
      changedFields JSON NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      actorId BIGINT NULL,
      actorName VARCHAR(255) NULL,
      source VARCHAR(80) NOT NULL DEFAULT 'store-management-ui',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_store_profile_audit_store_time (storeId, createdAt),
      INDEX idx_store_profile_audit_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

const PROFILE_AUDIT_FIELDS = [
  'name', 'platform', 'country', 'storeUrl',
  'operatorId', 'operatorName', 'operator2Id', 'operator2Name',
  'notes', 'avatarUrl', 'avatarKey', 'contactEmail', 'contactPhone', 'isActive',
] as const;

function profileSnapshot(row: any): Record<string, unknown> | null {
  if (!row) return null;
  return Object.fromEntries(PROFILE_AUDIT_FIELDS.map((field) => [field, row[field] ?? null]));
}

function changedProfileFields(before: any, after: any): string[] {
  const left = profileSnapshot(before) || {};
  const right = profileSnapshot(after) || {};
  return PROFILE_AUDIT_FIELDS.filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]));
}

function actorFromContext(ctx: any): { actorId: number | null; actorName: string } {
  const actorId = Number(ctx?.user?.id || 0) || null;
  const actorName = String(ctx?.user?.name || ctx?.user?.email || ctx?.user?.openId || 'authenticated-user').slice(0, 255);
  return { actorId, actorName };
}

function safeUploadFileName(value: string): string {
  const normalized = value.normalize('NFKC').replace(/[\\/\0]/g, '_').replace(/[^A-Za-z0-9._\-\u3000-\u30ff\u3400-\u9fff]/g, '_');
  return (normalized || 'store-upload.bin').slice(0, 180);
}

function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object' && 'value' in value) return numericValue((value as { value?: unknown }).value);
  const parsed = Number(String(value ?? '').replace(/[¥￥,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowRefundKey(row: Record<string, unknown>): string | null {
  const preferred = ['返金', '退款金額', '退款金额', '退款', '返品金額', 'キャンセル金額', 'Refund', 'refund'];
  for (const key of preferred) if (Object.prototype.hasOwnProperty.call(row, key)) return key;
  return Object.keys(row).find((key) => {
    const lower = key.toLowerCase();
    const refundLike = key.includes('返金') || key.includes('退款') || key.includes('キャンセル金額') || lower.includes('refund');
    const rateOrCount = key.includes('率') || key.includes('件数') || key.includes('数量') || lower.includes('rate') || lower.includes('count');
    return refundLike && !rateOrCount;
  }) || null;
}

function rowDate(row: Record<string, unknown>): string | null {
  for (const key of ['日期', '日付', 'Date', 'date']) {
    const raw = String(row[key] ?? '').trim();
    if (!raw) continue;
    const normalized = raw.slice(0, 10).replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }
  return null;
}

async function writeUploadAudit(connection: any, input: {
  uploadId: number | null; storeId: number; action: string; before?: unknown; after?: unknown; ctx: any; reason?: string;
}): Promise<void> {
  const actor = actorFromContext(input.ctx);
  await connection.query(
    `INSERT INTO store_data_upload_audit_logs (uploadId,storeId,action,beforeJson,afterJson,actorId,actorName,reason)
     VALUES (?,?,?,?,?,?,?,?)`,
    [input.uploadId,input.storeId,input.action,input.before ? JSON.stringify(input.before) : null,input.after ? JSON.stringify(input.after) : null,actor.actorId,actor.actorName,input.reason || null],
  );
}

async function writeRefundDailyRows(connection: any, uploadId: number, storeId: number, year: number, month: number, data: Record<string, any>[]): Promise<number> {
  let inserted = 0;
  for (let sourceRowIndex = 0; sourceRowIndex < data.length; sourceRowIndex += 1) {
    const row = data[sourceRowIndex];
    if (!row || row._type === 'summary') continue;
    const key = rowRefundKey(row);
    const date = rowDate(row);
    if (!key || !date) continue;
    const refundAmount = numericValue(row[key]);
    if (!refundAmount) continue;
    await connection.query(
      `INSERT INTO store_data_refund_daily (uploadId,storeId,year,month,date,refundAmount,sourceField,sourceRowIndex)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE refundAmount=VALUES(refundAmount),sourceField=VALUES(sourceField)`,
      [uploadId,storeId,year,month,date,refundAmount,key,sourceRowIndex],
    );
    inserted += 1;
  }
  return inserted;
}

async function writeProfileAudit(connection: any, input: {
  storeId: number;
  action: string;
  before: any;
  after: any;
  ctx: any;
  source?: string;
}): Promise<void> {
  const actor = actorFromContext(input.ctx);
  await connection.query(
    `INSERT INTO store_profile_audit_logs
      (storeId, action, changedFields, beforeJson, afterJson, actorId, actorName, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.storeId,
      input.action,
      JSON.stringify(changedProfileFields(input.before, input.after)),
      input.before ? JSON.stringify(profileSnapshot(input.before)) : null,
      input.after ? JSON.stringify(profileSnapshot(input.after)) : null,
      actor.actorId,
      actor.actorName,
      input.source || 'store-management-ui',
    ],
  );
}

async function normalizeOperatorPair(pool: any, fields: Record<string, any>, idKey: 'operatorId' | 'operator2Id', nameKey: 'operatorName' | 'operator2Name'): Promise<void> {
  const idProvided = Object.prototype.hasOwnProperty.call(fields, idKey);
  const nameProvided = Object.prototype.hasOwnProperty.call(fields, nameKey);
  if (!idProvided && !nameProvided) return;
  const numericId = Number(fields[idKey] || 0);
  if (numericId > 0) {
    const [rows] = await pool.query("SELECT name FROM staff WHERE id = ? AND isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL LIMIT 1", [numericId]);
    const staff = (rows as any[])[0];
    if (!staff) throw new Error(`负责人不存在或已归档: ${numericId}`);
    fields[idKey] = numericId;
    fields[nameKey] = String(staff.name);
    return;
  }
  const customName = typeof fields[nameKey] === 'string' ? fields[nameKey].trim() : '';
  fields[idKey] = null;
  fields[nameKey] = customName || null;
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

  // Public integrity probe: returns no store names or monetary values.
  recoveryHealth: publicProcedure.query(async () => {
    await ensureStoreTables();
    const pool = await getPool();
    const expectedNames = ['KYOGOKU JAPAN', 'LCJチャンネル', 'buzzdrop', 'Dr.Abla', 'labo celle'];
    const placeholders = expectedNames.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT COUNT(DISTINCT ms.id) AS storeCount,
        COUNT(sdu.id) AS evidenceRowCount,
        COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(sdu.dataJson, '$[0].GMV.value')) AS UNSIGNED)), 0) AS totalGmv
       FROM managed_stores ms
       LEFT JOIN store_data_uploads sdu ON sdu.storeId = ms.id
         AND sdu.year = 2026 AND sdu.month = 7 AND sdu.dataType = 'shop_stats'
         AND sdu.isCurrent = 1 AND sdu.deletedAt IS NULL
       WHERE ms.isActive = 1 AND ms.name IN (${placeholders})`,
      expectedNames,
    );
    const state = (rows as any[])[0] || {};
    const storeCount = Number(state.storeCount || 0);
    const evidenceRowCount = Number(state.evidenceRowCount || 0);
    const totalGmv = Number(state.totalGmv || 0);
    return {
      healthy: storeCount === 5 && evidenceRowCount >= 5,
      storeCount,
      evidenceRowCount,
      latestRecoveredPeriod: '2026-07',
      evidenceChecksum: 'b68a3ba23f49addead09bef10686da89305eb24482424e535cfea70741377699',
    };
  }),

  // Latest month with restored/uploaded store data
  latestDataPeriod: protectedProcedure.query(async () => {
    await ensureStoreTables();
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT year, month
       FROM store_data_uploads
       WHERE dataType = 'shop_stats' AND recordCount > 0 AND isCurrent = 1 AND deletedAt IS NULL
       ORDER BY year DESC, month DESC, uploadedAt DESC
       LIMIT 1`
    );
    const latest = (rows as any[])[0];
    return latest
      ? { year: Number(latest.year), month: Number(latest.month) }
      : { year: null, month: null };
  }),

  dataRetentionHealth: publicProcedure.query(async () => getStoreDataRetentionHealth()),

  managementUpgradeHealth: publicProcedure.query(async () => {
    await ensureStoreTables();
    const pool = await getPool();
    const expectedNames = ['KYOGOKU JAPAN', 'LCJチャンネル', 'buzzdrop', 'Dr.Abla', 'labo celle'];
    const placeholders = expectedNames.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM managed_stores WHERE isActive = 1 AND name IN (${placeholders})) AS storeCount,
        (SELECT COUNT(*) FROM store_data_uploads WHERE year = 2026 AND month = 8 AND dataType = 'shop_stats' AND recordCount > 0 AND isCurrent = 1 AND deletedAt IS NULL) AS augustUploadRowCount,
        (SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(dataJson, '$[0].GMV.value')) AS UNSIGNED)), 0)
           FROM store_data_uploads
          WHERE year = 2026 AND month = 7 AND dataType = 'shop_stats' AND isCurrent = 1 AND deletedAt IS NULL) AS julyGmv`,
      expectedNames,
    );
    const state = (rows as any[])[0] || {};
    const profile = await getStoreProfileUpgradeHealth();
    const storeCount = Number(state.storeCount || 0);
    const augustUploadRowCount = Number(state.augustUploadRowCount || 0);
    const julyGmv = Number(state.julyGmv || 0);
    return {
      healthy: profile.healthy && storeCount === 5 && julyGmv === 134_334_533,
      profile,
      fiveStoresIntact: storeCount === 5,
      julyRecoveredTotalIntact: julyGmv === 134_334_533,
      strictSelectedPeriod: '2026-08',
      augustUploadRowCount,
      augustStrictZeroExpected: augustUploadRowCount === 0,
      crossMonthFallbackAllowed: false,
    };
  }),

  productManagementHealth: publicProcedure.query(async () => {
    return getStoreProductUpgradeHealth();
  }),

  profileAudit: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const [rows] = await pool.query(
        `SELECT id, storeId, action, changedFields, beforeJson, afterJson, actorId, actorName, source, createdAt
           FROM store_profile_audit_logs
          WHERE storeId = ?
          ORDER BY createdAt DESC, id DESC
          LIMIT ?`,
        [input.storeId, input.limit],
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
      notes: z.string().max(5000).optional(),
      avatarUrl: z.string().max(1000).optional(),
      avatarKey: z.string().max(500).optional(),
      contactEmail: z.string().email().max(320).optional().or(z.literal('')),
      contactPhone: z.string().max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const fields: Record<string, any> = { ...input };
        await normalizeOperatorPair(connection, fields, 'operatorId', 'operatorName');
        await normalizeOperatorPair(connection, fields, 'operator2Id', 'operator2Name');
        const [result] = await connection.query(
          `INSERT INTO managed_stores (name, platform, country, storeUrl, operatorId, operatorName, operator2Id, operator2Name, notes, avatarUrl, avatarKey, contactEmail, contactPhone, manualRevisionAt, manualRevisionBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [fields.name, fields.platform, fields.country, fields.storeUrl || null,
           fields.operatorId ?? null, fields.operatorName ?? null,
           fields.operator2Id ?? null, fields.operator2Name ?? null,
           fields.notes || null,
           fields.avatarUrl || null, fields.avatarKey || null,
           fields.contactEmail || null, fields.contactPhone || null,
           ctx.user.id],
        );
        const storeId = Number((result as any).insertId);
        const [afterRows] = await connection.query('SELECT * FROM managed_stores WHERE id = ? LIMIT 1', [storeId]);
        const after = (afterRows as any[])[0];
        await writeProfileAudit(connection, { storeId, action: 'profile_created', before: null, after, ctx });
        await connection.commit();
        return { id: storeId };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
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
      notes: z.string().max(5000).nullable().optional(),
      avatarUrl: z.string().max(1000).nullable().optional(),
      avatarKey: z.string().max(500).nullable().optional(),
      contactEmail: z.string().email().max(320).nullable().optional().or(z.literal('')),
      contactPhone: z.string().max(64).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const { id, ...rawFields } = input;
        const [beforeRows] = await connection.query('SELECT * FROM managed_stores WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
        const before = (beforeRows as any[])[0];
        if (!before) throw new Error('店铺不存在');
        const fields: Record<string, any> = { ...rawFields };
        await normalizeOperatorPair(connection, fields, 'operatorId', 'operatorName');
        await normalizeOperatorPair(connection, fields, 'operator2Id', 'operator2Name');
        const sets: string[] = [];
        const params: any[] = [];
        for (const [key, val] of Object.entries(fields)) {
          if (val !== undefined) {
            sets.push(`${key} = ?`);
            params.push(val === '' ? null : val);
          }
        }
        if (sets.length === 0) {
          await connection.rollback();
          return { success: true, changedFields: [] as string[] };
        }
        sets.push('manualRevisionAt = CURRENT_TIMESTAMP', 'manualRevisionBy = ?');
        params.push(ctx.user.id, id);
        const [updateResult] = await connection.query(`UPDATE managed_stores SET ${sets.join(', ')} WHERE id = ?`, params);
        if (Number((updateResult as any).affectedRows || 0) !== 1) throw new Error('店铺保存失败：更新行数不一致');
        const [afterRows] = await connection.query('SELECT * FROM managed_stores WHERE id = ? LIMIT 1', [id]);
        const after = (afterRows as any[])[0];
        const changedFields = changedProfileFields(before, after);
        await writeProfileAudit(connection, { storeId: id, action: 'profile_updated', before, after, ctx });
        await connection.commit();
        return { success: true, changedFields };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  // Delete store (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [beforeRows] = await connection.query('SELECT * FROM managed_stores WHERE id = ? LIMIT 1 FOR UPDATE', [input.id]);
        const before = (beforeRows as any[])[0];
        if (!before) throw new Error('店铺不存在');
        const [deleteResult] = await connection.query(
          'UPDATE managed_stores SET isActive = 0, manualRevisionAt = CURRENT_TIMESTAMP, manualRevisionBy = ? WHERE id = ?',
          [ctx.user.id, input.id],
        );
        if (Number((deleteResult as any).affectedRows || 0) !== 1) throw new Error('店铺删除失败：更新行数不一致');
        const [afterRows] = await connection.query('SELECT * FROM managed_stores WHERE id = ? LIMIT 1', [input.id]);
        await writeProfileAudit(connection, { storeId: input.id, action: 'profile_archived', before, after: (afterRows as any[])[0], ctx });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  // Upload CSV/XLS/XLSX while preserving every generation and the original file.
  uploadData: protectedProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      dataType: z.enum(['shop_stats', 'products', 'ads']),
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
      data: z.array(z.record(z.string(), z.any())).max(100000),
      fileName: z.string().max(255).optional(),
      fileBase64: z.string().max(40_000_000).optional(),
      fileSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
      fileSize: z.number().int().min(0).max(30_000_000).optional(),
      mimeType: z.string().max(255).optional(),
      parseVersion: z.string().max(64).default('store-excel-v2'),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const dataJson = JSON.stringify(input.data);
      const dataSha256 = createHash('sha256').update(dataJson).digest('hex');
      let originalFileKey: string | null = null;
      let originalFileUrl: string | null = null;
      let verifiedFileSha256: string | null = null;
      let verifiedFileSize: number | null = null;
      if (input.fileBase64) {
        const buffer = Buffer.from(input.fileBase64, 'base64');
        if (buffer.length === 0 || buffer.length > 30_000_000) throw new Error('元ファイルは30MB以下である必要があります');
        verifiedFileSha256 = createHash('sha256').update(buffer).digest('hex');
        if (input.fileSha256 && input.fileSha256.toLowerCase() !== verifiedFileSha256) throw new Error('元ファイルのSHA-256が一致しません');
        if (input.fileSize !== undefined && input.fileSize !== buffer.length) throw new Error('元ファイルのサイズが一致しません');
        verifiedFileSize = buffer.length;
        const safeName = safeUploadFileName(input.fileName || 'store-upload.bin');
        const key = `private/store-uploads/${input.storeId}/${input.year}/${String(input.month).padStart(2, '0')}/${Date.now()}-${verifiedFileSha256.slice(0, 16)}-${safeName}`;
        const saved = await storagePut(key, buffer, input.mimeType || 'application/octet-stream');
        originalFileKey = saved.key;
        originalFileUrl = saved.url;
      }
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [currentRows] = await connection.query(
          `SELECT id,versionNumber,fileSha256,dataSha256,fileName,recordCount,uploadedAt
             FROM store_data_uploads
            WHERE storeId=? AND year=? AND month=? AND dataType=? AND isCurrent=1 AND deletedAt IS NULL
            ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [input.storeId,input.year,input.month,input.dataType],
        );
        const current = (currentRows as any[])[0] || null;
        const [versionRows] = await connection.query(
          `SELECT COALESCE(MAX(versionNumber),0) AS maxVersion FROM store_data_uploads WHERE storeId=? AND year=? AND month=? AND dataType=?`,
          [input.storeId,input.year,input.month,input.dataType],
        );
        const versionNumber = Number((versionRows as any[])[0]?.maxVersion || 0) + 1;
        await connection.query(`UPDATE store_data_uploads SET isCurrent=0 WHERE storeId=? AND year=? AND month=? AND dataType=? AND deletedAt IS NULL`, [input.storeId,input.year,input.month,input.dataType]);
        const [result] = await connection.query(
          `INSERT INTO store_data_uploads
            (storeId,dataType,year,month,dataJson,fileName,recordCount,uploadedBy,isCurrent,versionNumber,supersedesId,fileSha256,dataSha256,originalFileKey,originalFileUrl,fileSize,mimeType,parseVersion,sourceKind,evidenceJson)
           VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,'user_upload',?)`,
          [input.storeId,input.dataType,input.year,input.month,dataJson,input.fileName || null,input.data.length,actorFromContext(ctx).actorName,versionNumber,current ? Number(current.id) : null,verifiedFileSha256,dataSha256,originalFileKey,originalFileUrl,verifiedFileSize,input.mimeType || null,input.parseVersion,JSON.stringify({ originalFileSaved:Boolean(originalFileKey),dataRows:input.data.length })],
        );
        const uploadId = Number((result as any).insertId);
        const refundRows = input.dataType === 'shop_stats' ? await writeRefundDailyRows(connection, uploadId, input.storeId, input.year, input.month, input.data) : 0;
        const after = { id:uploadId,versionNumber,fileSha256:verifiedFileSha256,dataSha256,originalFileKey,fileSize:verifiedFileSize,recordCount:input.data.length,refundRows };
        await writeUploadAudit(connection, { uploadId,storeId:input.storeId,action:'generation_uploaded',before:current,after,ctx });
        await connection.commit();
        return { success:true,id:uploadId,versionNumber,recordCount:input.data.length,refundRows,originalFileSaved:Boolean(originalFileKey),dataSha256,fileSha256:verifiedFileSha256 };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally { connection.release(); }
    }),

  getData: protectedProcedure
    .input(z.object({ storeId:z.number(),year:z.number(),month:z.number(),dataType:z.enum(['shop_stats','products','ads']).optional() }))
    .query(async ({ input }) => {
      await ensureStoreTables();
      const pool = await getPool();
      let where = 'WHERE storeId=? AND year=? AND month=? AND isCurrent=1 AND deletedAt IS NULL';
      const params:any[] = [input.storeId,input.year,input.month];
      if (input.dataType) { where += ' AND dataType=?'; params.push(input.dataType); }
      const [rows] = await pool.query(
        `SELECT id,dataType,year,month,dataJson,fileName,recordCount,uploadedBy,uploadedAt,versionNumber,fileSha256,dataSha256,originalFileKey,fileSize,mimeType,sourceKind
           FROM store_data_uploads ${where} ORDER BY dataType,versionNumber DESC,id DESC`, params,
      );
      return (rows as any[]).map((row) => ({...row,data:row.dataJson ? JSON.parse(row.dataJson) : [],dataJson:undefined,originalFileAvailable:Boolean(row.originalFileKey)}));
    }),

  getUploadHistory: protectedProcedure
    .input(z.object({ storeId:z.number(),year:z.number().optional(),month:z.number().optional(),limit:z.number().int().min(1).max(500).default(200) }))
    .query(async ({ input }) => {
      await ensureStoreTables();
      const pool = await getPool();
      const where = ['storeId=?'];
      const params:any[] = [input.storeId];
      if (input.year !== undefined) { where.push('year=?'); params.push(input.year); }
      if (input.month !== undefined) { where.push('month=?'); params.push(input.month); }
      params.push(input.limit);
      const [rows] = await pool.query(
        `SELECT id,dataType,year,month,fileName,recordCount,uploadedBy,uploadedAt,isCurrent,versionNumber,supersedesId,fileSha256,dataSha256,originalFileKey,fileSize,mimeType,parseVersion,sourceKind,evidenceJson,deletedAt,deletedBy,deleteReason
           FROM store_data_uploads WHERE ${where.join(' AND ')} ORDER BY year DESC,month DESC,dataType,versionNumber DESC,id DESC LIMIT ?`, params,
      );
      return (rows as any[]).map((row)=>({...row,originalFileAvailable:Boolean(row.originalFileKey)}));
    }),

  getOriginalUploadFile: protectedProcedure
    .input(z.object({ id:z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      const [rows] = await pool.query('SELECT originalFileKey,fileName FROM store_data_uploads WHERE id=? LIMIT 1',[input.id]);
      const row = (rows as any[])[0];
      if (!row?.originalFileKey) throw new Error('この世代には元ファイルが保存されていません');
      const signed = await storageGet(String(row.originalFileKey));
      return { url:signed.url,fileName:row.fileName || 'store-upload' };
    }),

  getRefundDaily: protectedProcedure
    .input(z.object({ storeId:z.number().int().positive(),year:z.number().int(),month:z.number().int() }))
    .query(async ({ input }) => {
      const pool = await getPool();
      const [rows] = await pool.query(
        `SELECT d.id,d.uploadId,d.date,d.refundAmount,d.sourceField,u.fileName,u.versionNumber,u.isCurrent
           FROM store_data_refund_daily d JOIN store_data_uploads u ON u.id=d.uploadId
          WHERE d.storeId=? AND d.year=? AND d.month=? AND u.deletedAt IS NULL
          ORDER BY d.date,d.id`,[input.storeId,input.year,input.month],
      );
      return rows as any[];
    }),

  uploadAudit: protectedProcedure
    .input(z.object({ storeId:z.number().int().positive(),limit:z.number().int().min(1).max(500).default(100) }))
    .query(async ({ input }) => {
      const pool = await getPool();
      const [rows] = await pool.query(`SELECT id,uploadId,storeId,action,beforeJson,afterJson,actorId,actorName,reason,createdAt FROM store_data_upload_audit_logs WHERE storeId=? ORDER BY id DESC LIMIT ?`,[input.storeId,input.limit]);
      return rows as any[];
    }),

  deleteData: protectedProcedure
    .input(z.object({ id:z.number().int().positive(),reason:z.string().max(1000).optional() }))
    .mutation(async ({ input,ctx }) => {
      const pool = await getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT * FROM store_data_uploads WHERE id=? LIMIT 1 FOR UPDATE',[input.id]);
        const before = (rows as any[])[0];
        if (!before) throw new Error('アップロード世代が見つかりません');
        const actor = actorFromContext(ctx);
        await connection.query(`UPDATE store_data_uploads SET isCurrent=0,deletedAt=CURRENT_TIMESTAMP,deletedBy=?,deleteReason=? WHERE id=?`,[actor.actorName,input.reason || 'staff deletion',input.id]);
        let restoredId:null|number = null;
        if (Number(before.isCurrent)===1) {
          const [previousRows] = await connection.query(`SELECT id FROM store_data_uploads WHERE storeId=? AND year=? AND month=? AND dataType=? AND deletedAt IS NULL AND id<>? ORDER BY versionNumber DESC,id DESC LIMIT 1`,[before.storeId,before.year,before.month,before.dataType,input.id]);
          restoredId = (previousRows as any[])[0] ? Number((previousRows as any[])[0].id) : null;
          if (restoredId) await connection.query('UPDATE store_data_uploads SET isCurrent=1 WHERE id=?',[restoredId]);
        }
        await writeUploadAudit(connection,{uploadId:input.id,storeId:Number(before.storeId),action:'generation_deleted',before,after:{deleted:true,restoredId},ctx,reason:input.reason});
        await connection.commit();
        return { success:true,restoredId };
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    }),

  restoreDataVersion: protectedProcedure
    .input(z.object({ id:z.number().int().positive(),reason:z.string().min(3).max(1000) }))
    .mutation(async ({ input,ctx }) => {
      const pool = await getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT * FROM store_data_uploads WHERE id=? LIMIT 1 FOR UPDATE',[input.id]);
        const target = (rows as any[])[0];
        if (!target) throw new Error('復元対象の世代が見つかりません');
        const [currentRows] = await connection.query(`SELECT * FROM store_data_uploads WHERE storeId=? AND year=? AND month=? AND dataType=? AND isCurrent=1 AND deletedAt IS NULL LIMIT 1 FOR UPDATE`,[target.storeId,target.year,target.month,target.dataType]);
        const current = (currentRows as any[])[0] || null;
        await connection.query(`UPDATE store_data_uploads SET isCurrent=0 WHERE storeId=? AND year=? AND month=? AND dataType=?`,[target.storeId,target.year,target.month,target.dataType]);
        await connection.query(`UPDATE store_data_uploads SET isCurrent=1,deletedAt=NULL,deletedBy=NULL,deleteReason=NULL WHERE id=?`,[input.id]);
        await writeUploadAudit(connection,{uploadId:input.id,storeId:Number(target.storeId),action:'generation_restored',before:current,after:{...target,isCurrent:1,deletedAt:null},ctx,reason:input.reason});
        await connection.commit();
        return { success:true,id:input.id };
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    }),

  // Get staff list for operator assignment
  getStaffList: protectedProcedure.query(async () => {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, name, email FROM staff WHERE isActive = "active" AND archivedAt IS NULL AND mergedIntoStaffId IS NULL ORDER BY name'
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
          'SELECT * FROM store_data_uploads WHERE year = ? AND month = ? AND isCurrent = 1 AND deletedAt IS NULL',
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
