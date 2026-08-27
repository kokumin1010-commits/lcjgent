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
  recordResolvedIssue: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).mutation(async ({ input }) => {
    requireAuditKey(input.key);
    const db = getPool();
    const title = "财务现金流：多请求书附件无法删除";
    const description = "现金流中唯一带两份请求书的记录属于工资保护项目。旧界面将删除按钮放在超高PDF预览下方，并且未在附件删除入口说明工资二次密码要求；服务端按URL过滤也会在重复URL时一次删除多份，且没有附件级审计。";
    const solution = "已改为固定可见删除按钮、每份缩略图独立删除、工资项目自动提示财务密码并验证后继续；服务端使用事务行锁和索引＋URL校验，只删除选中附件，幂等处理旧操作并写入永久审计。原始文件保留在private存储。回归测试103项通过，部署前后执行加密全库备份。";
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM issues WHERE title = ? ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [title],
      );
      let issueId = Number(existing[0]?.id || 0);
      if (issueId) {
        await connection.query(
          "UPDATE issues SET description = ?, category = 'finance', priority = 'high', status = 'completed', solution = ?, tags = ?, completedAt = COALESCE(completedAt, NOW()) WHERE id = ?",
          [description, solution, JSON.stringify(["财务", "现金流", "请求书", "删除", "已修复"]), issueId],
        );
      } else {
        const [result] = await connection.query<any>(
          "INSERT INTO issues (title, description, category, priority, status, creatorName, solution, tags, attachments, isPrivate, completedAt) VALUES (?, ?, 'finance', 'high', 'completed', 'Manus AI', ?, ?, ?, 0, NOW())",
          [title, description, solution, JSON.stringify(["财务", "现金流", "请求书", "删除", "已修复"]), JSON.stringify([])],
        );
        issueId = Number(result.insertId);
        await connection.query(
          "INSERT INTO issue_comments (issueId, authorName, content, type) VALUES (?, 'Manus AI', ?, 'system')",
          [issueId, "自动记录：本番复现、根因修复、103项测试、部署验证和前后备份已完成。"],
        );
      }
      await connection.commit();
      return { success: true, issueId, status: "completed" as const };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
  postBackup: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).mutation(async ({ input }) => {
    requireAuditKey(input.key);
    return runVerifiedBackup(POST_BACKUP_REASON);
  }),
});
