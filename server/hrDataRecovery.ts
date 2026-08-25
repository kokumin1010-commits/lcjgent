import mysql, { type Connection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "hr-users-to-staff-v1";
const PRE_BACKUP_REASON = "pre-hr-recovery-v1";
const POST_BACKUP_REASON = "post-hr-recovery-v1";

async function ensureMarkerTable(connection: Connection): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS \`hr_recovery_markers\` (
    \`recoveryKey\` varchar(100) NOT NULL,
    \`status\` varchar(20) NOT NULL,
    \`details\` json DEFAULT NULL,
    \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completedAt\` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (\`recoveryKey\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function verifyBackup(connection: Connection, reason: string): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT status, tableCount, rowCount, completedAt FROM db_backup_runs WHERE reason = ? ORDER BY id DESC LIMIT 1",
    [reason],
  );
  if (!rows[0] || rows[0].status !== "success") {
    throw new Error(`required backup did not complete successfully: ${reason}`);
  }
}

async function recoverStaffFromUsers(connection: Connection) {
  const [adminUsers] = await connection.query<RowDataPacket[]>(
    `SELECT id, email, name, role, createdAt, updatedAt
     FROM users
     WHERE role = 'admin' AND email IS NOT NULL AND email <> ''
     ORDER BY id`,
  );

  let staffInserted = 0;
  let reportStaffInserted = 0;
  const recovered: Array<{ userId: number; staffId: number; reportStaffId: number; email: string }> = [];

  for (const user of adminUsers) {
    const email = String(user.email).trim().toLowerCase();
    const name = String(user.name || email.split("@")[0] || "管理者").trim();
    const [existingStaff] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM staff WHERE LOWER(email) = ? ORDER BY id LIMIT 1",
      [email],
    );

    let staffId = existingStaff[0] ? Number(existingStaff[0].id) : 0;
    if (!staffId) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO staff
          (name, email, country, notes, employmentType, isActive, createdAt, updatedAt)
         VALUES (?, ?, NULL, ?, 'fulltime', 'active', ?, ?)`,
        [
          name,
          email,
          "users管理者アカウントから復旧。部署・役職・入社日・給与・評価等の元データは旧バックアップに存在しないため未設定。",
          user.createdAt,
          user.updatedAt,
        ],
      );
      staffId = Number(result.insertId);
      staffInserted++;
    }

    const [existingReportStaff] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM report_staff
       WHERE linkedStaffId = ? OR (name = ? AND isActive = 'active')
       ORDER BY linkedStaffId IS NULL, id LIMIT 1`,
      [staffId, name],
    );
    let reportStaffId = existingReportStaff[0] ? Number(existingReportStaff[0].id) : 0;
    if (!reportStaffId) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO report_staff (name, country, linkedStaffId, isActive, createdAt, updatedAt)
         VALUES (?, 'その他', ?, 'active', ?, ?)`,
        [name, staffId, user.createdAt, user.updatedAt],
      );
      reportStaffId = Number(result.insertId);
      reportStaffInserted++;
    } else {
      await connection.execute(
        "UPDATE report_staff SET linkedStaffId = COALESCE(linkedStaffId, ?), isActive = 'active' WHERE id = ?",
        [staffId, reportStaffId],
      );
    }

    recovered.push({ userId: Number(user.id), staffId, reportStaffId, email });
  }

  return { adminUsers: adminUsers.length, staffInserted, reportStaffInserted, recovered };
}

export async function runHrDataRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for HR recovery");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureMarkerTable(connection);
    const [markers] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM hr_recovery_markers WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    if (markers[0]?.status === "success") {
      console.log(`[HrRecovery] already complete key=${RECOVERY_KEY}`);
      return;
    }

    await connection.execute(
      `INSERT INTO hr_recovery_markers (recoveryKey, status, details, startedAt, completedAt)
       VALUES (?, 'running', NULL, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE status='running', details=NULL, startedAt=CURRENT_TIMESTAMP, completedAt=NULL`,
      [RECOVERY_KEY],
    );

    await runDatabaseBackup(PRE_BACKUP_REASON);
    await verifyBackup(connection, PRE_BACKUP_REASON);

    await connection.beginTransaction();
    let recovery;
    try {
      recovery = await recoverStaffFromUsers(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    await runDatabaseBackup(POST_BACKUP_REASON);
    await verifyBackup(connection, POST_BACKUP_REASON);

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
    const details = { ...recovery, finalCounts: counts[0] };
    await connection.execute(
      "UPDATE hr_recovery_markers SET status='success', details=?, completedAt=CURRENT_TIMESTAMP WHERE recoveryKey=?",
      [JSON.stringify(details), RECOVERY_KEY],
    );
    console.log(`[HrRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await connection.execute(
      "UPDATE hr_recovery_markers SET status='failed', details=?, completedAt=CURRENT_TIMESTAMP WHERE recoveryKey=?",
      [JSON.stringify({ error: message.slice(0, 3000) }), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[HrRecovery] failed", error);
    throw error;
  } finally {
    await connection.end();
  }
}
