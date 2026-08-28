import { describe, expect, it } from "vitest";
import { buildAuctionProductGroups } from "../client/src/lib/auctionDisplay";

function record(
  id: number,
  productName: string,
  rounds: Array<Record<string, unknown>>,
  productId = String(id)
) {
  return {
    id,
    productId,
    productName,
    auctionDate: "2026-08-27",
    liverName: "yuyo",
    roundsJson: JSON.stringify(rounds),
  };
}

describe("auction display grouping", () => {
  it("groups normalized identical product names even when product IDs differ", () => {
    const groups = buildAuctionProductGroups([
      record(
        1,
        "【KGオークション】 KYOGOKU",
        [
          {
            skuId: "sku-a",
            skuName: "100点",
            startTime: "2026-08-27 19:22",
            salePrice: 10000,
          },
        ],
        "product-a"
      ),
      record(
        2,
        "【KGオークション】  KYOGOKU ",
        [
          {
            skuId: "sku-a",
            skuName: "100点",
            startTime: "2026-08-27 19:28",
            salePrice: 10000,
          },
        ],
        "product-b"
      ),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.productIds).toEqual(["product-a", "product-b"]);
    expect(groups[0]?.auctionCount).toBe(2);
  });

  it("shows sequence numbers when a product has only one repeated SKU", () => {
    const [group] = buildAuctionProductGroups([
      record(1, "商品A", [
        {
          skuId: "sku-a",
          skuName: "100点",
          startTime: "2026-08-27 19:28",
          salePrice: 10000,
        },
        {
          skuId: "sku-a",
          skuName: "100点",
          startTime: "2026-08-27 19:22",
          salePrice: 10000,
        },
      ]),
    ]);
    expect(group?.events.map(event => event.displayLabel)).toEqual([
      "第1次拍卖",
      "第2次拍卖",
    ]);
    expect(group?.events.map(event => event.round.startTime)).toEqual([
      "2026-08-27 19:22",
      "2026-08-27 19:28",
    ]);
  });

  it("shows SKU names for different SKUs and appends a sequence only when that SKU repeats", () => {
    const [group] = buildAuctionProductGroups([
      record(1, "商品A", [
        {
          skuId: "sku-a",
          skuName: "洗发水",
          startTime: "2026-08-27 17:00",
          salePrice: 3000,
        },
        {
          skuId: "sku-b",
          skuName: "护发素",
          startTime: "2026-08-27 17:05",
          salePrice: 3000,
        },
        {
          skuId: "sku-a",
          skuName: "洗发水",
          startTime: "2026-08-27 17:10",
          salePrice: 3500,
        },
      ]),
    ]);
    expect(group?.skuCount).toBe(2);
    expect(group?.events.map(event => event.displayLabel)).toEqual([
      "洗发水 · 第1次",
      "护发素",
      "洗发水 · 第2次",
    ]);
  });

  it("keeps a zero-auction product card", () => {
    const [group] = buildAuctionProductGroups([record(1, "零成交商品", [])]);
    expect(group).toMatchObject({
      productName: "零成交商品",
      skuCount: 0,
      auctionCount: 0,
    });
  });
});
