import crypto from "node:crypto";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import evidence from "./hr36DirectoryEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "hr-36-directory-v1-2026-08-25";
const RECOVERY_SOURCE = `hr36:${evidence.sourceDatasetSha256}`;
const PRE_BACKUP_REASON = "pre-hr-dir-v2";
const POST_BACKUP_REASON = "post-hr-dir-v2";
type EvidencePerson = (typeof evidence.people)[number];

function placeholderEmail(person: EvidencePerson): string {
  const digest = crypto.createHash("sha256").update(`${person.name}:${person.roleSignal}`).digest("hex").slice(0, 20);
  return `recovered-hr-${digest}@unverified.lcj.local`;
}

async function ensureStaffEvidenceColumns(pool: Pool): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM staff");
  const existing = new Set(rows.map((row) => String(row.Field)));
  const additions: Array<[string, string]> = [
    ["employmentTypeEvidence", "varchar(16) NOT NULL DEFAULT 'verified'"],
    ["emailEvidenceStatus", "varchar(16) NOT NULL DEFAULT 'verified'"],
    ["directoryClass", "varchar(40) NOT NULL DEFAULT 'manual_staff'"],
    ["evidenceStatus", "varchar(32) NOT NULL DEFAULT 'manual'"],
    ["evidenceAsOfDate", "varchar(10) NULL"],
    ["evidenceSource", "text NULL"],
    ["aliases", "json NULL"],
  ];
  for (const [column, definition] of additions) {
    if (!existing.has(column)) {
      await pool.execute(`ALTER TABLE staff ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

async function ensureRecoveryTable(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS \`hr_directory_recovery_runs\` (
    \`id\` bigint NOT NULL AUTO_INCREMENT,
    \`recoveryKey\` varchar(100) NOT NULL,
    \`status\` varchar(20) NOT NULL,
    \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completedAt\` timestamp NULL DEFAULT NULL,
    \`directoryCount\` int NOT NULL DEFAULT 0,
    \`currentCount\` int NOT NULL DEFAULT 0,
    \`historicalUnknownCount\` int NOT NULL DEFAULT 0,
    \`affiliationUnknownCount\` int NOT NULL DEFAULT 0,
    \`details\` json DEFAULT NULL,
    \`errorMessage\` text DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`hr_directory_recovery_key_unique\` (\`recoveryKey\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs").catch(() => [[], []] as any);
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const before = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
    [before, reason],
  );
  const row = rows[0];
  if (!row || row.status !== "success") {
    throw new Error(`required database backup failed reason=${reason}: ${String(row?.errorMessage || "missing success run")}`);
  }
  return Number(row.id);
}

async function findStaff(connection: PoolConnection, person: EvidencePerson): Promise<RowDataPacket | undefined> {
  if (person.email) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM staff WHERE LOWER(email) = LOWER(?) ORDER BY id LIMIT 1 FOR UPDATE",
      [person.email],
    );
    if (rows[0]) return rows[0];
  }
  const names = [person.name, ...person.aliases].filter(Boolean);
  const placeholders = names.map(() => "?").join(",");
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM staff WHERE LOWER(name) IN (${placeholders}) ORDER BY id LIMIT 1 FOR UPDATE`,
    names.map((name) => name.toLowerCase()),
  );
  return rows[0];
}

async function upsertPerson(connection: PoolConnection, person: EvidencePerson): Promise<{ staffId: number; created: boolean }> {
  const existing = await findStaff(connection, person);
  const existingVerifiedEmail = existing?.email
    && existing.emailEvidenceStatus !== "unverified"
    && !String(existing.email).endsWith("@unverified.lcj.local")
    ? String(existing.email)
    : null;
  const verifiedEmail = Boolean(person.email || existingVerifiedEmail);
  const email = person.email || existingVerifiedEmail || placeholderEmail(person);
  const active = person.evidenceStatus === "current_active";
  const notes = [
    `HR人物目录復旧 (${evidence.asOfDate})`,
    `証拠状態: ${person.evidenceStatus}`,
    `役割シグナル: ${person.roleSignal}`,
    "雇用形態は直接証拠なし。fulltime既定値を画面表示に使用しない。",
    verifiedEmail ? "メールは保存済みアカウント証拠あり。" : "メール未復元。システム占位アドレス。",
  ].join("\n");
  const values = [
    person.name,
    email,
    verifiedEmail ? "verified" : "unverified",
    person.directoryClass,
    person.evidenceStatus,
    evidence.asOfDate,
    RECOVERY_SOURCE,
    JSON.stringify(person.aliases),
    active ? "active" : "inactive",
    notes,
  ];

  let staffId: number;
  let created = false;
  if (existing) {
    staffId = Number(existing.id);
    const preserveInactive = Boolean(existing.resignDate);
    if (existing.manualRevisionAt) {
      // Manual HR values are authoritative. Recovery may only refresh evidence lineage.
      await connection.execute(
        `UPDATE staff SET directoryClass=?, evidenceStatus=?, evidenceAsOfDate=?, evidenceSource=?, aliases=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
        [person.directoryClass, person.evidenceStatus, evidence.asOfDate, RECOVERY_SOURCE, JSON.stringify(person.aliases), staffId],
      );
    } else {
      await connection.execute(
        `UPDATE staff SET name=?, email=?, emailEvidenceStatus=?, directoryClass=?, evidenceStatus=?,
         evidenceAsOfDate=?, evidenceSource=?, aliases=?, employmentTypeEvidence='unverified',
         isActive=?, notes=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
        [...values.slice(0, 8), preserveInactive ? "inactive" : values[8], values[9], staffId],
      );
    }
  } else {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO staff
       (name, email, country, notes, employmentType, employmentTypeEvidence, emailEvidenceStatus,
        directoryClass, evidenceStatus, evidenceAsOfDate, evidenceSource, aliases, isActive, createdAt, updatedAt)
       VALUES (?, ?, '未確認', ?, 'fulltime', 'unverified', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [person.name, email, notes, verifiedEmail ? "verified" : "unverified", person.directoryClass,
       person.evidenceStatus, evidence.asOfDate, RECOVERY_SOURCE, JSON.stringify(person.aliases), active ? "active" : "inactive"],
    );
    staffId = Number(result.insertId);
    created = true;
  }

  const [reportRows] = await connection.query<RowDataPacket[]>(
    "SELECT id, linkedStaffId, manualRevisionAt FROM report_staff WHERE linkedStaffId = ? OR LOWER(name) = LOWER(?) ORDER BY linkedStaffId IS NULL, id LIMIT 1 FOR UPDATE",
    [staffId, person.name],
  );
  if (reportRows[0]) {
    if (reportRows[0].manualRevisionAt) {
      await connection.execute(
        "UPDATE report_staff SET linkedStaffId=COALESCE(linkedStaffId, ?), updatedAt=CURRENT_TIMESTAMP WHERE id=?",
        [staffId, Number(reportRows[0].id)],
      );
    } else {
      await connection.execute(
        "UPDATE report_staff SET name=?, country=COALESCE(NULLIF(country, ''), '未確認'), linkedStaffId=?, isActive=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?",
        [person.name, staffId, active ? "active" : "inactive", Number(reportRows[0].id)],
      );
    }
  } else {
    await connection.execute(
      "INSERT INTO report_staff (name, country, linkedStaffId, isActive, createdAt, updatedAt) VALUES (?, '未確認', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [person.name, staffId, active ? "active" : "inactive"],
    );
  }
  return { staffId, created };
}

async function getCounts(pool: Pool): Promise<Record<string, number>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS directoryCount,
       SUM(evidenceStatus='current_active') AS currentCount,
       SUM(evidenceStatus='historical_unknown') AS historicalUnknownCount,
       SUM(evidenceStatus='affiliation_unknown') AS affiliationUnknownCount,
       SUM(employmentTypeEvidence='unverified') AS employmentTypeUnverifiedCount,
       SUM(manualRevisionAt IS NOT NULL AND employmentTypeEvidence='verified') AS manualVerifiedEmploymentCount,
       SUM(manualRevisionAt IS NOT NULL) AS manualRevisionCount,
       SUM(emailEvidenceStatus='unverified') AS emailUnverifiedCount,
       SUM(evidenceStatus='current_active' AND (manualRevisionAt IS NOT NULL OR isActive='active' OR (isActive='inactive' AND resignDate IS NOT NULL))) AS operationalCurrentConsistentCount,
       SUM(evidenceStatus<>'current_active' AND (manualRevisionAt IS NOT NULL OR isActive='inactive')) AS operationalNonCurrentInactiveCount
     FROM staff WHERE evidenceSource=?`,
    [RECOVERY_SOURCE],
  );
  const row = rows[0] || {};
  return {
    directoryCount: Number(row.directoryCount || 0),
    currentCount: Number(row.currentCount || 0),
    historicalUnknownCount: Number(row.historicalUnknownCount || 0),
    affiliationUnknownCount: Number(row.affiliationUnknownCount || 0),
    employmentTypeUnverifiedCount: Number(row.employmentTypeUnverifiedCount || 0),
    manualVerifiedEmploymentCount: Number(row.manualVerifiedEmploymentCount || 0),
    manualRevisionCount: Number(row.manualRevisionCount || 0),
    emailUnverifiedCount: Number(row.emailUnverifiedCount || 0),
    operationalCurrentConsistentCount: Number(row.operationalCurrentConsistentCount || 0),
    operationalNonCurrentInactiveCount: Number(row.operationalNonCurrentInactiveCount || 0),
  };
}

function countsHealthy(counts: Record<string, number>): boolean {
  return counts.directoryCount === evidence.counts.totalDirectoryPeople
    && counts.currentCount === evidence.counts.currentActiveVerified
    && counts.historicalUnknownCount === evidence.counts.historicalStatusUnknown
    && counts.affiliationUnknownCount === evidence.counts.affiliationUnknown
    && counts.employmentTypeUnverifiedCount + counts.manualVerifiedEmploymentCount === evidence.counts.totalDirectoryPeople
    && counts.operationalCurrentConsistentCount === evidence.counts.currentActiveVerified
    && counts.operationalNonCurrentInactiveCount === evidence.counts.historicalStatusUnknown + evidence.counts.affiliationUnknown;
}

export async function getHr36DirectoryRecoveryHealth(): Promise<Record<string, unknown>> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for HR directory health");
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 });
  try {
    await ensureStaffEvidenceColumns(pool);
    await ensureRecoveryTable(pool);
    const counts = await getCounts(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      `SELECT status, completedAt, directoryCount, currentCount, historicalUnknownCount,
       affiliationUnknownCount, errorMessage, details
       FROM hr_directory_recovery_runs WHERE recoveryKey=? LIMIT 1`,
      [RECOVERY_KEY],
    );
    const [linkedRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS linkedCount,
       SUM(s.evidenceStatus='current_active' AND (rs.manualRevisionAt IS NOT NULL OR rs.isActive='active' OR (rs.isActive='inactive' AND s.resignDate IS NOT NULL))) AS linkedCurrentConsistentCount,
       SUM(s.evidenceStatus<>'current_active' AND (rs.manualRevisionAt IS NOT NULL OR rs.isActive='inactive')) AS linkedNonCurrentInactiveCount
       FROM report_staff rs INNER JOIN staff s ON s.id=rs.linkedStaffId WHERE s.evidenceSource=?`,
      [RECOVERY_SOURCE],
    );
    const linked = linkedRows[0] || {};
    const healthy = countsHealthy(counts)
      && Number(linked.linkedCount || 0) === evidence.counts.totalDirectoryPeople
      && Number(linked.linkedCurrentConsistentCount || 0) === evidence.counts.currentActiveVerified
      && Number(linked.linkedNonCurrentInactiveCount || 0) === evidence.counts.historicalStatusUnknown + evidence.counts.affiliationUnknown;
    return {
      healthy,
      asOfDate: evidence.asOfDate,
      datasetSha256: evidence.sourceDatasetSha256,
      expected: evidence.counts,
      actual: {
        ...counts,
        linkedReportStaffCount: Number(linked.linkedCount || 0),
        linkedCurrentConsistentCount: Number(linked.linkedCurrentConsistentCount || 0),
        linkedNonCurrentInactiveCount: Number(linked.linkedNonCurrentInactiveCount || 0),
      },
      latestRun: runs[0] || null,
      policy: {
        activeMeans: "2026-07/08 direct internal activity signal",
        historicalUnknownIsNotResigned: true,
        affiliationUnknownIsNotEmployee: true,
        employmentTypeDefaultsHidden: true,
      },
    };
  } finally {
    await pool.end();
  }
}

export async function runHr36DirectoryRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for HR directory recovery");
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 4 });
  try {
    await ensureStaffEvidenceColumns(pool);
    await ensureRecoveryTable(pool);
    const beforeCounts = await getCounts(pool);
    const [linkedBefore] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS linkedCount,
       SUM(s.evidenceStatus='current_active' AND (rs.manualRevisionAt IS NOT NULL OR rs.isActive='active' OR (rs.isActive='inactive' AND s.resignDate IS NOT NULL))) AS linkedCurrentConsistentCount,
       SUM(s.evidenceStatus<>'current_active' AND (rs.manualRevisionAt IS NOT NULL OR rs.isActive='inactive')) AS linkedNonCurrentInactiveCount
       FROM report_staff rs INNER JOIN staff s ON s.id=rs.linkedStaffId WHERE s.evidenceSource=?`,
      [RECOVERY_SOURCE],
    );
    const linkedBeforeCounts = linkedBefore[0] || {};
    if (countsHealthy(beforeCounts)
      && Number(linkedBeforeCounts.linkedCount || 0) === evidence.counts.totalDirectoryPeople
      && Number(linkedBeforeCounts.linkedCurrentConsistentCount || 0) === evidence.counts.currentActiveVerified
      && Number(linkedBeforeCounts.linkedNonCurrentInactiveCount || 0) === evidence.counts.historicalStatusUnknown + evidence.counts.affiliationUnknown) {
      console.log(`[Hr36DirectoryRecovery] healthy, no write required ${JSON.stringify(beforeCounts)}`);
      return;
    }

    await pool.execute(
      `INSERT INTO hr_directory_recovery_runs
       (recoveryKey, status, startedAt, completedAt, directoryCount, currentCount, historicalUnknownCount, affiliationUnknownCount, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, 0, 0, 0, 0, NULL, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, errorMessage=NULL`,
      [RECOVERY_KEY],
    );

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    let createdCount = 0;
    try {
      await connection.beginTransaction();
      for (const person of evidence.people) {
        const result = await upsertPerson(connection, person);
        if (result.created) createdCount += 1;
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const afterCounts = await getCounts(pool);
    if (!countsHealthy(afterCounts)) {
      throw new Error(`HR directory verification failed: ${JSON.stringify(afterCounts)}`);
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = { createdCount, preBackupId, postBackupId, datasetSha256: evidence.sourceDatasetSha256, beforeCounts, afterCounts };
    await pool.execute(
      `UPDATE hr_directory_recovery_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
       directoryCount=?, currentCount=?, historicalUnknownCount=?, affiliationUnknownCount=?, details=?, errorMessage=NULL
       WHERE recoveryKey=?`,
      [afterCounts.directoryCount, afterCounts.currentCount, afterCounts.historicalUnknownCount,
       afterCounts.affiliationUnknownCount, JSON.stringify(details), RECOVERY_KEY],
    );
    console.log(`[Hr36DirectoryRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      "UPDATE hr_directory_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=? WHERE recoveryKey=?",
      [message.slice(0, 4000), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[Hr36DirectoryRecovery] failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
