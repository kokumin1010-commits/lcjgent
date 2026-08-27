import crypto from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import { PAYROLL_PROTECTED_ROW_SQL } from "./payrollAccess";

const EXPECTED_KEY_HASH = "2bd1d3fef95e395fb437377cf12b23dde2f0521b5bb103150853cc2876b77f7c";
const PRE_BACKUP_REASON = "pre-cashflow-receipt-delete-v1";
const POST_BACKUP_REASON = "post-cashflow-receipt-delete-v1";
let pool: Pool | null = null;

function requireAuditKey(value: string): void {
  const actual = crypto.createHash("sha256").update(value).digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, "hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("invalid audit key");
  }
}

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
    pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 2 });
  }
  return pool;
}

async function snapshot() {
  const db = getPool();
  const [rows] = await db.query<RowDataPacket[]>(`
    SELECT
      COUNT(*) AS activeRows,
      SUM(receiptUrl IS NOT NULL AND TRIM(receiptUrl) <> '') AS rowsWithReceipt,
      SUM(receiptUrl IS NOT NULL AND TRIM(receiptUrl) <> '' AND NOT JSON_VALID(receiptUrl)) AS legacySingleRows,
      SUM(JSON_VALID(receiptUrl) AND JSON_TYPE(receiptUrl) = 'ARRAY' AND JSON_LENGTH(receiptUrl) = 1) AS jsonSingleRows,
      SUM(JSON_VALID(receiptUrl) AND JSON_TYPE(receiptUrl) = 'ARRAY' AND JSON_LENGTH(receiptUrl) > 1) AS multiReceiptRows,
      SUM(JSON_VALID(receiptUrl) AND JSON_TYPE(receiptUrl) = 'ARRAY' AND JSON_LENGTH(receiptUrl) = 2) AS twoReceiptRows,
      MAX(CASE WHEN JSON_VALID(receiptUrl) AND JSON_TYPE(receiptUrl) = 'ARRAY' THEN JSON_LENGTH(receiptUrl) ELSE 1 END) AS maxReceiptCount,
      SUM(receiptUrl IS NOT NULL AND TRIM(receiptUrl) <> '' AND ${PAYROLL_PROTECTED_ROW_SQL}) AS payrollProtectedReceiptRows,
      SUM(transactionDate = '2026-08-25' AND sourceAccount = 'LCJ MITSUI' AND receiptUrl IS NOT NULL AND TRIM(receiptUrl) <> '') AS screenshotDayMitsuiReceiptRows,
      SUM(transactionDate = '2026-08-25' AND sourceAccount = 'LCJ MITSUI' AND JSON_VALID(receiptUrl) AND JSON_TYPE(receiptUrl) = 'ARRAY' AND JSON_LENGTH(receiptUrl) = 2) AS screenshotDayMitsuiTwoReceiptRows
    FROM company_cashflows
    WHERE deletedAt IS NULL
  `);
  const [auditRows] = await db.query<RowDataPacket[]>(`
    SELECT
      COUNT(*) AS totalAuditRows,
      SUM(action = 'delete') AS rowDeleteAuditRows,
      SUM(action = 'update' AND JSON_EXTRACT(changes, '$.receiptAction') IS NOT NULL) AS receiptActionAuditRows
    FROM cashflow_audit_log
  `).catch(() => [[] as RowDataPacket[], []] as any);
  const [columns] = await db.query<RowDataPacket[]>(`
    SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'company_cashflows'
       AND COLUMN_NAME IN ('receiptUrl', 'deletedAt', 'category', 'payrollRecordKey', 'payrollMonth', 'payrollEmployee')
     ORDER BY COLUMN_NAME
  `);
  const [backups] = await db.query<RowDataPacket[]>(`
    SELECT id, reason, status, tableCount, rowCount, encryptedBytes, completedAt, errorMessage
      FROM db_backup_runs
     WHERE reason IN (?, ?)
     ORDER BY id DESC LIMIT 6
  `, [PRE_BACKUP_REASON, POST_BACKUP_REASON]);
  return {
    capturedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(rows[0] || {}).map(([key, value]) => [key, Number(value || 0)])),
    audit: Object.fromEntries(Object.entries(auditRows[0] || {}).map(([key, value]) => [key, Number(value || 0)])),
    columns: columns.map((row) => ({ name: String(row.name), type: String(row.type) })),
    backups: backups.map((row) => ({
      id: Number(row.id), reason: String(row.reason), status: String(row.status),
      tableCount: Number(row.tableCount || 0), rowCount: Number(row.rowCount || 0),
      encryptedBytes: Number(row.encryptedBytes || 0), completedAt: row.completedAt, errorMessage: row.errorMessage,
    })),
  };
}

async function runVerifiedBackup(reason: string) {
  const db = getPool();
  const [beforeRows] = await db.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  const beforeId = Number(beforeRows[0]?.id || 0);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await db.query<RowDataPacket[]>(`
    SELECT id, reason, status, tableCount, rowCount, encryptedBytes, checksum, errorMessage
      FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1
  `, [beforeId, reason]);
  const row = rows[0];
  if (!row || String(row.status) !== "success") throw new Error(`backup failed: ${String(row?.errorMessage || "missing run")}`);
  return {
    id: Number(row.id), reason: String(row.reason), status: String(row.status),
    tableCount: Number(row.tableCount || 0), rowCount: Number(row.rowCount || 0),
    encryptedBytes: Number(row.encryptedBytes || 0), checksum: String(row.checksum || ""),
  };
}

export const cashflowReceiptDeleteAuditRouter = router({
  snapshot: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).query(async ({ input }) => {
    requireAuditKey(input.key);
    return snapshot();
  }),
  preBackup: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).mutation(async ({ input }) => {
    requireAuditKey(input.key);
    return runVerifiedBackup(PRE_BACKUP_REASON);
  }),
  postBackup: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).mutation(async ({ input }) => {
    requireAuditKey(input.key);
    return runVerifiedBackup(POST_BACKUP_REASON);
  }),
});
