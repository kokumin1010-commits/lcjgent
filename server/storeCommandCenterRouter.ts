import { createHash } from "node:crypto";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import {
  STORE_COMMAND_DATA_TYPES,
  buildGrowthAlertCandidates,
  buildStoreSkuMetrics,
  evaluateMetric,
  normalizeGrowthRows,
  type GrowthAlertCandidate,
  type NormalizedGrowthRow,
  type StoreCommandDataType,
} from "./storeCommandCenterPolicy";
import {
  STORE_COMMAND_FILE_MAX_BYTES,
  STORE_COMMAND_PARSE_VERSION,
  decodeCommandFileBase64,
  parseStoreCommandFile,
  safeImportPreview,
} from "./storeCommandCenterImport";
import { getStoreCommandCenterUpgradeHealth } from "./storeCommandCenterUpgrade";

const PAGE_KEY = "/master/store-management";
let poolInstance: Pool | null = null;

function pool(): Pool {
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

function rows(result: unknown): any[] {
  if (Array.isArray(result) && Array.isArray(result[0]))
    return result[0] as any[];
  return Array.isArray(result) ? (result as any[]) : [];
}

function actor(ctx: any) {
  return {
    id: Number(ctx?.user?.id || 0) || null,
    name: String(
      ctx?.user?.name ||
        ctx?.user?.email ||
        ctx?.user?.openId ||
        "authenticated-user"
    ).slice(0, 255),
    email: String(ctx?.user?.email || "")
      .trim()
      .toLowerCase(),
  };
}

async function resolveStaff(connection: Pool | PoolConnection, ctx: any) {
  const current = actor(ctx);
  if (!current.email) return null;
  const [result] = await connection.query<RowDataPacket[]>(
    "SELECT id,name,email FROM staff WHERE LOWER(TRIM(email))=? AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL LIMIT 1",
    [current.email]
  );
  return result[0] || null;
}

async function requireStorePermission(
  ctx: any,
  storeId: number,
  mode: "view" | "edit"
) {
  const connection = pool();
  const [storeRows] = await connection.query<RowDataPacket[]>(
    "SELECT id,name,operatorId,operatorName,operator2Id,operator2Name FROM managed_stores WHERE id=? AND isActive=1 LIMIT 1",
    [storeId]
  );
  const store = storeRows[0];
  if (!store)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "店铺不存在 / 店舗が見つかりません",
    });
  if (ctx?.user?.role === "admin")
    return { store, staff: await resolveStaff(connection, ctx) };
  const staff = await resolveStaff(connection, ctx);
  if (
    staff &&
    [Number(store.operatorId || 0), Number(store.operator2Id || 0)].includes(
      Number(staff.id)
    )
  )
    return { store, staff };
  const [assignmentRows] = await connection.query<RowDataPacket[]>(
    `SELECT ura.roleId FROM user_role_assignments ura WHERE ura.userId=? LIMIT 1`,
    [Number(ctx.user.id)]
  );
  const roleId = Number(assignmentRows[0]?.roleId || 0);
  if (!roleId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "没有店铺管理权限 / 店舗管理権限がありません",
    });
  const [permissionRows] = await connection.query<RowDataPacket[]>(
    `SELECT canView,canEdit FROM role_permissions WHERE roleId=? AND pageKey=? LIMIT 1`,
    [roleId, PAGE_KEY]
  );
  const permission = permissionRows[0];
  const allowed =
    mode === "edit"
      ? Boolean(permission?.canEdit)
      : Boolean(permission?.canView || permission?.canEdit);
  if (!allowed)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "没有店铺管理权限 / 店舗管理権限がありません",
    });
  return { store, staff };
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[\\/\0]/g, "_")
      .replace(/[^A-Za-z0-9._\-\u3000-\u30ff\u3400-\u9fff]/g, "_") ||
    "store-command.csv"
  ).slice(0, 180);
}

function decimal(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function dbRowToNormalized(row: any): NormalizedGrowthRow {
  return {
    businessKey: String(row.businessKey),
    businessDate: row.businessDate
      ? new Date(row.businessDate).toISOString().slice(0, 10)
      : null,
    orderId: row.orderId || null,
    orderLineId: row.orderLineId || null,
    refundId: row.refundId || null,
    productId: row.productId || null,
    productName: row.productName || null,
    skuId: row.skuId || null,
    skuName: row.skuName || null,
    quantity: decimal(row.quantity),
    deliveredQuantity: decimal(row.deliveredQuantity),
    gmv: decimal(row.gmv),
    refundQuantity: decimal(row.refundQuantity),
    refundAmount: decimal(row.refundAmount),
    returnReason: row.returnReason || null,
    channel: row.channel || null,
    creatorName: row.creatorName || null,
    sourceContentId: row.sourceContentId || null,
    sourceSessionId: row.sourceSessionId || null,
    impressions: decimal(row.impressions),
    clicks: decimal(row.clicks),
    orders: decimal(row.orders),
    raw:
      typeof row.rawJson === "string"
        ? JSON.parse(row.rawJson || "{}")
        : row.rawJson || {},
    warnings:
      typeof row.warningsJson === "string"
        ? JSON.parse(row.warningsJson || "[]")
        : row.warningsJson || [],
  };
}

async function loadCurrentCommandRows(
  connection: Pool | PoolConnection,
  storeId: number,
  periodStart: string,
  periodEnd: string
) {
  const [result] = await connection.query<RowDataPacket[]>(
    `SELECT r.* FROM store_command_rows r
       JOIN store_command_imports i ON i.id=r.importId
      WHERE r.storeId=? AND i.isCurrent=1 AND i.deletedAt IS NULL AND i.status IN ('success','partial')
        AND (r.businessDate BETWEEN ? AND ? OR r.businessDate IS NULL)`,
    [storeId, periodStart, periodEnd]
  );
  return result.map(dbRowToNormalized);
}

async function loadLegacyProductRows(
  connection: Pool | PoolConnection,
  storeId: number,
  periodStart: string,
  periodEnd: string
) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  const pairs: Array<{ year: number; month: number }> = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
  );
  while (cursor <= end && pairs.length < 36) {
    pairs.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (!pairs.length) return [];
  const conditions = pairs.map(() => "(year=? AND month=?)").join(" OR ");
  const params = pairs.flatMap(pair => [pair.year, pair.month]);
  const [uploads] = await connection.query<RowDataPacket[]>(
    `SELECT dataJson FROM store_data_uploads
      WHERE storeId=? AND dataType='products' AND isCurrent=1 AND deletedAt IS NULL AND (${conditions})`,
    [storeId, ...params]
  );
  const raw = uploads
    .flatMap(upload => {
      try {
        return JSON.parse(String(upload.dataJson || "[]"));
      } catch {
        return [];
      }
    })
    .filter((row: any) => row && row._type !== "summary");
  return normalizeGrowthRows("sku_performance", raw).rows;
}

async function loadUnifiedRows(
  connection: Pool | PoolConnection,
  storeId: number,
  periodStart: string,
  periodEnd: string
) {
  const commandRows = await loadCurrentCommandRows(
    connection,
    storeId,
    periodStart,
    periodEnd
  );
  const hasPerformance = commandRows.some(
    row =>
      row.impressions > 0 || row.clicks > 0 || row.orders > 0 || row.gmv > 0
  );
  if (hasPerformance) return commandRows;
  const legacyRows = await loadLegacyProductRows(
    connection,
    storeId,
    periodStart,
    periodEnd
  );
  return [
    ...legacyRows,
    ...commandRows.filter(
      row => row.refundAmount > 0 || row.refundQuantity > 0
    ),
  ];
}

function workstream(ruleKey: GrowthAlertCandidate["ruleKey"]) {
  if (ruleKey === "sku_refund_risk") return "ads_customer_refund";
  if (ruleKey === "high_cvr_low_exposure") return "inventory_growth";
  return "product_page";
}

function priority(alert: GrowthAlertCandidate) {
  if (alert.severity === "critical") return "critical";
  if (alert.severity === "high") return "high";
  return "medium";
}

function dueDate(days = 1) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function writeExecutionAudit(
  connection: PoolConnection,
  input: {
    storeId: number;
    entityType: string;
    entityId: number | null;
    action: string;
    before?: unknown;
    after?: unknown;
    ctx: any;
    reason?: string;
  }
) {
  const current = actor(input.ctx);
  await connection.query(
    `INSERT INTO store_execution_audit_logs (storeId,entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      input.storeId,
      input.entityType,
      input.entityId,
      input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      current.id,
      current.name,
      input.reason || null,
    ]
  );
}

async function writeTaskEvent(
  connection: PoolConnection,
  input: {
    detailId: number;
    workItemId: number;
    storeId: number;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    payload?: unknown;
    ctx?: any;
  }
) {
  const current = actor(input.ctx);
  await connection.query(
    `INSERT INTO store_growth_task_events (taskDetailId,workItemId,storeId,action,fromStatus,toStatus,payloadJson,actorId,actorName)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      input.detailId,
      input.workItemId,
      input.storeId,
      input.action,
      input.fromStatus || null,
      input.toStatus || null,
      input.payload ? JSON.stringify(input.payload) : null,
      current.id,
      current.name,
    ]
  );
}

async function syncAlertsAndTasks(
  connection: PoolConnection,
  input: {
    storeId: number;
    store: any;
    candidates: GrowthAlertCandidate[];
    ctx: any;
  }
) {
  const fingerprints = input.candidates.map(candidate => candidate.fingerprint);
  if (fingerprints.length) {
    await connection.query(
      `UPDATE store_growth_alerts SET status='resolved',resolvedAt=CURRENT_TIMESTAMP
        WHERE storeId=? AND status='active' AND fingerprint NOT IN (${fingerprints.map(() => "?").join(",")})`,
      [input.storeId, ...fingerprints]
    );
  } else {
    await connection.query(
      "UPDATE store_growth_alerts SET status='resolved',resolvedAt=CURRENT_TIMESTAMP WHERE storeId=? AND status='active'",
      [input.storeId]
    );
  }
  const ownerStaffId =
    Number(input.store.operatorId || input.store.operator2Id || 0) || null;
  const ownerName =
    String(
      input.store.operatorName || input.store.operator2Name || ""
    ).trim() || null;
  const [countRows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM store_growth_task_details d
       JOIN store_manager_work_items w ON w.id=d.workItemId
      WHERE d.storeId=? AND d.assignedFromRule=1 AND DATE(d.createdAt)=CURRENT_DATE
        AND w.deletedAt IS NULL AND ((? IS NULL AND w.ownerStaffId IS NULL) OR w.ownerStaffId=?)`,
    [input.storeId, ownerStaffId, ownerStaffId]
  );
  let slots = Math.max(0, 3 - Number(countRows[0]?.count || 0));
  let createdTasks = 0;
  for (const candidate of input.candidates) {
    await connection.query(
      `INSERT INTO store_growth_alerts
        (storeId,fingerprint,ruleKey,entityType,entityKey,productId,productName,skuId,skuName,severity,metricKey,currentValue,baselineValue,opportunityValue,title,explanation,evidenceJson,status,lastDetectedAt,resolvedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',CURRENT_TIMESTAMP,NULL)
       ON DUPLICATE KEY UPDATE severity=VALUES(severity),metricKey=VALUES(metricKey),currentValue=VALUES(currentValue),baselineValue=VALUES(baselineValue),opportunityValue=VALUES(opportunityValue),title=VALUES(title),explanation=VALUES(explanation),evidenceJson=VALUES(evidenceJson),status='active',lastDetectedAt=CURRENT_TIMESTAMP,resolvedAt=NULL`,
      [
        input.storeId,
        candidate.fingerprint,
        candidate.ruleKey,
        candidate.entityType,
        candidate.entityKey,
        candidate.productId,
        candidate.productName,
        candidate.skuId,
        candidate.skuName,
        candidate.severity,
        candidate.metricKey,
        candidate.currentValue,
        candidate.baselineValue,
        candidate.opportunityValue,
        candidate.title,
        candidate.explanation,
        JSON.stringify(candidate.evidence),
      ]
    );
    const [alertRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM store_growth_alerts WHERE storeId=? AND fingerprint=? LIMIT 1",
      [input.storeId, candidate.fingerprint]
    );
    const alertId = Number(alertRows[0]?.id || 0);
    if (!alertId || slots <= 0) continue;
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT d.id FROM store_growth_task_details d JOIN store_manager_work_items w ON w.id=d.workItemId
        WHERE d.alertId=? AND w.deletedAt IS NULL AND d.verificationStatus IN ('pending','observing') LIMIT 1`,
      [alertId]
    );
    if (existingRows.length) continue;
    const [workResult] = await connection.query<any>(
      `INSERT INTO store_manager_work_items
        (cycleId,storeId,workstream,title,expectedResult,ownerStaffId,ownerName,priority,status,progress,dueDate,resultSummary,evidenceJson,createdById,createdByName,updatedById,updatedByName)
       VALUES (NULL,?,?,?,?,?,?,?,'todo',0,?,NULL,'[]',?,?,?,?)`,
      [
        input.storeId,
        workstream(candidate.ruleKey),
        candidate.title,
        `${candidate.explanation}\n预计净GMV影响：¥${Math.round(candidate.opportunityValue).toLocaleString()}`,
        ownerStaffId,
        ownerName,
        priority(candidate),
        dueDate(candidate.severity === "critical" ? 0 : 1),
        actor(input.ctx).id,
        actor(input.ctx).name,
        actor(input.ctx).id,
        actor(input.ctx).name,
      ]
    );
    const workItemId = Number(workResult.insertId);
    const [detailResult] = await connection.query<any>(
      `INSERT INTO store_growth_task_details
        (workItemId,alertId,storeId,ruleKey,entityType,entityKey,productId,productName,skuId,skuName,triggerSnapshotJson,stepsJson,expectedImpactGmv,metricKey,baselineValue,targetValue,observationDays,guardrailsJson,assignedFromRule)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        workItemId,
        alertId,
        input.storeId,
        candidate.ruleKey,
        candidate.entityType,
        candidate.entityKey,
        candidate.productId,
        candidate.productName,
        candidate.skuId,
        candidate.skuName,
        JSON.stringify(candidate.evidence),
        JSON.stringify(candidate.steps),
        candidate.opportunityValue,
        candidate.metricKey,
        candidate.currentValue,
        candidate.targetValue,
        candidate.observationDays,
        JSON.stringify(candidate.guardrails),
      ]
    );
    const detailId = Number(detailResult.insertId);
    await writeExecutionAudit(connection, {
      storeId: input.storeId,
      entityType: "work_item",
      entityId: workItemId,
      action: "growth_task_generated",
      after: {
        workItemId,
        alertId,
        ruleKey: candidate.ruleKey,
        expectedImpactGmv: candidate.opportunityValue,
      },
      ctx: input.ctx,
      reason: "store-command-rule-engine",
    });
    await writeTaskEvent(connection, {
      detailId,
      workItemId,
      storeId: input.storeId,
      action: "generated",
      toStatus: "todo",
      payload: { alertId, ruleKey: candidate.ruleKey },
      ctx: input.ctx,
    });
    slots -= 1;
    createdTasks += 1;
  }
  return { activeAlerts: input.candidates.length, createdTasks };
}

async function verifyDueTasks(
  connection: PoolConnection,
  input: {
    storeId: number;
    metrics: ReturnType<typeof buildStoreSkuMetrics>;
    ctx: any;
  }
) {
  const metricMap = new Map(
    input.metrics.map(metric => [metric.entityKey, metric])
  );
  const [details] = await connection.query<RowDataPacket[]>(
    `SELECT d.*,w.status AS workStatus FROM store_growth_task_details d
       JOIN store_manager_work_items w ON w.id=d.workItemId
      WHERE d.storeId=? AND d.verificationStatus='observing' AND d.observationEndAt<=CURRENT_TIMESTAMP AND w.deletedAt IS NULL FOR UPDATE`,
    [input.storeId]
  );
  let verified = 0;
  for (const detail of details) {
    const metric = metricMap.get(String(detail.entityKey || ""));
    const current =
      detail.metricKey === "returnRate"
        ? metric?.returnRate
        : detail.metricKey === "ctr"
          ? metric?.ctr
          : detail.metricKey === "cvr"
            ? metric?.cvr
            : detail.metricKey === "impressions"
              ? metric?.impressions
              : null;
    const status = evaluateMetric({
      metricKey: String(detail.metricKey || ""),
      baseline:
        detail.baselineValue === null ? null : Number(detail.baselineValue),
      target: detail.targetValue === null ? null : Number(detail.targetValue),
      current: current === undefined ? null : Number(current),
    });
    await connection.query(
      `UPDATE store_growth_task_details SET verificationStatus=?,verifiedAt=CURRENT_TIMESTAMP,verificationSnapshotJson=? WHERE id=?`,
      [
        status,
        JSON.stringify({ current: current ?? null, metric: metric || null }),
        Number(detail.id),
      ]
    );
    await writeTaskEvent(connection, {
      detailId: Number(detail.id),
      workItemId: Number(detail.workItemId),
      storeId: input.storeId,
      action: "auto_verified",
      fromStatus: "observing",
      toStatus: status,
      payload: { current: current ?? null, target: detail.targetValue },
      ctx: input.ctx,
    });
    verified += 1;
  }
  return verified;
}

function periodSchema() {
  return z
    .object({
      storeId: z.number().int().positive(),
      periodStart: z.string().date(),
      periodEnd: z.string().date(),
    })
    .refine(value => value.periodStart <= value.periodEnd, {
      message: "开始日期不能晚于结束日期",
    });
}

const dataTypeSchema = z.enum(STORE_COMMAND_DATA_TYPES);
const evidenceSchema = z
  .array(
    z.object({
      type: z.enum(["url", "text", "image"]),
      value: z.string().min(1).max(2000),
      label: z.string().max(255).optional(),
    })
  )
  .max(20);

export const storeCommandCenterRouter = router({
  health: protectedProcedure.query(async () =>
    getStoreCommandCenterUpgradeHealth()
  ),

  dashboard: protectedProcedure
    .input(periodSchema())
    .query(async ({ input, ctx }) => {
      await requireStorePermission(ctx, input.storeId, "view");
      const connection = pool();
      const unifiedRows = await loadUnifiedRows(
        connection,
        input.storeId,
        input.periodStart,
        input.periodEnd
      );
      const metrics = buildStoreSkuMetrics(unifiedRows).sort(
        (a, b) => b.refundAmount - a.refundAmount || b.gmv - a.gmv
      );
      const [imports, alerts, tasks, storeRows] = await Promise.all([
        connection.query<RowDataPacket[]>(
          `SELECT id,dataType,periodStart,periodEnd,fileName,fileSha256,versionNumber,recordCount,acceptedCount,rejectedCount,status,qualityJson,createdAt,completedAt FROM store_command_imports WHERE storeId=? AND isCurrent=1 AND deletedAt IS NULL ORDER BY createdAt DESC`,
          [input.storeId]
        ),
        connection.query<RowDataPacket[]>(
          `SELECT * FROM store_growth_alerts WHERE storeId=? AND status='active' ORDER BY FIELD(severity,'critical','high','medium'),opportunityValue DESC,lastDetectedAt DESC LIMIT 100`,
          [input.storeId]
        ),
        connection.query<RowDataPacket[]>(
          `SELECT w.*,d.id AS taskDetailId,d.alertId,d.ruleKey,d.entityType,d.entityKey,d.productId,d.productName,d.skuId,d.skuName,d.triggerSnapshotJson,d.stepsJson,d.expectedImpactGmv,d.metricKey,d.baselineValue,d.targetValue,d.observationDays,d.guardrailsJson,d.verificationStatus,d.observationStartAt,d.observationEndAt,d.submittedAt,d.verifiedAt,d.verificationSnapshotJson FROM store_manager_work_items w JOIN store_growth_task_details d ON d.workItemId=w.id WHERE w.storeId=? AND w.deletedAt IS NULL ORDER BY FIELD(w.status,'blocked','todo','in_progress','done','cancelled'),w.dueDate,w.priority DESC,w.id DESC LIMIT 200`,
          [input.storeId]
        ),
        connection.query<RowDataPacket[]>(
          "SELECT id,name,operatorId,operatorName,operator2Id,operator2Name FROM managed_stores WHERE id=? LIMIT 1",
          [input.storeId]
        ),
      ]);
      const commandImports = imports[0];
      const importByType = new Map(
        commandImports.map(item => [String(item.dataType), item])
      );
      const required = new Set<StoreCommandDataType>([
        "sku_performance",
        "orders",
        "refunds",
      ]);
      const dataHealth = STORE_COMMAND_DATA_TYPES.map(dataType => {
        const item = importByType.get(dataType);
        const status = !item
          ? required.has(dataType)
            ? "missing"
            : "optional"
          : Number(item.rejectedCount) > 0
            ? "warning"
            : "healthy";
        return {
          dataType,
          status,
          required: required.has(dataType),
          lastImport: item || null,
        };
      });
      const totals = metrics.reduce(
        (sum, item) => ({
          gmv: sum.gmv + item.gmv,
          refundAmount: sum.refundAmount + item.refundAmount,
          orders: sum.orders + item.orders,
          refundQuantity: sum.refundQuantity + item.refundQuantity,
        }),
        { gmv: 0, refundAmount: 0, orders: 0, refundQuantity: 0 }
      );
      const netGmv = totals.gmv - totals.refundAmount;
      const candidates = buildGrowthAlertCandidates(unifiedRows).slice(0, 100);
      return {
        store: storeRows[0][0] || null,
        period: { start: input.periodStart, end: input.periodEnd },
        hasSourceData: unifiedRows.length > 0,
        sourceMode: commandImports.length
          ? "command_csv"
          : unifiedRows.length
            ? "legacy_product_csv"
            : "missing",
        totals: {
          ...totals,
          netGmv,
          returnRate:
            totals.orders > 0
              ? (totals.refundQuantity / totals.orders) * 100
              : null,
        },
        dataHealth,
        metrics: metrics.slice(0, 300),
        alerts: alerts[0],
        candidateAlerts: candidates,
        tasks: tasks[0],
        imports: commandImports,
      };
    }),

  previewImport: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        dataType: dataTypeSchema,
        fileName: z.string().min(1).max(255),
        fileBase64: z
          .string()
          .min(1)
          .max(Math.ceil((STORE_COMMAND_FILE_MAX_BYTES * 4) / 3) + 16),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireStorePermission(ctx, input.storeId, "edit");
      const fileBuffer = decodeCommandFileBase64(input.fileBase64);
      return safeImportPreview(
        parseStoreCommandFile({
          fileBuffer,
          fileName: input.fileName,
          dataType: input.dataType,
        })
      );
    }),

  importData: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        dataType: dataTypeSchema,
        fileName: z.string().min(1).max(255),
        fileBase64: z
          .string()
          .min(1)
          .max(Math.ceil((STORE_COMMAND_FILE_MAX_BYTES * 4) / 3) + 16),
        expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
        periodStart: z.string().date().optional(),
        periodEnd: z.string().date().optional(),
        confirmed: z.literal(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const permission = await requireStorePermission(
        ctx,
        input.storeId,
        "edit"
      );
      const connectionPool = pool();
      const fileBuffer = decodeCommandFileBase64(input.fileBase64);
      const parsed = parseStoreCommandFile({
        fileBuffer,
        fileName: input.fileName,
        dataType: input.dataType,
      });
      if (parsed.fileSha256 !== input.expectedSha256)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "文件已变化，请重新预览 / ファイルが変更されたため再プレビューしてください",
        });
      const [duplicateRows] = await connectionPool.query<RowDataPacket[]>(
        `SELECT id,versionNumber,status FROM store_command_imports WHERE storeId=? AND dataType=? AND fileSha256=? AND deletedAt IS NULL LIMIT 1`,
        [input.storeId, input.dataType, parsed.fileSha256]
      );
      if (duplicateRows[0])
        return {
          alreadyImported: true,
          importId: Number(duplicateRows[0].id),
          versionNumber: Number(duplicateRows[0].versionNumber),
          acceptedCount: parsed.quality.acceptedCount,
          rejectedCount: parsed.quality.rejectedCount,
          createdTasks: 0,
          activeAlerts: 0,
          verifiedTasks: 0,
        };
      const periodStart = input.periodStart || parsed.periodStart;
      const periodEnd = input.periodEnd || parsed.periodEnd;
      if (!periodStart || !periodEnd)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "无法识别数据期间，请指定开始和结束日期 / 期間を指定してください",
        });
      const safeName = safeFileName(input.fileName);
      const storage = await storagePut(
        `store-command/imports/${input.storeId}/${input.dataType}/${parsed.fileSha256}-${safeName}`,
        fileBuffer,
        parsed.mimeType
      );
      const connection = await connectionPool.getConnection();
      try {
        await connection.beginTransaction();
        const [currentRows] = await connection.query<RowDataPacket[]>(
          `SELECT id,versionNumber FROM store_command_imports WHERE storeId=? AND dataType=? AND periodStart=? AND periodEnd=? AND isCurrent=1 AND deletedAt IS NULL FOR UPDATE`,
          [input.storeId, input.dataType, periodStart, periodEnd]
        );
        const current = currentRows[0];
        const versionNumber = Number(current?.versionNumber || 0) + 1;
        if (current)
          await connection.query(
            "UPDATE store_command_imports SET isCurrent=0 WHERE id=?",
            [Number(current.id)]
          );
        const currentActor = actor(ctx);
        const [insertResult] = await connection.query<any>(
          `INSERT INTO store_command_imports (storeId,dataType,periodStart,periodEnd,fileName,originalFileUrl,originalFileKey,fileSha256,fileSize,mimeType,parseVersion,versionNumber,isCurrent,supersedesId,recordCount,acceptedCount,rejectedCount,status,qualityJson,uploadedById,uploadedByName,completedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?, ?,CURRENT_TIMESTAMP)`,
          [
            input.storeId,
            input.dataType,
            periodStart,
            periodEnd,
            safeName,
            storage.url,
            storage.key,
            parsed.fileSha256,
            fileBuffer.length,
            parsed.mimeType,
            STORE_COMMAND_PARSE_VERSION,
            versionNumber,
            current ? Number(current.id) : null,
            parsed.rawRowCount,
            parsed.quality.acceptedCount,
            parsed.quality.rejectedCount,
            parsed.quality.rejectedCount ? "partial" : "success",
            JSON.stringify({
              ...parsed.quality,
              rejected: parsed.rejected.slice(0, 100),
              headers: parsed.headers,
            }),
            currentActor.id,
            currentActor.name,
          ]
        );
        const importId = Number(insertResult.insertId);
        for (let offset = 0; offset < parsed.rows.length; offset += 250) {
          const batch = parsed.rows
            .slice(offset, offset + 250)
            .map(row => [
              importId,
              input.storeId,
              input.dataType,
              row.businessKey,
              row.businessDate,
              row.orderId,
              row.orderLineId,
              row.refundId,
              row.productId,
              row.productName,
              row.skuId,
              row.skuName,
              row.quantity,
              row.deliveredQuantity,
              row.gmv,
              row.refundQuantity,
              row.refundAmount,
              row.returnReason,
              row.channel,
              row.creatorName,
              row.sourceContentId,
              row.sourceSessionId,
              row.impressions,
              row.clicks,
              row.orders,
              JSON.stringify(row.raw),
              JSON.stringify(row.warnings),
              createHash("sha256")
                .update(JSON.stringify(row.raw))
                .digest("hex"),
            ]);
          await connection.query(
            `INSERT INTO store_command_rows (importId,storeId,dataType,businessKey,businessDate,orderId,orderLineId,refundId,productId,productName,skuId,skuName,quantity,deliveredQuantity,gmv,refundQuantity,refundAmount,returnReason,channel,creatorName,sourceContentId,sourceSessionId,impressions,clicks,orders,rawJson,warningsJson,rowSha256) VALUES ?`,
            [batch]
          );
        }
        const unifiedRows = await loadUnifiedRows(
          connection,
          input.storeId,
          periodStart,
          periodEnd
        );
        const candidates = buildGrowthAlertCandidates(unifiedRows);
        const sync = await syncAlertsAndTasks(connection, {
          storeId: input.storeId,
          store: permission.store,
          candidates,
          ctx,
        });
        const verifiedTasks = await verifyDueTasks(connection, {
          storeId: input.storeId,
          metrics: buildStoreSkuMetrics(unifiedRows),
          ctx,
        });
        await connection.commit();
        return {
          alreadyImported: false,
          importId,
          versionNumber,
          acceptedCount: parsed.quality.acceptedCount,
          rejectedCount: parsed.quality.rejectedCount,
          createdTasks: sync.createdTasks,
          activeAlerts: sync.activeAlerts,
          verifiedTasks,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  refreshRecommendations: protectedProcedure
    .input(periodSchema())
    .mutation(async ({ input, ctx }) => {
      const permission = await requireStorePermission(
        ctx,
        input.storeId,
        "edit"
      );
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        const unifiedRows = await loadUnifiedRows(
          connection,
          input.storeId,
          input.periodStart,
          input.periodEnd
        );
        const metrics = buildStoreSkuMetrics(unifiedRows);
        const sync = await syncAlertsAndTasks(connection, {
          storeId: input.storeId,
          store: permission.store,
          candidates: buildGrowthAlertCandidates(unifiedRows),
          ctx,
        });
        const verifiedTasks = await verifyDueTasks(connection, {
          storeId: input.storeId,
          metrics,
          ctx,
        });
        await connection.commit();
        return { ...sync, verifiedTasks, sourceRows: unifiedRows.length };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  taskAction: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        workItemId: z.number().int().positive(),
        action: z.enum([
          "start",
          "block",
          "resume",
          "submit_observation",
          "cancel",
        ]),
        reason: z.string().max(2000).optional(),
        evidence: evidenceSchema.default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const permission = await requireStorePermission(
        ctx,
        input.storeId,
        "edit"
      );
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        const [taskRows] = await connection.query<RowDataPacket[]>(
          `SELECT w.*,d.id AS detailId,d.observationDays,d.verificationStatus FROM store_manager_work_items w JOIN store_growth_task_details d ON d.workItemId=w.id WHERE w.id=? AND w.storeId=? AND w.deletedAt IS NULL FOR UPDATE`,
          [input.workItemId, input.storeId]
        );
        const task = taskRows[0];
        if (!task)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在 / タスクが見つかりません",
          });
        const currentStaff = permission.staff;
        const isOwner =
          !task.ownerStaffId ||
          Number(task.ownerStaffId) === Number(currentStaff?.id || 0);
        if (ctx.user.role !== "admin" && !isOwner)
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "只能操作分配给自己的任务 / 自分に割り当てられたタスクのみ操作できます",
          });
        const next =
          input.action === "start"
            ? "in_progress"
            : input.action === "block"
              ? "blocked"
              : input.action === "resume"
                ? "in_progress"
                : input.action === "submit_observation"
                  ? "done"
                  : "cancelled";
        if (input.action === "block" && !String(input.reason || "").trim())
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "请填写受阻原因 / ブロック理由を入力してください",
          });
        if (input.action === "submit_observation" && !input.evidence.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "请提交至少一项执行证据 / 実行証拠を1件以上追加してください",
          });
        const before = {
          status: task.status,
          progress: task.progress,
          verificationStatus: task.verificationStatus,
        };
        await connection.query(
          `UPDATE store_manager_work_items SET status=?,progress=?,resultSummary=?,evidenceJson=?,completedAt=IF(?='done',CURRENT_TIMESTAMP,NULL),updatedById=?,updatedByName=? WHERE id=?`,
          [
            next,
            next === "done" ? 100 : Number(task.progress || 0),
            input.reason || task.resultSummary || null,
            JSON.stringify(input.evidence),
            next,
            actor(ctx).id,
            actor(ctx).name,
            input.workItemId,
          ]
        );
        if (input.action === "submit_observation") {
          await connection.query(
            `UPDATE store_growth_task_details SET verificationStatus='observing',submittedAt=CURRENT_TIMESTAMP,observationStartAt=CURRENT_TIMESTAMP,observationEndAt=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL ? DAY) WHERE id=?`,
            [Number(task.observationDays || 7), Number(task.detailId)]
          );
        } else if (input.action === "cancel") {
          await connection.query(
            `UPDATE store_growth_task_details SET verificationStatus='insufficient',verifiedAt=CURRENT_TIMESTAMP WHERE id=?`,
            [Number(task.detailId)]
          );
        }
        await writeTaskEvent(connection, {
          detailId: Number(task.detailId),
          workItemId: input.workItemId,
          storeId: input.storeId,
          action: input.action,
          fromStatus: String(task.status),
          toStatus: next,
          payload: { reason: input.reason || null, evidence: input.evidence },
          ctx,
        });
        await writeExecutionAudit(connection, {
          storeId: input.storeId,
          entityType: "work_item",
          entityId: input.workItemId,
          action: `growth_task_${input.action}`,
          before,
          after: { status: next, evidenceCount: input.evidence.length },
          ctx,
          reason: input.reason,
        });
        await connection.commit();
        return { success: true, status: next };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  uploadEvidence: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        fileName: z.string().min(1).max(255),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        fileBase64: z.string().min(1).max(14_000_000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireStorePermission(ctx, input.storeId, "edit");
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (!buffer.length || buffer.length > 10 * 1024 * 1024)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "图片必须小于10MB / 画像は10MB以下にしてください",
        });
      const signatures =
        input.mimeType === "image/png"
          ? [0x89, 0x50, 0x4e, 0x47]
          : input.mimeType === "image/jpeg"
            ? [0xff, 0xd8, 0xff]
            : null;
      if (
        signatures &&
        !signatures.every((value, index) => buffer[index] === value)
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "图片格式与内容不一致 / 画像形式が一致しません",
        });
      if (
        input.mimeType === "image/webp" &&
        !(
          buffer.subarray(0, 4).toString() === "RIFF" &&
          buffer.subarray(8, 12).toString() === "WEBP"
        )
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WebP图片内容无效 / WebP画像が不正です",
        });
      const digest = createHash("sha256").update(buffer).digest("hex");
      const stored = await storagePut(
        `store-command/evidence/${input.storeId}/${digest}-${safeFileName(input.fileName)}`,
        buffer,
        input.mimeType
      );
      return { url: stored.url, key: stored.key, sha256: digest };
    }),

  taskEvents: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        workItemId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireStorePermission(ctx, input.storeId, "view");
      const [result] = await pool().query<RowDataPacket[]>(
        `SELECT e.* FROM store_growth_task_events e JOIN store_growth_task_details d ON d.id=e.taskDetailId WHERE e.storeId=? AND e.workItemId=? ORDER BY e.createdAt,e.id`,
        [input.storeId, input.workItemId]
      );
      return result;
    }),
});
