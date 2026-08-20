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
import { verifyFestivalToken } from "./festivalAuthRouter";
import { nanoid } from "nanoid";

// Direct mysql2 connection pool
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

// Cookie helper
function getCookie(req: any, name: string): string | undefined {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c: string) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=').trim();
}

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

// Festival auth procedure (requires lcf_token login)
const festivalUserProcedure = t.procedure.use(async ({ ctx, next }) => {
  const token = getCookie(ctx.req, 'lcf_token');
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください" });
  }
  const payload = await verifyFestivalToken(token);
  if (!payload) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
  }
  return next({ ctx: { ...ctx, festivalUser: payload } as any });
});

// Festival admin procedure
const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if ((ctx as any).user) return next({ ctx });
  const token = getCookie(ctx.req, 'lcf_token');
  if (token) {
    const payload = await verifyFestivalToken(token);
    if (payload && payload.role === "admin") {
      return next({ ctx: { ...ctx, lcfAdmin: payload } as any });
    }
  }
  throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
});

export const rankingRouter = router({
  // Submit ranking screenshot (liver uploads from mypage)
  submit: festivalUserProcedure
    .input(z.object({
      screenshotBase64: z.string().min(1, "スクリーンショットをアップロードしてください"),
      fileName: z.string().default("screenshot.jpg"),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureRankingTable();
      const pool = getPool();
      const user = (ctx as any).festivalUser;

      // 1. Upload screenshot to S3
      const buffer = Buffer.from(input.screenshotBase64, "base64");
      const fileKey = `ranking-screenshots/${user.accountId}/${nanoid()}.${input.fileName.split('.').pop() || 'jpg'}`;
      const { url: screenshotUrl } = await storagePut(fileKey, buffer, input.mimeType);

      // 2. AI Recognition - analyze the TikTok livestream dashboard screenshot
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

      // 3. Get liver display name from account
      const [accountRows] = await pool.query(
        `SELECT display_name FROM festival_accounts WHERE id = ?`,
        [user.accountId]
      ) as any;
      const liverName = accountRows?.[0]?.display_name || user.email;

      // 4. Insert submission
      const [result] = await pool.query(
        `INSERT INTO lcf_ranking_submissions (accountId, liverName, gmv, auctionGmv, fixedPriceGmv, duration, livestreamDate, tiktokUsername, screenshotUrl, aiRawData, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          user.accountId,
          liverName,
          aiData.gmv || 0,
          aiData.auctionGmv || 0,
          aiData.fixedPriceGmv || 0,
          aiData.duration || null,
          aiData.livestreamDate || null,
          aiData.tiktokUsername || null,
          screenshotUrl,
          JSON.stringify(aiData),
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
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      await ensureRankingTable();
      const pool = getPool();
      const limit = input?.limit || 50;
      
      // Get the highest GMV per liver (approved only)
      const [rows] = await pool.query(`
        SELECT r.*
        FROM lcf_ranking_submissions r
        INNER JOIN (
          SELECT accountId, MAX(gmv) as maxGmv
          FROM lcf_ranking_submissions
          WHERE status = 'approved'
          GROUP BY accountId
        ) best ON r.accountId = best.accountId AND r.gmv = best.maxGmv
        WHERE r.status = 'approved'
        GROUP BY r.accountId
        ORDER BY r.gmv DESC
        LIMIT ?
      `, [limit]) as any;

      return rows;
    }),

  // Admin: list all submissions
  adminList: festivalAdminProcedure
    .input(z.object({
      status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
      search: z.string().optional(),
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
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
      gmv: z.number().optional(),
      auctionGmv: z.number().optional(),
      fixedPriceGmv: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureRankingTable();
      const pool = getPool();
      
      const adminEmail = (ctx as any).lcfAdmin?.email || (ctx as any).user?.email || "admin";
      
      const updates: string[] = ["status = ?", "approvedBy = ?", "approvedAt = NOW()"];
      const params: any[] = [input.status, adminEmail];
      
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
      await pool.query(
        `UPDATE lcf_ranking_submissions SET ${updates.join(", ")} WHERE id = ?`,
        params
      );

      return { success: true };
    }),

  // Admin: delete submission
  adminDelete: festivalAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await ensureRankingTable();
      const pool = getPool();
      await pool.query(`DELETE FROM lcf_ranking_submissions WHERE id = ?`, [input.id]);
      return { success: true };
    }),

  // Admin: manually add a submission
  adminAdd: festivalAdminProcedure
    .input(z.object({
      liverName: z.string().min(1),
      gmv: z.number().min(0),
      auctionGmv: z.number().default(0),
      fixedPriceGmv: z.number().default(0),
      duration: z.string().optional(),
      livestreamDate: z.string().optional(),
      tiktokUsername: z.string().optional(),
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
