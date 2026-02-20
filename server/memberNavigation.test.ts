import { describe, it, expect, beforeAll } from "vitest";

/**
 * 注文管理画面のお客様名リンク機能テスト
 * - OrderManagementにonMemberClick propsが定義されていること
 * - お客様名がクリック可能なボタンとして表示されること
 * - MallMembersにinitialMemberId propsが定義されていること
 * - MallDashboardPageでOrderManagementとMallMembersにpropsが渡されていること
 * - mall.getMemberOrders APIが存在すること
 */

describe("注文管理画面のお客様名リンク機能", () => {
  let orderManagementContent: string;
  let mallMembersContent: string;
  let mallDashboardContent: string;
  let routersContent: string;

  beforeAll(async () => {
    const fs = await import("fs");
    orderManagementContent = fs.readFileSync("./client/src/pages/OrderManagement.tsx", "utf-8");
    mallMembersContent = fs.readFileSync("./client/src/pages/MallMembers.tsx", "utf-8");
    mallDashboardContent = fs.readFileSync("./client/src/pages/MallDashboardPage.tsx", "utf-8");
    routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
  });

  // === OrderManagement ===

  it("OrderManagementにonMemberClick propsが定義されていること", () => {
    expect(orderManagementContent).toContain("onMemberClick");
    expect(orderManagementContent).toContain("OrderManagementProps");
  });

  it("お客様名がクリック可能なボタンとして実装されていること", () => {
    // onMemberClickが渡された場合にbuttonとして表示される
    expect(orderManagementContent).toContain("onMemberClick(item.lineUser");
    // ピンク色のスタイルが適用されている
    expect(orderManagementContent).toContain("text-pink-600");
  });

  it("お客様名クリック時にe.stopPropagation()が呼ばれること", () => {
    // 注文カード全体のクリックイベントと干渉しないようにstopPropagationが必要
    expect(orderManagementContent).toContain("e.stopPropagation()");
  });

  // === MallMembers ===

  it("MallMembersにinitialMemberId propsが定義されていること", () => {
    expect(mallMembersContent).toContain("initialMemberId");
    expect(mallMembersContent).toContain("MallMembersProps");
  });

  it("MallMembersにonMemberViewed propsが定義されていること", () => {
    expect(mallMembersContent).toContain("onMemberViewed");
  });

  it("initialMemberIdが指定された場合に自動で会員詳細を開くuseEffectがあること", () => {
    expect(mallMembersContent).toContain("useEffect");
    expect(mallMembersContent).toContain("initialMemberId");
    expect(mallMembersContent).toContain("setIsDetailOpen(true)");
  });

  // === MallDashboardPage ===

  it("MallDashboardPageにselectedMemberIdステートがあること", () => {
    expect(mallDashboardContent).toContain("selectedMemberId");
    expect(mallDashboardContent).toContain("setSelectedMemberId");
  });

  it("MallDashboardPageにhandleNavigateToMember関数があること", () => {
    expect(mallDashboardContent).toContain("handleNavigateToMember");
  });

  it("OrderManagementにonMemberClickが渡されていること", () => {
    expect(mallDashboardContent).toContain("onMemberClick={handleNavigateToMember}");
  });

  it("MallMembersにinitialMemberIdが渡されていること", () => {
    expect(mallDashboardContent).toContain("initialMemberId={selectedMemberId}");
  });

  it("MallMembersにonMemberViewedが渡されていること", () => {
    expect(mallDashboardContent).toContain("onMemberViewed=");
  });

  // === Backend API ===

  it("mall.getMemberOrders APIが存在すること", () => {
    expect(routersContent).toContain("getMemberOrders: protectedProcedure");
    expect(routersContent).toContain("getMallOrdersByLineUser(input.lineUserId)");
  });

  it("getMemberOrders APIがlineUserIdをnumber型で受け取ること", () => {
    const match = routersContent.match(
      /getMemberOrders: protectedProcedure[\s\S]*?\.input\(z\.object\(\{[\s\S]*?\}\)\)/
    );
    expect(match).toBeTruthy();
    expect(match![0]).toContain("lineUserId: z.number()");
  });
});
