import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import evidence from "./liverHomeFinanceRecoveryEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = evidence.version;
const PRE_BACKUP_REASON = "pre-liver-home-fin-v1";
const POST_BACKUP_REASON = "post-liver-home-fin-v1";
const DATASET_SHA256 = evidence.datasetSha256;

type BundleEvidence = (typeof evidence.recoveredBundles.sets)[number];
type PerformanceEvidence = (typeof evidence.recoveredPerformance.rows)[number];
type FinanceSnapshotEvidence = (typeof evidence.financeEvidenceSnapshots)[number];

async function ensureTables(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS recovered_livestream_sets (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(120) NOT NULL,
    setName varchar(255) NOT NULL,
    setPrice bigint NOT NULL,
    quantitySold int NOT NULL,
    totalOriginalPrice bigint NOT NULL,
    discountRate int NOT NULL,
    totalRevenue bigint NOT NULL,
    liverId int NULL,
    livestreamId int NULL,
    attributionStatus varchar(32) NOT NULL DEFAULT 'unverified',
    dateStatus varchar(32) NOT NULL DEFAULT 'unknown',
    evidenceSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY recovered_livestream_sets_evidence_unique (evidenceKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS recovered_livestream_set_items (
    id bigint NOT NULL AUTO_INCREMENT,
    setId bigint NOT NULL,
    productName varchar(255) NOT NULL,
    originalPrice bigint NOT NULL,
    quantity int NOT NULL DEFAULT 1,
    sortOrder int NOT NULL DEFAULT 0,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY recovered_livestream_set_item_unique (setId, sortOrder),
    KEY recovered_livestream_set_items_set_idx (setId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS recovered_liver_performance (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(120) NOT NULL,
    liverId int NOT NULL,
    streamerName varchar(255) NOT NULL,
    livestreamName varchar(500) NULL,
    livestreamDate datetime NOT NULL,
    livestreamStartTime varchar(10) NULL,
    durationSeconds int NOT NULL DEFAULT 0,
    durationMinutes int NOT NULL DEFAULT 0,
    grossRevenue bigint NOT NULL DEFAULT 0,
    directGmv bigint NOT NULL DEFAULT 0,
    itemsSold int NOT NULL DEFAULT 0,
    customerCount int NOT NULL DEFAULT 0,
    avgPrice bigint NOT NULL DEFAULT 0,
    ordersPaid int NOT NULL DEFAULT 0,
    gmvPer1kShows varchar(50) NULL,
    gmvPer1kViews varchar(50) NULL,
    views int NOT NULL DEFAULT 0,
    viewerCount int NOT NULL DEFAULT 0,
    peakViewers int NOT NULL DEFAULT 0,
    newFollowers int NOT NULL DEFAULT 0,
    avgViewDurationSeconds int NOT NULL DEFAULT 0,
    likes bigint NOT NULL DEFAULT 0,
    comments int NOT NULL DEFAULT 0,
    shares int NOT NULL DEFAULT 0,
    productImpressions bigint NOT NULL DEFAULT 0,
    productClicks int NOT NULL DEFAULT 0,
    ctr varchar(20) NULL,
    ctor varchar(20) NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY recovered_liver_performance_evidence_unique (evidenceKey),
    KEY recovered_liver_performance_liver_date_idx (liverId, livestreamDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS finance_recovery_snapshots (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(140) NOT NULL,
    asOfDate date NOT NULL,
    periodLabel varchar(32) NOT NULL,
    metric varchar(64) NOT NULL,
    value bigint NOT NULL,
    currency varchar(8) NOT NULL,
    recordCount int NOT NULL DEFAULT 0,
    classification varchar(64) NOT NULL,
    sourcePath varchar(255) NOT NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY finance_recovery_snapshots_evidence_unique (evidenceKey),
    KEY finance_recovery_snapshots_period_idx (periodLabel, metric)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS liver_home_finance_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(120) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    setCount int NOT NULL DEFAULT 0,
    setItemCount int NOT NULL DEFAULT 0,
    performanceCount int NOT NULL DEFAULT 0,
    financeSnapshotCount int NOT NULL DEFAULT 0,
    details json DEFAULT NULL,
    errorMessage text DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY liver_home_finance_recovery_key_unique (recoveryKey)
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

async function getState(pool: Pool): Promise<{
  setCount: number;
  setItemCount: number;
  setRevenue: number;
  setQuantity: number;
  performanceCount: number;
  performanceGrossRevenue: number;
  performanceDirectGmv: number;
  financeSnapshotCount: number;
  companyCashflowCount: number;
  healthy: boolean;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM recovered_livestream_sets WHERE evidenceSha256 = ?) AS setCount,
      (SELECT COUNT(*) FROM recovered_livestream_set_items i INNER JOIN recovered_livestream_sets s ON s.id = i.setId WHERE s.evidenceSha256 = ?) AS setItemCount,
      (SELECT COALESCE(SUM(totalRevenue), 0) FROM recovered_livestream_sets WHERE evidenceSha256 = ?) AS setRevenue,
      (SELECT COALESCE(SUM(quantitySold), 0) FROM recovered_livestream_sets WHERE evidenceSha256 = ?) AS setQuantity,
      (SELECT COUNT(*) FROM recovered_liver_performance WHERE sourceDatasetSha256 = ?) AS performanceCount,
      (SELECT COALESCE(SUM(grossRevenue), 0) FROM recovered_liver_performance WHERE sourceDatasetSha256 = ?) AS performanceGrossRevenue,
      (SELECT COALESCE(SUM(directGmv), 0) FROM recovered_liver_performance WHERE sourceDatasetSha256 = ?) AS performanceDirectGmv,
      (SELECT COUNT(*) FROM finance_recovery_snapshots WHERE sourceDatasetSha256 = ?) AS financeSnapshotCount,
      (SELECT COUNT(*) FROM company_cashflows WHERE deletedAt IS NULL) AS companyCashflowCount
  `, Array(8).fill(DATASET_SHA256));
  const row = rows[0] || {};
  const state = {
    setCount: Number(row.setCount || 0),
    setItemCount: Number(row.setItemCount || 0),
    setRevenue: Number(row.setRevenue || 0),
    setQuantity: Number(row.setQuantity || 0),
    performanceCount: Number(row.performanceCount || 0),
    performanceGrossRevenue: Number(row.performanceGrossRevenue || 0),
    performanceDirectGmv: Number(row.performanceDirectGmv || 0),
    financeSnapshotCount: Number(row.financeSnapshotCount || 0),
    companyCashflowCount: Number(row.companyCashflowCount || 0),
    healthy: false,
  };
  state.healthy = state.setCount === evidence.recoveredBundles.count
    && state.setItemCount === evidence.recoveredBundles.sets.reduce((sum, set) => sum + set.items.length, 0)
    && state.setRevenue === evidence.recoveredBundles.totalRevenue
    && state.setQuantity === evidence.recoveredBundles.quantitySold
    && state.performanceCount === evidence.recoveredPerformance.summary.rowCount
    && state.performanceGrossRevenue === evidence.recoveredPerformance.summary.grossRevenue
    && state.performanceDirectGmv === evidence.recoveredPerformance.summary.directGmv
    && state.financeSnapshotCount === evidence.financeEvidenceSnapshots.length;
  return state;
}

async function repairBundles(connection: PoolConnection): Promise<void> {
  for (const bundle of evidence.recoveredBundles.sets as readonly BundleEvidence[]) {
    await connection.execute(
      `INSERT INTO recovered_livestream_sets
        (evidenceKey, setName, setPrice, quantitySold, totalOriginalPrice, discountRate, totalRevenue,
         liverId, livestreamId, attributionStatus, dateStatus, evidenceSha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'unverified', 'unknown', ?)
       ON DUPLICATE KEY UPDATE setName=VALUES(setName), setPrice=VALUES(setPrice),
         quantitySold=VALUES(quantitySold), totalOriginalPrice=VALUES(totalOriginalPrice),
         discountRate=VALUES(discountRate), totalRevenue=VALUES(totalRevenue),
         attributionStatus='unverified', dateStatus='unknown', evidenceSha256=VALUES(evidenceSha256)`,
      [bundle.evidenceKey, bundle.setName, bundle.setPrice, bundle.quantitySold, bundle.totalOriginalPrice,
        bundle.discountRate, bundle.totalRevenue, DATASET_SHA256],
    );
    const [setRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM recovered_livestream_sets WHERE evidenceKey = ? LIMIT 1 FOR UPDATE",
      [bundle.evidenceKey],
    );
    const setId = Number(setRows[0]?.id || 0);
    if (!setId) throw new Error(`recovered set id missing evidenceKey=${bundle.evidenceKey}`);
    await connection.execute("DELETE FROM recovered_livestream_set_items WHERE setId = ?", [setId]);
    for (const item of bundle.items) {
      await connection.execute(
        `INSERT INTO recovered_livestream_set_items
          (setId, productName, originalPrice, quantity, sortOrder)
         VALUES (?, ?, ?, ?, ?)`,
        [setId, item.productName, item.originalPrice, item.quantity, item.sortOrder],
      );
    }
  }
}

async function repairPerformance(connection: PoolConnection): Promise<void> {
  for (const row of evidence.recoveredPerformance.rows as readonly PerformanceEvidence[]) {
    await connection.execute(
      `INSERT INTO recovered_liver_performance
        (evidenceKey, liverId, streamerName, livestreamName, livestreamDate, livestreamStartTime,
         durationSeconds, durationMinutes, grossRevenue, directGmv, itemsSold, customerCount, avgPrice,
         ordersPaid, gmvPer1kShows, gmvPer1kViews, views, viewerCount, peakViewers, newFollowers,
         avgViewDurationSeconds, likes, comments, shares, productImpressions, productClicks, ctr, ctor,
         sourceDatasetSha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE liverId=VALUES(liverId), streamerName=VALUES(streamerName),
         livestreamName=VALUES(livestreamName), livestreamDate=VALUES(livestreamDate),
         livestreamStartTime=VALUES(livestreamStartTime), durationSeconds=VALUES(durationSeconds),
         durationMinutes=VALUES(durationMinutes), grossRevenue=VALUES(grossRevenue), directGmv=VALUES(directGmv),
         itemsSold=VALUES(itemsSold), customerCount=VALUES(customerCount), avgPrice=VALUES(avgPrice),
         ordersPaid=VALUES(ordersPaid), gmvPer1kShows=VALUES(gmvPer1kShows), gmvPer1kViews=VALUES(gmvPer1kViews),
         views=VALUES(views), viewerCount=VALUES(viewerCount), peakViewers=VALUES(peakViewers),
         newFollowers=VALUES(newFollowers), avgViewDurationSeconds=VALUES(avgViewDurationSeconds),
         likes=VALUES(likes), comments=VALUES(comments), shares=VALUES(shares),
         productImpressions=VALUES(productImpressions), productClicks=VALUES(productClicks),
         ctr=VALUES(ctr), ctor=VALUES(ctor), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
      [
        row.evidenceKey, row.liverId, row.streamerName, row.livestreamName, row.livestreamDate,
        row.livestreamStartTime, row.durationSeconds, row.durationMinutes, row.grossRevenue, row.directGmv,
        row.itemsSold, row.customerCount, row.avgPrice, row.ordersPaid, row.gmvPer1kShows, row.gmvPer1kViews,
        row.views, row.viewerCount, row.peakViewers, row.newFollowers, row.avgViewDurationSeconds, row.likes,
        row.comments, row.shares, row.productImpressions, row.productClicks, row.ctr, row.ctor, DATASET_SHA256,
      ],
    );
  }
}

async function repairFinanceSnapshots(connection: PoolConnection): Promise<void> {
  for (const row of evidence.financeEvidenceSnapshots as readonly FinanceSnapshotEvidence[]) {
    await connection.execute(
      `INSERT INTO finance_recovery_snapshots
        (evidenceKey, asOfDate, periodLabel, metric, value, currency, recordCount, classification, sourcePath, sourceDatasetSha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE asOfDate=VALUES(asOfDate), periodLabel=VALUES(periodLabel),
         metric=VALUES(metric), value=VALUES(value), currency=VALUES(currency), recordCount=VALUES(recordCount),
         classification=VALUES(classification), sourcePath=VALUES(sourcePath), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
      [row.evidenceKey, row.asOfDate, row.periodLabel, row.metric, row.value, row.currency, row.recordCount,
        row.classification, row.sourcePath, DATASET_SHA256],
    );
  }
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for liver home finance recovery");
  return mysql.createPool(databaseUrl);
}

export async function getRecoveredLivestreamSets(): Promise<{
  summary: { setCount: number; totalRevenue: number; quantitySold: number; attributionStatus: string; dateStatus: string };
  sets: Array<Record<string, unknown> & { items: Array<Record<string, unknown>> }>;
}> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const [sets] = await pool.query<RowDataPacket[]>(
      `SELECT id, evidenceKey, setName, setPrice, quantitySold, totalOriginalPrice, discountRate,
              totalRevenue, liverId, livestreamId, attributionStatus, dateStatus
       FROM recovered_livestream_sets WHERE evidenceSha256 = ? ORDER BY totalRevenue DESC, id`,
      [DATASET_SHA256],
    );
    const output = [];
    for (const set of sets) {
      const [items] = await pool.query<RowDataPacket[]>(
        `SELECT productName, originalPrice, quantity, sortOrder
         FROM recovered_livestream_set_items WHERE setId = ? ORDER BY sortOrder, id`,
        [set.id],
      );
      output.push({ ...set, items });
    }
    return {
      summary: {
        setCount: output.length,
        totalRevenue: output.reduce((sum, row: any) => sum + Number(row.totalRevenue || 0), 0),
        quantitySold: output.reduce((sum, row: any) => sum + Number(row.quantitySold || 0), 0),
        attributionStatus: "unverified",
        dateStatus: "unknown",
      },
      sets: output,
    };
  } finally {
    await pool.end();
  }
}

export async function getRecoveredLiverPerformance(liverId: number): Promise<{
  summary: Record<string, number | string | null>;
  rows: RowDataPacket[];
}> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, evidenceKey, liverId, streamerName, livestreamName, livestreamDate, livestreamStartTime,
              durationSeconds, durationMinutes, grossRevenue, directGmv, itemsSold, customerCount, avgPrice,
              ordersPaid, views, viewerCount, peakViewers, newFollowers, avgViewDurationSeconds, likes,
              comments, shares, productImpressions, productClicks, ctr, ctor
       FROM recovered_liver_performance
       WHERE liverId = ? AND sourceDatasetSha256 = ? ORDER BY livestreamDate DESC`,
      [liverId, DATASET_SHA256],
    );
    const rowCount = rows.length;
    return {
      summary: {
        rowCount,
        periodStart: rowCount ? new Date(rows[rowCount - 1].livestreamDate).toISOString() : null,
        periodEnd: rowCount ? new Date(rows[0].livestreamDate).toISOString() : null,
        grossRevenue: rows.reduce((sum, row) => sum + Number(row.grossRevenue || 0), 0),
        directGmv: rows.reduce((sum, row) => sum + Number(row.directGmv || 0), 0),
        itemsSold: rows.reduce((sum, row) => sum + Number(row.itemsSold || 0), 0),
        ordersPaid: rows.reduce((sum, row) => sum + Number(row.ordersPaid || 0), 0),
        durationMinutes: rows.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0),
      },
      rows,
    };
  } finally {
    await pool.end();
  }
}

export async function getFinanceRecoverySnapshots(): Promise<{
  snapshots: RowDataPacket[];
  cashflowBoundary: typeof evidence.cashflowBoundary;
}> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const [snapshots] = await pool.query<RowDataPacket[]>(
      `SELECT evidenceKey, asOfDate, periodLabel, metric, value, currency, recordCount, classification, sourcePath
       FROM finance_recovery_snapshots WHERE sourceDatasetSha256 = ?
       ORDER BY CASE WHEN periodLabel='all' THEN 0 ELSE 1 END, periodLabel DESC, metric`,
      [DATASET_SHA256],
    );
    return { snapshots, cashflowBoundary: evidence.cashflowBoundary };
  } finally {
    await pool.end();
  }
}

export async function getLiverHomeFinanceRecoveryHealth(): Promise<Awaited<ReturnType<typeof getState>> & {
  datasetSha256: string;
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null } | null;
  backups: Array<{ id: number; reason: string; status: string; completedAt: string | null; errorMessage: string | null }>;
  cashflowBoundary: typeof evidence.cashflowBoundary;
}> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const state = await getState(pool);
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, completedAt, errorMessage FROM liver_home_finance_recovery_runs WHERE recoveryKey = ? LIMIT 1`,
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
      cashflowBoundary: evidence.cashflowBoundary,
    };
  } finally {
    await pool.end();
  }
}

export async function runLiverHomeFinanceRecovery(): Promise<void> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const before = await getState(pool);
    if (before.healthy) {
      console.log(`[LiverHomeFinanceRecovery] healthy ${JSON.stringify(before)}`);
      return;
    }

    await pool.execute(
      `INSERT INTO liver_home_finance_recovery_runs
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
      await repairBundles(connection);
      await repairPerformance(connection);
      await repairFinanceSnapshots(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const after = await getState(pool);
    if (!after.healthy) throw new Error(`liver home finance recovery verification failed: ${JSON.stringify(after)}`);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(
      `UPDATE liver_home_finance_recovery_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
         setCount=?, setItemCount=?, performanceCount=?, financeSnapshotCount=?, details=?, errorMessage=NULL
       WHERE recoveryKey=?`,
      [after.setCount, after.setItemCount, after.performanceCount, after.financeSnapshotCount,
        JSON.stringify({ before, after, datasetSha256: DATASET_SHA256, preBackupId, postBackupId }), RECOVERY_KEY],
    );
    console.log(`[LiverHomeFinanceRecovery] success ${JSON.stringify(after)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE liver_home_finance_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP,
       errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[LiverHomeFinanceRecovery] failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
