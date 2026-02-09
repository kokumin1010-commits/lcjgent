import { describe, it, expect } from "vitest";
import * as fs from "fs";

/**
 * レシートアップロードページの認証トークン送信テスト
 * 
 * /receipt-uploadページがLCJ MALLページとして認識され、
 * LINEログイン済みユーザーのセッショントークンが正しく送信されることを検証する
 */

describe("Receipt Upload Page Authentication Token", () => {
  const mainContent = fs.readFileSync(
    "/home/ubuntu/task-automation-agent/client/src/main.tsx",
    "utf-8"
  );

  it("should include /receipt-upload in isLcjMallPage check", () => {
    // /receipt-uploadがLCJ MALLページとして判定されること
    expect(mainContent).toContain("currentPath === '/receipt-upload'");
  });

  it("should include /point-request in isLcjMallPage check", () => {
    // /point-requestもLCJ MALLページとして判定されること
    expect(mainContent).toContain("currentPath === '/point-request'");
  });

  it("should send lcjSessionToken for LCJ MALL pages", () => {
    // LCJ MALLページでlcjSessionTokenが使用されること
    expect(mainContent).toContain("lcjSessionToken && isLcjMallPage");
  });

  it("should use credentials include for cookie-based auth", () => {
    // credentials: includeが設定されていること（cookieベースの認証も動作する）
    expect(mainContent).toContain('credentials: "include"');
  });

  it("should have isLcjMallPage variable that covers all mall-related paths", () => {
    // isLcjMallPageに必要なパスが全て含まれていること
    expect(mainContent).toContain("currentPath === '/mypage'");
    expect(mainContent).toContain("currentPath.startsWith('/line-')");
    expect(mainContent).toContain("currentPath === '/'");
    expect(mainContent).toContain("currentPath.startsWith('/mall')");
    expect(mainContent).toContain("currentPath === '/receipt-upload'");
  });

  it("ReceiptUpload page should use lineLogin.me for auth check", () => {
    const receiptContent = fs.readFileSync(
      "/home/ubuntu/task-automation-agent/client/src/pages/ReceiptUpload.tsx",
      "utf-8"
    );
    expect(receiptContent).toContain("trpc.lineLogin.me.useQuery()");
  });
});
