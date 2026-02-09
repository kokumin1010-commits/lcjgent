import { describe, it, expect } from "vitest";
import * as fs from "fs";

/**
 * レシートアップロードページの認証トークン送信テスト
 * 
 * /receipt-uploadページがLCJ MALLページとして認識され、
 * LINEログイン済みユーザーのセッショントークンが正しく送信されることを検証する
 * また、URLパラメータからのセッショントークン復元機能も検証する
 */

describe("Receipt Upload Page Authentication Token", () => {
  const mainContent = fs.readFileSync(
    "/home/ubuntu/task-automation-agent/client/src/main.tsx",
    "utf-8"
  );

  it("should include /receipt-upload in isLcjMallPage check", () => {
    expect(mainContent).toContain("currentPath === '/receipt-upload'");
  });

  it("should include /point-request in isLcjMallPage check", () => {
    expect(mainContent).toContain("currentPath === '/point-request'");
  });

  it("should send lcjSessionToken for LCJ MALL pages", () => {
    expect(mainContent).toContain("lcjSessionToken && isLcjMallPage");
  });

  it("should use credentials include for cookie-based auth", () => {
    expect(mainContent).toContain('credentials: "include"');
  });

  it("should have isLcjMallPage variable that covers all mall-related paths", () => {
    expect(mainContent).toContain("currentPath === '/mypage'");
    expect(mainContent).toContain("currentPath.startsWith('/line-')");
    expect(mainContent).toContain("currentPath === '/'");
    expect(mainContent).toContain("currentPath.startsWith('/mall')");
    expect(mainContent).toContain("currentPath === '/receipt-upload'");
  });
});

describe("Receipt Upload Page - URL Token Restoration", () => {
  const receiptContent = fs.readFileSync(
    "/home/ubuntu/task-automation-agent/client/src/pages/ReceiptUpload.tsx",
    "utf-8"
  );

  it("should use lineLogin.me for auth check", () => {
    expect(receiptContent).toContain("trpc.lineLogin.me.useQuery");
  });

  it("should read token from URL query parameters", () => {
    // URLSearchParamsでtokenパラメータを取得する処理があること
    expect(receiptContent).toContain("params.get('token')");
  });

  it("should save token to localStorage when received from URL", () => {
    // URLからのトークンをlcj_session_tokenとしてlocalStorageに保存すること
    expect(receiptContent).toContain("localStorage.setItem('lcj_session_token', token)");
  });

  it("should remove token from URL after saving (security)", () => {
    // セキュリティのためURLからtokenパラメータを削除すること
    expect(receiptContent).toContain("url.searchParams.delete('token')");
    expect(receiptContent).toContain("window.history.replaceState");
  });

  it("should wait for token restoration before querying user", () => {
    // tokenRestored状態がtrueになるまでクエリを遅延すること
    expect(receiptContent).toContain("tokenRestored");
    expect(receiptContent).toContain("enabled: tokenRestored");
  });

  it("should show loading while token is being restored", () => {
    // tokenRestored前はローディング表示すること
    expect(receiptContent).toContain("!tokenRestored || userLoading");
  });
});

describe("LineMypage - Receipt Upload Link with Token", () => {
  const mypageContent = fs.readFileSync(
    "/home/ubuntu/task-automation-agent/client/src/pages/LineMypage.tsx",
    "utf-8"
  );

  it("should pass session token in URL when navigating to receipt-upload", () => {
    // レシートアップロードリンクにセッショントークンを付与すること
    expect(mypageContent).toContain("localStorage.getItem('lcj_session_token')");
    expect(mypageContent).toContain("/receipt-upload?token=");
  });

  it("should fallback to plain URL when no token available", () => {
    // トークンがない場合はプレーンURLにフォールバックすること
    expect(mypageContent).toContain("setLocation('/receipt-upload')");
  });
});

describe("LINE Agent - Receipt Upload URL with Session Token", () => {
  const lineAgentContent = fs.readFileSync(
    "/home/ubuntu/task-automation-agent/server/lineAgent.ts",
    "utf-8"
  );

  it("should generate session token for LINE user", () => {
    // LINEユーザーのセッショントークンを生成すること
    expect(lineAgentContent).toContain("Buffer.from(JSON.stringify(sessionData)).toString('base64')");
  });

  it("should include token in receipt-upload URL", () => {
    // レシートアップロードURLにトークンを含めること
    expect(lineAgentContent).toContain("/receipt-upload?token=");
  });

  it("should include lineUserId in session data", () => {
    // セッションデータにlineUserIdを含めること
    expect(lineAgentContent).toContain("lineUserId: userId");
  });
});
