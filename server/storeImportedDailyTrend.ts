import { dailyShopMetricsFromRow, normalizeDailyShopDate, type DailyShopMetrics } from "./storeDailyShopImport";
import { normalizeGrowthRows } from "./storeCommandCenterPolicy";

export type StoreImportedDataType = "shop_stats" | "products" | "ads";

export type StoreDataUploadSnapshot = {
  id: number;
  dataType: StoreImportedDataType;
  year: number;
  month: number;
  fileName: string | null;
  recordCount: number;
  versionNumber: number;
  isCurrent: number | boolean;
  uploadedAt: Date | string | null;
  dataJson: string | unknown[] | null;
  fileSha256?: string | null;
  originalFileKey?: string | null;
};

export type StoreImportedDailyRow = DailyShopMetrics & {
  businessDate: string;
  adCost: number | null;
  adGmv: number | null;
  adOrders: number | null;
  adRoi: number | null;
  productGmv: number | null;
  productOrders: number | null;
  productSoldQuantity: number | null;
  productSkuCount: number | null;
  sourceTypes: StoreImportedDataType[];
};

const DATE_KEYS = ["日期", "日付", "Date", "date", "按天", "day", "Day", "统计日期", "集計日"];
const AD_COST_KEYS = ["成本", "Cost", "cost", "消耗", "广告消耗", "广告花费", "広告費", "花费"];
const AD_GMV_KEYS = ["Gross revenue (Current shop)", "Gross revenue", "广告GMV", "広告GMV", "广告成交额", "revenue"];
const AD_ORDER_KEYS = ["SKU orders (Current shop)", "SKU orders", "订单数", "注文数", "订单", "Orders", "orders"];

function parseRows(value: StoreDataUploadSnapshot["dataJson"]): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
  } catch {
    return [];
  }
}

function normalizedHeader(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[\s_()（）・/\-]/g, "");
}

function readNumber(row: Record<string, unknown>, aliases: string[]): { observed: boolean; value: number } {
  const wanted = new Set(aliases.map(normalizedHeader));
  const entry = Object.entries(row).find(([key]) => wanted.has(normalizedHeader(key)));
  if (!entry) return { observed: false, value: 0 };
  const raw = entry[1];
  if (raw === null || raw === undefined || String(raw).trim() === "" || String(raw).trim() === "—" || String(raw).trim() === "-") {
    return { observed: false, value: 0 };
  }
  if (typeof raw === "number") return { observed: Number.isFinite(raw), value: Number.isFinite(raw) ? raw : 0 };
  const parsed = Number(String(raw).normalize("NFKC").replace(/[^0-9.+-]/g, ""));
  return { observed: Number.isFinite(parsed), value: Number.isFinite(parsed) ? parsed : 0 };
}

function businessDateFromRow(row: Record<string, unknown>): string | null {
  for (const key of DATE_KEYS) {
    const date = normalizeDailyShopDate(row[key]);
    if (date) return date;
  }
  return null;
}

function jstDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function emptyRow(businessDate: string): StoreImportedDailyRow {
  return {
    businessDate,
    gmv: null,
    orderCount: null,
    customerCount: null,
    soldQuantity: null,
    refundAmount: null,
    skuOrderCount: null,
    grossRevenue: null,
    pageViews: null,
    productVisitors: null,
    conversionRate: null,
    productImpressions: null,
    uniqueProductImpressions: null,
    productClicks: null,
    uniqueClicks: null,
    averageOrderValue: null,
    creatorLiveAttributedGmv: null,
    creatorLiveDirectGmv: null,
    creatorLiveIndirectGmv: null,
    boundAccountLiveAttributedGmv: null,
    merchantLiveGmv: null,
    merchantLiveIndirectGmv: null,
    affiliateVideoAttributedGmv: null,
    creatorVideoDirectGmv: null,
    creatorVideoIndirectGmv: null,
    boundAccountVideoAttributedGmv: null,
    merchantVideoGmv: null,
    merchantVideoIndirectGmv: null,
    adCost: null,
    adGmv: null,
    adOrders: null,
    adRoi: null,
    productGmv: null,
    productOrders: null,
    productSoldQuantity: null,
    productSkuCount: null,
    sourceTypes: [],
  };
}

function addSource(row: StoreImportedDailyRow, source: StoreImportedDataType) {
  if (!row.sourceTypes.includes(source)) row.sourceTypes.push(source);
}

function inPeriod(date: string | null, start: string, end: string): date is string {
  return Boolean(date && date >= start && date <= end);
}

function applyShopUploads(rowsByDate: Map<string, StoreImportedDailyRow>, uploads: StoreDataUploadSnapshot[], start: string, end: string) {
  const current = uploads.filter(upload => upload.dataType === "shop_stats" && Boolean(upload.isCurrent));
  for (const upload of current) {
    for (const raw of parseRows(upload.dataJson)) {
      if (raw._type === "summary") continue;
      const date = businessDateFromRow(raw);
      if (!inPeriod(date, start, end)) continue;
      const target = rowsByDate.get(date) || emptyRow(date);
      const metrics = dailyShopMetricsFromRow(raw);
      for (const [key, value] of Object.entries(metrics) as [keyof DailyShopMetrics, number | null][]) {
        if (value !== null) target[key] = value;
      }
      addSource(target, "shop_stats");
      rowsByDate.set(date, target);
    }
  }
}

function applyAdUploads(rowsByDate: Map<string, StoreImportedDailyRow>, uploads: StoreDataUploadSnapshot[], start: string, end: string) {
  const current = uploads.filter(upload => upload.dataType === "ads" && Boolean(upload.isCurrent));
  for (const upload of current) {
    for (const raw of parseRows(upload.dataJson)) {
      if (raw._type === "summary") continue;
      const date = businessDateFromRow(raw);
      if (!inPeriod(date, start, end)) continue;
      const target = rowsByDate.get(date) || emptyRow(date);
      const cost = readNumber(raw, AD_COST_KEYS);
      const gmv = readNumber(raw, AD_GMV_KEYS);
      const orders = readNumber(raw, AD_ORDER_KEYS);
      if (cost.observed) target.adCost = Number(target.adCost || 0) + cost.value;
      if (gmv.observed) target.adGmv = Number(target.adGmv || 0) + gmv.value;
      if (orders.observed) target.adOrders = Number(target.adOrders || 0) + orders.value;
      if (cost.observed || gmv.observed || orders.observed) {
        target.adRoi = Number(target.adCost || 0) > 0 && target.adGmv !== null ? Number(target.adGmv) / Number(target.adCost) : null;
        addSource(target, "ads");
        rowsByDate.set(date, target);
      }
    }
  }
}

function applyProductUploads(rowsByDate: Map<string, StoreImportedDailyRow>, uploads: StoreDataUploadSnapshot[], start: string, end: string) {
  const productUploads = uploads
    .filter(upload => upload.dataType === "products")
    .sort((left, right) => {
      const time = new Date(String(left.uploadedAt || 0)).getTime() - new Date(String(right.uploadedAt || 0)).getTime();
      return time || Number(left.versionNumber || 0) - Number(right.versionNumber || 0) || Number(left.id || 0) - Number(right.id || 0);
    });
  for (const upload of productUploads) {
    const rawRows = parseRows(upload.dataJson).filter(row => row._type !== "summary");
    const normalized = normalizeGrowthRows("sku_performance", rawRows).rows;
    const datedRows = normalized.filter(row => inPeriod(row.businessDate, start, end));
    const groups = new Map<string, typeof normalized>();
    if (datedRows.length) {
      for (const row of datedRows) {
        const group = groups.get(row.businessDate!) || [];
        group.push(row);
        groups.set(row.businessDate!, group);
      }
    } else if (!normalized.some(row => row.businessDate)) {
      const snapshotDate = jstDate(upload.uploadedAt);
      if (inPeriod(snapshotDate, start, end)) groups.set(snapshotDate, normalized);
    }
    for (const [date, productRows] of groups) {
      const target = rowsByDate.get(date) || emptyRow(date);
      target.productGmv = productRows.reduce((sum, row) => sum + Number(row.gmv || 0), 0);
      target.productOrders = productRows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
      target.productSoldQuantity = productRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      target.productSkuCount = new Set(productRows.map(row => row.skuId || row.skuName || row.productId || row.productName).filter(Boolean)).size;
      addSource(target, "products");
      rowsByDate.set(date, target);
    }
  }
}

export function buildImportedStoreDailyRows(uploads: StoreDataUploadSnapshot[], periodStart: string, periodEnd: string): StoreImportedDailyRow[] {
  const rowsByDate = new Map<string, StoreImportedDailyRow>();
  applyShopUploads(rowsByDate, uploads, periodStart, periodEnd);
  applyAdUploads(rowsByDate, uploads, periodStart, periodEnd);
  applyProductUploads(rowsByDate, uploads, periodStart, periodEnd);
  return [...rowsByDate.values()].sort((left, right) => left.businessDate.localeCompare(right.businessDate));
}

function sumObserved(rows: StoreImportedDailyRow[], key: keyof StoreImportedDailyRow): number | null {
  const observed = rows.filter(row => typeof row[key] === "number");
  return observed.length ? observed.reduce((sum, row) => sum + Number(row[key] || 0), 0) : null;
}

export function summarizeImportedStoreDailyRows(rows: StoreImportedDailyRow[]) {
  const gmv = sumObserved(rows, "gmv");
  const orderCount = sumObserved(rows, "orderCount");
  const customerCount = sumObserved(rows, "customerCount");
  const refundAmount = sumObserved(rows, "refundAmount");
  const soldQuantity = sumObserved(rows, "soldQuantity");
  const adCost = sumObserved(rows, "adCost");
  const adGmv = sumObserved(rows, "adGmv");
  const adOrders = sumObserved(rows, "adOrders");
  const storeRows = rows.filter(row => row.sourceTypes.includes("shop_stats"));
  const productSnapshots = rows.filter(row => row.sourceTypes.includes("products"));
  const latestProductSnapshot = productSnapshots[productSnapshots.length - 1] || null;
  const best = [...storeRows].sort((left, right) => Number(right.gmv || 0) - Number(left.gmv || 0))[0] || null;
  return {
    gmv,
    orderCount,
    customerCount,
    soldQuantity,
    refundAmount,
    refundRate: gmv !== null && gmv > 0 && refundAmount !== null ? refundAmount / gmv : null,
    dayCount: storeRows.length,
    averageDailyGmv: gmv !== null && storeRows.length ? gmv / storeRows.length : null,
    bestDay: best ? { businessDate: best.businessDate, gmv: best.gmv } : null,
    adCost,
    adGmv,
    adOrders,
    adRoi: adCost !== null && adCost > 0 && adGmv !== null ? adGmv / adCost : null,
    latestProductSnapshot: latestProductSnapshot ? {
      businessDate: latestProductSnapshot.businessDate,
      gmv: latestProductSnapshot.productGmv,
      orders: latestProductSnapshot.productOrders,
      soldQuantity: latestProductSnapshot.productSoldQuantity,
      skuCount: latestProductSnapshot.productSkuCount,
    } : null,
  };
}

export function importedStoreDailyCoverage(rows: StoreImportedDailyRow[]) {
  const source = (dataType: StoreImportedDataType) => {
    const dates = rows.filter(row => row.sourceTypes.includes(dataType)).map(row => row.businessDate);
    return { count: dates.length, firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null };
  };
  return { shopStats: source("shop_stats"), products: source("products"), ads: source("ads") };
}

export type StorePeriodAdMetrics = {
  adSpend: number | null;
  adGmv: number | null;
  adRoi: number | null;
  source: "store_ads_upload" | "ad_monthly_plans" | "missing";
};

export function resolveStorePeriodAdMetrics(input: {
  importedDayCount: number;
  importedAdCost: number | null;
  importedAdGmv: number | null;
  planRows: Array<{ adSpend?: unknown; adAttributedGmv?: unknown }>;
}): StorePeriodAdMetrics {
  let adSpend: number | null = null;
  let adGmv: number | null = null;
  let source: StorePeriodAdMetrics["source"] = "missing";

  if (input.importedDayCount > 0) {
    adSpend = input.importedAdCost;
    adGmv = input.importedAdGmv;
    source = "store_ads_upload";
  } else if (input.planRows.length > 0) {
    adSpend = input.planRows.reduce(
      (sum, row) => sum + Number(row.adSpend || 0),
      0
    );
    adGmv = input.planRows.reduce(
      (sum, row) => sum + Number(row.adAttributedGmv || 0),
      0
    );
    source = "ad_monthly_plans";
  }

  return {
    adSpend,
    adGmv,
    adRoi:
      adSpend !== null && adSpend > 0 && adGmv !== null
        ? adGmv / adSpend
        : null,
    source,
  };
}
