import { describe, expect, it } from "vitest";
import {
  analyzeAuctionRisk,
  calculateAuctionRoundEconomics,
  normalizeAuctionWinner,
} from "@shared/auctionRisk";
import {
  normalizeAuctionRounds,
  type AuctionRound,
} from "@shared/auctionRecordPersistence";

function round(overrides: Partial<AuctionRound> = {}): AuctionRound {
  return {
    roundNumber: 1,
    startPrice: 10_000,
    salePrice: 10_000,
    bidderCount: 5,
    winner: "buyer-a",
    skuName: "100点",
    skuId: "sku-100",
    promotionType: "",
    startTime: "2026-08-28 20:00:00",
    duration: 60,
    auctionPurpose: "market_test",
    lotQuantity: 100,
    unitCost: 1_400,
    maxLossBudget: 10_000,
    winnerLimit: 1,
    ...overrides,
  };
}

function record(
  id: number,
  rounds: AuctionRound[],
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    productId: "product-kg",
    productName: "KYOGOKU",
    auctionDate: "2026-08-28",
    roundsJson: JSON.stringify(rounds),
    ...overrides,
  };
}

describe("auction loss protection", () => {
  it("calculates the 1400 × 100 case without hiding the 130000 loss", () => {
    const risk = calculateAuctionRoundEconomics(round());
    expect(risk).toMatchObject({
      totalCost: 140_000,
      safeSaleFloor: 130_000,
      profitLoss: -130_000,
      loss: 130_000,
      overBudget: true,
      level: "critical",
      reason: "loss_over_budget",
    });
  });

  it("keeps an intentional market-test loss visible but within the approved budget", () => {
    const risk = calculateAuctionRoundEconomics(
      round({ salePrice: 120_000, maxLossBudget: 25_000 })
    );
    expect(risk).toMatchObject({
      totalCost: 140_000,
      safeSaleFloor: 115_000,
      profitLoss: -20_000,
      loss: 20_000,
      overBudget: false,
      level: "warning",
      reason: "loss_within_budget",
    });
  });

  it("treats any below-cost normal sale as critical", () => {
    const risk = calculateAuctionRoundEconomics(
      round({
        auctionPurpose: "normal_sale",
        salePrice: 139_999,
        maxLossBudget: null,
      })
    );
    expect(risk.level).toBe("critical");
    expect(risk.loss).toBe(1);
  });

  it("requires an explicit loss budget before treating a market-test loss as acceptable", () => {
    const risk = calculateAuctionRoundEconomics(
      round({
        auctionPurpose: "market_test",
        salePrice: 139_999,
        maxLossBudget: null,
      })
    );
    expect(risk.level).toBe("critical");
    expect(risk.reason).toBe("below_cost");
  });

  it("never treats missing legacy quantity or cost as zero", () => {
    const [legacy] = normalizeAuctionRounds(
      JSON.stringify([
        {
          roundNumber: 1,
          startPrice: 1,
          salePrice: 11_500,
          winner: "legacy buyer",
        },
      ])
    );
    expect(legacy).toMatchObject({
      auctionPurpose: "unknown",
      lotQuantity: null,
      unitCost: null,
      maxLossBudget: null,
      winnerLimit: null,
    });
    expect(calculateAuctionRoundEconomics(legacy!).level).toBe("unknown");
  });

  it("warns before auction when the planned starting price is below the safe floor", () => {
    const risk = calculateAuctionRoundEconomics(
      round({ salePrice: 0, startPrice: 10_000 })
    );
    expect(risk).toMatchObject({
      safeSaleFloor: 130_000,
      profitLoss: null,
      level: "warning",
      reason: "planned_below_floor",
    });
  });
});

describe("repeat winner concentration", () => {
  it("normalizes platform display names without pretending they are verified identities", () => {
    expect(normalizeAuctionWinner("  ＭＥＭＥ  ")).toBe("meme");
    expect(normalizeAuctionWinner("5匹のわんこと   暮らしてる")).toBe(
      "5匹のわんこと 暮らしてる"
    );
  });

  it("flags the same winner for the same product, SKU and day, respecting the configured limit", () => {
    const analysis = analyzeAuctionRisk([
      record(1, [
        round({
          roundNumber: 1,
          winner: "ＭＥＭＥ",
          startTime: "2026-08-28 20:00:00",
        }),
        round({
          roundNumber: 2,
          winner: " meme ",
          startTime: "2026-08-28 21:00:00",
        }),
        round({
          roundNumber: 3,
          winner: "meme",
          startTime: "2026-08-28 22:00:00",
        }),
      ]),
    ]);
    expect(analysis.events["1:0"]).toMatchObject({
      winnerWinCount: 3,
      winnerWinSharePercent: 100,
      repeatWinner: true,
      repeatWinnerOverLimit: true,
      combinedLevel: "critical",
    });
    expect(analysis.summary.repeatWinnerRoundCount).toBe(3);
  });

  it("does not combine a different SKU or a different auction day", () => {
    const analysis = analyzeAuctionRisk([
      record(1, [
        round({
          roundNumber: 1,
          winner: "same-buyer",
          skuId: "sku-a",
          startTime: "2026-08-28 20:00:00",
        }),
        round({
          roundNumber: 2,
          winner: "same-buyer",
          skuId: "sku-b",
          startTime: "2026-08-28 21:00:00",
        }),
        round({
          roundNumber: 3,
          winner: "same-buyer",
          skuId: "sku-a",
          startTime: "2026-08-29 20:00:00",
        }),
      ]),
    ]);
    expect(
      Object.values(analysis.events).map(event => event.winnerWinCount)
    ).toEqual([1, 1, 1]);
    expect(analysis.summary.repeatWinnerRoundCount).toBe(0);
  });
});
