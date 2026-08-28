import {
  safeAuctionRounds,
  type AuctionRound,
} from "@shared/auctionRecordPersistence";

export type AuctionRecordForDisplay = {
  id: number | string;
  productId?: string | null;
  productName?: string | null;
  chineseName?: string | null;
  liverName?: string | null;
  auctionDate?: string | Date | null;
  note?: string | null;
  roundsJson?: unknown;
};

export type AuctionEventForDisplay = {
  recordId: number;
  roundIndex: number;
  record: AuctionRecordForDisplay;
  round: AuctionRound;
  skuKey: string;
  skuName: string;
  sequence: number;
  skuAuctionCount: number;
  displayLabel: string;
  sortKey: string;
};

export type AuctionProductGroup = {
  key: string;
  productName: string;
  productIds: string[];
  records: AuctionRecordForDisplay[];
  events: AuctionEventForDisplay[];
  skuCount: number;
  auctionCount: number;
};

export function normalizeAuctionProductName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ja-JP");
}

export function auctionSkuKey(
  round: Pick<AuctionRound, "skuId" | "skuName">
): string {
  const skuId = String(round.skuId || "").trim();
  if (skuId) return `id:${skuId}`;
  const skuName = normalizeAuctionProductName(round.skuName);
  return skuName ? `name:${skuName}` : "missing:sku";
}

function auctionEventSortKey(
  record: AuctionRecordForDisplay,
  round: AuctionRound,
  roundIndex: number
): string {
  const startTime = String(round.startTime || "").trim();
  if (startTime)
    return `${startTime}|${String(record.id).padStart(20, "0")}|${roundIndex}`;
  const auctionDate =
    record.auctionDate instanceof Date
      ? record.auctionDate.toISOString().slice(0, 10)
      : String(record.auctionDate || "").slice(0, 10);
  return `${auctionDate}|${String(record.id).padStart(20, "0")}|${roundIndex}`;
}

export function buildAuctionProductGroups(
  records: AuctionRecordForDisplay[]
): AuctionProductGroup[] {
  const groups = new Map<string, AuctionProductGroup>();

  for (const record of records) {
    const productName = String(record.productName || "").trim();
    const productId = String(record.productId || "").trim();
    const key = normalizeAuctionProductName(productName)
      ? `name:${normalizeAuctionProductName(productName)}`
      : `id:${productId || record.id}`;
    const group = groups.get(key) || {
      key,
      productName: productName || productId || "未分类商品",
      productIds: [],
      records: [],
      events: [],
      skuCount: 0,
      auctionCount: 0,
    };
    group.records.push(record);
    if (productId && !group.productIds.includes(productId))
      group.productIds.push(productId);
    const rounds = safeAuctionRounds(record.roundsJson);
    rounds.forEach((round, roundIndex) => {
      group.events.push({
        recordId: Number(record.id),
        roundIndex,
        record,
        round,
        skuKey: auctionSkuKey(round),
        skuName: String(round.skuName || "").trim(),
        sequence: 0,
        skuAuctionCount: 0,
        displayLabel: "",
        sortKey: auctionEventSortKey(record, round, roundIndex),
      });
    });
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const skuGroups = new Map<string, AuctionEventForDisplay[]>();
    for (const event of group.events) {
      const skuEvents = skuGroups.get(event.skuKey) || [];
      skuEvents.push(event);
      skuGroups.set(event.skuKey, skuEvents);
    }
    group.skuCount = skuGroups.size;
    group.auctionCount = group.events.length;

    for (const skuEvents of skuGroups.values()) {
      skuEvents.sort((left, right) =>
        left.sortKey.localeCompare(right.sortKey)
      );
      skuEvents.forEach((event, index) => {
        event.sequence = index + 1;
        event.skuAuctionCount = skuEvents.length;
        const skuLabel = event.skuName || "未指定SKU";
        if (group.skuCount === 1) {
          event.displayLabel = `第${event.sequence}次拍卖`;
        } else if (skuEvents.length === 1) {
          event.displayLabel = skuLabel;
        } else {
          event.displayLabel = `${skuLabel} · 第${event.sequence}次`;
        }
      });
    }
    group.events.sort((left, right) =>
      left.sortKey.localeCompare(right.sortKey)
    );
  }

  return [...groups.values()].sort((left, right) => {
    const leftDate = left.events.at(-1)?.sortKey || "";
    const rightDate = right.events.at(-1)?.sortKey || "";
    return (
      rightDate.localeCompare(leftDate) ||
      left.productName.localeCompare(right.productName, "ja-JP")
    );
  });
}
