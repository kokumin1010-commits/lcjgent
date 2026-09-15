import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateActualSales,
  createEmptyStoreDailyReportPayload,
  diffStoreDailyReportPayload,
  missingStoreDailyCoreFields,
  normalizeStoreDailyReportPayload,
} from "../shared/storeBusiness";

describe("store business metric policy", () => {
  it("keeps missing data distinct from a real zero and calculates actual sales without costs", () => {
    const empty = createEmptyStoreDailyReportPayload();
    expect(empty.core.totalGmv).toBeNull();
    expect(empty.core.adSpend).toBeNull();
    expect(missingStoreDailyCoreFields(empty)).toContain("totalGmv");

    const zero = normalizeStoreDailyReportPayload({
      core: {
        totalGmv: 0,
        refundAmount: 0,
        actualSales: 0,
        adSpend: 0,
        creatorOutreach: 0,
        creatorContactCount: 0,
        creatorReplies: 0,
        creatorCollaborations: 0,
      },
    });
    expect(missingStoreDailyCoreFields(zero)).toEqual([]);
    expect(calculateActualSales(125000, 25000)).toBe(100000);
    expect(calculateActualSales(1000, 1500)).toBe(0);
    expect(calculateActualSales(null, 0)).toBeNull();
  });

  it("records field-level changes without treating an unchanged payload as edited", () => {
    const before = normalizeStoreDailyReportPayload({
      core: { totalGmv: 100, refundAmount: 5 },
      execution: { completedItems: ["商品页面更新"] },
    });
    expect(diffStoreDailyReportPayload(before, before)).toEqual([]);
    const after = normalizeStoreDailyReportPayload({
      ...before,
      core: { ...before.core, totalGmv: 120 },
      execution: { ...before.execution, issuesRisks: "库存不足" },
    });
    expect(
      diffStoreDailyReportPayload(before, after).map(item => item.fieldPath)
    ).toEqual(
      expect.arrayContaining(["core.totalGmv", "execution.issuesRisks"])
    );
  });
});

describe("store business platform source contract", () => {
  const schema = readFileSync("drizzle/schema.ts", "utf8");
  const upgrade = readFileSync("server/storeBusinessUpgrade.ts", "utf8");
  const managementRouter = readFileSync(
    "server/storeManagementRouter.ts",
    "utf8"
  );
  const serverEntry = readFileSync("server/_core/index.ts", "utf8");
  const businessService = readFileSync(
    "server/storeBusinessService.ts",
    "utf8"
  );
  const dailyRouter = readFileSync("server/storeDailyReportRouter.ts", "utf8");
  const executionRouter = readFileSync(
    "server/storeExecutionRouter.ts",
    "utf8"
  );
  const adRouter = readFileSync("server/adDashboardRouter.ts", "utf8");
  const influencerRouter = readFileSync("server/influencerBdRouter.ts", "utf8");
  const page = readFileSync("client/src/pages/StoreManagement.tsx", "utf8");
  const overviewUi = readFileSync(
    "client/src/components/StoreBusinessOverview.tsx",
    "utf8"
  );
  const dailyUi = readFileSync(
    "client/src/components/StoreCollaborativeDailyReport.tsx",
    "utf8"
  );

  it("adds stable brand/store links and backup-gated idempotent collaborative report tables", () => {
    expect(schema).toContain("storeDailyMasterReports");
    expect(schema).toContain("storeDailyMasterReportVersions");
    expect(schema).toContain("storeDailyMasterReportFieldAudits");
    expect(schema).toMatch(/storeId:\s*int\("storeId"\)/);
    expect(upgrade).toContain("pre-store-business-command-center-v1");
    expect(upgrade).toContain("runDatabaseBackup");
    expect(upgrade).toContain("store_daily_master_reports");
    expect(upgrade).toContain("store_daily_master_report_versions");
    expect(upgrade).toContain("store_daily_master_report_field_audits");
    expect(upgrade).toContain("uq_store_daily_master_date");
    expect(upgrade).toContain("uq_store_work_source");
    expect(upgrade).toContain("GET_LOCK(?, 600)");
    expect(upgrade).toContain("startStoreBusinessUpgradeSetup");
    expect(serverEntry).toContain("startStoreBusinessUpgradeSetup().catch");
    expect(serverEntry).not.toContain("await runStoreBusinessUpgradeSetup()");
    expect(managementRouter).toContain(
      "await ensureStoreBusinessUpgradeReady()"
    );
    expect(dailyRouter).toContain("await ensureStoreBusinessUpgradeReady()");
  });

  it("requires explicit brand bindings instead of guessing by names", () => {
    expect(managementRouter).toContain("serviceBrands: protectedProcedure");
    expect(managementRouter).toContain("assertServiceBrandExists");
    expect(managementRouter).toContain(
      "brandId: z.number().int().positive().nullable()"
    );
    expect(influencerRouter).toContain("SELECT id,brandId FROM managed_stores");
    expect(influencerRouter).toContain(
      "Number(store.brandId || 0) !== effectiveBrandId"
    );
    expect(influencerRouter).toContain("店铺与服务品牌不一致");
    expect(adRouter).toContain(
      "storeId: z.number().int().positive().nullable().optional()"
    );
  });

  it("separates store GMV from attributed ad GMV and prevents unsupported brand allocation", () => {
    expect(executionRouter).toContain("storeGmv:0");
    expect(executionRouter).toContain("adAttributedGmv:0");
    expect(executionRouter).toMatch(
      /const adRoi\s*=\s*totals\.adSpend>0\s*\?\s*totals\.adAttributedGmv\/totals\.adSpend\s*:\s*null/
    );
    expect(executionRouter).toContain("totals.gmv=totals.storeGmv");
    expect(executionRouter).not.toMatch(
      /totals\.gmv\s*=\s*totals\.storeGmv\s*\+\s*totals\.adAttributedGmv/
    );
    expect(businessService).toContain("COUNT(DISTINCT outreach.creatorId)");
    expect(businessService).toContain(
      "GROUP BY campaign.brandId,campaign.storeId"
    );
    expect(businessService).toContain("storeOutreachRows.length");
    expect(businessService).toContain("brandStores.length === 1");
    expect(businessService).toContain("brandOutreachRows");
    expect(businessService).toMatch(
      /selectedPlanRows\s*=\s*storePlanRows\.length[\s\S]{0,180}brandStores\.length === 1/
    );
  });

  it("enforces daily uniqueness, optimistic locking, immutable versions and field audit", () => {
    expect(dailyRouter).toContain("expectedVersion");
    expect(dailyRouter).toMatch(/code:\s*["']CONFLICT["']/);
    expect(dailyRouter).toContain("FOR UPDATE");
    expect(dailyRouter).toContain("store_daily_master_report_versions");
    expect(dailyRouter).toContain("store_daily_master_report_field_audits");
    expect(dailyRouter).toContain("diffStoreDailyReportPayload");
    expect(dailyRouter).toContain("missingStoreDailyCoreFields");
    expect(dailyRouter).toContain(
      "getUserManagementAccess(db, Number(ctx.user.id))"
    );
    expect(dailyRouter).toContain("LOWER(staff.email)=LOWER(users.email)");
    expect(dailyRouter).toContain("operator2Id");
    expect(dailyRouter).toContain("access.isSuperAdmin");
    expect(dailyRouter).toContain("仅本店负责人或超级管理员可以编辑店长日报");
    expect(dailyRouter).toContain("仅超级管理员可以确认或重开店长日报");
  });

  it("syncs tomorrow work, support requests and risks into idempotent store todos", () => {
    expect(dailyRouter).toContain("daily_report_tomorrow");
    expect(dailyRouter).toContain("daily_report_support");
    expect(dailyRouter).toContain("daily_report_risk");
    expect(dailyRouter).toContain("daily_report_issue");
    expect(dailyRouter).toContain("ON DUPLICATE KEY UPDATE");
    expect(dailyRouter).toContain("status=IF(status='done','done','todo')");
  });

  it("renders required business metrics and exactly five consolidated detail modules", () => {
    for (const label of [
      "总GMV",
      "实际销售额",
      "广告消费",
      "达人建联",
      "今日执行",
      "明日重点",
      "待支持",
    ]) {
      expect(overviewUi).toContain(label);
    }
    for (const label of [
      "经营总览",
      "增长渠道",
      "商品与售后",
      "执行与复盘",
      "数据与设置",
    ]) {
      expect(page).toContain(label);
    }
    expect(page).toContain("StoreCollaborativeDailyReport");
    expect(page).toContain("hideLegacyDaily");
    expect(page).toContain("serviceBrands={serviceBrandsQuery.data || []}");
    expect(dailyUi).toContain("核心经营数据");
    expect(dailyUi).toContain("版本与字段留痕");
    expect(dailyUi).toContain("历史个人日报");
    expect(dailyUi).toContain("当前内容未覆盖服务器版本");
  });
});
