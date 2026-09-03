import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/LiveCommerceFestival.tsx"),
  "utf8"
);

describe("Live Commerce Festival special liver names", () => {
  it("uses 城咲仁 consistently on the guest card", () => {
    expect(pageSource).toContain("name: '城咲仁'");
    expect(pageSource).toContain("「城咲商店」");
    expect(pageSource).not.toContain("name: '城崎仁'");
  });
});
