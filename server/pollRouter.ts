import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import mysql from "mysql2/promise";

// Direct mysql2 connection pool
let _pool: mysql.Pool | null = null;
let _tablesChecked = false;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

async function ensureTables() {
  if (_tablesChecked) return;
  const pool = getPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS polls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT,
      productName VARCHAR(500) NOT NULL,
      brandName VARCHAR(255),
      imageUrl TEXT,
      description TEXT,
      originalPrice DECIMAL(12,2),
      status ENUM('active','closed','draft') NOT NULL DEFAULT 'active',
      expiresAt TIMESTAMP NULL,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pollId INT NOT NULL,
      desiredPrice DECIMAL(12,2) NOT NULL,
      nickname VARCHAR(100),
      ipAddress VARCHAR(45),
      fingerprint VARCHAR(64),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_poll_votes_pollId (pollId)
    )
  `);
  _tablesChecked = true;
}

export const pollRouter = router({
  // ========== 管理側 API ==========

  // 投票を作成
  create: protectedProcedure
    .input(z.object({
      productId: z.number().optional(),
      productName: z.string().min(1),
      brandName: z.string().optional(),
      imageUrl: z.string().optional(),
      description: z.string().optional(),
      originalPrice: z.number().optional(),
      expiresAt: z.string().optional(), // ISO date string
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureTables();
      const pool = getPool();
      const [result] = await pool.execute(
        `INSERT INTO polls (productId, productName, brandName, imageUrl, description, originalPrice, status, expiresAt, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          input.productId || null,
          input.productName,
          input.brandName || null,
          input.imageUrl || null,
          input.description || null,
          input.originalPrice || null,
          input.expiresAt || null,
          ctx.user.id,
        ]
      );
      const insertId = (result as any).insertId;
      return { id: insertId, url: `/vote/${insertId}` };
    }),

  // 投票一覧取得（管理側）
  list: protectedProcedure.query(async () => {
    await ensureTables();
    const pool = getPool();
    const [polls] = await pool.execute(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM poll_votes WHERE pollId = p.id) as voteCount,
        (SELECT AVG(desiredPrice) FROM poll_votes WHERE pollId = p.id) as avgPrice,
        (SELECT MIN(desiredPrice) FROM poll_votes WHERE pollId = p.id) as minPrice,
        (SELECT MAX(desiredPrice) FROM poll_votes WHERE pollId = p.id) as maxPrice
       FROM polls p ORDER BY p.createdAt DESC`
    );
    return polls as any[];
  }),

  // 投票詳細取得（管理側 - 全投票データ含む）
  getDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const pool = getPool();
      const [polls] = await pool.execute(
        `SELECT * FROM polls WHERE id = ?`, [input.id]
      );
      const poll = (polls as any[])[0];
      if (!poll) return null;

      const [votes] = await pool.execute(
        `SELECT desiredPrice, nickname, createdAt FROM poll_votes WHERE pollId = ? ORDER BY createdAt DESC`,
        [input.id]
      );
      // Calculate stats from the prices array directly
      const [allPrices] = await pool.execute(
        `SELECT desiredPrice FROM poll_votes WHERE pollId = ? ORDER BY desiredPrice`,
        [input.id]
      );
      const prices = (allPrices as any[]).map(r => Number(r.desiredPrice));
      const median = prices.length > 0 
        ? prices[Math.floor(prices.length / 2)] 
        : 0;

      return {
        ...poll,
        votes: votes as any[],
        stats: {
          total: (votes as any[]).length,
          avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
          min: prices.length > 0 ? Math.min(...prices) : 0,
          max: prices.length > 0 ? Math.max(...prices) : 0,
          median,
        },
      };
    }),

  // 投票ステータス変更
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["active", "closed", "draft"]) }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.execute(`UPDATE polls SET status = ? WHERE id = ?`, [input.status, input.id]);
      return { success: true };
    }),

  // 投票削除
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.execute(`DELETE FROM poll_votes WHERE pollId = ?`, [input.id]);
      await pool.execute(`DELETE FROM polls WHERE id = ?`, [input.id]);
      return { success: true };
    }),

  // ========== 公開 API（お客さん用） ==========

  // 投票ページ用データ取得（ログイン不要）
  getPublic: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      await ensureTables();
      const pool = getPool();
      const [polls] = await pool.execute(
        `SELECT id, productName, brandName, imageUrl, description, originalPrice, status, expiresAt FROM polls WHERE id = ?`,
        [input.id]
      );
      const poll = (polls as any[])[0];
      if (!poll) return null;

      // 投票統計（個別の投票データは公開しない）
      const [votes] = await pool.execute(
        `SELECT COUNT(*) as total, AVG(desiredPrice) as avg FROM poll_votes WHERE pollId = ?`,
        [input.id]
      );
      const stats = (votes as any[])[0];

      return {
        ...poll,
        voteCount: Number(stats.total) || 0,
        avgPrice: stats.avg ? Number(stats.avg) : null,
      };
    }),

  // 投票する（ログイン不要）
  vote: publicProcedure
    .input(z.object({
      pollId: z.number(),
      desiredPrice: z.number().min(1),
      nickname: z.string().optional(),
      fingerprint: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureTables();
      const pool = getPool();

      // Check if poll is active
      const [polls] = await pool.execute(
        `SELECT status, expiresAt FROM polls WHERE id = ?`, [input.pollId]
      );
      const poll = (polls as any[])[0];
      if (!poll) throw new Error("投票が見つかりません");
      if (poll.status !== "active") throw new Error("この投票は終了しています");
      if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
        throw new Error("投票期限が過ぎています");
      }

      // Get IP from request context (best effort)
      const ip = (ctx as any).req?.headers?.["x-forwarded-for"] || 
                 (ctx as any).req?.headers?.["x-real-ip"] || 
                 (ctx as any).req?.socket?.remoteAddress || null;

      // Check for duplicate vote (same IP + fingerprint within 24h)
      if (input.fingerprint) {
        const [existing] = await pool.execute(
          `SELECT id FROM poll_votes WHERE pollId = ? AND fingerprint = ? AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
          [input.pollId, input.fingerprint]
        );
        if ((existing as any[]).length > 0) {
          throw new Error("既に投票済みです（24時間以内に1回まで）");
        }
      }

      await pool.execute(
        `INSERT INTO poll_votes (pollId, desiredPrice, nickname, ipAddress, fingerprint) VALUES (?, ?, ?, ?, ?)`,
        [input.pollId, input.desiredPrice, input.nickname || null, ip, input.fingerprint || null]
      );

      // Return updated stats
      const [stats] = await pool.execute(
        `SELECT COUNT(*) as total, AVG(desiredPrice) as avg FROM poll_votes WHERE pollId = ?`,
        [input.pollId]
      );
      const s = (stats as any[])[0];
      return {
        success: true,
        voteCount: Number(s.total),
        avgPrice: Number(s.avg),
      };
    }),
});
