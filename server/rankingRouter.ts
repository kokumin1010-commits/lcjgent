/**
 * GMV AWARD Ranking Router
 * - 主播上传TikTok直播大屏截图
 * - AI识别GMV等数据
 * - 公开排行榜
 * - 管理员审核
 */
import { router, publicProcedure, t } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import mysql from "mysql2/promise";
import { verifyFestivalUserRequest, verifyFestivalAdminRequest } from "./festivalAuthRouter";
import { nanoid } from "nanoid";

// Direct mysql2 connection pool
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

const recognizedRankingSchema = z.object({
  gmv: z.number().finite().min(0).max(999_999_999_999_999).nullable(),
  auctionGmv: z.number().finite().min(0).max(999_999_999_999_999).nullable(),
  fixedPriceGmv: z.number().finite().min(0).max(999_999_999_999_999).nullable(),
  duration: z.string().trim().max(100).nullable(),
  livestreamDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  tiktokUsername: z.string().trim().max(255).nullable(),
}).strict();

// Ensure table exists (lazy migration pattern)
let tableReady = false;
async function ensureRankingTable() {
  if (tableReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_ranking_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      liverName VARCHAR(255) NOT NULL,
      gmv DECIMAL(15,2) NOT NULL DEFAULT 0,
      auctionGmv DECIMAL(15,2) DEFAULT 0,
      fixedPriceGmv DECIMAL(15,2) DEFAULT 0,
      duration VARCHAR(100) DEFAULT NULL,
      livestreamDate VARCHAR(50) DEFAULT NULL,
      tiktokUsername VARCHAR(255) DEFAULT NULL,
      screenshotUrl TEXT,
      aiRawData JSON,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      adminNote TEXT,
      submittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approvedBy VARCHAR(255) DEFAULT NULL,
      approvedAt TIMESTAMP NULL,
      INDEX idx_status (status),
      INDEX idx_gmv (gmv DESC),
      INDEX idx_account (accountId),
      INDEX idx_date (livestreamDate)
    )
  `);
  tableReady = true;
}

// Festival auth procedure (active account verified against the database)
const festivalUserProcedure = t.procedure.use(async ({ ctx, next }) => {
  const account = await verifyFestivalUserRequest(ctx.req);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください" });
  return next({ ctx: { ...ctx, festivalUser: account } as any });
});

// Festival admin procedure
const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const admin = await verifyFestivalAdminRequest(ctx.req, (ctx as any).user);
  if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
  return next({ ctx: { ...ctx, lcfAdmin: admin } as any });
});

export const rankingRouter = router({
  // Submit ranking screenshot (liver uploads from mypage)
  submit: festivalUserProcedure
    .input(z.object({
      screenshotBase64: z.string().min(1, "スクリーンショットをアップロードしてください").max(16_000_000, "画像サイズが大きすぎます"),
      fileName: z.string().trim().min(1).max(255).default("screenshot.jpg"),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureRankingTable();
      const pool = getPool();
      const user = (ctx as any).festivalUser;

      if (user.accountType !== "liver") {
        throw new TRPCError({ code: "FORBIDDEN", message: "ランキング投稿はライバー申込者のみ利用できます" });
      }
      const buffer = Buffer.from(input.screenshotBase64, "base64");
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "画像サイズは10MB以下にしてください" });
      }
      const looksLikeJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
      const looksLikePng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const looksLikeWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
      if ((input.mimeType === "image/jpeg" && !looksLikeJpeg) || (input.mimeType === "image/png" && !looksLikePng) || (input.mimeType === "image/webp" && !looksLikeWebp)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "画像形式が正しくありません" });
      }
      // 0. Duplicate detection - check if same image was already submitted
      const crypto = await import("crypto");
      const imageHash = crypto.createHash("md5").update(buffer).digest("hex");
      await pool.query(`ALTER TABLE lcf_ranking_submissions ADD COLUMN IF NOT EXISTS imageHash VARCHAR(64)`).catch(() => {});
      const [existingDups]: any = await pool.query(
        `SELECT id FROM lcf_ranking_submissions WHERE accountId = ? AND imageHash = ? LIMIT 1`,
        [user.accountId, imageHash]
      );
      if (existingDups.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "この画像は既に提出済みです。同じスクリーンショットは再度アップロードできません。" });
      }

      // 1. AI Recognition - analyze the TikTok livestream dashboard screenshot
      const aiResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたはTikTok Shop直播大屏（ライブダッシュボード）のスクリーンショットを分析するAIです。
画像から以下の情報を正確に抽出してJSON形式で返してください：
- gmv: 归因GMV（円）の数値（カンマなし、整数または小数）
- auctionGmv: 拍卖GMVの数値（K=千、M=百万に変換）
- fixedPriceGmv: 一口价GMVの数値
- duration: 直播時長（例: "6小时3分钟"）
- livestreamDate: 直播日期（例: "2026-08-17"）
- tiktokUsername: 主播のTikTokユーザー名

重要ルール:
- GMVの数値は必ず円(¥)単位の数値で返す
- "K"は×1000、"M"は×1000000に変換
- 例: "152.46K" → 152460, "2.19M" → 2190000
- 見つからない項目はnullで返す
- 必ず有効なJSONのみを返す（説明文不要）`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "この直播大屏スクリーンショットからGMVデータを抽出してください。" },
              { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.screenshotBase64}`, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "gmv_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                gmv: { type: ["number", "null"], description: "Total GMV in JPY" },
                auctionGmv: { type: ["number", "null"], description: "Auction GMV in JPY" },
                fixedPriceGmv: { type: ["number", "null"], description: "Fixed price GMV in JPY" },
                duration: { type: ["string", "null"], description: "Livestream duration" },
                livestreamDate: { type: ["string", "null"], description: "Livestream date YYYY-MM-DD" },
                tiktokUsername: { type: ["string", "null"], description: "TikTok username" },
              },
              required: ["gmv", "auctionGmv", "fixedPriceGmv", "duration", "livestreamDate", "tiktokUsername"],
              additionalProperties: false,
            },
          },
        },
      });

      // Parse AI response
      let aiData: any = {};
      try {
        const content = aiResult.choices?.[0]?.message?.content;
        if (content) {
          aiData = JSON.parse(content);
        }
      } catch (e) {
        console.error("[Ranking] AI parse error:", e);
      }
      const parsedAiData = recognizedRankingSchema.safeParse(aiData);
      if (!parsedAiData.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "画像から有効なGMVデータを読み取れませんでした。鮮明なスクリーンショットで再度お試しください。" });
      }
      aiData = parsedAiData.data;

      // 2. Upload only after successful validation so invalid submissions do not leave orphan objects.
      const extension = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const fileKey = `ranking-screenshots/${user.accountId}/${nanoid()}.${extension}`;
      const { url: screenshotUrl } = await storagePut(fileKey, buffer, input.mimeType);

      // 3. Get liver display name from account
      const [accountRows] = await pool.query(
        `SELECT display_name FROM festival_accounts WHERE id = ?`,
        [user.accountId]
      ) as any;
      const liverName = accountRows?.[0]?.display_name || user.email;

      // 4. Insert submission
      const [result] = await pool.query(
        `INSERT INTO lcf_ranking_submissions (accountId, liverName, gmv, auctionGmv, fixedPriceGmv, duration, livestreamDate, tiktokUsername, screenshotUrl, aiRawData, status, imageHash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
       [
         user.accountId,
         liverName,
         aiData.gmv ?? 0,
         aiData.auctionGmv ?? 0,
         aiData.fixedPriceGmv ?? 0,
         aiData.duration || null,
         aiData.livestreamDate || null,
         aiData.tiktokUsername || null,
         screenshotUrl,
         JSON.stringify(aiData),
         imageHash,
       ]
      ) as any;

      return {
        success: true,
        submissionId: result.insertId,
        recognizedData: aiData,
        screenshotUrl,
      };
    }),

  // Get my submissions (for mypage)
  mySubmissions: festivalUserProcedure
    .query(async ({ ctx }) => {
      await ensureRankingTable();
      const pool = getPool();
      const user = (ctx as any).festivalUser;
      const [rows] = await pool.query(
        `SELECT * FROM lcf_ranking_submissions WHERE accountId = ? ORDER BY submittedAt DESC`,
        [user.accountId]
      ) as any;
      return rows;
    }),

  // Public ranking (approved submissions only, ranked by GMV)
  getRanking: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      await ensureRankingTable();
      const pool = getPool();
      const limit = input?.limit || 50;
      
      // Public output contains one deterministic best, approved submission per account.
      // Screenshot evidence and pending/rejected rows are never exposed publicly.
      const [rows] = await pool.query(`
        SELECT id, accountId, liverName, tiktokUsername, gmv,
               auctionGmv, fixedPriceGmv, duration, livestreamDate,
               status, submittedAt, approvedAt
        FROM (
          SELECT r.*,
                 ROW_NUMBER() OVER (PARTITION BY CASE WHEN r.accountId = 0 THEN -r.id ELSE r.accountId END ORDER BY r.gmv DESC, r.approvedAt ASC, r.id ASC) AS rowNum
          FROM lcf_ranking_submissions r
          WHERE r.status = 'approved' AND r.gmv >= 0
        ) ranked
        WHERE rowNum = 1
        ORDER BY gmv DESC, approvedAt ASC, id ASC
        LIMIT ?
      `, [limit]) as any;

      return rows;
    }),

  // Admin: list all submissions
  adminList: festivalAdminProcedure
    .input(z.object({
      status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
      search: z.string().trim().max(255).optional(),
    }).optional())
    .query(async ({ input }) => {
      await ensureRankingTable();
      const pool = getPool();
      let where = "WHERE 1=1";
      const params: any[] = [];
      
      if (input?.status && input.status !== "all") {
        where += " AND status = ?";
        params.push(input.status);
      }
      if (input?.search) {
        where += " AND (liverName LIKE ? OR tiktokUsername LIKE ?)";
        params.push(`%${input.search}%`, `%${input.search}%`);
      }

      const [rows] = await pool.query(
        `SELECT * FROM lcf_ranking_submissions ${where} ORDER BY submittedAt DESC`,
        params
      ) as any;
      return rows;
    }),

  // Admin: approve/reject submission
  adminUpdateStatus: festivalAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().trim().max(2000).optional(),
      gmv: z.number().finite().min(0).max(1_000_000_000_000_000).optional(),
      auctionGmv: z.number().finite().min(0).max(1_000_000_000_000_000).optional(),
      fixedPriceGmv: z.number().finite().min(0).max(1_000_000_000_000_000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureRankingTable();
      const pool = getPool();
      
      const adminEmail = (ctx as any).lcfAdmin?.email || (ctx as any).user?.email || "admin";
      
      const updates: string[] = ["status = ?", "approvedBy = ?", "approvedAt = ?"];
      const params: any[] = [input.status, input.status === 'approved' ? adminEmail : null, input.status === 'approved' ? new Date() : null];
      
      if (input.adminNote !== undefined) {
        updates.push("adminNote = ?");
        params.push(input.adminNote);
      }
      if (input.gmv !== undefined) {
        updates.push("gmv = ?");
        params.push(input.gmv);
      }
      if (input.auctionGmv !== undefined) {
        updates.push("auctionGmv = ?");
        params.push(input.auctionGmv);
      }
      if (input.fixedPriceGmv !== undefined) {
        updates.push("fixedPriceGmv = ?");
        params.push(input.fixedPriceGmv);
      }
      
      params.push(input.id);
      const [result] = await pool.query(
        `UPDATE lcf_ranking_submissions SET ${updates.join(", ")} WHERE id = ?`,
        params
      ) as any;
      if (!result.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "ランキング投稿が見つかりません" });

      return { success: true };
    }),

  // Admin: delete submission
  adminDelete: festivalAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await ensureRankingTable();
      const pool = getPool();
      const [result] = await pool.query(`DELETE FROM lcf_ranking_submissions WHERE id = ?`, [input.id]) as any;
      if (!result.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "ランキング投稿が見つかりません" });
      return { success: true };
    }),

  // Admin: manually add a submission
  adminAdd: festivalAdminProcedure
    .input(z.object({
      liverName: z.string().trim().min(1).max(255),
      gmv: z.number().finite().min(0).max(1_000_000_000_000_000),
      auctionGmv: z.number().finite().min(0).max(1_000_000_000_000_000).default(0),
      fixedPriceGmv: z.number().finite().min(0).max(1_000_000_000_000_000).default(0),
      duration: z.string().trim().max(100).optional(),
      livestreamDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください").optional(),
      tiktokUsername: z.string().trim().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureRankingTable();
      const pool = getPool();
      const adminEmail = (ctx as any).lcfAdmin?.email || (ctx as any).user?.email || "admin";
      
      const [result] = await pool.query(
        `INSERT INTO lcf_ranking_submissions (accountId, liverName, gmv, auctionGmv, fixedPriceGmv, duration, livestreamDate, tiktokUsername, status, approvedBy, approvedAt)
         VALUES (0, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
        [input.liverName, input.gmv, input.auctionGmv, input.fixedPriceGmv, input.duration || null, input.livestreamDate || null, input.tiktokUsername || null, adminEmail]
      ) as any;

      return { success: true, id: result.insertId };
    }),
});
