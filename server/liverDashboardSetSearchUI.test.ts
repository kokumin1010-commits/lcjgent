import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const pageSource = readFileSync(`${here}/../client/src/pages/LiverDashboardNew.tsx`, "utf8");
const dbSource = readFileSync(`${here}/db.ts`, "utf8");
const routerSource = readFileSync(`${here}/routers.ts`, "utf8");

describe("livers dashboard set search UI", () => {
  it("shows every searched set item with an explicit unit-price label", () => {
    const searchResultStart = pageSource.indexOf("{/* 検索結果表示 */}");
    const rankingStart = pageSource.indexOf("{setAnalysisData && setAnalysisData.length", searchResultStart);
    const searchResultSource = pageSource.slice(searchResultStart, rankingStart);
    expect(searchResultSource).toContain("set.items.map");
    expect(searchResultSource).toContain("item.productName");
    expect(searchResultSource).toContain("language === 'zh' ? '单价' : '単価'");
    expect(searchResultSource).toContain("formatCurrency(Number(item.originalPrice) || 0)");
    expect(searchResultSource).toContain("grid-cols-[minmax(0,1fr)_auto]");
  });

  it("also labels unit price in expanded liver set details", () => {
    const detailStart = pageSource.indexOf("{/* セット詳細展開エリア */}");
    const detailSource = pageSource.slice(detailStart);
    expect(detailSource).toContain("language === 'zh' ? '单价' : '単価'");
    expect(detailSource).toContain("formatCurrency(Number(item.originalPrice) || 0)");
  });

  it("runs a 300ms debounced fuzzy search while keeping Enter and button search", () => {
    expect(pageSource).toContain("setTimeout(() =>");
    expect(pageSource).toContain("setSetSearchKeyword(setSearchInput.trim())");
    expect(pageSource).toContain("}, 300)");
    expect(pageSource).toContain("模糊搜索套餐名、主播名、商品名");
    expect(pageSource).toContain("セット名・ライバー名・商品名をあいまい検索");
    expect(pageSource).toContain("maxLength={100}");
    expect(pageSource).toContain("e.key === 'Enter'");
  });
});

describe("set search server contract", () => {
  it("normalizes and scores set, streamer and item fields", () => {
    const start = dbSource.indexOf("export async function searchSets");
    const end = dbSource.indexOf("// ============================================", start);
    const searchSource = dbSource.slice(start, end);
    expect(searchSource).toContain("normalizeSetSearchText(keyword)");
    expect(searchSource).toContain("scoreSetSearchMatch");
    expect(searchSource).toContain("set.setName");
    expect(searchSource).toContain("set.streamerName");
    expect(searchSource).toContain("item.productName");
  });

  it("batch-loads items including originalPrice and keeps the 50-result cap", () => {
    const start = dbSource.indexOf("export async function searchSets");
    const end = dbSource.indexOf("// ============================================", start);
    const searchSource = dbSource.slice(start, end);
    expect(searchSource).toContain("inArray(livestreamSetItems.setId");
    expect(searchSource).toContain(".select()");
    expect(searchSource).toContain(".slice(0, 50)");
    expect(searchSource).not.toContain("Promise.all(allSets.map");
  });

  it("trims and caps the public search keyword", () => {
    const routeStart = routerSource.indexOf("search: publicProcedure", routerSource.indexOf("livestreamSets: router"));
    const routeSource = routerSource.slice(routeStart, routeStart + 350);
    expect(routeSource).toContain("z.string().trim().min(1).max(100)");
  });
});
