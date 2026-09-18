import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateActualSales,
  createEmptyStoreDailyReportPayload,
  diffStoreDailyReportPayload,
  formatStoreDailyOwnerItemsText,
  missingStoreDailyCoreFields,
  normalizeStoreDailyReportPayload,
  parseStoreDailyOwnerItemsText,
  STORE_DAILY_REPORT_LIST_ITEM_LIMIT,
  STORE_DAILY_REPORT_LONG_TEXT_LIMIT,
} from "../shared/storeBusiness";
import {
  mergeAutomaticCore,
  resolveStoreDailyReportPermissions,
  storeDailyReportPayloadSchema,
} from "./storeDailyReportRouter";

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

  it("always restores automatic metrics while preserving independently entered report fields", () => {
    const input = normalizeStoreDailyReportPayload({
      core: { totalGmv: 999, refundAmount: 999, adSpend: 999 },
      execution: { issuesRisks: "合成风险记录" },
    });
    const automatic = {
      core: {
        totalGmv: 1200,
        actualSales: 1100,
        refundAmount: 100,
        adSpend: 80,
        creatorOutreach: null,
        creatorContactCount: null,
        creatorReplies: null,
        creatorCollaborations: null,
      },
      metricMeta: {},
    } as any;
    automatic.businessAttributedSales = {
      entries: [{ attributionId: 1, staffId: 42, staffName: "合成员工", amount: 1200, currency: "JPY", entryType: "credit", sourceType: "order", sourceId: "synthetic-order", reliability: "admin_confirmed" }],
      totalsByCurrency: [{ currency: "JPY", amount: 1200, entryCount: 1 }],
      confirmedCount: 1,
      unattributedContractCount: 2,
      attributionRule: "synthetic rule",
      totalGmvAllocated: false,
      livestreamGmvAllocated: false,
      readOnly: true,
    };
    input.businessAttributedSales.entries = [{ attributionId: 99, staffId: 99, staffName: "伪造", amount: 999999, currency: "JPY", entryType: "credit", sourceType: "manual_confirmed", sourceId: "forged", reliability: "client" }];
    const merged = mergeAutomaticCore(input, automatic);
    expect(merged.core).toEqual(automatic.core);
    expect(merged.businessAttributedSales).toEqual(automatic.businessAttributedSales);
    expect(merged.businessAttributedSales.totalGmvAllocated).toBe(false);
    expect(merged.businessAttributedSales.livestreamGmvAllocated).toBe(false);
    expect(merged.execution.issuesRisks).toBe("合成风险记录");
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

  it("keeps free-form owner-item input stable instead of injecting delimiters while typing", () => {
    const chineseTitle = "跟进达人回复";
    expect(
      formatStoreDailyOwnerItemsText(
        parseStoreDailyOwnerItemsText(chineseTitle)
      )
    ).toBe(chineseTitle);

    const complete = "确认寄样|郑林|2026-09-19|high";
    expect(
      formatStoreDailyOwnerItemsText(parseStoreDailyOwnerItemsText(complete))
    ).toBe(complete);

    expect(
      formatStoreDailyOwnerItemsText(
        parseStoreDailyOwnerItemsText("无需补默认优先级")
      )
    ).not.toContain("|||medium");
  });

  it("lets every authenticated employee edit while restricting destructive deletion", () => {
    expect(resolveStoreDailyReportPermissions({
      isSuperAdmin: false,
      staffId: 101,
      operatorIds: [202],
    })).toEqual({ canEdit: true, canDelete: false });
    expect(resolveStoreDailyReportPermissions({
      isSuperAdmin: false,
      staffId: 202,
      operatorIds: [202],
    })).toEqual({ canEdit: true, canDelete: true });
    expect(resolveStoreDailyReportPermissions({
      isSuperAdmin: true,
      staffId: null,
      operatorIds: [],
    })).toEqual({ canEdit: true, canDelete: true });
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
  const salesAttributionService = readFileSync(
    "server/performanceBusinessSalesService.ts",
    "utf8"
  );

  it("adds stable brand/store links and backup-gated idempotent collaborative report tables", () => {
    expect(schema).toContain("storeDailyMasterReports");
    expect(schema).toContain("storeDailyMasterReportVersions");
    expect(schema).toContain("storeDailyMasterReportFieldAudits");
    expect(schema).toMatch(/storeId:\s*int\("storeId"\)/);
    expect(upgrade).toContain("pre-store-business-v3");
    expect(upgrade).toContain("runDatabaseBackup");
    expect(upgrade).toContain("store_daily_master_reports");
    expect(upgrade).toContain("store_daily_master_report_versions");
    expect(upgrade).toContain("store_daily_master_report_field_audits");
    expect(upgrade).toContain("uq_store_daily_master_date");
    expect(upgrade).toContain("uq_store_work_source");
    expect(upgrade).toContain('PRE_REASON = "pre-store-business-v3"');
    expect(upgrade).toContain("reason.length > 32");
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
    expect(businessService).toContain("buildImportedStoreDailyRows");
    expect(businessService).toContain("summarizeImportedStoreDailyRows");
    expect(businessService).toContain("resolveStorePeriodAdMetrics");
    expect(businessService).toContain("importedAdCoverage.count");
    expect(overviewUi).toContain("广告消费总计");
    expect(overviewUi).toContain("广告消费合计");
    expect(overviewUi).toContain("所选月份逐日广告文件合计");
    expect(page).toContain("getDailyShopTrend.invalidate()");
    expect(page).toContain("businessOverview.invalidate()");
  });

  it("enforces daily uniqueness, optimistic locking, immutable versions and field audit", () => {
    expect(dailyRouter).toContain("expectedVersion");
    expect(dailyRouter).toMatch(/code:\s*["']CONFLICT["']/);
    expect(dailyRouter).toContain("FOR UPDATE");
    expect(dailyRouter).toContain("store_daily_master_report_versions");
    expect(dailyRouter).toContain("store_daily_master_report_field_audits");
    expect(dailyRouter).toContain("diffStoreDailyReportPayload");
    expect(dailyRouter).toContain('const status = "submitted" as const');
    expect(dailyRouter).toContain("await syncReportTodos(connection");
    expect(dailyRouter).toContain("日报保存后直接生效，无需确认");
    expect(dailyRouter).not.toContain("核心经营数据尚未完整");
    expect(dailyRouter).toContain(
      "getUserManagementAccess(db, Number(ctx.user.id))"
    );
    expect(dailyRouter).toContain("LOWER(staff.email)=LOWER(users.email)");
    expect(dailyRouter).toContain("operator2Id");
    expect(dailyRouter).toContain("access.isSuperAdmin");
    expect(dailyRouter).toContain("canEdit: true");
    expect(dailyRouter).toContain("canDelete:");
    expect(dailyRouter).toContain("仅本店负责人或超级管理员可以删除店长日报");
    expect(dailyRouter).not.toContain("仅本店负责人或超级管理员可以编辑店长日报");
    const saveEndpoint = dailyRouter.slice(
      dailyRouter.indexOf("save: protectedProcedure"),
      dailyRouter.indexOf("delete: protectedProcedure")
    );
    const deleteEndpoint = dailyRouter.slice(
      dailyRouter.indexOf("delete: protectedProcedure"),
      dailyRouter.indexOf("confirm: protectedProcedure")
    );
    expect(saveEndpoint).not.toContain("requireDelete(access)");
    expect(deleteEndpoint).toContain("requireDelete(access)");
    expect(dailyRouter).not.toContain("仅超级管理员可以确认或重开店长日报");
    expect(executionRouter).toContain("store_daily_master_reports");
    expect(executionRouter).toContain("'submitted' AS status");
    expect(businessService).toContain('if (master) return "submitted"');
  });

  it("soft-deletes collaborative reports without erasing versions or leaving active derived todos", () => {
    for (const field of [
      "deletedAt",
      "deletedById",
      "deletedByName",
      "deleteReason",
    ]) {
      expect(schema).toContain(`${field}:`);
      expect(upgrade).toContain(`\"${field}\"`);
    }
    expect(upgrade).toContain("idx_store_daily_master_active");
    expect(dailyRouter).toContain("delete: protectedProcedure");
    expect(dailyRouter).toContain('"deleted"');
    expect(dailyRouter).toContain('"$lifecycle.deleted"');
    expect(dailyRouter).toContain("GROUP BY reportId,actorId,actorName");
    expect(dailyRouter).toContain("status=IF(status='done','done','cancelled')");
    expect(dailyRouter).toContain("deletedAt=NULL");
    expect(dailyRouter).toContain("deletedAt IS NULL AND reportDate>=?");
    expect(businessService).toContain("reportDate=? AND deletedAt IS NULL");
    expect(executionRouter).toContain(
      "storeId=? AND deletedAt IS NULL AND reportDate>=?"
    );
    expect(dailyUi).toContain("历史版本和编辑记录会保留");
    expect(dailyUi).toContain("全部编辑人");
    expect(dailyUi).toContain("编辑人：${editorNames");
    expect(dailyUi).toContain("editHistoryReport");
    expect(dailyUi).toContain("deleteHistoryReport");
  });

  it("preserves composition text in structured textareas before canonical parsing", () => {
    expect(dailyUi).toContain("draftValue");
    expect(dailyUi).toContain("onCompositionStart");
    expect(dailyUi).toContain("onCompositionEnd");
    expect(dailyUi).toContain("parseStoreDailyOwnerItemsText");
    expect(dailyUi).toContain("formatStoreDailyOwnerItemsText");
    expect(dailyUi).not.toContain("function parseOwnerItems");
  });

  it("supports long-form daily reports without truncating history", () => {
    expect(STORE_DAILY_REPORT_LONG_TEXT_LIMIT).toBe(100_000);
    expect(STORE_DAILY_REPORT_LIST_ITEM_LIMIT).toBe(1_000);

    const maximumLengthPayload = createEmptyStoreDailyReportPayload();
    maximumLengthPayload.execution.issuesRisks = "长".repeat(
      STORE_DAILY_REPORT_LONG_TEXT_LIMIT
    );
    expect(() => storeDailyReportPayloadSchema.parse(maximumLengthPayload)).not.toThrow();

    const overLimitPayload = createEmptyStoreDailyReportPayload();
    overLimitPayload.execution.issuesRisks = "长".repeat(
      STORE_DAILY_REPORT_LONG_TEXT_LIMIT + 1
    );
    expect(() => storeDailyReportPayloadSchema.parse(overLimitPayload)).toThrow();
    expect(dailyRouter).toContain("STORE_DAILY_REPORT_LONG_TEXT_LIMIT");
    expect(dailyRouter).toContain("STORE_DAILY_REPORT_LIST_ITEM_LIMIT");
    expect(dailyRouter).not.toContain("max(20_000)");
    expect(dailyRouter).not.toContain("max(2000)");
    expect(dailyUi).toContain("function LongTextField");
    expect(dailyUi).toContain("maxLength={STORE_DAILY_REPORT_LONG_TEXT_LIMIT}");
    expect(dailyUi).toContain("最多 {STORE_DAILY_REPORT_LONG_TEXT_LIMIT.toLocaleString()} 字");
    expect(dailyUi).toContain("displayedValue.length.toLocaleString()");
  });

  it("shows only confirmed uniquely attributed business sales and never allocates GMV", () => {
    const historical = normalizeStoreDailyReportPayload({
      execution: { issuesRisks: "legacy synthetic report" },
    });
    expect(historical.businessAttributedSales.entries).toEqual([]);
    expect(historical.businessAttributedSales.readOnly).toBe(true);
    expect(dailyRouter).toContain("performance_business_sales_attributions");
    expect(dailyRouter).toContain("attribution.status='confirmed'");
    expect(dailyRouter).toContain("member.isActive='active'");
    expect(dailyRouter).toContain("unattributedContractCount");
    expect(dailyRouter).toContain("totalGmvAllocated: false");
    expect(dailyRouter).toContain("livestreamGmvAllocated: false");
    expect(dailyRouter).not.toMatch(/attribution\.staffId\s*=\s*contract\.createdBy/);
    expect(salesAttributionService).toContain("createdByIgnoredForAttribution: true");
    expect(salesAttributionService).toContain("该成交/合同证据已经归属");
    expect(salesAttributionService).toContain("hasReversal");
    expect(salesAttributionService).toContain("attributionRevision");
    expect(salesAttributionService).toContain("reversesAttributionId");
    expect(salesAttributionService).toContain("activeContractSourceIds");
    expect(salesAttributionService).toContain("reversal.id IS NULL");
    expect(salesAttributionService).not.toContain("credit.sourceId = CAST(contract.id AS CHAR)");
    expect(dailyRouter).toContain("activeContractSourceIds");
    expect(dailyRouter).toContain("reversal.id IS NULL");
    expect(dailyRouter).not.toContain("credit.sourceId=CAST(contract.id AS CHAR)");
    expect(dailyUi).toContain("商务销售额归属（只读）");
    expect(dailyUi).toContain("待管理员归属");
    expect(dailyUi).toContain("店铺总GMV和直播GMV不会按录入人或平均方式分给商务人员");
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
    expect(dailyUi).toContain("自动经营数据");
    expect(dailyUi).toContain("AutomaticMetricCard");
    expect(dailyUi).toContain("保存本区");
    expect(dailyUi).toContain("保存日报");
    expect(dailyUi).toContain("填写 / 保存日报");
    expect(dailyUi).toContain("填写权限：所有登录员工");
    expect(dailyUi).toContain("所有登录员工均可填写");
    expect(dailyUi).toContain("const canDelete = Boolean(reportQuery.data?.canDelete)");
    expect(dailyUi).toContain("已保存并直接生效，不需要确认");
    expect(dailyUi).toContain('type="month"');
    expect(dailyUi).toContain("function reportDateKey");
    expect(dailyUi).toContain('value instanceof Date');
    expect(dailyUi).not.toContain('String(item.periodStart || "").slice(0, 10)');
    expect(dailyUi).toContain("历史日报");
    expect(dailyUi).toContain("当天历史个人日报");
    expect(dailyUi).toContain("版本与字段留痕");
    expect(dailyUi).toContain("当前内容未覆盖服务器版本");
    expect(dailyUi).not.toContain("自动数据调整原因");
    expect(dailyUi).not.toContain("保存草稿");
    expect(dailyUi).not.toContain("提交日报");
    expect(dailyUi).not.toContain("确认并锁定");
  });
});
