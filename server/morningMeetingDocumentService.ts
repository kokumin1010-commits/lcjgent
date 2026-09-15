import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  morningMeetingDocuments,
  morningMeetings,
  staff,
} from "../drizzle/schema";
import { createActivityLog, getDb } from "./db";
import { storageDelete, storageGet } from "./storage";
import { currentStaffCondition } from "./staffIdentityQuery";
import { staffCountryToTeamCode, type TeamMeetingCode } from "./teamMorningMeetingPolicy";

export const MORNING_MEETING_DOCUMENTS_PER_TEAM_DAY = 10;

type MorningMeetingDocumentActor = {
  id: number;
  role: string;
  name?: string | null;
  email: string;
};

export type MorningMeetingDocumentCreateInput = {
  date: string;
  teamCode: TeamMeetingCode;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  extractedText: string;
  extractedChars: number;
  textTruncated: boolean;
};

let tableReady: Promise<void> | null = null;

export async function ensureMorningMeetingDocumentsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS morning_meeting_documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date VARCHAR(10) NOT NULL,
          teamCode VARCHAR(16) NOT NULL,
          meetingId INT NULL,
          fileName VARCHAR(512) NOT NULL,
          storageKey VARCHAR(500) NOT NULL,
          mimeType VARCHAR(128) NOT NULL,
          fileSize INT NOT NULL,
          sha256 VARCHAR(64) NOT NULL,
          extractedText MEDIUMTEXT NOT NULL,
          extractedChars INT NOT NULL DEFAULT 0,
          textTruncated BOOLEAN NOT NULL DEFAULT FALSE,
          createdBy INT NOT NULL,
          createdByName VARCHAR(255) NOT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_morning_meeting_document (date, teamCode, sha256),
          INDEX idx_morning_meeting_document_date_team (date, teamCode),
          INDEX idx_morning_meeting_document_meeting (meetingId)
        )
      `);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

function validateDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "[MORNING-DOCUMENT-DATE] 日期格式不正确" });
  }
  return date;
}

async function actorTeamCode(actor: MorningMeetingDocumentActor): Promise<TeamMeetingCode | null> {
  if (actor.role === "admin") return null;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
  const [member] = await db.select({ country: staff.country })
    .from(staff)
    .where(and(eq(staff.email, actor.email), currentStaffCondition()))
    .orderBy(asc(staff.id))
    .limit(1);
  return staffCountryToTeamCode(member?.country || null);
}

export function isMorningMeetingDocumentTeamAllowed(
  role: string,
  ownTeam: TeamMeetingCode | null,
  targetTeam: TeamMeetingCode,
): boolean {
  return role === "admin" || ownTeam === targetTeam;
}

export async function requireMorningMeetingDocumentTeamAccess(
  actor: MorningMeetingDocumentActor,
  teamCode: TeamMeetingCode,
): Promise<void> {
  const ownTeam = actor.role === "admin" ? null : await actorTeamCode(actor);
  if (!isMorningMeetingDocumentTeamAllowed(actor.role, ownTeam, teamCode)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "[MORNING-DOCUMENT-FORBIDDEN] 只能管理本人所属团队的早会资料" });
  }
}

function metadataSelection() {
  return {
    id: morningMeetingDocuments.id,
    date: morningMeetingDocuments.date,
    teamCode: morningMeetingDocuments.teamCode,
    meetingId: morningMeetingDocuments.meetingId,
    associationType: sql<"recording" | "standalone">`CASE WHEN ${morningMeetingDocuments.meetingId} IS NULL THEN 'standalone' ELSE 'recording' END`,
    fileName: morningMeetingDocuments.fileName,
    mimeType: morningMeetingDocuments.mimeType,
    fileSize: morningMeetingDocuments.fileSize,
    sha256: morningMeetingDocuments.sha256,
    extractedChars: morningMeetingDocuments.extractedChars,
    textTruncated: morningMeetingDocuments.textTruncated,
    createdBy: morningMeetingDocuments.createdBy,
    createdByName: morningMeetingDocuments.createdByName,
    createdAt: morningMeetingDocuments.createdAt,
    previewText: sql<string>`LEFT(${morningMeetingDocuments.extractedText}, 1200)`,
  };
}

export async function linkMorningMeetingDocumentsToMeeting(input: {
  date: string;
  teamCode: TeamMeetingCode;
  meetingId: number;
}): Promise<void> {
  await ensureMorningMeetingDocumentsTable();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
  const date = validateDate(input.date);
  await db.update(morningMeetingDocuments)
    .set({ meetingId: input.meetingId })
    .where(and(
      eq(morningMeetingDocuments.date, date),
      eq(morningMeetingDocuments.teamCode, input.teamCode),
    ));
}

export async function saveMorningMeetingDocumentForUser(
  actor: MorningMeetingDocumentActor,
  input: MorningMeetingDocumentCreateInput,
) {
  await ensureMorningMeetingDocumentsTable();
  await requireMorningMeetingDocumentTeamAccess(actor, input.teamCode);
  const date = validateDate(input.date);
  if (!input.storageKey.startsWith(`morning-meeting-documents/user-${actor.id}/`)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "[MORNING-DOCUMENT-STORAGE] 文件保存路径不正确" });
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });

  const [countRow] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(morningMeetingDocuments)
    .where(and(eq(morningMeetingDocuments.date, date), eq(morningMeetingDocuments.teamCode, input.teamCode)));
  if (Number(countRow?.count || 0) >= MORNING_MEETING_DOCUMENTS_PER_TEAM_DAY) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "[MORNING-DOCUMENT-LIMIT] 每个团队每天最多导入10份资料" });
  }

  const [duplicate] = await db.select({ id: morningMeetingDocuments.id })
    .from(morningMeetingDocuments)
    .where(and(
      eq(morningMeetingDocuments.date, date),
      eq(morningMeetingDocuments.teamCode, input.teamCode),
      eq(morningMeetingDocuments.sha256, input.sha256),
    ))
    .limit(1);
  if (duplicate) {
    throw new TRPCError({ code: "CONFLICT", message: "[MORNING-DOCUMENT-DUPLICATE] 该团队当天已经导入过同一份资料" });
  }

  const [meeting] = await db.select({ id: morningMeetings.id })
    .from(morningMeetings)
    .where(and(
      eq(morningMeetings.date, date),
      eq(morningMeetings.recordingKind, "daily_team"),
      eq(morningMeetings.teamCode, input.teamCode),
    ))
    .orderBy(desc(morningMeetings.createdAt))
    .limit(1);

  const result = await db.insert(morningMeetingDocuments).values({
    date,
    teamCode: input.teamCode,
    meetingId: meeting?.id || null,
    fileName: input.fileName,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    sha256: input.sha256,
    extractedText: input.extractedText,
    extractedChars: input.extractedChars,
    textTruncated: input.textTruncated,
    createdBy: actor.id,
    createdByName: actor.name || actor.email,
  });
  const documentId = Number(result[0].insertId);
  const [record] = await db.select(metadataSelection())
    .from(morningMeetingDocuments)
    .where(eq(morningMeetingDocuments.id, documentId))
    .limit(1);

  await createActivityLog({
    userId: actor.id,
    actionType: "morning_meeting_document_uploaded",
    actionLabel: "早会资料已导入",
    targetType: "morning_meeting_document",
    targetId: documentId,
    targetName: `${date}:${input.teamCode}`,
    metadata: {
      teamCode: input.teamCode,
      date,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      extractedChars: input.extractedChars,
      textTruncated: input.textTruncated,
      sha256Prefix: input.sha256.slice(0, 12),
      associationType: meeting?.id ? "recording" : "standalone",
      affectsTranscript: false,
      affectsFormalSummary: false,
    },
  }).catch(() => undefined);

  return { ...record, canDelete: true };
}

export async function listMorningMeetingDocumentsForUser(
  actor: MorningMeetingDocumentActor,
  input: {
    teamCode?: TeamMeetingCode;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit: number;
    offset: number;
  },
) {
  await ensureMorningMeetingDocumentsTable();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
  const conditions = [];
  const ownTeam = await actorTeamCode(actor);
  if (actor.role !== "admin") {
    if (!ownTeam) throw new TRPCError({ code: "FORBIDDEN", message: "[MORNING-DOCUMENT-FORBIDDEN] 所属团队未设置" });
    if (input.teamCode && input.teamCode !== ownTeam) {
      throw new TRPCError({ code: "FORBIDDEN", message: "[MORNING-DOCUMENT-FORBIDDEN] 无权查看其他团队资料" });
    }
    conditions.push(eq(morningMeetingDocuments.teamCode, ownTeam));
  } else if (input.teamCode) {
    conditions.push(eq(morningMeetingDocuments.teamCode, input.teamCode));
  }
  if (input.dateFrom) conditions.push(gte(morningMeetingDocuments.date, validateDate(input.dateFrom)));
  if (input.dateTo) conditions.push(lte(morningMeetingDocuments.date, validateDate(input.dateTo)));
  if (input.search?.trim()) {
    const pattern = `%${input.search.trim()}%`;
    conditions.push(sql`(${morningMeetingDocuments.fileName} LIKE ${pattern} OR ${morningMeetingDocuments.extractedText} LIKE ${pattern})`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [records, countRows] = await Promise.all([
    db.select(metadataSelection())
      .from(morningMeetingDocuments)
      .where(whereClause)
      .orderBy(desc(morningMeetingDocuments.date), desc(morningMeetingDocuments.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(morningMeetingDocuments)
      .where(whereClause),
  ]);
  return {
    records: records.map((record) => ({
      ...record,
      canDelete: actor.role === "admin" || Number(record.createdBy) === actor.id,
    })),
    total: Number(countRows[0]?.count || 0),
  };
}

async function requireDocumentAccess(
  actor: MorningMeetingDocumentActor,
  documentId: number,
) {
  await ensureMorningMeetingDocumentsTable();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
  const [record] = await db.select()
    .from(morningMeetingDocuments)
    .where(eq(morningMeetingDocuments.id, documentId))
    .limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "早会资料不存在" });
  await requireMorningMeetingDocumentTeamAccess(actor, record.teamCode as TeamMeetingCode);
  return { db, record };
}

export async function getMorningMeetingDocumentPreviewForUser(
  actor: MorningMeetingDocumentActor,
  documentId: number,
) {
  const { record } = await requireDocumentAccess(actor, documentId);
  return {
    id: record.id,
    date: record.date,
    teamCode: record.teamCode,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    extractedText: record.extractedText,
    extractedChars: record.extractedChars,
    textTruncated: record.textTruncated,
    meetingId: record.meetingId,
    associationType: record.meetingId ? "recording" as const : "standalone" as const,
    createdByName: record.createdByName,
    createdAt: record.createdAt,
    canDelete: actor.role === "admin" || Number(record.createdBy) === actor.id,
  };
}

export async function getMorningMeetingDocumentDownloadUrlForUser(
  actor: MorningMeetingDocumentActor,
  documentId: number,
) {
  const { record } = await requireDocumentAccess(actor, documentId);
  const { url } = await storageGet(record.storageKey);
  return { url, fileName: record.fileName, mimeType: record.mimeType };
}

export async function deleteMorningMeetingDocumentForUser(
  actor: MorningMeetingDocumentActor,
  documentId: number,
) {
  const { db, record } = await requireDocumentAccess(actor, documentId);
  if (actor.role !== "admin" && Number(record.createdBy) !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "[MORNING-DOCUMENT-DELETE] 只能删除自己导入的资料" });
  }
  await storageDelete(record.storageKey);
  await db.delete(morningMeetingDocuments).where(eq(morningMeetingDocuments.id, documentId));
  await createActivityLog({
    userId: actor.id,
    actionType: "morning_meeting_document_deleted",
    actionLabel: "早会资料已删除",
    targetType: "morning_meeting_document",
    targetId: documentId,
    targetName: `${record.date}:${record.teamCode}`,
    metadata: {
      teamCode: record.teamCode,
      date: record.date,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      sha256Prefix: record.sha256.slice(0, 12),
    },
  }).catch(() => undefined);
  return { success: true, id: documentId };
}
