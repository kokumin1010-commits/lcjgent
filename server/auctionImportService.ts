import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ensureAuctionSchemaReady, getAuctionPool } from "./auctionSchemaUpgrade";
import { storageGet, storagePut } from "./storage";

export type AuctionImportRecord = {
  productId: string;
  productName: string;
  startPrice: number | null;
  finalPrice: number | null;
  totalGmv: number | null;
  totalOrders: number | null;
  auctionCount: number;
  auctionDate: string;
  roundsJson: string;
};

export type AuctionImportBatchInput = {
  sourceFileName: string;
  sourceFileSha256: string;
  sourceFileBase64: string;
  sourceFileSize: number;
  sourceMimeType: string;
  sourceRowCount: number;
  skippedRowCount: number;
  liverName: string;
  records: AuctionImportRecord[];
  createdBy: number | null;
};

function normalizeFileName(fileName: string): string {
  return fileName.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 500) || "auction-import.xlsx";
}

function safeStorageName(fileName: string): string {
  return normalizeFileName(fileName).replace(/[^A-Za-z0-9._-]+/g, "_").slice(-180) || "auction-import.xlsx";
}

function validateRoundsJson(value: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("roundsJson must be valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("roundsJson must be an array");
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

export async function importAuctionBatch(input: AuctionImportBatchInput) {
  const pool = getAuctionPool();
  await ensureAuctionSchemaReady(pool);
  const normalizedFileName = normalizeFileName(input.sourceFileName);
  const normalizedLiverName = input.liverName.trim();
  if (!normalizedLiverName) throw new Error("主播名は必須です");
  if (input.records.length === 0) throw new Error("導入可能な拍卖記録がありません");
  input.records.forEach((record) => validateRoundsJson(record.roundsJson));
  const fileBuffer = Buffer.from(input.sourceFileBase64, "base64");
  if (fileBuffer.length === 0 || fileBuffer.length > 30_000_000) throw new Error("元Excelは30MB以下である必要があります");
  if (fileBuffer.length !== input.sourceFileSize) throw new Error("元Excelのサイズが一致しません");
  const verifiedHash = createHash("sha256").update(fileBuffer).digest("hex");
  if (verifiedHash !== input.sourceFileSha256) throw new Error("元ExcelのSHA-256が一致しません");
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
  await storagePut(sourceStorageKey, fileBuffer, input.sourceMimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  const connection = await pool.getConnection();
  let batchId: number | null = null;
  try {
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
        [normalizedFileName, fileBuffer.length, input.sourceMimeType, sourceStorageKey, input.sourceRowCount, input.records.length, input.skippedRowCount, input.createdBy, batchId],
      );
    } else {
      const [insertBatch] = await connection.query(
        `INSERT INTO auction_import_batches
          (sourceFileName, sourceFileSha256, sourceFileSize, sourceMimeType, sourceStorageKey, sourceRowCount, groupedRecordCount, importedRecordCount, skippedRowCount, liverName, status, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'running', ?)`,
        [normalizedFileName, verifiedHash, fileBuffer.length, input.sourceMimeType, sourceStorageKey, input.sourceRowCount, input.records.length, input.skippedRowCount, normalizedLiverName, input.createdBy],
      );
      batchId = Number((insertBatch as { insertId: number }).insertId);
    }

    let importedRecordCount = 0;
    for (const record of input.records) {
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
          input.sourceRowCount,
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
      sourceRowCount: input.sourceRowCount,
      groupedRecordCount: input.records.length,
      importedRecordCount,
      skippedRowCount: input.skippedRowCount,
      originalFileSaved: true,
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    if (batchId !== null) {
      await pool
        .query(
          `UPDATE auction_import_batches
              SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
            WHERE id=?`,
          [message.slice(0, 4000), batchId],
        )
        .catch(() => undefined);
    }
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
