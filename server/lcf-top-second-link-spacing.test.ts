import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readProjectFile = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const topPage = readProjectFile("client/src/pages/LiveCommerceFestivalTop.tsx");

describe("LCFトップから第2回ページへの導線", () => {
  it("第2回開催情報を見るを第2回専用ページへの内部リンクとして表示する", () => {
    expect(topPage).toContain('href="/2nd"');
    expect(topPage).toContain("第2回開催情報を見る");
    expect(topPage).not.toContain('href="#next"');
  });
});
