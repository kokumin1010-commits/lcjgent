import {
  safeAuctionRounds,
  type AuctionPurpose,
  type AuctionRound,
} from "./auctionRecordPersistence";

export type AuctionRiskLevel = "unknown" | "safe" | "warning" | "critical";

export type AuctionRiskRecord = {
  id: number | string;
  productId?: string | null;
  productName?: string | null;
  auctionDate?: string | Date | null;
  roundsJson?: unknown;
};

export type AuctionRoundEconomics = {
  purpose: AuctionPurpose;
  costKnown: boolean;
  lotQuantity: number | null;
  unitCost: number | null;
  totalCost: number | null;
  maxLossBudget: number | null;
  safeSaleFloor: number | null;
  profitLoss: number | null;
  loss: number | null;
  overBudget: boolean;
  level: AuctionRiskLevel;
  reason:
    | "missing_cost"
    | "planned_below_floor"
    | "loss_over_budget"
    | "loss_within_budget"
    | "below_cost"
    | "safe";
};

export type AuctionEventRisk = AuctionRoundEconomics & {
  key: string;
  winnerKey: string;
  winnerWinCount: number;
  winnerWinSharePercent: number | null;
  winnerLimit: number | null;
  repeatWinner: boolean;
  repeatWinnerOverLimit: boolean;
  combinedLevel: AuctionRiskLevel;
};

export type AuctionRiskAnalysis = {
  events: Record<string, AuctionEventRisk>;
  summary: {
    totalRoundCount: number;
    completedRoundCount: number;
    knownCostRoundCount: number;
    unknownCostRoundCount: number;
    lossRoundCount: number;
    totalKnownCost: number;
    totalKnownSale: number;
    totalKnownLoss: number;
    overBudgetCount: number;
    repeatWinnerRoundCount: number;
    criticalRoundCount: number;
  };
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeAuctionWinner(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ja-JP");
}

function normalizeIdentity(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ja-JP");
}

function auctionDateKey(
  record: AuctionRiskRecord,
  round: AuctionRound
): string {
  const startTimeDate = String(round.startTime || "").match(
    /^(\d{4}-\d{2}-\d{2})/
  )?.[1];
  if (startTimeDate) return startTimeDate;
  if (
    record.auctionDate instanceof Date &&
    !Number.isNaN(record.auctionDate.getTime())
  ) {
    return record.auctionDate.toISOString().slice(0, 10);
  }
  return String(record.auctionDate || "").slice(0, 10) || "unknown-date";
}

function productKey(record: AuctionRiskRecord): string {
  const productId = normalizeIdentity(record.productId);
  if (productId) return `id:${productId}`;
  const productName = normalizeIdentity(record.productName);
  return `name:${productName || record.id}`;
}

function skuKey(round: AuctionRound): string {
  const skuId = normalizeIdentity(round.skuId);
  if (skuId) return `id:${skuId}`;
  const skuName = normalizeIdentity(round.skuName);
  return `name:${skuName || "missing-sku"}`;
}

function combineRiskLevels(
  left: AuctionRiskLevel,
  right: AuctionRiskLevel
): AuctionRiskLevel {
  const order: AuctionRiskLevel[] = ["unknown", "safe", "warning", "critical"];
  return order.indexOf(left) >= order.indexOf(right) ? left : right;
}

export function calculateAuctionRoundEconomics(
  round: AuctionRound
): AuctionRoundEconomics {
  const lotQuantityValue = finiteNumber(round.lotQuantity);
  const unitCostValue = finiteNumber(round.unitCost);
  const lotQuantity =
    lotQuantityValue !== null && lotQuantityValue > 0 ? lotQuantityValue : null;
  const unitCost =
    unitCostValue !== null && unitCostValue >= 0 ? unitCostValue : null;
  const maxLossBudgetValue = finiteNumber(round.maxLossBudget);
  const maxLossBudget =
    maxLossBudgetValue !== null && maxLossBudgetValue >= 0
      ? maxLossBudgetValue
      : null;
  const purpose = round.auctionPurpose || "unknown";
  const costKnown = lotQuantity !== null && unitCost !== null;

  if (!costKnown) {
    return {
      purpose,
      costKnown: false,
      lotQuantity,
      unitCost,
      totalCost: null,
      maxLossBudget,
      safeSaleFloor: null,
      profitLoss: null,
      loss: null,
      overBudget: false,
      level: "unknown",
      reason: "missing_cost",
    };
  }

  const totalCost = lotQuantity * unitCost;
  const safeSaleFloor = Math.max(totalCost - (maxLossBudget ?? 0), 0);
  const salePrice = finiteNumber(round.salePrice) ?? 0;

  if (salePrice <= 0) {
    const plannedBelowFloor =
      round.startPrice > 0 && round.startPrice < safeSaleFloor;
    return {
      purpose,
      costKnown: true,
      lotQuantity,
      unitCost,
      totalCost,
      maxLossBudget,
      safeSaleFloor,
      profitLoss: null,
      loss: null,
      overBudget: false,
      level:
        plannedBelowFloor &&
        (purpose === "normal_sale" || maxLossBudget === null)
          ? "critical"
          : plannedBelowFloor
            ? "warning"
            : "safe",
      reason: plannedBelowFloor ? "planned_below_floor" : "safe",
    };
  }

  const profitLoss = salePrice - totalCost;
  const loss = Math.max(-profitLoss, 0);
  const overBudget = maxLossBudget !== null && loss > maxLossBudget;
  if (overBudget) {
    return {
      purpose,
      costKnown: true,
      lotQuantity,
      unitCost,
      totalCost,
      maxLossBudget,
      safeSaleFloor,
      profitLoss,
      loss,
      overBudget: true,
      level: "critical",
      reason: "loss_over_budget",
    };
  }
  if (loss > 0) {
    const critical = purpose === "normal_sale" || maxLossBudget === null;
    return {
      purpose,
      costKnown: true,
      lotQuantity,
      unitCost,
      totalCost,
      maxLossBudget,
      safeSaleFloor,
      profitLoss,
      loss,
      overBudget: false,
      level: critical ? "critical" : "warning",
      reason: maxLossBudget !== null ? "loss_within_budget" : "below_cost",
    };
  }
  return {
    purpose,
    costKnown: true,
    lotQuantity,
    unitCost,
    totalCost,
    maxLossBudget,
    safeSaleFloor,
    profitLoss,
    loss,
    overBudget: false,
    level: "safe",
    reason: "safe",
  };
}

export function analyzeAuctionRisk(
  records: AuctionRiskRecord[]
): AuctionRiskAnalysis {
  const sourceEvents: Array<{
    key: string;
    cohortKey: string;
    winnerKey: string;
    round: AuctionRound;
    economics: AuctionRoundEconomics;
  }> = [];

  for (const record of records) {
    const rounds = safeAuctionRounds(record.roundsJson);
    rounds.forEach((round, roundIndex) => {
      const date = auctionDateKey(record, round);
      sourceEvents.push({
        key: `${record.id}:${roundIndex}`,
        cohortKey: `${date}|${productKey(record)}|${skuKey(round)}`,
        winnerKey: normalizeAuctionWinner(round.winner),
        round,
        economics: calculateAuctionRoundEconomics(round),
      });
    });
  }

  const cohortWinnerCounts = new Map<string, Map<string, number>>();
  for (const event of sourceEvents) {
    if (!event.winnerKey) continue;
    const winnerCounts =
      cohortWinnerCounts.get(event.cohortKey) || new Map<string, number>();
    winnerCounts.set(
      event.winnerKey,
      (winnerCounts.get(event.winnerKey) || 0) + 1
    );
    cohortWinnerCounts.set(event.cohortKey, winnerCounts);
  }

  const events: Record<string, AuctionEventRisk> = {};
  let completedRoundCount = 0;
  let knownCostRoundCount = 0;
  let unknownCostRoundCount = 0;
  let lossRoundCount = 0;
  let totalKnownCost = 0;
  let totalKnownSale = 0;
  let totalKnownLoss = 0;
  let overBudgetCount = 0;
  let repeatWinnerRoundCount = 0;
  let criticalRoundCount = 0;

  for (const event of sourceEvents) {
    const winnerCounts = cohortWinnerCounts.get(event.cohortKey);
    const cohortWins = winnerCounts
      ? [...winnerCounts.values()].reduce((sum, count) => sum + count, 0)
      : 0;
    const winnerWinCount = event.winnerKey
      ? winnerCounts?.get(event.winnerKey) || 0
      : 0;
    const winnerLimitValue = finiteNumber(event.round.winnerLimit);
    const winnerLimit =
      winnerLimitValue !== null && winnerLimitValue > 0
        ? winnerLimitValue
        : null;
    const repeatWinner = winnerWinCount >= 2;
    const repeatWinnerOverLimit =
      winnerLimit !== null && winnerWinCount > winnerLimit;
    const repeatLevel: AuctionRiskLevel = repeatWinnerOverLimit
      ? "critical"
      : repeatWinner
        ? "warning"
        : "safe";
    const combinedLevel = combineRiskLevels(event.economics.level, repeatLevel);
    const salePrice = finiteNumber(event.round.salePrice) ?? 0;

    if (salePrice > 0) completedRoundCount += 1;
    if (event.economics.costKnown) {
      knownCostRoundCount += 1;
      totalKnownCost += event.economics.totalCost || 0;
      if (salePrice > 0) totalKnownSale += salePrice;
    } else {
      unknownCostRoundCount += 1;
    }
    if ((event.economics.loss || 0) > 0) {
      lossRoundCount += 1;
      totalKnownLoss += event.economics.loss || 0;
    }
    if (event.economics.overBudget) overBudgetCount += 1;
    if (repeatWinner) repeatWinnerRoundCount += 1;
    if (combinedLevel === "critical") criticalRoundCount += 1;

    events[event.key] = {
      ...event.economics,
      key: event.key,
      winnerKey: event.winnerKey,
      winnerWinCount,
      winnerWinSharePercent:
        cohortWins > 0 ? Math.round((winnerWinCount / cohortWins) * 100) : null,
      winnerLimit,
      repeatWinner,
      repeatWinnerOverLimit,
      combinedLevel,
    };
  }

  return {
    events,
    summary: {
      totalRoundCount: sourceEvents.length,
      completedRoundCount,
      knownCostRoundCount,
      unknownCostRoundCount,
      lossRoundCount,
      totalKnownCost,
      totalKnownSale,
      totalKnownLoss,
      overBudgetCount,
      repeatWinnerRoundCount,
      criticalRoundCount,
    },
  };
}
