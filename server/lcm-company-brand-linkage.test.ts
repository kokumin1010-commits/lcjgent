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
    expect(manage).toContain("公式LINEで新規登録を申請");
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
    expect(admin).toContain("会社単位で権限確認");
    expect(admin).toContain("会社単位で却下");
    expect(admin).toContain("会社単位で停止");
  });

  it("keeps pending claims read-only, hides rejected access, and enables operations only after confirmation", () => {
    const router = read("server/lcmRouter.ts");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(router).not.toContain("async function requireDraftBrandMember");
    expect(router).toContain('inArray(lcmBrandMembers.status, ["pending", "active"])');
    expect(router).toContain('action: "management_claim_requested"');
    expect(router).toContain('operationsEnabled: false');
    expect(router).toContain("await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId)");
    expect(router).toContain("この操作には有効なブランド管理権限が必要です");
    const listMyBrands = router.slice(router.indexOf("listMyBrands:"), router.indexOf("getManageBrand:"));
    expect(listMyBrands).toContain('inArray(lcmBrandMembers.status, ["pending", "active"])');
    expect(listMyBrands).not.toMatch(/rejected|revoked/);
    const guardedOperations = ["getManageBrand:", "updateBrand:", "submitBrand:", "createProduct:", "updateProduct:", "submitProduct:", "unpublishProduct:", "uploadImage:"];
    for (const [index, operation] of guardedOperations.entries()) {
      const start = router.indexOf(operation);
      const nextOperation = guardedOperations[index + 1] || "createSampleRequest:";
      const end = router.indexOf(nextOperation, start + operation.length);
      expect(router.slice(start, end)).toContain("requireActiveBrandMember");
    }
    expect(router).toContain('["rejected", "revoked"].includes(current.status)');
    expect(router).toContain("このブランドの管理申請は運営判断により利用できません");
    expect(manage).toContain("あなたが管理してるブランド");
    expect(manage).not.toContain("管理権限確認済みのブランド");
    expect(manage).toContain("運営確認中・操作不可");
    expect(manage).toContain("承認後に操作できます");
    expect(manage).not.toContain("仮連携中・下書き編集可");
  });

  it("lets LCM operations formally approve, reject, or stop provisional access", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    const lcfAdmin = read("client/src/pages/LcfAdmin.tsx");
    expect(router).toContain('status: z.enum(["active", "rejected", "revoked"])');
    expect(router).toContain('"formally_approved"');
    expect(router).toContain('"provisional_rejected"');
    expect(router).toContain('"access_revoked"');
    expect(admin).toContain("ブランド管理権限（ブランド公開とは別）");
    expect(admin).toContain("管理権限を確認");
    expect(admin).toContain("仮連携を却下");
    expect(admin).toContain("権限を停止");
    expect(lcfAdmin).toContain("/lcm/admin?tab=claims");
  });

  it("starts linked LCF accounts without the old blocking membership form", () => {
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(manage).toContain("LinkedMembershipQuickStart");
    expect(manage).toContain("会社名や氏名の再入力は必要ありません");
    expect(manage).toContain("ブランド検索・管理権限申請・商品管理");
    expect(manage).not.toContain("setAutoMembershipStarted(true)");
    expect(manage).not.toContain("マイページを準備しています");
  });
});
