import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cashUi = fs.readFileSync(path.join(root, "client/src/components/FinanceCommandCenter.tsx"), "utf8");
const ipoUi = fs.readFileSync(path.join(root, "client/src/components/IpoReadinessCommandCenter.tsx"), "utf8");
const financePage = fs.readFileSync(path.join(root, "client/src/pages/FinanceManagement.tsx"), "utf8");
const router = fs.readFileSync(path.join(root, "server/cashflowRouter.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "server/ipoReadinessMonthlyPnl.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "drizzle/0137_finance_monthly_pnl.sql"), "utf8");

describe("IPO readiness page split and access boundaries", () => {
  it("keeps the CEO finance command center focused only on cash and 90-day risk", () => {
    expect(cashUi).toContain("CEO / 財務司令塔");
    expect(cashUi).toContain("现金还能撑多久，未来90天会不会缺钱");
    expect(cashUi).toContain("司令塔只读，不修改任何账目");
    expect(cashUi).not.toContain("上場ロードマップ");
    expect(cashUi).not.toContain("月次损益を更新");
  });

  it("adds a separate top-level listing-readiness tab", () => {
    expect(financePage).toContain("{ key: 'finance-command', label: 'CEO／财务司令塔'");
    expect(financePage).toContain("{ key: 'ipo-readiness', label: '上場準備'");
    expect(financePage).toContain("activeTab === 'ipo-readiness'");
    expect(financePage).toContain("<IpoReadinessCommandCenter");
  });

  it("renders all company-plan targets on the dedicated listing page", () => {
    expect(ipoUi).toContain("上場ロードマップ");
    expect(ipoUi).toContain("7月決算");
    expect(ipoUi).toContain("目标＝公司计划");
    expect(ipoUi).toContain("达到目标需要做什么");
    expect(ipoUi).toContain("正式累计营业利润");
  });

  it("separates formal monthly P&L from bank cash reference", () => {
    expect(ipoUi).toContain("银行经营现金参考（非会计利润）");
    expect(ipoUi).toContain("现金参考和GMV不得作为利润代填");
    expect(ipoUi).toContain("月次损益を更新");
    expect(ipoUi).toContain("草稿・不计入完成率");
    expect(ipoUi).toContain("月结・计入完成率");
    expect(ipoUi).toContain("审计・计入完成率");
    expect(ipoUi).toContain("trpc.cashflow.upsertIpoMonthlyPnl.useMutation");
  });

  it("protects reads and writes with finance unlock", () => {
    expect(router).toContain("getFinanceCommandCenter: financeProcedure");
    expect(router).toContain("upsertIpoMonthlyPnl: financeProcedure");
    expect(router).not.toContain("upsertIpoMonthlyPnl: publicProcedure");
  });

  it("stores one auditable record per month and updates instead of duplicating", () => {
    expect(schema).toContain("UNIQUE KEY `uq_finance_monthly_pnl_month` (`month`)");
    expect(service).toContain("ON DUPLICATE KEY UPDATE");
    expect(service).toContain("updatedBy=VALUES(updatedBy)");
    expect(service).toContain("updatedAt=CURRENT_TIMESTAMP");
  });
});
