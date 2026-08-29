import { createHash } from "node:crypto";
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { storageGet, storagePut } from "./storage";

export const FINANCE_IMPORT_MODULES = [
  "bank_statement",
  "payroll",
  "tiktok_orders",
  "tiktok_payment",
  "tap",
  "cap_creator",
  "cap_product",
] as const;

export type FinanceImportModule = (typeof FINANCE_IMPORT_MODULES)[number];
export type FinanceImportStatus = "processing" | "completed" | "failed";

export type FinanceImportDocumentInput = {
  module: FinanceImportModule;
  sourceFileName: string;
  sourceFileBase64: string;
  sourceMimeType?: string | null;
  entity?: "japan" | "china" | "all" | null;
  brandId?: number | null;
  reportMonth?: string | null;
  recordCount?: number;
  createdBy?: number | null;
  createdByName?: string | null;
  details?: Record<string, unknown> | null;
};

export type FinanceImportEvidenceDependencies = {
  pool?: Pool;
  putObject?: typeof storagePut;
  getObject?: typeof storageGet;
};

let financeImportPool: Pool | null = null;
let schemaPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!financeImportPool) {
    if (!process.env.DATABASE_URL) throw new Error("Database not available");
    financeImportPool = mysql.createPool(process.env.DATABASE_URL);
  }
  return financeImportPool;
}

export function normalizeFinanceImportFileName(fileName: string): string {
  return String(fileName || "")
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 500) || "finance-import.dat";
}

function safeStorageFileName(fileName: string): string {
  return normalizeFinanceImportFileName(fileName)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-180) || "finance-import.dat";
}

function normalizeMimeType(mimeType?: string | null): string {
  return String(mimeType || "application/octet-stream").trim().toLowerCase().slice(0, 255);
}

function decodeBase64(sourceFileBase64: string): Buffer {
  const compact = String(sourceFileBase64 || "").replace(/\s+/g, "");
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new Error("上传文件格式无效 / アップロードファイル形式が正しくありません");
  }
  const buffer = Buffer.from(compact, "base64");
  if (!buffer.length) throw new Error("上传文件为空 / アップロードファイルが空です");
  if (buffer.length > 30_000_000) throw new Error("文件必须小于30MB / ファイルは30MB以下にしてください");
  return buffer;
}

function extensionOf(fileName: string): string {
  return normalizeFinanceImportFileName(fileName).toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] || "";
}

function validateFileShape(fileName: string, buffer: Buffer): void {
  const extension = extensionOf(fileName);
  if (![".xlsx", ".xls", ".csv"].includes(extension)) {
    throw new Error("仅支持XLSX、XLS或CSV文件 / XLSX・XLS・CSVのみ対応しています");
  }
  if (extension === ".xlsx") {
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZip) throw new Error("XLSX文件内容无效 / XLSXファイル内容が正しくありません");
  }
  if (extension === ".xls") {
    const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!signature.every((value, index) => buffer[index] === value)) {
      throw new Error("XLS文件内容无效 / XLSファイル内容が正しくありません");
    }
  }
  if (extension === ".csv") {
    const hasUtf16Bom = buffer.length >= 2 && ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff));
    if (buffer.includes(0) && !hasUtf16Bom) {
      throw new Error("CSV文件内容无效 / CSVファイル内容が正しくありません");
    }
  }
}

export async function ensureFinanceImportEvidenceSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS finance_import_documents (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        module ENUM('bank_statement','payroll','tiktok_orders','tiktok_payment','tap','cap_creator','cap_product') NOT NULL,
        entity ENUM('japan','china','all') DEFAULT NULL,
        brandId INT DEFAULT NULL,
        reportMonth VARCHAR(7) DEFAULT NULL,
        sourceFileName VARCHAR(500) NOT NULL,
        sourceFileSha256 CHAR(64) NOT NULL,
        sourceFileSize BIGINT UNSIGNED NOT NULL,
        sourceMimeType VARCHAR(255) NOT NULL,
        sourceStorageKey VARCHAR(1000) DEFAULT NULL,
        recordCount INT NOT NULL DEFAULT 0,
        importedCount INT NOT NULL DEFAULT 0,
        skippedCount INT NOT NULL DEFAULT 0,
        errorCount INT NOT NULL DEFAULT 0,
        status ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
        errorMessage TEXT DEFAULT NULL,
        details JSON DEFAULT NULL,
        relatedImportId BIGINT DEFAULT NULL,
        createdBy INT DEFAULT NULL,
        createdByName VARCHAR(255) DEFAULT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completedAt TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_finance_import_created (createdAt),
        INDEX idx_finance_import_module_created (module, createdAt),
        INDEX idx_finance_import_context (entity, brandId, reportMonth),
        INDEX idx_finance_import_hash (sourceFileSha256)
      )`);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function createFinanceImportDocument(
  input: FinanceImportDocumentInput,
  dependencies: FinanceImportEvidenceDependencies = {},
) {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  const sourceFileName = normalizeFinanceImportFileName(input.sourceFileName);
  const buffer = decodeBase64(input.sourceFileBase64);
  validateFileShape(sourceFileName, buffer);
  const sourceFileSha256 = createHash("sha256").update(buffer).digest("hex");
  const sourceMimeType = normalizeMimeType(input.sourceMimeType);
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const sourceStorageKey = `private/finance-imports/${input.module}/${year}/${month}/${sourceFileSha256}-${safeStorageFileName(sourceFileName)}`;
  const detailsJson = input.details ? JSON.stringify(input.details) : null;

  const [insertResult] = await pool.query<ResultSetHeader>(
    `INSERT INTO finance_import_documents
      (module, entity, brandId, reportMonth, sourceFileName, sourceFileSha256, sourceFileSize, sourceMimeType,
       recordCount, status, details, createdBy, createdByName)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`,
    [
      input.module,
      input.entity || null,
      input.brandId ?? null,
      input.reportMonth || null,
      sourceFileName,
      sourceFileSha256,
      buffer.length,
      sourceMimeType,
      Math.max(0, Number(input.recordCount || 0)),
      detailsJson,
      input.createdBy ?? null,
      input.createdByName || null,
    ],
  );
  const id = Number(insertResult.insertId);

  try {
    await (dependencies.putObject || storagePut)(sourceStorageKey, buffer, sourceMimeType);
    await pool.query(`UPDATE finance_import_documents SET sourceStorageKey=? WHERE id=?`, [sourceStorageKey, id]);
    return {
      id,
      sourceFileName,
      sourceFileSha256,
      sourceFileSize: buffer.length,
      sourceMimeType,
      originalFileSaved: true as const,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE finance_import_documents SET status='failed', errorMessage=?, completedAt=CURRENT_TIMESTAMP WHERE id=?`,
      [message.slice(0, 4000), id],
    ).catch(() => undefined);
    throw new Error(`原始文件保存失败，未执行导入 / 元ファイル保存失敗のためインポートを中止しました: ${message}`);
  }
}

export async function completeFinanceImportDocument(
  id: number,
  result: {
    recordCount?: number;
    importedCount?: number;
    skippedCount?: number;
    errorCount?: number;
    relatedImportId?: number | null;
    details?: Record<string, unknown> | null;
  },
  dependencies: FinanceImportEvidenceDependencies = {},
): Promise<void> {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  await pool.query(
    `UPDATE finance_import_documents
        SET recordCount=?, importedCount=?, skippedCount=?, errorCount=?, relatedImportId=?, details=COALESCE(?, details),
            status='completed', errorMessage=NULL, completedAt=CURRENT_TIMESTAMP
      WHERE id=?`,
    [
      Math.max(0, Number(result.recordCount || 0)),
      Math.max(0, Number(result.importedCount || 0)),
      Math.max(0, Number(result.skippedCount || 0)),
      Math.max(0, Number(result.errorCount || 0)),
      result.relatedImportId ?? null,
      result.details ? JSON.stringify(result.details) : null,
      id,
    ],
  );
}

export async function failFinanceImportDocument(
  id: number,
  error: unknown,
  result: { recordCount?: number; importedCount?: number; skippedCount?: number; errorCount?: number } = {},
  dependencies: FinanceImportEvidenceDependencies = {},
): Promise<void> {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  const message = error instanceof Error ? error.message : String(error);
  await pool.query(
    `UPDATE finance_import_documents
        SET recordCount=?, importedCount=?, skippedCount=?, errorCount=?, status='failed', errorMessage=?, completedAt=CURRENT_TIMESTAMP
      WHERE id=?`,
    [
      Math.max(0, Number(result.recordCount || 0)),
      Math.max(0, Number(result.importedCount || 0)),
      Math.max(0, Number(result.skippedCount || 0)),
      Math.max(1, Number(result.errorCount || 1)),
      message.slice(0, 4000),
      id,
    ],
  );
}

function mapDocumentRow(row: RowDataPacket) {
  return {
    id: Number(row.id),
    module: String(row.module) as FinanceImportModule,
    entity: row.entity == null ? null : String(row.entity),
    brandId: row.brandId == null ? null : Number(row.brandId),
    reportMonth: row.reportMonth == null ? null : String(row.reportMonth),
    sourceFileName: String(row.sourceFileName),
    sourceFileSha256Short: String(row.sourceFileSha256).slice(0, 12),
    sourceFileSize: Number(row.sourceFileSize || 0),
    sourceMimeType: String(row.sourceMimeType || "application/octet-stream"),
    originalFileSaved: Boolean(row.sourceStorageKey),
    recordCount: Number(row.recordCount || 0),
    importedCount: Number(row.importedCount || 0),
    skippedCount: Number(row.skippedCount || 0),
    errorCount: Number(row.errorCount || 0),
    status: String(row.status) as FinanceImportStatus,
    errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    details: row.details ?? null,
    relatedImportId: row.relatedImportId == null ? null : Number(row.relatedImportId),
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    createdByName: row.createdByName == null ? null : String(row.createdByName),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export async function listFinanceImportDocuments(
  input: { modules?: FinanceImportModule[]; entity?: "japan" | "china" | "all"; limit?: number } = {},
  dependencies: FinanceImportEvidenceDependencies = {},
) {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.modules?.length) {
    where.push(`module IN (${input.modules.map(() => "?").join(",")})`);
    params.push(...input.modules);
  }
  if (input.entity && input.entity !== "all") {
    where.push("entity=?");
    params.push(input.entity);
  }
  const limit = Math.max(1, Math.min(100, Number(input.limit || 30)));
  params.push(limit);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, module, entity, brandId, reportMonth, sourceFileName, sourceFileSha256, sourceFileSize, sourceMimeType,
            sourceStorageKey, recordCount, importedCount, skippedCount, errorCount, status, errorMessage, details,
            relatedImportId, createdBy, createdByName, createdAt, completedAt
       FROM finance_import_documents
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY createdAt DESC, id DESC
       LIMIT ?`,
    params,
  );
  return rows.map(mapDocumentRow);
}

export async function getFinanceImportDocumentMetadata(
  id: number,
  dependencies: FinanceImportEvidenceDependencies = {},
) {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, module, sourceFileName, sourceStorageKey FROM finance_import_documents WHERE id=? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new Error("导入记录不存在 / インポート履歴が見つかりません");
  return {
    id: Number(row.id),
    module: String(row.module) as FinanceImportModule,
    fileName: String(row.sourceFileName),
    originalFileSaved: Boolean(row.sourceStorageKey),
  };
}

export async function getFinanceImportDocumentFile(
  id: number,
  dependencies: FinanceImportEvidenceDependencies = {},
) {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT module, sourceFileName, sourceStorageKey FROM finance_import_documents WHERE id=? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new Error("导入记录不存在 / インポート履歴が見つかりません");
  if (!row.sourceStorageKey) throw new Error("该记录没有保存原始文件 / この履歴には元ファイルが保存されていません");
  const signed = await (dependencies.getObject || storageGet)(String(row.sourceStorageKey));
  return { module: String(row.module) as FinanceImportModule, fileName: String(row.sourceFileName), url: signed.url };
}

export function resetFinanceImportEvidenceForTests() {
  schemaPromise = null;
  financeImportPool = null;
}

export async function getFinanceImportEvidenceHealth(dependencies: FinanceImportEvidenceDependencies = {}) {
  const pool = dependencies.pool || getPool();
  await ensureFinanceImportEvidenceSchema(pool);
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN sourceStorageKey IS NOT NULL THEN 1 ELSE 0 END) AS saved,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
      MAX(createdAt) AS latestAt
    FROM finance_import_documents
  `);
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    saved: Number(row.saved || 0),
    completed: Number(row.completed || 0),
    failed: Number(row.failed || 0),
    latestAt: row.latestAt || null,
  };
}
