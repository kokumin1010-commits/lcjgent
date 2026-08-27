import crypto from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const EXPECTED_KEY_HASH = "5fc0f7b121626293dfd7b3eeb3a116edd88c5c9ab0e9fab12c0e38f02e9dae90";
const PRE_BACKUP_REASON = "pre-lcf-general-apply-upgrade-v1";
let pool: Pool | null = null;

function requireAuditKey(value: string): void {
  const actual = crypto.createHash("sha256").update(value).digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, "hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("audit key rejected");
  }
}

function getPool(): Pool {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 2, enableKeepAlive: true });
  return pool;
}

async function snapshot() {
  const db = getPool();
  const [columns] = await db.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, IS_NULLABLE AS nullable
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'festival_general_applications'
      ORDER BY ORDINAL_POSITION`,
  );
  const columnNames = new Set(columns.map((row) => String(row.name)));
  const withSocialSql = columnNames.has("line_or_lark") ? "SUM(line_or_lark IS NOT NULL AND line_or_lark <> '')" : "0";
  const withBrandSql = columnNames.has("brand_name") ? "SUM(brand_name IS NOT NULL AND brand_name <> '')" : "0";
  const withIndustrySql = columnNames.has("industry_types") ? "SUM(industry_types IS NOT NULL)" : "0";
  const [counts] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(event_year = '2026') AS event2026,
            SUM(status = 'confirmed') AS confirmed,
            ${withSocialSql} AS withSocial,
            ${withBrandSql} AS withBrand,
            ${withIndustrySql} AS withIndustry
       FROM festival_general_applications`,
  );
  const [duplicates] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS duplicateGroups, COALESCE(SUM(groupSize - 1), 0) AS duplicateRows
       FROM (
         SELECT COUNT(*) AS groupSize
           FROM festival_general_applications
          GROUP BY LOWER(TRIM(email)), event_year
         HAVING COUNT(*) > 1
       ) grouped`,
  );
  const [backups] = await db.query<RowDataPacket[]>(
    `SELECT id, reason, status, tableCount, rowCount, encryptedBytes, completedAt, errorMessage
       FROM db_backup_runs
      WHERE reason = ?
      ORDER BY id DESC LIMIT 3`,
    [PRE_BACKUP_REASON],
  );

  return {
    capturedAt: new Date().toISOString(),
    requiredColumns: ["line_or_lark", "brand_name", "industry_types"],
    columns: columns.map((row) => ({ name: String(row.name), dataType: String(row.dataType), nullable: String(row.nullable) })),
    counts: {
      total: Number(counts[0]?.total || 0),
      event2026: Number(counts[0]?.event2026 || 0),
      confirmed: Number(counts[0]?.confirmed || 0),
      withSocial: Number(counts[0]?.withSocial || 0),
      withBrand: Number(counts[0]?.withBrand || 0),
      withIndustry: Number(counts[0]?.withIndustry || 0),
    },
    duplicates: {
      groups: Number(duplicates[0]?.duplicateGroups || 0),
      extraRows: Number(duplicates[0]?.duplicateRows || 0),
    },
    backups: backups.map((row) => ({
      id: Number(row.id),
      reason: String(row.reason),
      status: String(row.status),
      tableCount: row.tableCount == null ? null : Number(row.tableCount),
      rowCount: row.rowCount == null ? null : Number(row.rowCount),
      encryptedBytes: row.encryptedBytes == null ? null : Number(row.encryptedBytes),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    })),
  };
}

export const festivalGeneralApplyAuditRouter = router({
  snapshot: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).query(async ({ input }) => {
    requireAuditKey(input.key);
    return snapshot();
  }),
  preBackup: publicProcedure.input(z.object({ key: z.string().min(32).max(256) })).mutation(async ({ input }) => {
    requireAuditKey(input.key);
    const db = getPool();
    const [beforeRows] = await db.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
    const beforeId = Number(beforeRows[0]?.id || 0);
    await runDatabaseBackup(PRE_BACKUP_REASON, { force: true, waitForActive: true });
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, reason, status, tableCount, rowCount, encryptedBytes, checksum, errorMessage
         FROM db_backup_runs
        WHERE id > ? AND reason = ?
        ORDER BY id DESC LIMIT 1`,
      [beforeId, PRE_BACKUP_REASON],
    );
    const row = rows[0];
    if (!row || String(row.status) !== "success") throw new Error(`backup failed: ${String(row?.errorMessage || "missing run")}`);
    return {
      id: Number(row.id),
      reason: String(row.reason),
      status: String(row.status),
      tableCount: Number(row.tableCount || 0),
      rowCount: Number(row.rowCount || 0),
      encryptedBytes: Number(row.encryptedBytes || 0),
      checksum: String(row.checksum || ""),
    };
  }),
});
