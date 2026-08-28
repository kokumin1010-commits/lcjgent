import {
  inferAuctionPromotionType,
  normalizeAuctionPromotionType,
} from "./auctionRecordPersistence";

export type AuctionRoundImport = {
  roundNumber: number;
  startPrice: number;
  salePrice: number;
  bidderCount: number;
  winner: string;
  skuName: string;
  skuId: string;
  promotionType: string;
  startTime: string;
  duration: number;
};

export type AuctionRecordImport = {
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

export type ParsedAuctionImport = {
  sourceRowCount: number;
  skippedRowCount: number;
  records: AuctionRecordImport[];
  headerRowNumber: number;
  compatibilityMode: "header" | "standard-position";
  recognizedHeaders: string[];
  roundCount: number;
  uniqueSkuCount: number;
  roundsWithoutSkuCount: number;
};

const HEADER_ALIASES = {
  productId: ["商品ID", "商品 ID", "Product ID", "product_id", "Item ID", "item_id", "主商品ID", "商品编号", "商品編號"],
  productName: ["商品名", "商品名称", "商品名稱", "Product Name", "Item Name", "产品名称", "產品名稱"],
  stock: ["在庫", "库存", "庫存", "Inventory", "Stock"],
  salesCount: ["商品の販売数", "商品販売数", "成交件数", "成交数量", "成交數量", "Sales", "Orders", "販売数", "订单数", "訂單數"],
  gmv: ["GMV", "商品GMV", "成交金额", "成交金額", "Sales Amount"],
  skuName: ["商品", "商品sku", "商品SKU", "SKU商品", "SKU名", "SKU Name", "SKU名称", "SKU名稱", "SKU规格", "SKU規格", "规格", "規格", "Variation", "Variant"],
  pid: ["PID", "商品PID", "Product PID"],
  skuId: ["SKU ID", "SKUID", "sku_id", "SKU编号", "SKU編號", "Variation ID", "Variant ID"],
  roundNumber: ["发品编号", "發品編號", "発品番号", "拍卖轮次", "拍卖輪次", "Round", "Round Number"],
  promotionType: ["促销", "促销方式", "促銷", "组合", "組合", "套组", "セット", "Promotion", "Bundle"],
  startPrice: ["入札開始価格", "起拍价", "起拍價", "Start Price", "Starting Price"],
  salePrice: ["販売価格", "销售价", "銷售價", "成交价", "成交價", "Sale Price", "Sold Price", "Final Price"],
  winner: ["当選者", "获胜者", "獲勝者", "Winner", "落札者"],
  bidderCount: ["入札者", "竞拍人数", "競拍人數", "Bidders", "Bidder Count", "入札人数"],
  startTime: ["開始時間", "开始时间", "開始時間", "Start Time", "Auction Time", "拍卖时间", "拍卖時間"],
  duration: ["時間", "时长", "時長", "Duration", "Duration(s)", "Seconds"],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;
type HeaderMap = Record<HeaderKey, number>;

const STANDARD_POSITION_MAP: HeaderMap = {
  productId: 0,
  productName: 1,
  stock: 2,
  salesCount: 3,
  gmv: 4,
  skuName: 5,
  pid: 6,
  skuId: 7,
  roundNumber: -1,
  promotionType: -1,
  startPrice: 8,
  salePrice: 9,
  winner: 10,
  bidderCount: 11,
  startTime: 12,
  duration: 13,
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/^\uFEFF/, "")
    .replace(/[\s_\-:：/\\()[\]{}【】]/g, "")
    .toLowerCase();
}

function normalizeProductIdentity(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
}

function headerMap(headerRow: unknown[]): HeaderMap {
  const normalized = headerRow.map(normalizeHeader);
  const result = {} as HeaderMap;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[HeaderKey, readonly string[]]>) {
    result[key] = normalized.findIndex((header) => aliases.some((alias) => header === normalizeHeader(alias)));
  }
  if (result.skuName < 0) {
    const duplicateProductNameColumns = normalized
      .map((header, index) => header === normalizeHeader("商品名称") ? index : -1)
      .filter(index => index >= 0);
    if (duplicateProductNameColumns.length >= 2) result.skuName = duplicateProductNameColumns[1]!;
  }
  return result;
}

function headerScore(map: HeaderMap): number {
  return Object.values(map).filter((index) => index >= 0).length;
}

function hasCoreHeaders(map: HeaderMap): boolean {
  return (map.productId >= 0 || map.pid >= 0) && map.salePrice >= 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const cleaned = text(value).replace(/[,，￥¥%\s]/g, "").replace(/[^0-9.+-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function looksLikeId(value: unknown): boolean {
  return /^\d{8,}$/.test(text(value).replace(/\.0+$/, ""));
}

function looksLikeStandardDataRow(row: unknown[]): boolean {
  const salePrice = text(row[9]).normalize("NFKC");
  return row.length >= 14
    && (looksLikeId(row[0]) || looksLikeId(row[6]))
    && /\d/.test(salePrice)
    && Number.isFinite(numberValue(salePrice));
}

function findHeaders(rows: unknown[][]): { map: HeaderMap; rowIndex: number; mode: "header" | "standard-position"; recognizedHeaders: string[] } {
  let best: { map: HeaderMap; rowIndex: number; score: number } | null = null;
  const limit = Math.min(rows.length, 30);
  for (let index = 0; index < limit; index += 1) {
    const map = headerMap(rows[index] || []);
    const score = headerScore(map);
    if (!best || score > best.score) best = { map, rowIndex: index, score };
  }
  if (best && best.score >= 2 && hasCoreHeaders(best.map)) {
    return {
      map: best.map,
      rowIndex: best.rowIndex,
      mode: "header",
      recognizedHeaders: Object.entries(best.map).filter(([, index]) => index >= 0).map(([key]) => key),
    };
  }
  for (let index = 0; index < Math.min(rows.length, 31); index += 1) {
    if (!looksLikeStandardDataRow(rows[index] || [])) continue;
    const presumedHeaderIndex = Math.max(0, index - 1);
    return {
      map: { ...STANDARD_POSITION_MAP },
      rowIndex: presumedHeaderIndex,
      mode: "standard-position",
      recognizedHeaders: Object.keys(STANDARD_POSITION_MAP).filter((key) => STANDARD_POSITION_MAP[key as HeaderKey] >= 0),
    };
  }
  const detected = (best ? rows[best.rowIndex] : rows[0] || [])
    .map(text)
    .filter(Boolean)
    .slice(0, 12)
    .join(" / ");
  throw new Error(`拍卖Excel的核心列无法识别：需要商品ID或PID，以及销售价/成交价。检测到：${detected || "空白"} / 拍卖Excelの必須列を確認できません`);
}

function valueAt(row: unknown[], index: number): unknown {
  return index >= 0 ? row[index] : "";
}

function idValue(value: unknown, label: string, rowNumber: number): string {
  const raw = text(value).replace(/\.0+$/, "");
  if (!raw || raw === "-") return "";
  if (/e[+-]?\d+/i.test(raw) || !/^\d+$/.test(raw)) {
    throw new Error(`${rowNumber}行目の${label}を文字列として読み取れません: ${raw}`);
  }
  return raw;
}

function datePart(value: unknown, fallbackDate: string): string {
  const raw = text(value);
  const match = raw.match(/^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})/);
  if (!match) return fallbackDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    throw new Error(`拍卖日期无效 / 拍卖日が正しくありません: ${raw}`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseAuctionExcelRows(rows: unknown[][], fallbackDate: string): ParsedAuctionImport {
  if (rows.length < 2) throw new Error("Excelにデータ行がありません");
  if (rows.length > 100_031) throw new Error("Excel数据行不能超过100000 / Excelのデータ行は100000件以内です");
  const detected = findHeaders(rows);
  const headers = detected.map;
  const groups = new Map<string, { productId: string; name: string; salesCount: number; gmv: number; rounds: AuctionRoundImport[] }>();
  let skippedRowCount = 0;
  let sourceRowCount = 0;

  for (let index = detected.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (!row.some((value) => text(value))) continue;
    sourceRowCount += 1;
    const rowNumber = index + 1;
    const productId = idValue(valueAt(row, headers.productId), "商品ID", rowNumber)
      || idValue(valueAt(row, headers.pid), "PID", rowNumber);
    if (!productId) {
      skippedRowCount += 1;
      continue;
    }
    const productName = text(valueAt(row, headers.productName));
    const productKey = productName ? `name:${normalizeProductIdentity(productName)}` : `id:${productId}`;
    if (!groups.has(productKey)) {
      groups.set(productKey, {
        productId,
        name: productName,
        salesCount: Math.max(0, Math.trunc(numberValue(valueAt(row, headers.salesCount)))),
        gmv: Math.max(0, numberValue(valueAt(row, headers.gmv))),
        rounds: [],
      });
    }
    const group = groups.get(productKey)!;
    const skuName = text(valueAt(row, headers.skuName));
    const skuId = idValue(valueAt(row, headers.skuId), "SKU ID", rowNumber);
    const salePrice = numberValue(valueAt(row, headers.salePrice));
    if (salePrice <= 0 && (!skuName || skuName === "-") && !skuId) {
      skippedRowCount += 1;
      continue;
    }
    if (!group.name && productName) group.name = productName;
    group.salesCount = Math.max(group.salesCount, Math.max(0, Math.trunc(numberValue(valueAt(row, headers.salesCount)))));
    group.gmv = Math.max(group.gmv, Math.max(0, numberValue(valueAt(row, headers.gmv))));
    const explicitPromotion = text(valueAt(row, headers.promotionType));
    const promotionType = normalizeAuctionPromotionType(explicitPromotion || inferAuctionPromotionType(skuName), `第${rowNumber}行组合`) || "";
    const importedRoundNumber = Math.trunc(numberValue(valueAt(row, headers.roundNumber)));
    group.rounds.push({
      roundNumber: importedRoundNumber > 0 ? importedRoundNumber : group.rounds.length + 1,
      startPrice: Math.max(0, numberValue(valueAt(row, headers.startPrice))),
      salePrice: Math.max(0, salePrice),
      bidderCount: Math.max(0, Math.trunc(numberValue(valueAt(row, headers.bidderCount)))),
      winner: text(valueAt(row, headers.winner)),
      skuName,
      skuId,
      promotionType,
      startTime: text(valueAt(row, headers.startTime)),
      duration: Math.max(0, numberValue(valueAt(row, headers.duration))),
    });
  }

  const records: AuctionRecordImport[] = [];
  const uniqueSkus = new Set<string>();
  let roundCount = 0;
  let roundsWithoutSkuCount = 0;
  for (const [productKey, group] of groups) {
    for (const round of group.rounds) {
      roundCount += 1;
      const key = round.skuId || round.skuName.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
      if (key) uniqueSkus.add(`${productKey}:${key}`);
      else roundsWithoutSkuCount += 1;
    }
    const positivePrices = group.rounds.map((round) => round.salePrice).filter((price) => price > 0);
    const averagePrice = positivePrices.length
      ? positivePrices.reduce((sum, price) => sum + price, 0) / positivePrices.length
      : 0;
    records.push({
      productId: group.productId,
      productName: group.name,
      startPrice: group.rounds[0]?.startPrice ?? null,
      finalPrice: positivePrices.length && Number.isFinite(averagePrice) ? Math.round(averagePrice) : null,
      totalGmv: group.gmv,
      totalOrders: group.salesCount,
      auctionCount: group.rounds.length,
      auctionDate: datePart(group.rounds[0]?.startTime, fallbackDate),
      roundsJson: JSON.stringify(group.rounds),
    });
  }
  if (!records.length) throw new Error("販売済み拍卖記録を確認できませんでした");
  if (records.length > 5000) throw new Error("拍卖商品不能超过5000 / 拍卖商品は5000件以内です");
  return {
    sourceRowCount,
    skippedRowCount,
    records,
    headerRowNumber: detected.rowIndex + 1,
    compatibilityMode: detected.mode,
    recognizedHeaders: detected.recognizedHeaders,
    roundCount,
    uniqueSkuCount: uniqueSkus.size,
    roundsWithoutSkuCount,
  };
}
