import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ui = fs.readFileSync(path.join(root, "client/src/components/FinanceCommandCenter.tsx"), "utf8");
const router = fs.readFileSync(path.join(root, "server/cashflowRouter.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "server/ipoReadinessMonthlyPnl.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "drizzle/0137_finance_monthly_pnl.sql"), "utf8");

describe("IPO readiness command center UI and access boundaries", () => {
  it("renders the roadmap inside the existing finance command center", () => {
    expect(ui).toContain("上場準備・業績司令塔");
    expect(ui).toContain("7月決算");
    expect(ui).toContain("最短上场目标");
    expect(ui).toContain("达到目标需要做什么");
  });

  it("separates company plan, formal monthly P&L, and bank cash reference", () => {
    expect(ui).toContain("目标＝公司计划");
    expect(ui).toContain("正式累计营业利润");
    expect(ui).toContain("银行经营现金参考");
    expect(ui).toContain("非会计利润");
    expect(ui).toContain("现金收支参考和GMV不得作为营业利润代填");
  });

  it("uses one monthly P&L update dialog and only closed or audited data enters progress", () => {
    expect(ui).toContain("月次损益を更新");
    expect(ui).toContain("草稿・不计入完成率");
    expect(ui).toContain("月结・计入完成率");
    expect(ui).toContain("审计・计入完成率");
    expect(ui).toContain("trpc.cashflow.upsertIpoMonthlyPnl.useMutation");
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
