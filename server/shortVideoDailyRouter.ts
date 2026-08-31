import { createHash } from "node:crypto";
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
  calculateShortVideoEngagementMetrics,
  getMonthBounds,
  isFutureTokyoDate,
  normalizeShortVideoUrl,
  type ShortVideoDailyCurrency,
} from "../shared/shortVideoDaily";
import {
  ensureShortVideoDailySchemaReady,
  getShortVideoDailyUpgradeHealth,
} from "./shortVideoDailyUpgrade";

let runtimePool: Pool | undefined;

function pool(): Pool {
  if (!runtimePool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    runtimePool = mysql.createPool({
      uri,
      connectionLimit: 4,
      waitForConnections: true,
      queueLimit: 40,
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

export async function resolveShortVideoDailyAccess(
  ctx: any,
  connection: Pool | PoolConnection = pool()
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
  const access = await resolveShortVideoDailyAccess(ctx, connection);
  const allowed = mode === "edit" ? access.canEdit : access.canView;
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "没有短视频日报权限 / 短動画日報の権限がありません",
    });
  }
  return access;
}

const nonNegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const reportDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => !isFutureTokyoDate(value), {
    message: "数据日期不能是未来日期 / データ日は未来にできません",
  });

export const shortVideoDailyEntryInputSchema = z.object({
  reportDate: reportDateSchema,
  accountId: z.number().int().positive().nullable().optional(),
  videoUrl: z.string().trim().url().max(1200),
  producerStaffId: z.number().int().positive(),
  views: nonNegativeInteger.default(0),
  likes: nonNegativeInteger.default(0),
  comments: nonNegativeInteger.default(0),
  shares: nonNegativeInteger.default(0),
  saves: nonNegativeInteger.default(0),
  productClicks: nonNegativeInteger.default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function urlHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapEntry(row: RowDataPacket) {
  return {
    id: Number(row.id),
    reportDate: String(row.reportDateText || row.reportDate).slice(0, 10),
    accountId: row.accountId == null ? null : Number(row.accountId),
    accountName: row.accountName == null ? null : String(row.accountName),
    videoUrl: String(row.videoUrl),
    producerStaffId: Number(row.producerStaffId),
    producerName: String(row.producerName),
    views: numberValue(row.views),
    likes: numberValue(row.likes),
    comments: numberValue(row.comments),
    shares: numberValue(row.shares),
    saves: numberValue(row.saves),
    productClicks: numberValue(row.productClicks),
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

async function loadProducers(connection: Pool | PoolConnection, ids: number[]) {
  if (ids.length === 0) return new Map<number, string>();
  const unique = [...new Set(ids)];
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,name FROM staff
      WHERE id IN (${unique.map(() => "?").join(",")})
        AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL`,
    unique
  );
  const producers = new Map(
    rows.map(row => [Number(row.id), String(row.name)])
  );
  if (producers.size !== unique.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "制作人必须选择当前在职员工 / 制作者は在職スタッフから選択してください",
    });
  }
  return producers;
}

async function loadAccounts(connection: Pool | PoolConnection, ids: number[]) {
  if (ids.length === 0) return new Map<number, string>();
  const unique = [...new Set(ids)];
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,accountName,displayName FROM svm_accounts
      WHERE id IN (${unique.map(() => "?").join(",")}) AND status!='archived'`,
    unique
  );
  const accounts = new Map(
    rows.map(row => [
      Number(row.id),
      String(row.displayName || row.accountName),
    ])
  );
  if (accounts.size !== unique.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "发布账号不存在或已归档 / 投稿アカウントが存在しないかアーカイブ済みです",
    });
  }
  return accounts;
}

async function assertUniqueUrls(
  connection: Pool | PoolConnection,
  normalizedUrls: string[],
  exceptId?: number
) {
  const hashes = normalizedUrls.map(urlHash);
  if (new Set(hashes).size !== hashes.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "本次填写包含重复视频链接 / 今回の入力に重複URLがあります",
    });
  }
  const conditions = [
    `videoUrlHash IN (${hashes.map(() => "?").join(",")})`,
    "deletedAt IS NULL",
  ];
  const params: Array<string | number> = [...hashes];
  if (exceptId != null) {
    conditions.push("id<>?");
    params.push(exceptId);
  }
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,videoUrl FROM short_video_daily_entries WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params
  );
  if (rows.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "该视频链接已经登记 / この動画URLは登録済みです",
    });
  }
  return hashes;
}

async function insertAudit(
  connection: Pool | PoolConnection,
  entryId: number,
  action: "create" | "update" | "delete",
  before: unknown,
  after: unknown,
  currentActor: ReturnType<typeof actor>
) {
  await connection.query(
    `INSERT INTO short_video_daily_audit_logs
      (entryId,action,beforeJson,afterJson,actorId,actorName)
     VALUES (?,?,?,?,?,?)`,
    [
      entryId,
      action,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      currentActor.id,
      currentActor.name,
    ]
  );
}

export const shortVideoDailyRouter = router({
  access: protectedProcedure.query(async ({ ctx }) => {
    await ensureShortVideoDailySchemaReady();
    const access = await resolveShortVideoDailyAccess(ctx);
    if (!access.canView) await requireAccess(ctx, "view");
    return access;
  }),

  listProducers: protectedProcedure.query(async ({ ctx }) => {
    await ensureShortVideoDailySchemaReady();
    await requireAccess(ctx, "view");
    const [rows] = await pool().query<RowDataPacket[]>(
      `SELECT id,name,department,country FROM staff
        WHERE isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
        ORDER BY name,id`
    );
    return rows.map(row => ({
      id: Number(row.id),
      name: String(row.name),
      department: row.department == null ? null : String(row.department),
      country: row.country == null ? null : String(row.country),
    }));
  }),

  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    await ensureShortVideoDailySchemaReady();
    await requireAccess(ctx, "view");
    const [rows] = await pool().query<RowDataPacket[]>(
      `SELECT id,accountName,displayName,platform,status FROM svm_accounts
        WHERE status!='archived' ORDER BY accountName,id`
    );
    return rows.map(row => ({
      id: Number(row.id),
      accountName: String(row.accountName),
      displayName: row.displayName == null ? null : String(row.displayName),
      platform: String(row.platform),
      status: String(row.status),
    }));
  }),

  list: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        producerStaffId: z.number().int().positive().optional(),
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
      if (input.producerStaffId) {
        where.push("producerStaffId=?");
        params.push(input.producerStaffId);
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
          "(producerName LIKE ? OR accountName LIKE ? OR videoUrl LIKE ? OR notes LIKE ?)"
        );
        const term = `%${input.search}%`;
        params.push(term, term, term, term);
      }
      const [countRows] = await pool().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM short_video_daily_entries WHERE ${where.join(" AND ")}`,
        params
      );
      const [rows] = await pool().query<RowDataPacket[]>(
        `SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText
           FROM short_video_daily_entries WHERE ${where.join(" AND ")}
          ORDER BY reportDate DESC,id DESC LIMIT ? OFFSET ?`,
        [...params, input.limit, input.offset]
      );
      return {
        items: rows.map(mapEntry),
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
                producerStaffId,producerName,views,likes,comments,shares,saves,productClicks
           FROM short_video_daily_entries
          WHERE deletedAt IS NULL AND reportDate BETWEEN ? AND ?
          ORDER BY reportDate,producerName,id`,
        [startDate, endDate]
      );
      const entries = rows.map(row => ({
        reportDate: String(row.reportDateText || row.reportDate).slice(0, 10),
        producerStaffId: Number(row.producerStaffId),
        producerName: String(row.producerName),
        views: numberValue(row.views),
        likes: numberValue(row.likes),
        comments: numberValue(row.comments),
        shares: numberValue(row.shares),
        saves: numberValue(row.saves),
        productClicks: numberValue(row.productClicks),
      }));
      const daily = [...new Set(entries.map(row => row.reportDate))]
        .sort((left, right) => right.localeCompare(left))
        .map(reportDate => ({
          reportDate,
          summary: calculateShortVideoEngagementMetrics(
            entries.filter(row => row.reportDate === reportDate)
          ),
        }));
      const producers = [
        ...new Map(
          entries.map(row => [row.producerStaffId, row.producerName])
        ).entries(),
      ]
        .map(([producerStaffId, producerName]) => ({
          producerStaffId,
          producerName,
          summary: calculateShortVideoEngagementMetrics(
            entries.filter(row => row.producerStaffId === producerStaffId)
          ),
        }))
        .sort((left, right) =>
          left.producerName.localeCompare(right.producerName, "ja")
        );
      return {
        month: input.month,
        summary: calculateShortVideoEngagementMetrics(entries),
        daily,
        producers,
        salesSource: "shortVideoAccountDaily" as const,
      };
    }),

  createBatch: protectedProcedure
    .input(
      z.object({
        entries: z.array(shortVideoDailyEntryInputSchema).min(1).max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx, "edit", connection);
        const producers = await loadProducers(
          connection,
          input.entries.map(entry => entry.producerStaffId)
        );
        const accountIds = input.entries.flatMap(entry =>
          entry.accountId ? [entry.accountId] : []
        );
        const accounts = await loadAccounts(connection, accountIds);
        const normalizedUrls = input.entries.map(entry =>
          normalizeShortVideoUrl(entry.videoUrl)
        );
        const hashes = await assertUniqueUrls(connection, normalizedUrls);
        const currentActor = actor(ctx);
        const ids: number[] = [];
        for (let index = 0; index < input.entries.length; index += 1) {
          const entry = input.entries[index];
          const [result] = await connection.query<any>(
            `INSERT INTO short_video_daily_entries
              (reportDate,accountId,accountName,videoUrl,videoUrlHash,producerStaffId,producerName,
               views,likes,comments,shares,saves,productClicks,notes,
               createdById,createdByName,updatedById,updatedByName)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              entry.reportDate,
              entry.accountId ?? null,
              entry.accountId ? accounts.get(entry.accountId) : null,
              normalizedUrls[index],
              hashes[index],
              entry.producerStaffId,
              producers.get(entry.producerStaffId),
              entry.views,
              entry.likes,
              entry.comments,
              entry.shares,
              entry.saves,
              entry.productClicks,
              entry.notes || null,
              currentActor.id,
              currentActor.name,
              currentActor.id,
              currentActor.name,
            ]
          );
          const id = Number(result.insertId);
          ids.push(id);
          const [createdRows] = await connection.query<RowDataPacket[]>(
            "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_daily_entries WHERE id=?",
            [id]
          );
          await insertAudit(
            connection,
            id,
            "create",
            null,
            mapEntry(createdRows[0]),
            currentActor
          );
        }
        await connection.commit();
        return { success: true, ids, count: ids.length };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        entry: shortVideoDailyEntryInputSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx, "edit", connection);
        const [beforeRows] = await connection.query<RowDataPacket[]>(
          "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_daily_entries WHERE id=? AND deletedAt IS NULL FOR UPDATE",
          [input.id]
        );
        if (!beforeRows[0])
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "日报记录不存在 / 日報データがありません",
          });
        const producers = await loadProducers(connection, [
          input.entry.producerStaffId,
        ]);
        const accounts = await loadAccounts(
          connection,
          input.entry.accountId ? [input.entry.accountId] : []
        );
        const normalizedUrl = normalizeShortVideoUrl(input.entry.videoUrl);
        const [hash] = await assertUniqueUrls(
          connection,
          [normalizedUrl],
          input.id
        );
        const currentActor = actor(ctx);
        await connection.query(
          `UPDATE short_video_daily_entries SET
             reportDate=?,accountId=?,accountName=?,videoUrl=?,videoUrlHash=?,producerStaffId=?,producerName=?,
             views=?,likes=?,comments=?,shares=?,saves=?,productClicks=?,notes=?,
             updatedById=?,updatedByName=?
           WHERE id=? AND deletedAt IS NULL`,
          [
            input.entry.reportDate,
            input.entry.accountId ?? null,
            input.entry.accountId ? accounts.get(input.entry.accountId) : null,
            normalizedUrl,
            hash,
            input.entry.producerStaffId,
            producers.get(input.entry.producerStaffId),
            input.entry.views,
            input.entry.likes,
            input.entry.comments,
            input.entry.shares,
            input.entry.saves,
            input.entry.productClicks,
            input.entry.notes || null,
            currentActor.id,
            currentActor.name,
            input.id,
          ]
        );
        const [afterRows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM short_video_daily_entries WHERE id=?",
          [input.id]
        );
        await insertAudit(
          connection,
          input.id,
          "update",
          mapEntry(beforeRows[0]),
          mapEntry(afterRows[0]),
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

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await ensureShortVideoDailySchemaReady();
      const connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx, "edit", connection);
        const [beforeRows] = await connection.query<RowDataPacket[]>(
          "SELECT *,DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDateText FROM short_video_daily_entries WHERE id=? AND deletedAt IS NULL FOR UPDATE",
          [input.id]
        );
        if (!beforeRows[0])
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "日报记录不存在 / 日報データがありません",
          });
        const currentActor = actor(ctx);
        await connection.query(
          "UPDATE short_video_daily_entries SET deletedAt=CURRENT_TIMESTAMP,activeKey=id,deletedById=?,updatedById=?,updatedByName=? WHERE id=? AND deletedAt IS NULL",
          [currentActor.id, currentActor.id, currentActor.name, input.id]
        );
        await insertAudit(
          connection,
          input.id,
          "delete",
          mapEntry(beforeRows[0]),
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

  schemaHealth: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getShortVideoDailyUpgradeHealth();
  }),
});
