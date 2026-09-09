import { describe, expect, it } from "vitest";
import {
  compactSetSearchText,
  normalizeSetSearchText,
  scoreSetSearchMatch,
  tokenizeSetSearchKeyword,
} from "../shared/setSearch";

describe("set fuzzy search normalization", () => {
  it("normalizes full-width Latin text, case, spaces and separators", () => {
    expect(normalizeSetSearchText("  ＤＲＫＯＺＵ　リジュ／バッグ  ")).toBe("drkozu リジュ バッグ");
    expect(compactSetSearchText("リジュ・バッグ")).toBe("リジュバッグ");
  });

  it("deduplicates normalized search tokens", () => {
    expect(tokenizeSetSearchKeyword("DRKOZU　drkozu バッグ")).toEqual(["drkozu", "バッグ"]);
  });
});

describe("set fuzzy search scoring", () => {
  const fields = [
    "drkozu リジュバッグ",
    "ちょこ",
    "リジュ chip",
    "リジュ shot",
    "クリアwash",
    "ヴァンパイア",
  ];

  it("matches partial text regardless of full-width/case differences", () => {
    expect(scoreSetSearchMatch("ＤＲＫＯＺＵ", fields)).toBeGreaterThan(0);
    expect(scoreSetSearchMatch("WASH", fields)).toBeGreaterThan(0);
  });

  it("matches multiple words across set, streamer and item fields in any order", () => {
    expect(scoreSetSearchMatch("バッグ　ちょこ", fields)).toBeGreaterThan(0);
    expect(scoreSetSearchMatch("shot drkozu", fields)).toBeGreaterThan(0);
  });

  it("tolerates separators and a small missing-character difference", () => {
    expect(scoreSetSearchMatch("リジュ／バッグ", fields)).toBeGreaterThan(0);
    expect(scoreSetSearchMatch("リジュバグ", fields)).toBeGreaterThan(0);
  });

  it("does not return unrelated candidates or false-positive short typos", () => {
    expect(scoreSetSearchMatch("シャンプー", fields)).toBe(0);
    expect(scoreSetSearchMatch("xy", fields)).toBe(0);
  });

  it("requires every keyword token to match at least one searchable field", () => {
    expect(scoreSetSearchMatch("drkozu シャンプー", fields)).toBe(0);
  });
});
