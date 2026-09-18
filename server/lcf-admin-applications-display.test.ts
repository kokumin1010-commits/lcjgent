import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getApplicationDepartment,
  getSafeApplicationLink,
} from "../client/src/lib/lcfApplicationDisplay";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("LCF申込管理の全開催回・全文カード・安全なメール導線", () => {
  it("文字列内のHTTPS URLだけを安全な外部リンクとして抽出する", () => {
    expect(getSafeApplicationLink("https://www.tiktok.com/@creator")).toMatchObject({
      href: "https://www.tiktok.com/@creator",
    });
    expect(getSafeApplicationLink("Larkで確認: https://www.larksuite.com/invitation/page/add_contact/?token=abc")).toMatchObject({
      href: "https://www.larksuite.com/invitation/page/add_contact/?token=abc",
    });
    expect(getSafeApplicationLink("http://example.com")).toBeNull();
    expect(getSafeApplicationLink("javascript:alert(1)")).toBeNull();
    expect(getSafeApplicationLink("TikTok @sample_creator")).toBeNull();
  });

  it("申込種別ごとに正しい部署項目を返す", () => {
    expect(getApplicationDepartment("company", { contactDepartment: "ブランド事業部" })).toBe("ブランド事業部");
    expect(getApplicationDepartment("general", { department: "メディア" })).toBe("メディア");
    expect(getApplicationDepartment("liver", { department: "対象外" })).toBe("");
  });

  it("横スクロール式テーブルを使わず、カード内で全文とURLを折り返す", () => {
    const page = read("client/src/pages/LcfAdmin.tsx");
    expect(page).not.toContain('className="w-full overflow-x-auto"');
    expect(page).not.toContain('"min-w-[1900px]" : "min-w-[2200px]"');
    expect(page).not.toContain("line-clamp-2");
    expect(page).toContain("sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6");
    expect(page).toContain("<ApplicationInfo");
    expect(page).toContain("function ApplicationText");
    expect(page).toContain("getSafeApplicationLink(displayValue)");
    expect(page).toContain('target="_blank"');
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain('referrerPolicy="no-referrer"');
    expect(page).toContain("<ApplicationText value={item.lineOrLark} />");
    expect(page).toContain("<ApplicationText value={item.accountInfo} missingLabel=\"未復旧\" />");
    expect(page).toContain('<ApplicationText value={(item.visitPurposes || []).join(", ")} />');
  });

  it("第1回・第2回・すべてを選択し、開催回を明示してCSVにも正しく出力する", () => {
    const page = read("client/src/pages/LcfAdmin.tsx");
    expect(page).toContain('type ApplicationEventFilter = ApplicationEventYear | "all"');
    expect(page).toContain('<SelectItem value="all">すべての開催回</SelectItem>');
    expect(page).toContain('firstEditionCompany = trpc.festival.listCompany.useQuery({ eventYear: "2026" })');
    expect(page).toContain('secondEditionCompany = trpc.festival.listCompany.useQuery({ eventYear: "2026-02" })');
    expect(page).toContain('return [...(second || []), ...(first || [])]');
    expect(page).toContain('key={`${item.eventYear}-${item.id}`}');
    expect(page).toContain("getApplicationEditionLabel(item.eventYear)");
    expect(page).toContain('eventYear === "all" ? "all"');
    expect(page).toContain("exportEventYear(d)");
  });

  it("部署フィルターを検索・開催回・状態・アカウント条件と併用する", () => {
    const page = read("client/src/pages/LcfAdmin.tsx");
    expect(page).toContain('const [departmentFilter, setDepartmentFilter] = useState("all")');
    expect(page).toContain('departmentFilter === "__missing__"');
    expect(page).toContain("department === departmentFilter");
    expect(page).toContain('activeTab !== "liver"');
    expect(page).toContain('<SelectItem value="all">部署：全て</SelectItem>');
    expect(page).toContain('<SelectItem value="__missing__">部署：未設定</SelectItem>');
    expect(page).toContain("氏名・会社・部署・URL・来場目的などを検索...");
    expect(page).toContain('<SelectItem value="2026-02">第2回｜2026年12月</SelectItem>');
    expect(page).toContain('<SelectItem value="2026">第1回｜2026年9月</SelectItem>');
    expect(page).toContain("CSV出力");
  });

  it("各申込からLCJ Mallメールセンターへ宛先を引継ぎ、LCF送信元で確認後に送れる", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const management = read("client/src/pages/RecruitmentManagement.tsx");
    const email = read("client/src/pages/RecruitmentEmail.tsx");
    const router = read("server/emailRouter.ts");
    expect(admin).toContain('https://lcjmall.com/master/recruitment?tab=email');
    expect(admin).toContain('source: "lcf_applications"');
    expect(admin).toContain("LCFメール作成");
    expect(management).toContain('fragment.get("source") !== "lcf_applications"');
    expect(management).toContain("<RecruitmentEmail initialCompose={initialEmailCompose} />");
    expect(email).toContain('sender?: "default" | "lcf"');
    expect(email).toContain('LIVE COMMERCE FESTIVAL <LCF@livecommercejapan.jp>');
    expect(email).toContain("window.confirm");
    expect(email).toContain("sender: composeSender");
    expect(router).toContain('sender: z.enum(["default", "lcf"]).default("default")');
    expect(router).toContain('const fromAddress = isLcfSender ? "LCF@livecommercejapan.jp" : ENV.emailUser');
    expect(router).toContain("mailOptions.envelope = { from: ENV.emailUser, to: envelopeRecipients }");
  });
});
