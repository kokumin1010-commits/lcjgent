import { TRPCError } from "@trpc/server";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { storageGet } from "./storage";
import {
  analyzeInfluencerBdEvidence,
  INFLUENCER_BD_AI_MODEL,
  INFLUENCER_BD_PROMPT_VERSION,
} from "./influencerBdAi";
import { getInfluencerBdUpgradeHealth } from "./influencerBdUpgrade";

let poolInstance: Pool | null = null;

function dbPool() {
  if (!poolInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    poolInstance = mysql.createPool({ uri: databaseUrl, waitForConnections: true, connectionLimit: 6 });
  }
  return poolInstance;
}

function actor(ctx: any) {
  return {
    id: Number(ctx?.user?.id || 0) || null,
    name: String(ctx?.user?.name || ctx?.user?.email || ctx?.user?.openId || "authenticated-user").slice(0, 255),
    email: String(ctx?.user?.email || "").trim().toLowerCase(),
    isAdmin: ctx?.user?.role === "admin",
  };
}

type ActorScope = ReturnType<typeof actor> & { staffId: number | null; staffName: string | null };

async function resolveScope(ctx: any, connection: Pool | PoolConnection = dbPool()): Promise<ActorScope> {
  const base = actor(ctx);
  if (!base.email) return { ...base, staffId: null, staffName: null };
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,name FROM staff
      WHERE LOWER(email)=? AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
      ORDER BY manualRevisionAt DESC,id DESC LIMIT 1`,
    [base.email],
  );
  const row = rows[0];
  return {
    ...base,
    staffId: row ? Number(row.id) : null,
    staffName: row ? String(row.name) : null,
  };
}

function safeJson(value: unknown, fallback: any = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function auditSnapshot(value: any) {
  if (!value) return null;
  const result = { ...value };
  for (const field of ["chatText", "contactInfo"]) {
    if (result[field] != null) {
      result[`${field}Length`] = String(result[field]).length;
      delete result[field];
    }
  }
  for (const field of ["fileUrl", "storageKey"]) {
    if (result[field] != null) result[field] = "[stored-object]";
  }
  return result;
}

async function writeAudit(connection: PoolConnection, input: {
  entityType: "campaign" | "creator" | "outreach" | "attachment" | "analysis" | "feedback" | "settings";
  entityId?: number | null;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ctx: any;
}) {
  const a = actor(input.ctx);
  await connection.query(
    `INSERT INTO influencer_bd_audit_logs
      (entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      input.entityType,
      input.entityId || null,
      input.action,
      input.before ? JSON.stringify(auditSnapshot(input.before)) : null,
      input.after ? JSON.stringify(auditSnapshot(input.after)) : null,
      a.id,
      a.name,
      input.reason || null,
    ],
  );
}

function creatorScopeSql(scope: ActorScope, alias = "c") {
  if (scope.isAdmin) return { sql: "1=1", params: [] as any[] };
  if (scope.staffId) {
    return { sql: `(${alias}.ownerStaffId=? OR (${alias}.ownerStaffId IS NULL AND ${alias}.createdById=?))`, params: [scope.staffId, scope.id] };
  }
  return { sql: `${alias}.createdById=?`, params: [scope.id] };
}

function outreachScopeSql(scope: ActorScope, alias = "o") {
  if (scope.isAdmin) return { sql: "1=1", params: [] as any[] };
  if (scope.staffId) {
    return { sql: `(${alias}.staffId=? OR (${alias}.staffId IS NULL AND ${alias}.createdById=?))`, params: [scope.staffId, scope.id] };
  }
  return { sql: `${alias}.createdById=?`, params: [scope.id] };
}

function analysisScopeSql(scope: ActorScope, alias = "a") {
  if (scope.isAdmin) return { sql: "1=1", params: [] as any[] };
  if (scope.staffId) {
    return {
      sql: `(${alias}.requestedById=? OR (${alias}.scopeType='personal' AND ${alias}.scopeStaffId=?))`,
      params: [scope.id, scope.staffId],
    };
  }
  return { sql: `${alias}.requestedById=?`, params: [scope.id] };
}

function mapAnalysisRow(row: any) {
  return {
    ...row,
    inputSnapshot: safeJson(row.inputSnapshotJson, {}),
    result: safeJson(row.resultJson, null),
    inputSnapshotJson: undefined,
    resultJson: undefined,
  };
}

function deterministicMetrics(rows: any[]) {
  const contacted = new Set<number>();
  const replied = new Set<number>();
  const positive = new Set<number>();
  const sampled = new Set<number>();
  const cooperating = new Set<number>();
  let contactAttempts = 0;
  for (const row of rows) {
    const creatorId = Number(row.creatorId);
    contacted.add(creatorId);
    contactAttempts += Number(row.contactCount || 0);
    if (Boolean(row.replyReceived)) replied.add(creatorId);
    if (Boolean(row.positiveReply)) positive.add(creatorId);
    if (Boolean(row.sampleAdvanced)) sampled.add(creatorId);
    if (Boolean(row.cooperationConfirmed)) cooperating.add(creatorId);
  }
  return {
    contactedCreators: contacted.size,
    contactAttempts,
    repliedCreators: replied.size,
    positiveCreators: positive.size,
    sampleCreators: sampled.size,
    cooperatingCreators: cooperating.size,
    replyRate: percentage(replied.size, contacted.size),
    positiveReplyRate: percentage(positive.size, contacted.size),
    contactEfficiency: percentage(replied.size, contactAttempts),
  };
}

async function getCreatorForAccess(connection: Pool | PoolConnection, id: number, scope: ActorScope, lock = false) {
  const access = creatorScopeSql(scope, "c");
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT c.* FROM influencer_bd_creators c
      WHERE c.id=? AND c.deletedAt IS NULL AND ${access.sql} LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [id, ...access.params],
  );
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "[BD-CREATOR-NOT-FOUND] 达人不存在或无权访问" });
  return row;
}

async function getOutreachForAccess(connection: Pool | PoolConnection, id: number, scope: ActorScope, lock = false) {
  const access = outreachScopeSql(scope, "o");
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT o.* FROM influencer_bd_outreach_logs o
      WHERE o.id=? AND o.deletedAt IS NULL AND ${access.sql} LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [id, ...access.params],
  );
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "[BD-OUTREACH-NOT-FOUND] BD进度不存在或无权访问" });
  return row;
}

async function getAnalysisForAccess(connection: Pool | PoolConnection, id: number, scope: ActorScope, lock = false) {
  const access = analysisScopeSql(scope, "a");
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT a.* FROM influencer_bd_ai_analyses a
      WHERE a.id=? AND ${access.sql} LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [id, ...access.params],
  );
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "[BD-ANALYSIS-NOT-FOUND] AI分析不存在或无权访问" });
  return row;
}

async function assertCampaign(connection: Pool | PoolConnection, id: number) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM influencer_bd_campaigns WHERE id=? AND deletedAt IS NULL LIMIT 1",
    [id],
  );
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "[BD-CAMPAIGN-NOT-FOUND] 推广方案不存在" });
  return row;
}

function normalizeHandle(value: string | null | undefined) {
  const text = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  return text || null;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null;
}

function mapCreatorStatus(stage: string) {
  const mapping: Record<string, string> = {
    initial_contact: "contacting",
    follow_up: "contacting",
    replied: "replied",
    needs_confirmed: "interested",
    sample_proposed: "interested",
    sample_sent: "sample",
    negotiating: "negotiating",
    cooperation_confirmed: "cooperating",
    rejected: "rejected",
    paused: "paused",
  };
  return mapping[stage] || "contacting";
}

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为YYYY-MM-DD");
const optionalText = (max = 20_000) => z.string().max(max).optional().nullable();
const campaignStatus = z.enum(["draft", "active", "paused", "archived"]);
const creatorPlatform = z.enum(["TikTok", "Instagram", "YouTube", "X", "LINE", "WeChat", "other"]);
const creatorStatus = z.enum(["potential", "contacting", "replied", "interested", "sample", "negotiating", "cooperating", "paused", "rejected", "archived"]);
const outreachChannel = z.enum(["tiktok_dm", "instagram_dm", "email", "line", "wechat", "phone", "other"]);
const outreachStage = z.enum(["initial_contact", "follow_up", "replied", "needs_confirmed", "sample_proposed", "sample_sent", "negotiating", "cooperation_confirmed", "rejected", "paused"]);
const responseType = z.enum(["none", "neutral", "positive", "rejected", "follow_up_needed"]);

const campaignInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(500),
  brandId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  productNameSnapshot: optionalText(500),
  coreSellingPoints: optionalText(),
  creatorBenefits: optionalText(),
  commissionPolicy: optionalText(),
  samplePolicy: optionalText(),
  targetCreatorProfile: optionalText(),
  referenceOpeningScript: optionalText(),
  referenceFollowUpScript: optionalText(),
  objectionHandling: optionalText(),
  status: campaignStatus.default("draft"),
});

const creatorInput = z.object({
  id: z.number().int().positive().optional(),
  displayName: z.string().trim().min(1).max(255),
  platform: creatorPlatform.default("TikTok"),
  handle: optionalText(255),
  profileUrl: z.string().url().max(2000).optional().nullable(),
  followerCount: z.number().int().min(0).max(10_000_000_000).optional().nullable(),
  category: optionalText(255),
  country: optionalText(100),
  language: optionalText(100),
  contactInfo: optionalText(5000),
  ownerStaffId: z.number().int().positive().optional().nullable(),
  ownerStaffName: optionalText(255),
  status: creatorStatus.default("potential"),
  notes: optionalText(),
});

const outreachInput = z.object({
  id: z.number().int().positive().optional(),
  creatorId: z.number().int().positive(),
  campaignId: z.number().int().positive().optional().nullable(),
  staffId: z.number().int().positive().optional().nullable(),
  staffName: optionalText(255),
  activityDate: dateText,
  channel: outreachChannel,
  stage: outreachStage.default("initial_contact"),
  contactCount: z.number().int().min(1).max(10_000).default(1),
  responseType: responseType.default("none"),
  replyReceived: z.boolean().default(false),
  positiveReply: z.boolean().default(false),
  sampleAdvanced: z.boolean().default(false),
  cooperationConfirmed: z.boolean().default(false),
  pitchText: optionalText(),
  chatText: optionalText(100_000),
  issues: optionalText(),
  nextAction: optionalText(),
  nextFollowUpDate: dateText.optional().nullable(),
  outcomeNotes: optionalText(),
});

export async function saveInfluencerBdAttachmentForUser(user: any, input: {
  outreachId: number;
  storageKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
}) {
  const connection = await dbPool().getConnection();
  const ctx = { user };
  const scope = await resolveScope(ctx, connection);
  try {
    await connection.beginTransaction();
    const outreach = await getOutreachForAccess(connection, input.outreachId, scope, true);
    const [countRows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM influencer_bd_attachments WHERE outreachId=? AND deletedAt IS NULL FOR UPDATE",
      [input.outreachId],
    );
    if (Number(countRows[0]?.count || 0) >= 10) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-UPLOAD-LIMIT] 每条BD进度最多保存10张聊天截图" });
    }
    const [result] = await connection.query<any>(
      `INSERT INTO influencer_bd_attachments
        (outreachId,creatorId,storageKey,fileUrl,fileName,mimeType,fileSize,sha256,uploadedById,uploadedByName)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [input.outreachId,Number(outreach.creatorId),input.storageKey,input.fileUrl,input.fileName,input.mimeType,input.fileSize,input.sha256,scope.id,scope.name],
    );
    const id = Number(result.insertId);
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id,outreachId,creatorId,fileUrl,fileName,mimeType,fileSize,sha256,createdAt FROM influencer_bd_attachments WHERE id=?",
      [id],
    );
    const after = rows[0];
    await writeAudit(connection, { entityType: "attachment", entityId: id, action: "attachment_uploaded", after: { ...after, storageKey: input.storageKey }, ctx });
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export const influencerBdRouter = router({
  health: protectedProcedure.query(() => getInfluencerBdUpgradeHealth()),

  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const p = dbPool();
    const scope = await resolveScope(ctx, p);
    const [campaigns, staffRows, brandRows, productRows, settingsRows] = await Promise.all([
      p.query<RowDataPacket[]>(
        "SELECT * FROM influencer_bd_campaigns WHERE deletedAt IS NULL AND status IN ('active','draft','paused') ORDER BY FIELD(status,'active','draft','paused'),updatedAt DESC,id DESC",
      ),
      p.query<RowDataPacket[]>(
        "SELECT id,name,department,position,country FROM staff WHERE isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL ORDER BY country,name,id",
      ),
      p.query<RowDataPacket[]>(
        "SELECT id,name,nameJa,category FROM brands WHERE deletedAt IS NULL ORDER BY name,id LIMIT 1000",
      ),
      p.query<RowDataPacket[]>(
        `SELECT bp.id,bp.brandId,bp.productName,bp.commissionRate,bp.catchCopy,bp.features,bp.targetAudience,b.name AS brandName
           FROM brand_products bp
           LEFT JOIN brands b ON b.id=bp.brandId
          WHERE bp.deletedAt IS NULL
          ORDER BY bp.updatedAt DESC,bp.id DESC LIMIT 3000`,
      ),
      p.query<RowDataPacket[]>("SELECT * FROM influencer_bd_settings WHERE id=1 LIMIT 1"),
    ]);
    return {
      actor: { id: scope.id, name: scope.name, isAdmin: scope.isAdmin, staffId: scope.staffId, staffName: scope.staffName },
      campaigns: campaigns[0],
      staff: scope.isAdmin ? staffRows[0] : (staffRows[0] as any[]).filter(row => Number(row.id) === scope.staffId),
      brands: brandRows[0],
      products: productRows[0],
      settings: settingsRows[0][0] || null,
    };
  }),

  listCampaigns: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).default({ includeArchived: false }))
    .query(async ({ input }) => {
      const where = input.includeArchived ? "1=1" : "deletedAt IS NULL";
      const [rows] = await dbPool().query<RowDataPacket[]>(
        `SELECT * FROM influencer_bd_campaigns WHERE ${where} ORDER BY FIELD(status,'active','draft','paused','archived'),updatedAt DESC,id DESC`,
      );
      return rows;
    }),

  saveCampaign: adminProcedure.input(campaignInput).mutation(async ({ input, ctx }) => {
    const p = dbPool();
    const connection = await p.getConnection();
    const a = actor(ctx);
    try {
      await connection.beginTransaction();
      let id = input.id;
      let before: any = null;
      if (id) {
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM influencer_bd_campaigns WHERE id=? AND deletedAt IS NULL FOR UPDATE",
          [id],
        );
        before = rows[0];
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "[BD-CAMPAIGN-NOT-FOUND] 推广方案不存在" });
        await connection.query(
          `UPDATE influencer_bd_campaigns SET name=?,brandId=?,productId=?,productNameSnapshot=?,coreSellingPoints=?,creatorBenefits=?,commissionPolicy=?,samplePolicy=?,targetCreatorProfile=?,referenceOpeningScript=?,referenceFollowUpScript=?,objectionHandling=?,status=?,updatedById=?,updatedByName=? WHERE id=?`,
          [input.name,input.brandId || null,input.productId || null,input.productNameSnapshot || null,input.coreSellingPoints || null,input.creatorBenefits || null,input.commissionPolicy || null,input.samplePolicy || null,input.targetCreatorProfile || null,input.referenceOpeningScript || null,input.referenceFollowUpScript || null,input.objectionHandling || null,input.status,a.id,a.name,id],
        );
      } else {
        const [result] = await connection.query<any>(
          `INSERT INTO influencer_bd_campaigns (name,brandId,productId,productNameSnapshot,coreSellingPoints,creatorBenefits,commissionPolicy,samplePolicy,targetCreatorProfile,referenceOpeningScript,referenceFollowUpScript,objectionHandling,status,createdById,createdByName,updatedById,updatedByName) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [input.name,input.brandId || null,input.productId || null,input.productNameSnapshot || null,input.coreSellingPoints || null,input.creatorBenefits || null,input.commissionPolicy || null,input.samplePolicy || null,input.targetCreatorProfile || null,input.referenceOpeningScript || null,input.referenceFollowUpScript || null,input.objectionHandling || null,input.status,a.id,a.name,a.id,a.name],
        );
        id = Number(result.insertId);
      }
      const [afterRows] = await connection.query<RowDataPacket[]>("SELECT * FROM influencer_bd_campaigns WHERE id=?", [id]);
      const after = afterRows[0];
      await writeAudit(connection, { entityType: "campaign", entityId: id, action: before ? "campaign_updated" : "campaign_created", before, after, ctx });
      await connection.commit();
      return after;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),

  archiveCampaign: adminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await dbPool().getConnection();
      try {
        await connection.beginTransaction();
        const before = await assertCampaign(connection, input.id);
        await connection.query("UPDATE influencer_bd_campaigns SET status='archived',deletedAt=CURRENT_TIMESTAMP WHERE id=?", [input.id]);
        await writeAudit(connection, { entityType: "campaign", entityId: input.id, action: "campaign_archived", before, after: { ...before, status: "archived", deletedAt: new Date() }, reason: input.reason, ctx });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  listCreators: protectedProcedure
    .input(z.object({ search: z.string().max(255).optional(), status: creatorStatus.optional(), ownerStaffId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0) }))
    .query(async ({ input, ctx }) => {
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      const access = creatorScopeSql(scope, "c");
      const where = ["c.deletedAt IS NULL", access.sql];
      const params: any[] = [...access.params];
      if (input.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        where.push("(c.displayName LIKE ? OR c.handle LIKE ? OR c.category LIKE ? OR c.profileUrl LIKE ?)");
        params.push(term, term, term, term);
      }
      if (input.status) { where.push("c.status=?"); params.push(input.status); }
      if (scope.isAdmin && input.ownerStaffId) { where.push("c.ownerStaffId=?"); params.push(input.ownerStaffId); }
      params.push(input.limit, input.offset);
      const [rows] = await p.query<RowDataPacket[]>(
        `SELECT c.*,
          (SELECT COUNT(*) FROM influencer_bd_outreach_logs o WHERE o.creatorId=c.id AND o.deletedAt IS NULL) AS outreachCount,
          (SELECT COUNT(*) FROM influencer_bd_attachments a WHERE a.creatorId=c.id AND a.deletedAt IS NULL) AS attachmentCount
         FROM influencer_bd_creators c
         WHERE ${where.join(" AND ")}
         ORDER BY COALESCE(c.lastContactAt,c.updatedAt) DESC,c.id DESC LIMIT ? OFFSET ?`,
        params,
      );
      return rows;
    }),

  saveCreator: protectedProcedure.input(creatorInput).mutation(async ({ input, ctx }) => {
    const connection = await dbPool().getConnection();
    const scope = await resolveScope(ctx, connection);
    const normalizedHandle = normalizeHandle(input.handle);
    try {
      await connection.beginTransaction();
      let id = input.id;
      let before: any = null;
      const ownerStaffId = scope.isAdmin ? (input.ownerStaffId || null) : scope.staffId;
      const ownerStaffName = scope.isAdmin ? (input.ownerStaffName || null) : (scope.staffName || scope.name);
      if (id) {
        before = await getCreatorForAccess(connection, id, scope, true);
        await connection.query(
          `UPDATE influencer_bd_creators SET displayName=?,platform=?,handle=?,normalizedHandle=?,profileUrl=?,followerCount=?,category=?,country=?,language=?,contactInfo=?,ownerStaffId=?,ownerStaffName=?,status=?,notes=?,updatedById=?,updatedByName=? WHERE id=?`,
          [input.displayName,input.platform,input.handle || null,normalizedHandle,input.profileUrl || null,input.followerCount ?? null,input.category || null,input.country || null,input.language || null,input.contactInfo || null,ownerStaffId,ownerStaffName,input.status,input.notes || null,scope.id,scope.name,id],
        );
      } else {
        const [result] = await connection.query<any>(
          `INSERT INTO influencer_bd_creators (displayName,platform,handle,normalizedHandle,profileUrl,followerCount,category,country,language,contactInfo,ownerStaffId,ownerStaffName,status,notes,createdById,createdByName,updatedById,updatedByName) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [input.displayName,input.platform,input.handle || null,normalizedHandle,input.profileUrl || null,input.followerCount ?? null,input.category || null,input.country || null,input.language || null,input.contactInfo || null,ownerStaffId,ownerStaffName,input.status,input.notes || null,scope.id,scope.name,scope.id,scope.name],
        );
        id = Number(result.insertId);
      }
      const [afterRows] = await connection.query<RowDataPacket[]>("SELECT * FROM influencer_bd_creators WHERE id=?", [id]);
      const after = afterRows[0];
      await writeAudit(connection, { entityType: "creator", entityId: id, action: before ? "creator_updated" : "creator_created", before, after, ctx });
      await connection.commit();
      return after;
    } catch (error: any) {
      await connection.rollback();
      if (Number(error?.errno) === 1062) throw new TRPCError({ code: "CONFLICT", message: "[BD-CREATOR-DUPLICATE] 同一平台已存在该达人账号" });
      throw error;
    } finally {
      connection.release();
    }
  }),

  archiveCreator: adminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await dbPool().getConnection();
      const scope = await resolveScope(ctx, connection);
      try {
        await connection.beginTransaction();
        const before = await getCreatorForAccess(connection, input.id, scope, true);
        await connection.query("UPDATE influencer_bd_creators SET status='archived',deletedAt=CURRENT_TIMESTAMP WHERE id=?", [input.id]);
        await writeAudit(connection, { entityType: "creator", entityId: input.id, action: "creator_archived", before, after: { ...before, status: "archived", deletedAt: new Date() }, reason: input.reason, ctx });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  listOutreach: protectedProcedure
    .input(z.object({ periodStart: dateText, periodEnd: dateText, staffId: z.number().int().positive().optional(), campaignId: z.number().int().positive().optional(), stage: outreachStage.optional(), search: z.string().max(255).optional(), limit: z.number().int().min(1).max(500).default(200), offset: z.number().int().min(0).default(0) }))
    .query(async ({ input, ctx }) => {
      if (input.periodEnd < input.periodStart) throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-DATE-RANGE] 结束日期不能早于开始日期" });
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      const access = outreachScopeSql(scope, "o");
      const where = ["o.deletedAt IS NULL", "o.activityDate BETWEEN ? AND ?", access.sql];
      const params: any[] = [input.periodStart, input.periodEnd, ...access.params];
      if (scope.isAdmin && input.staffId) { where.push("o.staffId=?"); params.push(input.staffId); }
      if (input.campaignId) { where.push("o.campaignId=?"); params.push(input.campaignId); }
      if (input.stage) { where.push("o.stage=?"); params.push(input.stage); }
      if (input.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        where.push("(c.displayName LIKE ? OR c.handle LIKE ? OR o.staffName LIKE ? OR o.issues LIKE ? OR o.nextAction LIKE ?)");
        params.push(term, term, term, term, term);
      }
      params.push(input.limit, input.offset);
      const [rows] = await p.query<RowDataPacket[]>(
        `SELECT o.*,c.displayName AS creatorName,c.platform,c.handle,c.profileUrl,c.followerCount,c.category,
                cp.name AS campaignName,
                (SELECT COUNT(*) FROM influencer_bd_attachments a WHERE a.outreachId=o.id AND a.deletedAt IS NULL) AS attachmentCount
           FROM influencer_bd_outreach_logs o
           JOIN influencer_bd_creators c ON c.id=o.creatorId
           LEFT JOIN influencer_bd_campaigns cp ON cp.id=o.campaignId
          WHERE ${where.join(" AND ")}
          ORDER BY o.activityDate DESC,o.id DESC LIMIT ? OFFSET ?`,
        params,
      );
      return rows;
    }),

  getOutreach: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      const row = await getOutreachForAccess(p, input.id, scope);
      const [attachments] = await p.query<RowDataPacket[]>(
        "SELECT id,outreachId,creatorId,fileUrl,fileName,mimeType,fileSize,sha256,createdAt FROM influencer_bd_attachments WHERE outreachId=? AND deletedAt IS NULL ORDER BY id",
        [input.id],
      );
      return { ...row, attachments };
    }),

  saveOutreach: protectedProcedure.input(outreachInput).mutation(async ({ input, ctx }) => {
    const connection = await dbPool().getConnection();
    const scope = await resolveScope(ctx, connection);
    try {
      await connection.beginTransaction();
      await getCreatorForAccess(connection, input.creatorId, scope, true);
      if (input.campaignId) await assertCampaign(connection, input.campaignId);
      const replyReceived = input.replyReceived || input.responseType !== "none";
      const positiveReply = input.positiveReply || input.responseType === "positive";
      if (positiveReply && !replyReceived) throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-RESPONSE-INCONSISTENT] 正向回复必须同时标记已回复" });
      const staffId = scope.isAdmin ? (input.staffId || null) : scope.staffId;
      const staffName = scope.isAdmin ? (input.staffName || null) : (scope.staffName || scope.name);
      let id = input.id;
      let before: any = null;
      if (id) {
        before = await getOutreachForAccess(connection, id, scope, true);
        if (!scope.isAdmin && Number(before.creatorId) !== input.creatorId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "[BD-OUTREACH-CREATOR-LOCKED] 普通员工不能更换记录所属达人" });
        }
        await connection.query(
          `UPDATE influencer_bd_outreach_logs SET creatorId=?,campaignId=?,staffId=?,staffName=?,activityDate=?,channel=?,stage=?,contactCount=?,responseType=?,replyReceived=?,positiveReply=?,sampleAdvanced=?,cooperationConfirmed=?,pitchText=?,chatText=?,issues=?,nextAction=?,nextFollowUpDate=?,outcomeNotes=?,updatedById=?,updatedByName=? WHERE id=?`,
          [input.creatorId,input.campaignId || null,staffId,staffName,input.activityDate,input.channel,input.stage,input.contactCount,input.responseType,replyReceived ? 1 : 0,positiveReply ? 1 : 0,input.sampleAdvanced ? 1 : 0,input.cooperationConfirmed ? 1 : 0,input.pitchText || null,input.chatText || null,input.issues || null,input.nextAction || null,input.nextFollowUpDate || null,input.outcomeNotes || null,scope.id,scope.name,id],
        );
      } else {
        const [result] = await connection.query<any>(
          `INSERT INTO influencer_bd_outreach_logs (creatorId,campaignId,staffId,staffName,activityDate,channel,stage,contactCount,responseType,replyReceived,positiveReply,sampleAdvanced,cooperationConfirmed,pitchText,chatText,issues,nextAction,nextFollowUpDate,outcomeNotes,createdById,createdByName,updatedById,updatedByName) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [input.creatorId,input.campaignId || null,staffId,staffName,input.activityDate,input.channel,input.stage,input.contactCount,input.responseType,replyReceived ? 1 : 0,positiveReply ? 1 : 0,input.sampleAdvanced ? 1 : 0,input.cooperationConfirmed ? 1 : 0,input.pitchText || null,input.chatText || null,input.issues || null,input.nextAction || null,input.nextFollowUpDate || null,input.outcomeNotes || null,scope.id,scope.name,scope.id,scope.name],
        );
        id = Number(result.insertId);
      }
      const status = mapCreatorStatus(input.stage);
      await connection.query(
        `UPDATE influencer_bd_creators SET status=?,lastContactAt=GREATEST(COALESCE(lastContactAt,'1970-01-01'),CAST(? AS DATETIME)),lastReplyAt=IF(?=1,GREATEST(COALESCE(lastReplyAt,'1970-01-01'),CAST(? AS DATETIME)),lastReplyAt),updatedById=?,updatedByName=? WHERE id=?`,
        [status,input.activityDate,replyReceived ? 1 : 0,input.activityDate,scope.id,scope.name,input.creatorId],
      );
      const [afterRows] = await connection.query<RowDataPacket[]>("SELECT * FROM influencer_bd_outreach_logs WHERE id=?", [id]);
      const after = afterRows[0];
      await writeAudit(connection, { entityType: "outreach", entityId: id, action: before ? "outreach_updated" : "outreach_created", before, after, ctx });
      await connection.commit();
      return after;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),

  archiveOutreach: adminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await dbPool().getConnection();
      const scope = await resolveScope(ctx, connection);
      try {
        await connection.beginTransaction();
        const before = await getOutreachForAccess(connection, input.id, scope, true);
        await connection.query("UPDATE influencer_bd_outreach_logs SET deletedAt=CURRENT_TIMESTAMP WHERE id=?", [input.id]);
        await writeAudit(connection, { entityType: "outreach", entityId: input.id, action: "outreach_archived", before, after: { ...before, deletedAt: new Date() }, reason: input.reason, ctx });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  archiveAttachment: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await dbPool().getConnection();
      const scope = await resolveScope(ctx, connection);
      try {
        await connection.beginTransaction();
        const access = outreachScopeSql(scope, "o");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT a.*,o.staffId,o.createdById AS outreachCreatedById
             FROM influencer_bd_attachments a
             JOIN influencer_bd_outreach_logs o ON o.id=a.outreachId
            WHERE a.id=? AND a.deletedAt IS NULL AND o.deletedAt IS NULL AND ${access.sql}
            LIMIT 1 FOR UPDATE`,
          [input.id, ...access.params],
        );
        const before = rows[0];
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "[BD-ATTACHMENT-NOT-FOUND] 截图不存在或无权访问" });
        await connection.query("UPDATE influencer_bd_attachments SET deletedAt=CURRENT_TIMESTAMP WHERE id=?", [input.id]);
        await writeAudit(connection, { entityType: "attachment", entityId: input.id, action: "attachment_archived", before, after: { ...before, deletedAt: new Date() }, reason: input.reason, ctx });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  runAnalysis: protectedProcedure
    .input(z.object({
      scopeType: z.enum(["personal", "team", "campaign"]),
      periodStart: dateText,
      periodEnd: dateText,
      staffId: z.number().int().positive().optional(),
      campaignId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.periodEnd < input.periodStart) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-DATE-RANGE] 结束日期不能早于开始日期" });
      }
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      if (!scope.isAdmin && input.scopeType !== "personal") {
        throw new TRPCError({ code: "FORBIDDEN", message: "[BD-AI-SCOPE] 普通员工只能分析自己的BD记录" });
      }
      const selectedStaffId = input.scopeType === "personal"
        ? (scope.isAdmin ? (input.staffId || scope.staffId) : scope.staffId)
        : (scope.isAdmin && input.staffId ? input.staffId : null);
      if (input.scopeType === "personal" && !selectedStaffId && scope.isAdmin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-AI-STAFF-REQUIRED] 个人分析必须选择BD员工" });
      }
      if (input.scopeType === "campaign" && !input.campaignId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-AI-CAMPAIGN-REQUIRED] 推广方案分析必须选择推广方案" });
      }
      if (input.campaignId) await assertCampaign(p, input.campaignId);

      const access = outreachScopeSql(scope, "o");
      const where = ["o.deletedAt IS NULL", "o.activityDate BETWEEN ? AND ?", access.sql];
      const params: any[] = [input.periodStart, input.periodEnd, ...access.params];
      if (selectedStaffId && (input.scopeType === "personal" || input.staffId)) {
        where.push("o.staffId=?");
        params.push(selectedStaffId);
      }
      if (input.campaignId) {
        where.push("o.campaignId=?");
        params.push(input.campaignId);
      }
      const [outreachRows] = await p.query<RowDataPacket[]>(
        `SELECT o.id,o.creatorId,o.campaignId,o.staffId,o.staffName,o.activityDate,o.channel,o.stage,o.contactCount,
                o.responseType,o.replyReceived,o.positiveReply,o.sampleAdvanced,o.cooperationConfirmed,
                o.pitchText,o.chatText,o.issues,o.nextAction,o.nextFollowUpDate,o.outcomeNotes,
                c.platform,c.followerCount,c.category,c.country,c.language
           FROM influencer_bd_outreach_logs o
           JOIN influencer_bd_creators c ON c.id=o.creatorId AND c.deletedAt IS NULL
          WHERE ${where.join(" AND ")}
          ORDER BY o.activityDate DESC,o.id DESC LIMIT 500`,
        params,
      );
      if (!outreachRows.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-AI-NO-EVIDENCE] 所选范围没有真实BD记录，AI不会生成推测结果" });
      }

      const metrics = deterministicMetrics(outreachRows);
      const campaignIds = [...new Set(outreachRows.map(row => Number(row.campaignId)).filter(Boolean))].slice(0, 30);
      let campaigns: any[] = [];
      if (campaignIds.length) {
        const [rows] = await p.query<RowDataPacket[]>(
          `SELECT id,name,productNameSnapshot,coreSellingPoints,creatorBenefits,commissionPolicy,samplePolicy,targetCreatorProfile,referenceOpeningScript,referenceFollowUpScript,objectionHandling,status
             FROM influencer_bd_campaigns
            WHERE id IN (${campaignIds.map(() => "?").join(",")}) AND deletedAt IS NULL`,
          campaignIds,
        );
        campaigns = rows;
      }

      const outreachIds = outreachRows.map(row => Number(row.id));
      let attachments: any[] = [];
      if (outreachIds.length) {
        const [rows] = await p.query<RowDataPacket[]>(
          `SELECT id,outreachId,creatorId,storageKey,fileName,mimeType,fileSize,sha256,createdAt
             FROM influencer_bd_attachments
            WHERE outreachId IN (${outreachIds.map(() => "?").join(",")}) AND deletedAt IS NULL
            ORDER BY createdAt DESC,id DESC LIMIT 8`,
          outreachIds,
        );
        attachments = rows;
      }

      const [feedbackRows] = await p.query<RowDataPacket[]>(
        `SELECT f.rating,f.comment,f.implementedActionsJson,f.resultNote,f.createdAt
           FROM influencer_bd_analysis_feedback f
           JOIN influencer_bd_ai_analyses a ON a.id=f.analysisId
          WHERE f.userId=? AND a.status='success'
          ORDER BY f.id DESC LIMIT 10`,
        [scope.id],
      );

      const snapshot = {
        scope: {
          type: scope.isAdmin ? input.scopeType : "personal",
          staffId: selectedStaffId || null,
          campaignId: input.campaignId || null,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
        deterministicMetrics: metrics,
        recordCount: outreachRows.length,
        recordLimit: 500,
        truncated: outreachRows.length >= 500,
        campaigns: campaigns.map(row => ({ ...row })),
        outreach: outreachRows.map(row => ({
          evidenceId: Number(row.id),
          creatorRef: `creator-${Number(row.creatorId)}`,
          campaignId: row.campaignId ? Number(row.campaignId) : null,
          staffRoleRef: row.staffId ? `staff-${Number(row.staffId)}` : "staff-unlinked",
          activityDate: row.activityDate,
          channel: row.channel,
          stage: row.stage,
          contactCount: Number(row.contactCount || 0),
          responseType: row.responseType,
          replyReceived: Boolean(row.replyReceived),
          positiveReply: Boolean(row.positiveReply),
          sampleAdvanced: Boolean(row.sampleAdvanced),
          cooperationConfirmed: Boolean(row.cooperationConfirmed),
          pitchText: row.pitchText ? String(row.pitchText).slice(0, 6000) : null,
          chatText: row.chatText ? String(row.chatText).slice(0, 12000) : null,
          issues: row.issues ? String(row.issues).slice(0, 6000) : null,
          nextAction: row.nextAction ? String(row.nextAction).slice(0, 6000) : null,
          nextFollowUpDate: row.nextFollowUpDate,
          outcomeNotes: row.outcomeNotes ? String(row.outcomeNotes).slice(0, 6000) : null,
          creatorProfile: {
            platform: row.platform,
            followerCount: row.followerCount == null ? null : Number(row.followerCount),
            category: row.category,
            country: row.country,
            language: row.language,
          },
        })),
        attachmentEvidence: attachments.map(row => ({
          attachmentId: Number(row.id),
          outreachId: Number(row.outreachId),
          mimeType: row.mimeType,
          fileSize: Number(row.fileSize),
          sha256: row.sha256,
        })),
        priorFeedback: feedbackRows.map(row => ({
          rating: row.rating,
          comment: row.comment,
          implementedActions: safeJson(row.implementedActionsJson, []),
          resultNote: row.resultNote,
          createdAt: row.createdAt,
        })),
      };

      let analysisId: number;
      const createConnection = await p.getConnection();
      try {
        await createConnection.beginTransaction();
        const [result] = await createConnection.query<any>(
          `INSERT INTO influencer_bd_ai_analyses
            (scopeType,scopeStaffId,periodStart,periodEnd,campaignId,model,promptVersion,inputSnapshotJson,status,requestedById,requestedByName)
           VALUES (?,?,?,?,?,?,?,?, 'processing',?,?)`,
          [scope.isAdmin ? input.scopeType : "personal",selectedStaffId || null,input.periodStart,input.periodEnd,input.campaignId || null,INFLUENCER_BD_AI_MODEL,INFLUENCER_BD_PROMPT_VERSION,JSON.stringify(snapshot),scope.id,scope.name],
        );
        analysisId = Number(result.insertId);
        await writeAudit(createConnection, { entityType: "analysis", entityId: analysisId, action: "analysis_started", after: { id: analysisId, scopeType: scope.isAdmin ? input.scopeType : "personal", periodStart: input.periodStart, periodEnd: input.periodEnd, campaignId: input.campaignId || null, model: INFLUENCER_BD_AI_MODEL, promptVersion: INFLUENCER_BD_PROMPT_VERSION, status: "processing", recordCount: outreachRows.length, attachmentCount: attachments.length }, ctx });
        await createConnection.commit();
      } catch (error) {
        await createConnection.rollback();
        throw error;
      } finally {
        createConnection.release();
      }

      try {
        const imageUrls: string[] = [];
        for (const attachment of attachments) {
          try {
            const signed = await storageGet(String(attachment.storageKey));
            imageUrls.push(signed.url);
          } catch (error) {
            console.error("[InfluencerBD AI Attachment]", { analysisId, attachmentId: Number(attachment.id), error });
          }
        }
        const result = await analyzeInfluencerBdEvidence({ snapshot, imageUrls });
        const successConnection = await p.getConnection();
        try {
          await successConnection.beginTransaction();
          await successConnection.query(
            `UPDATE influencer_bd_ai_analyses
                SET resultJson=?,summary=?,confidence=?,status='success',errorCode=NULL,errorMessage=NULL
              WHERE id=? AND status='processing'`,
            [JSON.stringify(result),result.executiveSummary,result.confidence,analysisId],
          );
          await writeAudit(successConnection, { entityType: "analysis", entityId: analysisId, action: "analysis_succeeded", before: { status: "processing" }, after: { status: "success", confidence: result.confidence, model: INFLUENCER_BD_AI_MODEL }, ctx });
          await successConnection.commit();
        } catch (error) {
          await successConnection.rollback();
          throw error;
        } finally {
          successConnection.release();
        }
        return { id: analysisId, status: "success" as const, model: INFLUENCER_BD_AI_MODEL, result };
      } catch (error: any) {
        const message = String(error?.message || "AI分析失败");
        const code = message.match(/\[(BD-[A-Z0-9-]+)\]/)?.[1] || "BD-AI-FAILED";
        const failedConnection = await p.getConnection();
        try {
          await failedConnection.beginTransaction();
          await failedConnection.query(
            `UPDATE influencer_bd_ai_analyses SET status='failed',errorCode=?,errorMessage=? WHERE id=?`,
            [code,message.slice(0,4000),analysisId],
          );
          await writeAudit(failedConnection, { entityType: "analysis", entityId: analysisId, action: "analysis_failed", before: { status: "processing" }, after: { status: "failed", errorCode: code }, ctx });
          await failedConnection.commit();
        } catch (logError) {
          await failedConnection.rollback();
          console.error("[InfluencerBD AI Failure Log]", { analysisId, logError });
        } finally {
          failedConnection.release();
        }
        console.error("[InfluencerBD AI]", { analysisId, errorCode: code, message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `[${code}] AI分析失败，已保存错误记录，请稍后重试` });
      }
    }),

  listAnalyses: protectedProcedure
    .input(z.object({ periodStart: dateText.optional(), periodEnd: dateText.optional(), campaignId: z.number().int().positive().optional(), status: z.enum(["processing", "success", "failed"]).optional(), limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ input, ctx }) => {
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      const access = analysisScopeSql(scope, "a");
      const where = [access.sql];
      const params: any[] = [...access.params];
      if (input.periodStart) { where.push("a.periodEnd>=?"); params.push(input.periodStart); }
      if (input.periodEnd) { where.push("a.periodStart<=?"); params.push(input.periodEnd); }
      if (input.campaignId) { where.push("a.campaignId=?"); params.push(input.campaignId); }
      if (input.status) { where.push("a.status=?"); params.push(input.status); }
      params.push(input.limit);
      const [rows] = await p.query<RowDataPacket[]>(
        `SELECT a.id,a.scopeType,a.scopeStaffId,a.periodStart,a.periodEnd,a.campaignId,a.model,a.promptVersion,a.summary,a.confidence,a.status,a.errorCode,a.errorMessage,a.requestedById,a.requestedByName,a.createdAt,
                c.name AS campaignName,
                (SELECT COUNT(*) FROM influencer_bd_analysis_feedback f WHERE f.analysisId=a.id) AS feedbackCount
           FROM influencer_bd_ai_analyses a
           LEFT JOIN influencer_bd_campaigns c ON c.id=a.campaignId
          WHERE ${where.join(" AND ")}
          ORDER BY a.id DESC LIMIT ?`,
        params,
      );
      return rows.map(row => ({ ...row, feedbackCount: Number(row.feedbackCount || 0) }));
    }),

  getAnalysis: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      const row = await getAnalysisForAccess(p, input.id, scope);
      const [feedbackRows] = await p.query<RowDataPacket[]>(
        "SELECT id,analysisId,rating,comment,implementedActionsJson,resultNote,userId,userName,createdAt FROM influencer_bd_analysis_feedback WHERE analysisId=? ORDER BY id DESC",
        [input.id],
      );
      return {
        ...mapAnalysisRow(row),
        feedback: feedbackRows.map(feedback => ({ ...feedback, implementedActions: safeJson(feedback.implementedActionsJson, []), implementedActionsJson: undefined })),
      };
    }),

  createAnalysisFeedback: protectedProcedure
    .input(z.object({ analysisId: z.number().int().positive(), rating: z.enum(["good", "bad"]), comment: optionalText(5000), implementedActions: z.array(z.string().trim().min(1).max(500)).max(50).default([]), resultNote: optionalText(5000) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await dbPool().getConnection();
      const scope = await resolveScope(ctx, connection);
      try {
        await connection.beginTransaction();
        const analysis = await getAnalysisForAccess(connection, input.analysisId, scope, true);
        if (analysis.status !== "success") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-AI-FEEDBACK-STATUS] 只能评价已完成的AI分析" });
        }
        const [result] = await connection.query<any>(
          `INSERT INTO influencer_bd_analysis_feedback
            (analysisId,rating,comment,implementedActionsJson,resultNote,userId,userName)
           VALUES (?,?,?,?,?,?,?)`,
          [input.analysisId,input.rating,input.comment || null,JSON.stringify(input.implementedActions),input.resultNote || null,scope.id,scope.name],
        );
        const id = Number(result.insertId);
        const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM influencer_bd_analysis_feedback WHERE id=?", [id]);
        const after = rows[0];
        await writeAudit(connection, { entityType: "feedback", entityId: id, action: "analysis_feedback_created", after, ctx });
        await connection.commit();
        return { ...after, implementedActions: safeJson(after.implementedActionsJson, []), implementedActionsJson: undefined };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  dashboard: protectedProcedure
    .input(z.object({ periodStart: dateText, periodEnd: dateText, staffId: z.number().int().positive().optional(), campaignId: z.number().int().positive().optional() }))
    .query(async ({ input, ctx }) => {
      if (input.periodEnd < input.periodStart) throw new TRPCError({ code: "BAD_REQUEST", message: "[BD-DATE-RANGE] 结束日期不能早于开始日期" });
      const p = dbPool();
      const scope = await resolveScope(ctx, p);
      const access = outreachScopeSql(scope, "o");
      const where = ["o.deletedAt IS NULL", "o.activityDate BETWEEN ? AND ?", access.sql];
      const params: any[] = [input.periodStart, input.periodEnd, ...access.params];
      if (scope.isAdmin && input.staffId) { where.push("o.staffId=?"); params.push(input.staffId); }
      if (input.campaignId) { where.push("o.campaignId=?"); params.push(input.campaignId); }
      const whereSql = where.join(" AND ");
      const aggregateSql = `COUNT(DISTINCT o.creatorId) AS contactedCreators,
        COALESCE(SUM(o.contactCount),0) AS contactAttempts,
        COUNT(DISTINCT CASE WHEN o.replyReceived=1 THEN o.creatorId END) AS repliedCreators,
        COUNT(DISTINCT CASE WHEN o.positiveReply=1 THEN o.creatorId END) AS positiveCreators,
        COUNT(DISTINCT CASE WHEN o.sampleAdvanced=1 THEN o.creatorId END) AS sampleCreators,
        COUNT(DISTINCT CASE WHEN o.cooperationConfirmed=1 THEN o.creatorId END) AS cooperatingCreators`;
      const [[totalRows], [staffRows], [channelRows], [stageRows], [campaignRows], [dailyRows], [settingsRows]] = await Promise.all([
        p.query<RowDataPacket[]>(`SELECT ${aggregateSql} FROM influencer_bd_outreach_logs o WHERE ${whereSql}`, params),
        p.query<RowDataPacket[]>(`SELECT o.staffId,o.staffName,${aggregateSql} FROM influencer_bd_outreach_logs o WHERE ${whereSql} GROUP BY o.staffId,o.staffName ORDER BY repliedCreators DESC,contactedCreators DESC`, params),
        p.query<RowDataPacket[]>(`SELECT o.channel,${aggregateSql} FROM influencer_bd_outreach_logs o WHERE ${whereSql} GROUP BY o.channel ORDER BY repliedCreators DESC,contactedCreators DESC`, params),
        p.query<RowDataPacket[]>(`SELECT o.stage,COUNT(*) AS recordCount,COUNT(DISTINCT o.creatorId) AS creatorCount FROM influencer_bd_outreach_logs o WHERE ${whereSql} GROUP BY o.stage ORDER BY creatorCount DESC`, params),
        p.query<RowDataPacket[]>(`SELECT o.campaignId,COALESCE(c.name,'未指定推广方案') AS campaignName,${aggregateSql} FROM influencer_bd_outreach_logs o LEFT JOIN influencer_bd_campaigns c ON c.id=o.campaignId WHERE ${whereSql} GROUP BY o.campaignId,c.name ORDER BY repliedCreators DESC,contactedCreators DESC`, params),
        p.query<RowDataPacket[]>(`SELECT o.activityDate,${aggregateSql} FROM influencer_bd_outreach_logs o WHERE ${whereSql} GROUP BY o.activityDate ORDER BY o.activityDate`, params),
        p.query<RowDataPacket[]>("SELECT * FROM influencer_bd_settings WHERE id=1 LIMIT 1"),
      ]);
      const normalize = (row: any) => {
        const contactedCreators = Number(row?.contactedCreators || 0);
        const contactAttempts = Number(row?.contactAttempts || 0);
        const repliedCreators = Number(row?.repliedCreators || 0);
        const positiveCreators = Number(row?.positiveCreators || 0);
        const sampleCreators = Number(row?.sampleCreators || 0);
        const cooperatingCreators = Number(row?.cooperatingCreators || 0);
        return {
          ...row,
          contactedCreators,
          contactAttempts,
          repliedCreators,
          positiveCreators,
          sampleCreators,
          cooperatingCreators,
          replyRate: percentage(repliedCreators, contactedCreators),
          positiveReplyRate: percentage(positiveCreators, contactedCreators),
          contactEfficiency: percentage(repliedCreators, contactAttempts),
        };
      };
      const total = normalize(totalRows[0] || {});
      const settings = settingsRows[0] || { lowReplyRatePercent: 5, minimumContactedCreators: 20, stagnationDays: 3, autoAnalysisEnabled: 0 };
      const [stagnantRows] = await p.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM influencer_bd_creators c
          WHERE c.deletedAt IS NULL AND c.status IN ('contacting','replied','interested','sample','negotiating')
            AND c.lastContactAt IS NOT NULL
            AND c.lastContactAt < DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
            AND ${creatorScopeSql(scope, "c").sql}`,
        [Number(settings.stagnationDays || 3), ...creatorScopeSql(scope, "c").params],
      );
      return {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        total,
        byStaff: staffRows.map(normalize),
        byChannel: channelRows.map(normalize),
        byStage: stageRows.map(row => ({ ...row, recordCount: Number(row.recordCount || 0), creatorCount: Number(row.creatorCount || 0) })),
        byCampaign: campaignRows.map(normalize),
        daily: dailyRows.map(normalize),
        settings: { ...settings, lowReplyRatePercent: Number(settings.lowReplyRatePercent || 5), stagnationDays: Number(settings.stagnationDays || 3), minimumContactedCreators: Number(settings.minimumContactedCreators || 20), autoAnalysisEnabled: Boolean(settings.autoAnalysisEnabled) },
        alerts: {
          lowReplyRate: total.contactedCreators >= Number(settings.minimumContactedCreators || 20) && total.replyRate !== null && total.replyRate < Number(settings.lowReplyRatePercent || 5),
          stagnantCreators: Number(stagnantRows[0]?.count || 0),
        },
      };
    }),

  updateSettings: adminProcedure
    .input(z.object({ lowReplyRatePercent: z.number().min(0).max(100), stagnationDays: z.number().int().min(1).max(365), minimumContactedCreators: z.number().int().min(1).max(100_000), autoAnalysisEnabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const connection = await dbPool().getConnection();
      const a = actor(ctx);
      try {
        await connection.beginTransaction();
        const [beforeRows] = await connection.query<RowDataPacket[]>("SELECT * FROM influencer_bd_settings WHERE id=1 FOR UPDATE");
        const before = beforeRows[0] || null;
        await connection.query(
          `INSERT INTO influencer_bd_settings (id,lowReplyRatePercent,stagnationDays,minimumContactedCreators,autoAnalysisEnabled,updatedById,updatedByName)
           VALUES (1,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE lowReplyRatePercent=VALUES(lowReplyRatePercent),stagnationDays=VALUES(stagnationDays),minimumContactedCreators=VALUES(minimumContactedCreators),autoAnalysisEnabled=VALUES(autoAnalysisEnabled),updatedById=VALUES(updatedById),updatedByName=VALUES(updatedByName)`,
          [input.lowReplyRatePercent,input.stagnationDays,input.minimumContactedCreators,input.autoAnalysisEnabled ? 1 : 0,a.id,a.name],
        );
        const [afterRows] = await connection.query<RowDataPacket[]>("SELECT * FROM influencer_bd_settings WHERE id=1");
        const after = afterRows[0];
        await writeAudit(connection, { entityType: "settings", entityId: 1, action: "settings_updated", before, after, ctx });
        await connection.commit();
        return after;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  audit: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100), entityType: z.enum(["campaign", "creator", "outreach", "attachment", "analysis", "feedback", "settings"]).optional() }))
    .query(async ({ input }) => {
      const where = input.entityType ? "WHERE entityType=?" : "";
      const params = input.entityType ? [input.entityType, input.limit] : [input.limit];
      const [rows] = await dbPool().query<RowDataPacket[]>(
        `SELECT id,entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason,createdAt FROM influencer_bd_audit_logs ${where} ORDER BY id DESC LIMIT ?`,
        params,
      );
      return rows.map(row => ({ ...row, beforeJson: safeJson(row.beforeJson), afterJson: safeJson(row.afterJson) }));
    }),
});
