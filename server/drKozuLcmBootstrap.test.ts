import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DRKOZU_LCM_ACCOUNT_EMAIL,
  DRKOZU_LCM_BOOTSTRAP_KEY,
  DRKOZU_LCM_PRODUCTS,
  verifyDrKozuLcmSources,
} from "./drKozuLcmBootstrap";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Dr.Kozu normal LCM brand bootstrap", () => {
  it("pins the authorized source PDF and all committed brand/product visuals", async () => {
    await expect(verifyDrKozuLcmSources()).resolves.toBeUndefined();
    const pdf = readFileSync(resolve(process.cwd(), "server/recoveryData/Dr.Kozu_Brand_Book_JP_2026_v5.pdf"));
    expect(pdf.length).toBe(8_293_906);
    expect(createHash("sha256").update(pdf).digest("hex")).toBe("d390b78a9afa81c7e53452abfa4d771ddbca1a5f3ebfa048db1280a6dd9de509");
    for (const page of DRKOZU_LCM_PRODUCTS.map((product) => product.page)) {
      expect(statSync(resolve(process.cwd(), `client/public/lcm/drkozu/p${page}-product.webp`)).size).toBeGreaterThan(5_000);
    }
  });

  it("seeds eleven traceable catalogue products without inventing commerce terms", () => {
    expect(DRKOZU_LCM_PRODUCTS).toHaveLength(11);
    expect(DRKOZU_LCM_PRODUCTS.map((product) => product.page)).toEqual([14, 18, 22, 23, 28, 32, 36, 40, 43, 44, 45]);
    expect(DRKOZU_LCM_PRODUCTS.find((product) => product.name === "バランスジェル")?.summary).not.toMatch(/\d+(mL|g)/);
    expect(DRKOZU_LCM_PRODUCTS.find((product) => product.name === "リペアセラム")?.prohibitedClaims).toContain("ボトックスと同等");
    for (const product of DRKOZU_LCM_PRODUCTS) {
      expect(product.summary.length).toBeGreaterThan(20);
      expect(product.prohibitedClaims.length).toBeGreaterThan(20);
      expect(product.listPrice).toBeGreaterThan(0);
    }
  });

  it("uses an ordinary company account and existing LCM ownership boundaries", () => {
    const source = read("server/drKozuLcmBootstrap.ts");
    const startup = read("server/_core/index.ts");
    expect(DRKOZU_LCM_BOOTSTRAP_KEY).toBe("drkozu-lcm-normal-brand-2026-v1");
    expect(DRKOZU_LCM_ACCOUNT_EMAIL).toMatch(/^drkozu-lcm-[a-z0-9]{10}@livecommercefestival\.com$/);
    expect(source).toContain("'company','applicant'");
    expect(source).toContain("'owner','active'");
    expect(source).toContain("'published','claimed'");
    expect(source).toContain("sourceCatalogPage=?");
    expect(source).toContain("DRKOZU_LCM_EXISTING_BRAND_ALREADY_OWNED");
    expect(source).toContain("DRKOZU_LCM_EXISTING_BRAND_REQUIRES_ADMIN_RECONCILIATION");
    expect(source).toContain("DRKOZU_LCM_ACCOUNT_COLLISION");
    expect(source).not.toContain("UPDATE lcm_brand_profiles SET");
    expect(source).toContain("GET_LOCK");
    expect(source).toContain("RELEASE_LOCK");
    expect(source).toContain("beginTransaction");
    expect(source).toContain("rollback");
    expect(source).toContain("lcm_content_bootstrap_runs");
    expect(source).toContain("system_bootstrap_created");
    expect(source).toContain("lcm_brand_event_participations");
    expect(source).toContain("activeOwnerCount");
    expect(source).toContain("conflictingMemberCount");
    expect(source).toContain("credentialLogged: false");
    expect(source).toContain("safeBootstrapFailureCode");
    expect(source).toContain("getDrKozuLcmBootstrapHealth");
    expect(startup).toContain('/api/health/drkozu-lcm-bootstrap');
    expect(source).not.toContain("password: ");
    expect(source).not.toContain("sampleAvailable: true");
    expect(source).not.toMatch(/wholesalePrice:\s*[1-9]/);
    expect(startup.indexOf("await runLcmMarketplaceUpgradeSetup()")).toBeLessThan(startup.indexOf("bootstrapDrKozuLcmBrand()"));
  });

  it("keeps Dr.Kozu on the normal dynamic LCM pages without a privileged public route", () => {
    const app = read("client/src/App.tsx");
    const market = read("client/src/pages/LcmMarket.tsx");
    const brand = read("client/src/pages/LcmBrand.tsx");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(app).not.toMatch(/path=["'][^"']*dr.?kozu/i);
    expect(market).toContain("listPublicProducts");
    expect(brand).toContain("getPublicBrand");
    expect(manage).toContain("getManageBrand");
  });

  it("shows a unified clickable member record in LCM admin without a separate member database", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    expect(router).toContain("adminMemberDetail: lcmAdminProcedure");
    expect(router).toContain("innerJoin(festivalAccounts");
    expect(router).toContain("eq(lcmMemberships.id, input.membershipId)");
    expect(router).toContain("festivalActivityLogs.accountId");
    expect(router).toContain("lcmAuditLogs.actorAccountId");
    expect(admin).toContain("LCM会員管理｜共通会員DB");
    expect(admin).toContain("クリックして会員詳細を見る");
    expect(admin).toContain("LCF Account＋LCM Membership");
    expect(admin).toContain("adminMemberDetail.useQuery");
    expect(admin).not.toContain("passwordHash");
  });
});
