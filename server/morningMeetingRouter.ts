/**
 * 朝会録音・文字起こし・AI要約ルーター
 * 
 * フロー:
 * 1. 録音開始 → DBにレコード作成（status: recording）
 * 2. 録音完了 → 音声をS3にアップロード
 * 3. 文字起こし → Whisper APIで音声→テキスト
 * 4. AI要約 → LLMで構造化サマリー生成
 * 5. 保存 → DBに全データ保存（status: completed）
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { morningMeetings, morningPrincipleRecitations, staff } from "../drizzle/schema";
import { eq, desc, asc, and, gte, lte, isNull, sql } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import {
  canHostTeamMeetingForTeam,
  inferLegacyTeamCode,
  isValidCompletedTeamMeeting,
  jstDateForInstant,
  personalMorningRecordingDailyKey,
  resolveTeamMeetingStartedAt,
  staffCountryToTeamCode,
  teamMeetingDailyKey,
  type TeamMeetingCode,
} from "./teamMorningMeetingPolicy";
import { deleteMorningRecording } from "./morningRecordingDeletion";
const PERSONAL_RECITATION_MAX_BYTES = 20 * 1024 * 1024;
const TEAM_MEETING_AUDIO_MAX_BYTES = 60 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a"]);
const RECORDING_TYPES = {
  principles: "principles",
  morningMeeting: "morning_meeting",
} as const;

type RecordingActor = { id: number; role: string; name?: string | null; email: string };
type RecordingTarget = {
  targetKey: string;
  userId: number;
  userName: string;
  userEmail: string;
  staffId: number | null;
  staffName: string | null;
  staffPosition: string | null;
  staffCountry: string | null;
};

function getJstDateString(): string {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function normalizeAudioMimeType(mimeType: string): string {
  return mimeType.split(";", 1)[0].trim().toLowerCase();
}

function audioExtension(mimeType: string): "webm" | "ogg" | "m4a" {
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "webm";
}

function decodeAndValidateAudio(audioBase64: string, inputMimeType: string, maxBytes: number): { buffer: Buffer; mimeType: string } {
  const dataUrlMatch = audioBase64.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  const payload = (dataUrlMatch ? dataUrlMatch[2] : audioBase64).replace(/\s+/g, "");
  const mimeType = normalizeAudioMimeType(inputMimeType);
  const embeddedMimeType = dataUrlMatch ? normalizeAudioMimeType(dataUrlMatch[1]) : null;

  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType) || (embeddedMimeType && embeddedMimeType !== mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "対応していない音声形式です" });
  }
  if (!payload || payload.length > Math.ceil(maxBytes * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "音声データが不正または大きすぎます" });
  }

  const buffer = Buffer.from(payload, "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "音声データが不正または大きすぎます" });
  }

  const isWebm = buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const isOgg = buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS";
  const isMp4 = buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  const signatureValid = mimeType === "audio/webm" ? isWebm : mimeType === "audio/ogg" ? isOgg : isMp4;
  if (!signatureValid) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "音声ファイルの実体形式が一致しません" });
  }

  return { buffer, mimeType };
}

async function resolveRecordingTarget(db: any, user: RecordingActor, requestedStaffId?: number): Promise<RecordingTarget> {
  if (requestedStaffId !== undefined && user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "他のスタッフを選択できるのは管理者だけです" });
  }

  const [staffMember] = requestedStaffId !== undefined
    ? await db.select({ id: staff.id, name: staff.name, email: staff.email, position: staff.position, country: staff.country })
      .from(staff)
      .where(and(eq(staff.id, requestedStaffId), eq(staff.isActive, "active"), isNull(staff.archivedAt)))
      .limit(1)
    : await db.select({ id: staff.id, name: staff.name, email: staff.email, position: staff.position, country: staff.country })
      .from(staff)
      .where(and(eq(staff.email, user.email), eq(staff.isActive, "active"), isNull(staff.archivedAt)))
      .limit(1);

  if (requestedStaffId !== undefined && !staffMember) {
    throw new TRPCError({ code: "NOT_FOUND", message: "選択した在職スタッフが見つかりません" });
  }

  if (staffMember) {
    const isOwnStaff = staffMember.email.toLowerCase() === user.email.toLowerCase();
    return {
      targetKey: `staff:${staffMember.id}`,
      userId: isOwnStaff ? user.id : 0,
      userName: staffMember.name,
      userEmail: staffMember.email,
      staffId: staffMember.id,
      staffName: staffMember.name,
      staffPosition: staffMember.position,
      staffCountry: staffMember.country,
    };
  }

  return {
    targetKey: `user:${user.id}`,
    userId: user.id,
    userName: user.name || user.email,
    userEmail: user.email,
    staffId: null,
    staffName: null,
    staffPosition: null,
    staffCountry: null,
  };
}

function requireHostTeamAccess(user: RecordingActor, host: RecordingTarget, teamCode: TeamMeetingCode) {
  if (!canHostTeamMeetingForTeam(user.role, host.staffCountry, teamCode)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "本人所属チーム以外の朝会は登録できません" });
  }
}

async function requireDailyRecordingAccess(db: any, recordingId: number, user: RecordingActor) {
  const [record] = await db.select({
    id: morningPrincipleRecitations.id,
    userId: morningPrincipleRecitations.userId,
    targetKey: morningPrincipleRecitations.targetKey,
    audioKey: morningPrincipleRecitations.audioKey,
  })
    .from(morningPrincipleRecitations)
    .where(eq(morningPrincipleRecitations.id, recordingId))
    .limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "録音記録が見つかりません" });
  if (user.role !== "admin") {
    const ownTarget = await resolveRecordingTarget(db, user);
    if (record.userId !== user.id && record.targetKey !== ownTarget.targetKey) {
      throw new TRPCError({ code: "FORBIDDEN", message: "この音声を再生する権限がありません" });
    }
  }
  return record;
}

async function requireMeetingOwnerOrAdmin(db: any, meetingId: number, user: { id: number; role: string }) {
  const [meeting] = await db.select({
    id: morningMeetings.id,
    createdBy: morningMeetings.createdBy,
    recordingKind: morningMeetings.recordingKind,
    durationSeconds: morningMeetings.durationSeconds,
    language: morningMeetings.language,
  })
    .from(morningMeetings)
    .where(eq(morningMeetings.id, meetingId))
    .limit(1);
  if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "朝会記録が見つかりません" });
  if (user.role !== "admin" && meeting.createdBy !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "この朝会記録を更新する権限がありません" });
  }
  return meeting;
}

export const morningMeetingRouter = router({
  // 録音開始 → DBにレコード作成
  startRecording: protectedProcedure
    .input(z.object({
      date: z.string().optional(), // YYYY-MM-DD, デフォルトは今日
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      const today = input.date || getJstDateString();
      
      const result = await db.insert(morningMeetings).values({
        date: today,
        status: "recording",
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email,
      });

      return { 
        id: Number(result[0].insertId),
        date: today,
      };
    }),

  // 旧クライアント互換。最低録音時間は廃止済みで、このAPIはDBを書き換えない。
  getTeamMeetingSettings: protectedProcedure.query(async () => ({
    minimumDurationSeconds: 0,
    updatedByName: null,
    updatedAt: null,
    canEdit: false,
    disabled: true,
  })),

  updateTeamMeetingSettings: protectedProcedure
    .input(z.object({ minimumDurationSeconds: z.number().int().min(0).max(30 * 60) }))
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "管理者のみ変更できます" });
      return { success: true, minimumDurationSeconds: 0, disabled: true };
    }),

  // 個人9条朗読を対象スタッフ名義で1日1件保存。一般社員は本人固定、管理者だけ代理登録可能。
  savePersonalRecitation: protectedProcedure
    .input(z.object({
      audioBase64: z.string().min(1).max(Math.ceil(PERSONAL_RECITATION_MAX_BYTES * 4 / 3) + 64),
      mimeType: z.string().min(1).max(100),
      durationSeconds: z.number().int().min(0).max(600),
      language: z.enum(["ja", "zh"]),
      startedAt: z.string().datetime().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      targetStaffId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = input.date || getJstDateString();
      if (ctx.user.role !== "admin" && date !== getJstDateString()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "本人は当日分のみ登録できます" });
      }
      const { buffer, mimeType } = decodeAndValidateAudio(input.audioBase64, input.mimeType, PERSONAL_RECITATION_MAX_BYTES);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const startedAt = resolveTeamMeetingStartedAt(input.startedAt, input.durationSeconds);
      if (jstDateForInstant(startedAt) !== date) {
        throw new TRPCError({ code: "BAD_REQUEST", message: input.language === "zh" ? "录音开始时间与朗读日期不一致" : "録音開始時刻と朗読日付が一致しません" });
      }
      const target = await resolveRecordingTarget(db, ctx.user, input.targetStaffId);
      const dailyKey = personalMorningRecordingDailyKey(date, target.targetKey, RECORDING_TYPES.principles);
      const [existing] = await db.select({ id: morningPrincipleRecitations.id, status: morningPrincipleRecitations.status, durationSeconds: morningPrincipleRecitations.durationSeconds })
        .from(morningPrincipleRecitations)
        .where(eq(morningPrincipleRecitations.dailyKey, dailyKey))
        .limit(1);
      if (isValidCompletedTeamMeeting(existing?.status)) {
        throw new TRPCError({ code: "CONFLICT", message: input.language === "zh" ? "该员工今天的9条朗读已完成" : "選択したスタッフの本日の9条朗読は登録済みです" });
      }

      const extension = audioExtension(mimeType);
      const fileKey = `morning-daily-recordings/${date}/${target.targetKey.replace(":", "-")}/principles-${nanoid(16)}.${extension}`;
      const { url: audioUrl, key: audioKey } = await storagePut(fileKey, buffer, mimeType);

      try {
        if (existing) await db.update(morningPrincipleRecitations).set({ dailyKey: null }).where(eq(morningPrincipleRecitations.id, existing.id));
        const result = await db.insert(morningPrincipleRecitations).values({
          date,
          recordingType: RECORDING_TYPES.principles,
          dailyKey,
          startedAt,
          targetKey: target.targetKey,
          userId: target.userId,
          userName: target.userName,
          userEmail: target.userEmail,
          staffId: target.staffId,
          staffName: target.staffName,
          staffPosition: target.staffPosition,
          operatorUserId: ctx.user.id,
          operatorUserName: ctx.user.name || ctx.user.email,
          operatorUserEmail: ctx.user.email,
          language: input.language,
          audioUrl,
          audioKey,
          mimeType,
          durationSeconds: input.durationSeconds,
          status: "completed",
        });
        return {
          success: true,
          id: Number(result[0].insertId),
          date,
          targetKey: target.targetKey,
          userName: target.userName,
          staffPosition: target.staffPosition,
          recordedBy: ctx.user.name || ctx.user.email,
          startedAt,
        };
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: input.language === "zh" ? "该员工今天的9条朗读已完成" : "選択したスタッフの本日の9条朗読は登録済みです" });
        }
        throw error;
      }
    }),

  // 当日の個人朗読完了一覧。一般ユーザーは自分、管理者は在職者全員を確認できる。
  getTodayPersonalRecitations: protectedProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const date = input?.date || getJstDateString();

      const records = await db.select({
        id: morningPrincipleRecitations.id,
        recordingType: morningPrincipleRecitations.recordingType,
        dailyKey: morningPrincipleRecitations.dailyKey,
        startedAt: morningPrincipleRecitations.startedAt,
        targetKey: morningPrincipleRecitations.targetKey,
        userId: morningPrincipleRecitations.userId,
        userName: morningPrincipleRecitations.userName,
        userEmail: morningPrincipleRecitations.userEmail,
        staffId: morningPrincipleRecitations.staffId,
        staffName: morningPrincipleRecitations.staffName,
        staffPosition: morningPrincipleRecitations.staffPosition,
        language: morningPrincipleRecitations.language,
        durationSeconds: morningPrincipleRecitations.durationSeconds,
        status: morningPrincipleRecitations.status,
        createdAt: morningPrincipleRecitations.createdAt,
      })
        .from(morningPrincipleRecitations)
        .where(and(
          eq(morningPrincipleRecitations.date, date),
          eq(morningPrincipleRecitations.recordingType, RECORDING_TYPES.principles),
          sql`${morningPrincipleRecitations.dailyKey} IS NOT NULL`,
        ))
        .orderBy(asc(morningPrincipleRecitations.userName), desc(morningPrincipleRecitations.createdAt));

      const currentRecords = records.map((record) => ({
        ...record,
        canDelete: ctx.user.role === "admin" || record.userId === ctx.user.id,
        isValid: isValidCompletedTeamMeeting(record.status),
        invalidReason: null,
      }));
      const ownRecord = currentRecords.find((record) => record.userId === ctx.user.id) || null;
      if (ctx.user.role !== "admin") {
        return {
          date,
          completedCount: ownRecord?.isValid ? 1 : 0,
          totalCount: 1,
          ownRecord,
          members: [{
            userId: ctx.user.id,
            name: ownRecord?.staffName || ownRecord?.userName || ctx.user.name || ctx.user.email,
            position: ownRecord?.staffPosition || null,
            completed: Boolean(ownRecord?.isValid),
            recitation: ownRecord,
          }],
        };
      }

      const activeStaff = await db.select({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        position: staff.position,
      })
        .from(staff)
        .where(and(eq(staff.isActive, "active"), isNull(staff.archivedAt)))
        .orderBy(asc(staff.name));

      const byStaffId = new Map(currentRecords.filter((record) => record.staffId).map((record) => [record.staffId, record]));
      const byEmail = new Map(currentRecords.map((record) => [record.userEmail.toLowerCase(), record]));
      const members: Array<{
        staffId: number | null;
        userId: number | null;
        name: string;
        position: string | null;
        completed: boolean;
        recitation: (typeof currentRecords)[number] | null;
      }> = activeStaff.map((member) => {
        const recitation = byStaffId.get(member.id) || byEmail.get(member.email.toLowerCase()) || null;
        return {
          staffId: member.id,
          userId: recitation?.userId || null,
          name: member.name,
          position: member.position,
          completed: Boolean(recitation?.isValid),
          recitation,
        };
      });
      const linkedRecordIds = new Set(members.flatMap((member) => member.recitation ? [member.recitation.id] : []));
      for (const record of currentRecords) {
        if (!linkedRecordIds.has(record.id)) {
          members.push({
            staffId: record.staffId,
            userId: record.userId,
            name: record.staffName || record.userName,
            position: record.staffPosition,
            completed: record.isValid,
            recitation: record,
          });
        }
      }

      return {
        date,
        completedCount: members.filter((member) => member.completed).length,
        totalCount: members.length,
        ownRecord,
        members,
      };
    }),

  // 本人別の早会録音を対象スタッフ名義で保存し、文字起こしとAI要約まで行う。
  savePersonalMorningMeeting: protectedProcedure
    .input(z.object({
      audioBase64: z.string().min(1).max(Math.ceil(TEAM_MEETING_AUDIO_MAX_BYTES * 4 / 3) + 64),
      mimeType: z.string().min(1).max(100),
      durationSeconds: z.number().int().min(0).max(8 * 60 * 60),
      language: z.enum(["ja", "zh"]),
      transcript: z.string().max(200_000).optional(),
      startedAt: z.string().datetime().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      targetStaffId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = input.date || getJstDateString();
      if (ctx.user.role !== "admin" && date !== getJstDateString()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "本人は当日分のみ登録できます" });
      }
      const { buffer, mimeType } = decodeAndValidateAudio(input.audioBase64, input.mimeType, TEAM_MEETING_AUDIO_MAX_BYTES);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const startedAt = resolveTeamMeetingStartedAt(input.startedAt, input.durationSeconds);
      if (jstDateForInstant(startedAt) !== date) {
        throw new TRPCError({ code: "BAD_REQUEST", message: input.language === "zh" ? "录音开始时间与早会日期不一致" : "録音開始時刻と朝会日付が一致しません" });
      }
      const target = await resolveRecordingTarget(db, ctx.user, input.targetStaffId);
      const dailyKey = personalMorningRecordingDailyKey(date, target.targetKey, RECORDING_TYPES.morningMeeting);

      const [existing] = await db.select({ id: morningPrincipleRecitations.id, status: morningPrincipleRecitations.status, durationSeconds: morningPrincipleRecitations.durationSeconds })
        .from(morningPrincipleRecitations)
        .where(eq(morningPrincipleRecitations.dailyKey, dailyKey))
        .limit(1);
      if (isValidCompletedTeamMeeting(existing?.status)) {
        throw new TRPCError({ code: "CONFLICT", message: input.language === "zh" ? "该员工今天的早会录音已完成" : "選択したスタッフの本日の早会録音は登録済みです" });
      }

      const extension = audioExtension(mimeType);
      const fileKey = `morning-daily-recordings/${date}/${target.targetKey.replace(":", "-")}/morning-meeting-${nanoid(16)}.${extension}`;
      const stored = await storagePut(fileKey, buffer, mimeType);
      const baseValues = {
        date,
        recordingType: RECORDING_TYPES.morningMeeting,
        dailyKey,
        startedAt,
        targetKey: target.targetKey,
        userId: target.userId,
        userName: target.userName,
        userEmail: target.userEmail,
        staffId: target.staffId,
        staffName: target.staffName,
        staffPosition: target.staffPosition,
        operatorUserId: ctx.user.id,
        operatorUserName: ctx.user.name || ctx.user.email,
        operatorUserEmail: ctx.user.email,
        language: input.language,
        audioUrl: stored.url,
        audioKey: stored.key,
        mimeType,
        durationSeconds: input.durationSeconds,
        status: "transcribing" as const,
        errorMessage: null,
      };

      if (existing) await db.update(morningPrincipleRecitations).set({ dailyKey: null }).where(eq(morningPrincipleRecitations.id, existing.id));
      let recordingId: number;
      try {
        const result = await db.insert(morningPrincipleRecitations).values(baseValues);
        recordingId = Number(result[0].insertId);
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: input.language === "zh" ? "该员工今天的早会录音已存在" : "選択したスタッフの本日の早会録音は既に存在します" });
        }
        throw error;
      }

      try {
        let transcript = input.transcript?.trim() || "";
        if (transcript) {
          transcript = await correctTranscription(transcript, input.language);
        } else {
          const { url: presignedUrl } = await storageGet(stored.key);
          const transcriptionResult = await transcribeAudio({
            audioUrl: presignedUrl,
            language: input.language,
            prompt: input.language === "zh"
              ? `这是${target.userName}本人的早会工作汇报录音，请准确转写今天的任务、问题和需要的支持。`
              : `これは${target.userName}本人の朝会業務報告です。今日のタスク、課題、必要な支援を正確に文字起こししてください。`,
          });
          if ("error" in transcriptionResult) {
            throw new Error(`${transcriptionResult.error}: ${transcriptionResult.details || ""}`);
          }
          transcript = transcriptionResult.text;
        }

        await db.update(morningPrincipleRecitations)
          .set({ transcript, status: "summarizing" })
          .where(eq(morningPrincipleRecitations.id, recordingId));
        const summary = await generateMeetingSummary(transcript, input.language);
        await db.update(morningPrincipleRecitations)
          .set({ transcript, summary, status: "completed", errorMessage: null })
          .where(eq(morningPrincipleRecitations.id, recordingId));

        return {
          success: true,
          id: recordingId,
          date,
          targetKey: target.targetKey,
          userName: target.userName,
          transcript,
          summary,
          recordedBy: ctx.user.name || ctx.user.email,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "早会録音の処理に失敗しました";
        await db.update(morningPrincipleRecitations)
          .set({ status: "failed", errorMessage })
          .where(eq(morningPrincipleRecitations.id, recordingId));
        return { success: false, id: recordingId, error: errorMessage };
      }
    }),

  // 中国・日本チームごとに1日1件。チーム参加者、開始時刻、音声、文字起こし、AI要約を保存する。
  saveDailyTeamMeeting: protectedProcedure
    .input(z.object({
      audioBase64: z.string().min(1).max(Math.ceil(TEAM_MEETING_AUDIO_MAX_BYTES * 4 / 3) + 64),
      mimeType: z.string().min(1).max(100),
      durationSeconds: z.number().int().min(0).max(8 * 60 * 60),
      language: z.enum(["ja", "zh"]),
      teamCode: z.enum(["china", "japan"]),
      startedAt: z.string().datetime().optional(),
      transcript: z.string().max(200_000).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      participantStaffIds: z.array(z.number().int().positive()).min(1).max(200)
        .refine((ids) => new Set(ids).size === ids.length, "参加者が重複しています"),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = input.date || getJstDateString();
      if (ctx.user.role !== "admin" && date !== getJstDateString()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "当日以外のチーム早会を登録できるのは管理者だけです" });
      }
      const validatedAudio = decodeAndValidateAudio(input.audioBase64, input.mimeType, TEAM_MEETING_AUDIO_MAX_BYTES);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });

      const startedAt = resolveTeamMeetingStartedAt(input.startedAt, input.durationSeconds);
      if (jstDateForInstant(startedAt) !== date) {
        throw new TRPCError({ code: "BAD_REQUEST", message: input.language === "zh" ? "录音开始时间与早会日期不一致" : "録音開始時刻と朝会日付が一致しません" });
      }

      const host = await resolveRecordingTarget(db, ctx.user);
      requireHostTeamAccess(ctx.user, host, input.teamCode);
      const activeStaff = await db.select({ id: staff.id, name: staff.name, email: staff.email, position: staff.position, country: staff.country })
        .from(staff)
        .where(and(eq(staff.isActive, "active"), isNull(staff.archivedAt)))
        .orderBy(asc(staff.name));
      const requestedIds = new Set(input.participantStaffIds);
      if (host.staffId && staffCountryToTeamCode(host.staffCountry) === input.teamCode) requestedIds.add(host.staffId);
      const participants = activeStaff.filter((member) => requestedIds.has(member.id) && staffCountryToTeamCode(member.country) === input.teamCode);
      if (participants.length !== requestedIds.size) {
        throw new TRPCError({ code: "BAD_REQUEST", message: input.language === "zh" ? "参加者中包含其他团队、无效或已离职员工" : "参加者に別チーム、無効または退職済みのスタッフが含まれています" });
      }
      const participantSnapshot = participants.map((member) => ({
        targetKey: `staff:${member.id}`,
        staffId: member.id,
        userId: member.email.toLowerCase() === ctx.user.email.toLowerCase() ? ctx.user.id : null,
        name: member.name,
        email: member.email,
        position: member.position,
      }));

      const dailyKey = teamMeetingDailyKey(date, input.teamCode);
      const memberTeamByTargetKey = new Map<string, TeamMeetingCode | null>(
        activeStaff.map((member) => [`staff:${member.id}`, staffCountryToTeamCode(member.country)]),
      );
      const existingCandidates = await db.select({
        id: morningMeetings.id,
        dailyKey: morningMeetings.dailyKey,
        teamCode: morningMeetings.teamCode,
        participantSnapshot: morningMeetings.participantSnapshot,
        status: morningMeetings.status,
        createdBy: morningMeetings.createdBy,
      })
        .from(morningMeetings)
        .where(and(eq(morningMeetings.date, date), eq(morningMeetings.recordingKind, "daily_team")))
        .orderBy(desc(morningMeetings.createdAt));
      const existing = existingCandidates.find((meeting) => meeting.dailyKey === dailyKey || meeting.teamCode === input.teamCode)
        || existingCandidates.find((meeting) => meeting.teamCode === "legacy"
          && inferLegacyTeamCode(meeting.participantSnapshot, memberTeamByTargetKey) === input.teamCode);
      if (isValidCompletedTeamMeeting(existing?.status)) {
        throw new TRPCError({ code: "CONFLICT", message: input.language === "zh" ? "今天该团队早会已经有效完成" : "本日の該当チーム朝会は有効に完了済みです" });
      }
      if (existing && ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "失敗した早会を再登録できるのは主持人または管理者だけです" });
      }

      const baseValues = {
        date,
        dailyKey,
        recordingKind: "daily_team" as const,
        teamCode: input.teamCode,
        startedAt,
        participantCount: participantSnapshot.length,
        participantSnapshot,
        durationSeconds: input.durationSeconds,
        language: input.language,
        status: "recording",
        errorMessage: null,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email,
      };
      if (existing) {
        await db.update(morningMeetings).set({ dailyKey: null }).where(eq(morningMeetings.id, existing.id));
      }
      let meetingId: number;
      try {
        const inserted = await db.insert(morningMeetings).values(baseValues);
        meetingId = Number(inserted[0].insertId);
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: input.language === "zh" ? "今天该团队早会正在由其他人录制" : "本日の該当チーム朝会は他の主持人が登録中です" });
        }
        throw error;
      }

      try {
        const extension = audioExtension(validatedAudio.mimeType);
        const fileKey = `morning-team-meetings/${date}/${input.teamCode}/meeting-${meetingId}-${nanoid(16)}.${extension}`;
        const stored = await storagePut(fileKey, validatedAudio.buffer, validatedAudio.mimeType);
        await db.update(morningMeetings).set({ audioUrl: stored.url, audioKey: stored.key, status: "transcribing" })
          .where(eq(morningMeetings.id, meetingId));

        let transcript = input.transcript?.trim() || "";
        if (transcript) {
          transcript = await correctTranscription(transcript, input.language);
        } else {
          const { url: presignedUrl } = await storageGet(stored.key);
          const names = participantSnapshot.map((participant) => participant.name).join("、");
          const transcriptionResult = await transcribeAudio({
            audioUrl: presignedUrl,
            language: input.language,
            prompt: input.language === "zh"
              ? `这是LCJ${input.teamCode === "china" ? "中国" : "日本"}团队早会录音。参加者：${names}。请准确转写每个人的工作汇报、任务、问题和需要的支持。`
              : `これはLCJ${input.teamCode === "china" ? "中国" : "日本"}チーム朝会の録音です。参加者：${names}。各自の業務報告、タスク、課題、必要な支援を正確に文字起こししてください。`,
          });
          if ("error" in transcriptionResult) {
            throw new Error(`${transcriptionResult.error}: ${transcriptionResult.details || ""}`);
          }
          transcript = transcriptionResult.text;
        }

        await db.update(morningMeetings).set({ transcript, status: "summarizing" })
          .where(eq(morningMeetings.id, meetingId));
        const summary = await generateMeetingSummary(transcript, input.language);
        await db.update(morningMeetings).set({ transcript, summary, status: "completed", errorMessage: null })
          .where(eq(morningMeetings.id, meetingId));
        return {
          success: true,
          id: meetingId,
          date,
          teamCode: input.teamCode,
          startedAt,
          participantCount: participantSnapshot.length,
          participants: participantSnapshot,
          transcript,
          summary,
          recordedBy: ctx.user.name || ctx.user.email,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "チーム早会の処理に失敗しました";
        await db.update(morningMeetings).set({ status: "failed", errorMessage })
          .where(eq(morningMeetings.id, meetingId));
        return { success: false, id: meetingId, error: errorMessage };
      }
    }),

  // 当日の個人9条とチーム早会参加状態を集計。一般社員は本人、管理者は在職者全員を確認できる。
  getTodayDailyRecordings: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const date = input?.date || getJstDateString();
      const currentTarget = await resolveRecordingTarget(db, ctx.user);
      const principlesRecords = await db.select({
        id: morningPrincipleRecitations.id,
        dailyKey: morningPrincipleRecitations.dailyKey,
        startedAt: morningPrincipleRecitations.startedAt,
        targetKey: morningPrincipleRecitations.targetKey,
        userId: morningPrincipleRecitations.userId,
        userName: morningPrincipleRecitations.userName,
        staffId: morningPrincipleRecitations.staffId,
        staffName: morningPrincipleRecitations.staffName,
        staffPosition: morningPrincipleRecitations.staffPosition,
        language: morningPrincipleRecitations.language,
        durationSeconds: morningPrincipleRecitations.durationSeconds,
        status: morningPrincipleRecitations.status,
        operatorUserName: morningPrincipleRecitations.operatorUserName,
        createdAt: morningPrincipleRecitations.createdAt,
      })
        .from(morningPrincipleRecitations)
        .where(and(
          eq(morningPrincipleRecitations.date, date),
          eq(morningPrincipleRecitations.recordingType, RECORDING_TYPES.principles),
          sql`${morningPrincipleRecitations.dailyKey} IS NOT NULL`,
        ))
        .orderBy(asc(morningPrincipleRecitations.userName), desc(morningPrincipleRecitations.createdAt));
      const teamMeetingRows = await db.select({
        id: morningMeetings.id,
        date: morningMeetings.date,
        teamCode: morningMeetings.teamCode,
        startedAt: morningMeetings.startedAt,
        durationSeconds: morningMeetings.durationSeconds,
        transcript: morningMeetings.transcript,
        language: morningMeetings.language,
        summary: morningMeetings.summary,
        status: morningMeetings.status,
        errorMessage: morningMeetings.errorMessage,
        createdBy: morningMeetings.createdBy,
        createdByName: morningMeetings.createdByName,
        participantCount: morningMeetings.participantCount,
        participantSnapshot: morningMeetings.participantSnapshot,
        createdAt: morningMeetings.createdAt,
      })
        .from(morningMeetings)
        .where(and(eq(morningMeetings.date, date), eq(morningMeetings.recordingKind, "daily_team")))
        .orderBy(desc(morningMeetings.createdAt));
      const activeStaff = await db.select({ id: staff.id, name: staff.name, email: staff.email, position: staff.position, country: staff.country })
        .from(staff)
        .where(and(eq(staff.isActive, "active"), isNull(staff.archivedAt)))
        .orderBy(asc(staff.name));
      const memberTeamByTargetKey = new Map<string, TeamMeetingCode | null>(
        activeStaff.map((member) => [`staff:${member.id}`, staffCountryToTeamCode(member.country)]),
      );
      const normalizeTeamMeeting = (teamCode: TeamMeetingCode) => {
        const directRecord = teamMeetingRows.find((meeting) => meeting.teamCode === teamCode);
        const inferredLegacyRecord = teamMeetingRows.find((meeting) =>
          meeting.teamCode === "legacy"
          && inferLegacyTeamCode(meeting.participantSnapshot, memberTeamByTargetKey) === teamCode
        );
        const record = directRecord || inferredLegacyRecord;
        if (!record) return null;
        const isValid = isValidCompletedTeamMeeting(record.status);
        return {
          ...record,
          teamCode,
          inferredFromLegacy: !directRecord,
          canDelete: ctx.user.role === "admin" || Number(record.createdBy) === ctx.user.id,
          isValid,
          invalidReason: null,
        };
      };
      const teamMeetings = {
        china: normalizeTeamMeeting("china"),
        japan: normalizeTeamMeeting("japan"),
      };
      const participantKeys = new Set(
        Object.values(teamMeetings).flatMap((meeting) => meeting?.isValid && Array.isArray(meeting.participantSnapshot)
          ? meeting.participantSnapshot.map((participant) => participant.targetKey)
          : []),
      );
      const principleFor = (targetKey: string) => {
        const record = principlesRecords.find((candidate) => candidate.targetKey === targetKey) || null;
        if (!record) return null;
        const isValid = isValidCompletedTeamMeeting(record.status);
        return {
          ...record,
          canDelete: ctx.user.role === "admin" || record.userId === ctx.user.id || record.targetKey === currentTarget.targetKey,
          isValid,
          invalidReason: null,
        };
      };
      const toMember = (target: RecordingTarget) => {
        const principles = principleFor(target.targetKey);
        const attendedTeamMeeting = participantKeys.has(target.targetKey);
        return {
          targetKey: target.targetKey,
          staffId: target.staffId,
          userId: target.userId || null,
          name: target.staffName || target.userName,
          email: target.userEmail,
          position: target.staffPosition,
          country: target.staffCountry,
          teamCode: staffCountryToTeamCode(target.staffCountry),
          principles,
          principlesCompleted: Boolean(principles?.isValid),
          principlesInvalidReason: principles?.invalidReason || null,
          attendedTeamMeeting,
          allCompleted: Boolean(principles?.isValid && attendedTeamMeeting),
        };
      };

      const allMembers = activeStaff.map((member) => toMember({
        targetKey: `staff:${member.id}`,
        userId: member.email.toLowerCase() === ctx.user.email.toLowerCase() ? ctx.user.id : 0,
        userName: member.name,
        userEmail: member.email,
        staffId: member.id,
        staffName: member.name,
        staffPosition: member.position,
        staffCountry: member.country,
      }));
      if (!allMembers.some((member) => member.targetKey === currentTarget.targetKey)) {
        allMembers.unshift(toMember(currentTarget));
      }
      const currentStaff = toMember(currentTarget);
      const visibleMembers = ctx.user.role === "admin" ? allMembers : [currentStaff];
      const currentTeamCode = staffCountryToTeamCode(currentTarget.staffCountry);
      const participantOptionsByTeam = {
        china: activeStaff.filter((member) => staffCountryToTeamCode(member.country) === "china").map((member) => ({
          staffId: member.id,
          name: member.name,
          position: member.position,
          selected: teamMeetings.china?.isValid
            ? new Set((teamMeetings.china.participantSnapshot || []).map((participant) => participant.targetKey)).has(`staff:${member.id}`)
            : true,
        })),
        japan: activeStaff.filter((member) => staffCountryToTeamCode(member.country) === "japan").map((member) => ({
          staffId: member.id,
          name: member.name,
          position: member.position,
          selected: teamMeetings.japan?.isValid
            ? new Set((teamMeetings.japan.participantSnapshot || []).map((participant) => participant.targetKey)).has(`staff:${member.id}`)
            : true,
        })),
      };
      const currentTeamMeeting = currentTeamCode ? teamMeetings[currentTeamCode] : null;
      const currentOptions = currentTeamCode ? participantOptionsByTeam[currentTeamCode] : [];

      return {
        date,
        canSelectStaff: ctx.user.role === "admin",
        canHostTeamMeeting: Boolean(currentTeamCode && !currentTeamMeeting?.isValid),
        availableTeamCodes: ctx.user.role === "admin" ? ["china", "japan"] as const : currentTeamCode ? [currentTeamCode] : [],
        currentTeamCode,
        currentStaff,
        teamMeetings,
        participantOptionsByTeam,
        teamMeeting: currentTeamMeeting,
        meetingParticipantOptions: currentOptions,
        completedBothCount: allMembers.filter((member) => member.allCompleted).length,
        totalCount: allMembers.length,
        members: visibleMembers,
      };
    }),

  // 本人別2録音は対象本人または管理者だけ再生可能。
  getDailyRecordingAudioUrl: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const record = await requireDailyRecordingAccess(db, input.id, ctx.user);
      const { url } = await storageGet(record.audioKey);
      return { url };
    }),

  // 旧UI互換: 個人朗読音声も同じ権限helperで再生する。
  getPersonalRecitationAudioUrl: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const record = await requireDailyRecordingAccess(db, input.id, ctx.user);
      const { url } = await storageGet(record.audioKey);
      return { url };
    }),

  // 音声アップロード → S3保存 + 文字起こし + AI要約を一括実行
  uploadAndProcess: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      audioBase64: z.string().min(1).max(Math.ceil(TEAM_MEETING_AUDIO_MAX_BYTES * 4 / 3) + 64),
      mimeType: z.string().min(1).max(100).default("audio/webm"),
      durationSeconds: z.number().int().min(1).max(8 * 60 * 60).optional(),
      language: z.enum(["ja", "zh"]).default("ja"),
    }))
    .mutation(async ({ ctx, input }) => {
      const meetingId = input.meetingId;
      const { buffer: audioBuffer, mimeType } = decodeAndValidateAudio(
        input.audioBase64,
        input.mimeType,
        TEAM_MEETING_AUDIO_MAX_BYTES,
      );
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");
      await requireMeetingOwnerOrAdmin(db, meetingId, ctx.user);

      try {
        // Step 1: S3にアップロード
        await db.update(morningMeetings)
          .set({ status: "transcribing" })
          .where(eq(morningMeetings.id, meetingId));
        const ext = audioExtension(mimeType);
        const fileKey = `morning-meetings/${meetingId}-${nanoid(16)}.${ext}`;
        
        const { url: audioUrl, key: audioKey } = await storagePut(
          fileKey,
          audioBuffer,
          mimeType,
        );

        await db.update(morningMeetings)
          .set({ 
            audioUrl,
            audioKey,
            durationSeconds: input.durationSeconds,
          })
          .where(eq(morningMeetings.id, meetingId));

        // Step 2: Whisperで文字起こし
        // storageGetでpresigned URLを取得
        const { url: presignedUrl } = await storageGet(fileKey);
        
        const transcriptionResult = await transcribeAudio({
          audioUrl: presignedUrl,
          language: input.language,
          prompt: input.language === "zh"
            ? "这是LCJ公司的团队早会录音。参加者正在汇报今天的工作计划、问题和需要的支持。"
            : "これはLCJのチーム朝会録音です。参加者が今日の業務予定、課題、必要なサポートを報告しています。",
        });

        // エラーチェック
        if ("error" in transcriptionResult) {
          await db.update(morningMeetings)
            .set({ 
              status: "failed",
              errorMessage: `文字起こし失敗: ${transcriptionResult.error} - ${transcriptionResult.details || ""}`,
            })
            .where(eq(morningMeetings.id, meetingId));
          return { 
            success: false, 
            error: transcriptionResult.error,
            meetingId,
          };
        }

        const transcript = transcriptionResult.text;
        const language = transcriptionResult.language;

        await db.update(morningMeetings)
          .set({ 
            transcript,
            language,
            status: "summarizing",
          })
          .where(eq(morningMeetings.id, meetingId));

        // Step 3: AI要約
        const summaryResult = await generateMeetingSummary(transcript, input.language);

        await db.update(morningMeetings)
          .set({ 
            summary: summaryResult,
            status: "completed",
          })
          .where(eq(morningMeetings.id, meetingId));

        return { 
          success: true, 
          meetingId,
          transcript,
          summary: summaryResult,
        };

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await db.update(morningMeetings)
          .set({ 
            status: "failed",
            errorMessage: errorMsg,
          })
          .where(eq(morningMeetings.id, meetingId));
        
        return { 
          success: false, 
          error: errorMsg,
          meetingId,
        };
      }
    }),

  // 個人9条・新チーム早会・旧記録を完全分離した履歴。
  getSeparatedHistory: protectedProcedure
    .input(z.object({
      type: z.enum(["principles", "team", "legacy"]),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      search: z.string().trim().max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const pattern = input.search ? `%${input.search}%` : null;

      if (input.type === "principles") {
        const conditions: any[] = [eq(morningPrincipleRecitations.recordingType, RECORDING_TYPES.principles)];
        if (ctx.user.role !== "admin") {
          const ownTarget = await resolveRecordingTarget(db, ctx.user);
          conditions.push(eq(morningPrincipleRecitations.targetKey, ownTarget.targetKey));
        }
        if (input.dateFrom) conditions.push(gte(morningPrincipleRecitations.date, input.dateFrom));
        if (input.dateTo) conditions.push(lte(morningPrincipleRecitations.date, input.dateTo));
        if (pattern) {
          conditions.push(sql`(${morningPrincipleRecitations.userName} LIKE ${pattern} OR ${morningPrincipleRecitations.staffName} LIKE ${pattern} OR ${morningPrincipleRecitations.staffPosition} LIKE ${pattern})`);
        }
        const whereClause = and(...conditions);
        const [records, countRows] = await Promise.all([
          db.select({
            id: morningPrincipleRecitations.id,
            date: morningPrincipleRecitations.date,
            startedAt: morningPrincipleRecitations.startedAt,
            targetKey: morningPrincipleRecitations.targetKey,
            userId: morningPrincipleRecitations.userId,
            name: morningPrincipleRecitations.staffName,
            fallbackName: morningPrincipleRecitations.userName,
            position: morningPrincipleRecitations.staffPosition,
            language: morningPrincipleRecitations.language,
            durationSeconds: morningPrincipleRecitations.durationSeconds,
            status: morningPrincipleRecitations.status,
            operatorUserName: morningPrincipleRecitations.operatorUserName,
            createdAt: morningPrincipleRecitations.createdAt,
          })
            .from(morningPrincipleRecitations)
            .where(whereClause)
            .orderBy(desc(morningPrincipleRecitations.date), desc(morningPrincipleRecitations.createdAt))
            .limit(input.limit)
            .offset(input.offset),
          db.select({ count: sql<number>`COUNT(*)` })
            .from(morningPrincipleRecitations)
            .where(whereClause),
        ]);
        return {
          type: input.type,
          records: records.map((record) => {
            const isValid = isValidCompletedTeamMeeting(record.status);
            return {
              ...record,
              name: record.name || record.fallbackName,
              audioSource: "daily" as const,
              canDelete: ctx.user.role === "admin" || record.userId === ctx.user.id,
              isValid,
              invalidReason: null,
            };
          }),
          total: Number(countRows[0]?.count || 0),
        };
      }

      if (input.type === "team") {
        const conditions: any[] = [eq(morningMeetings.recordingKind, "daily_team")];
        if (input.dateFrom) conditions.push(gte(morningMeetings.date, input.dateFrom));
        if (input.dateTo) conditions.push(lte(morningMeetings.date, input.dateTo));
        if (pattern) {
          conditions.push(sql`(${morningMeetings.createdByName} LIKE ${pattern} OR ${morningMeetings.transcript} LIKE ${pattern} OR JSON_EXTRACT(${morningMeetings.summary}, '$.overview') LIKE ${pattern} OR JSON_SEARCH(${morningMeetings.participantSnapshot}, 'one', ${input.search}) IS NOT NULL)`);
        }
        const whereClause = and(...conditions);
        const [records, countRows] = await Promise.all([
          db.select()
            .from(morningMeetings)
            .where(whereClause)
            .orderBy(desc(morningMeetings.date), desc(morningMeetings.createdAt))
            .limit(input.limit)
            .offset(input.offset),
          db.select({ count: sql<number>`COUNT(*)` })
            .from(morningMeetings)
            .where(whereClause),
        ]);
        return {
          type: input.type,
          records: records.map((record) => {
            const isValid = isValidCompletedTeamMeeting(record.status);
            return {
              ...record,
              audioSource: "meeting" as const,
              canDelete: ctx.user.role === "admin" || Number(record.createdBy) === ctx.user.id,
              isValid,
              invalidReason: null,
            };
          }),
          total: Number(countRows[0]?.count || 0),
        };
      }

      const personalConditions: any[] = [eq(morningPrincipleRecitations.recordingType, RECORDING_TYPES.morningMeeting)];
      if (ctx.user.role !== "admin") {
        const ownTarget = await resolveRecordingTarget(db, ctx.user);
        personalConditions.push(eq(morningPrincipleRecitations.targetKey, ownTarget.targetKey));
      }
      if (input.dateFrom) personalConditions.push(gte(morningPrincipleRecitations.date, input.dateFrom));
      if (input.dateTo) personalConditions.push(lte(morningPrincipleRecitations.date, input.dateTo));
      if (pattern) personalConditions.push(sql`(${morningPrincipleRecitations.userName} LIKE ${pattern} OR ${morningPrincipleRecitations.staffName} LIKE ${pattern} OR ${morningPrincipleRecitations.transcript} LIKE ${pattern})`);
      const teamConditions: any[] = [eq(morningMeetings.recordingKind, "legacy")];
      if (input.dateFrom) teamConditions.push(gte(morningMeetings.date, input.dateFrom));
      if (input.dateTo) teamConditions.push(lte(morningMeetings.date, input.dateTo));
      if (pattern) teamConditions.push(sql`(${morningMeetings.createdByName} LIKE ${pattern} OR ${morningMeetings.transcript} LIKE ${pattern} OR JSON_EXTRACT(${morningMeetings.summary}, '$.overview') LIKE ${pattern})`);
      const [personalRecords, legacyTeamRecords] = await Promise.all([
        db.select().from(morningPrincipleRecitations).where(and(...personalConditions)),
        db.select().from(morningMeetings).where(and(...teamConditions)),
      ]);
      const combined = [
        ...personalRecords.map((record) => ({
          ...record,
          historyKind: "legacy_personal" as const,
          name: record.staffName || record.userName,
          audioSource: "daily" as const,
          canDelete: ctx.user.role === "admin" || record.userId === ctx.user.id,
        })),
        ...legacyTeamRecords.map((record) => ({
          ...record,
          historyKind: "legacy_team" as const,
          name: record.createdByName,
          audioSource: "meeting" as const,
          canDelete: ctx.user.role === "admin" || Number(record.createdBy) === ctx.user.id,
        })),
      ].sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return {
        type: input.type,
        records: combined.slice(input.offset, input.offset + input.limit),
        total: combined.length,
      };
    }),

  // 履歴取得（旧共有朝会の後方互換。新UIはgetSeparatedHistoryを使用）
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      dateFrom: z.string().optional(), // YYYY-MM-DD
      dateTo: z.string().optional(), // YYYY-MM-DD
      search: z.string().optional(), // テキスト検索
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      const conditions = [];
      
      if (input.dateFrom) {
        conditions.push(gte(morningMeetings.date, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(morningMeetings.date, input.dateTo));
      }
      if (input.search) {
        conditions.push(
          sql`(${morningMeetings.transcript} LIKE ${`%${input.search}%`} OR JSON_EXTRACT(${morningMeetings.summary}, '$.overview') LIKE ${`%${input.search}%`})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [meetings, countResult] = await Promise.all([
        db.select()
          .from(morningMeetings)
          .where(whereClause)
          .orderBy(desc(morningMeetings.date), desc(morningMeetings.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(morningMeetings)
          .where(whereClause),
      ]);

      return {
        meetings,
        total: countResult[0]?.count || 0,
      };
    }),

  // 単一レコード取得
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      const [meeting] = await db.select()
        .from(morningMeetings)
        .where(eq(morningMeetings.id, input.id))
        .limit(1);

      return meeting || null;
    }),

  // 旧クライアント互換: チーム朝会を権限検証・監査付きで削除する。
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return await deleteMorningRecording({
        source: "meeting",
        id: input.id,
        actor: { id: ctx.user.id, role: ctx.user.role, name: ctx.user.name || ctx.user.email },
        ownTargetKey: null,
      });
    }),

  // 個人朗読とチーム朝会を共通の権限・原子監査で削除する。
  deleteRecording: protectedProcedure
    .input(z.object({
      source: z.enum(["daily", "meeting"]),
      id: z.number().int().positive(),
      reason: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB connection failed" });
      const ownTarget = await resolveRecordingTarget(db, ctx.user);
      return await deleteMorningRecording({
        source: input.source,
        id: input.id,
        actor: { id: ctx.user.id, role: ctx.user.role, name: ctx.user.name || ctx.user.email },
        ownTargetKey: ownTarget.targetKey,
        reason: input.reason,
      });
    }),

  // 今日の朝会があるかチェック
  getTodayMeeting: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      // JST today
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstDate = new Date(now.getTime() + jstOffset);
      const today = jstDate.toISOString().split("T")[0];

      const [meeting] = await db.select()
        .from(morningMeetings)
        .where(eq(morningMeetings.date, today))
        .orderBy(desc(morningMeetings.createdAt))
        .limit(1);

      return meeting || null;
    }),

  // 統計情報
  getStats: protectedProcedure
    .input(z.object({
      period: z.enum(["week", "month", "all"]).default("month"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstDate = new Date(now.getTime() + jstOffset);
      
      let dateFrom: string;
      if (input.period === "week") {
        const weekAgo = new Date(jstDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFrom = weekAgo.toISOString().split("T")[0];
      } else if (input.period === "month") {
        const monthAgo = new Date(jstDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFrom = monthAgo.toISOString().split("T")[0];
      } else {
        dateFrom = "2020-01-01";
      }

      const meetings = await db.select()
        .from(morningMeetings)
        .where(and(
          gte(morningMeetings.date, dateFrom),
          eq(morningMeetings.status, "completed"),
          eq(morningMeetings.recordingKind, "daily_team"),
        ))
        .orderBy(desc(morningMeetings.date));

      const activeStaff = await db.select({ id: staff.id, country: staff.country })
        .from(staff)
        .where(and(eq(staff.isActive, "active"), isNull(staff.archivedAt)));
      const memberTeamByTargetKey = new Map<string, TeamMeetingCode | null>(
        activeStaff.map((member) => [`staff:${member.id}`, staffCountryToTeamCode(member.country)]),
      );
      const effectiveTeamCode = (meeting: typeof meetings[number]): TeamMeetingCode | null =>
        meeting.teamCode === "china" || meeting.teamCode === "japan"
          ? meeting.teamCode
          : inferLegacyTeamCode(meeting.participantSnapshot, memberTeamByTargetKey);
      const validMeetings = meetings.filter((meeting) => isValidCompletedTeamMeeting(meeting.status));
      const totalMeetings = validMeetings.length;
      const totalDuration = validMeetings.reduce((sum, m) => sum + (m.durationSeconds || 0), 0);
      const avgDuration = totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0;
      const byTeam = (["china", "japan"] as const).map((teamCode) => {
        const teamMeetings = validMeetings.filter((meeting) => effectiveTeamCode(meeting) === teamCode);
        return {
          teamCode,
          totalMeetings: teamMeetings.length,
          totalDuration: teamMeetings.reduce((sum, meeting) => sum + (meeting.durationSeconds || 0), 0),
        };
      });

      return {
        totalMeetings,
        totalDuration,
        avgDuration,
        period: input.period,
        dateFrom,
        byTeam,
      };
    }),

  // Web Speech APIからのリアルタイム転写テキストを保存してAI要約
  saveTranscriptAndSummarize: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      transcript: z.string().min(1).max(200_000),
      durationSeconds: z.number().int().min(1).max(8 * 60 * 60).optional(),
      language: z.enum(["ja", "zh"]).optional(),
      audioBase64: z.string().min(1).max(Math.ceil(TEAM_MEETING_AUDIO_MAX_BYTES * 4 / 3) + 64).optional(),
      mimeType: z.string().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (Boolean(input.audioBase64) !== Boolean(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "音声データとMIMEタイプは両方必要です" });
      }
      const validatedAudio = input.audioBase64 && input.mimeType
        ? decodeAndValidateAudio(input.audioBase64, input.mimeType, TEAM_MEETING_AUDIO_MAX_BYTES)
        : null;

      const db = await getDb();
      if (!db) throw new Error("DB connection failed");
      await requireMeetingOwnerOrAdmin(db, input.meetingId, ctx.user);

      try {
        let audioFields: { audioUrl?: string; audioKey?: string } = {};
        if (validatedAudio) {
          const extension = audioExtension(validatedAudio.mimeType);
          const fileKey = `morning-meetings/${input.meetingId}-${nanoid(16)}.${extension}`;
          const stored = await storagePut(fileKey, validatedAudio.buffer, validatedAudio.mimeType);
          audioFields = { audioUrl: stored.url, audioKey: stored.key };
        }

        // Step 1: 語義修正（音声認識の誤りを文脈で修正）
        const correctedTranscript = await correctTranscription(input.transcript, input.language || "zh");
        await db.update(morningMeetings)
          .set({
            ...audioFields,
            transcript: correctedTranscript,
            durationSeconds: input.durationSeconds,
            language: input.language,
            status: "summarizing",
          })
          .where(eq(morningMeetings.id, input.meetingId));

        // Step 2: AI要約（修正済みテキストで生成）
        const summaryResult = await generateMeetingSummary(correctedTranscript, input.language || "zh");

        await db.update(morningMeetings)
          .set({
            summary: summaryResult,
            status: "completed",
          })
          .where(eq(morningMeetings.id, input.meetingId));

        return {
          success: true,
          meetingId: input.meetingId,
          summary: summaryResult,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await db.update(morningMeetings)
          .set({
            status: "failed",
            errorMessage: errorMsg,
          })
          .where(eq(morningMeetings.id, input.meetingId));

        return {
          success: false,
          error: errorMsg,
          meetingId: input.meetingId,
        };
      }
    }),
  // 昨日の朝会録音が無い場合のチェック（全ユーザーに警告表示用）
  checkMissingRecording: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { missing: false, date: "" };
      // 昨日の日付を取得（土日はスキップ）
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=日, 1=月, ..., 6=土
      // 月曜なら金曜をチェック、日曜/土曜はスキップ
      if (dayOfWeek === 0 || dayOfWeek === 6) return { missing: false, date: "" };
      let checkDate: Date;
      if (dayOfWeek === 1) {
        // 月曜 → 金曜をチェック
        checkDate = new Date(today);
        checkDate.setDate(today.getDate() - 3);
      } else {
        // 火〜金 → 前日をチェック
        checkDate = new Date(today);
        checkDate.setDate(today.getDate() - 1);
      }
      const dateStr = checkDate.toISOString().split("T")[0];
      const records = await db.select({
        teamCode: morningMeetings.teamCode,
        status: morningMeetings.status,
        participantSnapshot: morningMeetings.participantSnapshot,
      })
        .from(morningMeetings)
        .where(and(
          eq(morningMeetings.date, dateStr),
          eq(morningMeetings.recordingKind, "daily_team")
        ));
      const activeStaff = await db.select({ id: staff.id, country: staff.country })
        .from(staff)
        .where(and(eq(staff.isActive, "active"), isNull(staff.archivedAt)));
      const memberTeamByTargetKey = new Map<string, TeamMeetingCode | null>(
        activeStaff.map((member) => [`staff:${member.id}`, staffCountryToTeamCode(member.country)]),
      );
      const completedTeams = new Set(records
        .filter((record) => isValidCompletedTeamMeeting(record.status))
        .map((record) => record.teamCode === "china" || record.teamCode === "japan"
          ? record.teamCode
          : inferLegacyTeamCode(record.participantSnapshot, memberTeamByTargetKey))
        .filter((teamCode): teamCode is TeamMeetingCode => Boolean(teamCode)));
      const missingTeams = (["china", "japan"] as const).filter((teamCode) => !completedTeams.has(teamCode));
      return { missing: missingTeams.length > 0, missingTeams, date: dateStr };
    }),

  // 音声ファイルのpresigned URLを取得（再生用）
  getAudioUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");
      const [meeting] = await db.select({
        audioKey: morningMeetings.audioKey,
        audioUrl: morningMeetings.audioUrl,
      })
        .from(morningMeetings)
        .where(eq(morningMeetings.id, input.id))
        .limit(1);
      if (!meeting || !meeting.audioKey) return { url: null };
      const { url } = await storageGet(meeting.audioKey);
      return { url };
    }),

});

/**
 * AI要約生成
 * 朝会の文字起こしから構造化されたサマリーを生成
 */
async function generateMeetingSummary(transcript: string, language: string = "zh") {
  const isZh = language.startsWith("zh");
  const prompt = `あなたは日本のライブコマース会社（LCJ / Live Commerce Japan）の朝会議事録を要約する専門AIです。
この会社はTikTok Shopでのライブコマース事業を行っており、主播（ライバー）管理、ブランド提携、商品選品、広告運用、展示会企画などが主要業務です。

以下の朝会の文字起こしテキストを詳細に分析し、JSON形式で構造化された要約を生成してください。

## 重要な背景知識（固有名詞の参考）:
- 人名: KG老师/科技老师（CEO）、杨浩（エンジニア）、刘辉才/辉才（運営）、生物学（ニックネーム）、强哥（スタッフ）、小刘（スタッフ）、昆图（スタッフ）、Choco/チョコ（ライバー）、Ryu/京極琉（ライバー）、Ali/アリ（ライバー）、曼红（スタッフ）、Amber（広告担当）
- ブランド: KYOGOKU、K7K、KGZ、品牌日（ブランドデー）
- プラットフォーム: TikTok Shop、1688、阿里巴巴
- 業務用語: 达人（インフルエンサー）、私信（DM）、福袋（ラッキーバッグ）、セット組（商品セット）、選品（商品選定）、中控（配信コントロール）、拍卖（オークション）、GMV（流通総額）、ROI（投資対効果）
- イベント: Live Commerce Festival、品牌日（ブランドデー）
- システム: LCJ Mall、Light Up（動画ソフト）、cloud data（クラウドデータ）、play（再生/プレイ）

## 出力形式（必ずこのJSON形式で出力、${isZh ? "中国語" : "日本語"}で記述）:
{
  "overview": "朝会全体の3-5文の詳細な要約。主要な議題、決定事項、重要な進捗を含む",
  "participants": [
    {
      "name": "参加者の実名またはニックネーム",
      "reports": "この人が報告した内容の詳細（複数のタスクがあれば全て列挙、セミコロンで区切る）",
      "todayPlan": "今日の具体的な作業予定",
      "issues": "困っていること・課題・必要なサポート（なければ空文字）",
      "progress": "昨日/前回からの進捗報告（あれば）"
    }
  ],
  "actionItems": [
    {
      "person": "担当者名",
      "task": "具体的なタスク内容（何を、どのように）",
      "deadline": "期限（言及があれば）",
      "priority": "high/medium/low"
    }
  ],
  "keyDecisions": ["会議中に決定された重要事項のリスト"],
  "cultureRuleRead": false,
  "meetingQuality": "good/average/needsImprovement",
  "followUpNeeded": ["次回確認が必要な事項"]
}

## ルール:
- 各参加者の発言から「報告内容」「今日の予定」「課題」を漏れなく抽出
- 具体的な数字、商品名、ブランド名、人名は正確に記録
- 企業文化の朗読があったかどうかを判定（9条の鉄律、行動準則、企業理念などの言及）
- 聞き取れない部分は前後の文脈から推測して補完し、確信度が低い場合のみ「（推測）」と記載
- overviewは具体的に：何について話し合い、何が決まり、何が課題かを明記
- actionItemsは実行可能な具体的タスクとして記載（曖昧な表現は避ける）
- 参加者名は文脈から特定できる場合は実名/ニックネームを使用（「参加者1」は最終手段）
- 必ず有効なJSONのみを出力すること

## 文字起こしテキスト:
${transcript}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "あなたはライブコマース会社LCJの朝会議事録を構造化する専門AIです。必ず有効なJSONのみを出力してください。参加者の発言を漏れなく詳細に記録し、具体的で実行可能なアクションアイテムを抽出してください。" },
        { role: "user", content: prompt },
      ],
    });

    const content = typeof response === "string" 
      ? response 
      : (response as any)?.content || (response as any)?.choices?.[0]?.message?.content || "";

    // JSONを抽出
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overview: parsed.overview || "要約生成中にエラーが発生しました",
        participants: parsed.participants || [],
        actionItems: parsed.actionItems || [],
        cultureRuleRead: parsed.cultureRuleRead || false,
        keyDecisions: parsed.keyDecisions || [],
        meetingQuality: parsed.meetingQuality || "average",
        followUpNeeded: parsed.followUpNeeded || [],
      };
    }

    return {
      overview: "AI要約の解析に失敗しました。文字起こしテキストを直接確認してください。",
      participants: [],
      actionItems: [],
      cultureRuleRead: false,
      keyDecisions: [],
      meetingQuality: "average",
      followUpNeeded: [],
    };
  } catch (error) {
    console.error("Morning meeting summary generation error:", error);
    return {
      overview: "AI要約生成中にエラーが発生しました",
      participants: [],
      actionItems: [],
      cultureRuleRead: false,
      keyDecisions: [],
      meetingQuality: "average",
      followUpNeeded: [],
    };
  }
}

/**
 * 語義修正
 * 音声認識の誤りを文脈と業界知識で修正
 */
async function correctTranscription(transcript: string, language: string = "zh"): Promise<string> {
  if (!transcript || transcript.length < 20) return transcript;
  
  try {
    const response = await invokeLLM({
      messages: [
        { 
          role: "system", 
          content: `あなたはライブコマース会社LCJの音声認識テキスト修正AIです。
音声認識の誤変換を修正してください。意味を変えず、明らかな誤認識のみ修正します。

## 修正ルール:
1. 固有名詞の修正（人名、ブランド名、システム名）:
   - "科技老师/KG老师" = CEO
   - "杨浩" = エンジニア
   - "刘辉才/辉才" = 運営担当
   - "生物学" = スタッフのニックネーム
   - "强哥" = スタッフ
   - "昆图" = スタッフ
   - "曼红" = スタッフ
   - "KYOGOKU/京极" = ヘアケアブランド
   - "K7K" = ブランド
   - "KGZ" = ブランド
   - "TikTok Shop" = ECプラットフォーム
   - "1688/阿里巴巴" = 仕入れプラットフォーム
   - "LCJ Mall" = 自社システム
   - "Light Up" = 動画編集ソフト

2. 業界用語の修正:
   - "达人" = インフルエンサー
   - "私信" = DM（ダイレクトメッセージ）
   - "福袋" = ラッキーバッグ
   - "中控" = 配信コントロール
   - "拍卖" = オークション
   - "选品" = 商品選定
   - "品牌日" = ブランドデー
   - "GMV" = 流通総額
   - "ROI" = 投資対効果

3. 文脈推測:
   - 前後の文脈から意味が通じない単語は正しい単語に置換
   - 同音異義語の修正（例: "播" vs "拨"）
   - 数字や金額の修正

## 重要:
- 元のテキストの構造（改行、句読点）を保持
- 修正が不要な部分はそのまま出力
- 大幅な書き換えはしない、誤認識の修正のみ`
        },
        { 
          role: "user", 
          content: `以下の音声認識テキストを修正してください。修正後のテキストのみを出力してください（説明不要）:\n\n${transcript}` 
        },
      ],
    });

    const corrected = typeof response === "string" 
      ? response 
      : (response as any)?.content || (response as any)?.choices?.[0]?.message?.content || "";
    
    // If the response is reasonable (not empty, not too different in length), use it
    if (corrected && corrected.length > transcript.length * 0.5 && corrected.length < transcript.length * 2) {
      return corrected.trim();
    }
    return transcript;
  } catch (error) {
    console.error("Transcription correction error:", error);
    return transcript; // 修正失敗時は元のテキストを返す
  }
}
