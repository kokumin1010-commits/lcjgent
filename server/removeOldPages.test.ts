import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("旧レシート管理・旧ポイント管理ページの削除", () => {
  const clientSrcPath = path.resolve(__dirname, "../client/src");

  describe("App.tsx ルーティング", () => {
    const appContent = fs.readFileSync(path.join(clientSrcPath, "App.tsx"), "utf-8");

    it("旧レシート管理ルート(/master/receipts)が削除されている", () => {
      expect(appContent).not.toContain('path={"/master/receipts"}');
    });

    it("旧ポイント管理ルート(/master/points)が削除されている", () => {
      expect(appContent).not.toContain('path={"/master/points"}');
    });

    it("ReceiptManagementのimportが削除されている", () => {
      expect(appContent).not.toContain('import ReceiptManagement from');
    });

    it("MyPointsのimportが削除されている", () => {
      expect(appContent).not.toContain('import MyPoints from');
    });

    it("LCJ MALL統合ページルート(/master/mall)が存在する", () => {
      expect(appContent).toContain('/master/mall');
    });

    it("LineReceiptManagementのimportが残っている", () => {
      expect(appContent).toContain('import LineReceiptManagement from');
    });
  });

  describe("DashboardLayout サイドバー", () => {
    const layoutContent = fs.readFileSync(
      path.join(clientSrcPath, "components/DashboardLayout.tsx"),
      "utf-8"
    );

    it("旧レシート管理メニュー(/master/receipts)がサイドバーから削除されている", () => {
      expect(layoutContent).not.toContain('path: "/master/receipts"');
    });

    it("旧ポイント管理メニュー(/master/points)がサイドバーから削除されている", () => {
      expect(layoutContent).not.toContain('path: "/master/points"');
    });

    it("LCJ MALLメニュー(/master/mall)がサイドバーに存在する", () => {
      expect(layoutContent).toContain('path: "/master/mall"');
    });

    it("個別のMALL関連メニューがサイドバーから統合されている", () => {
      // 個別メニューは/master/mallに統合されたため、サイドバーには存在しない
      expect(layoutContent).not.toContain('path: "/master/products"');
      expect(layoutContent).not.toContain('path: "/master/orders"');
      expect(layoutContent).not.toContain('path: "/master/mall-members"');
      expect(layoutContent).not.toContain('path: "/master/mall-brands-categories"');
      expect(layoutContent).not.toContain('path: "/master/line-receipts"');
    });
  });
});
