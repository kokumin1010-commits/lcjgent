import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ui = fs.readFileSync(path.join(root, "client/src/components/StoreProductManagement.tsx"), "utf8");
const router = fs.readFileSync(path.join(root, "server/storeProductRouter.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "server/storeSelectionProductLinkService.ts"), "utf8");

describe("store product selection link contract", () => {
  it("uses server-side search by store, ID, SKU, barcode, name and brand", () => {
    expect(ui).toContain("trpc.storeProducts.selectionCandidates.useInfiniteQuery");
    expect(ui).toContain("storeId: store.id");
    expect(ui).toContain("debouncedSelectionSearch");
    expect(ui).toContain("limit: 100");
    expect(ui).toContain("getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined");
    expect(ui).toContain("void selectionQuery.fetchNextPage()");
    expect(ui).toContain("模糊搜索匹配 {selectionTotal} 件");
    expect(ui).toContain("已全部显示 ${selectionCandidates.length} 件");
    expect(ui).toContain("只有点击商品卡片后才会建立关联");
    expect(ui).toContain("输入选品中心商品ID、SKU或名称");
    expect(router).toContain("cursor: z.number().int().nonnegative().default(0)");
    expect(router).toContain("z.number().int().min(1).max(100).default(100)");
    expect(service).toContain("SELECT COUNT(*) AS total FROM selection_products sp");
    expect(service).toContain("LIMIT ? OFFSET ?");
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

  it("offers store-brand scoped bulk preview with explicit confirmation and bounded batches", () => {
    expect(ui).toContain("完整同步选品中心");
    expect(ui).toContain("trpc.storeProducts.previewSelectionBulkSync.useQuery");
    expect(ui).toContain("trpc.storeProducts.processSelectionBulkSyncBatch.useMutation");
    expect(ui).toContain('confirmation: "SYNC_STORE_SELECTION_PRODUCTS"');
    expect(ui).toContain("for (let batch = 0; batch < 100; batch += 1)");
    expect(ui).toContain("result.done || result.haltedWithoutProgress");
    expect(router).toContain("previewSelectionBulkSync: protectedProcedure");
    expect(router).toContain("processSelectionBulkSyncBatch: protectedProcedure");
    expect(router).toContain('z.literal("SYNC_STORE_SELECTION_PRODUCTS")');
    expect(router).toContain("z.number().int().min(1).max(20).default(10)");
  });

  it("keeps operational fields protected while filling missing source fields", () => {
    expect(ui).toContain("新增商品强制保存为草稿");
    expect(ui).toContain("不会覆盖上架状态、推广折扣、人工图片、人工SKU或已填写的价格/库存/备注");
    expect(service).toContain("sp.brandId=?");
    expect(service).toContain("current.product.status === \"online\" || current.product.status === \"offline\"");
    expect(service).toContain("stock: Number(current.product.stock || 0)");
    expect(service).toContain("mergeStoreSelectionSkuPrefills(");
    expect(service).toContain("selectionSourceRevision=?, selectionSyncedAt=CURRENT_TIMESTAMP");
  });
});
