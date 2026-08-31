import { beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * ブランド司令塔のモバイル縦画面レイアウト回帰テスト。
 * 375–430px幅でページ全体の横スクロールを再発させないため、
 * 主要コンテナと操作領域のレスポンシブ指定を静的に検証する。
 */
describe("BrandList mobile portrait layout", () => {
  const filePath = path.join(__dirname, "../client/src/pages/BrandList.tsx");
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(filePath, "utf-8");
  });

  it("clips accidental root overflow and uses compact mobile gutters", () => {
    expect(content).toContain("min-h-screen overflow-x-clip");
    expect(content).toContain("w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8");
  });

  it("stacks the page header and uses a two-column mobile action grid", () => {
    expect(content).toContain("flex flex-col gap-4");
    expect(content).toContain("grid w-full grid-cols-2 gap-2");
    expect(content).toContain("min-h-11 w-full whitespace-nowrap");
  });

  it("keeps period controls and KPI cards inside the portrait viewport", () => {
    expect(content).toContain("grid grid-cols-2 gap-2 sm:flex sm:flex-wrap");
    expect(content).toContain("grid grid-cols-2 gap-3");
    expect(content).toContain("whitespace-nowrap text-lg font-bold tracking-tight");
  });

  it("makes filter controls fluid on mobile instead of fixed-width", () => {
    expect(content).toContain("grid grid-cols-2 items-end gap-3");
    expect(content).toContain("w-full border-gray-600 bg-gray-700/50 text-white sm:w-[180px]");
    expect(content).toContain("col-span-2 min-w-0 space-y-2");
  });

  it("allows brand header badges and quota badges to wrap", () => {
    expect(content).toContain("mt-2 flex flex-wrap items-center gap-1.5");
    expect(content).toContain("mb-2 flex flex-wrap items-center gap-2");
    expect(content).toContain("overflow-hidden rounded-xl p-4 transition-all sm:p-6");
  });
});
