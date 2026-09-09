import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getLiverRecordErrorMessage, isLiverRecordNetworkError } from "../client/src/lib/livestreamRecordUpload";

const read = (path: string) => readFileSync(path, "utf8");

describe("liver record upload and network resilience", () => {
  it("turns transport failures into a recoverable bilingual message", () => {
    expect(isLiverRecordNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLiverRecordNetworkError({ message: "Network request failed" })).toBe(true);
    expect(isLiverRecordNetworkError(new Error("BAD_REQUEST"))).toBe(false);
    expect(getLiverRecordErrorMessage(new TypeError("Failed to fetch"), "zh")).toContain("输入内容已保留");
    expect(getLiverRecordErrorMessage(new TypeError("Failed to fetch"), "ja")).toContain("入力内容は保持");
    expect(getLiverRecordErrorMessage(new Error("业务校验错误"), "zh")).toBe("业务校验错误");
  });

  it("encodes resized uploads as a matching JPEG filename and MIME type", () => {
    const helper = read("client/src/lib/livestreamRecordUpload.ts");
    expect(helper).toContain('canvas.toDataURL("image/jpeg", quality)');
    expect(helper).toContain('filename: `${prefix ? `${prefix}-` : ""}${safeBaseName}.jpg`');
    expect(helper).toContain('mimeType: "image/jpeg"');
    expect(helper).toContain("MAX_UPLOAD_BYTES = 8 * 1024 * 1024");
    expect(helper).toContain("MAX_BASE64_LENGTH = 12_000_000");
    expect(helper).toContain("URL.revokeObjectURL(objectUrl)");
  });

  it("uses the same prepared upload for main, before, analysis and set images", () => {
    const page = read("client/src/pages/LiverSelfRecord.tsx");
    expect(page).toContain("prepareLivestreamImageForUpload(fileToAnalyze)");
    expect(page).toContain("prepareLivestreamImageForUpload(screenshotFile)");
    expect(page).toContain('prepareLivestreamImageForUpload(beforeScreenshotFile, { prefix: "before" })');
    expect(page).toContain('prepareLivestreamImageForUpload(set.imageFile, { prefix: "set" })');
    expect(page).not.toContain("base64: await fileToBase64(set.imageFile)");
    expect(page).toContain("adCost: normalizedAdCost");
    expect(page).toContain("sets: preparedSets.length > 0 ? preparedSets : undefined");
    expect(page).toContain("brandDurations:");
  });

  it("keeps ad comparison recoverable without retrying server validation errors", () => {
    const panel = read("client/src/components/LiverAdEffectPanel.tsx");
    expect(panel).toContain("isLiverRecordNetworkError(error) && failureCount < 2");
    expect(panel).toContain("refetchOnReconnect: true");
    expect(panel).toContain("onClick={() => dashboard.refetch()}");
    expect(panel).toContain('isZh ? "重新读取" : "再読み込み"');
    expect(panel).not.toContain("{dashboard.error.message}");
  });
});
