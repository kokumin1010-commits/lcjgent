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

  it("adds a separate top-level listing-readiness tab and preserves direct links", () => {
    expect(financePage).toContain("{ key: 'finance-command', label: 'CEO／财务司令塔'");
    expect(financePage).toContain("{ key: 'ipo-readiness', label: '上場準備'");
    expect(financePage).toContain("activeTab === 'ipo-readiness'");
    expect(financePage).toContain("<IpoReadinessCommandCenter");
    expect(financePage).toMatch(/validTabs[\s\S]*'ipo-readiness'/);
  });

  it("renders all company-plan targets on the dedicated listing page", () => {
    expect(ipoUi).toContain("上場ロードマップ");
    expect(ipoUi).toContain("7月決算");
    expect(ipoUi).toContain("目標＝会社計画");
    expect(ipoUi).toContain("目標達成に必要なアクション");
    expect(ipoUi).toContain("正式累計営業利益");
    expect(ipoUi).toContain("目標営業利益率＝20%");
    expect(ipoUi).toContain("必要売上高");
    expect(ipoUi).toContain("営業費用上限");
  });

  it("separates formal monthly P&L from bank cash reference", () => {
    expect(ipoUi).toContain("管理速報");
    expect(ipoUi).toContain("銀行営業キャッシュ口径・会計利益ではありません");
    expect(ipoUi).toContain("内部送金は営業収支に含めません");
    expect(ipoUi).toContain("正式営業利益：未登録");
    expect(ipoUi).toContain("現金口径参考");
    expect(ipoUi).toContain("現金参考差額");
    expect(ipoUi).toContain("requiredMonthlyReferenceJpy");
    expect(ipoUi).toContain("原銀行流水を自動削除・統合・書換えしません");
    expect(ipoUi).toContain("現金参考やGMVを利益として代用しないでください");
    expect(ipoUi).toContain("月次損益を更新");
    expect(ipoUi).toContain("下書き・達成率に未算入");
    expect(ipoUi).toContain("月次決算済み・達成率に算入");
    expect(ipoUi).toContain("監査済み・達成率に算入");
    expect(ipoUi).toContain("trpc.cashflow.upsertIpoMonthlyPnl.useMutation");
  });

  it("keeps the management reference at 20.5 JPY per CNY while retaining 48 months", () => {
    expect(router).toContain("const IPO_CASH_REFERENCE_MONTH_LIMIT = 48");
    expect(router).toContain("buildCashflowMonthlySummary(ipoCashflowMonthRows, IPO_CASH_REFERENCE_MONTH_LIMIT)");
    expect(router).toContain("第二引数は為替ではなく");
    expect(ipoUi).toContain("1 CNY = {ipo.cashReference.referenceCnyJpy} JPY 管理参考");
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
