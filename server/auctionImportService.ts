import { createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import * as XLSX from "xlsx";
import { parseAuctionExcelRows, type AuctionRecordImport } from "@shared/auctionExcelParser";
import { normalizeAuctionDate, normalizeAuctionRounds } from "@shared/auctionRecordPersistence";
import { ensureAuctionSchemaReady, getAuctionPool } from "./auctionSchemaUpgrade";
import { storageDelete, storageGet, storagePut } from "./storage";

export type AuctionImportRecord = AuctionRecordImport;

export type AuctionImportBatchInput = {
  sourceFileName: string;
  sourceFileSha256: string;
  sourceFileBase64: string;
  sourceFileSize: number;
  sourceMimeType: string;
  fallbackDate?: string;
  liverName: string;
  createdBy: number | null;
};

export type AuctionImportDependencies = {
  pool?: Pool;
  ensureSchemaReady?: (pool: Pool) => Promise<void>;
  putObject?: typeof storagePut;
  deleteObject?: typeof storageDelete;
};

function normalizeFileName(fileName: string): string {
  return fileName.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 500) || "auction-import.xlsx";
}

function safeStorageName(fileName: string): string {
  return normalizeFileName(fileName).replace(/[^A-Za-z0-9._-]+/g, "_").slice(-180) || "auction-import.xlsx";
}

const MIME_BY_EXTENSION: Record<string, Set<string>> = {
  ".xlsx": new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ]),
  ".xls": new Set([
    "application/vnd.ms-excel",
    "application/x-ole-storage",
    "application/octet-stream",
  ]),
  ".csv": new Set([
    "text/csv",
    "application/csv",
    "text/plain",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ]),
};

function fileExtension(fileName: string): string {
  const match = normalizeFileName(fileName).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] || "";
}

function isCsvText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 64_000)).toString("utf8").replace(/^\uFEFF/, "");
  if (sample.includes("\uFFFD") || !sample.includes("\n")) return false;
  return /[,;\t]/.test(sample.split("\n", 1)[0] || "");
}

export function validateAuctionImportFile(fileName: string, mimeType: string, buffer: Buffer): { extension: string; mimeType: string } {
  const extension = fileExtension(fileName);
  if (!MIME_BY_EXTENSION[extension]) {
    throw new Error("仅支持XLSX、XLS或CSV文件 / XLSX・XLS・CSVのみアップロードできます");
  }
  const normalizedMime = String(mimeType || "application/octet-stream").trim().toLowerCase();
  if (!MIME_BY_EXTENSION[extension].has(normalizedMime)) {
    throw new Error("文件扩展名与MIME类型不一致 / ファイル拡張子とMIMEタイプが一致しません");
  }
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const isXlsx = isZip && buffer.includes(Buffer.from("[Content_Types].xml")) && buffer.includes(Buffer.from("xl/"));
  const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  const isXls = buffer.length >= oleSignature.length && oleSignature.every((value, index) => buffer[index] === value);
  const signatureMatches = extension === ".xlsx" ? isXlsx : extension === ".xls" ? isXls : isCsvText(buffer);
  if (!signatureMatches) {
    throw new Error("文件内容与扩展名不一致或文件已损坏 / ファイル内容と拡張子が一致しないか、ファイルが壊れています");
  }
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    if (!workbook.SheetNames.length || !workbook.Sheets[workbook.SheetNames[0]]) throw new Error("empty workbook");
  } catch {
    throw new Error("文件无法解析为Excel/CSV / Excel・CSVとして解析できません");
  }
  return { extension, mimeType: normalizedMime };
}

async function findExistingBatch(connection: PoolConnection, hash: string, liverName: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, status, sourceStorageKey, sourceRowCount, groupedRecordCount, importedRecordCount, skippedRowCount, createdAt, completedAt
       FROM auction_import_batches
      WHERE sourceFileSha256 = ? AND liverName = ?
      LIMIT 1
      FOR UPDATE`,
    [hash, liverName],
  );
  return rows[0] || null;
}

export async function importAuctionBatch(input: AuctionImportBatchInput, dependencies: AuctionImportDependencies = {}) {
  const pool = dependencies.pool || getAuctionPool();
  await (dependencies.ensureSchemaReady || ensureAuctionSchemaReady)(pool);
  const normalizedFileName = normalizeFileName(input.sourceFileName);
  const normalizedLiverName = input.liverName.trim();
  if (!normalizedLiverName) throw new Error("主播名は必須です");
  const compactBase64 = input.sourceFileBase64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compactBase64) || compactBase64.length % 4 !== 0) {
    throw new Error("上传文件的base64格式无效 / アップロードファイルのbase64形式が正しくありません");
  }
  const fileBuffer = Buffer.from(compactBase64, "base64");
  if (fileBuffer.length === 0 || fileBuffer.length > 30_000_000) throw new Error("元Excelは30MB以下である必要があります");
  if (fileBuffer.length !== input.sourceFileSize) throw new Error("元Excelのサイズが一致しません");
  const verifiedHash = createHash("sha256").update(fileBuffer).digest("hex");
  if (verifiedHash !== input.sourceFileSha256) throw new Error("元ExcelのSHA-256が一致しません");
  const verifiedFile = validateAuctionImportFile(normalizedFileName, input.sourceMimeType, fileBuffer);
  const fallbackDate = normalizeAuctionDate(input.fallbackDate ?? new Date().toISOString().slice(0, 10));
  if (!fallbackDate) throw new Error("拍卖日期无效 / 拍卖日が正しくありません");
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!worksheet) throw new Error("文件中没有可读取的工作表 / 読み取れるシートがありません");
  const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });
  const parsedImport = parseAuctionExcelRows(rows, fallbackDate);
  const records: AuctionImportRecord[] = parsedImport.records.map((record) => ({
    ...record,
    roundsJson: JSON.stringify(normalizeAuctionRounds(record.roundsJson)),
  }));
  if (records.length === 0) throw new Error("導入可能な拍卖記録がありません");
  const [duplicateRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status, sourceStorageKey, sourceRowCount, groupedRecordCount, importedRecordCount, skippedRowCount
       FROM auction_import_batches
      WHERE sourceFileSha256=? AND liverName=? LIMIT 1`,
    [verifiedHash, normalizedLiverName],
  );
  const duplicate = duplicateRows[0];
  if (duplicate?.status === "success") {
    return {
      success: true as const,
      alreadyImported: true as const,
      batchId: Number(duplicate.id),
      sourceRowCount: Number(duplicate.sourceRowCount || 0),
      groupedRecordCount: Number(duplicate.groupedRecordCount || 0),
      importedRecordCount: Number(duplicate.importedRecordCount || 0),
      skippedRowCount: Number(duplicate.skippedRowCount || 0),
      originalFileSaved: Boolean(duplicate.sourceStorageKey),
    };
  }
  const sourceStorageKey = `private/auction-imports/${verifiedHash}-${safeStorageName(normalizedFileName)}`;
  await (dependencies.putObject || storagePut)(sourceStorageKey, fileBuffer, verifiedFile.mimeType);
  let preserveUploadedFile = false;

  let connection: PoolConnection | null = null;
  let batchId: number | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const existing = await findExistingBatch(connection, input.sourceFileSha256, normalizedLiverName);
    if (existing?.status === "success") {
      await connection.commit();
      return {
        success: true as const,
        alreadyImported: true as const,
        batchId: Number(existing.id),
        sourceRowCount: Number(existing.sourceRowCount || 0),
        groupedRecordCount: Number(existing.groupedRecordCount || 0),
        importedRecordCount: Number(existing.importedRecordCount || 0),
        skippedRowCount: Number(existing.skippedRowCount || 0),
        originalFileSaved: Boolean(existing.sourceStorageKey),
      };
    }
    if (existing) {
      batchId = Number(existing.id);
      await connection.query(
        `UPDATE auction_import_batches
            SET sourceFileName=?, sourceFileSize=?, sourceMimeType=?, sourceStorageKey=?, sourceRowCount=?, groupedRecordCount=?, importedRecordCount=0,
                skippedRowCount=?, status='running', errorMessage=NULL, createdBy=?, completedAt=NULL
          WHERE id=?`,
        [normalizedFileName, fileBuffer.length, verifiedFile.mimeType, sourceStorageKey, parsedImport.sourceRowCount, records.length, parsedImport.skippedRowCount, input.createdBy, batchId],
      );
      preserveUploadedFile = true;
    } else {
      const [insertBatch] = await connection.query(
        `INSERT INTO auction_import_batches
          (sourceFileName, sourceFileSha256, sourceFileSize, sourceMimeType, sourceStorageKey, sourceRowCount, groupedRecordCount, importedRecordCount, skippedRowCount, liverName, status, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'running', ?)`,
        [normalizedFileName, verifiedHash, fileBuffer.length, verifiedFile.mimeType, sourceStorageKey, parsedImport.sourceRowCount, records.length, parsedImport.skippedRowCount, normalizedLiverName, input.createdBy],
      );
      batchId = Number((insertBatch as { insertId: number }).insertId);
      preserveUploadedFile = true;
    }

    let importedRecordCount = 0;
    for (const record of records) {
      await connection.query(
        `INSERT INTO auction_records
          (productId, productName, startPrice, finalPrice, totalGmv, totalOrders, auctionCount, liverName, auctionDate, note, roundsJson, createdBy, sourceFileName, sourceFileSha256, sourceRowCount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Excelインポート', ?, ?, ?, ?, ?)`,
        [
          record.productId,
          record.productName,
          record.startPrice,
          record.finalPrice,
          record.totalGmv,
          record.totalOrders,
          record.auctionCount,
          normalizedLiverName,
          record.auctionDate,
          record.roundsJson,
          input.createdBy,
          normalizedFileName,
          input.sourceFileSha256,
          parsedImport.sourceRowCount,
        ],
      );
      importedRecordCount += 1;
    }

    await connection.query(
      `UPDATE auction_import_batches
          SET importedRecordCount=?, status='success', completedAt=CURRENT_TIMESTAMP, errorMessage=NULL
        WHERE id=?`,
      [importedRecordCount, batchId],
    );
    await connection.commit();
    return {
      success: true as const,
      alreadyImported: false as const,
      batchId,
      sourceRowCount: parsedImport.sourceRowCount,
      groupedRecordCount: records.length,
      importedRecordCount,
      skippedRowCount: parsedImport.skippedRowCount,
      originalFileSaved: true,
    };
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    if (batchId !== null) {
      const [failureMark] = await pool
        .query(
          `UPDATE auction_import_batches
              SET sourceFileName=?, sourceFileSize=?, sourceMimeType=?, sourceStorageKey=?, status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
            WHERE id=?`,
          [normalizedFileName, fileBuffer.length, verifiedFile.mimeType, sourceStorageKey, message.slice(0, 4000), batchId],
        )
        .catch(() => [{ affectedRows: 0 }, []] as unknown as [unknown, unknown]);
      if (!Number((failureMark as { affectedRows?: number }).affectedRows || 0)) preserveUploadedFile = false;
    }
    if (!preserveUploadedFile) {
      await (dependencies.deleteObject || storageDelete)(sourceStorageKey).catch((cleanupError) => {
        console.error("[AuctionImport] uploaded file cleanup failed", cleanupError);
      });
    }
    throw error;
  } finally {
    connection?.release();
  }
}

export type AuctionRepairDependencies = {
  pool?: Pool;
  ensureSchemaReady?: (pool: Pool) => Promise<void>;
  getObject?: typeof storageGet;
  fetchImpl?: typeof fetch;
};

export async function repairAuctionImportBatch(batchId: number, dependencies: AuctionRepairDependencies = {}) {
  const pool = dependencies.pool || getAuctionPool();
  await (dependencies.ensureSchemaReady || ensureAuctionSchemaReady)(pool);
  const [batchRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, sourceFileName, sourceFileSha256, sourceMimeType, sourceStorageKey, liverName, createdBy
       FROM auction_import_batches WHERE id=? AND status='success' LIMIT 1`,
    [batchId],
  );
  const batch = batchRows[0];
  if (!batch?.sourceStorageKey) throw new Error("可修复的原始Excel不存在 / 修復可能な元Excelがありません");
  const signed = await (dependencies.getObject || storageGet)(String(batch.sourceStorageKey));
  const response = await (dependencies.fetchImpl || fetch)(signed.url);
  if (!response.ok) throw new Error(`原始Excel下载失败 / 元Excelの取得に失敗しました (${response.status})`);
  const fileBuffer = Buffer.from(await response.arrayBuffer());
  const verifiedHash = createHash("sha256").update(fileBuffer).digest("hex");
  if (verifiedHash !== String(batch.sourceFileSha256)) throw new Error("原始Excel校验失败 / 元Excelの検証に失敗しました");
  validateAuctionImportFile(String(batch.sourceFileName), String(batch.sourceMimeType || "application/octet-stream"), fileBuffer);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!worksheet) throw new Error("文件中没有可读取的工作表 / 読み取れるシートがありません");
  const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });
  const parsed = parseAuctionExcelRows(rows, new Date().toISOString().slice(0, 10));
  const records: AuctionImportRecord[] = parsed.records.map(record => ({ ...record, roundsJson: JSON.stringify(normalizeAuctionRounds(record.roundsJson)) }));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, roundsJson FROM auction_records WHERE sourceFileSha256=? AND liverName=? FOR UPDATE",
      [batch.sourceFileSha256, batch.liverName],
    );
    if (!existingRows.length) throw new Error("未找到该批次的拍卖记录 / このバッチの拍卖記録がありません");
    const hasEditedSkuNames = existingRows.some(row => normalizeAuctionRounds(row.roundsJson).some(round => round.skuName));
    if (hasEditedSkuNames) throw new Error("该批次已包含SKU名称，为避免覆盖人工修改，未执行修复");
    await connection.query("DELETE FROM auction_records WHERE sourceFileSha256=? AND liverName=?", [batch.sourceFileSha256, batch.liverName]);
    for (const record of records) {
      await connection.query(
        `INSERT INTO auction_records
          (productId, productName, startPrice, finalPrice, totalGmv, totalOrders, auctionCount, liverName, auctionDate, note, roundsJson, createdBy, sourceFileName, sourceFileSha256, sourceRowCount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Excelインポート', ?, ?, ?, ?, ?)`,
        [record.productId, record.productName, record.startPrice, record.finalPrice, record.totalGmv, record.totalOrders, record.auctionCount,
          batch.liverName, record.auctionDate, record.roundsJson, batch.createdBy, batch.sourceFileName, batch.sourceFileSha256, parsed.sourceRowCount],
      );
    }
    await connection.query(
      `UPDATE auction_import_batches SET sourceRowCount=?, groupedRecordCount=?, importedRecordCount=?, skippedRowCount=?, completedAt=CURRENT_TIMESTAMP, errorMessage=NULL WHERE id=?`,
      [parsed.sourceRowCount, records.length, records.length, parsed.skippedRowCount, batchId],
    );
    await connection.commit();
    return { success: true as const, batchId, importedRecordCount: records.length, roundCount: parsed.roundCount, uniqueSkuCount: parsed.uniqueSkuCount };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function getAuctionImportFile(batchId: number) {
  const pool = getAuctionPool();
  await ensureAuctionSchemaReady(pool);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT sourceFileName, sourceStorageKey FROM auction_import_batches WHERE id=? LIMIT 1",
    [batchId],
  );
  const row = rows[0];
  if (!row || !row.sourceStorageKey) throw new Error("保存済み元Excelがありません");
  const signed = await storageGet(String(row.sourceStorageKey));
  return { fileName: String(row.sourceFileName), url: signed.url };
}

export async function getAuctionImportHistory(limit = 20) {
  const pool = getAuctionPool();
  await ensureAuctionSchemaReady(pool);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, sourceFileName, sourceFileSha256, sourceFileSize, sourceMimeType, sourceStorageKey, sourceRowCount, groupedRecordCount,
            importedRecordCount, skippedRowCount, liverName, status, errorMessage,
            createdBy, createdAt, completedAt
       FROM auction_import_batches
      ORDER BY id DESC
      LIMIT ?`,
    [Math.max(1, Math.min(100, limit))],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sourceFileName: String(row.sourceFileName),
    sourceFileSha256: String(row.sourceFileSha256),
    sourceFileSize: Number(row.sourceFileSize || 0),
    sourceMimeType: row.sourceMimeType == null ? null : String(row.sourceMimeType),
    originalFileSaved: Boolean(row.sourceStorageKey),
    sourceRowCount: Number(row.sourceRowCount || 0),
    groupedRecordCount: Number(row.groupedRecordCount || 0),
    importedRecordCount: Number(row.importedRecordCount || 0),
    skippedRowCount: Number(row.skippedRowCount || 0),
    liverName: String(row.liverName),
    status: String(row.status),
    errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }));
}
