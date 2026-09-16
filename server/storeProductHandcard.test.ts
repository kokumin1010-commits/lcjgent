import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EMPTY_STORE_PRODUCT_HANDCARD,
  getStoreProductHandcardMissingFields,
  mapStoreProductHandcardRow,
  storeProductHandcardInputSchema,
  validateStoreProductHandcardEvidence,
} from "../shared/storeProductHandcard";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("store product A4 handcard model", () => {
  it("accepts structured truth-only content and preserves the linked evidence image", () => {
    const parsed = storeProductHandcardInputSchema.parse({
      productId: 12,
      theme: "aqua_light",
      seriesLabel: "DERMA PROGRAM No.1",
      subtitle: "美容液／10mL",
      shortDescription: "登録済みの商品説明",
      sellingPoints: ["ポイント1", "ポイント2"],
      ingredients: [{ name: "成分A", function: "働きA", benefit: "メリットA" }],
      usage: "登録済みの使用方法",
      targetAudience: "おすすめ対象",
      precautions: "注意事項",
      liveScript: "接客トーク",
      faqs: [{ question: "質問", answer: "回答" }],
      evidenceItems: [{ title: "登録済み試験資料", description: "説明", metric: "10%", imageId: 91 }],
    });
    expect(parsed.sellingPoints).toHaveLength(2);
    expect(parsed.evidenceItems[0].imageId).toBe(91);
    expect(() => validateStoreProductHandcardEvidence(parsed, [91, 92])).not.toThrow();
    expect(() => validateStoreProductHandcardEvidence(parsed, [92])).toThrow(/该商品/);
  });

  it("does not invent absent claims and reports required missing fields", () => {
    const missing = getStoreProductHandcardMissingFields({
      product: { productName: "商品", brandName: "", basePrice: null, mainImageUrl: "" },
      handcard: { ...EMPTY_STORE_PRODUCT_HANDCARD, sellingPoints: [], ingredients: [], faqs: [], evidenceItems: [] },
      imageCount: 0,
    });
    expect(missing).toEqual(expect.arrayContaining(["品牌", "商品图片", "价格", "商品简介", "核心卖点", "成分／特点", "使用方法", "注意事项"]));
    expect(missing).not.toContain("试验结果");
  });

  it("maps persisted JSON arrays without changing content or creating claims", () => {
    const mapped = mapStoreProductHandcardRow({
      theme: "navy",
      seriesLabel: "SERIES",
      subtitle: "SUBTITLE",
      shortDescription: "DESCRIPTION",
      sellingPoints: JSON.stringify(["A"]),
      ingredients: JSON.stringify([{ name: "B", function: "C", benefit: "D" }]),
      usage: "USE",
      targetAudience: "TARGET",
      precautions: "CAUTION",
      liveScript: "SCRIPT",
      faqs: JSON.stringify([{ question: "Q", answer: "A" }]),
      evidenceItems: JSON.stringify([]),
      revision: 3,
      updatedAt: "2026-09-16T00:00:00.000Z",
      updatedByName: "Staff",
    });
    expect(mapped.theme).toBe("navy");
    expect(mapped.sellingPoints).toEqual(["A"]);
    expect(mapped.ingredients[0]).toEqual({ name: "B", function: "C", benefit: "D" });
    expect(mapped.revision).toBe(3);
  });

  it("enforces list limits and rejects unsupported evidence references", () => {
    expect(() => storeProductHandcardInputSchema.parse({ productId: 1, sellingPoints: Array.from({ length: 9 }, (_, index) => `P${index}`) })).toThrow();
    expect(() => storeProductHandcardInputSchema.parse({ productId: 1, evidenceItems: [{ title: "Evidence", imageId: -1 }] })).toThrow();
  });
});

describe("store product A4 handcard integration contract", () => {
  const router = read("./storeProductRouter.ts");
  const service = read("./storeProductHandcardService.ts");
  const ui = read("../client/src/components/StoreProductHandcardDialog.tsx");
  const list = read("../client/src/components/StoreProductManagement.tsx");
  const migration = read("../drizzle/0140_store_product_handcards.sql");

  it("keeps read and write behind the existing authenticated store-product boundary", () => {
    expect(router).toMatch(/handcard:\s*protectedProcedure/);
    expect(router).toMatch(/saveHandcard:\s*protectedProcedure/);
    expect(router).toContain("saveStoreProductHandcard(await getPool(), input, actor(ctx))");
  });

  it("creates only the independent handcard table and audits every save", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `store_product_handcards`");
    expect(migration).not.toMatch(/ALTER TABLE|DROP TABLE|DELETE FROM|UPDATE `store_products`/);
    expect(service).toContain("handcard_updated");
    expect(service).toContain("revision=revision+1");
    expect(service).toContain("validateStoreProductHandcardEvidence(content, await getProductImageIds(conn, productId))");
    expect(service).toContain("store_product_images WHERE productId=? AND deletedAt IS NULL");
  });

  it("renders exact A4 pages, mirror mode and browser print/PDF without printing admin controls", () => {
    expect(ui).toContain("@page { size: A4 portrait; margin: 0; }");
    expect(ui).toContain("min-h-[297mm]");
    expect(ui).toContain("w-[210mm]");
    expect(ui).toContain("[transform:scaleX(-1)]");
    expect(ui).toContain("window.print()");
    expect(ui).toContain("store-handcard-controls");
    expect(ui).toContain("未登録項目は印刷上でも明示され、内容は自動生成されません");
  });

  it("exposes an A4 handcard action on every store product row", () => {
    expect(list).toContain("setHandcardProductId(Number(product.id))");
    expect(list).toContain("A4手カード");
    expect(list).toContain("<StoreProductHandcardDialog");
  });
});
