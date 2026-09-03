import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeCashflowCategoryNetBreakdown } from "./cashflowCategoryNetBreakdown";

const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");

describe("cashflow category net expense breakdown", () => {
  it("reports a partial purchase refund as expense minus income", () => {
    const [row] = normalizeCashflowCategoryNetBreakdown([{
      category: "商品仕入",
      currency: "JPY",
      totalAmount: "800000",
      expenseAmount: "1000000",
      incomeAmount: "200000",
      normalizedAmountJpy: "800000",
      count: "2",
      expenseCount: "1",
      incomeCount: "1",
    }]);

    expect(row).toMatchObject({
      totalAmount: 800000,
      expenseAmount: 1000000,
      incomeAmount: 200000,
      count: 2,
      expenseCount: 1,
      incomeCount: 1,
      percentage: 100,
      netDirection: "expense",
    });
  });

  it("keeps fully offset and net-refund categories visible without negative expense share", () => {
    const rows = normalizeCashflowCategoryNetBreakdown([
      {
        category: "商品仕入",
        currency: "JPY",
        totalAmount: 800000,
        expenseAmount: 1000000,
        incomeAmount: 200000,
        normalizedAmountJpy: 800000,
        count: 2,
        expenseCount: 1,
        incomeCount: 1,
      },
      {
        category: "口座間振替",
        currency: "JPY",
        totalAmount: 0,
        expenseAmount: 20000000,
        incomeAmount: 20000000,
        normalizedAmountJpy: 0,
        count: 2,
        expenseCount: 1,
        incomeCount: 1,
      },
      {
        category: "返金調整",
        currency: "JPY",
        totalAmount: -50000,
        expenseAmount: 100000,
        incomeAmount: 150000,
        normalizedAmountJpy: -50000,
        count: 2,
        expenseCount: 1,
        incomeCount: 1,
      },
    ]);

    expect(rows[0]).toMatchObject({ percentage: 100, netDirection: "expense" });
    expect(rows[1]).toMatchObject({ percentage: 0, netDirection: "settled" });
    expect(rows[2]).toMatchObject({ percentage: 0, netDirection: "refund", totalAmount: -50000 });
  });

  it("calculates percentage denominators independently by currency", () => {
    const rows = normalizeCashflowCategoryNetBreakdown([
      { category: "A", currency: "JPY", totalAmount: 800, expenseAmount: 1000, incomeAmount: 200, normalizedAmountJpy: 800, count: 2, expenseCount: 1, incomeCount: 1 },
      { category: "B", currency: "JPY", totalAmount: 200, expenseAmount: 200, incomeAmount: 0, normalizedAmountJpy: 200, count: 1, expenseCount: 1, incomeCount: 0 },
      { category: "C", currency: "CNY", totalAmount: 50, expenseAmount: 80, incomeAmount: 30, normalizedAmountJpy: 1025, count: 2, expenseCount: 1, incomeCount: 1 },
    ]);

    expect(rows.map((row) => row.percentage)).toEqual([80, 20, 100]);
  });

  it("uses server-side net SQL and keeps the client as a display-only consumer", () => {
    const start = routerSource.indexOf("  getCategoryBreakdown: financeProcedure");
    const end = routerSource.indexOf("  // 分类主数据", start);
    const section = routerSource.slice(start, end);

    expect(section).toContain('type: z.enum(["income", "expense", "all", "net"])');
    expect(section).toContain("CASE WHEN type = 'expense' THEN amount WHEN type = 'income' THEN -amount ELSE 0 END");
    expect(section).toContain("AS expenseAmount");
    expect(section).toContain("AS incomeAmount");
    expect(section).toContain("normalizeCashflowCategoryNetBreakdown");
    expect(pageSource).toContain('type: "net"');
    expect(pageSource).toContain("カテゴリ別純支出分析");
    expect(pageSource).toContain("純支出 = 出金合計 − 入金合計");
    expect(pageSource).toContain("positiveNetAmount > 0");
    expect(pageSource).toContain("cat.expenseAmount");
    expect(pageSource).toContain("cat.incomeAmount");
  });
});
