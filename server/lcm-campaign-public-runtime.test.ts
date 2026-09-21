import { afterEach, describe, expect, it, vi } from "vitest";
import * as dbModule from "./db";
import { lcmRouter } from "./lcmRouter";

function createQueuedSelectDb(resultSets: unknown[][]) {
  let index = 0;
  const select = vi.fn(() => {
    const rows = resultSets[index++] || [];
    const chain: any = {};
    for (const method of ["from", "innerJoin", "leftJoin", "where", "groupBy"]) chain[method] = vi.fn(() => chain);
    chain.limit = vi.fn(async () => rows);
    chain.orderBy = vi.fn(async () => rows);
    return chain;
  });
  return { select };
}

describe("LCM public campaign runtime privacy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("serializes only campaign-public and minimal product-card fields for anonymous callers", async () => {
    const campaign = {
      id: 41,
      slug: "spring-live-abc1234",
      title: "春のライブ販売キャンペーン",
      summary: "公開概要",
      description: "公開説明",
      heroImageUrl: "https://example.com/campaign.webp",
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-10-31T00:00:00.000Z"),
      publishedAt: new Date("2026-09-01T00:00:00.000Z"),
      brandId: 7,
      brandSlug: "brand-seven",
      brandName: "Brand Seven",
      brandLogoUrl: "https://example.com/logo.webp",
    };
    const product = {
      id: 11,
      slug: "product-eleven",
      name: "対象商品",
      category: "美容",
      listPrice: "3980.00",
      currency: "JPY",
      taxMode: "included",
      sampleAvailable: true,
      primaryImageUrl: "https://example.com/product.webp",
      brandId: 7,
      brandSlug: "brand-seven",
      brandName: "Brand Seven",
      brandLogoUrl: "https://example.com/logo.webp",
    };
    const fakeDb = createQueuedSelectDb([[campaign], [product]]);
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fakeDb as any);

    const result = await lcmRouter.createCaller({ req: {}, res: {} } as any).getPublicCampaign({ slug: campaign.slug });

    expect(result.products).toEqual([product]);
    expect(Object.keys(result.products[0]).sort()).toEqual(Object.keys(product).sort());
    for (const sensitive of [
      "commissionRateMin", "commissionRateMax", "discountRateMin", "discountRateMax", "rewardNotes",
      "trackingMethod", "settlementTerms", "eligibility", "creativeGuidance", "prohibitedClaims",
      "samplePolicy", "applicationNotes", "description", "highlights", "thirtySecondPitch",
      "demoInstructions", "targetAudience", "wholesalePrice", "sampleInstructions", "stockQuantity",
    ]) {
      expect(result.products[0]).not.toHaveProperty(sensitive);
    }
    for (const sensitive of ["commissionRateMin", "discountRateMin", "settlementTerms", "eligibility", "creativeGuidance", "prohibitedClaims", "sampleAvailable", "samplePolicy"]) {
      expect(result).not.toHaveProperty(sensitive);
    }
  });
});
