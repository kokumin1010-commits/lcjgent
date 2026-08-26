import { describe, expect, it } from "vitest";
import { parsePayrollAmount, parsePayrollRows } from "../client/src/lib/payrollImport";

describe("payrollImport", () => {
  it("parses formatted and parenthesized amounts", () => {
    expect(parsePayrollAmount(" 12,345.67 ")).toBe(12345.67);
    expect(parsePayrollAmount("(4,590)")).toBe(-4590);
    expect(parsePayrollAmount("#REF!")).toBeNull();
  });

  it("maps a Japanese payroll sheet to employee, month and transfer amount", () => {
    const result = parsePayrollRows(
      [
        ["職務", "名前", "配信者名", "费用月份", "振込金額", "备注"],
        ["役員", "Sample A", "", "2026年7月", 120000, ""],
        ["主播", "", "Sample B", "2026年8月", "80,000", "翌月分"],
        ["", "総計", "", "", 200000, ""],
      ],
      { entity: "japan", fileName: "7月給与計算.xlsx", sheetName: "7月工资" },
    );
    expect(result?.records).toHaveLength(2);
    expect(result?.records[0]).toMatchObject({ employeeName: "Sample A", payrollMonth: "2026-07", netPay: 120000, currency: "JPY" });
    expect(result?.records[1]).toMatchObject({ employeeName: "Sample B", payrollMonth: "2026-08", netPay: 80000 });
    expect(result?.sourceTotal).toBe(200000);
  });

  it("recognizes an advance-paid next-month row in a Chinese payroll sheet", () => {
    const result = parsePayrollRows(
      [
        ["序号", "姓名", "岗位", "入职日期", "实发工资", "工资发放主体", null],
        [1, "Sample C", "运营", "01-13-26", 9000.5, "世曜元宇", ""],
        [2, "Sample C", "运营", "01-13-26", 6000, "世曜元宇", "8月份工资提前发"],
      ],
      { entity: "china", fileName: "7月薪资表.xlsx", sheetName: "薪资明细表" },
    );
    expect(result?.records.map((record) => record.payrollMonth)).toEqual(["2026-07", "2026-08"]);
    expect(result?.warnings).toEqual([]);
  });

  it("combines duplicate employee rows within the same payroll month", () => {
    const result = parsePayrollRows(
      [
        ["序号", "姓名", "岗位", "实发工资"],
        [1, "Sample D", "运营", 5000],
        [2, "Sample D", "运营", 1250.5],
      ],
      { entity: "china", fileName: "6月工资表.xlsx", sheetName: "薪资明细表" },
    );
    expect(result?.records).toHaveLength(1);
    expect(result?.records[0].netPay).toBe(6250.5);
    expect(result?.warnings[0]).toContain("複数行を合算");
  });
});
