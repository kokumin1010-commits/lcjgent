import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const page = readFileSync(`${here}/../client/src/pages/ProductManagement.tsx`, "utf8");
const routers = readFileSync(`${here}/routers.ts`, "utf8");
const schema = readFileSync(`${here}/../drizzle/schema.ts`, "utf8");
const startup = readFileSync(`${here}/_core/index.ts`, "utf8");

describe("mall selection product import UI", () => {
  it("shows the selection center chooser only for new products", () => {
    expect(page).toContain("从选品中心同步 / 選品中心から取込");
    expect(page).toContain("{!editingProduct && (");
    expect(page).toContain("getSelectionProductImportOptions.useQuery");
    expect(page).toContain("enabled: isDialogOpen && !editingProduct");
  });

  it("prefills base data and keeps mall status as draft", () => {
    expect(page).toContain("selectionProductToMallPrefill");
    expect(page).toContain("name: prefill.name");
    expect(page).toContain("description: prefill.description");
    expect(page).toContain("brandId: prefill.brandId");
    expect(page).toContain("categoryId: prefill.categoryId");
    expect(page).toContain("price: prefill.price");
    expect(page).toContain("stock: prefill.stock");
    expect(page).toContain("images: prefill.images");
    expect(page).toContain('status: "draft"');
  });

  it("uses the atomic import mutation only when a selection product is chosen", () => {
    expect(page).toContain("createProductFromSelection.useMutation");
    expect(page).toContain("else if (selectedSelectionProduct)");
    expect(page).toContain("selectionProductId: Number(selectedSelectionProduct.id)");
    expect(page).toContain("SKU将在保存时从选品中心重新读取并一次写入");
  });

  it("marks already imported or exact-name products unavailable", () => {
    expect(page).toContain("source.importedMallProductId || source.exactNameMallProductId");
    expect(page).toContain("已在MALL");
  });
});

describe("mall selection product import backend contract", () => {
  it("exposes protected list and create procedures", () => {
    expect(routers).toContain("getSelectionProductImportOptions: protectedProcedure");
    expect(routers).toContain("createProductFromSelection: protectedProcedure");
    expect(routers).toContain("listSelectionProductsForMallImport");
    expect(routers).toContain("createMallProductFromSelection");
  });

  it("defines and migrates a unique source identity", () => {
    expect(schema).toContain('selectionProductId: int("selectionProductId").unique()');
    expect(startup).toContain('import("../migrations/addMallProductSelectionSource")');
  });
});
