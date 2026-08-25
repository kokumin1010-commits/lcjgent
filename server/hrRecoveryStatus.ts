import type { Express } from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";

const STATUS_TOKEN = "e3e6ffef0069bb99a38f99181c288f2cc82e52330c9d85e65fd853eee7f663e0";

export function registerHrRecoveryStatus(app: Express): void {
  app.get(`/api/internal/hr-recovery/${STATUS_TOKEN}`, async (_req, res) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return res.status(503).json({ error: "database unavailable" });
    const connection = await mysql.createConnection(databaseUrl);
    try {
      const [counts] = await connection.query<RowDataPacket[]>(`
        SELECT
          (SELECT COUNT(*) FROM staff) AS staff,
          (SELECT COUNT(*) FROM report_staff) AS reportStaff,
          (SELECT COUNT(*) FROM users) AS users,
          (SELECT COUNT(*) FROM tasks) AS tasks,
          (SELECT COUNT(*) FROM task_staff) AS taskStaff,
          (SELECT COUNT(*) FROM daily_reports) AS dailyReports,
          (SELECT COUNT(*) FROM staff_schedules) AS staffSchedules,
          (SELECT COUNT(*) FROM staff_ai_profiles) AS staffAiProfiles,
          (SELECT COUNT(*) FROM recruitment_brands) AS recruitmentBrands,
          (SELECT COUNT(*) FROM recruitment_email_logs) AS recruitmentEmailLogs,
          (SELECT COUNT(*) FROM recruitment_email_templates) AS recruitmentEmailTemplates,
          (SELECT COUNT(*) FROM recruitment_follow_records) AS recruitmentFollowRecords,
          (SELECT COUNT(*) FROM recruitment_status_history) AS recruitmentStatusHistory,
          (SELECT COUNT(*) FROM lcj_coin_tier_templates) AS coinTierTemplates,
          (SELECT COUNT(*) FROM lcj_coin_settings) AS coinSettings
      `);
      const [marker] = await connection.query<RowDataPacket[]>(
        "SELECT recoveryKey, status, details, startedAt, completedAt FROM hr_recovery_markers WHERE recoveryKey='hr-users-to-staff-v1' LIMIT 1",
      );
      const [staff] = await connection.query<RowDataPacket[]>(
        `SELECT s.id, s.name, s.email, s.department, s.position, s.country, s.employmentType, s.isActive,
                rs.id AS reportStaffId, rs.country AS reportStaffCountry, rs.isActive AS reportStaffIsActive
         FROM staff s
         LEFT JOIN report_staff rs ON rs.linkedStaffId = s.id
         ORDER BY s.id`,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, counts: counts[0], marker: marker[0] || null, staff });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      await connection.end();
    }
  });
}
