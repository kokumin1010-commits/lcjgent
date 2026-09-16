import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EMPTY_STORE_PRODUCT_HANDCARD,
  getStoreProductHandcardMissingFields,
  mapStoreProductHandcardRow,
  storeProductHandcardInputSchema,
  storeProductHandcardPdfSchema,
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
    expect(mapped.normalPdf).toBeNull();
  });

  it("validates stored PDF metadata without trusting arbitrary URLs", () => {
    const parsed = storeProductHandcardPdfSchema.parse({
      storageKey: "store-product-handcards/store-1/product-2/normal-abc.pdf",
      fileName: "商品手卡.pdf",
      fileSize: 1_234_567,
      sha256: "a".repeat(64),
      pageCount: 3,
      isA4: true,
      uploadedAt: "2026-09-16T00:00:00.000Z",
      uploadedByName: "Staff",
    });
    expect(parsed.pageCount).toBe(3);
    expect((parsed as any).url).toBeUndefined();
    expect(() => storeProductHandcardPdfSchema.parse({ ...parsed, fileSize: 21 * 1024 * 1024 })).toThrow();
  });

  it("enforces list limits and rejects unsupported evidence references", () => {
    expect(() => storeProductHandcardInputSchema.parse({ productId: 1, sellingPoints: Array.from({ length: 9 }, (_, index) => `P${index}`) })).toThrow();
    expect(() => storeProductHandcardInputSchema.parse({ productId: 1, evidenceItems: [{ title: "Evidence", imageId: -1 }] })).toThrow();
  });
});

describe("store product A4 handcard integration contract", () => {
  const router = read("./storeProductRouter.ts");
  const service = read("./storeProductHandcardService.ts");
  const serverIndex = read("./_core/index.ts");
  const pdfValidator = read("./storeProductHandcardPdf.ts");
  const ui = read("../client/src/components/StoreProductHandcardDialog.tsx");
  const list = read("../client/src/components/StoreProductManagement.tsx");
  const migration = read("../drizzle/0140_store_product_handcards.sql");

  it("keeps PDF read, delete and upload behind authenticated store-product boundaries", () => {
    expect(router).toMatch(/handcard:\s*protectedProcedure/);
    expect(router).toMatch(/removeHandcardPdf:\s*protectedProcedure/);
    expect(serverIndex).toContain('/api/store-product-handcard-pdf-upload');
    expect(serverIndex).toContain('sdk.authenticateRequest(req)');
    expect(serverIndex).toContain('registerStoreProductHandcardPdf');
    expect(serverIndex).toContain('credentials');
  });

  it("keeps PDF data in the independent handcard table and audits upload, seed and removal", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `store_product_handcards`");
    expect(migration).not.toMatch(/ALTER TABLE|DROP TABLE|DELETE FROM|UPDATE `store_products`/);
    expect(service).toContain("handcard_pdf_uploaded");
    expect(service).toContain("handcard_pdf_removed");
    expect(service).toContain("handcard_pdf_seeded");
    expect(service).toContain("revision=revision+1");
    expect(service).toContain("storageGet(pdf.storageKey)");
    expect(service).toContain("normalPdf: previous?.normalPdf || null");
    expect(service).toContain("mirrorPdf: previous?.mirrorPdf || null");
    expect(service).not.toContain("normalPdf: previous?.normalPdf || content.normalPdf");
  });

  it("validates actual PDFs and exposes normal/mirror upload, preview, print and download", () => {
    expect(pdfValidator).toContain('buffer.subarray(0, 5).toString("ascii") !== "%PDF-"');
    expect(pdfValidator).toContain("STORE_PRODUCT_HANDCARD_PDF_MAX_BYTES");
    expect(pdfValidator).toContain("createHash(\"sha256\")");
    expect(pdfValidator).toContain("numpages");
    expect(ui).toContain('/api/store-product-handcard-pdf-upload');
    expect(ui).toContain('accept="application/pdf,.pdf"');
    expect(ui).toContain("普通版PDF");
    expect(ui).toContain("ミラー版PDF");
    expect(ui).toContain("開く・印刷");
    expect(ui).toContain("ダウンロード");
    expect(ui).toContain("<iframe");
  });

  it("registers the two user-provided Dr.Alba PDFs by exact product and SHA without parsing claims", () => {
    expect(service).toContain('1735202677797193331');
    expect(service).toContain('b0f63bc6690290715da43a2b288a8187051cf30b4ff0148cea2b387b80db5763');
    expect(service).toContain('3ed27180787431ff484d70a470208d2921714d2f548b8c0f376666dde8d558a5');
    expect(service).toContain('inspected.pageCount !== 3');
    expect(service).toContain('系统迁移（用户提供PDF）');
  });

  it("exposes an A4 handcard action on every store product row", () => {
    expect(list).toContain("setHandcardProductId(Number(product.id))");
    expect(list).toContain("A4手カード");
    expect(list).toContain("<StoreProductHandcardDialog");
  });
});
