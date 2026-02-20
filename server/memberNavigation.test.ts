import { describe, it, expect, beforeAll } from "vitest";

/**
 * 会員詳細フルページ機能テスト
 * - MemberDetail.tsxフルページが存在すること（1ページスクロール形式）
 * - App.tsxにルートが登録されていること
 * - OrderManagementのお客様名がフルページ遷移リンクになっていること
 * - MallMembersの詳細ボタンがフルページ遷移になっていること
 * - mall.getMemberById APIが存在すること
 * - mall.getMemberOrders APIが存在すること
 * - mall.getMemberReceiptStats APIが存在すること（累計購入金額）
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

  it("MemberDetailが1ページスクロール形式であること（タブなし）", () => {
    // タブのTabsContent/TabsTriggerが使われていないことを確認
    expect(memberDetailContent).not.toContain("TabsContent");
    expect(memberDetailContent).not.toContain("TabsTrigger");
    expect(memberDetailContent).not.toContain("<Tabs");
  });

  it("MemberDetailに基本情報セクションがあること", () => {
    expect(memberDetailContent).toContain("基本情報");
    expect(memberDetailContent).toContain("会員ID");
    expect(memberDetailContent).toContain("表示名");
  });

  it("MemberDetailにポイントセクションがあること", () => {
    expect(memberDetailContent).toContain("ポイント");
    expect(memberDetailContent).toContain("getMemberPointHistory");
    expect(memberDetailContent).toContain("ポイント履歴");
  });

  it("MemberDetailに注文履歴セクションがあること", () => {
    expect(memberDetailContent).toContain("注文履歴");
    expect(memberDetailContent).toContain("getMemberOrders");
  });

  it("MemberDetailにレシート履歴セクションがあること", () => {
    expect(memberDetailContent).toContain("レシート申請履歴");
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

  // === サマリー統計 ===

  it("MemberDetailに累計購入金額のサマリーカードがあること", () => {
    expect(memberDetailContent).toContain("累計購入金額");
    expect(memberDetailContent).toContain("getMemberReceiptStats");
    expect(memberDetailContent).toContain("totalPurchaseAmount");
  });

  it("MemberDetailにサマリー統計カード（現在ポイント・累計獲得・累計使用・注文数・レシート申請）があること", () => {
    expect(memberDetailContent).toContain("現在ポイント");
    expect(memberDetailContent).toContain("累計獲得");
    expect(memberDetailContent).toContain("累計使用");
    expect(memberDetailContent).toContain("注文数");
    expect(memberDetailContent).toContain("レシート申請");
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

  it("mall.getMemberReceiptStats APIが存在すること", () => {
    expect(routersContent).toContain("getMemberReceiptStats: protectedProcedure");
    expect(routersContent).toContain("getLineReceiptsByUser(input.lineUserId)");
    expect(routersContent).toContain("totalPurchaseAmount");
    expect(routersContent).toContain("totalPointsAwarded");
  });

  it("getMemberById APIがidをnumber型で受け取ること", () => {
    const match = routersContent.match(
      /getMemberById: protectedProcedure[\s\S]*?\.input\(z\.object\(\{[\s\S]*?\}\)\)/
    );
    expect(match).toBeTruthy();
    expect(match![0]).toContain("id: z.number()");
  });

  it("getMemberReceiptStats APIがlineUserIdをstring型で受け取ること", () => {
    const match = routersContent.match(
      /getMemberReceiptStats: protectedProcedure[\s\S]*?\.input\(z\.object\(\{[\s\S]*?\}\)\)/
    );
    expect(match).toBeTruthy();
    expect(match![0]).toContain("lineUserId: z.string()");
  });
});
