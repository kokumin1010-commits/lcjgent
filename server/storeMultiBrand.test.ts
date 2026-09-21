import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildActiveStoreIdsByBrand,
  canUseUnallocatedBrandMetrics,
} from "./storeBrandMetricScope";

const source = (path: string) => readFileSync(path, "utf8");

describe("managed store multi-brand contract", () => {
  const relationService = source("server/storeBrandRelations.ts");
  const managementRouter = source("server/storeManagementRouter.ts");
  const managementPage = source("client/src/pages/StoreManagement.tsx");
  const businessService = source("server/storeBusinessService.ts");
  const businessUpgrade = source("server/storeBusinessUpgrade.ts");
  const overview = source("client/src/components/StoreBusinessOverview.tsx");
  const selection = source("server/storeSelectionProductLinkService.ts");
  const influencer = source("server/influencerBdRouter.ts");
  const influencerPage = source("client/src/pages/InfluencerBd.tsx");
  const dailyReport = source("server/storeDailyReportRouter.ts");
  const performance = source("server/performanceBusinessSalesService.ts");
  const performanceRouter = source("server/performanceRouter.ts");
  const performancePage = source("client/src/pages/PerformanceCenter.tsx");
  const migration = source("drizzle/0153_managed_store_brands.sql");
  const journal = source("drizzle/meta/_journal.json");
  const migrationRunner = source("run-migrations.mjs");

  it("creates an idempotent many-to-many table and backfills every legacy primary brand", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS `managed_store_brands`"
    );
    expect(migration).toContain("PRIMARY KEY (`storeId`, `brandId`)");
    expect(migration).toContain("INSERT IGNORE INTO `managed_store_brands`");
    expect(migration).toContain("SELECT `id`, `brandId`, 1");
    expect(journal).toContain('"tag": "0153_managed_store_brands"');
    expect(migrationRunner).toContain("0153_managed_store_brands.sql");
    expect(relationService).toContain("ensureStoreBrandRelations");
    expect(businessUpgrade).toContain('"managed_store_brands"');
    expect(businessUpgrade).toContain("runDatabaseBackup");
  });

  it("saves the entire selected set transactionally while maintaining one legacy primary brand", () => {
    expect(managementRouter).toContain(
      "brandIds: z.array(z.number().int().positive()).max(200)"
    );
    expect(managementRouter).toContain(
      "replaceStoreBrandLinks(connection, storeId, requestedBrandIds)"
    );
    expect(managementRouter).toContain(
      "replaceStoreBrandLinks(connection, id, requestedBrandIds)"
    );
    expect(relationService).toContain(
      "DELETE FROM managed_store_brands WHERE storeId = ?"
    );
    expect(relationService).toContain(
      "UPDATE managed_stores SET brandId = ? WHERE id = ?"
    );
    expect(managementRouter).toContain("'brandId', 'brandIds'");
    expect(managementRouter).toContain("resolveStoreWriteAccess");
    expect(managementRouter).toContain(
      "if (!writeAccess.canManageAll) denyStoreWrite()"
    );
    expect(managementRouter).toContain(
      "brandSelectionChanged || operatorSelectionChanged"
    );
  });

  it("renders a searchable multi-select with removable selected-brand chips", () => {
    expect(managementPage).toContain("服务品牌（可多选）");
    expect(managementPage).toContain("current.brandIds.includes(brandId)");
    expect(managementPage).toContain("已选择的服务品牌");
    expect(managementPage).toContain("第一个选择会作为旧功能兼容主品牌");
    expect(managementPage).toContain("brandIds: form.brandIds");
  });

  it("groups each store once by its complete brand set and avoids unsafe brand-level fallback", () => {
    expect(businessService).toContain('`brands:${brandIds.join(",")}`');
    expect(businessService).toContain("storeBrandIds.length === 1");
    expect(businessService).toContain("isMultiBrand: brandIds.length > 1");
    expect(businessService).toContain("activeStoreIdsByBrand");
    expect(businessService).toContain(
      "row => !row.storeId && Number(row.brandId || 0) === brandId"
    );
    expect(overview).toContain("已关联 ${brand.brandIds.length} 个服务品牌");
  });

  it("does not reuse unallocated brand metrics when [A] and [A,B] stores coexist", () => {
    const activeStores = buildActiveStoreIdsByBrand([
      { id: 1, brandIds: [10] },
      { id: 2, brandIds: [10, 20] },
      { id: 3, brandIds: [30] },
    ]);

    expect(activeStores.get(10)).toEqual(new Set([1, 2]));
    expect(canUseUnallocatedBrandMetrics([10], activeStores)).toBe(false);
    expect(canUseUnallocatedBrandMetrics([10, 20], activeStores)).toBe(false);
    expect(canUseUnallocatedBrandMetrics([30], activeStores)).toBe(true);
  });

  it("uses every linked brand for product sync while requiring an explicit brand for ambiguous BD and sales writes", () => {
    expect(selection).toContain(
      "sp.brandId IN (${placeholders(brandIds.length)})"
    );
    expect(selection).toContain("brandNames.join");
    expect(influencer).toContain("该店铺关联多个品牌，请明确选择本次推广品牌");
    expect(influencer).toContain("input.storeId === undefined");
    expect(influencerPage).toContain(
      'storeId: row.storeId ? String(row.storeId) : ""'
    );
    expect(influencerPage).toContain(
      "storeId: campaignForm.storeId ? Number(campaignForm.storeId) : null"
    );
    expect(influencerPage).toContain("selectedCampaignStoreBrandIds");
    expect(performance).toContain(
      "该店铺关联多个品牌，请明确选择本次销售所属品牌"
    );
    expect(performanceRouter).toContain(
      "brandId: z.number().int().positive().nullable().optional()"
    );
    expect(performancePage).toContain("明确选择品牌");
  });

  it("keeps store-specific daily metrics and only falls back to brand data for a unique linked brand", () => {
    expect(dailyReport).toContain(
      "const singleBrandId = storeBrandIds.length === 1"
    );
    expect(dailyReport).toContain("allowBrandFallback && singleBrandId");
    expect(dailyReport).toContain("contract.brandId IN (${brandPlaceholders})");
  });
});
