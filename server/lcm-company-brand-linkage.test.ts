import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLcmCatalogBrandPages,
  getLcmCatalogCompanyBrands,
  getLcmCatalogIdentity,
  normalizeLcmCatalogName,
} from "../shared/lcmCatalogDirectory";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("LCM company, brand and product linkage", () => {
  it("keeps company, brand and product identities separate", () => {
    expect(getLcmCatalogIdentity(6)).toMatchObject({
      companyName: "アジア国際貿易株式会社",
      brandName: "CHEYENNE",
      primaryBrandPage: 6,
    });
    expect(getLcmCatalogBrandPages(22)).toEqual([22, 23]);
    expect(getLcmCatalogCompanyBrands("アジア国際貿易株式会社").map((item) => item.primaryBrandPage)).toEqual([6, 7]);
    expect(normalizeLcmCatalogName("ＣＨＥＹＥＮＮＥ")).toBe("cheyenne");
  });

  it("offers one search for company, brand and product names", () => {
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(manage).toContain("既存の会社・ブランドと連携する");
    expect(manage).toContain("会社名・ブランド名・商品名で検索");
    expect(manage).toContain("この会社と仮連携");
    expect(manage).toContain("このブランドと仮連携");
    expect(manage).toContain('role="link" tabIndex={0}');
    expect(manage).toContain("カードをタップすると掲載実績を確認できます");
    expect(manage).toContain("新しい会社・ブランドを登録");
  });

  it("validates catalog selections on the server and groups company reviews", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    expect(router).toContain("claimCatalogSelection: lcmMemberProcedure");
    expect(router).toContain('scope: z.enum(["brand", "company"])');
    expect(router).toContain("getLcmCatalogCompanyBrands(identity.companyName)");
    expect(router).toContain("reviewCompanyBrandClaims: lcmAdminProcedure");
    expect(router).toContain("const claims = await db.transaction(async (tx: any) =>");
    expect(router).toContain("await writeAudit({");
    expect(router).toContain("}, tx);");
    expect(admin).toContain("会社単位で正式承認");
    expect(admin).toContain("会社単位で却下");
    expect(admin).toContain("会社単位で停止");
  });

  it("grants draft-only provisional access and keeps important operations behind formal approval", () => {
    const router = read("server/lcmRouter.ts");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(router).toContain("async function requireDraftBrandMember");
    expect(router).toContain('inArray(lcmBrandMembers.status, ["pending", "active"])');
    expect(router).toContain('action: "provisional_access_granted"');
    expect(router).toContain("await requireDraftBrandMember(ctx.lcmAccount.accountId, input.brandId)");
    expect(router).toContain("await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId)");
    expect(router).toContain("この操作は運営の正式承認後に利用できます");
    expect(manage).toContain("仮連携中・下書き編集可");
    expect(manage).toContain("正式承認後に提出可能");
    expect(manage).toContain("setSelectedBrandId(data.selectedBrandId || null)");
  });

  it("lets LCM operations formally approve, reject, or stop provisional access", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    const lcfAdmin = read("client/src/pages/LcfAdmin.tsx");
    expect(router).toContain('status: z.enum(["active", "rejected", "revoked"])');
    expect(router).toContain('"formally_approved"');
    expect(router).toContain('"provisional_rejected"');
    expect(router).toContain('"access_revoked"');
    expect(admin).toContain("ブランド仮連携・管理権限");
    expect(admin).toContain("正式承認");
    expect(admin).toContain("仮連携を却下");
    expect(admin).toContain("権限を停止");
    expect(lcfAdmin).toContain("/lcm/admin?tab=claims");
  });

  it("starts linked LCF accounts without the old blocking membership form", () => {
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(manage).toContain("LinkedMembershipQuickStart");
    expect(manage).toContain("会社名や氏名の再入力は必要ありません");
    expect(manage).toContain("既存企業との連携申請");
    expect(manage).not.toContain("setAutoMembershipStarted(true)");
    expect(manage).not.toContain("マイページを準備しています");
  });
});
