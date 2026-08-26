import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

const UPGRADE_KEY = "store-data-retention-v1";
const REQUIRED_COLUMNS = [
  "isCurrent", "versionNumber", "supersedesId", "fileSha256", "dataSha256",
  "originalFileKey", "originalFileUrl", "fileSize", "mimeType", "parseVersion",
  "sourceKind", "evidenceJson", "deletedAt", "deletedBy", "deleteReason",
] as const;

function numeric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value && typeof value === "object" && "value" in value) return numeric((value as { value?: unknown }).value);
  const parsed = Number(String(value ?? "").replace(/[¥￥,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function refundKey(row: Record<string, unknown>): string | null {
  const preferred = ["返金", "退款金額", "退款金额", "退款", "返品金額", "キャンセル金額", "Refund", "refund"];
  for (const key of preferred) if (Object.prototype.hasOwnProperty.call(row, key)) return key;
  return Object.keys(row).find((key) => {
    const lower = key.toLowerCase();
    const refundLike = key.includes("返金") || key.includes("退款") || key.includes("キャンセル金額") || lower.includes("refund");
    const rateOrCount = key.includes("率") || key.includes("件数") || key.includes("数量") || lower.includes("rate") || lower.includes("count");
    return refundLike && !rateOrCount;
  }) || null;
}

function dateValue(row: Record<string, unknown>): string | null {
  for (const key of ["日期", "日付", "Date", "date"]) {
    const value = String(row[key] ?? "").trim();
    if (!value) continue;
    const normalized = value.slice(0, 10).replace(/\//g, "-");
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }
  return null;
}

async function ensureBaseTables(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_data_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    dataType ENUM('shop_stats','products','ads') NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    dataJson LONGTEXT,
    fileName VARCHAR(255),
    recordCount INT DEFAULT 0,
    uploadedBy VARCHAR(255),
    uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_period (storeId, year, month, dataType)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_data_upload_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_data_refund_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uploadId INT NOT NULL,
    storeId INT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    date DATE NOT NULL,
    refundAmount DECIMAL(20,2) NOT NULL DEFAULT 0,
    sourceField VARCHAR(255) NOT NULL,
    sourceRowIndex INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_refund_upload_date_row (uploadId, date, sourceRowIndex),
    INDEX idx_store_refund_store_date (storeId, date),
    INDEX idx_store_refund_period (year, month)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_data_upload_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uploadId INT NULL,
    storeId INT NOT NULL,
    action VARCHAR(48) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_upload_audit_store_time (storeId, createdAt),
    INDEX idx_store_upload_audit_upload (uploadId),
    INDEX idx_store_upload_audit_action (action)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function getColumns(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='store_data_uploads'`);
  return rows.map((row) => String(row.columnName));
}

async function applyMissingColumns(pool: Pool, missing: string[]): Promise<void> {
  const sql: Record<string, string> = {
    isCurrent: "ALTER TABLE store_data_uploads ADD COLUMN isCurrent TINYINT(1) NOT NULL DEFAULT 1",
    versionNumber: "ALTER TABLE store_data_uploads ADD COLUMN versionNumber INT NOT NULL DEFAULT 1",
    supersedesId: "ALTER TABLE store_data_uploads ADD COLUMN supersedesId INT NULL",
    fileSha256: "ALTER TABLE store_data_uploads ADD COLUMN fileSha256 CHAR(64) NULL",
    dataSha256: "ALTER TABLE store_data_uploads ADD COLUMN dataSha256 CHAR(64) NULL",
    originalFileKey: "ALTER TABLE store_data_uploads ADD COLUMN originalFileKey VARCHAR(1000) NULL",
    originalFileUrl: "ALTER TABLE store_data_uploads ADD COLUMN originalFileUrl VARCHAR(2000) NULL",
    fileSize: "ALTER TABLE store_data_uploads ADD COLUMN fileSize BIGINT NULL",
    mimeType: "ALTER TABLE store_data_uploads ADD COLUMN mimeType VARCHAR(255) NULL",
    parseVersion: "ALTER TABLE store_data_uploads ADD COLUMN parseVersion VARCHAR(64) NOT NULL DEFAULT 'legacy-v1'",
    sourceKind: "ALTER TABLE store_data_uploads ADD COLUMN sourceKind ENUM('user_upload','evidence_recovery','legacy_parsed') NOT NULL DEFAULT 'legacy_parsed'",
    evidenceJson: "ALTER TABLE store_data_uploads ADD COLUMN evidenceJson JSON NULL",
    deletedAt: "ALTER TABLE store_data_uploads ADD COLUMN deletedAt TIMESTAMP NULL",
    deletedBy: "ALTER TABLE store_data_uploads ADD COLUMN deletedBy VARCHAR(255) NULL",
    deleteReason: "ALTER TABLE store_data_uploads ADD COLUMN deleteReason VARCHAR(1000) NULL",
  };
  for (const column of missing) {
    if (!sql[column]) throw new Error(`unsupported store_data_uploads column: ${column}`);
    await pool.query(sql[column]);
  }
  await pool.query("CREATE INDEX idx_store_data_current_period ON store_data_uploads (storeId, year, month, dataType, isCurrent, deletedAt)").catch(() => undefined);
  await pool.query("CREATE INDEX idx_store_data_sha ON store_data_uploads (dataSha256)").catch(() => undefined);
}

async function migrateExistingUploads(pool: Pool): Promise<{ uploads: number; versions: number; refundRows: number; evidenceRows: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT id,storeId,dataType,year,month,dataJson,fileName,uploadedAt FROM store_data_uploads ORDER BY storeId,year,month,dataType,uploadedAt,id`);
  const groups = new Map<string, RowDataPacket[]>();
  for (const row of rows) {
    const key = [row.storeId,row.year,row.month,row.dataType].join(":");
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  let versions = 0;
  let refundRows = 0;
  let evidenceRows = 0;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const group of groups.values()) {
      for (let index = 0; index < group.length; index += 1) {
        const row = group[index];
        const isCurrent = index === group.length - 1 ? 1 : 0;
        const version = index + 1;
        const supersedesId = index > 0 ? Number(group[index - 1].id) : null;
        let hasEvidence = false;
        let parsed: unknown[] = [];
        try {
          parsed = JSON.parse(String(row.dataJson || "[]"));
          hasEvidence = Boolean(parsed?.[0] && typeof parsed[0] === "object" && (parsed[0] as Record<string,unknown>)._recoveryEvidence);
        } catch { parsed = []; }
        if (hasEvidence) evidenceRows += 1;
        await connection.query(`UPDATE store_data_uploads SET isCurrent=?,versionNumber=?,supersedesId=?,dataSha256=SHA2(COALESCE(dataJson,''),256),sourceKind=?,parseVersion=?,evidenceJson=? WHERE id=?`, [
          isCurrent, version, supersedesId,
          hasEvidence ? "evidence_recovery" : "legacy_parsed",
          hasEvidence ? "evidence-v1" : "legacy-v1",
          hasEvidence ? JSON.stringify({ source:"user-provided-original-store-management-screenshot", originalFileUnavailable:true }) : JSON.stringify({ originalFileUnavailable:true, parsedRowsPreserved:true }),
          Number(row.id),
        ]);
        versions += 1;
        if (Array.isArray(parsed)) {
          for (let sourceRowIndex = 0; sourceRowIndex < parsed.length; sourceRowIndex += 1) {
            const candidate = parsed[sourceRowIndex];
            if (!candidate || typeof candidate !== "object" || (candidate as Record<string,unknown>)._type === "summary") continue;
            const key = refundKey(candidate as Record<string,unknown>);
            const date = dateValue(candidate as Record<string,unknown>);
            if (!key || !date) continue;
            const amount = numeric((candidate as Record<string,unknown>)[key]);
            if (!amount) continue;
            await connection.query(`INSERT INTO store_data_refund_daily (uploadId,storeId,year,month,date,refundAmount,sourceField,sourceRowIndex) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE refundAmount=VALUES(refundAmount),sourceField=VALUES(sourceField)`, [Number(row.id),Number(row.storeId),Number(row.year),Number(row.month),date,amount,key,sourceRowIndex]);
            refundRows += 1;
          }
        }
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  return { uploads: rows.length, versions, refundRows, evidenceRows };
}

export async function runStoreDataRetentionUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for store data retention upgrade");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureBaseTables(pool);
    const existing = await getColumns(pool);
    const missing = REQUIRED_COLUMNS.filter((column) => !existing.includes(column));
    const [runRows] = await pool.query<RowDataPacket[]>("SELECT status FROM store_data_upload_upgrade_runs WHERE recoveryKey=? LIMIT 1", [UPGRADE_KEY]);
    if (missing.length === 0 && String(runRows[0]?.status || "") === "success") {
      console.log("[StoreDataRetentionUpgrade] schema and migration already complete");
      return;
    }
    await pool.query(`INSERT INTO store_data_upload_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage) VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL) ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`, [UPGRADE_KEY,JSON.stringify({missingBefore:missing})]);
    await applyMissingColumns(pool, missing);
    const migrated = await migrateExistingUploads(pool);
    const after = await getColumns(pool);
    const missingAfter = REQUIRED_COLUMNS.filter((column) => !after.includes(column));
    if (missingAfter.length) throw new Error(`retention columns still missing: ${missingAfter.join(",")}`);
    const details = { migrated, missingBefore:missing, missingAfter, destructiveChanges:0, preImplementationBackupRunId:"b53682e1-d73b-4616-9d0f-5d4245440e30" };
    await pool.query("UPDATE store_data_upload_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?", [JSON.stringify(details),UPGRADE_KEY]);
    console.log(`[StoreDataRetentionUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query("UPDATE store_data_upload_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?", [message.slice(0,4000),UPGRADE_KEY]).catch(()=>undefined);
    console.error(`[StoreDataRetentionUpgrade] failed ${message}`);
    throw error;
  } finally { await pool.end(); }
}

export async function getStoreDataRetentionHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureBaseTables(pool);
    const columns = await getColumns(pool);
    const missingColumns = REQUIRED_COLUMNS.filter((column)=>!columns.includes(column));
    const [counts] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS uploadCount,SUM(isCurrent=1 AND deletedAt IS NULL) AS currentCount,SUM(originalFileKey IS NOT NULL) AS originalFileCount,SUM(dataSha256 IS NOT NULL) AS hashedDataCount,SUM(sourceKind='evidence_recovery') AS evidenceCount FROM store_data_uploads`);
    const [refund] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS refundRowCount,COALESCE(SUM(refundAmount),0) AS exactRefundTotal FROM store_data_refund_daily");
    const [runs] = await pool.query<RowDataPacket[]>("SELECT status,completedAt,details,errorMessage FROM store_data_upload_upgrade_runs WHERE recoveryKey=? LIMIT 1",[UPGRADE_KEY]);
    return { healthy:missingColumns.length===0 && String(runs[0]?.status||"")==="success",upgradeKey:UPGRADE_KEY,missingColumns,counts:counts[0]||{},refund:refund[0]||{},run:runs[0]||null };
  } finally { await pool.end(); }
}
