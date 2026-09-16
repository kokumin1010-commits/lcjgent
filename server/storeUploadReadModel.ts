import * as XLSX from "xlsx";
import { normalizeStoreShopStatsMatrix, hasRecognizedStoreGmv } from "../shared/storeShopStatsImport";
import { storageGet } from "./storage";

export type StoreUploadReadSource = {
  id: number;
  dataType: string;
  dataJson?: string | unknown[] | null;
  originalFileKey?: string | null;
  fileName?: string | null;
  fileSha256?: string | null;
};

export type ResolvedStoreUploadData = {
  data: Record<string, unknown>[];
  source: "stored_json" | "original_file_read_only";
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 30_000_000;
const cache = new Map<string, { expiresAt: number; data: Record<string, unknown>[] }>();

function parseStoredRows(value: StoreUploadReadSource["dataJson"]): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      : [];
  } catch {
    return [];
  }
}

export function parseStoreShopStatsWorkbook(fileBuffer: Buffer): Record<string, unknown>[] | null {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  let best: ReturnType<typeof normalizeStoreShopStatsMatrix> = null;
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: true });
    const parsed = normalizeStoreShopStatsMatrix(matrix);
    if (!parsed) continue;
    if (!best || parsed.businessDates.length > best.businessDates.length) best = parsed;
  }
  return best?.data || null;
}

async function readOriginalRows(upload: StoreUploadReadSource): Promise<Record<string, unknown>[] | null> {
  if (!upload.originalFileKey) return null;
  const cacheKey = `${Number(upload.id)}:${String(upload.fileSha256 || upload.originalFileKey)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  try {
    const signed = await storageGet(String(upload.originalFileKey));
    const response = await fetch(signed.url);
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES) return null;
    const fileBuffer = Buffer.from(await response.arrayBuffer());
    if (!fileBuffer.length || fileBuffer.length > MAX_FILE_BYTES) return null;
    const rows = parseStoreShopStatsWorkbook(fileBuffer);
    if (!rows || !hasRecognizedStoreGmv(rows)) return null;
    if (cache.size >= 50) cache.delete(cache.keys().next().value as string);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: rows });
    return rows;
  } catch {
    return null;
  }
}

export async function resolveStoreUploadData(upload: StoreUploadReadSource): Promise<ResolvedStoreUploadData> {
  const storedRows = parseStoredRows(upload.dataJson);
  if (upload.dataType !== "shop_stats" || hasRecognizedStoreGmv(storedRows)) {
    return { data: storedRows, source: "stored_json" };
  }
  const originalRows = await readOriginalRows(upload);
  return originalRows
    ? { data: originalRows, source: "original_file_read_only" }
    : { data: storedRows, source: "stored_json" };
}

export function clearStoreUploadReadCacheForTests() {
  cache.clear();
}
