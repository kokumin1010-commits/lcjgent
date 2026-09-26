import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import type { InsertSchedule } from "../drizzle/schema";
import { normalizeLiverIdentity } from "../shared/brandLiveApproval";
import { ensureBrandLiveApprovalReady } from "./brandLiveApprovalUpgrade";

let gatePool: Pool | null = null;

function pool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Database not available");
  if (!gatePool) gatePool = mysql.createPool({ uri: databaseUrl, timezone: "Z", connectionLimit: 5 });
  return gatePool;
}

export function scheduleBrandIds(value: { brandId?: number | null; brandIds?: number[] | null }): number[] {
  const ids = new Set<number>();
  if (Number.isInteger(value.brandId) && Number(value.brandId) > 0) ids.add(Number(value.brandId));
  for (const id of Array.isArray(value.brandIds) ? value.brandIds : []) if (Number.isInteger(id) && id > 0) ids.add(Number(id));
  return [...ids].sort((a, b) => a - b);
}

function parseBrandIds(raw: unknown, fallback: unknown): number[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = []; }
  }
  return scheduleBrandIds({ brandId: fallback == null ? null : Number(fallback), brandIds: Array.isArray(parsed) ? parsed.map(Number) : [] });
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCMilliseconds(0);
  return date;
}

function sameDate(a: unknown, b: unknown): boolean {
  const left = asDate(a);
  const right = asDate(b);
  return Boolean(left && right && left.getTime() === right.getTime());
}

async function actorName(connection: PoolConnection, userId: number | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const [rows] = await connection.query<RowDataPacket[]>("SELECT name,email FROM users WHERE id=? LIMIT 1", [userId]);
  return rows[0] ? String(rows[0].name || rows[0].email || `user:${userId}`).slice(0, 255) : `user:${userId}`;
}

async function assertBusinessScheduleActor(connection: PoolConnection, actorUserId: number | null | undefined): Promise<void> {
  const userId = Number(actorUserId || 0);
  if (!userId) throw new TRPCError({ code: "FORBIDDEN", message: "品牌排班仅限商务部门或管理员操作" });
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT u.role,s.department
       FROM users u
       LEFT JOIN staff s ON LOWER(TRIM(s.email))=LOWER(TRIM(u.email)) AND s.isActive='active'
      WHERE u.id=?
      LIMIT 1`,
    [userId],
  );
  const role = String(rows[0]?.role || "").toLowerCase();
  const department = String(rows[0]?.department || "").trim().toLowerCase();
  const isBusiness = department.includes("商务") || department.includes("商務") || department.includes("business") || department.includes("営業");
  if (role !== "admin" && !isBusiness) {
    throw new TRPCError({ code: "FORBIDDEN", message: "品牌排班仅限商务部门或管理员操作" });
  }
}

async function approvalSnapshot(connection: PoolConnection, approval: RowDataPacket) {
  const [products] = await connection.query<RowDataPacket[]>(
    "SELECT productId,productName,specification,originalPrice,discountedPrice,offerMechanism,commissionRate,inventory,notes,sortOrder FROM brand_live_approval_products WHERE approvalId=? ORDER BY sortOrder,id",
    [approval.id],
  );
  return {
    ...approval,
    id: Number(approval.id),
    brandId: Number(approval.brandId),
    commissionRate: Number(approval.commissionRate),
    slotFeeAmount: Number(approval.slotFeeAmount),
    guaranteeValue: approval.guaranteeValue == null ? null : Number(approval.guaranteeValue),
    products: products.map(product => ({
      ...product,
      productId: product.productId == null ? null : Number(product.productId),
      originalPrice: Number(product.originalPrice),
      discountedPrice: Number(product.discountedPrice),
      commissionRate: product.commissionRate == null ? null : Number(product.commissionRate),
      inventory: product.inventory == null ? null : Number(product.inventory),
    })),
  };
}

async function appendScheduleEvent(connection: PoolConnection, approval: RowDataPacket, eventType: "scheduled" | "schedule_cancelled", scheduleId: number, userId: number | null | undefined, userName: string | null) {
  const snapshot = await approvalSnapshot(connection, approval);
  await connection.query(
    `INSERT INTO brand_live_approval_events
     (approvalId,brandId,eventType,fromStatus,toStatus,snapshotJson,actorUserId,actorName,comment)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [approval.id, approval.brandId, eventType, eventType === "scheduled" ? "approved" : "scheduled", eventType === "scheduled" ? "scheduled" : "cancelled", JSON.stringify(snapshot), userId || approval.updatedBy || approval.createdBy, userName || "system", `schedule:${scheduleId}`],
  );
}

async function findApproval(
  connection: PoolConnection,
  brandId: number,
  schedule: { startTime: unknown; endTime?: unknown; liverId?: number | null; liverName?: string | null; liveAccount?: string | null },
): Promise<RowDataPacket> {
  const start = asDate(schedule.startTime);
  const end = asDate(schedule.endTime);
  if (!start || !end || end <= start) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "品牌直播排班必须填写与已批准条件一致的开始和结束时间" });
  if (!schedule.liverId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "品牌直播必须选择已登记主播账号" });
  const [liverRows] = await connection.query<RowDataPacket[]>("SELECT name,tiktokAccount FROM livers WHERE id=? AND isActive=1 LIMIT 1", [schedule.liverId]);
  const liver = liverRows[0];
  if (!liver || normalizeLiverIdentity(liver.name) !== normalizeLiverIdentity(schedule.liverName)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "排班主播ID与姓名不一致" });
  }
  const canonicalAccount = normalizeLiverIdentity(liver.tiktokAccount);
  if (!canonicalAccount) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "排班主播尚未登记TikTok账号，请先完善主播资料" });
  }
  if (canonicalAccount !== normalizeLiverIdentity(schedule.liveAccount)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "排班直播账号与主播资料不一致" });
  }
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT approval.*
       FROM brand_live_approvals approval
       LEFT JOIN brand_live_approval_schedule_links link ON link.approvalId=approval.id AND link.isActive=1
      WHERE approval.brandId=?
        AND approval.status='approved'
        AND approval.scheduledStart=?
        AND approval.scheduledEnd=?
        AND link.id IS NULL
      ORDER BY approval.reviewedAt DESC,approval.id DESC
      FOR UPDATE`,
    [brandId, start, end],
  );
  const scheduleLiver = normalizeLiverIdentity(schedule.liverName);
  const liveAccount = normalizeLiverIdentity(schedule.liveAccount);
  const match = rows.find(row => {
    const idMatches = row.targetLiverId != null && Number(schedule.liverId) === Number(row.targetLiverId);
    const nameMatches = Boolean(scheduleLiver) && scheduleLiver === normalizeLiverIdentity(row.targetLiverName);
    return idMatches && nameMatches && liveAccount && liveAccount === normalizeLiverIdentity(row.liveAccount);
  });
  if (!match) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `品牌 ${brandId} 尚无与该主播、直播账号和时间完全一致的KG已确认条件，不能排班`,
    });
  }
  return match;
}

async function linkApprovals(
  connection: PoolConnection,
  scheduleId: number,
  brandIds: number[],
  schedule: { startTime: unknown; endTime?: unknown; liverId?: number | null; liverName?: string | null; liveAccount?: string | null; createdBy?: number | null },
) {
  const userId = schedule.createdBy || null;
  const userName = await actorName(connection, userId);
  for (const brandId of brandIds) {
    const approval = await findApproval(connection, brandId, schedule);
    await connection.query(
      `INSERT INTO brand_live_approval_schedule_links (approvalId,scheduleId,brandId,linkedBy,linkedByName,isActive) VALUES (?,?,?,?,?,1)`,
      [approval.id, scheduleId, brandId, userId, userName],
    );
    await connection.query(
      "UPDATE brand_live_approvals SET status='scheduled',revision=revision+1,updatedBy=COALESCE(?,updatedBy),updatedByName=COALESCE(?,updatedByName) WHERE id=? AND status='approved'",
      [userId, userName, approval.id],
    );
    await appendScheduleEvent(connection, approval, "scheduled", scheduleId, userId, userName);
  }
}

async function assertPersistedScheduleMatches(connection: PoolConnection, scheduleId: number, expected: { startTime: unknown; endTime?: unknown }): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT startTime,endTime FROM schedules WHERE id=? LIMIT 1 FOR UPDATE", [scheduleId]);
  const persisted = rows[0];
  if (!persisted || !sameDate(persisted.startTime, expected.startTime) || !sameDate(persisted.endTime, expected.endTime)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "排班写入时间与KG已确认时间不一致，已取消保存" });
  }
}

function scheduleInsertValues(data: InsertSchedule) {
  return [
    data.title,
    data.description ?? null,
    asDate(data.startTime),
    asDate(data.endTime) ?? null,
    data.isAllDay ?? false,
    data.category ?? "other",
    data.liverId ?? null,
    data.liverName ?? null,
    data.brandId ?? null,
    data.brandIds ? JSON.stringify(data.brandIds) : null,
    data.liveAccount ?? null,
    data.lineGroupId ?? null,
    data.isRecurring ?? false,
    data.recurringPattern ?? null,
    data.recurringEndDate ?? null,
    data.parentScheduleId ?? null,
    data.status ?? "scheduled",
    data.notes ?? null,
    data.createdBy ?? null,
    data.createdByLineUserId ?? null,
    data.reminderEnabled ?? true,
    data.reminderMinutesBefore ?? 30,
    data.reminderSentAt ?? null,
    data.scheduleGroupId ?? null,
    data.locationId ?? null,
  ];
}

export async function tryCreateApprovedBrandSchedule(data: InsertSchedule): Promise<{ id: number } & InsertSchedule | null> {
  const brandIds = scheduleBrandIds(data);
  if (brandIds.length === 0) return null;
  if (data.isRecurring || data.recurringPattern || data.recurringEndDate || data.parentScheduleId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "品牌直播不能使用重复排班；每一场都必须单独提交并取得KG确认" });
  }
  await ensureBrandLiveApprovalReady();
  const connection = await pool().getConnection();
  await connection.beginTransaction();
  try {
    await assertBusinessScheduleActor(connection, data.createdBy);
    for (const brandId of brandIds) await findApproval(connection, brandId, data);
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO schedules
       (title,description,startTime,endTime,isAllDay,category,liverId,liverName,brandId,brandIds,liveAccount,lineGroupId,isRecurring,recurringPattern,recurringEndDate,parentScheduleId,status,notes,createdBy,createdByLineUserId,reminderEnabled,reminderMinutesBefore,reminderSentAt,scheduleGroupId,locationId)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      scheduleInsertValues(data),
    );
    const id = Number(result.insertId);
    await assertPersistedScheduleMatches(connection, id, data);
    await linkApprovals(connection, id, brandIds, data);
    await connection.commit();
    return { id, ...data };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mergedSchedule(current: RowDataPacket, data: Partial<InsertSchedule>) {
  return {
    startTime: data.startTime ?? current.startTime,
    endTime: data.endTime === undefined ? current.endTime : data.endTime,
    liverId: data.liverId === undefined ? current.liverId : data.liverId,
    liverName: data.liverName === undefined ? current.liverName : data.liverName,
    liveAccount: data.liveAccount === undefined ? current.liveAccount : data.liveAccount,
    brandId: data.brandId === undefined ? current.brandId : data.brandId,
    brandIds: data.brandIds === undefined ? parseBrandIds(current.brandIds, current.brandId) : data.brandIds,
    createdBy: current.createdBy == null ? null : Number(current.createdBy),
  };
}

function approvalSensitiveChanged(current: RowDataPacket, next: ReturnType<typeof mergedSchedule>): boolean {
  const currentBrands = parseBrandIds(current.brandIds, current.brandId);
  const nextBrands = scheduleBrandIds(next);
  return JSON.stringify(currentBrands) !== JSON.stringify(nextBrands)
    || !sameDate(current.startTime, next.startTime)
    || !sameDate(current.endTime, next.endTime)
    || Number(current.liverId || 0) !== Number(next.liverId || 0)
    || normalizeLiverIdentity(current.liverName) !== normalizeLiverIdentity(next.liverName)
    || normalizeLiverIdentity(current.liveAccount) !== normalizeLiverIdentity(next.liveAccount);
}

const UPDATE_COLUMNS: Record<string, string> = {
  title: "title", description: "description", startTime: "startTime", endTime: "endTime", isAllDay: "isAllDay", category: "category",
  liverId: "liverId", liverName: "liverName", brandId: "brandId", brandIds: "brandIds", liveAccount: "liveAccount", lineGroupId: "lineGroupId",
  isRecurring: "isRecurring", recurringPattern: "recurringPattern", recurringEndDate: "recurringEndDate", parentScheduleId: "parentScheduleId",
  status: "status", notes: "notes", reminderEnabled: "reminderEnabled", reminderMinutesBefore: "reminderMinutesBefore",
  reminderSentAt: "reminderSentAt", scheduleGroupId: "scheduleGroupId", locationId: "locationId",
};

async function rawUpdateSchedule(connection: PoolConnection, id: number, data: Partial<InsertSchedule>) {
  const entries = Object.entries(data).filter(([key]) => UPDATE_COLUMNS[key]);
  if (entries.length === 0) return;
  const sqlParts = entries.map(([key]) => `\`${UPDATE_COLUMNS[key]}\`=?`);
  const values = entries.map(([key, value]) => {
    if (key === "brandIds" && value != null) return JSON.stringify(value);
    if (key === "startTime" || key === "endTime") return asDate(value);
    return value ?? null;
  });
  await connection.query(`UPDATE schedules SET ${sqlParts.join(",")},updatedAt=CURRENT_TIMESTAMP WHERE id=?`, [...values, id]);
}

export async function tryUpdateApprovedBrandSchedule(id: number, data: Partial<InsertSchedule>, actorUserId?: number | null): Promise<boolean> {
  const [preflightRows] = await pool().query<RowDataPacket[]>("SELECT * FROM schedules WHERE id=? LIMIT 1", [id]);
  const preflight = preflightRows[0];
  if (!preflight) throw new TRPCError({ code: "NOT_FOUND", message: "排班不存在" });
  const preflightNext = mergedSchedule(preflight, data);
  if (parseBrandIds(preflight.brandIds, preflight.brandId).length === 0 && scheduleBrandIds(preflightNext).length === 0) return false;
  if (data.status === "cancelled") return await tryCancelApprovedBrandSchedule(id, actorUserId);
  const restoringCancelled = preflight.status === "cancelled" && data.status === "scheduled";
  await ensureBrandLiveApprovalReady();
  const connection = await pool().getConnection();
  await connection.beginTransaction();
  try {
    await assertBusinessScheduleActor(connection, actorUserId);
    const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM schedules WHERE id=? LIMIT 1 FOR UPDATE", [id]);
    const current = rows[0];
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "排班不存在" });
    const currentBrands = parseBrandIds(current.brandIds, current.brandId);
    const next = mergedSchedule(current, data);
    const nextBrands = scheduleBrandIds(next);
    if (currentBrands.length === 0 && nextBrands.length === 0) {
      await connection.rollback();
      return false;
    }
    if (currentBrands.length > 0 && nextBrands.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "已确认的品牌直播不能通过移除品牌绕过审批；请取消后重新申请" });
    if (approvalSensitiveChanged(current, next)) {
      const [links] = await connection.query<RowDataPacket[]>(
        `SELECT link.*,approval.* FROM brand_live_approval_schedule_links link JOIN brand_live_approvals approval ON approval.id=link.approvalId WHERE link.scheduleId=? AND link.isActive=1 FOR UPDATE`,
        [id],
      );
      const releaseActorName = await actorName(connection, actorUserId);
      for (const link of links) {
        await appendScheduleEvent(connection, link, "schedule_cancelled", id, actorUserId, releaseActorName);
        await connection.query("UPDATE brand_live_approvals SET status='cancelled',revision=revision+1 WHERE id=? AND status='scheduled'", [link.approvalId]);
      }
      await connection.query(
        "UPDATE brand_live_approval_schedule_links SET isActive=0,unlinkedBy=?,unlinkedByName=?,unlinkedAt=CURRENT_TIMESTAMP(3) WHERE scheduleId=? AND isActive=1",
        [actorUserId, releaseActorName, id],
      );
      for (const brandId of nextBrands) await findApproval(connection, brandId, next);
      await rawUpdateSchedule(connection, id, data);
      await assertPersistedScheduleMatches(connection, id, next);
      await linkApprovals(connection, id, nextBrands, { ...next, createdBy: actorUserId || null });
    } else {
      await rawUpdateSchedule(connection, id, data);
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function tryCancelApprovedBrandSchedule(id: number, actorUserId?: number | null): Promise<boolean> {
  const [preflightRows] = await pool().query<RowDataPacket[]>("SELECT brandId,brandIds FROM schedules WHERE id=? LIMIT 1", [id]);
  const preflight = preflightRows[0];
  if (!preflight) throw new TRPCError({ code: "NOT_FOUND", message: "排班不存在" });
  if (parseBrandIds(preflight.brandIds, preflight.brandId).length === 0) return false;
  await ensureBrandLiveApprovalReady();
  const connection = await pool().getConnection();
  await connection.beginTransaction();
  try {
    await assertBusinessScheduleActor(connection, actorUserId);
    const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM schedules WHERE id=? LIMIT 1 FOR UPDATE", [id]);
    const current = rows[0];
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "排班不存在" });
    if (parseBrandIds(current.brandIds, current.brandId).length === 0) {
      await connection.rollback();
      return false;
    }
    const [links] = await connection.query<RowDataPacket[]>(
      `SELECT link.*,approval.* FROM brand_live_approval_schedule_links link JOIN brand_live_approvals approval ON approval.id=link.approvalId WHERE link.scheduleId=? AND link.isActive=1 FOR UPDATE`,
      [id],
    );
    const userName = await actorName(connection, actorUserId);
    for (const link of links) {
      await connection.query("UPDATE brand_live_approvals SET status='cancelled',revision=revision+1 WHERE id=? AND status='scheduled'", [link.approvalId]);
      await appendScheduleEvent(connection, link, "schedule_cancelled", id, actorUserId, userName);
    }
    await connection.query(
      "UPDATE brand_live_approval_schedule_links SET isActive=0,unlinkedBy=?,unlinkedByName=?,unlinkedAt=CURRENT_TIMESTAMP(3) WHERE scheduleId=? AND isActive=1",
      [actorUserId, userName, id],
    );
    await connection.query("UPDATE schedules SET status='cancelled',updatedAt=CURRENT_TIMESTAMP WHERE id=?", [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assertRecurringBrandUpdateSafe(parentScheduleId: number, _data: Partial<InsertSchedule>, actorUserId?: number | null): Promise<void> {
  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT brandId,brandIds FROM schedules WHERE (id=? OR parentScheduleId=?) AND status<>'cancelled'",
    [parentScheduleId, parentScheduleId],
  );
  if (!rows.some(row => parseBrandIds(row.brandIds, row.brandId).length > 0)) return;
  await ensureBrandLiveApprovalReady();
  const connection = await pool().getConnection();
  try {
    await assertBusinessScheduleActor(connection, actorUserId);
  } finally {
    connection.release();
  }
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "品牌直播不能批量修改重复排班；每一场都必须单独提交并取得KG确认" });
}

export async function cancelRecurringBrandSchedules(parentScheduleId: number, actorUserId?: number | null): Promise<boolean> {
  const [preflightRows] = await pool().query<RowDataPacket[]>(
    "SELECT id,brandId,brandIds FROM schedules WHERE (id=? OR parentScheduleId=?) AND status<>'cancelled'",
    [parentScheduleId, parentScheduleId],
  );
  const branded = preflightRows.filter(row => parseBrandIds(row.brandIds, row.brandId).length > 0);
  if (branded.length === 0) return false;
  await ensureBrandLiveApprovalReady();
  const connection = await pool().getConnection();
  await connection.beginTransaction();
  try {
    await assertBusinessScheduleActor(connection, actorUserId);
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM schedules WHERE (id=? OR parentScheduleId=?) AND status<>'cancelled' ORDER BY id FOR UPDATE",
      [parentScheduleId, parentScheduleId],
    );
    const ids = rows.map(row => Number(row.id));
    if (ids.length === 0) {
      await connection.rollback();
      return true;
    }
    const placeholders = ids.map(() => "?").join(",");
    const [links] = await connection.query<RowDataPacket[]>(
      `SELECT link.*,approval.*
         FROM brand_live_approval_schedule_links link
         JOIN brand_live_approvals approval ON approval.id=link.approvalId
        WHERE link.scheduleId IN (${placeholders}) AND link.isActive=1
        ORDER BY link.scheduleId,link.id FOR UPDATE`,
      ids,
    );
    const userName = await actorName(connection, actorUserId);
    for (const link of links) {
      await connection.query("UPDATE brand_live_approvals SET status='cancelled',revision=revision+1 WHERE id=? AND status='scheduled'", [link.approvalId]);
      await appendScheduleEvent(connection, link, "schedule_cancelled", Number(link.scheduleId), actorUserId, userName);
    }
    await connection.query(
      `UPDATE brand_live_approval_schedule_links
          SET isActive=0,unlinkedBy=?,unlinkedByName=?,unlinkedAt=CURRENT_TIMESTAMP(3)
        WHERE scheduleId IN (${placeholders}) AND isActive=1`,
      [actorUserId, userName, ...ids],
    );
    await connection.query(`UPDATE schedules SET status='cancelled',updatedAt=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, ids);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
