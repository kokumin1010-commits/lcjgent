import type { Express } from "express";
import mysql from "mysql2/promise";

const STATUS_TOKEN = "f4264fce43807c001e78d2a0a29ad523d57754ac89609bdcbd62041a18aa2b1f";

const COUNT_TABLES = [
  "users",
  "livers",
  "staff",
  "tasks",
  "blog_articles",
  "auto_post_logs",
  "ai_auto_review_logs",
  "managed_stores",
  "brands",
  "line_users",
  "line_groups",
  "line_point_balances",
  "mall_products",
  "mall_orders",
  "schedules",
  "festival_accounts",
  "festival_company_applications",
  "festival_general_applications",
  "festival_liver_applications",
] as const;

export function registerRecoveryStatusRoute(app: Express): void {
  app.get(`/api/internal/recovery-status/${STATUS_TOKEN}`, async (_req, res) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
    }

    const connection = await mysql.createConnection(databaseUrl);
    try {
      const counts: Record<string, number> = {};
      for (const table of COUNT_TABLES) {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
        counts[table] = Number(rows[0]?.count ?? 0);
      }

      const [markerRows] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT marker, checksum, details, appliedAt FROM `_lcj_recovery_markers` WHERE marker = ? LIMIT 1",
        ["evidence-recovery-2026-08-25-v1"],
      );
      const [taskRows] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT id, taskId, status FROM `tasks` WHERE id = ? LIMIT 1",
        [120006],
      );
      const [blogRows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT id, slug, status FROM `blog_articles` ORDER BY id",
      );
      const [autoPostRows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT id, status FROM `auto_post_logs` ORDER BY id",
      );
      const [aiReviewRows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT id, aiDecision FROM `ai_auto_review_logs` ORDER BY id",
      );

      const host = (() => {
        try {
          return new URL(databaseUrl).hostname;
        } catch {
          return "unparseable";
        }
      })();

      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.json({
        ok: true,
        databaseHost: host,
        counts,
        recoveryMarker: markerRows[0] ?? null,
        recovered: {
          task: taskRows[0] ?? null,
          blogs: blogRows,
          autoPostLogs: autoPostRows,
          aiReviewLogs: aiReviewRows,
        },
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[RecoveryStatus] validation failed", error);
      return res.status(500).json({ ok: false, error: "validation failed" });
    } finally {
      await connection.end();
    }
  });
}
