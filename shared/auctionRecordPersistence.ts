export class AuctionRecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuctionRecordValidationError";
  }
}

export type AuctionRound = {
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

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

function cleanText(value: unknown, maxLength: number, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new AuctionRecordValidationError(`${label}过长 / ${label}が長すぎます（最大${maxLength}文字）`);
  }
  return normalized;
}

function numberValue(
  value: unknown,
  label: string,
  options: { integer?: boolean; minimum?: number; maximum?: number } = {},
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") {
    throw new AuctionRecordValidationError(`${label}格式无效 / ${label}の形式が正しくありません`);
  }
  const raw = String(value).trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new AuctionRecordValidationError(`${label}必须是0以上的数字 / ${label}は0以上の数値で入力してください`);
  }
  const parsed = Number(raw);
  const minimum = options.minimum ?? 0;
  if (!Number.isFinite(parsed) || parsed < minimum || (options.integer && !Number.isInteger(parsed)) || (options.maximum !== undefined && parsed > options.maximum)) {
    const integerLabel = options.integer ? "整数" : "数値";
    throw new AuctionRecordValidationError(`${label}必须是0以上的${integerLabel} / ${label}は0以上の${integerLabel}で入力してください`);
  }
  return parsed;
}

export function normalizeAuctionDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new AuctionRecordValidationError("拍卖日期无效 / 拍卖日が正しくありません");
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  const isoCandidate = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || raw;
  const match = DATE_PATTERN.exec(isoCandidate);
  if (!match) throw new AuctionRecordValidationError("拍卖日期必须为YYYY-MM-DD / 拍卖日はYYYY-MM-DDで入力してください");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AuctionRecordValidationError("拍卖日期无效 / 拍卖日が正しくありません");
  }
  return isoCandidate;
}

function roundObject(value: unknown, index: number): AuctionRound {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuctionRecordValidationError(`第${index + 1}轮格式无效 / ${index + 1}回目の形式が正しくありません`);
  }
  const source = value as Record<string, unknown>;
  const roundNumber = numberValue(source.roundNumber ?? index + 1, `第${index + 1}轮编号`, { integer: true, minimum: 1, maximum: 10000 });
  const startPrice = numberValue(source.startPrice ?? 0, `第${index + 1}轮起拍价`);
  const salePrice = numberValue(source.salePrice ?? source.finalPrice ?? source.salesPrice ?? 0, `第${index + 1}轮成交价`);
  const bidderCount = numberValue(source.bidderCount ?? source.bidders ?? 0, `第${index + 1}轮竞拍人数`, { integer: true, maximum: 1_000_000 });
  const duration = numberValue(source.duration ?? 0, `第${index + 1}轮时长`);
  return {
    roundNumber: roundNumber ?? index + 1,
    startPrice: startPrice ?? 0,
    salePrice: salePrice ?? 0,
    bidderCount: bidderCount ?? 0,
    winner: cleanText(source.winner, 500, "获胜者") ?? "",
    skuName: cleanText(source.skuName, 500, "SKU名称") ?? "",
    skuId: cleanText(source.skuId, 255, "SKU ID") ?? "",
    startTime: cleanText(source.startTime, 255, "开始时间") ?? "",
    duration: duration ?? 0,
  };
}

export function normalizeAuctionRounds(value: unknown): AuctionRound[] {
  if (value === undefined || value === null || value === "") return [];
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new AuctionRecordValidationError("拍卖轮次数据损坏，请先修正 / 拍卖ラウンドデータが壊れています");
    }
  }
  if (!Array.isArray(parsed)) {
    throw new AuctionRecordValidationError("拍卖轮次必须为数组 / 拍卖ラウンドは配列である必要があります");
  }
  if (parsed.length > 10000) {
    throw new AuctionRecordValidationError("拍卖轮次不能超过10000 / 拍卖ラウンドは10000件以内です");
  }
  return parsed.map(roundObject);
}

export function safeAuctionRounds(value: unknown): AuctionRound[] {
  try {
    return normalizeAuctionRounds(value);
  } catch {
    return [];
  }
}

export function canonicalAuctionRecordInput(
  rawInput: Record<string, unknown>,
  options: { requireIdentity?: boolean; requireDate?: boolean } = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const textFields = [
    ["productId", 255, "商品ID"],
    ["productName", 500, "商品名"],
    ["chineseName", 255, "中文商品名"],
    ["liverName", 255, "主播名"],
    ["note", 10000, "备注"],
    ["livestreamId", 50, "直播ID"],
  ] as const;
  for (const [field, maxLength, label] of textFields) {
    if (rawInput[field] !== undefined) data[field] = cleanText(rawInput[field], maxLength, label);
  }

  const numberFields = [
    ["startPrice", "起拍价", false, undefined],
    ["finalPrice", "成交价", false, undefined],
    ["totalGmv", "GMV", false, undefined],
    ["totalOrders", "成交件数", true, 1_000_000],
    ["auctionCount", "拍卖次数", true, 10000],
  ] as const;
  for (const [field, label, integer, maximum] of numberFields) {
    if (rawInput[field] !== undefined) data[field] = numberValue(rawInput[field], label, { integer, maximum });
  }

  if (rawInput.auctionDate !== undefined) data.auctionDate = normalizeAuctionDate(rawInput.auctionDate);

  if (rawInput.roundsJson !== undefined) {
    const rounds = normalizeAuctionRounds(rawInput.roundsJson);
    data.roundsJson = JSON.stringify(rounds);
    if (rounds.length > 0) {
      data.auctionCount = rounds.length;
      data.startPrice = rounds[0]?.startPrice ?? 0;
      const positivePrices = rounds.map((round) => round.salePrice).filter((price) => price > 0);
      data.finalPrice = positivePrices.length
        ? Math.round(positivePrices.reduce((sum, price) => sum + price, 0) / positivePrices.length)
        : null;
    } else {
      if (rawInput.auctionCount === undefined) data.auctionCount = 0;
      if (rawInput.finalPrice === undefined) data.finalPrice = null;
    }
  }

  const productId = data.productId ?? cleanText(rawInput.productId, 255, "商品ID");
  const productName = data.productName ?? cleanText(rawInput.productName, 500, "商品名");
  if (options.requireIdentity && !productId && !productName) {
    throw new AuctionRecordValidationError("请输入商品ID或商品名 / 商品IDまたは商品名を入力してください");
  }
  const auctionDate = data.auctionDate ?? normalizeAuctionDate(rawInput.auctionDate);
  if (options.requireDate && !auctionDate) {
    throw new AuctionRecordValidationError("请输入拍卖日期 / 拍卖日を入力してください");
  }
  return data;
}
