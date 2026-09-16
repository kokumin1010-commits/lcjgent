import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { lcf2026Coverage } from "../client/src/data/lcfEditions";
import { shouldSuppressRandomSpin } from "../client/src/lib/randomSpinVisibility";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverSource = readFileSync(resolve(currentDir, "_core/index.ts"), "utf8");

describe("LCF DAY2 report coverage", () => {
  it("lists the official DAY2 report with its verified date and URL", () => {
    const day2 = lcf2026Coverage.find((item) => item.category === "DAY2レポート");

    expect(day2).toMatchObject({
      outlet: "NAC / 運営公式",
      date: "2026.09.14",
      title: "全セミナー満席、2日間のGMVは8,000万円超",
    });
    expect(day2?.href).toContain("day2");
    expect(day2?.summary).toContain("200名以上");
  });

  it("keeps the crawler-facing report content in sync", () => {
    expect(serverSource).toContain('dateModified: "2026-09-16"');
    expect(serverSource).toContain("14の記事グループ");
    expect(serverSource).toContain("DAY2開催レポート｜全セミナー満席、2日間のGMVは8,000万円超");
  });
});

describe("festival roulette suppression", () => {
  it.each([
    "/",
    "/2026",
    "/livecommercefestival",
    "/livecommercefestival/2026/report",
    "/lcf/mypage",
    "/lcf/admin",
    "/lcm",
    "/lcm/manage?requests=1",
    "/lcm/brands/example",
  ])("suppresses the roulette on the festival domain for %s", (path) => {
    expect(shouldSuppressRandomSpin(path, "www.livecommercefestival.com")).toBe(true);
  });

  it("also suppresses festival routes if reached from another configured host", () => {
    expect(shouldSuppressRandomSpin("/lcm/manage", "lcjmall.com")).toBe(true);
    expect(shouldSuppressRandomSpin("/lcf/mypage", "lcjmall.com")).toBe(true);
    expect(shouldSuppressRandomSpin("/livecommercefestival/2026/report", "lcjmall.com")).toBe(true);
    expect(shouldSuppressRandomSpin("/2026", "lcjmall.com")).toBe(true);
  });

  it("does not disable the mall roulette on ordinary mall routes", () => {
    expect(shouldSuppressRandomSpin("/mall/products", "lcjmall.com")).toBe(false);
    expect(shouldSuppressRandomSpin("/", "lcjmall.com")).toBe(false);
  });
});
