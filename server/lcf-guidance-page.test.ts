import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("client/src/App.tsx", "utf8");
const page = readFileSync("client/src/pages/LcfGuidance.tsx", "utf8");
const home = readFileSync("client/src/pages/LiveCommerceFestival.tsx", "utf8");

describe("LCF Guidance public page", () => {
  it("registers a public guidance route", () => {
    expect(app).toContain('const LcfGuidance = lazy(() => import("./pages/LcfGuidance"))');
    expect(app).toContain('<Route path="/lcf/guidance" component={LcfGuidance} />');
  });

  it("exposes guidance at the right edge of the desktop navigation and in the mobile menu", () => {
    expect(home).not.toContain("<GuidanceEntrySection />");
    expect(home.match(/href="\/lcf\/guidance"/g)).toHaveLength(2);
    expect(home).toContain('aria-label="LCF2026 ガイダンスを見る"');
    expect(home).toContain('<nav className="hidden xl:flex items-center gap-3">');
    expect(home).toContain('<div className="xl:hidden bg-white/95');
    expect(home).toContain('aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}');
    expect(home.match(/ガイダンス/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the supplied guide's core event facts", () => {
    expect(page).toContain("LCF Guidance");
    expect(page).toContain("2026年9月8日（火）〜9月9日（水）");
    expect(page).toContain("八芳園");
    expect(page).toContain("JLCA実行委員会");
  });

  it("includes every guide section and both schedules", () => {
    for (const section of [
      "開催概要",
      "イベントスケジュール",
      "会場MAP・図面・ブース配置",
      "ライバーガイダンス",
      "GMV AWARD 集計方法",
      "配信スペースについて",
      "持ち物・来場ライバー注意事項",
      "総合運営本部・お問い合わせ",
      "アクセス",
    ]) {
      expect(page).toContain(section);
    }
    expect(page).toContain("DAY1_PROGRAM");
    expect(page).toContain("DAY2_PROGRAM");
    expect(page).toContain('11:30〜17:30');
    expect(page).toContain('TikTok Shop成功の裏側対談');
    expect(page).toContain('AI動画制作セミナー');
    expect(page).toContain('株式会社ripples（リップルズ）');
    expect(page).toContain('MiniMax様');
    expect(page).not.toContain('11:00〜17:00');
    expect(page).not.toContain('スペシャルゲスト講演');
  });

  it("preserves v3 safety, arrival and photo-posting instructions", () => {
    expect(page).toContain("特別配信番組は撮影・配信・録画・SNS等への投稿を禁止します。");
    expect(page).toContain("DAY2のステージコンテンツは、撮影・SNS投稿OKです。");
    expect(page).toContain("DAY1は禁止｜DAY2ステージは撮影・SNS投稿OK");
    expect(page).not.toContain("番組・セミナーは撮影禁止");
    expect(page).not.toContain("1日目の特別配信番組及び2日目のセミナー");
    expect(page).toContain("入場用QRコード");
    expect(page).toContain("ライバー用ネックストラップを必ず着用");
    expect(page).toContain("Uber Eatsなどの配送サービスの利用は禁止です。");
    expect(page).toContain("困ったら、まず総合運営本部へ");
  });

  it("uses the six source GMV screenshots and venue images with accessible alt text", () => {
    expect(page.match(/GUIDE_ASSETS\.gmv[1-6]/g)).toHaveLength(6);
    expect(page).toContain("八芳園5F 会場図面");
    expect(page).toContain("八芳園6F ブース配置図");
    expect(page).toContain("八芳園 周辺交通アクセス地図");
    expect(page).toContain('loading="lazy"');
    expect(page).toContain('hEODvMuHSCeAggGr.jpg');
    expect(page).toContain('AYaZLmXukFQiHVUI.jpg');
    expect(page).toContain('PwePwPmAwZRcGesu.jpg');
  });

  it("keeps v3 submission wording without reviving retired ranking or an unspecified channel", () => {
    expect(page).toContain("対象商品の売上合計額（GMV）を計算し、テキストで提出");
    expect(page).not.toContain("公式LINEへ");
    expect(page).not.toContain("ランキングへ反映");
    expect(page).toContain("集計結果へ反映");
  });

  it("shows the v3 layouts without restoring T1–T4 reservation access", () => {
    expect(page).toContain("LIVE配信ブースの予約対象はT13〜T24です。");
    expect(page).toContain("T1〜T4はLIVE配信専用設備ではないため、予約対象外です。");
  });

  it("links to the existing LCF home, mypage and live-streaming reservation", () => {
    expect(page).toContain('href="/livecommercefestival/2026"');
    expect(page).toContain('href="/lcf/mypage"');
    expect(page).toContain('href="/lcf/booth-reservation"');
    expect(page).toContain("LIVE配信ブース予約");
  });
});
