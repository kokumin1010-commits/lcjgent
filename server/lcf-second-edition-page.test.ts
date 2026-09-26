import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("client/src/pages/LcfSecondEdition.tsx");
const top = read("client/src/pages/LiveCommerceFestivalTop.tsx");
const mypage = read("client/src/pages/LcfMypage.tsx");
const companyForm = read("client/src/pages/FestivalApplyCompany.tsx");
const liverForm = read("client/src/pages/FestivalApplyLiver.tsx");
const formErrors = read("client/src/lib/lcfApplicationFormErrors.ts");
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
    expect(clientHtml).toContain("path === '/lcf/apply/general' || path === '/livecommercefestival/2026/apply/general'");
    expect(clientHtml).toContain("new URLSearchParams(location.search).get('edition') === '2'");
  });

  it("publishes the confirmed date, venue and concept without a fixed booth count", () => {
    expect(page).toContain("見る展示会から体験する展示会へ。");
    expect(page).not.toContain("見る展示会から、体験する展示会へ。");
    expect(page).not.toContain("見る展示会から、配信して売る展示会へ。");
    expect(server).toContain('const concept = "見る展示会から体験する展示会へ。"');
    expect(server).toContain("const description = `${concept} 第2回LIVE COMMERCE FESTIVAL");
    expect(server).toContain("<p>${escapeHtml(concept)}</p>");
    expect(server).not.toContain("<p>見る展示会から、売る展示会へ。</p>");
    expect(page).toContain("商品と出会い、実際に試し、学び、販売につなげる。");
    expect(page).toContain("企業とライブコマーサーの出会いを、商談だけで終わらせず、実際の販売へとつなげる2日間です。");
    expect(page).not.toContain("商品と出会い、試し、学び、会場から届ける。");
    expect(page).toContain("2026年12月8日（火）");
    expect(page).toContain("12月9日（水）");
    expect(page).toContain("東京都立産業貿易センター");
    expect(page).toContain("浜松町館 2階展示室");
    expect(page).not.toContain("約1,530㎡");
    expect(page).not.toContain("会場公式情報を見る");
    expect(page).not.toContain("https://www.sanbo.metro.tokyo.lg.jp/");
    expect(page).not.toMatch(/70ブース|70 BOOTHS|1,500㎡/);
  });

  it("uses the supplied wording for all five second-edition experiences", () => {
    for (const copy of [
      "企業・ブランドとライブコマーサーが直接出会い、商品の魅力や販売方法について、その場で具体的な商談ができます。",
      "商品を実際に手に取り、試し、商品の特徴や開発背景を知ることで、ライブ配信で伝えるための商品理解を深めます。",
      "ライブコマースの販売ノウハウや成功事例を学び、実際の配信や販売に活かせる知識を身につけます。",
      "会場で出会った商品を、その場から実際にライブ配信。展示や商談だけで終わらず、リアルな販売機会につなげます。",
      "イベント後もLCMを通じて商品発掘や商談を継続。LCFで生まれた出会いを、継続的な販売やビジネスへつなげます。",
    ]) {
      expect(page).toContain(copy);
    }
    expect(page).not.toContain("商品を前に条件や企画を直接話せる出会いの場をつくります。");
    expect(page).not.toContain("次の販売と次回LCFへ循環させます。");
  });

  it("uses the supplied first-edition live-selling photo behind the revised event introduction", () => {
    const hero = page.slice(page.indexOf("function Hero()"), page.indexOf("function OfficialMovie()"));
    const headingIndex = hero.indexOf("見る展示会から体験する展示会へ。");
    const bodyIndex = hero.indexOf("商品と出会い、実際に試し、学び、販売につなげる。");
    const photoIndex = hero.indexOf("src={SELLING_EXPERIENCE_PHOTO.src}");
    const lcmBannerIndex = hero.indexOf("<LcmHeroBanner />");
    expect(page).toContain('const SELLING_EXPERIENCE_PHOTO = {');
    expect(page).toContain("moLmsSukFIiBkAmV.jpg");
    expect(page).toContain("width: 1920");
    expect(page).toContain("height: 1280");
    expect(page).toContain("第1回LIVE COMMERCE FESTIVALで3名のライブコマーサーが商品を紹介している実景");
    expect(page).toContain("src={SELLING_EXPERIENCE_PHOTO.src}");
    expect(page).toContain("width={SELLING_EXPERIENCE_PHOTO.width}");
    expect(page).toContain("height={SELLING_EXPERIENCE_PHOTO.height}");
    expect(hero).toContain('alt=""');
    expect(hero).toContain('aria-hidden="true"');
    expect(hero).toContain("absolute inset-0 -z-20 h-full w-full object-cover object-center");
    expect(hero).toContain("bg-gradient-to-r from-black/92 via-black/72 to-black/42");
    expect(hero).toContain("<span className=\"sr-only\">{SELLING_EXPERIENCE_PHOTO.alt}</span>");
    expect(hero).toContain('loading="eager"');
    expect(hero).toContain('fetchPriority="high"');
    expect(page).toContain("見る展示会から体験する展示会へ。企業とライブコマーサーの直接マッチング");
    expect(photoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeLessThan(headingIndex);
    expect(headingIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(lcmBannerIndex);
  });

  it("keeps the header focused and the application actions visible while scrolling", () => {
    const header = page.slice(page.indexOf("function Header()"), page.indexOf("function ApplicationButtons"));
    expect(page).toContain('const LCF_COLOR_LOGO = {');
    expect(page).toContain("NqiAbWVvlJsEtygb.png");
    expect(header).toContain("src={LCF_COLOR_LOGO.src}");
    expect(header).toContain("width={LCF_COLOR_LOGO.width}");
    expect(header).toContain("height={LCF_COLOR_LOGO.height}");
    expect(header).not.toContain("YEARLESS_LOGO_SVG");
    expect(header).toContain('href="/lcm"');
    expect(header).toContain(">LCM</a>");
    expect(header).toContain("第1回実績");
    expect(header).toContain("マイページ");
    expect(header).not.toContain('href="#experience"');
    expect(header).not.toContain('href="#lcm"');
    expect(header).not.toContain('href="#venue"');
    expect(page).toContain("function StickyApplicationBar()");
    expect(page).toContain("fixed inset-x-0 bottom-0 z-[60]");
    expect(page).toContain("出展申込");
    expect(page).toContain("お問い合わせページへ");
    expect(page).toContain("ライブコマーサー申込");
    expect(page).toContain("一般来場申込");
    expect(page).not.toContain("チャットへ");
    expect(page).not.toContain("ライブコマーサーとして申し込む");
  });

  it("routes every top and sticky application action to its internal edition-two form", () => {
    const buttons = page.slice(page.indexOf("function ApplicationButtons"), page.indexOf("function LcmHeroBanner"));
    const sticky = page.slice(page.indexOf("function StickyApplicationBar"), page.indexOf("export default function"));
    expect(page).not.toContain("LCF_OPEN_CHAT_URL");
    expect(page).not.toContain("line.me/ti/g2/");
    expect(page).not.toContain("チャットへ");
    expect(buttons).toContain("grid-cols-3 gap-1.5 sm:gap-2");
    expect(buttons.match(/min-h-12/g)?.length).toBe(3);
    expect(buttons.match(/sm:min-h-14/g)?.length).toBe(3);
    expect(buttons).toContain('<span className="sm:hidden">ライバー申込</span>');
    expect(buttons).toContain('<span className="sm:hidden">一般申込</span>');
    expect(buttons).toContain('aria-label="出展申込・お問い合わせページへ"');
    expect(buttons).toContain('aria-label="ライブコマーサー申込フォームへ"');
    expect(buttons).toContain('aria-label="一般来場申込フォームへ"');
    expect(buttons).toContain("href={event.applicationCompanyPath}");
    expect(buttons).toContain("href={event.applicationLiverPath}");
    expect(buttons).toContain("href={event.applicationGeneralPath}");
    expect(buttons).toContain("申込フォームへ");
    expect(buttons).not.toContain('target="_blank"');
    expect(sticky).toContain("grid-cols-3");
    expect(sticky).toContain("href={event.applicationCompanyPath}");
    expect(sticky).toContain("href={event.applicationLiverPath}");
    expect(sticky).toContain("href={event.applicationGeneralPath}");
    expect(sticky).not.toContain('target="_blank"');
  });

  it("shows the supplied finished key visual without its duplicate top band and keeps real site CTAs", () => {
    expect(page).toContain("MMteMRKpTWljOHRT.webp");
    expect(page).not.toContain("AnPNzcemGiRReCxl.webp");
    expect(page).not.toContain("ObKwxbjDEhLNvGry.jpg");
    expect(page).toContain("src={HERO_IMAGE}");
    expect(page).toContain('className="-mt-[7.1%] block h-auto w-full"');
    expect(page).toContain("width={2048}");
    expect(page).toContain("height={1745}");
    expect(page).toContain('fetchPriority="high"');
    expect(page).toContain("<ApplicationButtons hero />");
    expect(page.match(/<ApplicationButtons hero \/>/g)?.length).toBe(1);
    expect(page).not.toContain("style={{ backgroundImage: `url(${HERO_IMAGE})` }}");
    expect(page).not.toContain("bg-[length:230%_auto]");
  });

  it("removes the venue concept-image gallery and the unwanted common-sign section", () => {
    expect(page).not.toContain("nKtCVJQpUiElkcWi.jpg");
    expect(page).not.toContain("ffORXTavLEVGMmDT.jpg");
    expect(page).not.toContain("完成予想イメージ");
    expect(page).not.toContain("function VisualStories()");
    expect(page).not.toContain("<VisualStories />");
    expect(page).not.toContain("<LcfFascia");
    expect(page).not.toContain("COMMON SIGN");
    expect(page).not.toContain("function Signage");
    expect(page).not.toContain("YEARLESS_FASCIA_SVG");
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
    expect(page).toContain("ライブコマースが、日本のBtoC市場を変える。");
    expect(page).toContain("第1回LCFで生まれた会場の熱気。ブランドとライブコマーサーの出会い。");
    expect(page).toContain("その熱量と、ここでしか生まれない出会いを、映像でご覧ください。");
    expect(page).toContain("※映像はミュートで再生されます。プレイヤーから音声をオンにしてお楽しみいただけます。");
    expect(page).not.toContain("第2回LCFの空気");
    expect(page).not.toContain("youtube-nocookie.com");
    expect(page).not.toContain("youtube.com/embed");
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
    expect(page).toContain("商品を手に取り、その魅力を言葉で伝える。");
    expect(page).toContain("会場で生まれた熱量とライブコマースの可能性をご覧ください。");
    expect(page).toContain("第1回 LIVE COMMERCE FESTIVAL 集合写真");
    expect(page).toContain('id="edition-one-group-photo"');
    expect(page).toContain("EDITION_ONE_GROUP_PHOTO");
    expect(page).toContain('className="bg-[#090909] px-0 pb-0 pt-0 text-white md:px-6 md:pt-6"');
    expect(page).toContain('className="bg-black px-5 pb-14 pt-0 text-white md:px-10 md:pb-20 md:pt-0"');
  });

  it("overlays the proof heading on the group photo and uses the requested audience stage scene", () => {
    expect(page).toContain('id="edition-one-group-photo" className="relative');
    expect(page).toContain("PROOF FROM EDITION 01");
    expect(page).toContain("第1回の実績が、");
    expect(page).toContain("第2回をつくる。");
    expect(page).toContain("第1回で生まれた企業とライブコマーサーの出会い、実際の販売、そして会場の熱量。");
    expect(page).toContain("absolute inset-0 flex flex-col justify-between");
    expect(page).toContain('id: "D2-209"');
    expect(page).toContain("lSPjZzCAExTglDlY.webp");
    expect(page).toContain('id="edition-one-stage-audience"');
    expect(page).toContain("DAY2 ステージトークと観客");
  });

  it("distributes distinct first-edition official photos as proof across the page", () => {
    for (const id of ["D1-104", "D1-094", "D1-030", "D1-053", "D1-137", "D2-114", "D2-064"]) {
      expect(page).toContain(`lcf2026PhotoById["${id}"]`);
    }
    expect(page).not.toContain('lcf2026PhotoById["D2-035"]');
    expect(page).toContain("第1回の実績が、");
    expect(page).toContain("第1回公式レポートに保存している実景と実績です");
    expect(page.match(/loading="lazy"/g)?.length).toBeGreaterThanOrEqual(8);
    expect(page).not.toContain("第1回DAY2は全セミナープログラムが満席");
  });

  it("removes the redundant next-LCF and beginner-support sections and keeps the remaining sections consecutively numbered", () => {
    expect(page).not.toContain("function Concept");
    expect(page).not.toContain('id="concept"');
    expect(page).not.toContain("THE NEXT LCF");
    expect(page).not.toContain("日本初※");
    expect(page).toContain('href="#experience"');
    expect(page).not.toContain('href="#concept"');
    for (const marker of ["01 / SELLING EXPERIENCE", "02 / ALWAYS-ON MARKET", "03 / HAMAMATSUCHO"]) {
      expect(page).toContain(marker);
    }
    expect(page).not.toContain("03 / BEGINNER SUPPORT");
    expect(page).not.toContain("04 / HAMAMATSUCHO");
    expect(page).not.toContain("function FinalCta");
    expect(page).not.toContain("JOIN THE FLOOR");
    expect(page).not.toContain("見る側から、");
    expect(page).toContain("function StickyApplicationBar");
  });

  it("removes the entire beginner-support presentation while preserving first-edition application compatibility", () => {
    expect(page).not.toContain("function BeginnerSupport()");
    expect(page).not.toContain("<BeginnerSupport />");
    expect(page).not.toContain('id="beginner-support"');
    expect(page).not.toContain("初めてでも、");
    expect(page).not.toContain("会場から配信できる。");
    expect(page).not.toContain("未経験・これから始めたい方も対象");
    expect(page).not.toContain("セミナーコンテンツ（予定）");
    expect(page).not.toContain("EDITION 01 / FULL HOUSE");
    expect(server).not.toContain("<h2>初めてでも、会場から配信できる。</h2>");
    expect(server).not.toContain("ライブコマース初心者、未経験、これから始めたい方も申込対象です。");
    expect(liverForm).toContain("filterLiverApplicationSteps(event.edition, detailSteps)");
    expect(liverForm).toContain("beginnerSupport: (answers.beginnerSupport as 'yes' | 'no') || 'no'");
    expect(router).toContain('beginnerSupport: z.enum(["yes", "no"]).default("no")');
    expect(router).toContain("第2回LCF：ライブコマース初心者サポート希望");
  });

  it("links the live-commercer completion screen to the official LINE OpenChat", () => {
    const submittedStart = liverForm.indexOf("if (submitted)");
    const submittedEnd = liverForm.indexOf("const currentStepData", submittedStart);
    const submittedCompletion = liverForm.slice(submittedStart, submittedEnd);
    expect(liverForm).toContain("const LCF_OPEN_CHAT_URL = 'https://line.me/ti/g2/KsS3Ma1HW3okfwI2OowM6Ubk0UHKOHmb3nZFhA");
    expect(liverForm.slice(0, submittedStart)).not.toContain("LINEオープンチャットに参加する");
    expect(submittedCompletion).toContain("参加者LINEオープンチャット");
    expect(submittedCompletion).toContain("LINEオープンチャットに参加する");
    expect(submittedCompletion).toContain("href={LCF_OPEN_CHAT_URL}");
    expect(submittedCompletion).toContain('target="_blank"');
    expect(submittedCompletion).toContain('rel="noopener noreferrer"');
    expect(submittedCompletion).toContain("min-h-12 w-full");
    expect(submittedCompletion).toContain("bg-[#007A34]");
    expect(submittedCompletion.indexOf("事前マッチング等の詳細は後日ご連絡いたします")).toBeLessThan(submittedCompletion.indexOf("参加者LINEオープンチャット"));
    expect(submittedCompletion.indexOf("参加者LINEオープンチャット")).toBeLessThan(submittedCompletion.indexOf("アカウントが作成されました"));
    expect(liverForm.slice(submittedEnd)).not.toContain("LINEオープンチャットに参加する");
  });

  it("invites brands and live commercers into the always-on LCM market", () => {
    expect(page).toContain("メーカー事前マッチングはこちらから");
    expect(page).toContain("LCF開催前に、出展メーカーの商品情報を確認し、ライブ配信したい商品を探すことができます");
    expect(page).toContain("サンプルや配信条件について相談できます");
    expect(page).toContain("sivJnwYjdZtRGkJL.webp");
    expect(page).toContain("LCMで公開商品やブランドを探せる実際の商品探索画面");
    expect(page).toContain("事前マッチングはこちらから");
    expect(page).not.toContain("LCMとは？");
    expect(page).not.toContain(">商品を探す<");
    expect(page).not.toContain(">事前マッチングについて<");
    expect(page).toContain('id="lcm"');
    expect(page).toContain("LCFの2日を、");
    expect(page).toContain("毎日の商談へ。");
    expect(page).toContain("第2回LCFの開催前・当日・開催後をつなぐ、常設のライブコマースマーケットです。");
    expect(page).toContain("LCFの2日間を、日常の商談へ。");
    expect(page).toContain("ブランドが商品情報を掲載し、ライブコマーサーが配信したい商品を探すことができます。");
    expect(page).toContain("商品写真や販売価格などの基本情報は公開され");
    expect(page).toContain("イベントの前後も継続的な商品発掘と商談につなげていきます。");
    expect(page).toContain('href="/lcm"');
    expect(page).toContain('href="/lcm/manage?workspace=brand"');
    expect(page).toContain('href="/lcm/manage?workspace=creator"');
    expect(page).toContain("ブランドが商品を登録");
    expect(page).toContain("商品を見つけ、次の配信につなげる。");
    expect(page).toContain("商品を掲載して、販売機会をつくる。");
    expect(page).toContain("配信したい商品を見つける。");
    expect(page).toContain("まずは、どんな商品があるか見てみる。");
    expect(page).toContain("掲載商品を見る");
    expect(page).toContain("LCFとLCMは同じ会員アカウントです");
    expect(page).toContain("ブランドと商品は当面無料で本人が公開でき");
    expect(page).toContain("ライブコマーサー公式プロフィールは公開同意と運営確認後に反映されます");
    expect(page).not.toMatch(/TikTok API連携|売上を自動取得|誰でも即時公開/);
    expect(server).toContain("第1回公式映像とライブ配信・集合写真、GMV8,000万円・販売数23,958点を公開");
    expect(server).toContain("LCMでの継続商談へつなげます");
    expect(server).toContain("LCFの2日間を、日常の商談へ。");
    expect(server).toContain("イベントの前後も継続的な商品発掘と商談につなげていきます。");
    expect(server).toContain('href="${baseUrl}/lcm"');
  });

  it("keeps the venue introduction and map but removes everything from the exterior photo onward", () => {
    expect(page).toContain("function VenueMiniMap()");
    expect(page).toContain("https://www.google.com/maps?q=");
    expect(page).toContain("output=embed&z=16");
    expect(page).toContain('<iframe src={VENUE_MAP_EMBED}');
    expect(page).toContain('mt-6 scroll-mt-20 overflow-hidden');
    expect(page).toContain("〒105-7501 東京都港区海岸1-7-1 東京ポートシティ竹芝");
    expect(page).toContain("東京・浜松町で、");
    expect(page).toContain("JR浜松町駅から徒歩5分、ゆりかもめ竹芝駅から徒歩2分。");
    expect(page).toContain("企業とライブコマーサーが出会い、商品を知り、話し、そしてその場で配信・販売できる空間をつくります。");
    expect(page).not.toContain("cooervvFkHfjnVRF.jpg");
    expect(page).not.toContain("VENUE_EXTERIOR_PHOTO");
    expect(page).not.toContain("東京ポートシティ竹芝 外観");
    expect(page).not.toContain("約1,530㎡");
    expect(page).not.toContain("2階展示室・全室");
    expect(page).not.toContain("天井高");
    expect(page).not.toContain("無柱空間");
    expect(page).not.toContain("フローリング");
    expect(page).not.toContain("最終の出展区画数・配置・設備は");
    expect(page).not.toContain("会場公式情報を見る");
    expect(page).toContain("<footer");
    expect(page).toContain("<StickyApplicationBar />");
  });

  it("aligns the first-edition proof statistics with fixed value, label and note rows", () => {
    expect(page).toContain("flex min-h-56 flex-col");
    expect(page).toContain("flex min-h-20 items-end");
    expect(page).toContain("mt-5 flex min-h-10 items-start");
    expect(page).toContain("mt-auto min-h-8 pt-2");
  });

  it("separates optional-field send and skip controls and returns validation failures to their field", () => {
    for (const form of [companyForm, liverForm]) {
      expect(form).toContain("const handleSkip = () =>");
      expect(form).toContain("!currentStepData?.required && <button type=\"button\" onClick={handleSkip}");
      expect(form).toContain("<Send className=\"h-4 w-4\" />送信");
      expect(form).toContain("parseLcfApplicationFormError(error)");
      expect(form).toContain("setCurrentStep(targetIndex)");
      expect(form).toContain("setInputValue(answers[parsed.fieldId] || '')");
      expect(form).toContain("エラーコード: ${parsed.code}");
      expect(form).toContain("reportApplicationFormIssue.useMutation()");
    }
    expect(formErrors).toContain("function findIssue");
    expect(formErrors).toContain("FIELD_ALIASES");
    expect(router).toContain("reportApplicationFormIssue: publicProcedure");
    expect(router).toContain('action: "application_form_error"');
    expect(admin).toContain('application_form_error: "申込フォームエラー"');
  });

  it("reuses existing forms and allows only the trusted second-edition key", () => {
    expect(definitions).toContain('eventYear: "2026-02"');
    expect(definitions).toContain('applicationCompanyPath: "/lcf/apply/company?edition=2"');
    expect(definitions).toContain('applicationLiverPath: "/lcf/apply/liver?edition=2"');
    expect(definitions).toContain('applicationGeneralPath: "/lcf/apply/general?edition=2"');
    expect(app).toContain('<Route path="/lcf/apply/company" component={FestivalApplyCompany} />');
    expect(app).toContain('<Route path="/lcf/apply/liver" component={FestivalApplyLiver} />');
    expect(app).toContain('<Route path="/lcf/apply/general" component={FestivalApplyGeneral} />');
    expect(companyForm).toContain("edition: event.edition");
    expect(liverForm).toContain("edition: event.edition");
    expect(liverForm).toContain("lcf_liver_form_${event.eventYear}");
    expect(router.match(/edition: z\.union\(\[z\.literal\(1\), z\.literal\(2\)\]\)\.default\(1\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(router).toContain("eq(festivalCompanyApplications.eventYear, event.eventYear)");
    expect(router).toContain("eq(festivalLiverApplications.eventYear, event.eventYear)");
    expect(router).not.toMatch(/submitCompany:[\s\S]{0,1500}eventYear:\s*z\./);
    expect(router).not.toMatch(/submitLiver:[\s\S]{0,1200}eventYear:\s*z\./);
  });

  it("separates admin lists, CSV files and batch ticket emails by edition", () => {
    expect(admin).toContain('useState<ApplicationEventFilter>(initialEventYear)');
    expect(admin).toContain('initialEventYear={adminLocation.applicationEvent}');
    expect(admin).toContain('listCompany.useQuery({ eventYear: "2026" })');
    expect(admin).toContain('listCompany.useQuery({ eventYear: "2026-02" })');
    expect(admin).toContain('<SelectItem value="all">すべての開催回</SelectItem>');
    expect(admin).toContain('value="2026-02">第2回｜2026年12月');
    expect(admin).toContain('filename = `lcf_${eventYear === "all" ? "all" : eventYear.replace("-", "_")}_company_applications.csv`');
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

  it("keeps the top page focused on the hero and current application portal", () => {
    expect(top).toContain('const hero = lcf2026PhotoById["D1-104"]');
    expect(top).toContain("第1回イベントページを見る");
    expect(top).toContain("第2回 お申し込み受付中");
    expect(top).not.toContain("01 / PROVEN IMPACT");
    expect(top).not.toContain("第1回から、");
    expect(top).not.toMatch(/70ブース|70 BOOTHS|1,500㎡/);
  });

  it("publishes canonical SEO, Event JSON-LD and sitemap for /2nd", () => {
    expect(server).toContain('app.get(["/2nd", "/livecommercefestival/2nd"]');
    expect(server).toContain('const pageUrl = `${baseUrl}/2nd`');
    expect(server).toContain("第2回 LIVE COMMERCE FESTIVAL｜2026年12月8日・9日 浜松町館");
    expect(server).toContain('"@type": "Event"');
    expect(server).toContain('startDate: "2026-12-08"');
    expect(server).toContain("<loc>${baseUrl}/2nd</loc>");
    expect(server).toContain("MMteMRKpTWljOHRT.webp");
    expect(server).not.toContain("AnPNzcemGiRReCxl.webp");
    expect(server).not.toMatch(/70ブース|70のライブ対応ブース|1,500㎡/);
  });
});
