import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("client/src/App.tsx", "utf8");
const router = readFileSync("server/festivalRouter.ts", "utf8");
const mypage = readFileSync("client/src/pages/LcfMypage.tsx", "utf8");
const guidanceIndex = readFileSync("client/src/pages/LcfGuidanceIndex.tsx", "utf8");
const guidance2026 = readFileSync("client/src/pages/LcfGuidance.tsx", "utf8");
const report = readFileSync("client/src/pages/Lcf2026Report.tsx", "utf8");
const editions = readFileSync("client/src/data/lcfEditions.ts", "utf8");
const downloads = readFileSync("client/src/data/lcf2026PhotoDownloads.ts", "utf8");

describe("LCF edition history and owned photo archive", () => {
  it("keeps the first event page and exposes an easy permanent year alias", () => {
    expect(app).toContain('<Route path="/2026" component={LiveCommerceFestival} />');
    expect(app).toContain('<Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />');
    expect(editions).toContain('shortPath: "/2026"');
    expect(editions).toContain('eventPath: "/livecommercefestival/2026"');
  });

  it("separates the guidance archive index from the permanent 2026 guidance", () => {
    expect(app).toContain('const LcfGuidanceIndex = lazy(() => import("./pages/LcfGuidanceIndex"))');
    expect(app).toContain('<Route path="/lcf/guidance/2026" component={LcfGuidance} />');
    expect(app).toContain('<Route path="/lcf/guidance" component={LcfGuidanceIndex} />');
    expect(editions).toContain('guidancePath: "/lcf/guidance/2026"');
    expect(guidanceIndex).toContain("歴代ガイダンス");
    expect(guidanceIndex).toContain("第2回ガイダンスは公開準備中です");
    expect(guidanceIndex).not.toMatch(/第2回.{0,30}20\d{2}[年./-]/s);
    expect(guidance2026).toContain("Permanent edition URL: /lcf/guidance/2026");
  });

  it("provides an authenticated, read-only edition history API", () => {
    const start = router.indexOf("getMyEditionHistory: festivalUserProcedure");
    const end = router.indexOf("// 本人による申込み詳細", start);
    const historyApi = router.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(historyApi).toContain("festival_company_applications");
    expect(historyApi).toContain("festival_liver_applications");
    expect(historyApi).toContain("festival_general_applications");
    expect(historyApi).toContain("lcf_tickets");
    expect(historyApi).toContain("lcf_booth_reservations");
    expect(historyApi).toContain("eventYear");
    expect(historyApi).toContain("admissionCount");
    expect(historyApi).toContain("checkedInReservationCount");
    expect(historyApi).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE)\b/i);
  });

  it("shows real first-edition participation history without changing operational cards", () => {
    expect(mypage).toContain("getMyEditionHistory.useQuery");
    expect(mypage).toContain("参加イベント");
    expect(mypage).toContain("入場チケット");
    expect(mypage).toContain("受付人数");
    expect(mypage).toContain("LIVEブース履歴");
    expect(mypage).toContain("第2回は公開準備中です");
    expect(mypage).toContain("<BoothReservationSection />");
    expect(mypage).toContain("QRCodeSVG");
  });

  it("publishes exactly 798 verified originals across nine owned ZIP chunks", () => {
    const chunkUrls = [...downloads.matchAll(/downloadUrl: "(https:\/\/files\.manuscdn\.com\/[^"]+\.zip)"/g)].map((match) => match[1]);
    const photoCounts = [...downloads.matchAll(/photoCount: (\d+), zipBytes:/g)].map((match) => Number(match[1]));
    const byteCounts = [...downloads.matchAll(/zipBytes: (\d+)/g)].map((match) => Number(match[1]));
    const hashes = [...downloads.matchAll(/zipSha256: "([a-f0-9]{64})"/g)].map((match) => match[1]);
    expect(chunkUrls).toHaveLength(9);
    expect(new Set(chunkUrls).size).toBe(9);
    expect(photoCounts.reduce((sum, count) => sum + count, 0)).toBe(798);
    expect(byteCounts.reduce((sum, count) => sum + count, 0)).toBe(4_499_589_484);
    expect(hashes).toHaveLength(9);
    expect(new Set(hashes).size).toBe(9);
    expect(downloads).toContain("packageCount: 9");
    expect(downloads).toContain("DAY1 写真パック 1 / 3");
    expect(downloads).not.toMatch(/sourceAlbumUrl|manifestUrl|checksumUrl|readmeUrl/);
    expect(downloads).not.toMatch(/(?:X-Amz-|Signature=|Expires=|osrc)/i);
  });

  it("offers a self-hosted Japanese preview and download experience without third-party album links", () => {
    expect(report).toContain('id="gallery"');
    expect(report).toContain('id="official-downloads"');
    expect(report).toContain("公式写真 / 全798枚");
    expect(report).toContain("lcf2026PhotoDownloadChunks.map");
    expect(report).toContain("公式写真を、");
    expect(report).toContain("この写真パックをダウンロード");
    expect(report).toContain("galleryFilters.map");
    expect(report).toContain("プライバシーと肖像");
    expect(report).toContain("PHOTO ARCHIVE / 48 SELECTED");
    expect(report).not.toMatch(/alltuu|SHA256SUMS|全分卷リスト|利用案内|ORIGINAL ZIP|原図/);
  });
});
