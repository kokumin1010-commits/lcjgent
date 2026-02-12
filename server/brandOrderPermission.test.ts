import { describe, it, expect, beforeAll } from "vitest";

/**
 * ブランド・カテゴリ・注文管理APIの権限テスト
 * - 注文管理API（getOrders, getOrderById, updateOrderStatus）の管理者権限チェックが削除されていること
 * - DashboardLayoutのブランド・カテゴリ管理と注文管理メニューからadminOnlyが削除されていること
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
    // 注文一覧取得の部分を抽出
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

  // === DashboardLayout メニュー ===

  it("ブランド・カテゴリメニューにadminOnlyがないこと", () => {
    const brandMenuLine = dashboardContent.split("\n").find(line =>
      line.includes("/master/mall-brands-categories")
    );
    expect(brandMenuLine).toBeTruthy();
    expect(brandMenuLine).not.toContain("adminOnly");
  });

  it("注文管理メニューにadminOnlyがないこと", () => {
    const orderMenuLine = dashboardContent.split("\n").find(line =>
      line.includes("/master/orders")
    );
    expect(orderMenuLine).toBeTruthy();
    expect(orderMenuLine).not.toContain("adminOnly");
  });

  it("商品管理メニューにadminOnlyがないこと（前回の変更が維持されていること）", () => {
    const productMenuLine = dashboardContent.split("\n").find(line =>
      line.includes("/master/products")
    );
    expect(productMenuLine).toBeTruthy();
    expect(productMenuLine).not.toContain("adminOnly");
  });
});
