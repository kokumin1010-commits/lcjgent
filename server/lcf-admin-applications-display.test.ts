import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getApplicationDepartment,
  getSafeApplicationLink,
} from "../client/src/lib/lcfApplicationDisplay";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("LCF申込管理の全文表示・安全なリンク・部署検索", () => {
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

  it("一覧で長文を省略せず、URLをクリック可能にする", () => {
    const page = read("client/src/pages/LcfAdmin.tsx");
    expect(page).toContain('className="w-full overflow-x-auto"');
    expect(page).toContain('"min-w-[1900px]" : "min-w-[2200px]"');
    expect(page).not.toContain("line-clamp-2");
    expect(page).toContain("function ApplicationText");
    expect(page).toContain("getSafeApplicationLink(displayValue)");
    expect(page).toContain('target="_blank"');
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain('referrerPolicy="no-referrer"');
    expect(page).toContain("<ApplicationText value={item.lineOrLark} />");
    expect(page).toContain("<ApplicationText value={item.accountInfo} missingLabel=\"未復旧\" />");
    expect(page).toContain('<ApplicationText value={(item.visitPurposes || []).join(", ")} />');
  });

  it("部署フィルターを既存検索・開催回・状態・アカウント条件と併用する", () => {
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
});
