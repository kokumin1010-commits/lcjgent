import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  effectiveGmvFromLivestream,
  resolveExplicitBrandAllocations,
  resolveBrandLivestreamGmv,
  resolveLarkHistoricalGmv,
  resolveLivestreamProductGmv,
} from "../shared/brandMetrics";
import { decideNonDestructiveLarkField } from "../shared/larkSyncMerge";
import {
  extractNumericValue,
  hashLarkSourceFields,
  mapFeishuRecord,
} from "./feishuService";

describe("brand GMV evidence resolver", () => {
  it("restores salesAmount-only legacy livestreams", () => {
    expect(resolveBrandLivestreamGmv({ salesAmount: 125000, gmv: null })).toMatchObject({
      value: 125000,
      source: "sales_amount",
      hasConflict: false,
    });
  });

  it("uses gmv-only history when sales amount is absent", () => {
    expect(resolveBrandLivestreamGmv({ salesAmount: null, gmv: 88000 })).toMatchObject({
      value: 88000,
      source: "livestream_gmv",
    });
  });

  it("does not add overlapping values and reports conflicts", () => {
    const result = resolveBrandLivestreamGmv({ salesAmount: 120000, gmv: 100000, productGmvTotal: 95000 });
    expect(result.value).toBe(120000);
    expect(result.source).toBe("sales_amount");
    expect(result.hasConflict).toBe(true);
    expect(result.conflictSources).toEqual(["sales_amount", "livestream_gmv", "product_gmv"]);
  });

  it("prioritizes explicit per-brand allocation", () => {
    expect(resolveBrandLivestreamGmv({ allocatedBrandGmv: 30000, salesAmount: 120000, gmv: 120000 })).toMatchObject({
      value: 30000,
      source: "allocated_brand_gmv",
      hasConflict: true,
    });
  });

  it("does not let a zero placeholder hide a positive legacy fact", () => {
    expect(resolveBrandLivestreamGmv({ allocatedBrandGmv: 0, salesAmount: 43000 }).value).toBe(43000);
  });

  it("keeps zero as an explicit valid value when no positive evidence exists", () => {
    expect(resolveBrandLivestreamGmv({ salesAmount: 0, gmv: null })).toMatchObject({ value: 0, source: "sales_amount" });
  });

  it("resolves product rows without adding overlapping columns", () => {
    expect(resolveLivestreamProductGmv({ directGmv: 5000, gmv: 4000, grossRevenue: 3000 })).toBe(5000);
  });

  it("uses server-provided effective GMV first", () => {
    expect(effectiveGmvFromLivestream({ effectiveGmv: 777, salesAmount: 123, gmv: 100 })).toBe(777);
  });

  it("withholds arbitrary GMV when duplicate brand allocations disagree", () => {
    expect(resolveExplicitBrandAllocations([30000, 45000])).toMatchObject({
      value: 0,
      source: "none",
      hasConflict: true,
    });
    expect(resolveExplicitBrandAllocations([30000, 30000])).toMatchObject({
      value: 30000,
      source: "allocated_brand_gmv",
      hasConflict: false,
    });
  });

  it("keeps Lark historical GMV separate and rejects conflicting baselines", () => {
    expect(resolveLarkHistoricalGmv({
      numericFacts: [{ sourceField: "达播总带货gmv", value: 236424 }],
    })).toEqual({ value: 236424, sourceFields: ["达播总带货gmv"], hasConflict: false });
    expect(resolveLarkHistoricalGmv({
      reportedGmv: 100,
      numericFacts: [{ sourceField: "达播总带货gmv", value: 200 }],
    })).toMatchObject({ value: null, hasConflict: true });
    expect(resolveLarkHistoricalGmv({
      reportedGmv: 0,
      numericFacts: [{ sourceField: "达播总带货gmv", value: 200 }],
    })).toMatchObject({ value: null, hasConflict: true });
  });
});

describe("non-destructive Lark merge", () => {
  it("preserves an existing value when source column is absent", () => {
    expect(decideNonDestructiveLarkField("owner-a", { present: false, sourceField: null, value: null })).toEqual({
      action: "preserved_absent",
      shouldUpdate: false,
      value: "owner-a",
    });
  });

  it("preserves an existing value when source is blank", () => {
    expect(decideNonDestructiveLarkField("owner-a", { present: true, sourceField: "品牌担当", value: "" })).toEqual({
      action: "preserved_blank",
      shouldUpdate: false,
      value: "owner-a",
    });
  });

  it("updates only when a non-empty authoritative source value is present", () => {
    expect(decideNonDestructiveLarkField("owner-a", { present: true, sourceField: "品牌担当", value: "owner-b" })).toEqual({
      action: "updated",
      shouldUpdate: true,
      value: "owner-b",
    });
  });
});

describe("Lark brand field parsing", () => {
  it("recognizes aliases and records field presence", () => {
    const mapped = mapFeishuRecord({
      record_id: "rec-1",
      fields: {
        "品牌（ブランド）": [{ text: "F&W" }],
        "品牌介紹": "历史介绍",
        "累計GMV": "¥1,234,567",
        "營業額": 765432,
        "登录账号数": "12",
        "登录手机号": "09012345678",
        "银行账户备注": "do-not-snapshot",
        "商务对接": [{ name: "担当A" }],
      },
    });
    expect(mapped.brandName).toBe("F&W");
    expect(mapped.intro).toBe("历史介绍");
    expect(mapped.reportedGmv).toBe(1234567);
    expect(mapped.reportedSalesAmount).toBe(765432);
    expect(mapped.fields.operationsContact.present).toBe(false);
    expect(mapped.fields.businessContact).toMatchObject({ present: true, sourceField: "商务对接", value: "担当A" });
    expect(mapped.numericFacts).toContainEqual({ sourceField: "登录账号数", value: 12 });
    expect(mapped.numericFacts.some(fact => fact.sourceField === "登录手机号")).toBe(false);
    expect(mapped.evidenceFields).not.toHaveProperty("登录手机号");
    expect(mapped.evidenceFields).not.toHaveProperty("银行账户备注");
  });

  it("maps the production Lark sales-host GMV column to the reported GMV baseline", () => {
    const mapped = mapFeishuRecord({ record_id: "rec-production", fields: { 品牌: "F&W", 达播总带货gmv: 236424 } });
    expect(mapped.reportedGmv).toBe(236424);
    expect(mapped.fields.reportedGmv).toMatchObject({ present: true, sourceField: "达播总带货gmv", conflict: false });
    expect(mapped.numericFacts).toEqual([]);
  });

  it("prefers a populated later alias and flags disagreeing populated aliases", () => {
    const fallback = mapFeishuRecord({ record_id: "rec-2", fields: { 品牌: "Alias", GMV: "", 累计GMV: "123.45" } });
    expect(fallback.reportedGmv).toBe(123.45);
    expect(fallback.fields.reportedGmv).toMatchObject({ sourceField: "累计GMV", conflict: false });
    const conflict = mapFeishuRecord({ record_id: "rec-3", fields: { 品牌: "Alias", GMV: 100, 累计GMV: 200 } });
    expect(conflict.fields.reportedGmv.conflict).toBe(true);
    expect(conflict.evidenceFields).toMatchObject({ GMV: 100, 累计GMV: 200 });
    expect(conflict.numericFacts).toEqual([]);
  });

  it("parses localized non-negative numbers and rejects invalid values", () => {
    expect(extractNumericValue("￥98,765")).toBe(98765);
    expect(extractNumericValue([{ value: "45%" }])).toBe(45);
    expect(extractNumericValue("not-a-number")).toBeNull();
    expect(extractNumericValue(-1)).toBeNull();
  });

  it("generates the same source hash regardless of object key order", () => {
    expect(hashLarkSourceFields({ b: 2, a: { y: 2, x: 1 } }))
      .toBe(hashLarkSourceFields({ a: { x: 1, y: 2 }, b: 2 }));
  });
});

describe("brand data recovery safeguards", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const dbSource = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");
  const schedulerSource = fs.readFileSync(path.join(root, "server/feishuSyncScheduler.ts"), "utf8");
  const recoverySource = fs.readFileSync(path.join(root, "server/brandHistoricalRecovery.ts"), "utf8");
  const startupSource = fs.readFileSync(path.join(root, "server/_core/index.ts"), "utf8");
  const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
  const listSource = fs.readFileSync(path.join(root, "client/src/pages/BrandList.tsx"), "utf8");
  const detailSource = fs.readFileSync(path.join(root, "client/src/pages/BrandDetail.tsx"), "utf8");

  it("uses the canonical resolver for list, detail, monthly and liver GMV paths", () => {
    expect(dbSource).toContain("getBrandLivestreamMetricRows(brandsResult.map(brand => brand.id))");
    expect(dbSource).toContain("const metricRows = await getBrandLivestreamMetricRows([brandId])");
    expect(dbSource).toContain("const livestreamList = await getBrandLivestreamMetricRows([brandId])");
    expect(dbSource).toContain("const metrics = await getBrandLivestreamMetricRows([brandId])");
    expect(dbSource).toContain("isNull(brandLivestreams.deletedAt)");
  });

  it("snapshots every Lark source record and never maps blank source fields to destructive clears", () => {
    expect(schedulerSource).toContain("db.insert(brandLarkSourceSnapshots)");
    expect(schedulerSource).toContain("larkBrand.evidenceFields");
    expect(schedulerSource).not.toContain("larkBrand.rawFields");
    expect(schedulerSource).toContain("decideNonDestructiveLarkField(beforeValue, plan.source)");
    expect(schedulerSource).toContain("GET_LOCK(?,5)");
    expect(schedulerSource).toContain("source_alias_conflict");
    expect(schedulerSource).not.toContain("status: mapLarkStageToStatus(larkBrand.stage),\n          })\n          .where");
  });

  it("requires a lock, verified backups and an evidence ledger for recovery and merge", () => {
    expect(recoverySource).toContain("SELECT GET_LOCK(?,600) AS acquired");
    expect(recoverySource).toContain("runDatabaseBackup(reason, { force: true, waitForActive: true })");
    expect(recoverySource).toContain("readDatabaseBackupTables(backupId, [\"brand_livestreams\"])");
    expect(recoverySource).toContain("backupReviewCandidates");
    expect(recoverySource).toContain("automaticWrites: false");
    expect(recoverySource).not.toContain("UPDATE brand_livestreams SET");
    expect(recoverySource).not.toContain("UPDATE IGNORE");
    expect(recoverySource).toContain("committed_pending_post_backup");
    expect(startupSource).not.toContain('runBrandHistoricalRecovery("startup")');
    expect(recoverySource).toContain("same_lark_record_id");
    expect(recoverySource).toContain("brand_data_recovery_items");
  });

  it("protects sync and merge mutations with super-admin checks", () => {
    expect(routerSource.match(/await requireBrandDataMutation\(ctx\)/g)?.length || 0).toBeGreaterThanOrEqual(4);
    expect(routerSource).toContain("await requireBrandDataView(ctx)");
    expect(routerSource).toContain("const access = await getBrandDataAccess(ctx)");
    expect(routerSource).toContain('if (key.startsWith("lark")) delete');
  });

  it("shows evidence, conflict, recovery and independent Lark baseline labels in both languages", () => {
    expect(listSource).toContain("飞书历史基线");
    expect(listSource).toContain("飛書の過去基準値");
    expect(listSource).toContain("不与直播GMV相加");
    expect(listSource).toContain("resolveLarkHistoricalGmv");
    expect(listSource).toContain("飞书历史GMV");
    expect(detailSource).toContain("飞书历史数字 / CRM基准值");
    expect(detailSource).toContain("配信実績GMVとは別表示・加算なし");
  });
});
