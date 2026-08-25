import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "gmv-hr-recovery-v1-2026-08-25";
const PERIOD = { year: 2026, month: 7 } as const;

const stores = [
  { rank: 1, name: "KYOGOKU JAPAN", gmv: 98_372_339, gmvPct: 5.4, returnRate: 35.8, refund: 35_217_297, operatorName: null },
  { rank: 2, name: "LCJチャンネル", gmv: 30_455_826, gmvPct: 2_845.1, returnRate: 36.2, refund: 11_025_009, operatorName: "王铸" },
  { rank: 3, name: "buzzdrop", gmv: 5_258_914, gmvPct: 85.3, returnRate: 24.3, refund: 1_277_916, operatorName: null },
  { rank: 4, name: "Dr.Abla", gmv: 167_264, gmvPct: -90.0, returnRate: 29.8, refund: 49_845, operatorName: null },
  { rank: 5, name: "labo celle", gmv: 80_190, gmvPct: -91.4, returnRate: 33.3, refund: 26_703, operatorName: null },
] as const;

const recoveredStaff = [
  { name: "Alice", email: "fuying0929@gmail.com", sourceUserId: 210001 },
  { name: "Ash", email: "tings09@outlook.jp", sourceUserId: 540001 },
  { name: "Charles", email: "xf925928014@gmail.com", sourceUserId: 30045 },
  { name: "Cindy", email: "cindy121481@gmail.com", sourceUserId: 420009 },
  { name: "isshou", email: "isshou@livecommercejapan.jp", sourceUserId: 210002 },
  { name: "Lei", email: "lcgxyz123@gmail.com", sourceUserId: 1140002 },
  { name: "Taisei", email: "taisei.01128877@gmail.com", sourceUserId: 180001 },
  { name: "tsuji hanaco", email: "hanaco@livecommercejapan.jp", sourceUserId: 90001 },
  { name: "TT", email: "1227864158@qq.com", sourceUserId: 780017 },
  { name: "Wz", email: "1878073619@qq.com", sourceUserId: 720002 },
  { name: "李俊鸿", email: "1951474189@qq.com", sourceUserId: 720003 },
  { name: "橋村瞳", email: "hitomi@hashi-design.com", sourceUserId: 360001 },
  { name: "王铸", email: "wzzzm2026@outlook.com", sourceUserId: 930005 },
  { name: "锦文", email: "chenxiaoxi28@gmail.com", sourceUserId: 240001 },
] as const;

async function ensureRecoveryTable(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS \`gmv_hr_recovery_runs\` (
    \`id\` bigint NOT NULL AUTO_INCREMENT,
    \`recoveryKey\` varchar(100) NOT NULL,
    \`status\` varchar(20) NOT NULL,
    \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completedAt\` timestamp NULL DEFAULT NULL,
    \`storeCount\` int NOT NULL DEFAULT 0,
    \`totalGmv\` bigint NOT NULL DEFAULT 0,
    \`staffCount\` int NOT NULL DEFAULT 0,
    \`details\` json DEFAULT NULL,
    \`errorMessage\` text DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`gmv_hr_recovery_runs_key_unique\` (\`recoveryKey\`)
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

async function restoreStores(connection: PoolConnection): Promise<{ storeIds: number[]; totalGmv: number }> {
  const [activeStores] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM managed_stores WHERE isActive = 1 ORDER BY id LIMIT 20 FOR UPDATE",
  );
  if (activeStores.length !== stores.length) {
    throw new Error(`expected exactly ${stores.length} active stores, found ${activeStores.length}`);
  }

  const storeIds = activeStores.map((row) => Number(row.id));
  for (let index = 0; index < stores.length; index += 1) {
    const store = stores[index];
    const storeId = storeIds[index];
    await connection.execute(
      `UPDATE managed_stores SET
        name = ?, platform = 'tiktok_shop', country = 'japan',
        operatorName = ?, operatorId = NULL, operator2Id = NULL, operator2Name = NULL,
        notes = ?, isActive = 1
       WHERE id = ?`,
      [
        store.name,
        store.operatorName,
        `Recovered from original 2026-07 Store Management screenshot; rank ${store.rank}.`,
        storeId,
      ],
    );
    await connection.execute(
      "DELETE FROM store_data_uploads WHERE storeId = ? AND year = ? AND month = ? AND dataType = 'shop_stats'",
      [storeId, PERIOD.year, PERIOD.month],
    );
    const dataJson = JSON.stringify([{
      _type: "summary",
      GMV: { value: store.gmv, pct: store.gmvPct },
      "返金": { value: store.refund },
      _recoveryEvidence: {
        source: "user-provided-original-store-management-screenshot",
        observedReturnRate: store.returnRate,
        rank: store.rank,
      },
    }]);
    await connection.execute(
      `INSERT INTO store_data_uploads
        (storeId, dataType, year, month, dataJson, fileName, recordCount, uploadedBy)
       VALUES (?, 'shop_stats', ?, ?, ?, ?, 1, 'evidence-recovery')`,
      [storeId, PERIOD.year, PERIOD.month, dataJson, `recovered-2026-07-${store.rank}.json`],
    );
  }
  return { storeIds, totalGmv: stores.reduce((sum, store) => sum + store.gmv, 0) };
}

async function restoreStaff(connection: PoolConnection): Promise<{ inserted: number; reused: number; reportStaffInserted: number }> {
  let inserted = 0;
  let reused = 0;
  let reportStaffInserted = 0;
  for (const candidate of recoveredStaff) {
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT id, name FROM staff WHERE LOWER(email) = LOWER(?) ORDER BY id LIMIT 1 FOR UPDATE",
      [candidate.email],
    );
    let staffId: number;
    if (existing[0]) {
      staffId = Number(existing[0].id);
      reused += 1;
    } else {
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        `INSERT INTO staff
          (name, email, employmentType, isActive, notes)
         VALUES (?, ?, 'fulltime', 'active', ?)`,
        [
          candidate.name,
          candidate.email,
          `Recovered from pre-loss staff-authorized users row id=${candidate.sourceUserId}. Department, position, country and join date were not recoverable.`,
        ],
      );
      staffId = Number(result.insertId);
      inserted += 1;
    }

    const [linked] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM report_staff WHERE linkedStaffId = ? OR LOWER(name) = LOWER(?) ORDER BY id LIMIT 1 FOR UPDATE",
      [staffId, candidate.name],
    );
    if (linked[0]) {
      await connection.execute(
        "UPDATE report_staff SET linkedStaffId = ?, isActive = 'active' WHERE id = ?",
        [staffId, linked[0].id],
      );
    } else {
      await connection.execute(
        "INSERT INTO report_staff (name, country, linkedStaffId, isActive) VALUES (?, 'その他', ?, 'active')",
        [candidate.name, staffId],
      );
      reportStaffInserted += 1;
    }
  }
  return { inserted, reused, reportStaffInserted };
}

export async function runGmvHrRecoveryOnce(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[GmvHrRecovery] DATABASE_URL is missing; skipped");
    return;
  }
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
  let lockAcquired = false;
  try {
    await ensureRecoveryTable(pool);
    const [doneRows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM gmv_hr_recovery_runs WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    if (doneRows[0]?.status === "success") {
      console.log(`[GmvHrRecovery] already complete key=${RECOVERY_KEY}`);
      return;
    }

    const [lockRows] = await pool.query<RowDataPacket[]>("SELECT GET_LOCK(?, 15) AS locked", [RECOVERY_KEY]);
    lockAcquired = Number(lockRows[0]?.locked || 0) === 1;
    if (!lockAcquired) throw new Error("could not acquire recovery lock");

    await pool.execute(
      `INSERT INTO gmv_hr_recovery_runs (recoveryKey, status)
       VALUES (?, 'running')
       ON DUPLICATE KEY UPDATE status = 'running', startedAt = CURRENT_TIMESTAMP, completedAt = NULL, errorMessage = NULL`,
      [RECOVERY_KEY],
    );

    await runVerifiedBackup(pool, "pre-gmv-hr-recovery");
    const connection = await pool.getConnection();
    let storeResult: Awaited<ReturnType<typeof restoreStores>>;
    let staffResult: Awaited<ReturnType<typeof restoreStaff>>;
    try {
      await connection.beginTransaction();
      storeResult = await restoreStores(connection);
      staffResult = await restoreStaff(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await runVerifiedBackup(pool, "post-gmv-hr-recovery");
    const [storeCheck] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS stores, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(dataJson, '$[0].GMV.value')) AS UNSIGNED)), 0) AS totalGmv
       FROM store_data_uploads WHERE year = ? AND month = ? AND dataType = 'shop_stats'`,
      [PERIOD.year, PERIOD.month],
    );
    const [staffCheck] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS staffCount FROM staff WHERE isActive = 'active'");
    const observed = {
      stores: Number(storeCheck[0]?.stores || 0),
      totalGmv: Number(storeCheck[0]?.totalGmv || 0),
      activeStaff: Number(staffCheck[0]?.staffCount || 0),
    };
    if (observed.stores !== 5 || observed.totalGmv !== 134_334_533 || observed.activeStaff < 15) {
      throw new Error(`post-recovery verification failed ${JSON.stringify(observed)}`);
    }

    const details = { storeResult, staffResult, observed, expectedNewStaffEvidenceRows: recoveredStaff.length };
    await pool.execute(
      `UPDATE gmv_hr_recovery_runs SET status = 'success', completedAt = CURRENT_TIMESTAMP,
       storeCount = ?, totalGmv = ?, staffCount = ?, details = ? WHERE recoveryKey = ?`,
      [observed.stores, observed.totalGmv, observed.activeStaff, JSON.stringify(details), RECOVERY_KEY],
    );
    console.log(`[GmvHrRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000);
    await pool.execute(
      `INSERT INTO gmv_hr_recovery_runs (recoveryKey, status, errorMessage, completedAt)
       VALUES (?, 'failed', ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE status = 'failed', errorMessage = VALUES(errorMessage), completedAt = CURRENT_TIMESTAMP`,
      [RECOVERY_KEY, message],
    ).catch(() => undefined);
    console.error("[GmvHrRecovery] failed", error);
  } finally {
    if (lockAcquired) await pool.query("SELECT RELEASE_LOCK(?)", [RECOVERY_KEY]).catch(() => undefined);
    await pool.end();
  }
}
