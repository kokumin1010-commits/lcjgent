import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { reportStaff, staff, type InsertReportStaff, type InsertStaff } from "../drizzle/schema";

export type ManualActor = { id: number; name: string };

type JsonRecord = Record<string, unknown>;

function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function changedFields(before: JsonRecord | null, after: JsonRecord): string[] {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(jsonSafe(before?.[key])) !== JSON.stringify(jsonSafe(after[key])));
}

async function writeEvent(
  tx: any,
  input: {
    entityType: "staff" | "report_staff";
    entityId: number;
    action: "create" | "update" | "archive" | "restore";
    before: JsonRecord | null;
    after: JsonRecord;
    actor: ManualActor;
  },
): Promise<void> {
  const fields = changedFields(input.before, input.after).filter((field) => !["updatedAt", "manualRevisionAt"].includes(field));
  await tx.execute(sql`
    INSERT INTO manual_data_change_events
      (entityType, entityId, action, changedFields, beforeJson, afterJson, actorId, actorName, source)
    VALUES (
      ${input.entityType}, ${input.entityId}, ${input.action}, ${JSON.stringify(fields)},
      ${input.before ? JSON.stringify(jsonSafe(input.before)) : null},
      ${JSON.stringify(jsonSafe(input.after))}, ${input.actor.id}, ${input.actor.name.slice(0, 255)}, 'ui'
    )
  `);
}

async function requireOneStaff(tx: any, id: number): Promise<JsonRecord> {
  const rows = await tx.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!rows[0]) throw new Error(`staff not found: ${id}`);
  return rows[0] as JsonRecord;
}

async function requireOneReportStaff(tx: any, id: number, includeArchived = false): Promise<JsonRecord> {
  const rows = await tx.select().from(reportStaff).where(eq(reportStaff.id, id)).limit(1);
  if (!rows[0]) throw new Error(`report_staff not found: ${id}`);
  if (!includeArchived && rows[0].archivedAt) throw new Error(`report_staff is archived: ${id}`);
  return rows[0] as JsonRecord;
}

export async function createStaffAndReportProfile(input: {
  staffData: InsertStaff;
  actor: ManualActor;
}): Promise<{ staffId: number; reportStaffId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx) => {
    const now = new Date();
    const [staffInserted] = await tx.insert(staff).values({
      ...input.staffData,
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).$returningId();
    const staffId = Number(staffInserted?.id || 0);
    if (!staffId) throw new Error("staff insert id is missing");
    const reportName = String(input.staffData.name || "").trim();
    const [reportInserted] = await tx.insert(reportStaff).values({
      name: reportName,
      country: String(input.staffData.country || "未確認"),
      linkedStaffId: staffId,
      isActive: input.staffData.isActive || "active",
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).$returningId();
    const reportStaffId = Number(reportInserted?.id || 0);
    if (!reportStaffId) throw new Error("report_staff insert id is missing");
    const staffAfter = await requireOneStaff(tx, staffId);
    const reportAfter = await requireOneReportStaff(tx, reportStaffId);
    await writeEvent(tx, { entityType: "staff", entityId: staffId, action: "create", before: null, after: staffAfter, actor: input.actor });
    await writeEvent(tx, { entityType: "report_staff", entityId: reportStaffId, action: "create", before: null, after: reportAfter, actor: input.actor });
    return { staffId, reportStaffId };
  });
}

export async function updateStaffAndLinkedReportProfile(input: {
  staffId: number;
  staffData: Partial<InsertStaff>;
  actor: ManualActor;
}): Promise<{ staffId: number; reportStaffId: number | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx) => {
    const before = await requireOneStaff(tx, input.staffId);
    const linkedRows = await tx.select().from(reportStaff).where(eq(reportStaff.linkedStaffId, input.staffId));
    if (linkedRows.length > 1) throw new Error(`multiple report_staff rows linked to staff:${input.staffId}`);
    const now = new Date();
    await tx.update(staff).set({
      ...input.staffData,
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).where(eq(staff.id, input.staffId));
    const after = await requireOneStaff(tx, input.staffId);
    await writeEvent(tx, { entityType: "staff", entityId: input.staffId, action: "update", before, after, actor: input.actor });

    let reportStaffId: number | null = null;
    if (linkedRows[0]) {
      reportStaffId = Number(linkedRows[0].id);
      const shared: Partial<InsertReportStaff> = {};
      if (input.staffData.name !== undefined) shared.name = String(input.staffData.name);
      if (input.staffData.country !== undefined) shared.country = String(input.staffData.country || "未確認");
      if (input.staffData.isActive !== undefined) shared.isActive = input.staffData.isActive;
      if (Object.keys(shared).length > 0) {
        const reportBefore = linkedRows[0] as unknown as JsonRecord;
        await tx.update(reportStaff).set({
          ...shared,
          manualRevisionAt: now,
          manualRevisionBy: input.actor.id,
        }).where(eq(reportStaff.id, reportStaffId));
        const reportAfter = await requireOneReportStaff(tx, reportStaffId);
        await writeEvent(tx, { entityType: "report_staff", entityId: reportStaffId, action: "update", before: reportBefore, after: reportAfter, actor: input.actor });
      }
    }
    return { staffId: input.staffId, reportStaffId };
  });
}

export async function createReportProfileWithOptionalStaff(input: {
  reportData: InsertReportStaff;
  actor: ManualActor;
}): Promise<JsonRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx) => {
    const now = new Date();
    let linkedStaffId = input.reportData.linkedStaffId || null;
    if (linkedStaffId) await requireOneStaff(tx, linkedStaffId);
    if (!linkedStaffId) {
      const placeholderEmail = `${String(input.reportData.name).toLowerCase().replace(/[\s\u3000]+/g, ".")}@lcj.placeholder`;
      const [staffInserted] = await tx.insert(staff).values({
        name: input.reportData.name,
        email: placeholderEmail,
        country: input.reportData.country,
        emailEvidenceStatus: "unverified",
        isActive: input.reportData.isActive || "active",
        manualRevisionAt: now,
        manualRevisionBy: input.actor.id,
      }).$returningId();
      linkedStaffId = Number(staffInserted?.id || 0) || null;
      if (!linkedStaffId) throw new Error("staff insert id is missing");
      const staffAfter = await requireOneStaff(tx, linkedStaffId);
      await writeEvent(tx, { entityType: "staff", entityId: linkedStaffId, action: "create", before: null, after: staffAfter, actor: input.actor });
    }
    const [reportInserted] = await tx.insert(reportStaff).values({
      ...input.reportData,
      linkedStaffId,
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).$returningId();
    const reportStaffId = Number(reportInserted?.id || 0);
    if (!reportStaffId) throw new Error("report_staff insert id is missing");
    const after = await requireOneReportStaff(tx, reportStaffId);
    await writeEvent(tx, { entityType: "report_staff", entityId: reportStaffId, action: "create", before: null, after, actor: input.actor });
    return after;
  });
}

export async function updateReportProfileAndLinkedStaff(input: {
  reportStaffId: number;
  reportData: Partial<InsertReportStaff>;
  actor: ManualActor;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const before = await requireOneReportStaff(tx, input.reportStaffId);
    const linkedStaffId = input.reportData.linkedStaffId === undefined
      ? Number(before.linkedStaffId || 0) || null
      : input.reportData.linkedStaffId || null;
    if (linkedStaffId) await requireOneStaff(tx, linkedStaffId);
    const now = new Date();
    await tx.update(reportStaff).set({
      ...input.reportData,
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).where(eq(reportStaff.id, input.reportStaffId));
    const after = await requireOneReportStaff(tx, input.reportStaffId);
    await writeEvent(tx, { entityType: "report_staff", entityId: input.reportStaffId, action: "update", before, after, actor: input.actor });

    if (linkedStaffId) {
      const staffBefore = await requireOneStaff(tx, linkedStaffId);
      const shared: Partial<InsertStaff> = {};
      if (input.reportData.name !== undefined) shared.name = input.reportData.name;
      if (input.reportData.country !== undefined) shared.country = input.reportData.country;
      if (input.reportData.isActive !== undefined) shared.isActive = input.reportData.isActive;
      if (Object.keys(shared).length > 0) {
        await tx.update(staff).set({
          ...shared,
          manualRevisionAt: now,
          manualRevisionBy: input.actor.id,
        }).where(eq(staff.id, linkedStaffId));
        const staffAfter = await requireOneStaff(tx, linkedStaffId);
        await writeEvent(tx, { entityType: "staff", entityId: linkedStaffId, action: "update", before: staffBefore, after: staffAfter, actor: input.actor });
      }
    }
  });
}

export type ArchiveReportProfileInput = {
  reportStaffId: number;
  actor: ManualActor;
  archiveReason?: string;
};

export async function archiveReportProfileWithDb(
  db: any,
  input: ArchiveReportProfileInput,
): Promise<{ reportStaffId: number; archived: boolean }> {
  return await db.transaction(async (tx: any) => {
    const before = await requireOneReportStaff(tx, input.reportStaffId, true);
    if (before.archivedAt) return { reportStaffId: input.reportStaffId, archived: false };
    const now = new Date();
    await tx.update(reportStaff).set({
      archivedAt: now,
      archivedBy: input.actor.id,
      archiveReason: input.archiveReason?.trim() || "レポートスタッフ管理画面から削除",
      isActive: "inactive",
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).where(eq(reportStaff.id, input.reportStaffId));
    const after = await requireOneReportStaff(tx, input.reportStaffId, true);
    await writeEvent(tx, {
      entityType: "report_staff",
      entityId: input.reportStaffId,
      action: "archive",
      before,
      after,
      actor: input.actor,
    });
    return { reportStaffId: input.reportStaffId, archived: true };
  });
}

export async function archiveReportProfile(
  input: ArchiveReportProfileInput,
): Promise<{ reportStaffId: number; archived: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await archiveReportProfileWithDb(db, input);
}

export async function restoreReportProfile(input: {
  reportStaffId: number;
  actor: ManualActor;
}): Promise<{ reportStaffId: number; restored: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx) => {
    const before = await requireOneReportStaff(tx, input.reportStaffId, true);
    if (!before.archivedAt) return { reportStaffId: input.reportStaffId, restored: false };
    const now = new Date();
    await tx.update(reportStaff).set({
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      isActive: "active",
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).where(eq(reportStaff.id, input.reportStaffId));
    const after = await requireOneReportStaff(tx, input.reportStaffId, true);
    await writeEvent(tx, {
      entityType: "report_staff",
      entityId: input.reportStaffId,
      action: "restore",
      before,
      after,
      actor: input.actor,
    });
    return { reportStaffId: input.reportStaffId, restored: true };
  });
}

export async function createStaffFromExistingReportProfile(input: {
  reportStaffId: number;
  staffData: Partial<InsertStaff> & { email: string };
  actor: ManualActor;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.staffData.email || input.staffData.email.endsWith("@lcj.placeholder")) {
    throw new Error("確認済みメールアドレスが必要です");
  }
  return await db.transaction(async (tx) => {
    const reportBefore = await requireOneReportStaff(tx, input.reportStaffId);
    if (reportBefore.linkedStaffId) throw new Error("この報告社員は既に人事社員へ紐付いています");
    const now = new Date();
    const [staffInserted] = await tx.insert(staff).values({
      name: String(reportBefore.name),
      email: input.staffData.email,
      country: String(reportBefore.country || "未確認"),
      ...input.staffData,
      emailEvidenceStatus: "verified",
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).$returningId();
    const staffId = Number(staffInserted?.id || 0);
    if (!staffId) throw new Error("staff insert id is missing");
    await tx.update(reportStaff).set({
      linkedStaffId: staffId,
      manualRevisionAt: now,
      manualRevisionBy: input.actor.id,
    }).where(eq(reportStaff.id, input.reportStaffId));
    const staffAfter = await requireOneStaff(tx, staffId);
    const reportAfter = await requireOneReportStaff(tx, input.reportStaffId);
    await writeEvent(tx, { entityType: "staff", entityId: staffId, action: "create", before: null, after: staffAfter, actor: input.actor });
    await writeEvent(tx, { entityType: "report_staff", entityId: input.reportStaffId, action: "update", before: reportBefore, after: reportAfter, actor: input.actor });
    return staffId;
  });
}
