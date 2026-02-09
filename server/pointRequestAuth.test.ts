import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * PointRequest.tsx の永久ログイン対応テスト
 * - URLパラメータからのトークン復元
 * - sessionToken自動保存
 * - LINEログインフォールバック認証
 */

const pointRequestSource = readFileSync(
  join(__dirname, "../client/src/pages/PointRequest.tsx"),
  "utf-8"
);

const mainTsxSource = readFileSync(
  join(__dirname, "../client/src/main.tsx"),
  "utf-8"
);

describe("PointRequest 永久ログイン対応", () => {
  it("URLパラメータからトークンを復元するuseEffectが存在する", () => {
    expect(pointRequestSource).toContain("window.location.search");
    expect(pointRequestSource).toContain("params.get('token')");
    expect(pointRequestSource).toContain("localStorage.setItem('lcj_session_token', token)");
  });

  it("URLからtokenパラメータを削除するセキュリティ対策がある", () => {
    expect(pointRequestSource).toContain("url.searchParams.delete('token')");
    expect(pointRequestSource).toContain("window.history.replaceState");
  });

  it("tokenRestoredフラグでlineLogin.meクエリの実行タイミングを制御している", () => {
    expect(pointRequestSource).toContain("tokenRestored");
    expect(pointRequestSource).toContain("enabled: tokenRestored");
  });

  it("lineLogin.meのsessionTokenをlocalStorageに自動保存するuseEffectがある", () => {
    expect(pointRequestSource).toContain("lineUser?.sessionToken");
    expect(pointRequestSource).toContain("localStorage.setItem('lcj_session_token', lineUser.sessionToken)");
  });

  it("LINEログインのフォールバック認証（lineLogin.me）が実装されている", () => {
    expect(pointRequestSource).toContain("trpc.lineLogin.me.useQuery");
    expect(pointRequestSource).toContain("lineUser");
  });

  it("effectiveUserでManus OAuthとLINEログインの両方をサポートしている", () => {
    expect(pointRequestSource).toContain("effectiveUser");
    expect(pointRequestSource).toContain("user || (lineUser");
  });

  it("isLoadingがauthLoadingとlineUserLoadingの両方を考慮している", () => {
    expect(pointRequestSource).toContain("authLoading || (!user && lineUserLoading)");
  });

  it("クエリのenabledがeffectiveUserに基づいている", () => {
    expect(pointRequestSource).toContain("enabled: !!effectiveUser");
  });

  it("main.tsxで/point-requestがLCJ MALLページとして認識されている", () => {
    expect(mainTsxSource).toContain("/point-request");
  });

  it("useEffectがインポートされている", () => {
    expect(pointRequestSource).toContain("useEffect");
    expect(pointRequestSource).toMatch(/import.*useEffect.*from.*react/);
  });
});
