import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  DEFAULT_LIVESTREAM_PLATFORM,
  LIVESTREAM_PLATFORM_VALUES,
  normalizeLivestreamPlatform,
} from "../shared/livestreamPlatforms";
import {
  buildLivestreamScreenshotPrompt,
  LIVESTREAM_SCREENSHOT_RESPONSE_FORMAT,
  normalizeLivestreamScreenshotAnalysis,
} from "./livestreamScreenshotAnalysis";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const emptyAnalysis = {
  detectedPlatform: "Unknown",
  salesAmount: null,
  currency: null,
  viewerCount: null,
  peakViewerCount: null,
  durationMinutes: null,
  productClicks: null,
  orderCount: null,
  impressions: null,
  salesCount: null,
  cartAddCount: null,
  avgViewDuration: null,
  likes: null,
  comments: null,
  shares: null,
  avgPrice: null,
  livestreamStartTime: null,
  livestreamEndTime: null,
  confidence: "low",
  warnings: [],
  productList: [],
};

describe("livestream platform normalization", () => {
  it("defaults empty and legacy TikTok Shop values to TikTok", () => {
    expect(DEFAULT_LIVESTREAM_PLATFORM).toBe("TikTok");
    expect(normalizeLivestreamPlatform(null)).toBe("TikTok");
    expect(normalizeLivestreamPlatform("TikTok Shop")).toBe("TikTok");
  });

  it("supports Shopee and a fixed major-platform allowlist", () => {
    const platformInput = z.enum(LIVESTREAM_PLATFORM_VALUES);
    expect(normalizeLivestreamPlatform("Shopee Live")).toBe("Shopee");
    expect(LIVESTREAM_PLATFORM_VALUES).toContain("Shopee");
    expect(LIVESTREAM_PLATFORM_VALUES).toContain("Instagram");
    expect(LIVESTREAM_PLATFORM_VALUES).toContain("YouTube");
    expect(platformInput.safeParse("Shopee").success).toBe(true);
    expect(platformInput.safeParse("not-a-platform").success).toBe(false);
    expect(normalizeLivestreamPlatform("not-a-platform")).toBe("TikTok");
  });
});

describe("livestream screenshot analysis", () => {
  it("maps the supplied Shopee Live sample into shared persisted metrics", () => {
    const result = normalizeLivestreamScreenshotAnalysis(
      {
        ...emptyAnalysis,
        detectedPlatform: "Shopee",
        salesAmount: 125,
        viewerCount: 16,
        durationMinutes: 120,
        orderCount: 2,
        impressions: 922,
        cartAddCount: 17,
        avgViewDuration: 23,
        comments: 3,
        confidence: "high",
      },
      "Shopee"
    );

    expect(result).toMatchObject({
      platform: "Shopee",
      detectedPlatform: "Shopee",
      platformMismatch: false,
      salesAmount: 125,
      currency: null,
      viewerCount: 16,
      durationMinutes: 120,
      orderCount: 2,
      confidence: "high",
      rawData: {
        impressions: 922,
        cartAddCount: 17,
        avgViewDuration: 23,
        comments: 3,
      },
    });
    expect(result.currency).toBeNull();
  });

  it("keeps missing values null and rejects invalid or impossible values", () => {
    const result = normalizeLivestreamScreenshotAnalysis(
      {
        ...emptyAnalysis,
        detectedPlatform: "TikTok",
        salesAmount: -1,
        viewerCount: Number.POSITIVE_INFINITY,
        orderCount: 0,
        durationMinutes: 20_000,
      },
      "TikTok"
    );

    expect(result.salesAmount).toBeNull();
    expect(result.viewerCount).toBeNull();
    expect(result.orderCount).toBe(0);
    expect(result.durationMinutes).toBeNull();
    expect(result.rawData.impressions).toBeNull();
  });

  it("flags a selected/detected platform mismatch", () => {
    const result = normalizeLivestreamScreenshotAnalysis(
      { ...emptyAnalysis, detectedPlatform: "Shopee" },
      "TikTok"
    );

    expect(result.platformMismatch).toBe(true);
    expect(result.warnings[0]).toContain("Shopee");
  });

  it("uses strict JSON Schema and platform-specific Shopee extraction guidance", () => {
    expect(LIVESTREAM_SCREENSHOT_RESPONSE_FORMAT.json_schema.strict).toBe(true);
    expect(
      LIVESTREAM_SCREENSHOT_RESPONSE_FORMAT.json_schema.schema
        .additionalProperties
    ).toBe(false);
    const prompt = buildLivestreamScreenshotPrompt("Shopee");
    const tiktokPrompt = buildLivestreamScreenshotPrompt("TikTok");
    expect(prompt).toContain("Shopee Live");
    expect(prompt).toContain("加入购物车");
    expect(prompt).toContain("平均观看时间");
    expect(prompt).toContain("必ずnull");
    expect(tiktokPrompt).toContain("GMV");
    expect(tiktokPrompt).toContain("商品クリック数");
    expect(tiktokPrompt).toContain("ピーク同時視聴者数");
  });
});

describe("multi-platform livestream integration contract", () => {
  it("passes the selected platform to AI analysis and persists all shared Shopee metrics", () => {
    const page = read("client/src/pages/LiverSelfRecord.tsx");
    const router = read("server/routers.ts");

    expect(page).toContain("platform: formData.platform");
    expect(page).toContain(
      "cartAddCount: analyzedData?.rawData?.cartAddCount ?? undefined"
    );
    expect(page).toContain(
      "avgViewDuration: analyzedData?.rawData?.avgViewDuration ?? undefined"
    );
    expect(page).toContain(
      "comments: analyzedData?.rawData?.comments ?? undefined"
    );
    expect(router).toContain(
      "platform: z.enum(LIVESTREAM_PLATFORM_VALUES).default(DEFAULT_LIVESTREAM_PLATFORM)"
    );
    expect(router).toContain(
      "response_format: LIVESTREAM_SCREENSHOT_RESPONSE_FORMAT"
    );
    expect(router).toContain("peakViewers: input.peakViewerCount");
    expect(router).toContain("cartAddCount: input.cartAddCount");
    expect(router).toContain("avgViewDuration: input.avgViewDuration");
    expect(router).toContain("comments: input.comments");
  });

  it("shows and edits the normalized platform on the livestream detail page", () => {
    const detailPage = read("client/src/pages/LivestreamDetail.tsx");
    expect(detailPage).toContain(
      "platform: normalizeLivestreamPlatform(livestream.platform)"
    );
    expect(detailPage).toContain("platform: formData.platform");
    expect(detailPage).toContain(
      'getLivestreamPlatformLabel(normalizeLivestreamPlatform(livestream.platform), "ja")'
    );
    expect(detailPage).toContain("livestream.cartAddCount !== null");
    expect(detailPage).toContain("livestream.peakViewers !== null");
  });
});
