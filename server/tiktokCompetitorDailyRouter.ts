import { randomUUID } from 'node:crypto';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from './_core/trpc.js';
import { storagePut } from './storage.js';
import { ensureTikTokCompetitorDailyTables, getTikTokCompetitorDailyUpgradeHealth } from './tiktokCompetitorDailyUpgrade.js';
import {
  buildDeterministicSummary,
  canAccessCompetitorReport,
  canImportCompetitorRanking,
  calculateDiscountRate,
  parseKalodataRows,
  validateReportForSubmission,
  type RawRankingRow,
} from './tiktokCompetitorDaily.js';

let poolInstance: Pool | null = null;
async function getPool() {
  if (poolInstance) return poolInstance;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  poolInstance = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 6 });
  return poolInstance;
}

function actor(ctx: any) {
  return {
    id: Number(ctx.user?.id || 0) || null,
    name: String(ctx.user?.name || ctx.user?.email || `user:${ctx.user?.id || 'unknown'}`).slice(0, 255),
    email: String(ctx.user?.email || '').trim().toLowerCase(),
    isAdmin: ctx.user?.role === 'admin',
  };
}

function safeJson(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0,10);
  return String(value ?? '').slice(0,10);
}

async function actorStaff(pool: Pool | PoolConnection, ctx: any) {
  const current = actor(ctx);
  if (!current.email) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,name,email,department,country FROM staff
     WHERE LOWER(email)=? AND archivedAt IS NULL AND isActive='active' LIMIT 1`,
    [current.email],
  );
  return rows[0] || null;
}

async function morningOperators(pool: Pool | PoolConnection, date: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT s.id,s.name,s.email,s.department,s.country,ss.startTime,ss.endTime
       FROM staff_schedules ss
       JOIN staff s ON s.id=ss.staffId
      WHERE DATE(ss.date)=?
        AND ss.notes LIKE '%[早班]%'
        AND ss.notes NOT LIKE '%[请假]%'
        AND ss.notes NOT LIKE '%[休息]%'
        AND s.archivedAt IS NULL AND s.isActive='active'
        AND (s.department LIKE '%運営%' OR s.department LIKE '%运营%' OR s.department LIKE '%運營%' OR LOWER(s.department) LIKE '%operations%')
      ORDER BY ss.startTime,s.name`,
    [date],
  );
  return rows;
}

async function requireMorningOperatorOrAdmin(pool: Pool | PoolConnection, ctx: any, date: string) {
  const current = actor(ctx);
  if (current.isAdmin) return { current, staff: await actorStaff(pool, ctx) };
  const staff = await actorStaff(pool, ctx);
  if (!staff) throw new TRPCError({ code: 'FORBIDDEN', message: '登录账号尚未关联员工档案' });
  const operators = await morningOperators(pool, date);
  if (!canImportCompetitorRanking(false,Number(staff.id),operators.map((row)=>Number(row.id)))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '只有当天运营部早班人员或管理员可以导入排名' });
  }
  return { current, staff };
}

async function requireReportAccess(pool: Pool | PoolConnection, ctx: any, reportId: number, requireEditable = false) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM tiktok_competitor_reports WHERE id=? LIMIT 1`,
    [reportId],
  );
  const report = rows[0];
  if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: '日报不存在' });
  const current = actor(ctx);
  const staff = await actorStaff(pool, ctx);
  if (!canAccessCompetitorReport(current.isAdmin,staff ? Number(staff.id) : null,Number(report.assignedStaffId))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '只能查看或编辑本人的竞品日报' });
  }
  if (requireEditable && !['draft','returned'].includes(String(report.status))) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '已提交或已确认的日报不可直接修改' });
  }
  return report;
}

async function writeAudit(connection: Pool | PoolConnection, input: {
  entityType: 'snapshot'|'report'|'shop'|'product'|'sync'; entityId?: number | null; reportId?: number | null;
  action: string; before?: unknown; after?: unknown; ctx: any; reason?: string | null;
}) {
  const current = actor(input.ctx);
  await connection.query(
    `INSERT INTO tiktok_competitor_audit_logs
      (entityType,entityId,reportId,action,beforeJson,afterJson,actorId,actorName,reason)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [input.entityType,input.entityId || null,input.reportId || null,input.action,safeJson(input.before),safeJson(input.after),current.id,current.name,input.reason || null],
  );
}

async function reportStructure(pool: Pool | PoolConnection, reportId: number) {
  const [reportRows] = await pool.query<RowDataPacket[]>('SELECT * FROM tiktok_competitor_reports WHERE id=? LIMIT 1',[reportId]);
  const report = reportRows[0];
  if (!report) return null;
  const [shopRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM tiktok_competitor_report_shops WHERE reportId=? ORDER BY isPrimary DESC,rankingPosition,id',[reportId],
  );
  const [productRows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*,s.shopName,s.rankingPosition AS shopRankingPosition
       FROM tiktok_competitor_report_products p
       JOIN tiktok_competitor_report_shops s ON s.id=p.reportShopId
      WHERE p.reportId=? ORDER BY s.isPrimary DESC,s.rankingPosition,p.productRank`,
    [reportId],
  );
  const products = productRows.map((row) => ({
    ...row,
    originalPrice: row.originalPrice === null ? null : Number(row.originalPrice),
    livePrice: row.livePrice === null ? null : Number(row.livePrice),
    discountRate: row.discountRate === null ? null : Number(row.discountRate),
    unitsSold: row.unitsSold === null ? null : Number(row.unitsSold),
    gmv: row.gmv === null ? null : Number(row.gmv),
    clickRate: row.clickRate === null ? null : Number(row.clickRate),
    conversionRate: row.conversionRate === null ? null : Number(row.conversionRate),
    screenshotUrls: parseJson<string[]>(row.screenshotUrlsJson, []),
    screenshotKeys: parseJson<string[]>(row.screenshotKeysJson, []),
  }));
  const shops = shopRows.map((shop) => ({
    ...shop,
    isPrimary: Boolean(shop.isPrimary),
    unitsSold: shop.unitsSold === null ? null : Number(shop.unitsSold),
    gmv: shop.gmv === null ? null : Number(shop.gmv),
    products: products.filter((product:any) => Number(product.reportShopId) === Number(shop.id)),
  }));
  return { ...report, reportDate:dateOnly(report.reportDate), summary: parseJson(report.summaryJson, null), shops };
}

async function previousProduct(pool: Pool, reportDate: string, product: any) {
  if (!product.productName && !product.externalProductId) return null;
  const params: unknown[] = [reportDate, product.shopName];
  const identity = product.externalProductId
    ? 'p.externalProductId=?'
    : 'LOWER(TRIM(p.productName))=LOWER(TRIM(?))';
  params.push(product.externalProductId || product.productName);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.reportDate,p.originalPrice,p.livePrice,p.discountRate,p.unitsSold,p.gmv,p.clickRate,p.conversionRate
       FROM tiktok_competitor_report_products p
       JOIN tiktok_competitor_report_shops s ON s.id=p.reportShopId
       JOIN tiktok_competitor_reports r ON r.id=p.reportId
      WHERE r.reportDate<? AND LOWER(TRIM(s.shopName))=LOWER(TRIM(?)) AND ${identity}
      ORDER BY r.reportDate DESC,p.id DESC LIMIT 1`,
    params,
  );
  const row = rows[0];
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null || key === 'reportDate' ? value : Number(value)]));
}

const rankingRowsSchema = z.array(z.record(z.string(), z.any())).min(1).max(10000);
const optionalHttpUrl=z.string().max(1500).refine((value)=>{
  try{const parsed=new URL(value);return parsed.protocol==='https:'||parsed.protocol==='http:';}catch{return false;}
},'链接必须是HTTP或HTTPS地址').nullable();

export const tiktokCompetitorDailyRouter = router({
  connectionStatus: protectedProcedure.query(async () => ({
    provider: 'Kalodata',
    apiConfigured: Boolean(process.env.KALODATA_API_BASE_URL && process.env.KALODATA_API_KEY),
    exportImportReady: true,
    precisionNotice: 'Kalodata数值属于市场情报估算，不用于结算或员工绩效。',
    docsUrl: 'https://www.kalodata.com/open-center/docs',
  })),

  upgradeHealth: adminProcedure.query(async () => getTikTokCompetitorDailyUpgradeHealth()),

  taskStatus: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input, ctx }) => {
      const pool = await getPool();
      await ensureTikTokCompetitorDailyTables(pool);
      const current = actor(ctx);
      const staff = await actorStaff(pool, ctx);
      const operators = await morningOperators(pool, input.date);
      const [snapshotRows] = await pool.query<RowDataPacket[]>(
        `SELECT id,source,status,shopCount,productCount,importedAt FROM tiktok_competitor_ranking_snapshots
         WHERE snapshotDate=? AND market='JP' AND isCurrent=1 ORDER BY id DESC LIMIT 1`,
        [input.date],
      );
      const [reportRows] = await pool.query<RowDataPacket[]>(
        current.isAdmin
          ? `SELECT id,assignedStaffId,assignedStaffName,status,updatedAt FROM tiktok_competitor_reports WHERE reportDate=? AND market='JP' ORDER BY assignedStaffName`
          : `SELECT id,assignedStaffId,assignedStaffName,status,updatedAt FROM tiktok_competitor_reports WHERE reportDate=? AND market='JP' AND assignedStaffId=? ORDER BY assignedStaffName`,
        current.isAdmin ? [input.date] : [input.date, Number(staff?.id || 0)],
      );
      return {
        date: input.date,
        isAdmin: current.isAdmin,
        currentStaffId: staff ? Number(staff.id) : null,
        isMorningOperator: Boolean(staff && operators.some((row) => Number(row.id) === Number(staff.id))),
        morningOperators: operators.map((row) => ({ id: Number(row.id), name: String(row.name), startTime: row.startTime, endTime: row.endTime })),
        rankingSnapshot: snapshotRows[0] || null,
        reports: reportRows,
      };
    }),

  previewImport: protectedProcedure
    .input(z.object({ rows: rankingRowsSchema }))
    .mutation(({ input }) => {
      const parsed = parseKalodataRows(input.rows as RawRankingRow[]);
      return {
        recognizedRows: parsed.recognizedRows,
        excludedRows: parsed.excludedRows,
        warnings: parsed.warnings,
        shops: parsed.top5.map((shop) => ({
          ...shop,
          raw: undefined,
          products: shop.products.map((product) => ({ ...product, raw: undefined })),
        })),
      };
    }),

  uploadRankingFile: protectedProcedure
    .input(z.object({
      date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fileName:z.string().min(1).max(255),
      mimeType:z.string().max(150),
      dataBase64:z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      await ensureTikTokCompetitorDailyTables(pool);
      await requireMorningOperatorOrAdmin(pool,ctx,input.date);
      const extension = input.fileName.split('.').pop()?.toLowerCase();
      if (!extension || !['csv','xlsx','xls'].includes(extension)) throw new TRPCError({code:'BAD_REQUEST',message:'只支持Kalodata导出的CSV、XLSX或XLS文件'});
      const buffer = Buffer.from(input.dataBase64,'base64');
      if (!buffer.length || buffer.length > 20*1024*1024) throw new TRPCError({code:'BAD_REQUEST',message:'排名文件必须小于20MB'});
      const key = `tiktok-competitor-daily/rankings/${input.date}/${Date.now()}-${randomUUID()}.${extension}`;
      const saved = await storagePut(key,buffer,input.mimeType || 'application/octet-stream');
      await writeAudit(pool,{entityType:'sync',entityId:null,action:'ranking_source_uploaded',after:{date:input.date,key:saved.key || key,fileName:input.fileName,size:buffer.length},ctx});
      return {url:saved.url,key:saved.key || key};
    }),

  commitImport: protectedProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      source: z.enum(['kalodata_export','manual']).default('kalodata_export'),
      fileName: z.string().max(255).optional(),
      fileUrl: z.string().max(1200).optional(),
      fileKey: z.string().max(700).optional(),
      rows: rankingRowsSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      await ensureTikTokCompetitorDailyTables(pool);
      await requireMorningOperatorOrAdmin(pool, ctx, input.date);
      const parsed = parseKalodataRows(input.rows as RawRankingRow[]);
      if (!parsed.recognizedRows || !parsed.top5.length) throw new TRPCError({ code: 'BAD_REQUEST', message: '没有识别到包含店铺名称的排名数据' });
      const connection = await pool.getConnection();
      const current = actor(ctx);
      let syncLogId = 0;
      try {
        await connection.beginTransaction();
        const [syncResult] = await connection.query(
          `INSERT INTO tiktok_competitor_sync_logs
            (snapshotDate,market,source,status,queryJson,sourceFileName,rowCount,shopCount,productCount,actorId,actorName)
           VALUES (?,'JP',?,'running',?,?,?,?,?,?,?)`,
          [input.date,input.source,safeJson({ market:'JP',strategy:'top5-shops-top3-products' }),input.fileName || null,input.rows.length,parsed.shops.length,parsed.top5.reduce((sum,shop)=>sum+shop.products.length,0),current.id,current.name],
        );
        syncLogId = Number((syncResult as any).insertId);
        const [oldRows] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM tiktok_competitor_ranking_snapshots WHERE snapshotDate=? AND market='JP' AND isCurrent=1 ORDER BY id DESC LIMIT 1`,
          [input.date],
        );
        const oldId = oldRows[0] ? Number(oldRows[0].id) : null;
        await connection.query(`UPDATE tiktok_competitor_ranking_snapshots SET isCurrent=0 WHERE snapshotDate=? AND market='JP' AND isCurrent=1`,[input.date]);
        const [snapshotResult] = await connection.query(
          `INSERT INTO tiktok_competitor_ranking_snapshots
            (snapshotDate,market,source,sourceFileName,sourceFileUrl,sourceFileKey,queryJson,status,rowCount,shopCount,productCount,isCurrent,supersedesId,importedById,importedByName)
           VALUES (?,'JP',?,?,?,?,?,'success',?,?,?,1,?,?,?)`,
          [input.date,input.source,input.fileName || null,input.fileUrl || null,input.fileKey || null,safeJson({ market:'JP',strategy:'top5-shops-top3-products' }),input.rows.length,parsed.shops.length,parsed.top5.reduce((sum,shop)=>sum+shop.products.length,0),oldId,current.id,current.name],
        );
        const snapshotId = Number((snapshotResult as any).insertId);
        const insertedShopIds = new Map<number, number>();
        for (const shop of parsed.shops) {
          const [shopResult] = await connection.query(
            `INSERT INTO tiktok_competitor_shop_rankings
              (snapshotId,externalShopId,shopName,shopUrl,rankingPosition,unitsSold,gmv,revenueGrowthRate,currency,isPrimaryTop5,rawJson)
             VALUES (?,?,?,?,?,?,?,?, 'JPY',?,?)`,
            [snapshotId,shop.externalShopId,shop.shopName,shop.shopUrl,shop.rankingPosition,shop.unitsSold,shop.gmv,shop.revenueGrowthRate,shop.rankingPosition <= 5 ? 1 : 0,safeJson(shop.raw)],
          );
          insertedShopIds.set(shop.rankingPosition, Number((shopResult as any).insertId));
        }
        const operators = await morningOperators(connection, input.date);
        const reportIds: number[] = [];
        for (const operator of operators) {
          await connection.query(
            `INSERT INTO tiktok_competitor_reports
              (reportDate,market,rankingSnapshotId,assignedStaffId,assignedStaffName,status,createdById,createdByName)
             VALUES (?,'JP',?,?,?,'draft',?,?)
             ON DUPLICATE KEY UPDATE
               rankingSnapshotId=IF(status IN ('draft','returned'),VALUES(rankingSnapshotId),rankingSnapshotId),
               assignedStaffName=VALUES(assignedStaffName)`,
            [input.date,snapshotId,Number(operator.id),String(operator.name),current.id,current.name],
          );
          const [reportRows] = await connection.query<RowDataPacket[]>(
            `SELECT id,status FROM tiktok_competitor_reports WHERE reportDate=? AND market='JP' AND assignedStaffId=? LIMIT 1`,
            [input.date,Number(operator.id)],
          );
          const report = reportRows[0];
          if (!report) continue;
          const reportId = Number(report.id);
          reportIds.push(reportId);
          if (!['draft','returned'].includes(String(report.status))) continue;
          await connection.query('DELETE FROM tiktok_competitor_report_products WHERE reportId=?',[reportId]);
          await connection.query('DELETE FROM tiktok_competitor_report_shops WHERE reportId=?',[reportId]);
          for (const shop of parsed.top5) {
            const [reportShopResult] = await connection.query(
              `INSERT INTO tiktok_competitor_report_shops
                (reportId,shopRankingId,externalShopId,shopName,shopUrl,rankingPosition,unitsSold,gmv,isPrimary)
               VALUES (?,?,?,?,?,?,?,?,1)`,
              [reportId,insertedShopIds.get(shop.rankingPosition) || null,shop.externalShopId,shop.shopName,shop.shopUrl,shop.rankingPosition,shop.unitsSold,shop.gmv],
            );
            const reportShopId = Number((reportShopResult as any).insertId);
            for (let index = 0; index < 3; index += 1) {
              const product = shop.products[index] || null;
              await connection.query(
                `INSERT INTO tiktok_competitor_report_products
                  (reportId,reportShopId,productRank,externalProductId,productName,productUrl,originalPrice,livePrice,discountRate,unitsSold,gmv,clickRate,conversionRate,heatEvidence,screenshotUrlsJson,screenshotKeysJson,sourceJson)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,JSON_ARRAY(),JSON_ARRAY(),?)`,
                [reportId,reportShopId,index+1,product?.externalProductId || null,product?.productName || null,product?.productUrl || null,product?.originalPrice ?? null,product?.livePrice ?? null,calculateDiscountRate(product?.originalPrice ?? null,product?.livePrice ?? null),product?.unitsSold ?? null,product?.gmv ?? null,product?.clickRate ?? null,product?.conversionRate ?? null,product?.heatEvidence || null,safeJson(product?.raw || null)],
              );
            }
          }
          await writeAudit(connection,{ entityType:'report',entityId:reportId,reportId,action:'report_generated_from_ranking',after:{ snapshotId,shopCount:parsed.top5.length,productSlots:15 },ctx });
        }
        await connection.query(
          `UPDATE tiktok_competitor_sync_logs SET status='success',completedAt=CURRENT_TIMESTAMP,rowCount=?,shopCount=?,productCount=? WHERE id=?`,
          [input.rows.length,parsed.shops.length,parsed.top5.reduce((sum,shop)=>sum+shop.products.length,0),syncLogId],
        );
        await writeAudit(connection,{ entityType:'snapshot',entityId:snapshotId,action:'ranking_imported',after:{ date:input.date,shops:parsed.shops.length,top5:parsed.top5.map(shop=>shop.shopName),reportIds },ctx });
        await connection.commit();
        return { snapshotId,reportIds,morningOperatorCount:operators.length,top5:parsed.top5.map((shop)=>shop.shopName),warnings:parsed.warnings };
      } catch (error) {
        await connection.rollback();
        if (syncLogId) {
          await pool.query(
            `UPDATE tiktok_competitor_sync_logs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorCode='IMPORT_FAILED',errorMessage=? WHERE id=?`,
            [String(error instanceof Error ? error.message : error).slice(0,4000),syncLogId],
          ).catch(()=>undefined);
        }
        throw error;
      } finally {
        connection.release();
      }
    }),

  getReport: protectedProcedure
    .input(z.object({ reportId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const pool = await getPool();
      await ensureTikTokCompetitorDailyTables(pool);
      const report = await requireReportAccess(pool, ctx, input.reportId);
      const structure = await reportStructure(pool, input.reportId);
      if (!structure) throw new TRPCError({ code:'NOT_FOUND',message:'日报不存在' });
      for (const shop of structure.shops) {
        for (const product of shop.products as any[]) product.previous = await previousProduct(pool,dateOnly(report.reportDate),product);
      }
      return structure;
    }),

  listReports: protectedProcedure
    .input(z.object({ startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input, ctx }) => {
      const pool = await getPool();
      await ensureTikTokCompetitorDailyTables(pool);
      const current = actor(ctx);
      const staff = await actorStaff(pool, ctx);
      const [rows] = await pool.query<RowDataPacket[]>(
        current.isAdmin
          ? `SELECT r.*,COUNT(DISTINCT CASE WHEN s.isPrimary=1 THEN s.id END) AS shopCount,SUM(CASE WHEN s.isPrimary=1 THEN 1 ELSE 0 END) AS productCount,SUM(CASE WHEN s.isPrimary=1 AND p.productName IS NOT NULL AND p.productName<>'' THEN 1 ELSE 0 END) AS completedProductCount,GROUP_CONCAT(DISTINCT CASE WHEN s.isPrimary=1 THEN s.shopName END ORDER BY s.rankingPosition SEPARATOR '||') AS shopNamesText
             FROM tiktok_competitor_reports r LEFT JOIN tiktok_competitor_report_shops s ON s.reportId=r.id LEFT JOIN tiktok_competitor_report_products p ON p.reportId=r.id
            WHERE r.reportDate BETWEEN ? AND ? GROUP BY r.id ORDER BY r.reportDate DESC,r.assignedStaffName`
          : `SELECT r.*,COUNT(DISTINCT CASE WHEN s.isPrimary=1 THEN s.id END) AS shopCount,SUM(CASE WHEN s.isPrimary=1 THEN 1 ELSE 0 END) AS productCount,SUM(CASE WHEN s.isPrimary=1 AND p.productName IS NOT NULL AND p.productName<>'' THEN 1 ELSE 0 END) AS completedProductCount,GROUP_CONCAT(DISTINCT CASE WHEN s.isPrimary=1 THEN s.shopName END ORDER BY s.rankingPosition SEPARATOR '||') AS shopNamesText
             FROM tiktok_competitor_reports r LEFT JOIN tiktok_competitor_report_shops s ON s.reportId=r.id LEFT JOIN tiktok_competitor_report_products p ON p.reportId=r.id
            WHERE r.reportDate BETWEEN ? AND ? AND r.assignedStaffId=? GROUP BY r.id ORDER BY r.reportDate DESC`,
        current.isAdmin ? [input.startDate,input.endDate] : [input.startDate,input.endDate,Number(staff?.id || 0)],
      );
      return rows.map((row)=>({ ...row,reportDate:dateOnly(row.reportDate),shopCount:Number(row.shopCount||0),productCount:Number(row.productCount||0),completedProductCount:Number(row.completedProductCount||0),shopNames:String(row.shopNamesText||'').split('||').filter(Boolean),summary:parseJson(row.summaryJson,null) }));
    }),

  managementOverview: adminProcedure
    .input(z.object({startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}))
    .query(async ({input})=>{
      const pool=await getPool();
      await ensureTikTokCompetitorDailyTables(pool);
      const [summaryRows]=await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS totalReports,COUNT(DISTINCT assignedStaffId) AS operatorCount,
          SUM(status='draft') AS draftCount,SUM(status='submitted') AS submittedCount,SUM(status='returned') AS returnedCount,SUM(status='approved') AS approvedCount
         FROM tiktok_competitor_reports WHERE reportDate BETWEEN ? AND ?`,
        [input.startDate,input.endDate],
      );
      const [shopRows]=await pool.query<RowDataPacket[]>(
        `SELECT s.shopName,MIN(s.rankingPosition) AS bestRank,COUNT(DISTINCT r.reportDate) AS observedDays,MAX(s.unitsSold) AS maxUnitsSold,MAX(s.gmv) AS maxGmv
           FROM tiktok_competitor_report_shops s JOIN tiktok_competitor_reports r ON r.id=s.reportId
          WHERE r.reportDate BETWEEN ? AND ? AND s.isPrimary=1
          GROUP BY s.shopName ORDER BY bestRank ASC,maxGmv DESC LIMIT 10`,
        [input.startDate,input.endDate],
      );
      const [productRows]=await pool.query<RowDataPacket[]>(
        `SELECT s.shopName,p.productName,COUNT(DISTINCT r.reportDate) AS observedDays,MAX(p.unitsSold) AS maxUnitsSold,MAX(p.gmv) AS maxGmv,MAX(p.clickRate) AS maxClickRate,AVG(p.livePrice) AS averageLivePrice
           FROM tiktok_competitor_report_products p JOIN tiktok_competitor_report_shops s ON s.id=p.reportShopId JOIN tiktok_competitor_reports r ON r.id=p.reportId
          WHERE r.reportDate BETWEEN ? AND ? AND s.isPrimary=1 AND p.productName IS NOT NULL AND p.productName<>''
          GROUP BY s.shopName,p.productName ORDER BY maxUnitsSold DESC,maxGmv DESC LIMIT 10`,
        [input.startDate,input.endDate],
      );
      const summary=summaryRows[0]||{};
      return{
        summary:{totalReports:Number(summary.totalReports||0),operatorCount:Number(summary.operatorCount||0),draftCount:Number(summary.draftCount||0),submittedCount:Number(summary.submittedCount||0),returnedCount:Number(summary.returnedCount||0),approvedCount:Number(summary.approvedCount||0)},
        topShops:shopRows.map(row=>({...row,bestRank:Number(row.bestRank),observedDays:Number(row.observedDays),maxUnitsSold:row.maxUnitsSold===null?null:Number(row.maxUnitsSold),maxGmv:row.maxGmv===null?null:Number(row.maxGmv)})),
        topProducts:productRows.map(row=>({...row,observedDays:Number(row.observedDays),maxUnitsSold:row.maxUnitsSold===null?null:Number(row.maxUnitsSold),maxGmv:row.maxGmv===null?null:Number(row.maxGmv),maxClickRate:row.maxClickRate===null?null:Number(row.maxClickRate),averageLivePrice:row.averageLivePrice===null?null:Number(row.averageLivePrice)})),
      };
    }),

  addObservedShop: protectedProcedure
    .input(z.object({reportId:z.number().int().positive(),shopName:z.string().min(1).max(500),shopUrl:optionalHttpUrl.optional()}))
    .mutation(async ({input,ctx})=>{
      const pool=await getPool();
      await requireReportAccess(pool,ctx,input.reportId,true);
      const [rankRows]=await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(rankingPosition),99)+1 AS nextRank FROM tiktok_competitor_report_shops WHERE reportId=?',[input.reportId]);
      const rankingPosition=Math.max(100,Number(rankRows[0]?.nextRank||100));
      const [result]=await pool.query(
        `INSERT INTO tiktok_competitor_report_shops (reportId,shopName,shopUrl,rankingPosition,isPrimary) VALUES (?,?,?,?,0)`,
        [input.reportId,input.shopName.trim(),input.shopUrl?.trim()||null,rankingPosition],
      );
      const reportShopId=Number((result as any).insertId);
      for(let productRank=1;productRank<=3;productRank+=1){
        await pool.query(
          `INSERT INTO tiktok_competitor_report_products (reportId,reportShopId,productRank,screenshotUrlsJson,screenshotKeysJson) VALUES (?,?,?,JSON_ARRAY(),JSON_ARRAY())`,
          [input.reportId,reportShopId,productRank],
        );
      }
      await writeAudit(pool,{entityType:'shop',entityId:reportShopId,reportId:input.reportId,action:'observed_shop_added',after:{shopName:input.shopName,shopUrl:input.shopUrl||null,rankingPosition},ctx});
      return{reportShopId,rankingPosition};
    }),

  saveProduct: protectedProcedure
    .input(z.object({
      id:z.number().int().positive(),reportId:z.number().int().positive(),productName:z.string().max(700).nullable(),externalProductId:z.string().max(255).nullable().optional(),
      productUrl:optionalHttpUrl,originalPrice:z.number().min(0).nullable(),livePrice:z.number().min(0).nullable(),unitsSold:z.number().min(0).nullable(),
      gmv:z.number().min(0).nullable(),clickRate:z.number().min(0).max(1).nullable(),conversionRate:z.number().min(0).max(1).nullable(),heatEvidence:z.string().max(1000).nullable(),
      screenshotUrls:z.array(z.string().url().max(1500)).max(6),screenshotKeys:z.array(z.string().max(700)).max(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      await requireReportAccess(pool,ctx,input.reportId,true);
      const [beforeRows] = await pool.query<RowDataPacket[]>('SELECT * FROM tiktok_competitor_report_products WHERE id=? AND reportId=? LIMIT 1',[input.id,input.reportId]);
      const before = beforeRows[0];
      if (!before) throw new TRPCError({ code:'NOT_FOUND',message:'商品记录不存在' });
      const discountRate = calculateDiscountRate(input.originalPrice,input.livePrice);
      await pool.query(
        `UPDATE tiktok_competitor_report_products SET externalProductId=?,productName=?,productUrl=?,originalPrice=?,livePrice=?,discountRate=?,unitsSold=?,gmv=?,clickRate=?,conversionRate=?,heatEvidence=?,screenshotUrlsJson=?,screenshotKeysJson=? WHERE id=? AND reportId=?`,
        [input.externalProductId || null,input.productName?.trim() || null,input.productUrl?.trim() || null,input.originalPrice,input.livePrice,discountRate,input.unitsSold,input.gmv,input.clickRate,input.conversionRate,input.heatEvidence?.trim() || null,safeJson(input.screenshotUrls),safeJson(input.screenshotKeys),input.id,input.reportId],
      );
      await writeAudit(pool,{entityType:'product',entityId:input.id,reportId:input.reportId,action:'product_saved',before,after:{...input,discountRate},ctx});
      return { success:true,discountRate };
    }),

  saveReportNotes: protectedProcedure
    .input(z.object({ reportId:z.number().int().positive(),operatorNotes:z.string().max(10000) }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const before = await requireReportAccess(pool,ctx,input.reportId,true);
      await pool.query('UPDATE tiktok_competitor_reports SET operatorNotes=?,patrolStartedAt=COALESCE(patrolStartedAt,CURRENT_TIMESTAMP) WHERE id=?',[input.operatorNotes.trim() || null,input.reportId]);
      await writeAudit(pool,{entityType:'report',entityId:input.reportId,reportId:input.reportId,action:'notes_saved',before:{operatorNotes:before.operatorNotes},after:{operatorNotes:input.operatorNotes},ctx});
      return { success:true };
    }),

  uploadScreenshot: protectedProcedure
    .input(z.object({ reportId:z.number().int().positive(),fileName:z.string().min(1).max(180),mimeType:z.enum(['image/jpeg','image/png','image/webp']),dataBase64:z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      await requireReportAccess(pool,ctx,input.reportId,true);
      const buffer = Buffer.from(input.dataBase64,'base64');
      if (!buffer.length || buffer.length > 8*1024*1024) throw new TRPCError({code:'BAD_REQUEST',message:'截图必须小于8MB'});
      const extension = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const key = `tiktok-competitor-daily/${input.reportId}/${Date.now()}-${randomUUID()}.${extension}`;
      const saved = await storagePut(key,buffer,input.mimeType);
      await writeAudit(pool,{entityType:'report',entityId:input.reportId,reportId:input.reportId,action:'screenshot_uploaded',after:{key:saved.key || key,fileName:input.fileName,size:buffer.length},ctx});
      return { url:saved.url,key:saved.key || key };
    }),

  submitReport: protectedProcedure
    .input(z.object({ reportId:z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      await requireReportAccess(pool,ctx,input.reportId,true);
      const structure = await reportStructure(pool,input.reportId);
      if (!structure) throw new TRPCError({code:'NOT_FOUND',message:'日报不存在'});
      const validation = validateReportForSubmission(structure.shops);
      if (!validation.valid) throw new TRPCError({code:'BAD_REQUEST',message:validation.errors.slice(0,8).join('；')});
      const products = structure.shops.filter((shop:any)=>shop.isPrimary).flatMap((shop:any)=>shop.products);
      for(const product of products) product.previous=await previousProduct(pool,dateOnly(structure.reportDate),product);
      const summary = buildDeterministicSummary(products);
      await pool.query(`UPDATE tiktok_competitor_reports SET status='submitted',summaryJson=?,patrolCompletedAt=CURRENT_TIMESTAMP,submittedAt=CURRENT_TIMESTAMP,returnReason=NULL WHERE id=?`,[safeJson(summary),input.reportId]);
      await writeAudit(pool,{entityType:'report',entityId:input.reportId,reportId:input.reportId,action:'report_submitted',after:{summary},ctx});
      return { success:true,summary };
    }),

  reviewReport: adminProcedure
    .input(z.object({ reportId:z.number().int().positive(),action:z.enum(['return','approve']),reason:z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const before = await requireReportAccess(pool,ctx,input.reportId,false);
      if (String(before.status) !== 'submitted') throw new TRPCError({code:'BAD_REQUEST',message:'只有已提交日报可以审核'});
      const current = actor(ctx);
      if (input.action === 'approve') {
        await pool.query(`UPDATE tiktok_competitor_reports SET status='approved',approvedAt=CURRENT_TIMESTAMP,approvedById=?,approvedByName=?,returnReason=NULL WHERE id=?`,[current.id,current.name,input.reportId]);
      } else {
        if (!input.reason?.trim()) throw new TRPCError({code:'BAD_REQUEST',message:'退回时必须填写原因'});
        await pool.query(`UPDATE tiktok_competitor_reports SET status='returned',returnReason=?,approvedAt=NULL,approvedById=NULL,approvedByName=NULL WHERE id=?`,[input.reason.trim(),input.reportId]);
      }
      await writeAudit(pool,{entityType:'report',entityId:input.reportId,reportId:input.reportId,action:input.action==='approve'?'report_approved':'report_returned',before:{status:before.status},after:{status:input.action==='approve'?'approved':'returned'},ctx,reason:input.reason});
      return { success:true };
    }),

  syncLogs: adminProcedure
    .input(z.object({ limit:z.number().int().min(1).max(100).default(30) }))
    .query(async ({ input }) => {
      const pool = await getPool();
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM tiktok_competitor_sync_logs ORDER BY id DESC LIMIT ?',[input.limit]);
      return rows;
    }),
});
