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
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB connection failed");

      try {
        // Step 1: 語義修正（音声認識の誤りを文脈で修正）
        const correctedTranscript = await correctTranscription(input.transcript, input.language || "zh");
        await db.update(morningMeetings)
          .set({
            transcript: correctedTranscript,
            durationSeconds: input.durationSeconds,
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
      const [result] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(morningMeetings)
        .where(and(
          eq(morningMeetings.date, dateStr),
          eq(morningMeetings.status, "completed")
        ));
      const count = result?.count || 0;
      return { missing: count === 0, date: dateStr };
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
