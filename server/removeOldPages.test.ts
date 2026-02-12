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

    it("LINEレシート管理ルート(/master/line-receipts)は残っている", () => {
      expect(appContent).toContain('path={"/master/line-receipts"}');
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

    it("LINEレシート管理メニュー(/master/line-receipts)は残っている", () => {
      expect(layoutContent).toContain('path: "/master/line-receipts"');
    });

    it("未使用のCoins, Receiptアイコンのimportが削除されている", () => {
      const importLine = layoutContent.match(/import\s*{[^}]*}\s*from\s*["']lucide-react["']/);
      expect(importLine).toBeTruthy();
      if (importLine) {
        expect(importLine[0]).not.toContain("Coins");
        expect(importLine[0]).not.toContain("Receipt");
      }
    });
  });
});
