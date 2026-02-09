import { describe, it, expect } from "vitest";
import * as fs from "fs";

/**
 * LineMypageレシート申請タブ → Webフォーム誘導の検証テスト
 * 
 * LineMypageのレシート申請タブが/receipt-uploadへの誘導カードを表示し、
 * 既存の申請履歴も引き続き表示される構造を検証する
 */

describe("LineMypage Receipt Tab → Web Form Redirect", () => {
  const content = fs.readFileSync(
    "/home/ubuntu/task-automation-agent/client/src/pages/LineMypage.tsx",
    "utf-8"
  );

  it("should have receipt-upload route defined in the app", () => {
    const appContent = fs.readFileSync(
      "/home/ubuntu/task-automation-agent/client/src/App.tsx",
      "utf-8"
    );
    expect(appContent).toContain("/receipt-upload");
    expect(appContent).toContain("ReceiptUpload");
  });

  it("should have Web form redirect card in LineMypage receipts tab", () => {
    expect(content).toContain("Webフォームでレシートを申請");
    expect(content).toContain("レシートをアップロードする");
    expect(content).toContain("/receipt-upload");
  });

  it("should display step-by-step instructions in the redirect card", () => {
    expect(content).toContain("レシート画像をアップロード");
    expect(content).toContain("AIが自動で解析");
    expect(content).toContain("内容を確認して申請完了");
  });

  it("should still show receipt history section below the redirect card", () => {
    expect(content).toContain("レシート申請履歴");
    expect(content).toContain("過去のレシート申請状況");
    expect(content).toContain("getStatusBadge");
  });

  it("should use Upload and ExternalLink icons from lucide-react", () => {
    expect(content).toContain("ExternalLink");
    expect(content).toContain("Upload");
    expect(content).toMatch(/import\s*{[^}]*ExternalLink[^}]*}\s*from\s*["']lucide-react["']/);
    expect(content).toMatch(/import\s*{[^}]*Upload[^}]*}\s*from\s*["']lucide-react["']/);
  });

  it("should no longer reference LINE image sending for receipts in empty state", () => {
    expect(content).not.toContain("LINEでレシート画像を送信してポイントを獲得しましょう");
    expect(content).toContain("上のボタンからレシートをアップロードしてポイントを獲得しましょう");
  });
});
