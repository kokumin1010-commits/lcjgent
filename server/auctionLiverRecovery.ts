import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "auction-liver-recovery-v1-2026-08-25";
const RYU_LIVER_ID = 120005;
const RYU_ACCOUNT = "@ryukyogoku";

async function ensureRecoveryTable(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS \`auction_liver_recovery_runs\` (
    \`id\` bigint NOT NULL AUTO_INCREMENT,
    \`recoveryKey\` varchar(120) NOT NULL,
    \`status\` varchar(20) NOT NULL,
    \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completedAt\` timestamp NULL DEFAULT NULL,
    \`liverCount\` int NOT NULL DEFAULT 0,
    \`livestreamCount\` int NOT NULL DEFAULT 0,
    \`linkedLivestreamCount\` int NOT NULL DEFAULT 0,
    \`knownEffectiveSales\` bigint NOT NULL DEFAULT 0,
    \`auctionCount\` int NOT NULL DEFAULT 0,
    \`details\` json DEFAULT NULL,
    \`errorMessage\` text DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`auction_liver_recovery_key_unique\` (\`recoveryKey\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const before = await latestBackupId(pool).catch(() => 0);
    await runDatabaseBackup(reason);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
      [before, reason],
    );
    const row = rows[0];
    if (row?.status === "success") return;
    if (row?.status === "failed") throw new Error(`database backup failed: ${String(row.errorMessage || "unknown")}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`database backup did not complete for reason=${reason}`);
}

async function linkRecoveredLivestreams(connection: PoolConnection): Promise<{ linked: number; salesBackfilled: number }> {
  const [linkResult] = await connection.execute<mysql.ResultSetHeader>(
    `UPDATE brand_livestreams
       SET liverId = ?, streamAccountLiverId = ?
     WHERE deletedAt IS NULL
       AND LOWER(TRIM(streamerName)) = LOWER(?)
       AND (liverId IS NULL OR liverId = ?)` ,
    [RYU_LIVER_ID, RYU_LIVER_ID, RYU_ACCOUNT, RYU_LIVER_ID],
  );
  const [salesResult] = await connection.execute<mysql.ResultSetHeader>(
    `UPDATE brand_livestreams
       SET salesAmount = gmv
     WHERE deletedAt IS NULL
       AND LOWER(TRIM(streamerName)) = LOWER(?)
       AND salesAmount IS NULL
       AND gmv IS NOT NULL`,
    [RYU_ACCOUNT],
  );
  return { linked: Number(linkResult.affectedRows || 0), salesBackfilled: Number(salesResult.affectedRows || 0) };
}

async function readObserved(pool: Pool): Promise<{
  activeLivers: number;
  totalLivestreams: number;
  linkedRyuLivestreams: number;
  effectiveSalesAllTime: number;
  effectiveSalesDec2025: number;
  auctionCount: number;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM livers WHERE isActive = 1) AS activeLivers,
      (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL) AS totalLivestreams,
      (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL AND liverId = ?) AS linkedRyuLivestreams,
      (SELECT COALESCE(SUM(COALESCE(manualSalesAmount, salesAmount, gmv, 0)), 0)
         FROM brand_livestreams WHERE deletedAt IS NULL AND liverId = ?) AS effectiveSalesAllTime,
      (SELECT COALESCE(SUM(COALESCE(manualSalesAmount, salesAmount, gmv, 0)), 0)
         FROM brand_livestreams
        WHERE deletedAt IS NULL AND liverId = ?
          AND livestreamDate >= '2025-12-01 00:00:00'
          AND livestreamDate < '2026-01-01 00:00:00') AS effectiveSalesDec2025,
      (SELECT COUNT(*) FROM auction_records) AS auctionCount
  `, [RYU_LIVER_ID, RYU_LIVER_ID, RYU_LIVER_ID]);
  const row = rows[0] || {};
  return {
    activeLivers: Number(row.activeLivers || 0),
    totalLivestreams: Number(row.totalLivestreams || 0),
    linkedRyuLivestreams: Number(row.linkedRyuLivestreams || 0),
    effectiveSalesAllTime: Number(row.effectiveSalesAllTime || 0),
    effectiveSalesDec2025: Number(row.effectiveSalesDec2025 || 0),
    auctionCount: Number(row.auctionCount || 0),
  };
}

export async function runAuctionLiverRecoveryOnce(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[AuctionLiverRecovery] DATABASE_URL missing; skipped");
    return;
  }
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
  let lockAcquired = false;
  try {
    await ensureRecoveryTable(pool);
    const [done] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM auction_liver_recovery_runs WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    if (done[0]?.status === "success") {
      console.log(`[AuctionLiverRecovery] already complete key=${RECOVERY_KEY}`);
      return;
    }
    const [lockRows] = await pool.query<RowDataPacket[]>("SELECT GET_LOCK(?, 15) AS locked", [RECOVERY_KEY]);
    lockAcquired = Number(lockRows[0]?.locked || 0) === 1;
    if (!lockAcquired) throw new Error("could not acquire recovery lock");

    await pool.execute(
      `INSERT INTO auction_liver_recovery_runs (recoveryKey, status)
       VALUES (?, 'running')
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, errorMessage=NULL`,
      [RECOVERY_KEY],
    );

    await runVerifiedBackup(pool, "pre-auction-liver-recovery");
    const connection = await pool.getConnection();
    let mutation: Awaited<ReturnType<typeof linkRecoveredLivestreams>>;
    try {
      await connection.beginTransaction();
      mutation = await linkRecoveredLivestreams(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await runVerifiedBackup(pool, "post-auction-liver-recovery");

    const observed = await readObserved(pool);
    if (
      observed.activeLivers !== 10 ||
      observed.totalLivestreams !== 104 ||
      observed.linkedRyuLivestreams !== 104 ||
      observed.effectiveSalesDec2025 !== 1_377_745 ||
      observed.effectiveSalesAllTime < 1_843_350 ||
      observed.auctionCount !== 0
    ) {
      throw new Error(`post-recovery verification failed ${JSON.stringify(observed)}`);
    }
    const details = {
      mutation,
      observed,
      auctionEvidence: "No direct auction rows survived; table intentionally remains empty.",
      salesRule: "manualSalesAmount > salesAmount > gmv > 0",
    };
    await pool.execute(
      `UPDATE auction_liver_recovery_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP,
              liverCount=?, livestreamCount=?, linkedLivestreamCount=?, knownEffectiveSales=?, auctionCount=?, details=?
        WHERE recoveryKey=?`,
      [
        observed.activeLivers,
        observed.totalLivestreams,
        observed.linkedRyuLivestreams,
        observed.effectiveSalesAllTime,
        observed.auctionCount,
        JSON.stringify(details),
        RECOVERY_KEY,
      ],
    );
    console.log(`[AuctionLiverRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000);
    await pool.execute(
      `INSERT INTO auction_liver_recovery_runs (recoveryKey, status, errorMessage, completedAt)
       VALUES (?, 'failed', ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE status='failed', errorMessage=VALUES(errorMessage), completedAt=CURRENT_TIMESTAMP`,
      [RECOVERY_KEY, message],
    ).catch(() => undefined);
    console.error("[AuctionLiverRecovery] failed", error);
  } finally {
    if (lockAcquired) await pool.query("SELECT RELEASE_LOCK(?)", [RECOVERY_KEY]).catch(() => undefined);
    await pool.end();
  }
}
