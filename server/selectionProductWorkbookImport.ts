import { createHash, randomUUID } from "node:crypto";
import type mysql from "mysql2/promise";
import * as XLSX from "xlsx";
import { ensureSelectionProductPersistenceSchema } from "./selectionProductPersistence";
import { normalizeSelectionProductSkuVariants, type SelectionProductSkuVariant } from "../shared/selectionProductPersistence";

export const PRODUCT_SHEET_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_SHEET_MAX_ROWS = 2_000;
export const PRODUCT_SHEET_MAX_COMMIT_ROWS = 500;

export type ProductSheetExtension = "csv" | "xls" | "xlsx";

export class SelectionProductWorkbookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectionProductWorkbookError";
  }
}

type ProductSheetField =
  | "productName"
  | "productNameCn"
  | "productId"
  | "brandName"
  | "imageUrl"
  | "category"
  | "price"
  | "shippingFee"
  | "commission"
  | "productLink"
  | "kalodataLink"
  | "barcode"
  | "stock"
  | "skuName"
  | "skuCode"
  | "skuPrice"
  | "skuStock"
  | "sales"
  | "gmv"
  | "rating"
  | "dateRange";

type CategoryRow = { id: number; name: string | null; nameCn: string | null };
type ExistingProductRow = { id: number; productId: string | null; productName: string; brandName: string };

type FieldMap = Partial<Record<ProductSheetField, number>>;

export type ProductWorkbookCandidate = {
  rowKey: string;
  sourceRow: number;
  sourceRows: number[];
  productName: string;
  productNameCn: string | null;
  productId: string | null;
  brandName: string | null;
  imageUrl: string | null;
  sourceCategory: string | null;
  categoryId: number | null;
  categoryName: string | null;
  price: string | null;
  priceRaw: string | null;
  priceIsRange: boolean;
  shippingFee: string | null;
  commissionValue: string | null;
  productLink: string | null;
  kalodataLink: string | null;
  barcode: string | null;
  stock: number | null;
  skuVariants: SelectionProductSkuVariant[];
  sales: number | null;
  gmv: string | null;
  rating: string | null;
  dateRange: string | null;
  warnings: string[];
  invalidReasons: string[];
  existingProduct: { id: number; productName: string; match: "productId" | "nameBrand" } | null;
  possibleNameMatchCount: number;
};

export type ProductWorkbookParseResult = {
  fileSha256: string;
  sheetName: string;
  sourceRowCount: number;
  recognizedHeaders: Partial<Record<ProductSheetField, string>>;
  rows: ProductWorkbookCandidate[];
  warnings: string[];
  capabilities: {
    hasBrand: boolean;
    hasSku: boolean;
    hasBarcode: boolean;
    hasStock: boolean;
  };
};

const HEADER_ALIASES: Record<ProductSheetField, string[]> = {
  productName: ["商品名称", "商品名", "商品名稱", "製品名", "product name", "productname"],
  productNameCn: ["中文商品名", "商品中文名", "商品名中文"],
  productId: ["商品id", "商品编号", "商品編號", "product id", "productid", "tiktok商品id"],
  brandName: ["品牌", "品牌名", "品牌名称", "ブランド", "ブランド名", "brand", "brand name"],
  imageUrl: ["图片链接", "圖片連結", "图片url", "画像url", "画像リンク", "image url", "imageurl"],
  category: ["类目", "類目", "分类", "分類", "カテゴリ", "category"],
  price: ["价格円", "価格円", "价格", "価格", "商品价格", "商品価格", "price"],
  shippingFee: ["运费円", "運費円", "运费", "送料", "shipping fee", "shippingfee"],
  commission: ["佣金比例", "佣金率", "コミッション率", "手数料率", "commission rate", "commissionrate"],
  productLink: ["tiktok链接", "tiktok連結", "tiktokリンク", "tiktok url", "商品链接", "商品リンク", "product url", "producturl"],
  kalodataLink: ["kalodata详情页链接", "kalodata詳情頁連結", "kalodata詳細ページリンク", "kalodata url", "kalodataurl"],
  barcode: ["条码", "條碼", "バーコード", "janコード", "jan", "barcode"],
  stock: ["库存", "庫存", "在庫", "stock"],
  skuName: ["sku名称", "sku名稱", "sku名", "sku名称規格", "sku name", "skuname"],
  skuCode: ["sku编号", "sku編號", "skuコード", "sku code", "skucode"],
  skuPrice: ["sku价格", "sku価格", "sku price", "skuprice"],
  skuStock: ["sku库存", "sku庫存", "sku在庫", "sku stock", "skustock"],
  sales: ["销量", "銷量", "販売数", "sales", "units sold", "unitssold"],
  gmv: ["成交金额円", "成交金額円", "成交金额", "gmv", "売上", "売上高"],
  rating: ["商品评分", "商品評分", "商品評価", "rating"],
  dateRange: ["日期范围", "日期範圍", "期間", "date range", "daterange"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s_\-‐‑–—:：・/\\（）()\[\]【】]/g, "");
}

const HEADER_LOOKUP = new Map<string, ProductSheetField>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[ProductSheetField, string[]]>) {
  for (const alias of aliases) HEADER_LOOKUP.set(normalizeHeader(alias), field);
}

function normalizeIdentity(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ja-JP");
}

function stringCell(value: unknown, maxLength = 2_000): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function safeHttpUrl(value: unknown, maxLength = 2_000): string | null {
  const text = stringCell(value, maxLength);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString().slice(0, maxLength);
  } catch {
    return null;
  }
}

function parseFiniteNumber(value: unknown, minimum: number, maximum: number): number | null {
  const raw = stringCell(value, 100);
  if (!raw) return null;
  const normalized = raw.normalize("NFKC").replace(/[¥￥円,，\s]/g, "").replace(/%$/, "");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) return null;
  return parsed;
}

function decimalString(value: number | null): string | null {
  if (value === null) return null;
  return String(Math.round(value * 100) / 100);
}

function parsePrice(value: unknown): { value: string | null; raw: string | null; isRange: boolean } {
  const raw = stringCell(value, 120);
  if (!raw) return { value: null, raw: null, isRange: false };
  const normalized = raw.normalize("NFKC");
  const isRange = /\d\s*(?:-|~|〜|～|–|—)\s*\d/.test(normalized);
  if (isRange) return { value: null, raw, isRange: true };
  const parsed = parseFiniteNumber(normalized, 0.01, 999_999_999.99);
  return { value: decimalString(parsed), raw, isRange: false };
}

function parseInteger(value: unknown): number | null {
  const parsed = parseFiniteNumber(value, 0, Number.MAX_SAFE_INTEGER);
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}

function extractProductId(directValue: unknown, ...urls: Array<string | null>): string | null {
  const direct = stringCell(directValue, 100)?.normalize("NFKC").replace(/\.0$/, "") ?? null;
  if (direct && /^[A-Za-z0-9_-]{1,100}$/.test(direct)) return direct;
  for (const url of urls) {
    if (!url) continue;
    try {
      const parsed = new URL(url);
      const pathMatch = parsed.pathname.match(/\/product\/(\d{5,100})(?:\/|$)/i);
      if (pathMatch) return pathMatch[1];
      const queryId = parsed.searchParams.get("id");
      if (queryId && /^\d{5,100}$/.test(queryId)) return queryId;
    } catch {
      // URL validation happens separately; ignore malformed candidates here.
    }
  }
  return null;
}

function detectExtension(fileName: string): ProductSheetExtension {
  const extension = fileName.toLocaleLowerCase("en-US").split(".").pop();
  if (extension !== "csv" && extension !== "xls" && extension !== "xlsx") {
    throw new SelectionProductWorkbookError("仅支持CSV、XLSX或XLS文件 / CSV・XLSX・XLSのみ対応しています");
  }
  return extension;
}

export function decodeProductWorkbookBase64(base64Data: string): Buffer {
  if (!base64Data || base64Data.length > Math.ceil(PRODUCT_SHEET_MAX_BYTES * 4 / 3) + 16) {
    throw new SelectionProductWorkbookError("文件超过10MB或内容为空 / ファイルは10MB以下にしてください");
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    throw new SelectionProductWorkbookError("文件编码无效 / ファイルの形式が正しくありません");
  }
  const buffer = Buffer.from(base64Data, "base64");
  if (!buffer.length || buffer.length > PRODUCT_SHEET_MAX_BYTES) {
    throw new SelectionProductWorkbookError("文件超过10MB或内容为空 / ファイルは10MB以下にしてください");
  }
  return buffer;
}

function assertWorkbookSignature(buffer: Buffer, extension: ProductSheetExtension): void {
  if (extension === "xlsx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    throw new SelectionProductWorkbookError("文件内容不是有效的XLSX工作簿 / XLSXファイルではありません");
  }
  if (extension === "xls" && !buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
    throw new SelectionProductWorkbookError("文件内容不是有效的XLS工作簿 / XLSファイルではありません");
  }
  if (extension === "csv" && buffer.includes(0)) {
    throw new SelectionProductWorkbookError("CSV包含无效二进制内容 / CSVに無効なバイナリが含まれています");
  }
}

function rowField(row: unknown[], map: FieldMap, field: ProductSheetField): unknown {
  const index = map[field];
  return index === undefined ? undefined : row[index];
}

function findProductSheet(workbook: XLSX.WorkBook): { sheetName: string; headerRowIndex: number; fieldMap: FieldMap; headers: string[]; rows: unknown[][] } {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const limitedRange = {
      s: range.s,
      e: { r: Math.min(range.e.r, range.s.r + PRODUCT_SHEET_MAX_ROWS + 50), c: Math.min(range.e.c, range.s.c + 79) },
    };
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", range: limitedRange });
    const headerSearchLimit = Math.min(rows.length, 30);
    for (let index = 0; index < headerSearchLimit; index += 1) {
      const headerValues = rows[index] || [];
      const fieldMap: FieldMap = {};
      const headers = headerValues.map((value) => String(value ?? "").trim());
      headers.forEach((header, columnIndex) => {
        const field = HEADER_LOOKUP.get(normalizeHeader(header));
        if (field && fieldMap[field] === undefined) fieldMap[field] = columnIndex;
      });
      if (fieldMap.productName !== undefined) {
        return { sheetName, headerRowIndex: index, fieldMap, headers, rows };
      }
    }
  }
  throw new SelectionProductWorkbookError("没有找到包含商品名称的表格 / 商品名列を含むシートが見つかりません");
}

function matchCategory(sourceCategory: string | null, categories: CategoryRow[]): { id: number | null; name: string | null } {
  if (!sourceCategory) return { id: null, name: null };
  const segments = sourceCategory.split(/\s*(?:>|＞|\/|→)\s*/).map(normalizeIdentity).filter(Boolean);
  const candidates = new Set(segments.length ? segments : [normalizeIdentity(sourceCategory)]);
  const matches = categories.filter((category) => {
    const names = [category.name, category.nameCn].filter((value): value is string => !!value).map(normalizeIdentity);
    return names.some((name) => candidates.has(name));
  });
  if (matches.length !== 1) return { id: null, name: null };
  return { id: Number(matches[0].id), name: matches[0].nameCn || matches[0].name };
}

function buildSkuVariant(row: unknown[], map: FieldMap): SelectionProductSkuVariant | null {
  const name = stringCell(rowField(row, map, "skuName"), 200);
  const code = stringCell(rowField(row, map, "skuCode"), 100);
  if (!name && !code) return null;
  const price = parsePrice(rowField(row, map, "skuPrice"));
  const stock = parseInteger(rowField(row, map, "skuStock"));
  const variant: SelectionProductSkuVariant = { name: name || code || "" };
  if (code) variant.skuCode = code;
  if (price.value) variant.price = price.value;
  if (stock !== null) variant.stock = stock;
  variant.status = "draft";
  return variant;
}

function parseRows(
  found: ReturnType<typeof findProductSheet>,
  categories: CategoryRow[],
): { rows: ProductWorkbookCandidate[]; sourceRowCount: number } {
  const { rows: allRows, headerRowIndex, fieldMap } = found;
  const candidates = new Map<string, ProductWorkbookCandidate>();
  let sourceRowCount = 0;
  const dataRows = allRows.slice(headerRowIndex + 1);
  for (let dataIndex = 0; dataIndex < dataRows.length; dataIndex += 1) {
    const row = dataRows[dataIndex] || [];
    if (!row.some((value) => stringCell(value, 1))) continue;
    sourceRowCount += 1;
    if (sourceRowCount > PRODUCT_SHEET_MAX_ROWS) {
      throw new SelectionProductWorkbookError(`文件最多支持${PRODUCT_SHEET_MAX_ROWS}条商品数据 / 最大${PRODUCT_SHEET_MAX_ROWS}行です`);
    }
    const sourceRow = headerRowIndex + dataIndex + 2;
    const productName = stringCell(rowField(row, fieldMap, "productName"), 1_000) || "";
    const productNameCn = stringCell(rowField(row, fieldMap, "productNameCn"), 255);
    const productLink = safeHttpUrl(rowField(row, fieldMap, "productLink"), 500);
    const kalodataLink = safeHttpUrl(rowField(row, fieldMap, "kalodataLink"), 2_000);
    const productId = extractProductId(rowField(row, fieldMap, "productId"), productLink, kalodataLink);
    const rowKey = productId ? `id:${productId}` : `row:${sourceRow}`;
    const sourceCategory = stringCell(rowField(row, fieldMap, "category"), 500);
    const category = matchCategory(sourceCategory, categories);
    const price = parsePrice(rowField(row, fieldMap, "price"));
    const shippingFee = decimalString(parseFiniteNumber(rowField(row, fieldMap, "shippingFee"), 0, 999_999_999.99));
    const commission = decimalString(parseFiniteNumber(rowField(row, fieldMap, "commission"), 0, 100));
    const imageUrl = safeHttpUrl(rowField(row, fieldMap, "imageUrl"), 2_000);
    const barcode = stringCell(rowField(row, fieldMap, "barcode"), 100);
    const stock = parseInteger(rowField(row, fieldMap, "stock"));
    const skuVariant = buildSkuVariant(row, fieldMap);
    const warnings: string[] = [];
    const invalidReasons: string[] = [];
    if (!productName) invalidReasons.push("商品名为空 / 商品名がありません");
    if (productName.length > 255) invalidReasons.push("商品名超过255字 / 商品名が255文字を超えています");
    if (price.isRange) warnings.push("价格为区间，未写入商品价格 / 価格帯のため商品価格は空欄");
    else if (price.raw && !price.value) warnings.push("价格格式无法确认，保持空白 / 価格を確認できないため空欄");
    if (rowField(row, fieldMap, "imageUrl") && !imageUrl) warnings.push("图片链接无效，未导入 / 画像URLが無効です");
    if (sourceCategory && !category.id) warnings.push("类目未与现有分类唯一匹配 / 既存カテゴリに一意一致しません");
    const brandName = stringCell(rowField(row, fieldMap, "brandName"), 255);
    if (!brandName) warnings.push("源文件没有品牌，请在预览中指定 / ブランドを指定してください");

    const existing = candidates.get(rowKey);
    if (existing) {
      existing.sourceRows.push(sourceRow);
      if (skuVariant) {
        const identity = normalizeIdentity(skuVariant.skuCode || skuVariant.name);
        const duplicateSku = existing.skuVariants.some((variant) => normalizeIdentity(variant.skuCode || variant.name) === identity);
        if (!duplicateSku) existing.skuVariants.push(skuVariant);
      }
      if (!existing.warnings.includes("同一商品在源文件中出现多行，已合并 / 同一商品の複数行を統合")) {
        existing.warnings.push("同一商品在源文件中出现多行，已合并 / 同一商品の複数行を統合");
      }
      continue;
    }

    candidates.set(rowKey, {
      rowKey,
      sourceRow,
      sourceRows: [sourceRow],
      productName,
      productNameCn,
      productId,
      brandName,
      imageUrl,
      sourceCategory,
      categoryId: category.id,
      categoryName: category.name,
      price: price.value,
      priceRaw: price.raw,
      priceIsRange: price.isRange,
      shippingFee,
      commissionValue: commission,
      productLink,
      kalodataLink,
      barcode,
      stock,
      skuVariants: skuVariant ? [skuVariant] : [],
      sales: parseInteger(rowField(row, fieldMap, "sales")),
      gmv: decimalString(parseFiniteNumber(rowField(row, fieldMap, "gmv"), 0, 999_999_999_999.99)),
      rating: decimalString(parseFiniteNumber(rowField(row, fieldMap, "rating"), 0, 5)),
      dateRange: stringCell(rowField(row, fieldMap, "dateRange"), 100),
      warnings,
      invalidReasons,
      existingProduct: null,
      possibleNameMatchCount: 0,
    });
  }
  if (!sourceRowCount) {
    throw new SelectionProductWorkbookError("没有识别到商品数据 / 商品データを認識できませんでした");
  }
  return { rows: Array.from(candidates.values()), sourceRowCount };
}

function recognizedHeaderNames(found: ReturnType<typeof findProductSheet>): Partial<Record<ProductSheetField, string>> {
  const result: Partial<Record<ProductSheetField, string>> = {};
  for (const [field, index] of Object.entries(found.fieldMap) as Array<[ProductSheetField, number]>) {
    result[field] = found.headers[index] || field;
  }
  return result;
}

export function selectionProductWorkbookSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function parseSelectionProductWorkbook(
  buffer: Buffer,
  fileName: string,
  categories: CategoryRow[] = [],
): ProductWorkbookParseResult {
  const extension = detectExtension(fileName);
  assertWorkbookSignature(buffer, extension);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, dense: true });
  } catch {
    throw new SelectionProductWorkbookError("无法解析表格，请确认文件未损坏 / ファイルが破損していないか確認してください");
  }
  if (!workbook.SheetNames.length) throw new SelectionProductWorkbookError("工作簿没有可读工作表 / 読み取り可能なシートがありません");
  const found = findProductSheet(workbook);
  const parsed = parseRows(found, categories);
  const capabilities = {
    hasBrand: found.fieldMap.brandName !== undefined,
    hasSku: found.fieldMap.skuName !== undefined || found.fieldMap.skuCode !== undefined,
    hasBarcode: found.fieldMap.barcode !== undefined,
    hasStock: found.fieldMap.stock !== undefined || found.fieldMap.skuStock !== undefined,
  };
  const warnings: string[] = [];
  if (!capabilities.hasBrand) warnings.push("源文件没有品牌列：请在预览中指定品牌，不会从商品名猜测");
  if (!capabilities.hasSku) warnings.push("源文件没有SKU列：不会自动生成SKU");
  if (!capabilities.hasBarcode) warnings.push("源文件没有条码列：条码保持空白");
  if (!capabilities.hasStock) warnings.push("源文件没有库存列：新商品以草稿、库存0保存，确认库存后再上架");
  const rangeCount = parsed.rows.filter((row) => row.priceIsRange).length;
  if (rangeCount > 0) warnings.push(`${rangeCount}件商品为价格区间：不会选择最低价或最高价，价格保持空白`);
  if (found.fieldMap.sales !== undefined || found.fieldMap.gmv !== undefined || found.fieldMap.rating !== undefined) {
    warnings.push("销量、成交金额和评分仅供预览参考，不会冒充商品主档或库存数据");
  }
  return {
    fileSha256: selectionProductWorkbookSha256(buffer),
    sheetName: found.sheetName,
    sourceRowCount: parsed.sourceRowCount,
    recognizedHeaders: recognizedHeaderNames(found),
    rows: parsed.rows,
    warnings,
    capabilities,
  };
}

function applyExistingProductMatches(rows: ProductWorkbookCandidate[], existingProducts: ExistingProductRow[]): void {
  const byId = new Map<string, ExistingProductRow>();
  const byName = new Map<string, ExistingProductRow[]>();
  for (const product of existingProducts) {
    if (product.productId) byId.set(String(product.productId).trim(), product);
    const nameKey = normalizeIdentity(product.productName);
    const list = byName.get(nameKey) || [];
    list.push(product);
    byName.set(nameKey, list);
  }
  for (const row of rows) {
    const idMatch = row.productId ? byId.get(row.productId) : undefined;
    if (idMatch) {
      row.existingProduct = { id: Number(idMatch.id), productName: idMatch.productName, match: "productId" };
      continue;
    }
    const nameMatches = byName.get(normalizeIdentity(row.productName)) || [];
    row.possibleNameMatchCount = nameMatches.length;
    if (row.brandName) {
      const exact = nameMatches.find((product) => normalizeIdentity(product.brandName) === normalizeIdentity(row.brandName || ""));
      if (exact) row.existingProduct = { id: Number(exact.id), productName: exact.productName, match: "nameBrand" };
    }
  }
}

export async function previewSelectionProductWorkbook(
  pool: mysql.Pool,
  buffer: Buffer,
  fileName: string,
): Promise<ProductWorkbookParseResult> {
  const [categoryRows] = await pool.query("SELECT id, name, nameCn FROM selection_categories") as [CategoryRow[], unknown];
  const result = parseSelectionProductWorkbook(buffer, fileName, categoryRows);
  const [existingRows] = await pool.query(
    "SELECT id, productId, productName, brandName FROM selection_products WHERE deletedAt IS NULL",
  ) as [ExistingProductRow[], unknown];
  applyExistingProductMatches(result.rows, existingRows);
  return result;
}

export type ProductWorkbookSelection = { rowKey: string; brandName: string };

export async function importSelectionProductWorkbook(
  pool: mysql.Pool,
  buffer: Buffer,
  fileName: string,
  selections: ProductWorkbookSelection[],
  createdBy: number,
): Promise<{ insertedCount: number; skippedDuplicates: Array<{ rowKey: string; productName: string }>; insertedIds: number[] }> {
  if (!Number.isInteger(createdBy) || createdBy <= 0) throw new SelectionProductWorkbookError("登录用户无效 / ログインユーザーが無効です");
  if (!selections.length || selections.length > PRODUCT_SHEET_MAX_COMMIT_ROWS) {
    throw new SelectionProductWorkbookError(`一次可导入1至${PRODUCT_SHEET_MAX_COMMIT_ROWS}件商品 / 1回${PRODUCT_SHEET_MAX_COMMIT_ROWS}件までです`);
  }
  const uniqueSelections = new Map<string, string>();
  for (const selection of selections) {
    const rowKey = String(selection.rowKey || "").trim();
    const brandName = String(selection.brandName || "").trim();
    if (!rowKey || rowKey.length > 140) throw new SelectionProductWorkbookError("选择行无效 / 選択行が無効です");
    if (!brandName || brandName.length > 255) throw new SelectionProductWorkbookError("请为所有选中商品指定品牌 / 選択商品のブランドを指定してください");
    if (uniqueSelections.has(rowKey)) throw new SelectionProductWorkbookError("选择行重复 / 選択行が重複しています");
    uniqueSelections.set(rowKey, brandName);
  }

  await ensureSelectionProductPersistenceSchema(pool);
  const [categoryRows] = await pool.query("SELECT id, name, nameCn FROM selection_categories") as [CategoryRow[], unknown];
  const parsed = parseSelectionProductWorkbook(buffer, fileName, categoryRows);
  const candidates = new Map(parsed.rows.map((row) => [row.rowKey, row]));
  for (const rowKey of uniqueSelections.keys()) {
    const row = candidates.get(rowKey);
    if (!row || row.invalidReasons.length > 0) throw new SelectionProductWorkbookError("选择内容与原文件不一致 / 選択内容が元ファイルと一致しません");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      "SELECT id, productId, productName, brandName FROM selection_products WHERE deletedAt IS NULL FOR UPDATE",
    ) as [ExistingProductRow[], unknown];
    const existingById = new Map(existingRows.filter((row) => row.productId).map((row) => [String(row.productId).trim(), row]));
    const existingByNameBrand = new Set(existingRows.map((row) => `${normalizeIdentity(row.productName)}\u0000${normalizeIdentity(row.brandName)}`));
    const skippedDuplicates: Array<{ rowKey: string; productName: string }> = [];
    const insertedIds: number[] = [];

    for (const [rowKey, brandName] of uniqueSelections) {
      const row = candidates.get(rowKey)!;
      const duplicateById = row.productId ? existingById.get(row.productId) : undefined;
      const nameBrandKey = `${normalizeIdentity(row.productName)}\u0000${normalizeIdentity(brandName)}`;
      if (duplicateById || existingByNameBrand.has(nameBrandKey)) {
        skippedDuplicates.push({ rowKey, productName: row.productName });
        continue;
      }
      const skuVariants = normalizeSelectionProductSkuVariants(row.skuVariants.map((variant) => ({ ...variant, variantId: randomUUID() })));
      const primarySku = skuVariants[0];
      const [insertResult] = await connection.query(
        `INSERT INTO selection_products (
          productName, productNameCn, productId, barcode, brandName, categoryId,
          price, commissionType, commissionValue, images, productLink, stock,
          tags, selfOperated, talentExclusive, shippingFee, skuVariants, skuName,
          skuPrice, status, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'percentage', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'draft', ?)`,
        [
          row.productName,
          row.productNameCn,
          row.productId,
          row.barcode,
          brandName,
          row.categoryId,
          row.price,
          row.commissionValue,
          JSON.stringify(row.imageUrl ? [row.imageUrl] : []),
          row.productLink,
          row.stock ?? 0,
          JSON.stringify([]),
          row.shippingFee,
          JSON.stringify(skuVariants),
          primarySku?.name ?? null,
          primarySku?.price ?? null,
          createdBy,
        ],
      ) as [mysql.ResultSetHeader, unknown];
      const insertedId = Number(insertResult.insertId);
      if (insertResult.affectedRows !== 1 || !Number.isInteger(insertedId) || insertedId <= 0) {
        throw new Error("商品导入失败：数据库未返回有效ID / 商品取込に失敗しました");
      }
      insertedIds.push(insertedId);
      if (row.productId) existingById.set(row.productId, { id: insertedId, productId: row.productId, productName: row.productName, brandName });
      existingByNameBrand.add(nameBrandKey);
    }
    await connection.commit();
    return { insertedCount: insertedIds.length, skippedDuplicates, insertedIds };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[selectionProductWorkbookImport] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}
