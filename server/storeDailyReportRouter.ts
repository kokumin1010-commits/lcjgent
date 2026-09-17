import { TRPCError } from "@trpc/server";
import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { buildStoreKpiSnapshot } from "./storeExecutionRouter";
import { getUserManagementAccess } from "./userManagementAccess";
import { ensureStoreBusinessUpgradeReady } from "./storeBusinessUpgrade";
import { ensurePerformanceTables } from "./performanceUpgrade";
import {
  calculateActualSales,
  createEmptyStoreDailyReportPayload,
  diffStoreDailyReportPayload,
  normalizeStoreDailyReportPayload,
  STORE_DAILY_REPORT_LIST_ITEM_LIMIT,
  STORE_DAILY_REPORT_LONG_TEXT_LIMIT,
  type MetricMeta,
  type StoreDailyCoreData,
  type StoreDailyReportPayload,
} from "../shared/storeBusiness";

let poolInstance: mysql.Pool | null = null;
function pool() {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    poolInstance = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return poolInstance;
}

async function readyPool() {
  await ensureStoreBusinessUpgradeReady();
  const db = await getDb();
  if (db) {
    const effectiveFrom = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
    await ensurePerformanceTables(db, effectiveFrom);
  }
  return pool();
}

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonNegative = z.number().finite().min(0);
const nullableMetric = nonNegative.nullable();
const itemPriority = z.enum(["low", "medium", "high", "critical"]);
const metricMetaSchema = z.object({
  status: z.enum(["actual", "manual", "adjusted", "missing"]),
  source: z.string().max(100),
  sourceLabel: z.string().max(255),
  sourceUpdatedAt: z.string().nullable(),
  originalValue: z.number().finite().nullable(),
  adjustmentReason: z.string().max(1000),
});
const businessAttributedSalesSchema = z.object({
  entries: z.array(z.object({
    attributionId: z.number().int().positive(),
    staffId: z.number().int().positive(),
    staffName: z.string().max(255),
    amount: z.number().finite(),
    currency: z.string().max(10),
    entryType: z.enum(["credit", "reversal"]),
    sourceType: z.string().max(64),
    sourceId: z.string().max(128),
    reliability: z.string().max(32),
  })).max(1000),
  totalsByCurrency: z.array(z.object({
    currency: z.string().max(10),
    amount: z.number().finite(),
    entryCount: z.number().int().min(0),
  })).max(50),
  confirmedCount: z.number().int().min(0),
  unattributedContractCount: z.number().int().min(0),
  attributionRule: z.string().max(1000),
  totalGmvAllocated: z.literal(false),
  livestreamGmvAllocated: z.literal(false),
  readOnly: z.literal(true),
});
const coreSchema = z.object({
  totalGmv: nullableMetric,
  actualSales: nullableMetric,
  refundAmount: nullableMetric,
  adSpend: nullableMetric,
  creatorOutreach: nullableMetric,
  creatorContactCount: nullableMetric,
  creatorReplies: nullableMetric,
  creatorCollaborations: nullableMetric,
});
const ownerItem = z.object({
  title: z.string().trim().min(1).max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
  ownerStaffId: z.number().int().positive().nullable(),
  ownerName: z.string().max(255),
  dueDate: dateText.nullable(),
  priority: itemPriority,
});
const payloadSchema = z.object({
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  core: coreSchema,
  metricMeta: z.record(z.string(), metricMetaSchema).default({}),
  businessAttributedSales: businessAttributedSalesSchema.default(
    createEmptyStoreDailyReportPayload().businessAttributedSales
  ),
  content: z.object({
    liveSessions: z.number().int().min(0),
    liveMinutes: z.number().int().min(0),
    liveGmv: nonNegative,
    shortVideos: z.number().int().min(0),
    shortVideoGmv: nonNegative,
  }),
  products: z.object({
    linkOptimizations: z.number().int().min(0),
    newLinks: z.number().int().min(0),
    links: z
      .array(
        z.object({
          name: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
          url: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
          readyToSell: z.boolean(),
        })
      )
      .max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
    inventoryChanges: z.number().int().min(0),
    priceChanges: z
      .array(
        z.object({
          sku: z.string().max(1000),
          reason: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
        })
      )
      .max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
    negativeReviews: z.number().int().min(0),
    negativeReviewHandled: z.boolean(),
    customerQuestions: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
  }),
  supply: z.object({
    replenishments: z
      .array(
        z.object({
          sku: z.string().max(1000),
          quantity: z.number().int().min(0),
          ownerStaffId: z.number().int().positive().nullable(),
          ownerName: z.string().max(255),
        })
      )
      .max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
    riskSkus: z
      .array(
        z.object({
          sku: z.string().max(1000),
          reason: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
          ownerStaffId: z.number().int().positive().nullable(),
          ownerName: z.string().max(255),
        })
      )
      .max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
    samplesReceived: z.number().int().min(0),
    samplesSent: z.number().int().min(0),
  }),
  execution: z.object({
    completedItems: z
      .array(z.string().trim().min(1).max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT))
      .max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
    issuesRisks: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
    actionsTaken: z.string().max(STORE_DAILY_REPORT_LONG_TEXT_LIMIT),
    tomorrowItems: z.array(ownerItem).max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
    supportItems: z.array(ownerItem).max(STORE_DAILY_REPORT_LIST_ITEM_LIMIT),
  }),
});

function actor(ctx: any) {
  return {
    id: Number(ctx?.user?.id || 0) || null,
    name: String(
      ctx?.user?.name ||
        ctx?.user?.email ||
        ctx?.user?.openId ||
        "authenticated-user"
    ).slice(0, 255),
  };
}

function dateOnly(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parsePayload(value: unknown) {
  if (value && typeof value === "object")
    return normalizeStoreDailyReportPayload(value as any);
  if (typeof value === "string") {
    try {
      return normalizeStoreDailyReportPayload(JSON.parse(value));
    } catch {
      return createEmptyStoreDailyReportPayload();
    }
  }
  return createEmptyStoreDailyReportPayload();
}

async function getStore(
  connection: PoolConnection | mysql.Pool,
  storeId: number
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,brandId,name,operatorId,operatorName,operator2Id,operator2Name
       FROM managed_stores WHERE id=? AND isActive=1 LIMIT 1`,
    [storeId]
  );
  const store = rows[0];
  if (!store)
    throw new TRPCError({ code: "NOT_FOUND", message: "店铺不存在或已归档" });
  return store;
}

async function getAccess(
  ctx: any,
  connection: PoolConnection | mysql.Pool,
  store: any
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "数据库暂不可用",
    });
  const access = await getUserManagementAccess(db, Number(ctx.user.id));
  const [staffRows] = await connection.query<RowDataPacket[]>(
    `SELECT staff.id
       FROM users
       JOIN staff ON LOWER(staff.email)=LOWER(users.email) AND staff.mergedIntoStaffId IS NULL
      WHERE users.id=? ORDER BY staff.id LIMIT 1`,
    [Number(ctx.user.id)]
  );
  const staffId = staffRows[0]?.id ? Number(staffRows[0].id) : null;
  const operatorIds = [
    Number(store.operatorId || 0),
    Number(store.operator2Id || 0),
  ].filter(Boolean);
  return {
    ...access,
    staffId,
    canEdit:
      access.isSuperAdmin || Boolean(staffId && operatorIds.includes(staffId)),
  };
}

function requireEdit(access: { canEdit: boolean }) {
  if (!access.canEdit)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "仅本店负责人或超级管理员可以编辑店长日报",
    });
}

async function getBusinessAttributedSales(
  p: mysql.Pool,
  store: any,
  reportDate: string
): Promise<StoreDailyReportPayload["businessAttributedSales"]> {
  const [attributionRows, contractRows, activeContractRows] = await Promise.all([
    p.query<RowDataPacket[]>(
      `SELECT attribution.id,attribution.staffId,member.name AS staffName,
              attribution.amount,attribution.currency,attribution.entryType,
              attribution.sourceType,attribution.sourceId,attribution.reliability
         FROM performance_business_sales_attributions attribution
         JOIN staff member ON member.id=attribution.staffId
          AND member.isActive='active' AND member.archivedAt IS NULL AND member.mergedIntoStaffId IS NULL
        WHERE attribution.storeId=? AND attribution.businessDate=?
          AND attribution.status='confirmed'
        ORDER BY member.name,attribution.id`,
      [store.id, reportDate]
    ),
    store.brandId
      ? p.query<RowDataPacket[]>(
          `SELECT contract.id
             FROM brand_contracts contract
            WHERE contract.brandId=? AND contract.deletedAt IS NULL
              AND contract.fixedFee IS NOT NULL AND contract.fixedFee>0
              AND DATE(COALESCE(contract.startDate,contract.createdAt))=?`,
          [store.brandId, reportDate]
        )
      : Promise.resolve([[] as RowDataPacket[], []] as any),
    store.brandId
      ? p.query<RowDataPacket[]>(
          `SELECT credit.sourceId
             FROM performance_business_sales_attributions credit
             LEFT JOIN performance_business_sales_attributions reversal
               ON reversal.reversesAttributionId=credit.id
              AND reversal.entryType='reversal' AND reversal.status='confirmed'
            WHERE credit.sourceType='brand_contract'
              AND credit.entryType='credit' AND credit.status='confirmed'
              AND reversal.id IS NULL
            GROUP BY credit.sourceId`
        )
      : Promise.resolve([[] as RowDataPacket[], []] as any),
  ]);
  const entries = (attributionRows[0] as any[]).map(row => ({
    attributionId: Number(row.id),
    staffId: Number(row.staffId),
    staffName: String(row.staffName),
    amount: Number(row.amount || 0),
    currency: String(row.currency || "JPY").toUpperCase(),
    entryType: String(row.entryType) === "reversal" ? "reversal" as const : "credit" as const,
    sourceType: String(row.sourceType),
    sourceId: String(row.sourceId),
    reliability: String(row.reliability),
  }));
  const totals = new Map<string, { amount: number; entryCount: number }>();
  for (const entry of entries) {
    const current = totals.get(entry.currency) || { amount: 0, entryCount: 0 };
    const signedAmount = entry.entryType === "reversal" ? -entry.amount : entry.amount;
    totals.set(entry.currency, {
      amount: Math.round((current.amount + signedAmount) * 100) / 100,
      entryCount: current.entryCount + 1,
    });
  }
  const activeContractSourceIds = new Set(
    (activeContractRows[0] as any[]).map(row => String(row.sourceId)),
  );
  const unattributedContractCount = (contractRows[0] as any[])
    .filter(row => !activeContractSourceIds.has(String(row.id))).length;
  return {
    entries,
    totalsByCurrency: [...totals.entries()].map(([currency, value]) => ({ currency, ...value })),
    confirmedCount: entries.length,
    unattributedContractCount,
    attributionRule: "仅统计管理员确认且具备员工、金额、业务日期与证据的销售；不分摊店铺或直播GMV。",
    totalGmvAllocated: false,
    livestreamGmvAllocated: false,
    readOnly: true,
  };
}

async function getAutomaticCore(store: any, reportDate: string) {
  const snapshot = await buildStoreKpiSnapshot(
    Number(store.id),
    reportDate,
    reportDate
  );
  const shopEvidence = snapshot.evidence.filter(
    (item: any) =>
      item.dataType === "shop_stats" && Number(item.usedRows || 0) > 0
  );
  const adEvidence = snapshot.evidence.filter(
    (item: any) => item.dataType === "ads" && Number(item.usedRows || 0) > 0
  );
  const p = await readyPool();
  const [brandCountRows] = store.brandId
    ? await p.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM managed_stores WHERE brandId=? AND isActive=1",
        [store.brandId]
      )
    : ([[] as RowDataPacket[], []] as any);
  const brandStoreCount = Number((brandCountRows as any[])?.[0]?.count || 0);
  const allowBrandFallback = brandStoreCount <= 1;
  const [creatorRows, adPlanRows, businessAttributedSales] = await Promise.all([
    store.brandId
      ? p.query<RowDataPacket[]>(
          `SELECT COUNT(outreach.id) AS sourceCount,
                  COUNT(DISTINCT outreach.creatorId) AS creatorOutreach,
                  COALESCE(SUM(outreach.contactCount),0) AS creatorContactCount,
                  COUNT(DISTINCT CASE WHEN outreach.replyReceived=1 THEN outreach.creatorId END) AS creatorReplies,
                  COUNT(DISTINCT CASE WHEN outreach.cooperationConfirmed=1 THEN outreach.creatorId END) AS creatorCollaborations,
                  MAX(outreach.updatedAt) AS updatedAt
             FROM influencer_bd_outreach_logs outreach
             JOIN influencer_bd_campaigns campaign ON campaign.id=outreach.campaignId AND campaign.deletedAt IS NULL
            WHERE outreach.deletedAt IS NULL AND outreach.activityDate=?
              AND (campaign.storeId=? OR (?=1 AND campaign.storeId IS NULL AND campaign.brandId=?))`,
          [reportDate, store.id, allowBrandFallback ? 1 : 0, store.brandId]
        )
      : Promise.resolve([[] as RowDataPacket[], []] as any),
    store.brandId
      ? p.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS sourceCount,COALESCE(SUM(actualSpend),0) AS adSpend,MAX(updatedAt) AS updatedAt
             FROM ad_monthly_plans
            WHERE month=? AND planType='shop'
              AND (storeId=? OR (?=1 AND storeId IS NULL AND brandId=?))`,
          [
            reportDate.slice(0, 7),
            store.id,
            allowBrandFallback ? 1 : 0,
            store.brandId,
          ]
        )
      : Promise.resolve([[] as RowDataPacket[], []] as any),
    getBusinessAttributedSales(p, store, reportDate),
  ]);
  const creator = (creatorRows[0] as any[])?.[0];
  const adPlan = (adPlanRows[0] as any[])?.[0];
  const hasCreatorSource = Number(creator?.sourceCount || 0) > 0;
  const hasAdPlanSource = Number(adPlan?.sourceCount || 0) > 0;
  const totalGmv = shopEvidence.length
    ? Number(snapshot.metrics.storeGmv || 0)
    : null;
  const refundAmount = shopEvidence.length
    ? Number(snapshot.metrics.refundAmount || 0)
    : null;
  const core: StoreDailyCoreData = {
    totalGmv,
    actualSales: calculateActualSales(totalGmv, refundAmount),
    refundAmount,
    adSpend: adEvidence.length
      ? Number(snapshot.metrics.adSpend || 0)
      : hasAdPlanSource
        ? Number(adPlan.adSpend || 0)
        : null,
    creatorOutreach: hasCreatorSource
      ? Number(creator.creatorOutreach || 0)
      : null,
    creatorContactCount: hasCreatorSource
      ? Number(creator.creatorContactCount || 0)
      : null,
    creatorReplies: hasCreatorSource
      ? Number(creator.creatorReplies || 0)
      : null,
    creatorCollaborations: hasCreatorSource
      ? Number(creator.creatorCollaborations || 0)
      : null,
  };
  const metricMeta: Partial<Record<keyof StoreDailyCoreData, MetricMeta>> = {};
  for (const field of Object.keys(core) as Array<keyof StoreDailyCoreData>) {
    const isCreator = field.startsWith("creator");
    const hasValue = core[field] !== null;
    const evidence = isCreator
      ? creator?.updatedAt || null
      : field === "adSpend"
        ? adEvidence.at(-1)?.uploadedAt || adPlan?.updatedAt || null
        : shopEvidence.at(-1)?.uploadedAt || null;
    metricMeta[field] = {
      status: hasValue ? "actual" : "missing",
      source: isCreator
        ? hasValue
          ? "influencer_bd"
          : "missing"
        : field === "adSpend"
          ? adEvidence.length
            ? "store_ads_upload"
            : hasAdPlanSource
              ? "ad_monthly_plans"
              : "missing"
          : hasValue
            ? "store_shop_upload"
            : "missing",
      sourceLabel: isCreator
        ? hasValue
          ? "达人BD记录"
          : "未接入"
        : field === "adSpend"
          ? adEvidence.length
            ? "店铺广告数据"
            : hasAdPlanSource
              ? "广告月度实绩"
              : "未上传"
          : hasValue
            ? "店铺经营数据"
            : "未上传",
      sourceUpdatedAt: evidence ? String(evidence) : null,
      originalValue: core[field],
      adjustmentReason: "",
    };
  }
  return { core, metricMeta, businessAttributedSales };
}

function mergeAutomaticCore(
  input: StoreDailyReportPayload,
  automatic: Awaited<ReturnType<typeof getAutomaticCore>>
) {
  const payload = normalizeStoreDailyReportPayload(input);
  payload.core = { ...automatic.core };
  payload.metricMeta = { ...automatic.metricMeta };
  payload.businessAttributedSales = {
    ...automatic.businessAttributedSales,
    totalGmvAllocated: false,
    livestreamGmvAllocated: false,
    readOnly: true,
  };
  return payload;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function syncReportTodos(
  connection: PoolConnection,
  input: {
    reportId: number;
    storeId: number;
    reportDate: string;
    payload: StoreDailyReportPayload;
    actor: ReturnType<typeof actor>;
  }
) {
  const rows = [
    ...input.payload.execution.tomorrowItems.map((item, index) => ({
      kind: "daily_report_tomorrow",
      index,
      item,
    })),
    ...input.payload.execution.supportItems.map((item, index) => ({
      kind: "daily_report_support",
      index,
      item,
    })),
    ...input.payload.supply.riskSkus.map((risk, index) => ({
      kind: "daily_report_risk",
      index,
      item: {
        title: `[风险SKU] ${risk.sku}: ${risk.reason}`,
        ownerStaffId: risk.ownerStaffId,
        ownerName: risk.ownerName,
        dueDate: addDays(input.reportDate, 1),
        priority: "high" as const,
      },
    })),
    ...(input.payload.execution.issuesRisks.trim()
      ? [
          {
            kind: "daily_report_issue",
            index: 0,
            item: {
              title: `[日报风险] ${input.payload.execution.issuesRisks.trim().slice(0, 450)}`,
              ownerStaffId: null,
              ownerName: "",
              dueDate: addDays(input.reportDate, 1),
              priority: "high" as const,
            },
          },
        ]
      : []),
  ];
  const sourceKeys: string[] = [];
  for (const row of rows) {
    const sourceKey = `${input.reportId}:${row.kind}:${row.index}`;
    sourceKeys.push(sourceKey);
    await connection.query(
      `INSERT INTO store_manager_work_items
        (storeId,workstream,title,expectedResult,ownerStaffId,ownerName,priority,status,progress,dueDate,evidenceJson,sourceType,sourceKey,createdById,createdByName,updatedById,updatedByName)
       VALUES (?,?,?,?,?,?,?,'todo',0,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title),expectedResult=VALUES(expectedResult),ownerStaffId=VALUES(ownerStaffId),ownerName=VALUES(ownerName),priority=VALUES(priority),dueDate=VALUES(dueDate),evidenceJson=VALUES(evidenceJson),deletedAt=NULL,updatedById=VALUES(updatedById),updatedByName=VALUES(updatedByName),status=IF(status='done','done','todo')`,
      [
        input.storeId,
        "other",
        row.item.title,
        row.kind === "daily_report_support"
          ? "管理层支持事项"
          : row.kind === "daily_report_tomorrow"
            ? "次日重点工作"
            : "经营风险处理",
        row.item.ownerStaffId,
        row.item.ownerName || null,
        row.item.priority,
        row.item.dueDate || addDays(input.reportDate, 1),
        JSON.stringify([
          {
            label: "协作式店长日报",
            url: `/master/store-management?storeId=${input.storeId}&date=${input.reportDate}`,
          },
        ]),
        row.kind,
        sourceKey,
        input.actor.id,
        input.actor.name,
        input.actor.id,
        input.actor.name,
      ]
    );
  }
  const params: unknown[] = [`${input.reportId}:`];
  let activeCondition = "";
  if (sourceKeys.length) {
    activeCondition = ` AND sourceKey NOT IN (${sourceKeys.map(() => "?").join(",")})`;
    params.push(...sourceKeys);
  }
  await connection.query(
    `UPDATE store_manager_work_items
        SET status=IF(status='done','done','cancelled'),updatedById=?,updatedByName=?
      WHERE sourceType IN ('daily_report_tomorrow','daily_report_support','daily_report_risk','daily_report_issue')
        AND sourceKey LIKE CONCAT(?,'%')${activeCondition}`,
    [input.actor.id, input.actor.name, ...params]
  );
}

async function loadMasterReport(
  connection: PoolConnection | mysql.Pool,
  storeId: number,
  reportDate: string,
  lock = false
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM store_daily_master_reports WHERE storeId=? AND reportDate=? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [storeId, reportDate]
  );
  return rows[0] || null;
}

export const storeDailyReportRouter = router({
  get: protectedProcedure
    .input(
      z.object({ storeId: z.number().int().positive(), reportDate: dateText })
    )
    .query(async ({ input, ctx }) => {
      const p = await readyPool();
      const store = await getStore(p, input.storeId);
      const access = await getAccess(ctx, p, store);
      const [report, automatic, legacyRows] = await Promise.all([
        loadMasterReport(p, input.storeId, input.reportDate),
        getAutomaticCore(store, input.reportDate),
        p.query<RowDataPacket[]>(
          `SELECT id,status,submitterStaffId,submitterName,workSummary,highlights,issuesRisks,actionsTaken,nextPlan,supportNeeded,activityJson,createdByName,createdAt
             FROM store_operation_reports
            WHERE storeId=? AND reportType='daily' AND periodStart=? AND isCurrent=1 AND deletedAt IS NULL
            ORDER BY createdAt,id`,
          [input.storeId, input.reportDate]
        ),
      ]);
      return {
        store,
        canEdit: access.canEdit,
        canConfirm: false,
        report: report
          ? {
              ...report,
              reportDate: dateOnly(report.reportDate),
              payload: parsePayload(report.payloadJson),
            }
          : null,
        automatic,
        initialPayload: mergeAutomaticCore(
          report ? parsePayload(report.payloadJson) : createEmptyStoreDailyReportPayload(),
          automatic
        ),
        legacyReports: legacyRows[0],
      };
    }),

  listMonth: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ input, ctx }) => {
      const p = await readyPool();
      const store = await getStore(p, input.storeId);
      const access = await getAccess(ctx, p, store);
      const month = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const [masterRows, legacyRows] = await Promise.all([
        p.query<RowDataPacket[]>(
          `SELECT id,storeId,reportDate,status,versionNumber,updatedByName,updatedAt,submittedByName,submittedAt,confirmedByName,confirmedAt
             FROM store_daily_master_reports WHERE storeId=? AND reportDate>=? AND reportDate<=LAST_DAY(?) ORDER BY reportDate DESC`,
          [input.storeId, `${month}-01`, `${month}-01`]
        ),
        p.query<RowDataPacket[]>(
          `SELECT id,periodStart,status,submitterStaffId,submitterName,createdByName,createdAt
             FROM store_operation_reports
            WHERE storeId=? AND reportType='daily' AND isCurrent=1 AND deletedAt IS NULL
              AND periodStart>=? AND periodStart<=LAST_DAY(?) ORDER BY periodStart DESC,createdAt DESC`,
          [input.storeId, `${month}-01`, `${month}-01`]
        ),
      ]);
      return {
        canEdit: access.canEdit,
        canConfirm: false,
        masterReports: (masterRows[0] as any[]).map(row => ({
          ...row,
          reportDate: dateOnly(row.reportDate),
        })),
        legacyReports: legacyRows[0],
      };
    }),

  save: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        reportDate: dateText,
        expectedVersion: z.number().int().min(0),
        submit: z.boolean().optional(),
        adjustmentReason: z.string().max(1000).optional(),
        payload: payloadSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const p = await readyPool();
      const connection = await p.getConnection();
      const a = actor(ctx);
      try {
        await connection.beginTransaction();
        const store = await getStore(connection, input.storeId);
        const access = await getAccess(ctx, connection, store);
        requireEdit(access);
        const existing = await loadMasterReport(
          connection,
          input.storeId,
          input.reportDate,
          true
        );
        const existingVersion = Number(existing?.versionNumber || 0);
        if (existingVersion !== input.expectedVersion) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `日报已被${existing?.updatedByName || "其他成员"}更新，请刷新后合并修改`,
          });
        }
        const automatic = await getAutomaticCore(store, input.reportDate);
        const payload = mergeAutomaticCore(input.payload, automatic);
        const beforePayload = existing
          ? parsePayload(existing.payloadJson)
          : null;
        const nextVersion = existingVersion + 1;
        const status = "submitted" as const;
        let reportId: number;
        if (existing) {
          await connection.query(
            `UPDATE store_daily_master_reports
                SET cutoffTime=?,status=?,payloadJson=?,versionNumber=?,updatedById=?,updatedByName=?,
                    submittedById=IF(?='submitted',?,submittedById),submittedByName=IF(?='submitted',?,submittedByName),submittedAt=IF(?='submitted',CURRENT_TIMESTAMP,submittedAt)
              WHERE id=?`,
            [
              payload.cutoffTime,
              status,
              JSON.stringify(payload),
              nextVersion,
              a.id,
              a.name,
              status,
              a.id,
              status,
              a.name,
              status,
              existing.id,
            ]
          );
          reportId = Number(existing.id);
        } else {
          const [result] = await connection.query<any>(
            `INSERT INTO store_daily_master_reports
              (storeId,reportDate,cutoffTime,status,payloadJson,versionNumber,createdById,createdByName,updatedById,updatedByName,submittedById,submittedByName,submittedAt)
             VALUES (?,?,?,?,?,?,?,?,?,?,IF(?='submitted',?,NULL),IF(?='submitted',?,NULL),IF(?='submitted',CURRENT_TIMESTAMP,NULL))`,
            [
              input.storeId,
              input.reportDate,
              payload.cutoffTime,
              status,
              JSON.stringify(payload),
              nextVersion,
              a.id,
              a.name,
              a.id,
              a.name,
              status,
              a.id,
              status,
              a.name,
              status,
            ]
          );
          reportId = Number(result.insertId);
        }
        await syncReportTodos(connection, {
          reportId,
          storeId: input.storeId,
          reportDate: input.reportDate,
          payload,
          actor: a,
        });
        await connection.query(
          `INSERT INTO store_daily_master_report_versions
            (reportId,storeId,reportDate,versionNumber,status,payloadJson,actorId,actorName,reason)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            reportId,
            input.storeId,
            input.reportDate,
            nextVersion,
            status,
            JSON.stringify(payload),
            a.id,
            a.name,
            null,
          ]
        );
        const changes = diffStoreDailyReportPayload(beforePayload, payload);
        if (changes.length) {
          await connection.query(
            `INSERT INTO store_daily_master_report_field_audits
              (reportId,storeId,reportDate,versionNumber,fieldPath,beforeJson,afterJson,actorId,actorName,reason)
             VALUES ${changes.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",")}`,
            changes.flatMap(change => [
              reportId,
              input.storeId,
              input.reportDate,
              nextVersion,
              change.fieldPath,
              JSON.stringify(change.before),
              JSON.stringify(change.after),
              a.id,
              a.name,
              null,
            ])
          );
        }
        await connection.commit();
        return {
          id: reportId,
          status,
          versionNumber: nextVersion,
          changedFields: changes.map(change => change.fieldPath),
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  confirm: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "日报保存后直接生效，无需确认",
      });
    }),

  reopen: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().trim().min(3).max(1000),
      })
    )
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "日报不再锁定，无需重开",
      });
    }),

  history: protectedProcedure
    .input(
      z.object({ storeId: z.number().int().positive(), reportDate: dateText })
    )
    .query(async ({ input, ctx }) => {
      const p = await readyPool();
      const store = await getStore(p, input.storeId);
      await getAccess(ctx, p, store);
      const report = await loadMasterReport(p, input.storeId, input.reportDate);
      if (!report) return { versions: [], audits: [] };
      const [versions, audits] = await Promise.all([
        p.query<RowDataPacket[]>(
          "SELECT id,versionNumber,status,actorId,actorName,reason,createdAt FROM store_daily_master_report_versions WHERE reportId=? ORDER BY versionNumber DESC",
          [report.id]
        ),
        p.query<RowDataPacket[]>(
          "SELECT id,versionNumber,fieldPath,beforeJson,afterJson,actorId,actorName,reason,createdAt FROM store_daily_master_report_field_audits WHERE reportId=? ORDER BY id DESC LIMIT 500",
          [report.id]
        ),
      ]);
      return { versions: versions[0], audits: audits[0] };
    }),
});

export const storeDailyReportPayloadSchema = payloadSchema;
export { mergeAutomaticCore };
