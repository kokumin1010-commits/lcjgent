import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("client/src/pages/LcfSecondEdition.tsx");
const top = read("client/src/pages/LiveCommerceFestivalTop.tsx");
const mypage = read("client/src/pages/LcfMypage.tsx");
const companyForm = read("client/src/pages/FestivalApplyCompany.tsx");
const liverForm = read("client/src/pages/FestivalApplyLiver.tsx");
const admin = read("client/src/pages/LcfAdmin.tsx");
const router = read("server/festivalRouter.ts");
const definitions = read("shared/lcfEventDefinitions.ts");
const app = read("client/src/App.tsx");
const clientHtml = read("client/index.html");
const server = read("server/_core/index.ts");

describe("LCF second-edition official page", () => {
  it("keeps short and legacy routes without changing the first-edition archive", () => {
    expect(app).toContain('const LcfSecondEdition = lazy(() => import("./pages/LcfSecondEdition"))');
    expect(app).toContain('<Route path="/2nd" component={LcfSecondEdition} />');
    expect(app).toContain('<Route path="/livecommercefestival/2nd" component={LcfSecondEdition} />');
    expect(app).toContain('<Route path="/2026" component={LiveCommerceFestival} />');
    expect(app).toContain('<Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />');
  });

  it("shows edition-specific boot copy while the SPA bundle is loading", () => {
    expect(clientHtml).toContain("path === '/2nd' || path === '/livecommercefestival/2nd'");
    expect(clientHtml).toContain("浜松町館で開催する第2回特別ページを読み込んでいます。");
    expect(clientHtml).toContain("path === '/lcf/apply/company'");
    expect(clientHtml).toContain("企業・ブランド向け申込フォームを読み込んでいます。");
    expect(clientHtml).toContain("path === '/lcf/apply/liver'");
    expect(clientHtml).toContain("ライブコマーサー向け申込フォームを読み込んでいます。");
    expect(clientHtml).toContain("path === '/livecommercefestival/2026/apply/general'");
  });

  it("publishes the confirmed date, venue and concept without a fixed booth count", () => {
    expect(page).toContain("見る展示会から、");
    expect(page).toContain("売る展示会へ。");
    expect(page).toContain("2026年12月8日（火）");
    expect(page).toContain("12月9日（水）");
    expect(page).toContain("東京都立産業貿易センター");
    expect(page).toContain("浜松町館 2階展示室");
    expect(page).toContain("約1,530㎡");
    expect(page).not.toMatch(/70ブース|70 BOOTHS|1,500㎡/);
  });

  it("shows the supplied finished key visual without its duplicate top band and keeps real site CTAs", () => {
    expect(page).toContain("AnPNzcemGiRReCxl.webp");
    expect(page).not.toContain("ObKwxbjDEhLNvGry.jpg");
    expect(page).toContain("src={HERO_IMAGE}");
    expect(page).toContain('className="-mt-[7.1%] block h-auto w-full"');
    expect(page).toContain("width={2048}");
    expect(page).toContain("height={1747}");
    expect(page).toContain('fetchPriority="high"');
    expect(page).toContain("<ApplicationButtons hero />");
    expect(page.match(/<ApplicationButtons hero \/>/g)?.length).toBe(1);
    expect(page).not.toContain("style={{ backgroundImage: `url(${HERO_IMAGE})` }}");
    expect(page).not.toContain("bg-[length:230%_auto]");
  });

  it("keeps labelled concept images and the yearless yellow fascia", () => {
    expect(page).toContain("nKtCVJQpUiElkcWi.jpg");
    expect(page).toContain("ffORXTavLEVGMmDT.jpg");
    expect(page.match(/完成予想イメージ/g)?.length).toBeGreaterThanOrEqual(2);
    expect(page).toContain("<LcfFascia");
    expect(page).toContain("この黄色が、");
  });

  it("labels the supplied MP4 as the first-edition official movie without YouTube branding or outbound links", () => {
    expect(page).toContain('const OFFICIAL_MOVIE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QHYaTbQAzawNOpYI.mp4"');
    expect(page).toContain('id="official-movie"');
    expect(page).toContain("<video");
    expect(page).toContain("src={OFFICIAL_MOVIE}");
    expect(page).toContain("autoPlay");
    expect(page).toContain("muted");
    expect(page).toContain("loop");
    expect(page).toContain("playsInline");
    expect(page).toContain("controls");
    expect(page).toContain('preload="metadata"');
    expect(page).toContain("EDITION 01 / OFFICIAL MOVIE");
    expect(page).toContain("第1回公式映像を見る");
    expect(page).toContain("第1回LCFで生まれた会場の熱気");
    expect(page).not.toContain("第2回LCFの空気");
    expect(page).not.toContain("youtube-nocookie.com");
    expect(page).not.toContain("<iframe");
    expect(page).not.toContain("YouTubeで見る");
    expect(page).not.toContain("https://www.youtube.com/watch?v=");
  });

  it("places the supplied first-edition streaming photos and group photo without the empty movie gap", () => {
    for (const asset of ["OzwIxCrBoqVTRYjO.webp", "FhjXJvENBliUYoML.webp", "TRjHSeDffLjxseCh.webp", "zWSHOAymGWjysDJu.webp"]) {
      expect(page).toContain(asset);
    }
    expect(page).toContain("EDITION 01 / LIVE STREAMING");
    expect(page).toContain('id="edition-one-live-streaming"');
    expect(page).toContain("第1回、会場から生まれたライブ配信。");
    expect(page).toContain("第1回 LIVE COMMERCE FESTIVAL 集合写真");
    expect(page).toContain('id="edition-one-group-photo"');
    expect(page).toContain("EDITION_ONE_GROUP_PHOTO");
    expect(page).toContain('className="bg-[#090909] px-0 pb-0 pt-0 text-white md:px-6 md:pt-6"');
    expect(page).toContain('className="bg-black px-5 pb-14 pt-0 text-white md:px-10 md:pb-20 md:pt-0"');
  });

  it("distributes distinct first-edition official photos as proof across the page", () => {
    for (const id of ["D1-104", "D1-094", "D1-030", "D1-053", "D1-056", "D1-137", "D2-114", "D2-035", "D2-064", "D2-187"]) {
      expect(page).toContain(`lcf2026PhotoById["${id}"]`);
    }
    expect(page).toContain("開催した事実が、");
    expect(page).toContain("第1回公式レポートに保存している実景と実績です");
    expect(page.match(/loading="lazy"/g)?.length).toBeGreaterThanOrEqual(8);
    expect(page).toContain("第1回DAY2は全セミナープログラムが満席");
  });

  it("uses the limited Japan-first claim with the disclosed research footnote", () => {
    expect(page).toContain("日本初※");
    expect(page).toContain("マッチング×セミナー型");
    expect(page).toContain("2026年8月の第1回開催発表時点における自社調べ");
    expect(page).toContain("直接マッチング、実践セミナー、商品体験および会場からのライブ販売");
  });

  it("welcomes beginners and explains support through live preparation", () => {
    expect(page).toContain("初めてでも、");
    expect(page).toContain("会場から配信できる。");
    expect(page).toContain("未経験・これから始めたい方も対象");
    expect(page).toContain("初心者講習");
    expect(page).toContain("ブランドとの設定");
    expect(page).toContain("アカウント・商品設定");
    expect(page).toContain("当日の配信準備");
    expect(page).toContain('href="#beginner-support"');
    expect(page).toContain("初めての方も歓迎｜配信準備をサポート");
    expect(page).toContain("プラットフォーム審査、ブランド承認、配信開始、売上を保証するものではありません");
    expect(page).toContain("ライブコマーサー申込へ");
    expect(liverForm).toContain("ライブコマース初心者サポートを希望しますか？");
    expect(liverForm).toContain("beginnerSupport: (answers.beginnerSupport as 'yes' | 'no') || 'no'");
    expect(router).toContain('beginnerSupport: z.enum(["yes", "no"]).default("no")');
    expect(router).toContain("第2回LCF：ライブコマース初心者サポート希望");
    expect(server).toContain("ライブコマース初心者、未経験、これから始めたい方も申込対象です");
  });

  it("invites brands and live commercers into the always-on LCM market", () => {
    expect(page).toContain("LCFは2日間。LCMは毎日。");
    expect(page).toContain('id="lcm"');
    expect(page).toContain("LCFの2日を、");
    expect(page).toContain("毎日の商談へ。");
    expect(page).toContain('href="/lcm"');
    expect(page).toContain('href="/lcm/manage?workspace=brand"');
    expect(page).toContain('href="/lcm/manage?workspace=creator"');
    expect(page).toContain("LCFとLCMは同じ会員アカウントです");
    expect(page).toContain("ブランドと商品は当面無料で本人が公開でき");
    expect(page).toContain("ライブコマーサー公式プロフィールは公開同意と運営確認後に反映されます");
    expect(page).not.toMatch(/TikTok API連携|売上を自動取得|誰でも即時公開/);
    expect(server).toContain("第1回公式映像とライブ配信・集合写真、GMV8,000万円・販売数23,958点を公開");
    expect(server).toContain("LCMでの継続商談へつなげます");
    expect(server).toContain('href="${baseUrl}/lcm"');
  });

  it("reuses existing forms and allows only the trusted second-edition key", () => {
    expect(definitions).toContain('eventYear: "2026-02"');
    expect(definitions).toContain('applicationCompanyPath: "/lcf/apply/company?edition=2"');
    expect(definitions).toContain('applicationLiverPath: "/lcf/apply/liver?edition=2"');
    expect(app).toContain('<Route path="/lcf/apply/company" component={FestivalApplyCompany} />');
    expect(app).toContain('<Route path="/lcf/apply/liver" component={FestivalApplyLiver} />');
    expect(companyForm).toContain("edition: event.edition");
    expect(liverForm).toContain("edition: event.edition");
    expect(liverForm).toContain("lcf_liver_form_${event.eventYear}");
    expect(router.match(/edition: z\.union\(\[z\.literal\(1\), z\.literal\(2\)\]\)\.default\(1\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(router).toContain("eq(festivalCompanyApplications.eventYear, event.eventYear)");
    expect(router).toContain("eq(festivalLiverApplications.eventYear, event.eventYear)");
    expect(router).not.toMatch(/submitCompany:[\s\S]{0,1500}eventYear:\s*z\./);
    expect(router).not.toMatch(/submitLiver:[\s\S]{0,1200}eventYear:\s*z\./);
  });

  it("separates admin lists, CSV files and batch ticket emails by edition", () => {
    expect(admin).toContain('useState<"2026" | "2026-02">("2026-02")');
    expect(admin).toContain("listCompany.useQuery({ eventYear })");
    expect(admin).toContain("listLiver.useQuery({ eventYear })");
    expect(admin).toContain('value="2026-02">第2回｜2026年12月');
    expect(admin).toContain('filename = `lcf_${eventYear.replace("-", "_")}_company_applications.csv`');
    expect(admin).toContain('headers = ["開催回", "開催回キー"');
    expect(router).toContain("sendTicketEmail(app.email, app.name, ticketId, 'company', app.eventYear)");
    expect(router).toContain("sendTicketEmail(app.email, app.name, ticketId, 'liver', app.eventYear)");
  });

  it("adds edition data to QR history while preserving the first edition", () => {
    const editionCenter = read("client/src/components/lcf/LcfEditionApplicationCenter.tsx");
    expect(router).toContain("COALESCE(tickets.eventYear, applications.eventYear, '2026') AS eventYear");
    expect(router).toContain("isLcfEventYear(rawEventYear)");
    expect(editionCenter).toContain('ticket.eventYear === "2026-02"');
    expect(editionCenter).toContain("Number(ticket.applicationId) === Number(application.applicationId)");
    expect(mypage).toContain("item.eventYear === history.eventYear");
    expect(mypage).toContain("第1回の履歴とQRはそのまま残ります");
  });

  it("keeps the top page proof-led and adds only a compact second-edition notice", () => {
    expect(top).toContain('const hero = lcf2026PhotoById["D1-104"]');
    expect(top).toContain("第1回イベントページを見る");
    expect(top).toContain("第2回 LIVE COMMERCE FESTIVAL 開催決定");
    expect(top).toContain("2026.12.08–12.09｜東京都立産業貿易センター浜松町館 2階");
    expect(top).not.toMatch(/70ブース|70 BOOTHS|1,500㎡/);
  });

  it("publishes canonical SEO, Event JSON-LD and sitemap for /2nd", () => {
    expect(server).toContain('app.get(["/2nd", "/livecommercefestival/2nd"]');
    expect(server).toContain('const pageUrl = `${baseUrl}/2nd`');
    expect(server).toContain("第2回 LIVE COMMERCE FESTIVAL｜2026年12月8日・9日 浜松町館");
    expect(server).toContain('"@type": "Event"');
    expect(server).toContain('startDate: "2026-12-08"');
    expect(server).toContain("<loc>${baseUrl}/2nd</loc>");
    expect(server).toContain("AnPNzcemGiRReCxl.webp");
    expect(server).not.toMatch(/70ブース|70のライブ対応ブース|1,500㎡/);
  });
});
