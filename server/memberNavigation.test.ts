import { describe, it, expect, beforeAll } from "vitest";

/**
 * 会員詳細フルページ機能テスト
 * - MemberDetail.tsxフルページが存在すること
 * - App.tsxにルートが登録されていること
 * - OrderManagementのお客様名がフルページ遷移リンクになっていること
 * - MallMembersの詳細ボタンがフルページ遷移になっていること
 * - mall.getMemberById APIが存在すること
 * - mall.getMemberOrders APIが存在すること
 */

describe("会員詳細フルページ機能", () => {
  let memberDetailContent: string;
  let appContent: string;
  let orderManagementContent: string;
  let mallMembersContent: string;
  let routersContent: string;

  beforeAll(async () => {
    const fs = await import("fs");
    memberDetailContent = fs.readFileSync("./client/src/pages/MemberDetail.tsx", "utf-8");
    appContent = fs.readFileSync("./client/src/App.tsx", "utf-8");
    orderManagementContent = fs.readFileSync("./client/src/pages/OrderManagement.tsx", "utf-8");
    mallMembersContent = fs.readFileSync("./client/src/pages/MallMembers.tsx", "utf-8");
    routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
  });

  // === MemberDetail フルページ ===

  it("MemberDetail.tsxが存在し、フルページコンポーネントであること", () => {
    expect(memberDetailContent).toContain("export default function MemberDetail");
    expect(memberDetailContent).toContain("useParams");
  });

  it("MemberDetailに基本情報タブがあること", () => {
    expect(memberDetailContent).toContain('value="info"');
    expect(memberDetailContent).toContain("基本情報");
  });

  it("MemberDetailにポイント履歴タブがあること", () => {
    expect(memberDetailContent).toContain('value="points"');
    expect(memberDetailContent).toContain("ポイント");
    expect(memberDetailContent).toContain("getMemberPointHistory");
  });

  it("MemberDetailに注文履歴タブがあること", () => {
    expect(memberDetailContent).toContain('value="orders"');
    expect(memberDetailContent).toContain("注文履歴");
    expect(memberDetailContent).toContain("getMemberOrders");
  });

  it("MemberDetailにレシート履歴タブがあること", () => {
    expect(memberDetailContent).toContain('value="receipts"');
    expect(memberDetailContent).toContain("レシート");
    expect(memberDetailContent).toContain("getMemberReceiptHistory");
  });

  it("MemberDetailにポイント操作機能があること", () => {
    expect(memberDetailContent).toContain("adminAdjustPoints");
    expect(memberDetailContent).toContain("ポイントを付与");
    expect(memberDetailContent).toContain("ポイントを削除");
  });

  it("MemberDetailに戻るボタンがあること", () => {
    expect(memberDetailContent).toContain("ArrowLeft");
    expect(memberDetailContent).toContain("window.history.back()");
  });

  // === App.tsx ルーティング ===

  it("App.tsxにMemberDetailのimportがあること", () => {
    expect(appContent).toContain('import MemberDetail from "./pages/MemberDetail"');
  });

  it("App.tsxに/master/mall/member/:idルートが登録されていること", () => {
    expect(appContent).toContain('/master/mall/member/:id');
    expect(appContent).toContain("MemberDetail");
  });

  // === OrderManagement お客様名リンク ===

  it("OrderManagementのお客様名がフルページ遷移リンクになっていること", () => {
    expect(orderManagementContent).toContain("/master/mall/member/");
    expect(orderManagementContent).toContain("setLocation");
    expect(orderManagementContent).toContain("text-pink-600");
  });

  it("OrderManagementのお客様名クリック時にe.stopPropagation()が呼ばれること", () => {
    expect(orderManagementContent).toContain("e.stopPropagation()");
  });

  // === MallMembers 詳細ボタン ===

  it("MallMembersの詳細ボタンがフルページ遷移になっていること", () => {
    expect(mallMembersContent).toContain("/master/mall/member/");
    expect(mallMembersContent).toContain("setLocation");
  });

  // === Backend API ===

  it("mall.getMemberById APIが存在すること", () => {
    expect(routersContent).toContain("getMemberById: protectedProcedure");
    expect(routersContent).toContain("getLineUserById(input.id)");
  });

  it("mall.getMemberOrders APIが存在すること", () => {
    expect(routersContent).toContain("getMemberOrders: protectedProcedure");
    expect(routersContent).toContain("getMallOrdersByLineUser(input.lineUserId)");
  });

  it("getMemberById APIがidをnumber型で受け取ること", () => {
    const match = routersContent.match(
      /getMemberById: protectedProcedure[\s\S]*?\.input\(z\.object\(\{[\s\S]*?\}\)\)/
    );
    expect(match).toBeTruthy();
    expect(match![0]).toContain("id: z.number()");
  });
});
