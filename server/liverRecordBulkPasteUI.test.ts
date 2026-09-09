import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const liverRecordSource = readFileSync(`${here}/../client/src/pages/LiverSelfRecord.tsx`, "utf8");
const adminDetailSource = readFileSync(`${here}/../client/src/pages/LivestreamDetail.tsx`, "utf8");
const dialogSource = readFileSync(`${here}/../client/src/components/LivestreamSetBulkPasteDialog.tsx`, "utf8");

describe("liver record set bulk paste UI", () => {
  it("shows the bulk-paste action next to Add Product on /liver/record", () => {
    expect(liverRecordSource).toContain("setSetPasteDialogOpen(true)");
    expect(liverRecordSource).toContain("language === 'ja' ? '一括貼り付け'");
    expect(liverRecordSource).toContain("'批量粘贴'");
    expect(liverRecordSource).toContain("<ClipboardPaste");
    expect(liverRecordSource).toContain("LivestreamSetBulkPasteDialog");
  });

  it("uses the same parser and empty-row replacement rule as the admin editor", () => {
    for (const source of [liverRecordSource, adminDetailSource]) {
      expect(source).toContain("mergeLivestreamSetBulkPasteItems");
      expect(source).toContain("LivestreamSetBulkPasteDialog");
    }
    expect(adminDetailSource).not.toContain("const lines = pasteText.trim().split");
  });

  it("preserves the existing save conversion for pasted prices and quantities", () => {
    expect(liverRecordSource).toContain("originalPrice: parseInt(item.originalPrice) || 0");
    expect(liverRecordSource).toContain("quantity: parseInt(item.quantity) || 1");
    expect(liverRecordSource).toContain("sets: preparedSets.length > 0 ? preparedSets : undefined");
  });

  it("provides Japanese, Simplified Chinese, Traditional Chinese and English dialog copy", () => {
    expect(dialogSource).toContain('title: "商品一括貼り付け"');
    expect(dialogSource).toContain('title: "批量粘贴套餐商品"');
    expect(dialogSource).toContain('title: "批量貼上套組商品"');
    expect(dialogSource).toContain('title: "Bulk paste set products"');
    expect(dialogSource).toContain("parseLivestreamSetBulkPaste(text)");
  });

  it("keeps the dialog usable on mobile", () => {
    expect(dialogSource).toContain("max-h-[90vh]");
    expect(dialogSource).toContain("overflow-y-auto");
    expect(dialogSource).toContain("min-h-[150px]");
  });
});
