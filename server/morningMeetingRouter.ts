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
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { morningMeetings } from "../drizzle/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";

export const morningMeetingRouter = router({
  // 録音開始 → DBにレコード作成
  startRecording: protectedProcedure
    .input(z.object({
      date: z.string().optional(), // YYYY-MM-DD, デフォルトは今日
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      const today = input.date || new Date().toISOString().split("T")[0];
      
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

  // 音声アップロード → S3保存 + 文字起こし + AI要約を一括実行
  uploadAndProcess: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      audioBase64: z.string(), // base64エンコードされた音声データ
      mimeType: z.string().default("audio/webm"),
      durationSeconds: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      const meetingId = input.meetingId;

      try {
        // Step 1: S3にアップロード
        await db.update(morningMeetings)
          .set({ status: "transcribing" })
          .where(eq(morningMeetings.id, meetingId));

        const audioBuffer = Buffer.from(input.audioBase64, "base64");
        const ext = input.mimeType.includes("webm") ? "webm" : 
                    input.mimeType.includes("mp4") ? "m4a" : 
                    input.mimeType.includes("ogg") ? "ogg" : "webm";
        const fileKey = `morning-meetings/${meetingId}-${nanoid(8)}.${ext}`;
        
        const { url: audioUrl, key: audioKey } = await storagePut(
          fileKey,
          audioBuffer,
          input.mimeType
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
          language: "ja", // 日本語メイン
          prompt: "これは日本の会社の朝会（朝礼）の録音です。参加者が今日の業務予定や必要なサポートを報告しています。",
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
        const summaryResult = await generateMeetingSummary(transcript);

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

  // 履歴取得（ページネーション付き）
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

  // レコード削除
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      await db.delete(morningMeetings)
        .where(eq(morningMeetings.id, input.id));

      return { success: true };
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
        ))
        .orderBy(desc(morningMeetings.date));

      const totalMeetings = meetings.length;
      const totalDuration = meetings.reduce((sum, m) => sum + (m.durationSeconds || 0), 0);
      const avgDuration = totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0;

      return {
        totalMeetings,
        totalDuration,
        avgDuration,
        period: input.period,
        dateFrom,
      };
    }),

  // Web Speech APIからのリアルタイム転写テキストを保存してAI要約
  saveTranscriptAndSummarize: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      transcript: z.string(),
      durationSeconds: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      try {
        await db.update(morningMeetings)
          .set({
            transcript: input.transcript,
            durationSeconds: input.durationSeconds,
            status: "summarizing",
          })
          .where(eq(morningMeetings.id, input.meetingId));

        const summaryResult = await generateMeetingSummary(input.transcript);

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
});

/**
 * AI要約生成
 * 朝会の文字起こしから構造化されたサマリーを生成
 */
async function generateMeetingSummary(transcript: string) {
  const prompt = `あなたは日本の会社の朝会（朝礼）の議事録を要約するAIアシスタントです。

以下の朝会の文字起こしテキストを分析し、JSON形式で構造化された要約を生成してください。

## 出力形式（必ずこのJSON形式で出力）:
{
  "overview": "朝会全体の1-2文の要約",
  "participants": [
    {
      "name": "参加者名（聞き取れない場合は「参加者1」等）",
      "todayTask": "今日の最重要タスク",
      "supportNeeded": "必要なサポート（なければ空文字）"
    }
  ],
  "actionItems": [
    {
      "person": "担当者名",
      "task": "具体的なタスク内容",
      "deadline": "期限（言及があれば）"
    }
  ],
  "cultureRuleRead": true/false
}

## ルール:
- 参加者の発言から「今日やること」「困っていること」を抽出
- 企業文化の朗読があったかどうかを判定（9条の鉄律、行動準則などの言及）
- 聞き取れない部分は「（不明瞭）」と記載
- 必ず有効なJSONのみを出力すること

## 文字起こしテキスト:
${transcript}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "あなたは朝会の議事録を構造化するAIです。必ず有効なJSONのみを出力してください。" },
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
      };
    }

    return {
      overview: "AI要約の解析に失敗しました。文字起こしテキストを直接確認してください。",
      participants: [],
      actionItems: [],
      cultureRuleRead: false,
    };
  } catch (error) {
    console.error("Morning meeting summary generation error:", error);
    return {
      overview: "AI要約生成中にエラーが発生しました",
      participants: [],
      actionItems: [],
      cultureRuleRead: false,
    };
  }
}
