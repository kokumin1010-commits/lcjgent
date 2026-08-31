import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildGrowthAlertCandidates,
  buildRefundReconciliation,
  buildStoreSkuMetrics,
  evaluateMetric,
  normalizeGrowthRows,
} from "./storeCommandCenterPolicy";
import { parseStoreCommandFile } from "./storeCommandCenterImport";
import { readFileSync } from "node:fs";

function row(overrides: Record<string, unknown> = {}) {
  return {
    日期: "2026-08-01",
    商品名称: "测试精华",
    商品ID: "P1",
    商品sku: "40ml",
    "SKU ID": "S1",
    曝光次数: 20_000,
    点击量: 200,
    订单数: 20,
    GMV: 200_000,
    送达数量: 20,
    退款数量: 0,
    退款金额: 0,
    ...overrides,
  };
}

describe("store command center policy", () => {
  it("normalizes Chinese and Japanese TikTok CSV headers to product and SKU facts", () => {
    const legacy = normalizeGrowthRows("sku_performance", [
      {
        日期: "2026-07-01",
        商品名: "MIAVIE クレイウォッシュパック",
        "商品 ID": "1736341690211534354",
        商品sku: "默认SKU",
        GMV: "2,211,935円",
        商品成交件数: "171",
        商品曝光次数: "458312",
        商品点击量: "15203",
        订单数: "169",
      },
    ]);
    expect(legacy.rows[0]).toMatchObject({
      gmv: 2211935,
      quantity: 171,
      impressions: 458312,
      clicks: 15203,
      orders: 169,
      observed: {
        gmv: true,
        quantity: true,
        deliveredQuantity: false,
        refundQuantity: false,
        refundAmount: false,
        returnReason: false,
        orders: true,
      },
    });
    expect(buildStoreSkuMetrics(legacy.rows)[0]).toMatchObject({
      refundAmount: 0,
      refundAmountAvailable: false,
      refundQuantityAvailable: false,
      refundDetailAvailable: false,
      returnRate: null,
    });

    const result = normalizeGrowthRows("refunds", [
      row({ 退款数量: 5, 退款金额: 60_000, 退款原因: "尺寸不符" }),
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      productId: "P1",
      productName: "测试精华",
      skuId: "S1",
      skuName: "40ml",
      refundQuantity: 5,
      refundAmount: 60_000,
      returnReason: "尺寸不符",
    });
  });

  it("keeps an explicit zero refund distinct from a missing refund column", () => {
    const explicitZero = buildStoreSkuMetrics(
      normalizeGrowthRows("sku_performance", [row()]).rows
    )[0];
    expect(explicitZero).toMatchObject({
      refundAmount: 0,
      refundAmountAvailable: true,
      refundQuantity: 0,
      refundQuantityAvailable: true,
      refundDetailAvailable: true,
      returnRate: 0,
    });
  });

  it("reconciles store totals without allocating unsupported SKU refunds", () => {
    const metrics = buildStoreSkuMetrics(
      normalizeGrowthRows("sku_performance", [
        {
          日期: "2026-07-01",
          商品名: "历史商品",
          商品ID: "P-HISTORY",
          GMV: 98372339,
          商品成交件数: 100,
          订单数: 90,
        },
      ]).rows
    );
    const result = buildRefundReconciliation({
      storeGmv: 98372339,
      storeRefundAmount: 35217297,
      metrics,
    });
    expect(result.status).toBe("unmatched");
    expect(result.refundAmountRate).toBeCloseTo(35.8, 6);
    expect(result.attributedRefundAmount).toBe(0);
    expect(result.unallocatedRefundAmount).toBe(35217297);
    expect(result.allocationRate).toBe(0);
    expect(result.skuWithRefundAmountEvidence).toBe(0);
  });

  it("does not attribute refunds by product name without a stable product or SKU ID", () => {
    const nameOnlyMetrics = buildStoreSkuMetrics(
      normalizeGrowthRows("refunds", [
        {
          日期: "2026-07-02",
          商品名: "名称可能重复的商品",
          退款数量: 1,
          退款金额: 30000,
        },
      ]).rows
    );
    expect(
      buildRefundReconciliation({
        storeGmv: 200000,
        storeRefundAmount: 50000,
        metrics: nameOnlyMetrics,
      })
    ).toMatchObject({
      status: "unmatched",
      attributedRefundAmount: 0,
      unallocatedRefundAmount: 50000,
      skuWithRefundAmountEvidence: 0,
    });
  });

  it("reports partial and over-attributed refunds instead of hiding reconciliation gaps", () => {
    const partialMetrics = buildStoreSkuMetrics(
      normalizeGrowthRows("refunds", [
        row({ 退款数量: 1, 退款金额: 60000, 退款原因: "破损" }),
      ]).rows
    );
    expect(
      buildRefundReconciliation({
        storeGmv: 200000,
        storeRefundAmount: 100000,
        metrics: partialMetrics,
      })
    ).toMatchObject({
      status: "partial",
      attributedRefundAmount: 60000,
      unallocatedRefundAmount: 40000,
      allocationRate: 60,
    });
    expect(
      buildRefundReconciliation({
        storeGmv: 200000,
        storeRefundAmount: 50000,
        metrics: partialMetrics,
      })
    ).toMatchObject({
      status: "over_attributed",
      overAttributedAmount: 10000,
      unallocatedRefundAmount: 0,
    });
  });

  it("builds SKU refund radar and critical automatic instruction from net GMV loss", () => {
    const normalized = normalizeGrowthRows("refunds", [
      row({ 送达数量: 100, 退款数量: 30, 退款金额: 120_000, 退款原因: "破损" }),
    ]).rows;
    const metrics = buildStoreSkuMetrics(normalized);
    expect(metrics[0]).toMatchObject({
      deliveredQuantity: 100,
      refundQuantity: 30,
      refundAmount: 120_000,
      returnRate: 30,
    });
    const alert = buildGrowthAlertCandidates(normalized).find(
      item => item.ruleKey === "sku_refund_risk"
    );
    expect(alert).toMatchObject({
      severity: "critical",
      metricKey: "returnRate",
      targetValue: 10,
    });
    expect(alert?.steps.length).toBeGreaterThanOrEqual(4);
  });

  it("treats observed zero sales as actionable without misreading zero refunds", () => {
    const alerts = buildGrowthAlertCandidates(
      normalizeGrowthRows("sku_performance", [
        {
          日期: "2026-07-01",
          商品名称: "零成交商品",
          商品sku: "SKU-ZERO",
          曝光次数: 12000,
          点击量: 240,
          订单数: 0,
          GMV: 0,
          退款数量: 0,
          退款金额: 0,
        },
        {
          日期: "2026-07-01",
          商品名称: "正常商品",
          商品sku: "SKU-OK",
          曝光次数: 10000,
          点击量: 500,
          订单数: 25,
          GMV: 250000,
        },
      ]).rows
    );
    expect(
      alerts.some(
        alert =>
          alert.ruleKey === "traffic_zero_sales" && alert.currentValue === 0
      )
    ).toBe(true);
    expect(
      alerts.some(
        alert =>
          alert.ruleKey === "sku_refund_risk" &&
          alert.entityKey.includes("SKU-ZERO")
      )
    ).toBe(false);
  });

  it("detects funnel opportunities without counting them as profit", () => {
    const raw = [
      row({
        商品ID: "P1",
        "SKU ID": "S1",
        曝光次数: 100_000,
        点击量: 500,
        订单数: 50,
        GMV: 500_000,
      }),
      row({
        商品名称: "基准商品",
        商品ID: "P2",
        商品sku: "标准",
        "SKU ID": "S2",
        曝光次数: 20_000,
        点击量: 1_000,
        订单数: 100,
        GMV: 1_000_000,
      }),
      row({
        商品名称: "基准商品2",
        商品ID: "P3",
        商品sku: "标准",
        "SKU ID": "S3",
        曝光次数: 30_000,
        点击量: 1_200,
        订单数: 120,
        GMV: 1_200_000,
      }),
    ];
    const alerts = buildGrowthAlertCandidates(
      normalizeGrowthRows("sku_performance", raw).rows
    );
    expect(alerts.some(item => item.ruleKey === "high_exposure_low_ctr")).toBe(
      true
    );
    expect(
      alerts.every(item => item.opportunityValue >= 0 && item.confidence <= 1)
    ).toBe(true);
  });

  it("verifies decrease metrics in the correct direction and refuses missing evidence", () => {
    expect(
      evaluateMetric({
        metricKey: "returnRate",
        baseline: 20,
        target: 10,
        current: 8,
      })
    ).toBe("effective");
    expect(
      evaluateMetric({
        metricKey: "returnRate",
        baseline: 20,
        target: 10,
        current: 15,
      })
    ).toBe("ineffective");
    expect(
      evaluateMetric({
        metricKey: "cvr",
        baseline: 2,
        target: 4,
        current: null,
      })
    ).toBe("insufficient");
  });

  it("parses XLSX on the server and reports data quality before import", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        row(),
        row({ 日期: "2026-08-02", 商品ID: "P2", "SKU ID": "S2" }),
      ]),
      "data"
    );
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;
    const parsed = parseStoreCommandFile({
      fileBuffer: buffer,
      fileName: "sku.xlsx",
      dataType: "sku_performance",
    });
    expect(parsed.quality.acceptedCount).toBe(2);
    expect(parsed.fileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.periodStart).toBe("2026-08-01");
    expect(parsed.periodEnd).toBe("2026-08-02");
  });
});

describe("store command center integration contract", () => {
  const upgrade = readFileSync("server/storeCommandCenterUpgrade.ts", "utf8");
  const router = readFileSync("server/storeCommandCenterRouter.ts", "utf8");
  const page = readFileSync("client/src/pages/StoreManagement.tsx", "utf8");
  const ui = readFileSync(
    "client/src/components/StoreGrowthCommandCenter.tsx",
    "utf8"
  );

  it("is backup-gated, idempotent, audited and immutable by import generation", () => {
    expect(upgrade).toContain("pre-store-command-center-v1");
    expect(upgrade).toContain("runDatabaseBackup");
    expect(upgrade).toContain("isCurrent TINYINT(1) NOT NULL DEFAULT 1");
    expect(upgrade).toContain("store_growth_task_events");
    expect(upgrade).toContain("uq_store_command_file");
    expect(router).toContain("writeExecutionAudit");
  });

  it("limits daily automatic work, requires evidence, and validates store permission on server", () => {
    expect(router).toContain("3 - Number(countRows[0]?.count || 0)");
    expect(router).toMatch(
      /submit_observation[\s\S]{0,180}!input\.evidence\.length/
    );
    expect(router).toMatch(
      /requireStorePermission\(ctx,\s*input\.storeId,\s*["']edit["']\)/
    );
    expect(router).toContain("verificationStatus='observing'");
  });

  it("preserves all existing store tabs and adds the command center as default", () => {
    expect(page).toMatch(
      /['"]command['"]\s*\|\s*['"]performance['"]\s*\|\s*['"]execution['"]\s*\|\s*['"]products['"]\s*\|\s*['"]promotions['"]\s*\|\s*['"]uploads['"]/
    );
    expect(page).toMatch(/label:\s*["']增长司令塔["']/);
    for (const label of [
      "业绩概览",
      "店长经营",
      "商品管理",
      "推广活动",
      "数据上传",
    ])
      expect(page).toContain(label);
    expect(ui).toContain("SKU退货与增长机会");
    expect(ui).toContain("我的增长任务");
    expect(ui).toContain("CSV导入中心 V3");
    expect(ui).toContain("退款明细归属 / 返金明細の照合");
    expect(ui).toContain("未匹配");
    expect(ui).toContain("退款金额率");
    expect(ui).toContain("退货件数率");
    expect(page).toContain("退款金额率 / 返金金額率");
    expect(router).toContain("buildRefundReconciliation");
    expect(router).toContain("refundQuantityCoverageComplete");
  });
});
