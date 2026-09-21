import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const page = readFileSync(resolve(root, "client/src/pages/SelectionCenter.tsx"), "utf8");
const dialog = readFileSync(resolve(root, "client/src/components/SelectionProductBulkUpdateDialog.tsx"), "utf8");

describe("selection center bulk update UI", () => {
  it("supports row selection, page selection, server-backed filtered selection, clear, and bulk edit", () => {
    expect(page).toContain("selectedProductIds");
    expect(page).toContain("本页商品全选");
    expect(page).toContain("一键全选当前筛选");
    expect(page).toContain("getProductIdsForBulkSelection.fetch");
    expect(page).toContain("清空选择");
    expect(page).toContain("bulkUpdateProductsMutation.mutate");
    expect(page).toContain("data-testid=\"selection-product-bulk-toolbar\"");
    expect(page).toContain("const canBulkEdit");
    expect(page).toContain("{canBulkEdit && <div");
    expect(page).toContain("canBulkEdit && brandFilter !== 'all'");
    expect(page).toContain("{canBulkEdit && <Button variant=\"ghost\" size=\"sm\" onClick={() => setEditProduct(product)}");
    expect(page).toContain("canEdit={canBulkEdit}");
  });

  it("requires explicit opt-in per field and includes the requested product facts", () => {
    expect(dialog).toContain("只有勾选的字段会被统一更新");
    expect(dialog).toContain("价格 / 価格");
    expect(dialog).toContain("新增历史最低价记录 / 最安値履歴を追加");
    expect(dialog).toContain("库存 / 在庫");
    expect(dialog).toContain("佣金 / コミッション");
    expect(dialog).toContain("状态 / ステータス");
    expect(dialog).toContain("全成或全败");
    expect(dialog).toContain("已有更低记录不会被覆盖或删除");
    expect(dialog).toContain("最多保留两位小数");
    expect(dialog).toContain("价格更新会自动追加价格历史");
    expect(page).toContain("履歴を残したまま訂正としてアーカイブ");
  });
});
