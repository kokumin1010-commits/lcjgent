import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  LIVESTREAM_DEBRIEF_PAGE_KEY,
  buildLivestreamDebriefText,
  normalizeLivestreamDebriefContent,
  type LivestreamDebriefBrand,
  type LivestreamDebriefContent,
  type LivestreamDebriefDocument,
  type LivestreamDebriefMetrics,
} from "../shared/livestreamDebrief";
import {
  normalizeBrandMetricNumber,
  resolveBrandLivestreamGmv,
  resolveLivestreamProductGmv,
} from "../shared/brandMetrics";

let runtimePool: Pool | undefined;

function pool() {
  if (!runtimePool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    runtimePool = mysql.createPool({ uri, timezone: "Z", connectionLimit: 4, waitForConnections: true, queueLimit: 40 });
  }
  return runtimePool;
}

export type LivestreamDebriefAccess = { canView: boolean; canEdit: boolean };

export async function resolveLivestreamDebriefAccess(
  user: { id: number; role?: string | null },
  connection: Pool | PoolConnection = pool(),
): Promise<LivestreamDebriefAccess> {
  if (user.role === "admin") return { canView: true, canEdit: true };
  const [assignmentRows] = await connection.query<RowDataPacket[]>(
    "SELECT roleId FROM user_role_assignments WHERE userId=? LIMIT 1",
    [Number(user.id)],
  );
  const roleId = Number(assignmentRows[0]?.roleId || 0);
  if (!roleId) return { canView: false, canEdit: false };
  const [permissionRows] = await connection.query<RowDataPacket[]>(
    "SELECT canView,canEdit FROM role_permissions WHERE roleId=? AND pageKey=? LIMIT 1",
    [roleId, LIVESTREAM_DEBRIEF_PAGE_KEY],
  );
  const permission = permissionRows[0];
  return {
    canView: Boolean(permission?.canView || permission?.canEdit),
    canEdit: Boolean(permission?.canEdit),
  };
}

async function requireAccess(
  user: { id: number; role?: string | null },
  mode: "view" | "edit",
  connection: Pool | PoolConnection = pool(),
) {
  const access = await resolveLivestreamDebriefAccess(user, connection);
  if (mode === "edit" ? !access.canEdit : !access.canView) {
    throw new TRPCError({ code: "FORBIDDEN", message: "没有中控复盘权限 / 中控振り返り権限がありません" });
  }
  return access;
}

const shortText = z.string().trim().max(300);
const shortList = z.array(shortText).max(3);
const brandInput = z.object({
  brandId: z.number().int().positive().nullable(),
  brandName: z.string().trim().max(255),
  salesAmount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  orderCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  mainProducts: z.string().trim().max(500),
  performance: z.string().trim().max(500),
});

export const livestreamDebriefContentSchema = z.object({
  version: z.literal(1),
  brands: z.array(brandInput).max(20),
  goodPoints: shortList,
  problems: shortList,
  salesDrivers: shortList,
  salesBarriers: shortList,
  reusableLessons: shortList,
  nextActions: shortList,
  assistance: z.object({
    issue: z.string().trim().max(500),
    owner: z.string().trim().max(120),
    dueDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  }),
}).superRefine((value, ctx) => {
  const meaningful = (items: string[]) => items.some(item => item.trim().length > 0);
  if (!meaningful(value.goodPoints) && !meaningful(value.problems)) {
    ctx.addIssue({ code: "custom", path: ["goodPoints"], message: "请至少填写一个做得好的地方或现场问题" });
  }
  if (!meaningful(value.nextActions)) {
    ctx.addIssue({ code: "custom", path: ["nextActions"], message: "请至少填写一项下一场具体改善方案" });
  }
  if (value.assistance.issue.trim() && (!value.assistance.owner.trim() || !value.assistance.dueDate)) {
    ctx.addIssue({ code: "custom", path: ["assistance"], message: "需要协助时请填写负责人和完成时间" });
  }
});

function actorName(user: { id: number; name?: string | null; email?: string | null }) {
  return String(user.name || user.email || `user:${user.id}`).trim().slice(0, 255);
}

function asIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseDocument(value: unknown): LivestreamDebriefDocument | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;
    const document = parsed as LivestreamDebriefDocument;
    if (document.version !== 1 || !document.content || !document.metrics) return null;
    return document;
  } catch {
    return null;
  }
}

function placeholders(values: number[]) {
  return values.map(() => "?").join(",");
}

type ProductMetricRow = RowDataPacket & {
  livestreamId: number;
  productName: string;
  revenue: number;
  orders: number;
};

function normalizedSearch(value: string | undefined) {
  return (value || "").trim().replace(/[!%_]/g, match => `!${match}`).slice(0, 100);
}

async function getBrandRows(connection: Pool | PoolConnection, livestreamIds: number[]) {
  if (!livestreamIds.length) return [];
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT lb.livestreamId,lb.brandId,lb.gmv,COALESCE(NULLIF(b.nameJa,''),b.name,CONCAT('Brand #',lb.brandId)) AS brandName
       FROM livestream_brands lb
       LEFT JOIN brands b ON b.id=lb.brandId
      WHERE lb.livestreamId IN (${placeholders(livestreamIds)})
      ORDER BY lb.livestreamId,lb.id`,
    livestreamIds,
  );
  return rows;
}

async function getProductRows(connection: Pool | PoolConnection, livestreamIds: number[]): Promise<ProductMetricRow[]> {
  if (!livestreamIds.length) return [];
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT livestreamId,productName,directGmv,gmv,grossRevenue,COALESCE(orders,0) AS orders
       FROM livestream_products
      WHERE livestreamId IN (${placeholders(livestreamIds)})
      ORDER BY livestreamId,id ASC`,
    livestreamIds,
  );
  return rows.map(row => ({
    ...row,
    revenue: resolveLivestreamProductGmv({ directGmv: row.directGmv, gmv: row.gmv, grossRevenue: row.grossRevenue }),
  }) as ProductMetricRow).sort((left, right) => Number(left.livestreamId) - Number(right.livestreamId) || Number(right.revenue) - Number(left.revenue));
}

function streamGmv(base: RowDataPacket, productRows: RowDataPacket[]) {
  return resolveBrandLivestreamGmv({
    manualSalesAmount: base.manualSalesAmount,
    salesAmount: base.salesAmount,
    gmv: base.gmv,
    productGmvTotal: productRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
  });
}

export function hasLivestreamAllocationIssue(rows: unknown[], resolvedTotal: number) {
  const values = rows.map(row => normalizeBrandMetricNumber((row as { gmv?: unknown } | null)?.gmv));
  const allocatedTotal = values.reduce<number>((sum, value) => sum + (value || 0), 0);
  const incomplete = rows.length > 1 && resolvedTotal > 0 && (allocatedTotal <= 0 || values.some(value => value === null));
  const conflict = rows.length > 0 && allocatedTotal > 0 && resolvedTotal > 0 && allocatedTotal !== resolvedTotal;
  return incomplete || conflict;
}

function brandDefaults(base: RowDataPacket, associatedRows: RowDataPacket[], productRows: RowDataPacket[], resolvedStreamGmv = streamGmv(base, productRows)): LivestreamDebriefBrand[] {
  const topProducts = productRows.slice(0, 5).map(row => String(row.productName || "").trim()).filter(Boolean).join("、");
  const rows = associatedRows.length ? associatedRows : [{ brandId: base.brandId, brandName: base.primaryBrandName, gmv: null } as RowDataPacket];
  return rows.map((row, index) => ({
    brandId: Number(row.brandId || 0) || null,
    brandName: String(row.brandName || "未设置品牌"),
    salesAmount: rows.length === 1
      ? associatedRows.length
        ? resolveBrandLivestreamGmv({
          allocatedBrandGmv: row.gmv,
          manualSalesAmount: base.manualSalesAmount,
          salesAmount: base.salesAmount,
          gmv: base.gmv,
          productGmvTotal: productRows.reduce((sum, product) => sum + Number(product.revenue || 0), 0),
        }).value
        : resolvedStreamGmv.value
      : normalizeBrandMetricNumber(row.gmv),
    orderCount: rows.length === 1 && base.orderCount != null ? Number(base.orderCount) : null,
    mainProducts: index === 0 ? topProducts : "",
    performance: "",
  }));
}

export function sourceRecorder(base: Record<string, unknown>) {
  const realtime = String(base.realtimeRecorders || "").split(",").map(value => value.trim()).filter(Boolean);
  const creator = String(base.sourceRecorderName || "System");
  const csv = String(base.csvImported || "") === "yes" || String(base.productCsvImported || "") === "yes";
  if (csv && realtime.length) {
    return { type: "csv_realtime" as const, name: `创建：${creator}；数据来源：CSV；实时记录：${realtime.join("、")}` };
  }
  if (csv) return { type: "csv" as const, name: `创建：${creator}；数据来源：CSV` };
  if (realtime.length) return { type: "realtime" as const, name: `创建：${creator}；实时记录：${realtime.join("、")}` };
  return { type: "manual" as const, name: creator };
}

function mapListRow(base: RowDataPacket, brands: LivestreamDebriefBrand[], products: RowDataPacket[]) {
  const document = parseDocument(base.reviewJson);
  const resolvedGmv = streamGmv(base, products);
  const allocationIssue = hasLivestreamAllocationIssue(brands.map(brand => ({ gmv: brand.salesAmount })), resolvedGmv.value);
  return {
    id: Number(base.id),
    livestreamDate: asIso(base.livestreamDate),
    livestreamEndTime: asIso(base.livestreamEndTime),
    streamerName: String(base.streamerName || ""),
    durationMinutes: base.duration == null ? null : Number(base.duration),
    salesAmount: resolvedGmv.value,
    salesMetricSource: resolvedGmv.source,
    salesMetricConflict: resolvedGmv.hasConflict || allocationIssue,
    salesMetricConflictSources: resolvedGmv.conflictSources,
    orderCount: base.orderCount == null ? null : Number(base.orderCount),
    brands,
    topProducts: products.slice(0, 5).map(row => ({
      productName: String(row.productName || ""),
      revenue: Number(row.revenue || 0),
      orders: Number(row.orders || 0),
    })),
    sourceRecorder: sourceRecorder(base),
    debrief: base.debriefId == null ? null : {
      id: Number(base.debriefId),
      revision: Number(base.revision),
      content: document?.content || null,
      reviewText: String(base.reviewText || ""),
      createdByName: String(base.createdByName || ""),
      updatedByName: String(base.updatedByName || ""),
      createdAt: asIso(base.debriefCreatedAt),
      updatedAt: asIso(base.debriefUpdatedAt),
    },
  };
}

async function loadRows(connection: Pool | PoolConnection, input: { from?: string; to?: string; search?: string; status: "all" | "pending" | "completed"; limit: number; livestreamId?: number }) {
  const conditions = ["bl.deletedAt IS NULL"];
  const params: Array<string | number> = [];
  if (input.livestreamId) {
    conditions.push("bl.id=?");
    params.push(input.livestreamId);
  } else {
    conditions.push("DATE(DATE_ADD(bl.livestreamDate, INTERVAL 9 HOUR))>=?");
    conditions.push("DATE(DATE_ADD(bl.livestreamDate, INTERVAL 9 HOUR))<=?");
    params.push(input.from || "1970-01-01", input.to || "2999-12-31");
    const search = normalizedSearch(input.search);
    if (search) {
      conditions.push("(bl.streamerName LIKE ? ESCAPE '!' OR CAST(bl.id AS CHAR)=?)");
      params.push(`%${search}%`, search);
    }
    if (input.status === "pending") conditions.push("d.id IS NULL");
    if (input.status === "completed") conditions.push("d.id IS NOT NULL");
  }
  params.push(input.limit);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT bl.id,bl.brandId,bl.livestreamDate,bl.livestreamEndTime,bl.streamerName,bl.duration,bl.orderCount,
            bl.manualSalesAmount,bl.salesAmount,bl.gmv,
            bl.csvImported,bl.productCsvImported,COALESCE(NULLIF(b.nameJa,''),b.name,CONCAT('Brand #',bl.brandId)) AS primaryBrandName,
            COALESCE(NULLIF(u.name,''),u.email,IF(bl.createdBy=0,'System',CONCAT('ID:',bl.createdBy))) AS sourceRecorderName,
            (SELECT GROUP_CONCAT(DISTINCT rr.recordedBy ORDER BY rr.recordedBy SEPARATOR ',') FROM livestream_realtime_records rr WHERE rr.livestreamId=bl.id) AS realtimeRecorders,
            d.id AS debriefId,d.review_json AS reviewJson,d.review_text AS reviewText,d.revision,
            d.created_by_name AS createdByName,d.updated_by_name AS updatedByName,d.created_at AS debriefCreatedAt,d.updated_at AS debriefUpdatedAt
       FROM brand_livestreams bl
       LEFT JOIN brands b ON b.id=bl.brandId
       LEFT JOIN users u ON u.id=bl.createdBy
       LEFT JOIN livestream_debriefs d ON d.livestream_id=bl.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY bl.livestreamDate DESC,bl.id DESC
      LIMIT ?`,
    params,
  );
  const ids = rows.map(row => Number(row.id));
  const [brandRows, productRows] = await Promise.all([
    getBrandRows(connection, ids),
    getProductRows(connection, ids),
  ]);
  return rows.map(row => {
    const id = Number(row.id);
    const rowBrands = brandRows.filter(brand => Number(brand.livestreamId) === id);
    const rowProducts = productRows.filter(product => Number(product.livestreamId) === id);
    return mapListRow(row, brandDefaults(row, rowBrands, rowProducts), rowProducts);
  });
}

async function loadOne(connection: Pool | PoolConnection, livestreamId: number) {
  const rows = await loadRows(connection, { livestreamId, status: "all", limit: 1 });
  const row = rows.find(item => item.id === livestreamId);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "直播场次不存在" });
  const [events] = await connection.query<RowDataPacket[]>(
    `SELECT revision,recorded_by_name AS recordedByName,recorded_at AS recordedAt
       FROM livestream_debrief_events WHERE livestream_id=? ORDER BY revision DESC LIMIT 20`,
    [livestreamId],
  );
  return { ...row, events: events.map(event => ({ revision: Number(event.revision), recordedByName: String(event.recordedByName), recordedAt: asIso(event.recordedAt) })) };
}

async function loadSummary(connection: Pool | PoolConnection, from: string, to: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN d.id IS NULL THEN 1 ELSE 0 END),0) AS pending,
            COALESCE(SUM(CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END),0) AS completed
       FROM brand_livestreams bl
       LEFT JOIN livestream_debriefs d ON d.livestream_id=bl.id
      WHERE bl.deletedAt IS NULL
        AND DATE(DATE_ADD(bl.livestreamDate, INTERVAL 9 HOUR))>=?
        AND DATE(DATE_ADD(bl.livestreamDate, INTERVAL 9 HOUR))<=?`,
    [from, to],
  );
  return {
    total: Number(rows[0]?.total || 0),
    pending: Number(rows[0]?.pending || 0),
    completed: Number(rows[0]?.completed || 0),
  };
}

export const livestreamDebriefRouter = router({
  summary: protectedProcedure
    .input(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ ctx, input }) => {
      await requireAccess(ctx.user, "view");
      return loadSummary(pool(), input.from, input.to);
    }),

  list: protectedProcedure
    .input(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      search: z.string().max(100).optional(),
      status: z.enum(["all", "pending", "completed"]).default("all"),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const access = await requireAccess(ctx.user, "view");
      const rows = await loadRows(pool(), input);
      return { access, rows };
    }),

  get: protectedProcedure
    .input(z.object({ livestreamId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const access = await requireAccess(ctx.user, "view");
      return { access, row: await loadOne(pool(), input.livestreamId) };
    }),

  save: protectedProcedure
    .input(z.object({
      livestreamId: z.number().int().positive(),
      expectedRevision: z.number().int().positive().nullable(),
      content: livestreamDebriefContentSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const database = pool();
      const connection = await database.getConnection();
      try {
        await connection.beginTransaction();
        await requireAccess(ctx.user, "edit", connection);
        const [streamRows] = await connection.query<RowDataPacket[]>(
          `SELECT id,brandId,livestreamDate,livestreamEndTime,streamerName,duration,orderCount,
                  manualSalesAmount,salesAmount,gmv
             FROM brand_livestreams WHERE id=? AND deletedAt IS NULL FOR UPDATE`,
          [input.livestreamId],
        );
        const stream = streamRows[0];
        if (!stream) throw new TRPCError({ code: "NOT_FOUND", message: "直播场次不存在" });
        const [existingRows] = await connection.query<RowDataPacket[]>(
          "SELECT id,revision FROM livestream_debriefs WHERE livestream_id=? FOR UPDATE",
          [input.livestreamId],
        );
        const existing = existingRows[0];
        const currentRevision = existing ? Number(existing.revision) : null;
        if (currentRevision !== input.expectedRevision) {
          throw new TRPCError({ code: "CONFLICT", message: "复盘已被其他同事更新，请刷新后重试" });
        }

        await connection.query("SELECT id FROM livestream_brands WHERE livestreamId=? ORDER BY id FOR UPDATE", [input.livestreamId]);
        await connection.query("SELECT id FROM livestream_products WHERE livestreamId=? ORDER BY id FOR UPDATE", [input.livestreamId]);
        const associatedRows = await getBrandRows(connection, [input.livestreamId]);
        const productRows = await getProductRows(connection, [input.livestreamId]);
        const resolvedGmv = streamGmv(stream, productRows);
        if (resolvedGmv.hasConflict || hasLivestreamAllocationIssue(associatedRows, resolvedGmv.value)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "直播销售数据存在冲突，请先在直播记录中确认GMV后再保存复盘" });
        }
        const defaults = brandDefaults(stream, associatedRows, productRows, resolvedGmv);
        const allowedBrands = new Map(defaults.map(brand => [brand.brandId, brand]));
        const incomingById = new Map(input.content.brands.map(brand => [brand.brandId, brand]));
        for (const brand of input.content.brands) {
          if (!allowedBrands.has(brand.brandId)) throw new TRPCError({ code: "BAD_REQUEST", message: "品牌不属于该直播场次" });
        }
        const brands = defaults.map(defaultBrand => {
          const incoming = incomingById.get(defaultBrand.brandId);
          return {
            ...defaultBrand,
            mainProducts: incoming?.mainProducts || defaultBrand.mainProducts,
            performance: incoming?.performance || "",
          };
        });
        const content = normalizeLivestreamDebriefContent({ ...input.content, brands } as LivestreamDebriefContent);
        const metrics: LivestreamDebriefMetrics = {
          livestreamId: Number(stream.id),
          livestreamDate: asIso(stream.livestreamDate) || "",
          livestreamEndTime: asIso(stream.livestreamEndTime),
          streamerName: String(stream.streamerName || ""),
          durationMinutes: stream.duration == null ? null : Number(stream.duration),
          salesAmount: resolvedGmv.value,
          orderCount: stream.orderCount == null ? null : Number(stream.orderCount),
        };
        const now = new Date();
        const name = actorName(ctx.user);
        const nextRevision = (currentRevision || 0) + 1;
        const document: LivestreamDebriefDocument = { version: 1, metrics, content };
        const reviewText = buildLivestreamDebriefText({ metrics, content, recordedByName: name, recordedAt: now.toISOString() });
        let debriefId: number;
        if (existing) {
          const [result] = await connection.query<ResultSetHeader>(
            `UPDATE livestream_debriefs
                SET review_json=?,review_text=?,revision=?,updated_by=?,updated_by_name=?,updated_at=?
              WHERE id=? AND revision=?`,
            [JSON.stringify(document), reviewText, nextRevision, Number(ctx.user.id), name, now, Number(existing.id), currentRevision],
          );
          if (result.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "复盘已被其他同事更新，请刷新后重试" });
          debriefId = Number(existing.id);
        } else {
          const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO livestream_debriefs
              (livestream_id,review_json,review_text,revision,created_by,created_by_name,updated_by,updated_by_name,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [input.livestreamId, JSON.stringify(document), reviewText, nextRevision, Number(ctx.user.id), name, Number(ctx.user.id), name, now, now],
          );
          debriefId = Number(result.insertId);
        }
        await connection.query(
          `INSERT INTO livestream_debrief_events
            (debrief_id,livestream_id,revision,review_json,review_text,recorded_by,recorded_by_name,recorded_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [debriefId, input.livestreamId, nextRevision, JSON.stringify(document), reviewText, Number(ctx.user.id), name, now],
        );
        const saved = await loadOne(connection, input.livestreamId);
        await connection.commit();
        return saved;
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }),
});
