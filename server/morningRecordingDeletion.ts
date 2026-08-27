import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { morningMeetings, morningPrincipleRecitations } from "../drizzle/schema";
import { getDb } from "./db";

export type MorningRecordingDeleteActor = {
  id: number;
  role: string;
  name: string;
};

export type MorningRecordingDeleteInput = {
  source: "daily" | "meeting";
  id: number;
  actor: MorningRecordingDeleteActor;
  ownTargetKey: string | null;
  reason?: string;
};

function safePersonalSnapshot(record: any) {
  return {
    id: Number(record.id),
    date: record.date,
    recordingType: record.recordingType,
    targetKey: record.targetKey,
    userId: Number(record.userId),
    staffId: record.staffId == null ? null : Number(record.staffId),
    language: record.language,
    durationSeconds: Number(record.durationSeconds || 0),
    minimumRequiredSeconds: record.minimumRequiredSeconds == null ? null : Number(record.minimumRequiredSeconds),
    status: record.status,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
  };
}

function safeMeetingSnapshot(record: any) {
  return {
    id: Number(record.id),
    date: record.date,
    recordingKind: record.recordingKind,
    teamCode: record.teamCode,
    createdBy: record.createdBy == null ? null : Number(record.createdBy),
    language: record.language,
    durationSeconds: record.durationSeconds == null ? null : Number(record.durationSeconds),
    minimumRequiredSeconds: record.minimumRequiredSeconds == null ? null : Number(record.minimumRequiredSeconds),
    participantCount: Number(record.participantCount || 0),
    status: record.status,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
  };
}

async function writeDeleteEvent(
  tx: any,
  input: MorningRecordingDeleteInput,
  entityType: "morning_principle_recitation" | "morning_meeting",
  before: Record<string, unknown>,
) {
  const reason = String(input.reason || "morning-meeting-ui-delete").trim().slice(0, 500);
  await tx.execute(sql`
    INSERT INTO manual_data_change_events
      (entityType, entityId, action, changedFields, beforeJson, afterJson, actorId, actorName, source)
    VALUES (
      ${entityType}, ${input.id}, 'delete', ${JSON.stringify(["deleted", "reason"])},
      ${JSON.stringify({ ...before, deleteReason: reason })}, NULL,
      ${input.actor.id}, ${input.actor.name.slice(0, 255)}, 'morning-meeting-ui'
    )
  `);
}

export async function deleteMorningRecordingWithDb(db: any, input: MorningRecordingDeleteInput): Promise<{ success: true; source: "daily" | "meeting"; id: number }> {
  return await db.transaction(async (tx: any) => {
    if (input.source === "daily") {
      const rows = await tx.select().from(morningPrincipleRecitations)
        .where(eq(morningPrincipleRecitations.id, input.id)).limit(1);
      const record = rows[0];
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "録音記録が見つかりません" });
      const ownsRecord = Number(record.userId) === input.actor.id
        || Boolean(input.ownTargetKey && record.targetKey === input.ownTargetKey);
      if (input.actor.role !== "admin" && !ownsRecord) {
        throw new TRPCError({ code: "FORBIDDEN", message: "この録音を削除する権限がありません" });
      }
      await writeDeleteEvent(tx, input, "morning_principle_recitation", safePersonalSnapshot(record));
      await tx.delete(morningPrincipleRecitations).where(eq(morningPrincipleRecitations.id, input.id));
      return { success: true as const, source: input.source, id: input.id };
    }

    const rows = await tx.select().from(morningMeetings)
      .where(eq(morningMeetings.id, input.id)).limit(1);
    const record = rows[0];
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "朝会記録が見つかりません" });
    if (input.actor.role !== "admin" && Number(record.createdBy) !== input.actor.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "この朝会記録を削除する権限がありません" });
    }
    await writeDeleteEvent(tx, input, "morning_meeting", safeMeetingSnapshot(record));
    await tx.delete(morningMeetings).where(eq(morningMeetings.id, input.id));
    return { success: true as const, source: input.source, id: input.id };
  });
}

export async function deleteMorningRecording(input: MorningRecordingDeleteInput) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
  return await deleteMorningRecordingWithDb(db, input);
}
