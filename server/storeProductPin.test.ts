import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./storeProductRouter.ts", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("./storeProductUpgrade.ts", import.meta.url), "utf8");
const ui = readFileSync(
  new URL("../client/src/components/StoreProductManagement.tsx", import.meta.url),
  "utf8",
);

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("store product pinning", () => {
  it("adds pinnedAt idempotently and includes it in schema health", () => {
    expect(upgrade).toContain('name: "pinnedAt"');
    expect(upgrade).toContain('ensureMysqlColumns(pool, "store_products"');
    expect(upgrade).toContain("pinnedAt TIMESTAMP NULL");
    expect(upgrade).toContain("missingProductColumns");
  });

  it("returns a boolean pin state and sorts active pinned rows first", () => {
    expect(router).toContain("isPinned: Boolean(row.pinnedAt)");
    expect(router).toContain(
      "ORDER BY p.deletedAt IS NOT NULL, p.pinnedAt IS NULL, p.pinnedAt DESC, p.updatedAt DESC, p.id DESC",
    );
  });

  it("pins by store-product identity without restricting the product brand", () => {
    const mutation = section(router, "setPinned: protectedProcedure", "detail: protectedProcedure");
    expect(mutation).toContain("SELECT * FROM store_products WHERE id=? LIMIT 1 FOR UPDATE");
    expect(mutation).toContain("await assertActiveStore(conn, Number(before.storeId))");
    expect(mutation).toContain("归档商品不能置顶，请先恢复商品");
    expect(mutation).toContain("updatedAt=updatedAt");
    expect(mutation).toContain('action: input.pinned ? "product_pinned" : "product_unpinned"');
    expect(mutation).not.toContain("brandName");
  });

  it("clears pin state on archive so restoring does not unexpectedly re-pin", () => {
    expect(router).toContain("SET deletedAt=CURRENT_TIMESTAMP, pinnedAt=NULL");
  });

  it("shows a reversible accessible pin control and visible pinned state", () => {
    expect(ui).toContain("trpc.storeProducts.setPinned.useMutation");
    expect(ui).toContain('title={product.isPinned ? "取消置顶" : "置顶商品"}');
    expect(ui).toContain("aria-label={`${product.isPinned ?");
    expect(ui).toContain("已置顶");
    expect(ui).toContain("bg-amber-50/80");
    expect(ui).toContain("disabled={Boolean(product.deletedAt) || pinMutation.isPending}");
  });
});
