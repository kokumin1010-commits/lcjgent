import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCeoPitFeeDetails } from "./ceoPitFeeDetails";

const root = path.resolve(import.meta.dirname, "..");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    transactionDate: "2026-08-10",
    entity: "japan",
    counterparty: "取引先A",
    description: "8月ライブ枠料",
    sourceAccount: "LCJ MITSUI",
    currency: "JPY",
    amount: 3_300_000,
    receiptUrl: "https://example.invalid/evidence.pdf",
    updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    ...overrides,
  };
}

describe("CEO pit fee detail model", () => {
  it("keeps original currencies and converts only the JPY management reference", () => {
    const result = buildCeoPitFeeDetails("2026-09-14", 12, [
      row(),
      row({ id: 2, transactionDate: "2026-08-20", entity: "china", currency: "CNY", amount: 4_224 }),
    ]);

    expect(result.readOnly).toBe(true);
    expect(result.referenceRateCnyToJpy).toBe(20.5);
    expect(result.total).toMatchObject({
      registered: true,
      recordCount: 2,
      jpy: 3_300_000,
      cny: 4_224,
      referenceJpy: 3_386_592,
    });
    expect(result.monthly.find((item) => item.month === "2026-08")).toMatchObject({
      registered: true,
      recordCount: 2,
      jpy: 3_300_000,
      cny: 4_224,
      referenceJpy: 3_386_592,
    });
    expect(result.records[0]).toMatchObject({
      counterparty: "取引先A",
      sourceAccount: "LCJ MITSUI",
      receiptUrl: "https://example.invalid/evidence.pdf",
    });
  });

  it("returns continuous months and treats missing months as unregistered rather than zero revenue", () => {
    const result = buildCeoPitFeeDetails("2026-09-14", 3, [row()]);
    expect(result.monthly.map((item) => item.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(result.monthly[0]).toEqual({ month: "2026-07", registered: false, recordCount: 0, jpy: null, cny: null, referenceJpy: null });
    expect(result.monthly[2]).toEqual({ month: "2026-09", registered: false, recordCount: 0, jpy: null, cny: null, referenceJpy: null });
  });

  it("excludes future-dated and out-of-window rows from both totals and details", () => {
    const result = buildCeoPitFeeDetails("2026-09-14", 3, [
      row({ id: 2, transactionDate: "2026-09-15", amount: 500_000 }),
      row({ id: 3, transactionDate: "2026-06-30", amount: 700_000 }),
    ]);
    expect(result.total.recordCount).toBe(0);
    expect(result.records).toEqual([]);
  });
});

describe("CEO pit fee access and UI contract", () => {
  const routerSource = readFileSync(path.join(root, "server/ceoCommandCenterRouter.ts"), "utf8");
  const serviceSource = readFileSync(path.join(root, "server/ceoPitFeeDetails.ts"), "utf8");
  const uiSource = readFileSync(path.join(root, "client/src/components/CeoCommandCenter.tsx"), "utf8");
  const dialogSource = readFileSync(path.join(root, "client/src/components/CeoPitFeeDialog.tsx"), "utf8");

  it("uses the CEO-only procedure and never weakens the general finance procedure", () => {
    expect(routerSource).toContain("pitFeeDetails: ceoProcedure");
    expect(routerSource).not.toContain("pitFeeDetails: protectedProcedure");
    expect(routerSource).toContain("canAccessCeoCommandCenter(ctx.user)");
    expect(serviceSource).not.toMatch(/sql`\s*(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i);
    expect(serviceSource).toContain("type = 'income'");
    expect(serviceSource).toContain("category = ${PIT_FEE_CATEGORY}");
    expect(serviceSource).not.toContain("SELECT * FROM company_cashflows");
  });

  it("opens the CEO detail dialog directly and exposes monthly drilldown without a finance password", () => {
    expect(uiSource).toContain("setPitFeeDetailsOpen(true)");
    expect(uiSource).toContain("<CeoPitFeeDialog");
    expect(uiSource).not.toContain("财务明细继续由二次密码保护");
    expect(dialogSource).toContain("坑位费收入・月度推移与逐笔明细");
    expect(dialogSource).toContain("无需财务密码");
    expect(dialogSource).toContain("selectedMonth");
    expect(dialogSource).toContain("PDF／");
    expect(dialogSource).toContain("证凭");
    expect(dialogSource).toContain("不包含工资或其他财务明细");
    expect(uiSource).toContain("工资和其他财务数据仍受保护");
  });
});
