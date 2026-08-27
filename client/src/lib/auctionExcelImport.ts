export type AuctionRoundImport = {
  roundNumber: number;
  startPrice: number;
  salePrice: number;
  bidderCount: number;
  winner: string;
  skuName: string;
  skuId: string;
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
};

const HEADER_ALIASES = {
  productId: ["商品ID", "商品 ID", "Product ID", "product_id"],
  productName: ["商品名", "商品名称", "Product Name"],
  stock: ["在庫", "库存", "Inventory"],
  salesCount: ["商品の販売数", "商品販売数", "成交件数", "Sales"],
  gmv: ["GMV", "商品GMV"],
  skuName: ["商品", "SKU商品", "SKU名", "SKU Name"],
  pid: ["PID"],
  skuId: ["SKU ID", "SKUID", "sku_id"],
  startPrice: ["入札開始価格", "起拍价", "Start Price"],
  salePrice: ["販売価格", "销售价", "Sale Price"],
  winner: ["当選者", "获胜者", "Winner"],
  bidderCount: ["入札者", "竞拍人数", "Bidders"],
  startTime: ["開始時間", "开始时间", "Start Time"],
  duration: ["時間", "时长", "Duration"],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function normalizeHeader(value: unknown): string {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function buildHeaderMap(headerRow: unknown[]): Record<HeaderKey, number> {
  const normalized = headerRow.map(normalizeHeader);
  const result = {} as Record<HeaderKey, number>;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[HeaderKey, readonly string[]]>) {
    result[key] = normalized.findIndex((header) => aliases.some((alias) => header === normalizeHeader(alias)));
  }
  const required: HeaderKey[] = [
    "productId",
    "productName",
    "salesCount",
    "gmv",
    "skuName",
    "startPrice",
    "salePrice",
    "winner",
    "bidderCount",
    "startTime",
    "duration",
  ];
  const missing = required.filter((key) => result[key] < 0);
  if (missing.length) {
    throw new Error(`Excel列が不足しています: ${missing.map((key) => HEADER_ALIASES[key][0]).join(", ")}`);
  }
  return result;
}

function valueAt(row: unknown[], index: number): unknown {
  return index >= 0 ? row[index] : "";
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
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
}

export function parseAuctionExcelRows(rows: unknown[][], fallbackDate: string): ParsedAuctionImport {
  if (rows.length < 2) throw new Error("Excelにデータ行がありません");
  const headers = buildHeaderMap(rows[0] || []);
  const groups = new Map<string, {
    name: string;
    salesCount: number;
    gmv: number;
    rounds: AuctionRoundImport[];
  }>();
  let skippedRowCount = 0;
  let sourceRowCount = 0;

  for (let index = 1; index < rows.length; index += 1) {
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
    const skuName = text(valueAt(row, headers.skuName));
    const salePrice = numberValue(valueAt(row, headers.salePrice));
    if (salePrice <= 0 && (!skuName || skuName === "-")) {
      skippedRowCount += 1;
      continue;
    }
    const productName = text(valueAt(row, headers.productName));
    if (!groups.has(productId)) {
      groups.set(productId, {
        name: productName,
        salesCount: Math.max(0, Math.trunc(numberValue(valueAt(row, headers.salesCount)))),
        gmv: Math.max(0, numberValue(valueAt(row, headers.gmv))),
        rounds: [],
      });
    }
    const group = groups.get(productId)!;
    group.rounds.push({
      roundNumber: group.rounds.length + 1,
      startPrice: Math.max(0, numberValue(valueAt(row, headers.startPrice))),
      salePrice: Math.max(0, salePrice),
      bidderCount: Math.max(0, Math.trunc(numberValue(valueAt(row, headers.bidderCount)))),
      winner: text(valueAt(row, headers.winner)),
      skuName,
      skuId: idValue(valueAt(row, headers.skuId), "SKU ID", rowNumber),
      startTime: text(valueAt(row, headers.startTime)),
      duration: Math.max(0, numberValue(valueAt(row, headers.duration))),
    });
  }

  const records: AuctionRecordImport[] = [];
  for (const [productId, group] of groups) {
    if (!group.rounds.length) continue;
    const averagePrice = group.rounds.reduce((sum, round) => sum + round.salePrice, 0) / group.rounds.length;
    records.push({
      productId,
      productName: group.name,
      startPrice: group.rounds[0]?.startPrice ?? null,
      finalPrice: Number.isFinite(averagePrice) ? Math.round(averagePrice) : null,
      totalGmv: group.gmv,
      totalOrders: group.salesCount,
      auctionCount: group.rounds.length,
      auctionDate: datePart(group.rounds[0]?.startTime, fallbackDate),
      roundsJson: JSON.stringify(group.rounds),
    });
  }
  if (!records.length) throw new Error("販売済み拍卖記録を確認できませんでした");
  return { sourceRowCount, skippedRowCount, records };
}

export function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
