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
const server = read("server/_core/index.ts");

describe("LCF second-edition official page", () => {
  it("keeps short and legacy routes without changing the first-edition archive", () => {
    expect(app).toContain('const LcfSecondEdition = lazy(() => import("./pages/LcfSecondEdition"))');
    expect(app).toContain('<Route path="/2nd" component={LcfSecondEdition} />');
    expect(app).toContain('<Route path="/livecommercefestival/2nd" component={LcfSecondEdition} />');
    expect(app).toContain('<Route path="/2026" component={LiveCommerceFestival} />');
    expect(app).toContain('<Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />');
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

  it("labels generated interiors and uses the yearless yellow fascia", () => {
    expect(page).toContain("ObKwxbjDEhLNvGry.jpg");
    expect(page).toContain("nKtCVJQpUiElkcWi.jpg");
    expect(page).toContain("ffORXTavLEVGMmDT.jpg");
    expect(page.match(/会場完成予想イメージ/g)?.length).toBeGreaterThanOrEqual(4);
    expect(page).toContain("<LcfFascia");
    expect(page).toContain("この黄色が、");
  });

  it("uses the limited Japan-first claim with the disclosed research footnote", () => {
    expect(page).toContain("日本初※");
    expect(page).toContain("マッチング×セミナー型");
    expect(page).toContain("2026年8月の第1回開催発表時点における自社調べ");
    expect(page).toContain("直接マッチング、実践セミナー、商品体験および会場からのライブ販売");
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
    expect(router).toContain("COALESCE(applications.eventYear, '2026') AS eventYear");
    expect(router).toContain("isLcfEventYear(rawEventYear)");
    expect(mypage).toContain("item.eventYear === ticket.eventYear");
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
    expect(server).not.toMatch(/70ブース|70のライブ対応ブース|1,500㎡/);
  });
});
