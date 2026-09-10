import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const ui = readFileSync(`${here}/../client/src/pages/ProductManagement.tsx`, "utf8");
const router = readFileSync(`${here}/routers.ts`, "utf8");
const service = readFileSync(`${here}/mallSelectionProductImportService.ts`, "utf8");

describe("MALL selection bulk sync contract", () => {
  it("exposes admin-only count preview and confirmation-protected batch processing", () => {
    expect(router).toContain("previewSelectionProductBulkSync: protectedProcedure");
    expect(router).toContain("processSelectionProductBulkSyncBatch: protectedProcedure");
    expect(router.match(/ctx\.user\.role !== "admin"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(router).toContain('z.literal("SYNC_MISSING_SELECTION_PRODUCTS_AS_DRAFTS")');
    expect(router).toContain("z.number().int().min(1).max(20).default(20)");
  });

  it("forces every bulk-created item to remain a draft with protected MALL fields", () => {
    expect(service).toContain('status: "draft"');
    expect(service).toContain("pointPrice: null");
    expect(service).toContain("sortOrder: 9999");
    expect(service).toContain("{ allowZeroPriceForDraft: true }");
    expect(service).toContain("const limit = Math.min(Math.max(Number(input.limit || 20), 1), 20)");
  });

  it("shows preview counts, incomplete-field counts and draft-only protection before mutation", () => {
    expect(ui).toContain("同步选品中心缺失商品");
    expect(ui).toContain("预计新增 {bulkSyncPreview.ready} 件，全部保存为草稿");
    expect(ui).toContain("不会删除或覆盖MALL现有商品，不会自动上架");
    expect(ui).toContain("missingPositivePrice");
    expect(ui).toContain("missingImage");
    expect(ui).toContain("missingBrand");
    expect(ui).toContain("missingCategory");
    expect(ui).toContain("missingDescription");
  });

  it("processes in bounded batches and stops safely when no progress is possible", () => {
    expect(ui).toContain("for (let batch = 0; batch < 100; batch += 1)");
    expect(ui).toContain('confirmation: "SYNC_MISSING_SELECTION_PRODUCTS_AS_DRAFTS"');
    expect(ui).toContain("limit: 20");
    expect(ui).toContain("result.done || result.haltedWithoutProgress");
    expect(ui).toContain("isBulkSyncRunning && !open");
  });
});
