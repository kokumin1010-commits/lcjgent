import { describe, it, expect, beforeAll } from "vitest";

/**
 * ブランド・カテゴリ・注文管理APIの権限テスト
 * - 注文管理API（getOrders, getOrderById, updateOrderStatus）の管理者権限チェックが削除されていること
 * - LCJ MALL統合ページに移行後もAPIの権限設定が正しいこと
 */

describe("ブランド・カテゴリ・注文管理の権限テスト", () => {
  let routersContent: string;
  let dashboardContent: string;

  beforeAll(async () => {
    const fs = await import("fs");
    routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    dashboardContent = fs.readFileSync("./client/src/components/DashboardLayout.tsx", "utf-8");
  });

  // === 注文管理API ===

  it("getOrders（注文一覧）に管理者権限チェックがないこと", () => {
    const getOrdersMatch = routersContent.match(
      /\/\/ 注文一覧取得\n\s+getOrders: protectedProcedure[\s\S]*?\.query\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(getOrdersMatch).toBeTruthy();
    const queryBody = getOrdersMatch![1];
    expect(queryBody).not.toContain('ctx.user.role !== "admin"');
    expect(queryBody).not.toContain("FORBIDDEN");
  });

  it("getOrderById（注文詳細）に管理者権限チェックがないこと", () => {
    const getOrderByIdMatch = routersContent.match(
      /\/\/ 注文詳細取得\n\s+getOrderById: protectedProcedure[\s\S]*?\.query\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(getOrderByIdMatch).toBeTruthy();
    const queryBody = getOrderByIdMatch![1];
    expect(queryBody).not.toContain('ctx.user.role !== "admin"');
    expect(queryBody).not.toContain("FORBIDDEN");
  });

  it("updateOrderStatus（注文ステータス更新）に管理者権限チェックがないこと", () => {
    const updateOrderMatch = routersContent.match(
      /\/\/ 注文ステータス更新\n\s+updateOrderStatus: protectedProcedure[\s\S]*?\.mutation\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(updateOrderMatch).toBeTruthy();
    const mutationBody = updateOrderMatch![1];
    expect(mutationBody).not.toContain('ctx.user.role !== "admin"');
    expect(mutationBody).not.toContain("FORBIDDEN");
  });

  // === DashboardLayout メニュー（LCJ MALL統合後）===

  it("サイドバーにLCJ MALLメニュー(/master/mall)が存在すること", () => {
    const mallMenuLine = dashboardContent.split("\n").find(line =>
      line.includes("/master/mall")
    );
    expect(mallMenuLine).toBeTruthy();
  });

  it("個別のMALL関連メニューがサイドバーから統合されていること", () => {
    // /master/mall に統合されたため個別パスは存在しない
    const brandLine = dashboardContent.split("\n").find(line =>
      line.includes('path: "/master/mall-brands-categories"')
    );
    expect(brandLine).toBeUndefined();

    const orderLine = dashboardContent.split("\n").find(line =>
      line.includes('path: "/master/orders"')
    );
    expect(orderLine).toBeUndefined();

    const productLine = dashboardContent.split("\n").find(line =>
      line.includes('path: "/master/products"')
    );
    expect(productLine).toBeUndefined();
  });
});
