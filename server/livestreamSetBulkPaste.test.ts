import { describe, expect, it } from "vitest";
import {
  mergeLivestreamSetBulkPasteItems,
  parseLivestreamSetBulkPaste,
} from "../shared/livestreamSetBulkPaste";

describe("livestream set bulk paste parser", () => {
  it("parses tab-separated product, quantity and unit price", () => {
    const result = parseLivestreamSetBulkPaste("商品A\t2\t19800\n商品B\t1\t0");
    expect(result.items).toEqual([
      { productName: "商品A", quantity: "2", originalPrice: "19800" },
      { productName: "商品B", quantity: "1", originalPrice: "0" },
    ]);
  });

  it("parses Japanese full-width spaces and full-width numbers", () => {
    const result = parseLivestreamSetBulkPaste("シャンプー　　２　　７，８１２");
    expect(result.items).toEqual([
      { productName: "シャンプー", quantity: "2", originalPrice: "7812" },
    ]);
  });

  it("keeps comma-separated thousand prices intact", () => {
    const result = parseLivestreamSetBulkPaste("商品C,3,19,800");
    expect(result.items).toEqual([
      { productName: "商品C", quantity: "3", originalPrice: "19800" },
    ]);
  });

  it("supports a price-only second column and a quantity-only second column", () => {
    const result = parseLivestreamSetBulkPaste("高价商品  1682\n赠品  3");
    expect(result.items).toEqual([
      { productName: "高价商品", quantity: "1", originalPrice: "1682" },
      { productName: "赠品", quantity: "3", originalPrice: "0" },
    ]);
  });

  it("ignores a spreadsheet header and applies safe numeric minimums", () => {
    const result = parseLivestreamSetBulkPaste("商品名\t数量\t单价\n商品D\t0\t-200");
    expect(result.sourceLineCount).toBe(2);
    expect(result.items).toEqual([
      { productName: "商品D", quantity: "1", originalPrice: "0" },
    ]);
  });

  it("uses safe defaults for name-only lines", () => {
    expect(parseLivestreamSetBulkPaste("仅商品名").items).toEqual([
      { productName: "仅商品名", quantity: "1", originalPrice: "0" },
    ]);
  });
});

describe("livestream set bulk paste merge", () => {
  const pasted = [{ productName: "商品A", quantity: "2", originalPrice: "19800" }];

  it("replaces the initial empty row", () => {
    expect(mergeLivestreamSetBulkPasteItems(
      [{ productName: "", quantity: "1", originalPrice: "" }],
      pasted,
    )).toEqual(pasted);
  });

  it("appends to existing products without overwriting them", () => {
    const existing = [{ productName: "既存商品", quantity: "1", originalPrice: "5000" }];
    expect(mergeLivestreamSetBulkPasteItems(existing, pasted)).toEqual([...existing, ...pasted]);
  });
});
