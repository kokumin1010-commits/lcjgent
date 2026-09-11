import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ui = fs.readFileSync(path.join(root, "client/src/components/StoreProductManagement.tsx"), "utf8");
const router = fs.readFileSync(path.join(root, "server/storeProductRouter.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "server/storeSelectionProductLinkService.ts"), "utf8");

describe("store product selection link contract", () => {
  it("uses server-side search by store, ID, SKU, barcode, name and brand", () => {
    expect(ui).toContain("trpc.storeProducts.selectionCandidates.useQuery");
    expect(ui).toContain("storeId: store.id");
    expect(ui).toContain("debouncedSelectionSearch");
    expect(ui).toContain("只有点击商品卡片后才会建立关联");
    expect(ui).toContain("输入选品中心商品ID、SKU或名称");
    expect(service).toContain("EXISTS (");
    expect(service).toContain("child.parentProductId=sp.id");
    expect(service).toContain("COALESCE(child.productId,'') LIKE ?");
    expect(service).toContain("CAST(COALESCE(sp.skuVariants, JSON_ARRAY()) AS CHAR) LIKE ?");
  });

  it("shows verified source summary and blocks duplicate or archived links", () => {
    expect(ui).toContain("已验证选择");
    expect(ui).toContain("保存时会重新核对来源版本和本店重复关联");
    expect(ui).toContain("已被本店其他商品关联");
    expect(ui).toContain("已有归档商品");
    expect(service).toContain("WHERE storeId=? AND selectionProductId=?");
    expect(service).toContain("GET_LOCK(?, 10)");
  });

  it("auto-fills source fields, SKUs and images but keeps editing available", () => {
    expect(ui).toContain("mergeStoreSelectionSkuPrefills");
    expect(ui).toContain("item.externalProductId");
    expect(ui).toContain("item.category");
    expect(ui).toContain("item.productUrl");
    expect(ui).toContain("sourcePreviewUrls.map");
    expect(ui).toContain("选品来源");
    expect(service).toContain("selectionProductToStorePrefill(source, children)");
    expect(service).toContain("INSERT INTO store_product_skus");
    expect(service).toContain("INSERT INTO store_product_images");
  });

  it("requires a source revision and an atomic verified save path", () => {
    expect(ui).toContain("trpc.storeProducts.saveFromSelection.useMutation");
    expect(ui).toContain("sourceRevision: String(activeSelection.sourceRevision)");
    expect(router).toContain("sourceRevision: z.string().regex(/^[a-f0-9]{64}$/)");
    expect(router).toContain("关联选品中心商品必须使用已验证的选择保存流程");
    expect(service).toContain("选品中心商品已更新，请重新选择后再保存");
    expect(service).toContain("await conn.beginTransaction()");
    expect(service).toContain("await conn.commit()");
    expect(service).toContain("await conn.rollback()");
  });
});
