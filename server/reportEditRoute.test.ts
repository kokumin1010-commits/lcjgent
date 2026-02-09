import { describe, it, expect } from "vitest";

/**
 * レポート編集ボタンのルーティングバグ修正テスト
 * 
 * バグ: 編集ボタンが /reports/edit/:id にナビゲートしていたが、
 * ルーティングは /master/reports/edit/:id で定義されていたため404エラー
 * 
 * 修正: setLocationのパスを /master/reports/edit/:id に変更
 */

describe("Report Edit Route Fix", () => {
  it("should use /master/reports/edit/ path for edit button navigation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/Reports.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify the edit button uses the correct /master/ prefixed path
    expect(content).toContain("setLocation(`/master/reports/edit/${report.id}`)");
  });

  it("should NOT use /reports/edit/ path without /master/ prefix", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/Reports.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Ensure no setLocation calls use the old incorrect path
    expect(content).not.toMatch(/setLocation\(`\/reports\/edit\//);
  });

  it("should have matching route defined in App.tsx for /master/reports/edit/:id", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify the route exists in App.tsx
    expect(content).toContain('/master/reports/edit/:id');
  });

  it("should have all setLocation calls in Reports.tsx using /master/ prefix", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/Reports.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Extract all setLocation calls
    const setLocationCalls = content.match(/setLocation\([^)]+\)/g) || [];
    
    // All navigation paths should start with /master/
    for (const call of setLocationCalls) {
      if (call.includes("/reports")) {
        expect(call).toContain("/master/reports");
      }
    }
  });
});
