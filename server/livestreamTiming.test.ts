import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  deriveLivestreamDurationMinutes,
  normalizeLiverLookupKey,
  normalizeLivestreamTimingForPersistence,
  resolveLivestreamDurationMinutes,
} from "./livestreamTime";
import {
  buildLivestreamScreenshotPrompt,
  normalizeLivestreamScreenshotAnalysis,
} from "./livestreamScreenshotAnalysis";
import { createLivestreamHeaderCropDataUrl } from "./livestreamScreenshotImage";
import { parseLivestreamEvidenceDateTime } from "./livestreamTimingRepair";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const emptyAnalysis = {
  detectedPlatform: "TikTok",
  salesAmount: null,
  currency: "JPY",
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
  confidence: "high",
  warnings: [],
  productList: [],
};

describe("livestream timing normalization", () => {
  it("derives a missing duration from persisted start and end timestamps", () => {
    const record = {
      livestreamDate: "2026-09-16T00:45:00.000Z",
      livestreamEndTime: "2026-09-16T03:45:00.000Z",
      duration: null,
    };
    expect(deriveLivestreamDurationMinutes(record.livestreamDate, record.livestreamEndTime)).toBe(180);
    expect(resolveLivestreamDurationMinutes(record)).toBe(180);
  });

  it("prefers the timestamp interval over a conflicting stored duration", () => {
    expect(resolveLivestreamDurationMinutes({
      livestreamDate: "2026-09-11T02:27:41.000Z",
      livestreamEndTime: "2026-09-11T04:42:07.000Z",
      duration: 491,
    })).toBe(134);
  });

  it("rejects future OCR dates before a livestream row can be stored", () => {
    expect(() => normalizeLivestreamTimingForPersistence({
      start: "2026-12-29T07:00:00.000Z",
      end: "2026-12-29T09:14:00.000Z",
      durationMinutes: 134,
      referenceDate: new Date("2026-09-18T08:00:00.000Z"),
    })).toThrow("future_livestream_start");
  });

  it("normalizes ASCII case, full-width characters and spaces for history lookup", () => {
    expect(normalizeLiverLookupKey(" ＳＡＭＰＬＥ ")).toBe("sample");
    expect(normalizeLiverLookupKey("Sam ple")).toBe("sample");
  });
});

describe("livestream screenshot date safeguards", () => {
  const referenceDate = new Date("2026-09-18T08:00:00.000Z");

  it("uses an explicit current-date anchor in the OCR prompt", () => {
    const prompt = buildLivestreamScreenshotPrompt("TikTok", referenceDate);
    expect(prompt).toContain("2026-09-18");
    expect(prompt).toContain("画像上部");
    expect(prompt).toContain("未来の日付を推測してはいけません");
  });

  it("drops future timestamps returned by OCR", () => {
    const normalized = normalizeLivestreamScreenshotAnalysis({
      ...emptyAnalysis,
      livestreamStartTime: "2026-12-29T16:00:00+09:00",
      livestreamEndTime: "2026-12-30T00:11:00+09:00",
      durationMinutes: 491,
    }, "TikTok", referenceDate);

    expect(normalized.startDateTime).toBeNull();
    expect(normalized.endDateTime).toBeNull();
    expect(normalized.durationMinutes).toBeNull();
    expect(normalized.warnings.join(" ")).toContain("未来日");
  });

  it("replaces an inconsistent OCR duration with the start/end interval", () => {
    const normalized = normalizeLivestreamScreenshotAnalysis({
      ...emptyAnalysis,
      livestreamStartTime: "2026-09-11T10:27:41+08:00",
      livestreamEndTime: "2026-09-11T12:42:07+08:00",
      durationMinutes: 491,
    }, "TikTok", referenceDate);

    expect(normalized.durationMinutes).toBe(134);
    expect(normalized.warnings.join(" ")).toContain("日時差を使用");
  });

  it("creates an enlarged header crop for tiny timestamp text", async () => {
    const sharp = (await import("sharp")).default;
    const source = await sharp({
      create: {
        width: 1000,
        height: 500,
        channels: 3,
        background: { r: 245, g: 245, b: 245 },
      },
    }).jpeg().toBuffer();
    const dataUrl = await createLivestreamHeaderCropDataUrl(source.toString("base64"));
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    const cropped = Buffer.from(dataUrl!.split(",")[1], "base64");
    const metadata = await sharp(cropped).metadata();
    expect(metadata.width).toBe(3520);
    expect(metadata.height).toBeLessThan(500);
  });
});

describe("livestream timing repair integration contract", () => {
  const router = read("server/routers.ts");
  const database = read("server/db.ts");
  const repair = read("server/livestreamTimingRepair.ts");
  const startup = read("server/_core/index.ts");
  const systemRouter = read("server/_core/systemRouter.ts");

  it("analyzes both the full screenshot and an enlarged header with a precise vision model", () => {
    expect(router).toContain("createLivestreamHeaderCropDataUrl(input.imageBase64)");
    expect(router).toContain('model: "gemini-3.1-pro-preview"');
    expect(router).toContain("...imageContents");
  });

  it("completes a matching blank live record instead of creating a second history row", () => {
    expect(router).toContain("completedPlaceholder");
    expect(router).toContain("completed placeholder");
    expect(router).toContain("eq(brandLivestreams.brandId, 0)");
    expect(router).toContain("isNull(brandLivestreams.screenshotUrl)");
    expect(router).toContain("JSON.stringify({ id, completedPlaceholder, ...livestreamData })");
    expect(router).not.toContain("JSON.stringify(livestreamResult)");
  });

  it("normalizes name variants and returns effective durations to the public liver page", () => {
    expect(database).toContain("normalizeLiverLookupKey(streamerName)");
    expect(database).toContain("eq(brandLivestreams.streamAccountLiverId, liverId)");
    expect(database).toContain("resolveLivestreamDurationMinutes(livestream)");
    expect(database).toContain("resolveLivestreamDurationMinutes(row)");
    expect(database).toContain("const [currentJstYear, currentJstMonth] = getJSTMonthKey()");
  });

  it("protects historical repair with a DB lock, encrypted backups and an audit run", () => {
    expect(repair).toContain("GET_LOCK");
    expect(repair).toContain("runVerifiedBackup(pool, PRE_BACKUP_REASON)");
    expect(repair).toContain("runVerifiedBackup(pool, POST_BACKUP_REASON)");
    expect(repair).toContain("livestream_timing_repair_runs");
    expect(repair).toContain("mergeMatchingPlaceholder");
    expect(repair).toContain("TIMESTAMPDIFF(MINUTE, livestreamDate, livestreamEndTime)");
    expect(repair).toContain('evidenceSource: "persisted_endpoints"');
    expect(repair).toContain('"livestream_products"');
    expect(repair).toContain('"livestream_sets"');
    expect(repair).toContain('"livestream_promotions"');
    expect(repair).toContain("moveLivestreamBrandRows");
    expect(repair).toContain("ambiguous placeholders");
    expect(startup).toContain("runLivestreamTimingRepair()");
    expect(systemRouter).toContain("livestreamTimingRepairHealth");
  });

  it("parses positive and negative ISO offsets before applying the JST fallback", () => {
    const guard = "if (/(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(dateStr)) {";
    expect(router.split(guard).length - 1).toBe(2);
  });

  it("parses localized OCR month/day text with the displayed timezone", () => {
    const parsed = parseLivestreamEvidenceDateTime(
      "9月11日 10:27:41",
      new Date("2026-09-11T04:54:32.000Z"),
      "UTC+08:00",
    );
    expect(parsed?.toISOString()).toBe("2026-09-11T02:27:41.000Z");
  });

  it("accepts verified historical screenshot evidence without a 72-hour-only gate", () => {
    expect(repair).toContain("366 * 24 * 60 * 60 * 1000");
    expect(repair).not.toContain("createdAt.getTime() - 72 * 60 * 60 * 1000");
    expect(repair).toContain("必ず年・月・日・時・分・秒・UTCオフセットを含むISO 8601");
  });
});
