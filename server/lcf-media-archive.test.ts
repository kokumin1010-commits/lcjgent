import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import archive from "../client/src/data/lcf2026MediaArchive.generated.json";

const component = readFileSync(
  "client/src/components/LcfMediaArchiveSection.tsx",
  "utf8"
);
const reportPage = readFileSync("client/src/pages/Lcf2026Report.tsx", "utf8");
const server = readFileSync("server/_core/index.ts", "utf8");
const editionData = readFileSync("client/src/data/lcfEditions.ts", "utf8");
const assetRoot = "client/public/lcf/2026/media-archive";

describe("LCF 2026 verified media archive", () => {
  it("groups 49 verified publication pages from 27 normalized media outlets into 14 story chains", () => {
    const pages = archive.groups.flatMap(group => group.pages);
    expect(archive.articleGroupCount).toBe(14);
    expect(archive.publicationPageCount).toBe(49);
    expect(archive.outletCount).toBe(27);
    expect(pages).toHaveLength(49);
    expect(new Set(pages.map(page => page.url)).size).toBe(49);
    expect(new Set(pages.map(page => page.outlet)).size).toBe(27);
    expect(pages.every(page => page.url.startsWith("https://"))).toBe(true);
    expect(
      pages.every(
        page => page.status === "verified" && page.checkedAt === "2026.09.16"
      )
    ).toBe(true);
  });

  it("preserves every captured preview locally and uses a representative preview for the two blocked Nico pages", () => {
    const pages = archive.groups.flatMap(group => group.pages);
    const captured = pages.filter(page => page.previewStatus === "captured");
    const representative = pages.filter(
      page => page.previewStatus === "representative"
    );
    const uniqueAssets = new Set(captured.map(page => page.assetName));

    expect(captured).toHaveLength(47);
    expect(representative).toHaveLength(2);
    expect(uniqueAssets.size).toBe(47);
    for (const assetName of uniqueAssets) {
      const path = join(assetRoot, assetName);
      expect(existsSync(path), assetName).toBe(true);
      expect(statSync(path).size, assetName).toBeGreaterThan(8_000);
    }
    for (const page of representative) {
      expect(page.outlet).toBe("ニコニコニュース");
      expect(page.previewSrc).not.toContain(page.id);
    }
  });

  it("contains all primary editorial and distribution outlets without inflated aliases", () => {
    for (const outlet of [
      "日刊スポーツ",
      "スポーツ報知",
      "スポニチアネックス",
      "デイリースポーツ",
      "ORICON NEWS",
      "LIVE TIMES",
      "Pop'n'Roll",
      "WWSチャンネル",
      "Yahoo!ニュース",
      "毎日新聞",
      "時事ドットコム",
      "東京新聞",
      "MANTANWEB",
      "TRAICY",
    ]) {
      expect(archive.outlets).toContain(outlet);
    }
    expect(archive.outlets).not.toContain("dmenuニュース");
    expect(archive.outlets).not.toContain("ライブドアニュース");
    expect(archive.outlets).toContain("dメニューニュース");
    expect(archive.outlets).toContain("livedoorニュース");
  });

  it("renders previews, source-chain expansion, filters and original links accessibly", () => {
    for (const token of [
      'id="media-archive"',
      "保存プレビュー",
      "同じ内容の掲載・配信先をすべて見る",
      "独自取材・インタビュー",
      "公式発表・開催レポート",
      "原文を開く",
      'role="dialog"',
      'aria-modal="true"',
      "同一稿件の代表プレビュー",
    ]) {
      expect(component).toContain(token);
    }
    expect(component).toContain("原文の著作権は各媒体・提供元に帰属します");
    expect(reportPage).toContain("<LcfMediaArchiveSection />");
  });

  it("updates browser and prerendered SEO with the verified archive counts", () => {
    expect(reportPage).toContain("27媒体・49掲載ページの保存プレビュー");
    expect(reportPage).toContain('"@type": "CollectionPage"');
    expect(reportPage).toContain("#media-archive");
    expect(server).toContain("27媒体・49掲載ページの保存プレビュー");
    expect(server).toContain("14の記事グループ");
    expect(server).toContain('"@type": "CollectionPage"');
    expect(server).toContain("numberOfItems: 49");
  });

  it("uses the verified WWS original article from the existing featured coverage", () => {
    expect(editionData).toContain(
      'href: "https://www.wws-channel.com/influencer/666377.html"'
    );
    expect(editionData).not.toContain(
      "topics.smt.docomo.ne.jp/amp/article/wwschannel"
    );
  });
});
