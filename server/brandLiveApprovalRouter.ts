import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { requireBrandDataView } from "./brandDataAccess";
import { requireSystemSuperAdmin } from "./userManagementAccess";
import { ensureBrandLiveApprovalReady } from "./brandLiveApprovalUpgrade";
import {
  ASSISTANT_ONSITE_VALUES,
  GUARANTEE_TYPES,
  normalizeApprovalText,
  normalizeApprovalTimestamp,
  normalizeLiverIdentity,
  validateBrandLiveApprovalDocument,
  validateBrandLiveApprovalSubmission,
  type BrandLiveApprovalDocument,
  type BrandLiveApprovalStatus,
} from "../shared/brandLiveApproval";

const productSchema = z.object({
  productId: z.number().int().positive().nullable().optional(),
  productName: z.string().max(255),
  specification: z.string().max(1000).nullable().optional(),
  originalPrice: z.number().int().nonnegative().nullable(),
  discountedPrice: z.number().int().nonnegative().nullable(),
  offerMechanism: z.string().max(3000),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  inventory: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(3000).nullable().optional(),
});

const documentSchema = z.object({
  brandId: z.number().int().positive(),
  targetLiverId: z.number().int().positive(),
  targetLiverName: z.string().max(255),
  liveAccount: z.string().max(255),
  assistantOnsite: z.enum(ASSISTANT_ONSITE_VALUES),
  assistantDetails: z.string().max(2000).nullable().optional(),
  mechanismSummary: z.string().max(5000),
  commissionRate: z.number().min(0).max(100).nullable(),
  slotFeeAmount: z.number().int().nonnegative().nullable(),
  guaranteeType: z.enum(GUARANTEE_TYPES),
  guaranteeValue: z.number().positive().nullable().optional(),
  guaranteeTerms: z.string().max(5000).nullable().optional(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  businessNotes: z.string().max(5000).nullable().optional(),
  products: z.array(productSchema).min(1).max(100),
});

function actor(ctx: any) {
  return {
    id: Number(ctx.user.id),
    name: normalizeApprovalText(ctx.user.name || ctx.user.email || `user:${ctx.user.id}`, 255),
  };
}

function isBusinessDepartment(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("商务") || normalized.includes("商務") || normalized.includes("business") || normalized.includes("営業");
}

async function requireBusinessContributor(ctx: any) {
  const access = await requireBrandDataView(ctx);
  if (!access.isSuperAdmin && !isBusinessDepartment(access.staffDepartment) && !isBusinessDepartment(access.managedDepartment)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "直播条件仅限商务部门或超级管理员录入和提交" });
  }
  return access;
}

function normalizeDocument(input: z.infer<typeof documentSchema>): BrandLiveApprovalDocument {
  return {
    brandId: input.brandId,
    targetLiverId: input.targetLiverId,
    targetLiverName: normalizeApprovalText(input.targetLiverName, 255),
    liveAccount: normalizeApprovalText(input.liveAccount, 255),
    assistantOnsite: input.assistantOnsite,
    assistantDetails: normalizeApprovalText(input.assistantDetails, 2000) || null,
    mechanismSummary: normalizeApprovalText(input.mechanismSummary, 5000),
    commissionRate: input.commissionRate == null ? null : Number(input.commissionRate),
    slotFeeAmount: input.slotFeeAmount == null ? null : Number(input.slotFeeAmount),
    guaranteeType: input.guaranteeType,
    guaranteeValue: input.guaranteeType === "none" ? null : Number(input.guaranteeValue),
    guaranteeTerms: input.guaranteeType === "none" ? null : normalizeApprovalText(input.guaranteeTerms, 5000) || null,
    scheduledStart: normalizeApprovalTimestamp(input.scheduledStart),
    scheduledEnd: normalizeApprovalTimestamp(input.scheduledEnd),
    businessNotes: normalizeApprovalText(input.businessNotes, 5000) || null,
    products: input.products.map(product => ({
      productId: product.productId || null,
      productName: normalizeApprovalText(product.productName, 255),
      specification: normalizeApprovalText(product.specification, 1000) || null,
      originalPrice: product.originalPrice == null ? null : Number(product.originalPrice),
      discountedPrice: product.discountedPrice == null ? null : Number(product.discountedPrice),
      offerMechanism: normalizeApprovalText(product.offerMechanism, 3000),
      commissionRate: product.commissionRate == null ? null : Number(product.commissionRate),
      inventory: product.inventory == null ? null : Number(product.inventory),
      notes: normalizeApprovalText(product.notes, 3000) || null,
    })),
  };
}

function validateDocument(document: BrandLiveApprovalDocument): void {
  const errors = validateBrandLiveApprovalDocument(document);
  if (errors.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: errors[0] });
}

function validateSubmission(document: BrandLiveApprovalDocument): void {
  const errors = validateBrandLiveApprovalSubmission(document);
  if (errors.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: errors[0] });
}

let approvalPool: Pool | null = null;

async function getConnection(): Promise<PoolConnection> {
  await ensureBrandLiveApprovalReady();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  if (!approvalPool) approvalPool = mysql.createPool({ uri: databaseUrl, timezone: "Z", connectionLimit: 5 });
  return approvalPool.getConnection();
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function mapApproval(row: RowDataPacket, products: RowDataPacket[], events: RowDataPacket[], links: RowDataPacket[]): any {
  return {
    ...row,
    id: Number(row.id),
    brandId: Number(row.brandId),
    targetLiverId: row.targetLiverId == null ? null : Number(row.targetLiverId),
    commissionRate: row.commissionRate == null ? null : Number(row.commissionRate),
    slotFeeAmount: row.slotFeeAmount == null ? null : Number(row.slotFeeAmount),
    guaranteeValue: row.guaranteeValue == null ? null : Number(row.guaranteeValue),
    revision: Number(row.revision),
    scheduledStart: toIso(row.scheduledStart),
    scheduledEnd: toIso(row.scheduledEnd),
    submittedAt: toIso(row.submittedAt),
    reviewedAt: toIso(row.reviewedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    products: products.map(product => ({
      ...product,
      id: Number(product.id),
      approvalId: Number(product.approvalId),
      productId: product.productId == null ? null : Number(product.productId),
      originalPrice: product.originalPrice == null ? null : Number(product.originalPrice),
      discountedPrice: product.discountedPrice == null ? null : Number(product.discountedPrice),
      commissionRate: product.commissionRate == null ? null : Number(product.commissionRate),
      inventory: product.inventory == null ? null : Number(product.inventory),
    })),
    events: events.map(event => ({
      ...event,
      id: Number(event.id),
      approvalId: Number(event.approvalId),
      actorUserId: Number(event.actorUserId),
      snapshotJson: typeof event.snapshotJson === "string" ? JSON.parse(event.snapshotJson) : event.snapshotJson,
      createdAt: toIso(event.createdAt),
    })),
    scheduleLink: links[0] ? {
      scheduleId: Number(links[0].scheduleId),
      linkedByName: links[0].linkedByName || null,
      linkedAt: toIso(links[0].linkedAt),
    } : null,
  };
}

async function readSetting(connection: PoolConnection, forUpdate = false) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT approverUserId,approverName,configuredBy,configuredAt,updatedAt FROM brand_live_approval_settings WHERE id=1 LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
  );
  const row = rows[0];
  return row ? {
    approverUserId: Number(row.approverUserId),
    approverName: String(row.approverName),
    configuredBy: Number(row.configuredBy),
    configuredAt: toIso(row.configuredAt),
    updatedAt: toIso(row.updatedAt),
  } : null;
}

async function loadApproval(connection: PoolConnection, id: number, forUpdate = false) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM brand_live_approvals WHERE id=? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "直播条件单不存在" });
  const [products] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM brand_live_approval_products WHERE approvalId=? ORDER BY sortOrder ASC,id ASC",
    [id],
  );
  const [events] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM brand_live_approval_events WHERE approvalId=? ORDER BY createdAt DESC,id DESC",
    [id],
  );
  const [links] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM brand_live_approval_schedule_links WHERE approvalId=? AND isActive=1 LIMIT 1",
    [id],
  );
  return mapApproval(row, products, events, links);
}

async function insertProducts(connection: PoolConnection, approvalId: number, document: BrandLiveApprovalDocument) {
  for (let index = 0; index < document.products.length; index += 1) {
    const product = document.products[index];
    await connection.query(
      `INSERT INTO brand_live_approval_products
       (approvalId,productId,productName,specification,originalPrice,discountedPrice,offerMechanism,commissionRate,inventory,notes,sortOrder)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [approvalId, product.productId, product.productName, product.specification, product.originalPrice, product.discountedPrice, product.offerMechanism, product.commissionRate, product.inventory, product.notes, index],
    );
  }
}

async function assertProductsBelongToBrand(connection: PoolConnection, document: BrandLiveApprovalDocument): Promise<void> {
  const productIds = [...new Set(
    document.products
      .map(product => product.productId)
      .filter((id): id is number => Number.isInteger(id) && Number(id) > 0),
  )];
  if (productIds.length === 0) return;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM brand_products WHERE brandId=? AND id IN (${productIds.map(() => "?").join(",")})`,
    [document.brandId, ...productIds],
  );
  const validIds = new Set(rows.map(row => Number(row.id)));
  if (productIds.some(id => !validIds.has(id))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "所选商品不属于当前品牌，请重新选择或使用手动输入" });
  }
}

async function assertCanonicalLiver(connection: PoolConnection, document: BrandLiveApprovalDocument): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT id,name,tiktokAccount FROM livers WHERE id=? AND isActive=1 LIMIT 1",
    [document.targetLiverId],
  );
  const liver = rows[0];
  if (!liver) throw new TRPCError({ code: "BAD_REQUEST", message: "所选主播不存在或已停用" });
  if (normalizeLiverIdentity(liver.name) !== normalizeLiverIdentity(document.targetLiverName)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "主播ID与主播姓名不一致，请重新选择" });
  }
  const canonicalAccount = normalizeLiverIdentity(liver.tiktokAccount);
  if (!canonicalAccount) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "所选主播尚未登记TikTok账号，请先完善主播资料" });
  }
  if (canonicalAccount !== normalizeLiverIdentity(document.liveAccount)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "直播账号与主播资料不一致，请先更新主播资料或使用正确账号" });
  }
}

async function insertEvent(
  connection: PoolConnection,
  approval: any,
  eventType: string,
  fromStatus: BrandLiveApprovalStatus | null,
  toStatus: BrandLiveApprovalStatus | null,
  user: { id: number; name: string },
  comment?: string | null,
) {
  const { events: _events, scheduleLink: _scheduleLink, ...snapshot } = approval;
  await connection.query(
    `INSERT INTO brand_live_approval_events
     (approvalId,brandId,eventType,fromStatus,toStatus,snapshotJson,actorUserId,actorName,comment)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [approval.id, approval.brandId, eventType, fromStatus, toStatus, JSON.stringify(snapshot), user.id, user.name, normalizeApprovalText(comment, 5000) || null],
  );
}

async function assertBrandExists(connection: PoolConnection, brandId: number) {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM brands WHERE id=? AND deletedAt IS NULL LIMIT 1", [brandId]);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
}

export const brandLiveApprovalRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => {
    await requireBrandDataView(ctx);
    const connection = await getConnection();
    try {
      const setting = await readSetting(connection);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const access = await requireBrandDataView(ctx);
      return {
        setting,
        isApprover: setting?.approverUserId === Number(ctx.user.id),
        isSuperAdmin: access.isSuperAdmin,
        canContribute: access.isSuperAdmin || isBusinessDepartment(access.staffDepartment) || isBusinessDepartment(access.managedDepartment),
      };
    } finally {
      connection.release();
    }
  }),

  listByBrand: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBrandDataView(ctx);
      const connection = await getConnection();
      try {
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM brand_live_approvals WHERE brandId=? ORDER BY scheduledStart DESC,id DESC",
          [input.brandId],
        );
        const result = [];
        for (const row of rows) result.push(await loadApproval(connection, Number(row.id)));
        return result;
      } finally {
        connection.release();
      }
    }),

  setCurrentUserAsApprover: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await requireSystemSuperAdmin(db, Number(ctx.user.id));
    const connection = await getConnection();
    const user = actor(ctx);
    await connection.beginTransaction();
    try {
      const previous = await readSetting(connection, true);
      await connection.query(
        `INSERT INTO brand_live_approval_settings (id,approverUserId,approverName,configuredBy)
         VALUES (1,?,?,?)
         ON DUPLICATE KEY UPDATE approverUserId=VALUES(approverUserId),approverName=VALUES(approverName),configuredBy=VALUES(configuredBy),configuredAt=CURRENT_TIMESTAMP(3)`,
        [user.id, user.name, user.id],
      );
      await connection.query(
        `INSERT INTO brand_live_approval_setting_events
         (previousApproverUserId,previousApproverName,approverUserId,approverName,actorUserId,actorName)
         VALUES (?,?,?,?,?,?)`,
        [previous?.approverUserId || null, previous?.approverName || null, user.id, user.name, user.id, user.name],
      );
      await connection.commit();
      return { success: true, approverUserId: user.id, approverName: user.name };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),

  create: protectedProcedure
    .input(documentSchema)
    .mutation(async ({ ctx, input }) => {
      await requireBusinessContributor(ctx);
      const document = normalizeDocument(input);
      validateDocument(document);
      const user = actor(ctx);
      const connection = await getConnection();
      await connection.beginTransaction();
      try {
        await assertBrandExists(connection, document.brandId);
        await assertProductsBelongToBrand(connection, document);
        await assertCanonicalLiver(connection, document);
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO brand_live_approvals
           (brandId,targetLiverId,targetLiverName,liveAccount,assistantOnsite,assistantDetails,mechanismSummary,commissionRate,slotFeeAmount,guaranteeType,guaranteeValue,guaranteeTerms,scheduledStart,scheduledEnd,businessNotes,status,revision,createdBy,createdByName,updatedBy,updatedByName)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`,
          [document.brandId, document.targetLiverId, document.targetLiverName, document.liveAccount, document.assistantOnsite, document.assistantDetails, document.mechanismSummary, document.commissionRate, document.slotFeeAmount, document.guaranteeType, document.guaranteeValue, document.guaranteeTerms, new Date(document.scheduledStart), new Date(document.scheduledEnd), document.businessNotes, "draft", user.id, user.name, user.id, user.name],
        );
        const id = Number(result.insertId);
        await insertProducts(connection, id, document);
        const approval = await loadApproval(connection, id);
        await insertEvent(connection, approval, "created", null, "draft", user);
        const response = await loadApproval(connection, id);
        await connection.commit();
        return response;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), expectedRevision: z.number().int().positive(), document: documentSchema }))
    .mutation(async ({ ctx, input }) => {
      await requireBusinessContributor(ctx);
      const document = normalizeDocument(input.document);
      validateDocument(document);
      const user = actor(ctx);
      const connection = await getConnection();
      await connection.beginTransaction();
      try {
        const current = await loadApproval(connection, input.id, true);
        if (!["draft", "changes_requested"].includes(String(current.status))) throw new TRPCError({ code: "CONFLICT", message: "待确认・承認済みの条件は編集できません" });
        if (Number(current.revision) !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "条件が更新されています。再読み込みしてください" });
        if (Number(current.brandId) !== document.brandId) throw new TRPCError({ code: "BAD_REQUEST", message: "ブランドは変更できません" });
        await assertProductsBelongToBrand(connection, document);
        await assertCanonicalLiver(connection, document);
        await connection.query(
          `UPDATE brand_live_approvals SET
           targetLiverId=?,targetLiverName=?,liveAccount=?,assistantOnsite=?,assistantDetails=?,mechanismSummary=?,commissionRate=?,slotFeeAmount=?,guaranteeType=?,guaranteeValue=?,guaranteeTerms=?,scheduledStart=?,scheduledEnd=?,businessNotes=?,revision=revision+1,updatedBy=?,updatedByName=?
           WHERE id=? AND revision=?`,
          [document.targetLiverId, document.targetLiverName, document.liveAccount, document.assistantOnsite, document.assistantDetails, document.mechanismSummary, document.commissionRate, document.slotFeeAmount, document.guaranteeType, document.guaranteeValue, document.guaranteeTerms, new Date(document.scheduledStart), new Date(document.scheduledEnd), document.businessNotes, user.id, user.name, input.id, input.expectedRevision],
        );
        await connection.query("DELETE FROM brand_live_approval_products WHERE approvalId=?", [input.id]);
        await insertProducts(connection, input.id, document);
        const approval = await loadApproval(connection, input.id);
        await insertEvent(connection, approval, "updated", current.status, current.status, user);
        const response = await loadApproval(connection, input.id);
        await connection.commit();
        return response;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), expectedRevision: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBusinessContributor(ctx);
      const user = actor(ctx);
      const connection = await getConnection();
      await connection.beginTransaction();
      try {
        const setting = await readSetting(connection);
        if (!setting) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "先にKG承認者を設定してください" });
        const current = await loadApproval(connection, input.id, true);
        if (!["draft", "changes_requested"].includes(String(current.status))) throw new TRPCError({ code: "CONFLICT", message: "この条件は提出できません" });
        if (Number(current.revision) !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "条件が更新されています。再読み込みしてください" });
        validateSubmission({ ...current, scheduledStart: current.scheduledStart!, scheduledEnd: current.scheduledEnd! } as BrandLiveApprovalDocument);
        await connection.query(
          `UPDATE brand_live_approvals SET status='pending_approval',revision=revision+1,submittedBy=?,submittedByName=?,submittedAt=CURRENT_TIMESTAMP(3),reviewedBy=NULL,reviewedByName=NULL,reviewedAt=NULL,reviewComment=NULL,updatedBy=?,updatedByName=? WHERE id=? AND revision=?`,
          [user.id, user.name, user.id, user.name, input.id, input.expectedRevision],
        );
        const approval = await loadApproval(connection, input.id);
        await insertEvent(connection, approval, "submitted", current.status, "pending_approval", user);
        await connection.commit();
        return approval;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  review: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), expectedRevision: z.number().int().positive(), decision: z.enum(["approve", "request_changes"]), comment: z.string().max(5000).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireBrandDataView(ctx);
      const user = actor(ctx);
      const connection = await getConnection();
      await connection.beginTransaction();
      try {
        const setting = await readSetting(connection, true);
        if (!setting || setting.approverUserId !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "KG承認者本人のみ確認できます" });
        const current = await loadApproval(connection, input.id, true);
        if (String(current.status) !== "pending_approval") throw new TRPCError({ code: "CONFLICT", message: "この条件は確認待ちではありません" });
        if (Number(current.revision) !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "条件が更新されています。再読み込みしてください" });
        validateSubmission({ ...current, scheduledStart: current.scheduledStart!, scheduledEnd: current.scheduledEnd! } as BrandLiveApprovalDocument);
        const comment = normalizeApprovalText(input.comment, 5000);
        if (input.decision === "request_changes" && !comment) throw new TRPCError({ code: "BAD_REQUEST", message: "再交渉の理由を入力してください" });
        const nextStatus: BrandLiveApprovalStatus = input.decision === "approve" ? "approved" : "changes_requested";
        await connection.query(
          `UPDATE brand_live_approvals SET status=?,revision=revision+1,reviewedBy=?,reviewedByName=?,reviewedAt=CURRENT_TIMESTAMP(3),reviewComment=?,updatedBy=?,updatedByName=? WHERE id=? AND revision=?`,
          [nextStatus, user.id, user.name, comment || null, user.id, user.name, input.id, input.expectedRevision],
        );
        const approval = await loadApproval(connection, input.id);
        await insertEvent(connection, approval, input.decision === "approve" ? "approved" : "changes_requested", "pending_approval", nextStatus, user, comment);
        await connection.commit();
        return approval;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), expectedRevision: z.number().int().positive(), reason: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      await requireBusinessContributor(ctx);
      const user = actor(ctx);
      const connection = await getConnection();
      await connection.beginTransaction();
      try {
        const current = await loadApproval(connection, input.id, true);
        if (["scheduled", "cancelled"].includes(String(current.status))) throw new TRPCError({ code: "CONFLICT", message: "已排班或已取消的条件不能在这里取消" });
        if (Number(current.revision) !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "条件已更新，请重新加载" });
        await connection.query(
          "UPDATE brand_live_approvals SET status='cancelled',revision=revision+1,updatedBy=?,updatedByName=? WHERE id=? AND revision=?",
          [user.id, user.name, input.id, input.expectedRevision],
        );
        const approval = await loadApproval(connection, input.id);
        await insertEvent(connection, approval, "cancelled", current.status, "cancelled", user, input.reason);
        await connection.commit();
        return approval;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
});
