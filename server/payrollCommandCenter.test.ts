import { describe, expect, it } from "vitest";
import { buildPayrollCommandCenter } from "./payrollCommandCenter";

const rows = [
  { id: 1, entity: "japan" as const, currency: "JPY" as const, payrollMonth: "2026-06", employeeName: "A", netPay: 100000, cashflowId: 1, cashflowAmount: 100000, cashflowType: "expense", cashflowCategory: "給与・人件費", paid: true, sourceAccount: "LCJ MITSUI", department: "运营", wechatName: "AA" },
  { id: 2, entity: "china" as const, currency: "CNY" as const, payrollMonth: "2026-06", employeeName: "B", netPay: 1000, cashflowId: 2, cashflowAmount: 1000, cashflowType: "expense", cashflowCategory: "給与・人件費", paid: true, sourceAccount: "世曜元宇(中信銀行)", department: "直播", wechatName: "BB" },
  { id: 3, entity: "japan" as const, currency: "JPY" as const, payrollMonth: "2026-07", employeeName: "A", netPay: 130000, cashflowId: 3, cashflowAmount: 130000, cashflowType: "expense", cashflowCategory: "給与・人件費", paid: false, sourceAccount: null, department: "运营", wechatName: "AA" },
  { id: 4, entity: "china" as const, currency: "CNY" as const, payrollMonth: "2026-07", employeeName: "C", netPay: 2000, cashflowId: 4, cashflowAmount: 2000, cashflowType: "expense", cashflowCategory: "給与・人件費", paid: false, sourceAccount: null, department: null, wechatName: null },
];

describe("buildPayrollCommandCenter", () => {
  it("calculates current total, month-on-month change and payment progress without mixing currencies", () => {
    const result = buildPayrollCommandCenter({ rows, fxRates: [{ payrollMonth: "2026-07", cnyToJpyRate: 21 }] });
    expect(result.currentMonth).toBe("2026-07");
    expect(result.summary.currentTotalJpy).toBe(172000);
    expect(result.summary.previousTotalJpy).toBe(120500);
    expect(result.summary.changeJpy).toBe(51500);
    expect(result.summary.paymentProgress).toBe(0);
    expect(result.exchangeRate.rateType).toBe("actual");
    expect(result.exchangeRate.currentCnyActualJpy).toBe(42000);
    expect(result.exchangeRate.currentCnyReferenceJpy).toBe(41000);
    expect(result.exchangeRate.actualVsReferenceDifferenceJpy).toBe(1000);
  });

  it("explains new, missing and changed employees and warns when a latest month looks incomplete", () => {
    const manyPriorRows = Array.from({ length: 10 }, (_, index) => ({
      id: 10 + index, entity: "japan" as const, currency: "JPY" as const, payrollMonth: "2026-06", employeeName: `P${index}`, netPay: 1000,
      cashflowId: 10 + index, cashflowAmount: 1000, cashflowType: "expense", cashflowCategory: "給与・人件費", paid: true,
    }));
    const result = buildPayrollCommandCenter({ rows: [...manyPriorRows, rows[2]] });
    expect(result.currentMonthIncomplete).toBe(true);
    expect(result.employeeChanges.find((item) => item.employeeName === "A")?.status).toBe("new");
    expect(result.employeeChanges.find((item) => item.employeeName === "P0")?.warning).toContain("退職とは判定しません");
  });

  it("uses configured budgets and computes forecast and runway from complete positive months", () => {
    const result = buildPayrollCommandCenter({
      rows,
      budgets: [
        { entity: "japan", payrollMonth: "2026-07", budgetAmount: 120000, currency: "JPY" },
        { entity: "china", payrollMonth: "2026-07", budgetAmount: 2500, currency: "CNY" },
      ],
      balances: [
        { entity: "japan", currency: "JPY", amount: 1000000 },
        { entity: "china", currency: "CNY", amount: 10000 },
      ],
    });
    expect(result.budgets.find((item) => item.entity === "japan")?.difference).toBe(10000);
    expect(result.forecast.threeMonthReferenceJpy).toBeGreaterThan(0);
    expect(result.runway.japanMonths).toBeGreaterThan(0);
    expect(result.runway.chinaMonths).toBeGreaterThan(0);
    expect(result.forecast.confidence).toBe("low");
    expect(result.departmentCosts.reduce((total, item) => total + item.sharePercent, 0)).toBeCloseTo(100, 1);
  });

  it("creates actionable anomalies and merges saved workflow status", () => {
    const anomalyKey = "cashflow_mismatch|china|2026-07|c";
    const brokenRows = rows.map((row) => row.id === 4 ? { ...row, cashflowCategory: "設備・備品" } : row);
    const result = buildPayrollCommandCenter({
      rows: brokenRows,
      anomalyStatuses: [{ anomalyKey, status: "in_progress", ownerName: "财务", note: "核对中" }],
    });
    const anomaly = result.anomalies.find((item) => item.key === anomalyKey);
    expect(anomaly).toMatchObject({ severity: "high", status: "in_progress", ownerName: "财务", note: "核对中" });
    expect(result.anomalies.some((item) => item.type === "missing_department")).toBe(true);
    expect(result.anomalies.some((item) => item.type === "missing_budget")).toBe(true);
    expect(result.anomalies.some((item) => item.type === "missing_fx")).toBe(true);
    expect(result.anomalyCounts.currentAction).toBeGreaterThan(0);
    expect(result.anomalyCounts.dataCompleteness).toBeGreaterThan(0);
  });

  it("returns stable empty-state metrics without NaN or fabricated forecast", () => {
    const result = buildPayrollCommandCenter({ rows: [] });
    expect(result.currentMonth).toBe("");
    expect(result.summary.currentTotalJpy).toBe(0);
    expect(result.summary.paymentProgress).toBe(0);
    expect(result.forecast.threeMonthReferenceJpy).toBe(0);
    expect(result.runway.combinedReferenceMonths).toBeNull();
  });

  it("detects duplicate and historical unpaid rows while respecting a resolved workflow status", () => {
    const duplicate = { ...rows[0], id: 99 };
    const duplicateKey = "duplicate|japan|2026-06|a";
    const historicalUnpaid = { ...rows[1], paid: false };
    const result = buildPayrollCommandCenter({
      rows: [rows[0], duplicate, historicalUnpaid, rows[2], rows[3]],
      anomalyStatuses: [{ anomalyKey: duplicateKey, status: "resolved", ownerName: "财务" }],
    });
    expect(result.anomalies.find((item) => item.key === duplicateKey)?.status).toBe("resolved");
    expect(result.anomalies.some((item) => item.type === "historical_unpaid" && item.severity === "medium")).toBe(true);
    expect(result.anomalyCounts.resolved).toBeGreaterThan(0);
    expect(result.anomalyCounts.historicalBacklog).toBeGreaterThan(0);
  });
});
