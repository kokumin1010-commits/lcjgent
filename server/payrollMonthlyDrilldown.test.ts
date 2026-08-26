import { describe, expect, it } from "vitest";
import {
  buildMonthlyPayrollDrilldown,
  convertCnyToJpyReference,
  toggleMonthlyPayrollDrilldown,
} from "../client/src/lib/payrollMonthlyDrilldown";

const rows = [
  { entity: "japan" as const, payrollMonth: "2026-07", employeeName: "付颖", netPay: 307538, currency: "JPY" as const, paid: true },
  { entity: "japan" as const, payrollMonth: "2026-07", employeeName: "井出阔", netPay: 243055, currency: "JPY" as const, paid: true },
  { entity: "china" as const, payrollMonth: "2026-07", employeeName: "李俊鸿", netPay: 8032.68, currency: "CNY" as const, paid: false },
  { entity: "china" as const, payrollMonth: "2026-06", employeeName: "李俊鸿", netPay: 7988.22, currency: "CNY" as const, paid: false },
];

describe("payrollMonthlyDrilldown", () => {
  it("separates Japanese and Chinese employees for a selected month", () => {
    expect(buildMonthlyPayrollDrilldown(rows, { payrollMonth: "2026-07", entity: "japan" })).toMatchObject({
      recordCount: 2,
      employeeCount: 2,
      jpyTotal: 550593,
      cnyTotal: 0,
    });
    expect(buildMonthlyPayrollDrilldown(rows, { payrollMonth: "2026-07", entity: "china" })).toMatchObject({
      recordCount: 1,
      employeeCount: 1,
      jpyTotal: 0,
      cnyTotal: 8032.68,
    });
  });

  it("shows both currencies when the month label is selected", () => {
    const result = buildMonthlyPayrollDrilldown(rows, { payrollMonth: "2026-07", entity: "all" });
    expect(result.recordCount).toBe(3);
    expect(result.employeeCount).toBe(3);
    expect(result.jpyTotal).toBe(550593);
    expect(result.cnyTotal).toBe(8032.68);
  });

  it("toggles the same bar closed and switches when a different bar is selected", () => {
    const japan = { payrollMonth: "2026-07", entity: "japan" as const };
    expect(toggleMonthlyPayrollDrilldown(null, japan)).toEqual(japan);
    expect(toggleMonthlyPayrollDrilldown(japan, japan)).toBeNull();
    expect(toggleMonthlyPayrollDrilldown(japan, { payrollMonth: "2026-07", entity: "china" })).toEqual({ payrollMonth: "2026-07", entity: "china" });
  });

  it("keeps exact fractional JPY totals while the UI may display whole yen", () => {
    const june = buildMonthlyPayrollDrilldown([
      { entity: "japan", payrollMonth: "2026-06", employeeName: "雷长耕", netPay: 389144.73, currency: "JPY", cashflowAmount: 389144.73 },
      { entity: "japan", payrollMonth: "2026-06", employeeName: "黄国民", netPay: 770000, currency: "JPY", cashflowAmount: 770000 },
    ], { payrollMonth: "2026-06", entity: "japan" });

    expect(june.jpyTotal).toBe(1159144.73);
    expect(june.jpyCashflowTotal).toBe(1159144.73);
    expect(Math.round(june.jpyTotal)).toBe(1159145);
  });

  it("converts Chinese payroll to the shared JPY reference rate", () => {
    expect(convertCnyToJpyReference(113298.85)).toBe(2322626);
    expect(convertCnyToJpyReference(6946.69)).toBe(142407);
  });
});
