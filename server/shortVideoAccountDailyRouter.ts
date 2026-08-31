import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  SHORT_VIDEO_DAILY_PAGE_KEY,
  calculateShortVideoAccountSalesMetrics,
  getMonthBounds,
  isFutureTokyoDate,
  type ShortVideoDailyCurrency,
} from "../shared/shortVideoDaily";
import { ensureShortVideoDailySchemaReady } from "./shortVideoDailyUpgrade";

let runtimePool: Pool | undefined;

function pool(): Pool {
  if (!runtimePool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    runtimePool = mysql.createPool({
      uri,
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 30,
    });
  }
  return runtimePool;
}

function actor(ctx: any) {
  return {
    id: Number(ctx.user.id),
    name: String(
      ctx.user.name || ctx.user.email || `user:${ctx.user.id}`
    ).slice(0, 255),
  };
}

type Access = { canView: boolean; canEdit: boolean };

export async function resolveShortVideoAccountDailyAccess(
  ctx: any,
  connection: Pool | PoolConnection
): Promise<Access> {
  if (ctx.user.role === "admin") return { canView: true, canEdit: true };
  const [assignmentRows] = await connection.query<RowDataPacket[]>(
    "SELECT roleId FROM user_role_assignments WHERE userId=? LIMIT 1",
    [Number(ctx.user.id)]
  );
  const roleId = Number(assignmentRows[0]?.roleId || 0);
  if (!roleId) return { canView: false, canEdit: false };
  const [permissionRows] = await connection.query<RowDataPacket[]>(
    "SELECT canView,canEdit FROM role_permissions WHERE roleId=? AND pageKey=? LIMIT 1",
    [roleId, SHORT_VIDEO_DAILY_PAGE_KEY]
  );
  const permission = permissionRows[0];
  return {
    canView: Boolean(permission?.canView || permission?.canEdit),
    canEdit: Boolean(permission?.canEdit),
  };
}

async function requireAccess(
  ctx: any,
  mode: "view" | "edit",
  connection: Pool | PoolConnection = pool()
) {
  const access = await resolveShortVideoAccountDailyAccess(ctx, connection);
  if (mode === "edit" ? !access.canEdit : !access.canView) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "没有账号每日销售权限 / アカウント日次売上の権限がありません",
    });
  }
  return access;
}

const reportDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => !isFutureTokyoDate(value), {
    message: "数据日期不能是未来日期 / データ日は未来にできません",
  });
const ordersSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const gmvSchema = z.number().finite().min(0).max(1_000_000_000_000_000);

export const shortVideoAccountDailySalesInputSchema = z.object({
  reportDate: reportDateSchema,
  accountId: z.number().int().positive(),
  responsibleStaffId: z.number().int().positive(),
  orders: ordersSchema.default(0),
  gmv: gmvSchema.default(0),
  currency: z.enum(["JPY", "CNY"]).default("JPY"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapSale(row: RowDataPacket) {
  return {
    id: Number(row.id),
    reportDate: String(row.reportDateText || row.reportDate).slice(0, 10),
    accountId: Number(row.accountId),
    accountName: String(row.accountName),
    responsibleStaffId: Number(row.responsibleStaffId),
    responsibleName: String(row.responsibleName),
    orders: numberValue(row.orders),
    gmv: numberValue(row.gmv),
    currency: String(row.currency) as ShortVideoDailyCurrency,
    notes: row.notes == null ? null : String(row.notes),
    createdByName: row.createdByName == null ? null : String(row.createdByName),
    updatedByName: row.updatedByName == null ? null : String(row.updatedByName),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function loadResponsible(
  connection: Pool | PoolConnection,
  staffId: number
): Promise<string> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,name FROM staff
      WHERE id=? AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
      LIMIT 1`,
    [staffId]
  );
  if (!rows[0]) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "负责人必须选择当前在职员工 / 担当者は在職スタッフから選択してください",
    });
  }
  return String(rows[0].name);
}

async function loadAccount(
  connection: Pool | PoolConnection,
  accountId: number
): Promise<string> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,accountName,displayName FROM svm_accounts
      WHERE id=? AND status!='archived' LIMIT 1`,
    [accountId]
  );
  if (!rows[0]) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "短视频账号不存在或已归档 / 短動画アカウントが存在しないかアーカイブ済みです",
    });
  }
  return String(rows[0].displayName || rows[0].accountName);
}

async function assertUniqueAccountDay(
  connection: Pool | PoolConnection,
  reportDate: string,
  accountId: number,
  exceptId?: number
) {
  const where = ["reportDate=?", "accountId=?", "deletedAt IS NULL"];
  const params: number[] | Array<number | string> = [reportDate, accountId];
  if (exceptId != null) {
    where.push("id<>?");
    params.push(exceptId);
  }
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM short_video_account_daily_sales WHERE ${where.join(
      " AND "
    )} LIMIT 1`,
    params
  );
  if (rows[0]) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "该账号当天已经登记，请编辑原记录 / このアカウントの日次売上は登録済みです。既存データを編集してください",
    });
  }
}

async function insertAudit(
  connection: Pool | PoolConnection,
  saleId: number,
  action: "create" | "update" | "delete",
  before: unknown,
  after: unknown,
  currentActor: ReturnType<typeof actor>
) {
  await connection.query(
    `INSERT INTO short_video_account_daily_sales_audit_logs
      (saleId,action,beforeJson,afterJson,actorId,actorName)
     VALUES (?,?,?,?,?,?)`,
    [
      saleId,
      action,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      currentActor.id,
      currentActor.name,
    ]
  );
}

function duplicateError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "ER_DUP_ENTRY"
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "该账号当天已经登记，请编辑原记录 / このアカウントの日次売上は登録済みです。既存データを編集してください",
    });
  }
  throw error;
}

export const shortVideoAccountDailyRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        responsibleStaffId: z.number().int().positive().optional(),
        accountId: z.number().int().positive().optional(),
        currency: z.enum(["JPY", "CNY"]).optional(),
        search: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      await requireAccess(ctx, "view");
      const { startDate, endDate } = getMonthBounds(input.month);
      const where = ["deletedAt IS NULL", "reportDate BETWEEN ? AND ?"];
      const params: Array<string | number> = [startDate, endDate];
      if (input.responsibleStaffId) {
        where.push("responsibleStaffId=?");
        params.push(input.responsibleStaffId);
      }
      if (input.accountId) {
        where.push("accountId=?");
        params.push(input.accountId);
      }
      if (input.currency) {
        where.push("currency=?");
        params.push(input.currency);
      }
      if (input.search) {
        where.push(
          "(accountName LIKE ? OR responsibleName LIKE ? OR notes LIKE ?)"
        );
        const term = `%${input.search}%`;
        params.push(term, term, term);
      }
      const [countRows] = await pool().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM short_video_account_daily_sales WHERE ${where.join(
          " AND "
        )}`,
        params
      );
      const [rows] = await pool().query<RowDataPacket[]>(
        `SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText
           FROM short_video_account_daily_sales WHERE ${where.join(" AND ")}
          ORDER BY reportDate DESC,accountName,id DESC LIMIT ? OFFSET ?`,
        [...params, input.limit, input.offset]
      );
      return {
        items: rows.map(mapSale),
        total: Number(countRows[0]?.total || 0),
      };
    }),

  monthlySummary: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }))
    .query(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      await requireAccess(ctx, "view");
      const { startDate, endDate } = getMonthBounds(input.month);
      const [rows] = await pool().query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText,
                accountId,accountName,responsibleStaffId,responsibleName,
                orders,gmv,currency
           FROM short_video_account_daily_sales
          WHERE deletedAt IS NULL AND reportDate BETWEEN ? AND ?
          ORDER BY reportDate,accountName,id`,
        [startDate, endDate]
      );
      const entries = rows.map(row => ({
        reportDate: String(row.reportDateText || row.reportDate).slice(0, 10),
        accountId: Number(row.accountId),
        accountName: String(row.accountName),
        responsibleStaffId: Number(row.responsibleStaffId),
        responsibleName: String(row.responsibleName),
        orders: numberValue(row.orders),
        gmv: numberValue(row.gmv),
        currency: String(row.currency) as ShortVideoDailyCurrency,
      }));
      const summarize = (selected: typeof entries) =>
        (["JPY", "CNY"] as const).map(currency => ({
          currency,
          ...calculateShortVideoAccountSalesMetrics(
            selected.filter(row => row.currency === currency)
          ),
        }));
      const daily = [...new Set(entries.map(row => row.reportDate))]
        .sort((left, right) => right.localeCompare(left))
        .map(reportDate => ({
          reportDate,
          currencies: summarize(
            entries.filter(row => row.reportDate === reportDate)
          ),
        }));
      const accounts = [
        ...new Map(
          entries.map(row => [row.accountId, row.accountName])
        ).entries(),
      ]
        .map(([accountId, accountName]) => ({
          accountId,
          accountName,
          currencies: summarize(
            entries.filter(row => row.accountId === accountId)
          ),
        }))
        .sort((left, right) =>
          left.accountName.localeCompare(right.accountName, "ja")
        );
      const responsibles = [
        ...new Map(
          entries.map(row => [row.responsibleStaffId, row.responsibleName])
        ).entries(),
      ]
        .map(([responsibleStaffId, responsibleName]) => ({
          responsibleStaffId,
          responsibleName,
          currencies: summarize(
            entries.filter(row => row.responsibleStaffId === responsibleStaffId)
          ),
        }))
        .sort((left, right) =>
          left.responsibleName.localeCompare(right.responsibleName, "ja")
        );
      return {
        month: input.month,
        currencies: summarize(entries),
        daily,
        accounts,
        responsibles,
      };
    }),

  create: protectedProcedure
    .input(shortVideoAccountDailySalesInputSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx, "edit", connection);
        await assertUniqueAccountDay(
          connection,
          input.reportDate,
          input.accountId
        );
        const accountName = await loadAccount(connection, input.accountId);
        const responsibleName = await loadResponsible(
          connection,
          input.responsibleStaffId
        );
        const currentActor = actor(ctx);
        const [result] = await connection.query<any>(
          `INSERT INTO short_video_account_daily_sales
            (reportDate,accountId,accountName,responsibleStaffId,responsibleName,
             orders,gmv,currency,notes,createdById,createdByName,updatedById,updatedByName)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            input.reportDate,
            input.accountId,
            accountName,
            input.responsibleStaffId,
            responsibleName,
            input.orders,
            input.gmv,
            input.currency,
            input.notes || null,
            currentActor.id,
            currentActor.name,
            currentActor.id,
            currentActor.name,
          ]
        );
        const id = Number(result.insertId);
        const [createdRows] = await connection.query<RowDataPacket[]>(
          "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_account_daily_sales WHERE id=?",
          [id]
        );
        await insertAudit(
          connection,
          id,
          "create",
          null,
          mapSale(createdRows[0]),
          currentActor
        );
        await connection.commit();
        return { success: true, id };
      } catch (error) {
        await connection.rollback();
        duplicateError(error);
      } finally {
        connection.release();
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        entry: shortVideoAccountDailySalesInputSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx, "edit", connection);
        const [beforeRows] = await connection.query<RowDataPacket[]>(
          "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_account_daily_sales WHERE id=? AND deletedAt IS NULL FOR UPDATE",
          [input.id]
        );
        if (!beforeRows[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "账号日数据不存在 / アカウント日次データがありません",
          });
        }
        await assertUniqueAccountDay(
          connection,
          input.entry.reportDate,
          input.entry.accountId,
          input.id
        );
        const accountName = await loadAccount(
          connection,
          input.entry.accountId
        );
        const responsibleName = await loadResponsible(
          connection,
          input.entry.responsibleStaffId
        );
        const currentActor = actor(ctx);
        await connection.query(
          `UPDATE short_video_account_daily_sales SET
             reportDate=?,accountId=?,accountName=?,responsibleStaffId=?,responsibleName=?,
             orders=?,gmv=?,currency=?,notes=?,updatedById=?,updatedByName=?
           WHERE id=? AND deletedAt IS NULL`,
          [
            input.entry.reportDate,
            input.entry.accountId,
            accountName,
            input.entry.responsibleStaffId,
            responsibleName,
            input.entry.orders,
            input.entry.gmv,
            input.entry.currency,
            input.entry.notes || null,
            currentActor.id,
            currentActor.name,
            input.id,
          ]
        );
        const [afterRows] = await connection.query<RowDataPacket[]>(
          "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_account_daily_sales WHERE id=?",
          [input.id]
        );
        await insertAudit(
          connection,
          input.id,
          "update",
          mapSale(beforeRows[0]),
          mapSale(afterRows[0]),
          currentActor
        );
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        duplicateError(error);
      } finally {
        connection.release();
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx, "edit", connection);
        const [beforeRows] = await connection.query<RowDataPacket[]>(
          "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_account_daily_sales WHERE id=? AND deletedAt IS NULL FOR UPDATE",
          [input.id]
        );
        if (!beforeRows[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "账号日数据不存在 / アカウント日次データがありません",
          });
        }
        const currentActor = actor(ctx);
        await connection.query(
          "UPDATE short_video_account_daily_sales SET deletedAt=CURRENT_TIMESTAMP,activeKey=id,deletedById=?,updatedById=?,updatedByName=? WHERE id=? AND deletedAt IS NULL",
          [currentActor.id, currentActor.id, currentActor.name, input.id]
        );
        await insertAudit(
          connection,
          input.id,
          "delete",
          mapSale(beforeRows[0]),
          null,
          currentActor
        );
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
});
