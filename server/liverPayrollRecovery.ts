import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import evidence from "./liverPayrollRecoveryEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = evidence.version;
const DATASET_SHA256 = evidence.datasetSha256;
const PRE_BACKUP_REASON = "pre-liver-payroll-v1";
const POST_BACKUP_REASON = "post-liver-payroll-v1";

type IndividualEvidence = (typeof evidence.individualRecords)[number];
type PerformanceEvidence = (typeof evidence.performanceRecords)[number];
type AggregateEvidence = (typeof evidence.aggregateRecords)[number];
type ScreenshotEvidence = (typeof evidence.screenshotRecords)[number];
type SetEvidence = (typeof evidence.setSalesRecords)[number];

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for liver payroll recovery");
  return mysql.createPool(databaseUrl);
}

function toMysqlDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 19).replace("T", " ");
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  if (!match) return null;
  return `${match[1]} ${match[2]?.length === 5 ? `${match[2]}:00` : (match[2] || "00:00:00")}`;
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS liver_payroll_basis_records (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(180) NOT NULL,
    recordType varchar(32) NOT NULL,
    sourcePath varchar(500) NOT NULL,
    sourceType varchar(64) NOT NULL,
    legacyLivestreamId varchar(64) NULL,
    liverId int NULL,
    liverName varchar(255) NULL,
    streamerName varchar(255) NULL,
    occurredAt datetime NULL,
    periodStart datetime NULL,
    periodEnd datetime NULL,
    startTimeLabel varchar(120) NULL,
    salesAmount bigint NULL,
    manualSalesAmount bigint NULL,
    gmv bigint NULL,
    effectiveSalesAmount bigint NOT NULL DEFAULT 0,
    durationMinutes int NULL,
    viewerCount bigint NULL,
    orderCount int NULL,
    productCommission varchar(50) NULL,
    createdBy int NULL,
    streamCount int NULL,
    reviewStatus varchar(80) NOT NULL,
    payrollEligible tinyint(1) NOT NULL DEFAULT 0,
    payrollBlockReason varchar(160) NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY liver_payroll_basis_evidence_unique (evidenceKey),
    KEY liver_payroll_basis_liver_date_idx (liverId, occurredAt),
    KEY liver_payroll_basis_period_idx (periodStart, periodEnd),
    KEY liver_payroll_basis_type_status_idx (recordType, reviewStatus)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS liver_payroll_conflicts (
    id bigint NOT NULL AUTO_INCREMENT,
    conflictKey varchar(200) NOT NULL,
    recordRefs json NOT NULL,
    amounts json NOT NULL,
    reason varchar(120) NOT NULL,
    resolution varchar(120) NOT NULL,
    isResolved tinyint(1) NOT NULL DEFAULT 0,
    resolutionNote text NULL,
    resolvedBy int NULL,
    resolvedAt timestamp NULL DEFAULT NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY liver_payroll_conflict_key_unique (conflictKey),
    KEY liver_payroll_conflict_resolved_idx (isResolved)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS liver_payroll_rules (
    id bigint NOT NULL AUTO_INCREMENT,
    liverId int NOT NULL,
    payType varchar(24) NOT NULL,
    effectiveFrom date NOT NULL,
    effectiveTo date NULL,
    fixedMonthlyAmount bigint NULL,
    hourlyRate bigint NULL,
    commissionBase varchar(40) NULL,
    commissionRate decimal(7,4) NULL,
    bonusRule json NULL,
    deductionRule json NULL,
    cutoffDay varchar(20) NOT NULL,
    paymentDay varchar(40) NULL,
    evidenceReference text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'draft',
    confirmedBy int NULL,
    confirmedAt timestamp NULL DEFAULT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY liver_payroll_rule_liver_period_idx (liverId, effectiveFrom, effectiveTo),
    KEY liver_payroll_rule_status_idx (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS liver_payroll_calculations (
    id bigint NOT NULL AUTO_INCREMENT,
    liverId int NOT NULL,
    periodStart date NOT NULL,
    periodEnd date NOT NULL,
    ruleId bigint NOT NULL,
    basisRecordCount int NOT NULL DEFAULT 0,
    basisSalesAmount bigint NOT NULL DEFAULT 0,
    basisDurationMinutes int NOT NULL DEFAULT 0,
    fixedAmount bigint NOT NULL DEFAULT 0,
    hourlyAmount bigint NOT NULL DEFAULT 0,
    commissionAmount bigint NOT NULL DEFAULT 0,
    bonusAmount bigint NOT NULL DEFAULT 0,
    deductionAmount bigint NOT NULL DEFAULT 0,
    totalPayAmount bigint NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'draft',
    approvedBy int NULL,
    approvedAt timestamp NULL DEFAULT NULL,
    paidAt timestamp NULL DEFAULT NULL,
    calculationDetails json NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY liver_payroll_calculation_period_unique (liverId, periodStart, periodEnd),
    KEY liver_payroll_calculation_status_idx (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS liver_payroll_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(140) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    basisRecordCount int NOT NULL DEFAULT 0,
    conflictCount int NOT NULL DEFAULT 0,
    salaryRuleCount int NOT NULL DEFAULT 0,
    calculationCount int NOT NULL DEFAULT 0,
    details json NULL,
    errorMessage text NULL,
    PRIMARY KEY (id),
    UNIQUE KEY liver_payroll_recovery_key_unique (recoveryKey)
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

function expectedBasisCount(): number {
  return evidence.summary.individualRecordCount
    + evidence.summary.performanceRecordCount
    + evidence.summary.aggregateRecordCount
    + evidence.summary.screenshotRecordCount
    + evidence.summary.setSalesCount;
}

async function getState(pool: Pool): Promise<{
  basisRecordCount: number;
  individualRecordCount: number;
  performanceRecordCount: number;
  aggregateRecordCount: number;
  screenshotRecordCount: number;
  setSalesCount: number;
  conflictCount: number;
  unresolvedConflictCount: number;
  salaryRuleCount: number;
  activeSalaryRuleCount: number;
  calculationCount: number;
  payrollEligibleCount: number;
  healthy: boolean;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ?) AS basisRecordCount,
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ? AND recordType = 'individual') AS individualRecordCount,
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ? AND recordType = 'performance') AS performanceRecordCount,
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ? AND recordType = 'aggregate') AS aggregateRecordCount,
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ? AND recordType = 'screenshot') AS screenshotRecordCount,
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ? AND recordType = 'set_sales') AS setSalesCount,
      (SELECT COUNT(*) FROM liver_payroll_conflicts WHERE sourceDatasetSha256 = ?) AS conflictCount,
      (SELECT COUNT(*) FROM liver_payroll_conflicts WHERE sourceDatasetSha256 = ? AND isResolved = 0) AS unresolvedConflictCount,
      (SELECT COUNT(*) FROM liver_payroll_rules) AS salaryRuleCount,
      (SELECT COUNT(*) FROM liver_payroll_rules WHERE status = 'active') AS activeSalaryRuleCount,
      (SELECT COUNT(*) FROM liver_payroll_calculations) AS calculationCount,
      (SELECT COUNT(*) FROM liver_payroll_basis_records WHERE sourceDatasetSha256 = ? AND payrollEligible = 1) AS payrollEligibleCount
  `, Array(9).fill(DATASET_SHA256));
  const row = rows[0] || {};
  const state = {
    basisRecordCount: Number(row.basisRecordCount || 0),
    individualRecordCount: Number(row.individualRecordCount || 0),
    performanceRecordCount: Number(row.performanceRecordCount || 0),
    aggregateRecordCount: Number(row.aggregateRecordCount || 0),
    screenshotRecordCount: Number(row.screenshotRecordCount || 0),
    setSalesCount: Number(row.setSalesCount || 0),
    conflictCount: Number(row.conflictCount || 0),
    unresolvedConflictCount: Number(row.unresolvedConflictCount || 0),
    salaryRuleCount: Number(row.salaryRuleCount || 0),
    activeSalaryRuleCount: Number(row.activeSalaryRuleCount || 0),
    calculationCount: Number(row.calculationCount || 0),
    payrollEligibleCount: Number(row.payrollEligibleCount || 0),
    healthy: false,
  };
  state.healthy = state.basisRecordCount === expectedBasisCount()
    && state.individualRecordCount === evidence.summary.individualRecordCount
    && state.performanceRecordCount === evidence.summary.performanceRecordCount
    && state.aggregateRecordCount === evidence.summary.aggregateRecordCount
    && state.screenshotRecordCount === evidence.summary.screenshotRecordCount
    && state.setSalesCount === evidence.summary.setSalesCount
    && state.conflictCount === evidence.conflictGroups.length
    && state.unresolvedConflictCount <= state.conflictCount;
  return state;
}

async function upsertBasisRecord(connection: PoolConnection, values: unknown[]): Promise<void> {
  await connection.execute(
    `INSERT INTO liver_payroll_basis_records
      (evidenceKey, recordType, sourcePath, sourceType, legacyLivestreamId, liverId, liverName,
       streamerName, occurredAt, periodStart, periodEnd, startTimeLabel, salesAmount, manualSalesAmount,
       gmv, effectiveSalesAmount, durationMinutes, viewerCount, orderCount, productCommission, createdBy,
       streamCount, reviewStatus, payrollEligible, payrollBlockReason, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE recordType=VALUES(recordType), sourcePath=VALUES(sourcePath),
       sourceType=VALUES(sourceType), legacyLivestreamId=VALUES(legacyLivestreamId), liverId=VALUES(liverId),
       liverName=VALUES(liverName), streamerName=VALUES(streamerName), occurredAt=VALUES(occurredAt),
       periodStart=VALUES(periodStart), periodEnd=VALUES(periodEnd), startTimeLabel=VALUES(startTimeLabel),
       salesAmount=VALUES(salesAmount), manualSalesAmount=VALUES(manualSalesAmount), gmv=VALUES(gmv),
       effectiveSalesAmount=VALUES(effectiveSalesAmount), durationMinutes=VALUES(durationMinutes),
       viewerCount=VALUES(viewerCount), orderCount=VALUES(orderCount), productCommission=VALUES(productCommission),
       createdBy=VALUES(createdBy), streamCount=VALUES(streamCount), reviewStatus=VALUES(reviewStatus),
       payrollEligible=VALUES(payrollEligible), payrollBlockReason=VALUES(payrollBlockReason),
       sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    values,
  );
}

async function repairBasisRecords(connection: PoolConnection): Promise<void> {
  for (const row of evidence.individualRecords as readonly IndividualEvidence[]) {
    await upsertBasisRecord(connection, [
      row.evidenceKey, "individual", row.sourcePath, row.sourceType, row.legacyLivestreamId, row.liverId,
      row.liverName, row.streamerName, toMysqlDateTime(row.livestreamDate), null, null, row.startTimeLabel,
      row.salesAmount, row.manualSalesAmount, row.gmv, row.effectiveSalesAmount, row.durationMinutes,
      row.viewerCount, row.orderCount, row.productCommission, row.createdBy, null, row.reviewStatus,
      row.payrollEligible ? 1 : 0, row.payrollBlockReason, DATASET_SHA256,
    ]);
  }

  for (const row of evidence.performanceRecords as readonly PerformanceEvidence[]) {
    await upsertBasisRecord(connection, [
      row.evidenceKey, "performance", row.sourcePath, row.sourceType, null, row.liverId, row.liverName,
      row.streamerName, toMysqlDateTime(row.livestreamDate), null, null, row.startTimeLabel,
      row.salesAmount, null, row.gmv, row.effectiveSalesAmount, row.durationMinutes, row.viewerCount,
      row.orderCount, null, null, null, row.reviewStatus, row.payrollEligible ? 1 : 0,
      row.payrollBlockReason, DATASET_SHA256,
    ]);
  }

  for (const row of evidence.aggregateRecords as readonly AggregateEvidence[]) {
    await upsertBasisRecord(connection, [
      row.evidenceKey, "aggregate", row.sourcePath, row.sourceType, null, row.liverId, row.liverName,
      row.streamerName, null, toMysqlDateTime(row.periodStart), toMysqlDateTime(row.periodEnd), null,
      row.salesAmount, null, row.gmv, row.salesAmount || row.gmv || 0, row.durationMinutes, null, null,
      null, null, row.streamCount, row.reviewStatus, row.payrollEligible ? 1 : 0,
      row.payrollBlockReason, DATASET_SHA256,
    ]);
  }

  for (const row of evidence.screenshotRecords as readonly ScreenshotEvidence[]) {
    await upsertBasisRecord(connection, [
      row.evidenceKey, "screenshot", row.sourcePath, row.sourceType, row.matchedLegacyLivestreamId,
      row.liverId, null, null, toMysqlDateTime(row.livestreamDate), null, null, row.startTimeLabel,
      null, null, null, row.effectiveSalesAmount, row.durationMinutes, null, null, null,
      "createdBy" in row ? row.createdBy : null, null, row.reviewStatus, row.payrollEligible ? 1 : 0,
      row.payrollBlockReason, DATASET_SHA256,
    ]);
  }

  for (const row of evidence.setSalesRecords as readonly SetEvidence[]) {
    await upsertBasisRecord(connection, [
      row.evidenceKey, "set_sales", "server/liverHomeFinanceRecoveryEvidence.json", "user_screenshot",
      null, row.liverId, null, null, toMysqlDateTime(row.livestreamDate), null, null, null,
      row.totalRevenue, null, null, row.totalRevenue, null, null, row.quantitySold, null, null,
      null, row.reviewStatus, row.payrollEligible ? 1 : 0, row.payrollBlockReason, DATASET_SHA256,
    ]);
  }
}

async function repairConflicts(connection: PoolConnection): Promise<void> {
  for (const row of evidence.conflictGroups) {
    await connection.execute(
      `INSERT INTO liver_payroll_conflicts
        (conflictKey, recordRefs, amounts, reason, resolution, isResolved, sourceDatasetSha256)
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE recordRefs=VALUES(recordRefs), amounts=VALUES(amounts),
         reason=VALUES(reason), resolution=VALUES(resolution), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
      [row.conflict_key, JSON.stringify(row.record_ids), JSON.stringify(row.amounts), row.reason, row.resolution, DATASET_SHA256],
    );
  }
}

export async function getLiverPayrollBasis(liverId: number, month?: string): Promise<{
  summary: Record<string, unknown>;
  individualRecords: RowDataPacket[];
  performanceRecords: RowDataPacket[];
  aggregateRecords: RowDataPacket[];
  screenshotRecords: RowDataPacket[];
  salaryRules: RowDataPacket[];
}> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const validMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
    const start = validMonth ? `${validMonth}-01 00:00:00` : null;
    const end = validMonth
      ? new Date(Date.UTC(Number(validMonth.slice(0, 4)), Number(validMonth.slice(5, 7)), 1)).toISOString().slice(0, 19).replace("T", " ")
      : null;
    const occurredFilter = start && end ? " AND occurredAt >= ? AND occurredAt < ?" : "";
    const parameters: unknown[] = [liverId, DATASET_SHA256];
    if (start && end) parameters.push(start, end);
    const [individualRecords] = await pool.query<RowDataPacket[]>(
      `SELECT evidenceKey, sourceType, legacyLivestreamId, occurredAt, startTimeLabel, effectiveSalesAmount,
              durationMinutes, viewerCount, orderCount, productCommission, reviewStatus, payrollEligible, payrollBlockReason
       FROM liver_payroll_basis_records
       WHERE liverId = ? AND sourceDatasetSha256 = ? AND recordType = 'individual'${occurredFilter}
       ORDER BY occurredAt DESC, id DESC LIMIT 500`,
      parameters,
    );
    const [performanceRecords] = await pool.query<RowDataPacket[]>(
      `SELECT evidenceKey, occurredAt, startTimeLabel, effectiveSalesAmount, gmv, durationMinutes,
              viewerCount, orderCount, reviewStatus, payrollEligible, payrollBlockReason
       FROM liver_payroll_basis_records
       WHERE liverId = ? AND sourceDatasetSha256 = ? AND recordType = 'performance'${occurredFilter}
       ORDER BY occurredAt DESC, id DESC LIMIT 500`,
      parameters,
    );
    const [screenshotRecords] = await pool.query<RowDataPacket[]>(
      `SELECT evidenceKey, legacyLivestreamId, occurredAt, startTimeLabel, effectiveSalesAmount,
              durationMinutes, reviewStatus, payrollEligible, payrollBlockReason
       FROM liver_payroll_basis_records
       WHERE liverId = ? AND sourceDatasetSha256 = ? AND recordType = 'screenshot'${occurredFilter}
       ORDER BY occurredAt DESC, id DESC LIMIT 100`,
      parameters,
    );
    const aggregateParams: unknown[] = [liverId, DATASET_SHA256];
    let aggregateFilter = "";
    if (start && end) {
      aggregateFilter = " AND periodStart < ? AND (periodEnd IS NULL OR periodEnd >= ?)";
      aggregateParams.push(end, start);
    }
    const [aggregateRecords] = await pool.query<RowDataPacket[]>(
      `SELECT evidenceKey, periodStart, periodEnd, streamCount, effectiveSalesAmount AS salesAmount,
              gmv, durationMinutes, reviewStatus, payrollBlockReason
       FROM liver_payroll_basis_records
       WHERE liverId = ? AND sourceDatasetSha256 = ? AND recordType = 'aggregate'${aggregateFilter}
       ORDER BY periodStart DESC, id DESC LIMIT 100`,
      aggregateParams,
    );
    const [salaryRules] = await pool.query<RowDataPacket[]>(
      `SELECT id, payType, effectiveFrom, effectiveTo, fixedMonthlyAmount, hourlyRate, commissionBase,
              commissionRate, cutoffDay, paymentDay, evidenceReference, status, confirmedAt
       FROM liver_payroll_rules WHERE liverId = ? ORDER BY effectiveFrom DESC, id DESC`,
      [liverId],
    );
    const summarize = (rows: RowDataPacket[]) => ({
      count: rows.length,
      effectiveSalesAmount: rows.reduce((sum, row) => sum + Number(row.effectiveSalesAmount || row.salesAmount || 0), 0),
      durationMinutes: rows.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0),
      conflictCount: rows.filter((row) => String(row.reviewStatus || "").includes("conflict")).length,
    });
    return {
      summary: {
        liverId,
        month: validMonth,
        salaryRuleStatus: salaryRules.some((row) => row.status === "active") ? "active" : "missing",
        salaryCalculated: false,
        paymentConfirmed: false,
        individual: summarize(individualRecords),
        performance: summarize(performanceRecords),
        screenshot: summarize(screenshotRecords),
        aggregateCount: aggregateRecords.length,
        overlapWarning: true,
      },
      individualRecords,
      performanceRecords,
      aggregateRecords,
      screenshotRecords,
      salaryRules,
    };
  } finally {
    await pool.end();
  }
}

export async function getLiverPayrollRecoveryHealth(): Promise<Awaited<ReturnType<typeof getState>> & {
  datasetSha256: string;
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null } | null;
  backups: Array<{ id: number; reason: string; status: string; completedAt: string | null; errorMessage: string | null }>;
  policy: typeof evidence.policy;
}> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const state = await getState(pool);
    const [runRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, completedAt, errorMessage FROM liver_payroll_recovery_runs WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reason, status, completedAt, errorMessage FROM db_backup_runs
       WHERE reason IN (?, ?) ORDER BY id DESC LIMIT 4`,
      [PRE_BACKUP_REASON, POST_BACKUP_REASON],
    );
    const run = runRows[0];
    return {
      ...state,
      datasetSha256: DATASET_SHA256,
      recoveryRun: run ? {
        status: String(run.status || "unknown"),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        errorMessage: run.errorMessage ? String(run.errorMessage).slice(0, 500) : null,
      } : null,
      backups: backupRows.map((row) => ({
        id: Number(row.id || 0),
        reason: String(row.reason || ""),
        status: String(row.status || "unknown"),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        errorMessage: row.errorMessage ? String(row.errorMessage).slice(0, 500) : null,
      })),
      policy: evidence.policy,
    };
  } finally {
    await pool.end();
  }
}

export async function runLiverPayrollRecovery(): Promise<void> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const before = await getState(pool);
    if (before.healthy) {
      console.log(`[LiverPayrollRecovery] healthy ${JSON.stringify(before)}`);
      return;
    }
    await pool.execute(
      `INSERT INTO liver_payroll_recovery_runs
        (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [RECOVERY_KEY, JSON.stringify({ before, datasetSha256: DATASET_SHA256 })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await repairBasisRecords(connection);
      await repairConflicts(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const after = await getState(pool);
    if (!after.healthy) throw new Error(`liver payroll recovery verification failed: ${JSON.stringify(after)}`);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(
      `UPDATE liver_payroll_recovery_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
         basisRecordCount=?, conflictCount=?, salaryRuleCount=?, calculationCount=?, details=?, errorMessage=NULL
       WHERE recoveryKey=?`,
      [after.basisRecordCount, after.conflictCount, after.salaryRuleCount, after.calculationCount,
        JSON.stringify({ before, after, datasetSha256: DATASET_SHA256, preBackupId, postBackupId }), RECOVERY_KEY],
    );
    console.log(`[LiverPayrollRecovery] success ${JSON.stringify(after)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE liver_payroll_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP,
       errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[LiverPayrollRecovery] failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
