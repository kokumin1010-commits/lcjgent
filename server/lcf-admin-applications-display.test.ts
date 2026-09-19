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

  it("各申込のLCF画面内ポップアップで履歴確認・返信・新規送信を完結する", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const dialog = read("client/src/components/lcf/LcfApplicationEmailDialog.tsx");
    const festivalRouter = read("server/festivalRouter.ts");
    const router = read("server/emailRouter.ts");
    expect(admin).not.toContain("buildLcfMailCenterUrl");
    expect(admin).toContain("<LcfApplicationEmailDialog");
    expect(admin).toContain("LCFメール");
    expect(dialog).toContain("メールのやり取り");
    expect(dialog).toContain("最新メールと届いた返信をバックグラウンド同期中");
    expect(dialog).toContain("届いた返信を画面表示中に自動反映します");
    expect(dialog).toContain("AUTO_REPLY_SYNC_INTERVAL_MS = 15_000");
    expect(dialog).toContain('mode: "auto"');
    expect(dialog).not.toContain("forceRefresh");
    expect(dialog).toContain("このメールに返信");
    expect(dialog).toContain("LCFメールを送信");
    expect(dialog).toContain("LCF@livecommercejapan.jp");
    expect(dialog).toContain("お申し込み内容についてご連絡いたしました。");
    expect(dialog).toContain("このメールへご返信をお願いいたします。");
    expect(dialog).not.toContain("（こちらに具体的なご用件をご入力ください）");
    expect(dialog).toContain("sm:max-w-[1100px]");
    expect(festivalRouter).toContain("lcfEmailThread: festivalAdminProcedure");
    expect(festivalRouter).toContain("syncLcfEmailThread: festivalAdminProcedure");
    expect(festivalRouter).toContain("sendLcfApplicationEmail: festivalAdminProcedure");
    expect(festivalRouter).toContain('action: "send_lcf_email"');
    expect(admin).toContain('send_lcf_email: "LCFメール送信"');
    expect(router).toContain('sender: z.enum(["default", "lcf"]).default("default")');
    expect(router).toContain('if (input.sender === "lcf")');
    expect(router).toContain("sendLcfEmail");
  });

  it("申込管理上部で最近のLCFメール履歴を一覧表示し、相手別のやり取りを開ける", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const dialog = read("client/src/components/lcf/LcfApplicationEmailDialog.tsx");
    const festivalRouter = read("server/festivalRouter.ts");
    const service = read("server/lcfAdminEmailService.ts");
    expect(admin).toContain("メール履歴");
    expect(admin).toContain("<LcfEmailHistoryDialog");
    expect(admin).toContain("openEmailThreadByAddress");
    expect(admin).toContain("xl:grid-cols-4 2xl:grid-cols-");
    expect(dialog).toContain("LCFメール履歴一覧");
    expect(dialog).toContain("最近100件");
    expect(dialog).toContain("手動連絡");
    expect(dialog).toContain("自動配信");
    expect(dialog).toContain("受信返信");
    expect(dialog).toContain("やり取りを開く");
    expect(dialog).toContain("trpc.festival.lcfEmailHistory.useQuery");
    expect(festivalRouter).toContain("lcfEmailHistory: festivalAdminProcedure");
    expect(festivalRouter).toContain("festivalApplicationEmailDeliveries");
    expect(festivalRouter).toContain("LCF入場チケットのご案内");
    expect(service).toContain("listRecentLcfEmailLogs");
    expect(service).toContain('eq(salesEmailLogs.sendType, "lcf_application")');
  });
});
