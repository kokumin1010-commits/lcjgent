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
    expect(manage).toContain("この会社と連携申請");
    expect(manage).toContain("このブランドと連携");
    expect(manage).toContain("編集権限は運営確認後に有効になります");
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
    expect(admin).toContain("会社単位で一括承認");
    expect(admin).toContain("会社単位で一括見送り");
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
