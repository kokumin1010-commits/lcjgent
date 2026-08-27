import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const EXPECTED_KEY_HASH = "c1b538dc239652d5afc04b734d22758c10e48a026680c394f0b1603082c57cab";
const PRE_BACKUP_REASON = "pre-auction-import-schema-v1";

let auditPool: mysql.Pool | undefined;
function getPool() {
  if (!auditPool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    auditPool = mysql.createPool({ uri, connectionLimit: 2, waitForConnections: true, queueLimit: 20 });
  }
  return auditPool;
}

function verifyKey(value: string) {
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function requireKey(key: string) {
  if (!verifyKey(key)) throw new Error("not found");
}

export const auctionImportAuditRouter = router({
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .query(async ({ input }) => {
      await requireKey(input.key);
      const pool = getPool();
      const [columns] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auction_records'
         ORDER BY ORDINAL_POSITION`,
      );
      const columnNames = new Set(columns.map((column) => String(column.columnName)));
      const [tableRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS tableCount
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auction_records'`,
      );
      const tableExists = Number(tableRows[0]?.tableCount || 0) === 1;
      let records: Record<string, number | string | null> | null = null;
      if (tableExists) {
        const roundsExpression = columnNames.has("roundsJson")
          ? "SUM(CASE WHEN roundsJson IS NOT NULL AND roundsJson <> '' AND roundsJson <> '[]' THEN 1 ELSE 0 END)"
          : "0";
        const livestreamExpression = columnNames.has("livestreamId")
          ? "SUM(CASE WHEN livestreamId IS NOT NULL AND livestreamId <> '' THEN 1 ELSE 0 END)"
          : "0";
        const [recordRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) AS totalRecords,
                  COUNT(DISTINCT productId) AS distinctProducts,
                  COALESCE(${roundsExpression}, 0) AS recordsWithRounds,
                  COALESCE(${livestreamExpression}, 0) AS recordsWithLivestream,
                  MIN(auctionDate) AS earliestDate,
                  MAX(auctionDate) AS latestDate
           FROM auction_records`,
        );
        const row = recordRows[0] || {};
        records = {
          totalRecords: Number(row.totalRecords || 0),
          distinctProducts: Number(row.distinctProducts || 0),
          recordsWithRounds: Number(row.recordsWithRounds || 0),
          recordsWithLivestream: Number(row.recordsWithLivestream || 0),
          earliestDate: row.earliestDate == null ? null : String(row.earliestDate),
          latestDate: row.latestDate == null ? null : String(row.latestDate),
        };
      }
      const [backupRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT id, reason, status, completedAt, tableCount, rowCount, encryptedBytes, checksum
         FROM db_backup_runs
         WHERE reason IN (?, ?)
         ORDER BY id DESC
         LIMIT 10`,
        [PRE_BACKUP_REASON, "post-auction-import-schema-v1"],
      );
      return {
        capturedAt: new Date().toISOString(),
        tableExists,
        requiredColumns: {
          roundsJson: columnNames.has("roundsJson"),
          livestreamId: columnNames.has("livestreamId"),
        },
        columns,
        records,
        backups: backupRows.map((row) => ({
          id: Number(row.id),
          reason: String(row.reason),
          status: String(row.status),
          completedAt: row.completedAt ?? null,
          tableCount: row.tableCount == null ? null : Number(row.tableCount),
          rowCount: row.rowCount == null ? null : Number(row.rowCount),
          encryptedBytes: row.encryptedBytes == null ? null : Number(row.encryptedBytes),
          checksum: row.checksum == null ? null : String(row.checksum),
        })),
      };
    }),

  preBackup: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await requireKey(input.key);
      await runDatabaseBackup(PRE_BACKUP_REASON, { force: true, waitForActive: true });
      const [rows] = await getPool().query<mysql.RowDataPacket[]>(
        `SELECT id, reason, status, completedAt, tableCount, rowCount, encryptedBytes, checksum
         FROM db_backup_runs
         WHERE reason = ?
         ORDER BY id DESC
         LIMIT 1`,
        [PRE_BACKUP_REASON],
      );
      const row = rows[0];
      if (!row || String(row.status) !== "success") throw new Error("pre-backup verification failed");
      return {
        id: Number(row.id),
        reason: String(row.reason),
        status: String(row.status),
        completedAt: row.completedAt ?? null,
        tableCount: Number(row.tableCount || 0),
        rowCount: Number(row.rowCount || 0),
        encryptedBytes: Number(row.encryptedBytes || 0),
        checksum: String(row.checksum || ""),
      };
    }),
});
