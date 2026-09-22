import { TRPCError } from "@trpc/server";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { financeProcedure, router } from "./_core/trpc";
import { createActivityLog } from "./db";
import { getPool } from "./selectionCenterRouter";

export const FIXED_ASSET_CATEGORIES = [
  "mobile_phone",
  "computer",
  "tablet",
  "camera",
  "filming_equipment",
  "office_equipment",
  "furniture",
  "vehicle",
  "other",
] as const;

export const FIXED_ASSET_STATUSES = [
  "available",
  "in_use",
  "repair",
  "lost",
  "retired",
  "disposed",
] as const;

export const FIXED_ASSET_CONDITIONS = ["new", "good", "fair", "poor"] as const;

export type FixedAssetCategory = (typeof FIXED_ASSET_CATEGORIES)[number];
export type FixedAssetStatus = (typeof FIXED_ASSET_STATUSES)[number];
export type FixedAssetCondition = (typeof FIXED_ASSET_CONDITIONS)[number];

const dateText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "正しい日付を入力してください");

const nullableText = (max: number) => z.string().trim().max(max).nullable();

export function hasAtMostTwoDecimalPlaces(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const scaled = value * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

const fixedAssetInput = z.object({
  assetCode: nullableText(64),
  assetName: z.string().trim().min(1, "資産名を入力してください").max(255),
  category: z.enum(FIXED_ASSET_CATEGORIES),
  brandModel: nullableText(255),
  serialNumber: nullableText(255),
  entity: z.enum(["japan", "china"]),
  acquisitionDate: dateText.nullable(),
  purchasePrice: z.number().finite().min(0).max(999_999_999_999.99)
    .refine(hasAtMostTwoDecimalPlaces, "取得金額は小数点以下2桁以内で入力してください")
    .nullable(),
  currency: z.enum(["JPY", "CNY"]),
  vendor: nullableText(255),
  invoiceNumber: nullableText(255),
  location: nullableText(255),
  assigneeStaffId: z.number().int().positive().nullable(),
  assignedAt: dateText.nullable(),
  status: z.enum(FIXED_ASSET_STATUSES),
  conditionStatus: z.enum(FIXED_ASSET_CONDITIONS),
  warrantyEndDate: dateText.nullable(),
  notes: nullableText(5000),
});

export type FixedAssetInput = z.infer<typeof fixedAssetInput>;

export function validateFixedAssetLifecycle(
  input: Pick<FixedAssetInput, "acquisitionDate" | "assigneeStaffId" | "assignedAt" | "status" | "warrantyEndDate">,
  today = currentDate(),
): void {
  const hasAssignee = input.assigneeStaffId != null;
  const hasAssignedAt = input.assignedAt != null;
  if (hasAssignee !== hasAssignedAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "使用者と領用日を両方入力してください" });
  }
  if (input.status === "in_use" && !hasAssignee) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "使用中の資産には使用者と領用日を指定してください" });
  }
  if (["available", "retired", "disposed"].includes(input.status) && hasAssignee) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "未領用・退役・処分済みの資産には現在の使用者を指定できません" });
  }
  if (input.acquisitionDate && input.acquisitionDate > today) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "取得日は未来日にできません" });
  }
  if (input.assignedAt && input.assignedAt > today) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "領用日は未来日にできません" });
  }
  if (input.acquisitionDate && input.assignedAt && input.assignedAt < input.acquisitionDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "領用日は取得日以降にしてください" });
  }
  if (input.acquisitionDate && input.warrantyEndDate && input.warrantyEndDate < input.acquisitionDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "保証期限は取得日以降にしてください" });
  }
}

type Queryable = Pick<Pool, "query"> | Pick<PoolConnection, "query">;

type AssigneeSnapshot = {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
};

type FixedAssetListRow = {
  id: number;
  assetCode: string;
  assetName: string;
  category: FixedAssetCategory;
  brandModel: string | null;
  serialNumber: string | null;
  entity: "japan" | "china";
  acquisitionDate: string | null;
  purchasePrice: number | null;
  currency: "JPY" | "CNY";
  vendor: string | null;
  invoiceNumber: string | null;
  location: string | null;
  assigneeStaffId: number | null;
  assigneeName: string | null;
  assigneeDepartment: string | null;
  assigneePosition: string | null;
  assignedAt: string | null;
  status: FixedAssetStatus;
  conditionStatus: FixedAssetCondition;
  warrantyEndDate: string | null;
  notes: string | null;
  version: number;
  createdByName: string;
  updatedByName: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
};

let fixedAssetSchemaPromise: Promise<void> | null = null;

export async function ensureFixedAssetSchema(pool: Pool): Promise<void> {
  if (!fixedAssetSchemaPromise) {
    fixedAssetSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS company_fixed_assets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          assetCode VARCHAR(64) DEFAULT NULL,
          assetName VARCHAR(255) NOT NULL,
          category VARCHAR(40) NOT NULL,
          brandModel VARCHAR(255) DEFAULT NULL,
          serialNumber VARCHAR(255) DEFAULT NULL,
          entity ENUM('japan','china') NOT NULL DEFAULT 'japan',
          acquisitionDate DATE DEFAULT NULL,
          purchasePrice DECIMAL(15,2) DEFAULT NULL,
          currency ENUM('JPY','CNY') NOT NULL DEFAULT 'JPY',
          vendor VARCHAR(255) DEFAULT NULL,
          invoiceNumber VARCHAR(255) DEFAULT NULL,
          location VARCHAR(255) DEFAULT NULL,
          assigneeStaffId INT DEFAULT NULL,
          assigneeName VARCHAR(255) DEFAULT NULL,
          assigneeDepartment VARCHAR(255) DEFAULT NULL,
          assigneePosition VARCHAR(255) DEFAULT NULL,
          assignedAt DATE DEFAULT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'available',
          conditionStatus VARCHAR(32) NOT NULL DEFAULT 'good',
          warrantyEndDate DATE DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          version INT NOT NULL DEFAULT 1,
          createdBy INT NOT NULL,
          createdByName VARCHAR(255) NOT NULL,
          updatedBy INT NOT NULL,
          updatedByName VARCHAR(255) NOT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deletedAt TIMESTAMP NULL DEFAULT NULL,
          UNIQUE KEY uq_company_fixed_assets_code (assetCode),
          INDEX idx_company_fixed_assets_status (status, deletedAt),
          INDEX idx_company_fixed_assets_category (category, deletedAt),
          INDEX idx_company_fixed_assets_assignee (assigneeStaffId, deletedAt),
          INDEX idx_company_fixed_assets_entity (entity, deletedAt)
        ) ENGINE=InnoDB
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS company_fixed_asset_events (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          assetId INT NOT NULL,
          eventType VARCHAR(32) NOT NULL,
          previousAssigneeStaffId INT DEFAULT NULL,
          previousAssigneeName VARCHAR(255) DEFAULT NULL,
          assigneeStaffId INT DEFAULT NULL,
          assigneeName VARCHAR(255) DEFAULT NULL,
          previousStatus VARCHAR(32) DEFAULT NULL,
          status VARCHAR(32) DEFAULT NULL,
          previousLocation VARCHAR(255) DEFAULT NULL,
          location VARCHAR(255) DEFAULT NULL,
          changes JSON DEFAULT NULL,
          note TEXT DEFAULT NULL,
          createdBy INT NOT NULL,
          createdByName VARCHAR(255) NOT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_company_fixed_asset_events_asset (assetId, createdAt),
          INDEX idx_company_fixed_asset_events_type (eventType, createdAt),
          CONSTRAINT fk_company_fixed_asset_events_asset
            FOREIGN KEY (assetId) REFERENCES company_fixed_assets(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB
      `);
      const [triggerRows] = await pool.query<RowDataPacket[]>(
        `SELECT TRIGGER_NAME
           FROM information_schema.TRIGGERS
          WHERE TRIGGER_SCHEMA = DATABASE()
            AND TRIGGER_NAME IN ('trg_fixed_asset_events_no_update','trg_fixed_asset_events_no_delete')`,
      );
      const triggerNames = new Set(triggerRows.map((row) => String(row.TRIGGER_NAME)));
      if (!triggerNames.has("trg_fixed_asset_events_no_update")) {
        await pool.query(`
            CREATE TRIGGER trg_fixed_asset_events_no_update
            BEFORE UPDATE ON company_fixed_asset_events
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixed asset events are append-only'
          `).catch((error) => {
            if ((error as any)?.code !== "ER_TRG_ALREADY_EXISTS") throw error;
          });
      }
      if (!triggerNames.has("trg_fixed_asset_events_no_delete")) {
        await pool.query(`
            CREATE TRIGGER trg_fixed_asset_events_no_delete
            BEFORE DELETE ON company_fixed_asset_events
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixed asset events are append-only'
          `).catch((error) => {
            if ((error as any)?.code !== "ER_TRG_ALREADY_EXISTS") throw error;
          });
      }
    })().catch((error) => {
      fixedAssetSchemaPromise = null;
      throw error;
    });
  }
  return fixedAssetSchemaPromise;
}

export function resetFixedAssetSchemaForTests() {
  fixedAssetSchemaPromise = null;
}

function requirePool(): Pool {
  const pool = getPool();
  if (!pool) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "固定資産台帳のデータベースに接続できません" });
  }
  return pool;
}

async function readyPool(): Promise<Pool> {
  const pool = requirePool();
  await ensureFixedAssetSchema(pool);
  return pool;
}

function nullable(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function currentDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function loadAssignee(
  connection: Queryable,
  staffId: number | null,
  existing?: {
    assigneeStaffId?: number | null;
    assigneeName?: string | null;
    assigneeDepartment?: string | null;
    assigneePosition?: string | null;
  },
): Promise<AssigneeSnapshot | null> {
  if (staffId == null) return null;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, name, department, position
       FROM staff
      WHERE id = ? AND isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
      LIMIT 1`,
    [staffId],
  );
  if (rows[0]) {
    if (Number(existing?.assigneeStaffId) === staffId && existing?.assigneeName) {
      return {
        id: staffId,
        name: existing.assigneeName,
        department: existing.assigneeDepartment || null,
        position: existing.assigneePosition || null,
      };
    }
    return {
      id: Number(rows[0].id),
      name: String(rows[0].name),
      department: rows[0].department == null ? null : String(rows[0].department),
      position: rows[0].position == null ? null : String(rows[0].position),
    };
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "現在の使用者が在職者一覧に見つかりません。別の在職者へ再割当てするか、未分配にしてください" });
}

function normalizeAssetRow(row: any): FixedAssetListRow {
  return {
    id: Number(row.id),
    assetCode: String(row.assetCode),
    assetName: String(row.assetName),
    category: String(row.category) as FixedAssetCategory,
    brandModel: row.brandModel == null ? null : String(row.brandModel),
    serialNumber: row.serialNumber == null ? null : String(row.serialNumber),
    entity: row.entity === "china" ? "china" : "japan",
    acquisitionDate: row.acquisitionDate == null ? null : String(row.acquisitionDate),
    assigneeStaffId: row.assigneeStaffId == null ? null : Number(row.assigneeStaffId),
    assigneeName: row.assigneeName == null ? null : String(row.assigneeName),
    assigneeDepartment: row.assigneeDepartment == null ? null : String(row.assigneeDepartment),
    assigneePosition: row.assigneePosition == null ? null : String(row.assigneePosition),
    assignedAt: row.assignedAt == null ? null : String(row.assignedAt),
    purchasePrice: row.purchasePrice == null ? null : Number(row.purchasePrice),
    currency: row.currency === "CNY" ? "CNY" : "JPY",
    vendor: row.vendor == null ? null : String(row.vendor),
    invoiceNumber: row.invoiceNumber == null ? null : String(row.invoiceNumber),
    location: row.location == null ? null : String(row.location),
    status: String(row.status) as FixedAssetStatus,
    conditionStatus: String(row.conditionStatus) as FixedAssetCondition,
    warrantyEndDate: row.warrantyEndDate == null ? null : String(row.warrantyEndDate),
    notes: row.notes == null ? null : String(row.notes),
    version: Number(row.version || 1),
    createdByName: String(row.createdByName),
    updatedByName: String(row.updatedByName),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

export function resolveFixedAssetEventType(
  before: { assigneeStaffId?: number | null; status?: string | null },
  after: { assigneeStaffId?: number | null; status?: string | null },
): "assign" | "transfer" | "unassign" | "status_change" | "update" {
  if (Number(before.assigneeStaffId || 0) !== Number(after.assigneeStaffId || 0)) {
    if (!before.assigneeStaffId && after.assigneeStaffId) return "assign";
    if (before.assigneeStaffId && !after.assigneeStaffId) return "unassign";
    return "transfer";
  }
  if (before.status !== after.status) return "status_change";
  return "update";
}

const FIXED_ASSET_EVENT_FIELDS = [
  "assetCode", "assetName", "category", "brandModel", "serialNumber", "entity",
  "acquisitionDate", "purchasePrice", "currency", "vendor", "invoiceNumber",
  "location", "assigneeStaffId", "assigneeName", "assigneeDepartment",
  "assigneePosition", "assignedAt", "status", "conditionStatus", "warrantyEndDate", "notes",
] as const;

function comparableValue(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function dateOnly(value: unknown): string | null {
  const normalized = comparableValue(value);
  return normalized ? normalized.slice(0, 10) : null;
}

export function buildFixedAssetChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: string | null; after: string | null }> {
  const changes: Record<string, { before: string | null; after: string | null }> = {};
  for (const key of FIXED_ASSET_EVENT_FIELDS) {
    const oldValue = comparableValue(before[key]);
    const newValue = comparableValue(after[key]);
    if (oldValue !== newValue) changes[key] = { before: oldValue, after: newValue };
  }
  return changes;
}

function actor(ctx: any) {
  return {
    id: Number(ctx.user.id),
    name: String(ctx.user.name || ctx.user.email || `user:${ctx.user.id}`).slice(0, 255),
  };
}

async function addEvent(
  connection: Queryable,
  input: {
    assetId: number;
    eventType: string;
    previousAssigneeStaffId?: number | null;
    previousAssigneeName?: string | null;
    assigneeStaffId?: number | null;
    assigneeName?: string | null;
    previousStatus?: string | null;
    status?: string | null;
    previousLocation?: string | null;
    location?: string | null;
    changes?: Record<string, { before: unknown; after: unknown }>;
    note?: string | null;
    actorId: number;
    actorName: string;
  },
) {
  await connection.query(
    `INSERT INTO company_fixed_asset_events
      (assetId, eventType, previousAssigneeStaffId, previousAssigneeName,
       assigneeStaffId, assigneeName, previousStatus, status,
       previousLocation, location, changes, note, createdBy, createdByName)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.assetId,
      input.eventType,
      input.previousAssigneeStaffId ?? null,
      input.previousAssigneeName ?? null,
      input.assigneeStaffId ?? null,
      input.assigneeName ?? null,
      input.previousStatus ?? null,
      input.status ?? null,
      input.previousLocation ?? null,
      input.location ?? null,
      input.changes ? JSON.stringify(input.changes) : null,
      nullable(input.note || null),
      input.actorId,
      input.actorName,
    ],
  );
}

function duplicateCodeError(error: unknown): never {
  if ((error as any)?.code === "ER_DUP_ENTRY") {
    throw new TRPCError({ code: "CONFLICT", message: "同じ資産番号が既に登録されています" });
  }
  throw error;
}

export const fixedAssetRouter = router({
  overview: financeProcedure
    .input(z.object({
      search: z.string().trim().max(100).optional(),
      category: z.enum(FIXED_ASSET_CATEGORIES).optional(),
      status: z.enum(FIXED_ASSET_STATUSES).optional(),
      assigneeStaffId: z.number().int().positive().optional(),
      unassignedOnly: z.boolean().optional(),
      includeArchived: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const pool = await readyPool();
      const where = [input?.includeArchived ? "1=1" : "deletedAt IS NULL"];
      const params: unknown[] = [];
      if (input?.search) {
        where.push("(assetCode LIKE ? OR assetName LIKE ? OR brandModel LIKE ? OR serialNumber LIKE ? OR location LIKE ? OR assigneeName LIKE ?)");
        const pattern = `%${input.search}%`;
        params.push(pattern, pattern, pattern, pattern, pattern, pattern);
      }
      if (input?.category) {
        where.push("category = ?");
        params.push(input.category);
      }
      if (input?.status) {
        where.push("status = ?");
        params.push(input.status);
      }
      if (input?.unassignedOnly) {
        where.push("assigneeStaffId IS NULL");
      } else if (input?.assigneeStaffId) {
        where.push("assigneeStaffId = ?");
        params.push(input.assigneeStaffId);
      }

      const [assetRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, assetCode, assetName, category, brandModel, serialNumber, entity,
                DATE_FORMAT(acquisitionDate, '%Y-%m-%d') AS acquisitionDate,
                purchasePrice, currency, vendor, invoiceNumber, location,
                assigneeStaffId, assigneeName, assigneeDepartment, assigneePosition,
                DATE_FORMAT(assignedAt, '%Y-%m-%d') AS assignedAt,
                status, conditionStatus,
                DATE_FORMAT(warrantyEndDate, '%Y-%m-%d') AS warrantyEndDate,
                notes, version, createdByName, updatedByName, createdAt, updatedAt, deletedAt
           FROM company_fixed_assets
          WHERE ${where.join(" AND ")}
          ORDER BY deletedAt IS NOT NULL, assetCode ASC, id ASC
          LIMIT 2000`,
        params,
      );
      const [summaryRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total,
                SUM(status = 'in_use') AS inUse,
                SUM(status = 'available') AS available,
                SUM(status IN ('repair','lost')) AS attention,
                SUM(assigneeStaffId IS NULL AND status NOT IN ('disposed','retired')) AS unassigned
           FROM company_fixed_assets
          WHERE deletedAt IS NULL`,
      );
      const [valueRows] = await pool.query<RowDataPacket[]>(
        `SELECT currency, COALESCE(SUM(purchasePrice), 0) AS totalPurchasePrice
           FROM company_fixed_assets
          WHERE deletedAt IS NULL
          GROUP BY currency`,
      );
      const [assigneeRows] = await pool.query<RowDataPacket[]>(
        `SELECT assigneeStaffId, COALESCE(assigneeName, '未分配') AS assigneeName,
                assigneeDepartment, COUNT(*) AS assetCount,
                SUM(status = 'in_use') AS inUseCount
           FROM company_fixed_assets
          WHERE deletedAt IS NULL
          GROUP BY assigneeStaffId, assigneeName, assigneeDepartment
          ORDER BY assetCount DESC, assigneeName ASC`,
      );
      const [categoryRows] = await pool.query<RowDataPacket[]>(
        `SELECT category, COUNT(*) AS assetCount
           FROM company_fixed_assets
          WHERE deletedAt IS NULL
          GROUP BY category
          ORDER BY assetCount DESC, category ASC`,
      );
      const summary = summaryRows[0] || {};
      return {
        assets: assetRows.map(normalizeAssetRow),
        summary: {
          total: Number(summary.total || 0),
          inUse: Number(summary.inUse || 0),
          available: Number(summary.available || 0),
          attention: Number(summary.attention || 0),
          unassigned: Number(summary.unassigned || 0),
          values: valueRows.map((row) => ({
            currency: String(row.currency) as "JPY" | "CNY",
            amount: Number(row.totalPurchasePrice || 0),
          })),
          byAssignee: assigneeRows.map((row) => ({
            staffId: row.assigneeStaffId == null ? null : Number(row.assigneeStaffId),
            name: String(row.assigneeName),
            department: row.assigneeDepartment == null ? null : String(row.assigneeDepartment),
            assetCount: Number(row.assetCount || 0),
            inUseCount: Number(row.inUseCount || 0),
          })),
          byCategory: categoryRows.map((row) => ({
            category: String(row.category) as FixedAssetCategory,
            assetCount: Number(row.assetCount || 0),
          })),
        },
      };
    }),

  history: financeProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pool = await readyPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, assetId, eventType, previousAssigneeStaffId, previousAssigneeName,
                assigneeStaffId, assigneeName, previousStatus, status,
                previousLocation, location, changes, note, createdByName, createdAt
           FROM company_fixed_asset_events
          WHERE assetId = ?
          ORDER BY createdAt DESC, id DESC
          LIMIT 500`,
        [input.assetId],
      );
      return rows.map((row) => ({
        id: Number(row.id),
        assetId: Number(row.assetId),
        eventType: String(row.eventType),
        previousAssigneeStaffId: row.previousAssigneeStaffId == null ? null : Number(row.previousAssigneeStaffId),
        previousAssigneeName: row.previousAssigneeName == null ? null : String(row.previousAssigneeName),
        assigneeStaffId: row.assigneeStaffId == null ? null : Number(row.assigneeStaffId),
        assigneeName: row.assigneeName == null ? null : String(row.assigneeName),
        previousStatus: row.previousStatus == null ? null : String(row.previousStatus) as FixedAssetStatus,
        status: row.status == null ? null : String(row.status) as FixedAssetStatus,
        previousLocation: row.previousLocation == null ? null : String(row.previousLocation),
        location: row.location == null ? null : String(row.location),
        changes: typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes,
        note: row.note == null ? null : String(row.note),
        createdByName: String(row.createdByName),
        createdAt: row.createdAt as Date | string,
      }));
    }),

  create: financeProcedure
    .input(fixedAssetInput)
    .mutation(async ({ input, ctx }) => {
      const pool = await readyPool();
      const connection = await pool.getConnection();
      const user = actor(ctx);
      try {
        await connection.beginTransaction();
        const assignee = await loadAssignee(connection, input.assigneeStaffId);
        const assignedAt = assignee ? input.assignedAt || currentDate() : null;
        validateFixedAssetLifecycle({
          acquisitionDate: input.acquisitionDate,
          assigneeStaffId: assignee?.id ?? null,
          assignedAt,
          status: input.status,
          warrantyEndDate: input.warrantyEndDate,
        });
        const requestedCode = nullable(input.assetCode);
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO company_fixed_assets
            (assetCode, assetName, category, brandModel, serialNumber, entity,
             acquisitionDate, purchasePrice, currency, vendor, invoiceNumber, location,
             assigneeStaffId, assigneeName, assigneeDepartment, assigneePosition, assignedAt,
             status, conditionStatus, warrantyEndDate, notes,
             createdBy, createdByName, updatedBy, updatedByName)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            requestedCode,
            input.assetName,
            input.category,
            nullable(input.brandModel),
            nullable(input.serialNumber),
            input.entity,
            input.acquisitionDate,
            input.purchasePrice,
            input.currency,
            nullable(input.vendor),
            nullable(input.invoiceNumber),
            nullable(input.location),
            assignee?.id ?? null,
            assignee?.name ?? null,
            assignee?.department ?? null,
            assignee?.position ?? null,
            assignedAt,
            input.status,
            input.conditionStatus,
            input.warrantyEndDate,
            nullable(input.notes),
            user.id,
            user.name,
            user.id,
            user.name,
          ],
        );
        const id = Number(result.insertId);
        const assetCode = requestedCode || `FA-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
        if (!requestedCode) {
          await connection.query("UPDATE company_fixed_assets SET assetCode = ? WHERE id = ?", [assetCode, id]);
        }
        const createdSnapshot = {
          assetCode,
          assetName: input.assetName,
          category: input.category,
          brandModel: nullable(input.brandModel),
          serialNumber: nullable(input.serialNumber),
          entity: input.entity,
          acquisitionDate: input.acquisitionDate,
          purchasePrice: input.purchasePrice,
          currency: input.currency,
          vendor: nullable(input.vendor),
          invoiceNumber: nullable(input.invoiceNumber),
          location: nullable(input.location),
          assigneeStaffId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          assigneeDepartment: assignee?.department ?? null,
          assigneePosition: assignee?.position ?? null,
          assignedAt,
          status: input.status,
          conditionStatus: input.conditionStatus,
          warrantyEndDate: input.warrantyEndDate,
          notes: nullable(input.notes),
        };
        await addEvent(connection, {
          assetId: id,
          eventType: "create",
          assigneeStaffId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          status: input.status,
          location: nullable(input.location),
          changes: buildFixedAssetChanges({}, createdSnapshot),
          note: input.notes,
          actorId: user.id,
          actorName: user.name,
        });
        await connection.commit();
        await createActivityLog({
          userId: user.id,
          actionType: "fixed_asset_create",
          actionLabel: "固定資産を登録",
          targetType: "fixed_asset",
          targetId: id,
          targetName: assetCode,
          metadata: { module: "finance_fixed_assets", category: input.category },
        }).catch(() => undefined);
        return { success: true, id, assetCode };
      } catch (error) {
        await connection.rollback();
        duplicateCodeError(error);
      } finally {
        connection.release();
      }
    }),

  update: financeProcedure
    .input(fixedAssetInput.extend({
      id: z.number().int().positive(),
      version: z.number().int().positive(),
      changeNote: nullableText(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await readyPool();
      const connection = await pool.getConnection();
      const user = actor(ctx);
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM company_fixed_assets WHERE id = ? AND deletedAt IS NULL FOR UPDATE",
          [input.id],
        );
        const before = rows[0] as Record<string, any> | undefined;
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "固定資産が見つかりません" });
        if (Number(before.version || 1) !== input.version) {
          throw new TRPCError({ code: "CONFLICT", message: "別の担当者が更新しました。再読み込みして確認してください" });
        }
        const assignee = await loadAssignee(connection, input.assigneeStaffId, {
          assigneeStaffId: before.assigneeStaffId == null ? null : Number(before.assigneeStaffId),
          assigneeName: before.assigneeName == null ? null : String(before.assigneeName),
          assigneeDepartment: before.assigneeDepartment == null ? null : String(before.assigneeDepartment),
          assigneePosition: before.assigneePosition == null ? null : String(before.assigneePosition),
        });
        const assignedAt = assignee ? input.assignedAt || currentDate() : null;
        validateFixedAssetLifecycle({
          acquisitionDate: input.acquisitionDate,
          assigneeStaffId: assignee?.id ?? null,
          assignedAt,
          status: input.status,
          warrantyEndDate: input.warrantyEndDate,
        });
        const assetCode = nullable(input.assetCode) || String(before.assetCode);
        const next = {
          assetCode,
          assetName: input.assetName,
          category: input.category,
          brandModel: nullable(input.brandModel),
          serialNumber: nullable(input.serialNumber),
          entity: input.entity,
          acquisitionDate: input.acquisitionDate,
          purchasePrice: input.purchasePrice,
          currency: input.currency,
          vendor: nullable(input.vendor),
          invoiceNumber: nullable(input.invoiceNumber),
          location: nullable(input.location),
          assigneeStaffId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          assigneeDepartment: assignee?.department ?? null,
          assigneePosition: assignee?.position ?? null,
          assignedAt,
          status: input.status,
          conditionStatus: input.conditionStatus,
          warrantyEndDate: input.warrantyEndDate,
          notes: nullable(input.notes),
        };
        const changes = buildFixedAssetChanges(before, next);
        const eventType = resolveFixedAssetEventType(
          { assigneeStaffId: before.assigneeStaffId == null ? null : Number(before.assigneeStaffId), status: before.status == null ? null : String(before.status) },
          { assigneeStaffId: next.assigneeStaffId, status: next.status },
        );
        const [result] = await connection.query<ResultSetHeader>(
          `UPDATE company_fixed_assets
              SET assetCode=?, assetName=?, category=?, brandModel=?, serialNumber=?, entity=?,
                  acquisitionDate=?, purchasePrice=?, currency=?, vendor=?, invoiceNumber=?, location=?,
                  assigneeStaffId=?, assigneeName=?, assigneeDepartment=?, assigneePosition=?, assignedAt=?,
                  status=?, conditionStatus=?, warrantyEndDate=?, notes=?, version=version+1,
                  updatedBy=?, updatedByName=?
            WHERE id=? AND version=? AND deletedAt IS NULL`,
          [
            next.assetCode, next.assetName, next.category, next.brandModel, next.serialNumber, next.entity,
            next.acquisitionDate, next.purchasePrice, next.currency, next.vendor, next.invoiceNumber, next.location,
            next.assigneeStaffId, next.assigneeName, next.assigneeDepartment, next.assigneePosition, next.assignedAt,
            next.status, next.conditionStatus, next.warrantyEndDate, next.notes,
            user.id, user.name, input.id, input.version,
          ],
        );
        if (result.affectedRows !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "更新が競合しました。再読み込みして確認してください" });
        }
        await addEvent(connection, {
          assetId: input.id,
          eventType,
          previousAssigneeStaffId: before.assigneeStaffId == null ? null : Number(before.assigneeStaffId),
          previousAssigneeName: before.assigneeName,
          assigneeStaffId: next.assigneeStaffId,
          assigneeName: next.assigneeName,
          previousStatus: before.status,
          status: next.status,
          previousLocation: before.location,
          location: next.location,
          changes,
          note: input.changeNote,
          actorId: user.id,
          actorName: user.name,
        });
        await connection.commit();
        await createActivityLog({
          userId: user.id,
          actionType: "fixed_asset_update",
          actionLabel: "固定資産を更新",
          targetType: "fixed_asset",
          targetId: input.id,
          targetName: assetCode,
          metadata: { module: "finance_fixed_assets", eventType },
        }).catch(() => undefined);
        return { success: true };
      } catch (error) {
        await connection.rollback();
        duplicateCodeError(error);
      } finally {
        connection.release();
      }
    }),

  archive: financeProcedure
    .input(z.object({ id: z.number().int().positive(), version: z.number().int().positive(), reason: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const pool = await readyPool();
      const connection = await pool.getConnection();
      const user = actor(ctx);
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM company_fixed_assets WHERE id = ? AND deletedAt IS NULL FOR UPDATE",
          [input.id],
        );
        const asset = rows[0];
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "固定資産が見つかりません" });
        if (Number(asset.version || 1) !== input.version) {
          throw new TRPCError({ code: "CONFLICT", message: "別の担当者が更新しました。再読み込みして確認してください" });
        }
        const [result] = await connection.query<ResultSetHeader>(
          "UPDATE company_fixed_assets SET deletedAt=NOW(), version=version+1, updatedBy=?, updatedByName=? WHERE id=? AND version=? AND deletedAt IS NULL",
          [user.id, user.name, input.id, input.version],
        );
        if (result.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "アーカイブが競合しました" });
        await addEvent(connection, {
          assetId: input.id,
          eventType: "archive",
          previousAssigneeStaffId: asset.assigneeStaffId,
          previousAssigneeName: asset.assigneeName,
          assigneeStaffId: asset.assigneeStaffId,
          assigneeName: asset.assigneeName,
          previousStatus: asset.status,
          status: asset.status,
          previousLocation: asset.location,
          location: asset.location,
          changes: { archivedAt: { before: null, after: "archived" } },
          note: input.reason,
          actorId: user.id,
          actorName: user.name,
        });
        await connection.commit();
        await createActivityLog({
          userId: user.id,
          actionType: "fixed_asset_archive",
          actionLabel: "固定資産をアーカイブ",
          targetType: "fixed_asset",
          targetId: input.id,
          targetName: String(asset.assetCode),
          metadata: { module: "finance_fixed_assets", reason: input.reason },
        }).catch(() => undefined);
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  restore: financeProcedure
    .input(z.object({ id: z.number().int().positive(), version: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await readyPool();
      const connection = await pool.getConnection();
      const user = actor(ctx);
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM company_fixed_assets WHERE id = ? AND deletedAt IS NOT NULL FOR UPDATE",
          [input.id],
        );
        const asset = rows[0];
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "アーカイブ済み固定資産が見つかりません" });
        if (Number(asset.version || 1) !== input.version) {
          throw new TRPCError({ code: "CONFLICT", message: "別の担当者が更新しました。再読み込みして確認してください" });
        }
        const previousAssigneeStaffId = asset.assigneeStaffId == null ? null : Number(asset.assigneeStaffId);
        let restoredAssignee: AssigneeSnapshot | null = null;
        let restoredStatus = String(asset.status) as FixedAssetStatus;
        let restoredAssignedAt = dateOnly(asset.assignedAt);
        let restoreNote: string | null = null;
        if (previousAssigneeStaffId && !["available", "retired", "disposed"].includes(restoredStatus)) {
          try {
            restoredAssignee = await loadAssignee(connection, previousAssigneeStaffId);
            restoredAssignedAt ||= currentDate();
          } catch (error) {
            if (!(error instanceof TRPCError) || error.code !== "BAD_REQUEST") throw error;
            if (restoredStatus === "in_use") restoredStatus = "available";
            restoredAssignedAt = null;
            restoreNote = "原使用者が在職者一覧にないため、現在の使用者を解除して復元しました";
          }
        } else {
          restoredAssignedAt = null;
        }
        validateFixedAssetLifecycle({
          acquisitionDate: dateOnly(asset.acquisitionDate),
          assigneeStaffId: restoredAssignee?.id ?? null,
          assignedAt: restoredAssignee ? restoredAssignedAt : null,
          status: restoredStatus,
          warrantyEndDate: dateOnly(asset.warrantyEndDate),
        });
        const restoredSnapshot = {
          ...asset,
          assigneeStaffId: restoredAssignee?.id ?? null,
          assigneeName: restoredAssignee?.name ?? null,
          assigneeDepartment: restoredAssignee?.department ?? null,
          assigneePosition: restoredAssignee?.position ?? null,
          assignedAt: restoredAssignee ? restoredAssignedAt : null,
          status: restoredStatus,
        };
        const changes = {
          ...buildFixedAssetChanges(asset, restoredSnapshot),
          archivedAt: { before: "archived", after: null },
        };
        const [result] = await connection.query<ResultSetHeader>(
          `UPDATE company_fixed_assets
              SET deletedAt=NULL, assigneeStaffId=?, assigneeName=?, assigneeDepartment=?,
                  assigneePosition=?, assignedAt=?, status=?, version=version+1,
                  updatedBy=?, updatedByName=?
            WHERE id=? AND version=? AND deletedAt IS NOT NULL`,
          [
            restoredSnapshot.assigneeStaffId,
            restoredSnapshot.assigneeName,
            restoredSnapshot.assigneeDepartment,
            restoredSnapshot.assigneePosition,
            restoredSnapshot.assignedAt,
            restoredSnapshot.status,
            user.id,
            user.name,
            input.id,
            input.version,
          ],
        );
        if (result.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "復元が競合しました" });
        await addEvent(connection, {
          assetId: input.id,
          eventType: "restore",
          previousAssigneeStaffId,
          previousAssigneeName: asset.assigneeName,
          assigneeStaffId: restoredSnapshot.assigneeStaffId,
          assigneeName: restoredSnapshot.assigneeName,
          previousStatus: asset.status,
          status: restoredSnapshot.status,
          previousLocation: asset.location,
          location: asset.location,
          changes,
          note: restoreNote,
          actorId: user.id,
          actorName: user.name,
        });
        await connection.commit();
        await createActivityLog({
          userId: user.id,
          actionType: "fixed_asset_restore",
          actionLabel: "固定資産を復元",
          targetType: "fixed_asset",
          targetId: input.id,
          targetName: String(asset.assetCode),
          metadata: {
            module: "finance_fixed_assets",
            assigneeCleared: previousAssigneeStaffId != null && restoredSnapshot.assigneeStaffId == null,
          },
        }).catch(() => undefined);
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
});
