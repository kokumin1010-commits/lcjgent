export type MonthlyPayrollDrilldownEntity = "all" | "japan" | "china";

export type MonthlyPayrollDrilldownSelection = {
  payrollMonth: string;
  entity: MonthlyPayrollDrilldownEntity;
};

export type MonthlyPayrollDetailRow = {
  entity: "japan" | "china";
  payrollMonth: string;
  employeeName: string;
  netPay: number;
  currency: "JPY" | "CNY";
  cashflowAmount?: number | null;
  cashflowId?: number | null;
  paid?: boolean;
};

export const CNY_TO_JPY_REFERENCE_RATE = 20.5;

export function convertCnyToJpyReference(amount: number): number {
  return Math.round(Number(amount || 0) * CNY_TO_JPY_REFERENCE_RATE);
}

export function toggleMonthlyPayrollDrilldown(
  current: MonthlyPayrollDrilldownSelection | null,
  next: MonthlyPayrollDrilldownSelection,
): MonthlyPayrollDrilldownSelection | null {
  return current?.payrollMonth === next.payrollMonth && current.entity === next.entity ? null : next;
}

export function buildMonthlyPayrollDrilldown(
  rows: MonthlyPayrollDetailRow[],
  selection: MonthlyPayrollDrilldownSelection,
) {
  const filteredRows = rows.filter(
    row => row.payrollMonth === selection.payrollMonth && (selection.entity === "all" || row.entity === selection.entity),
  );
  const employees = new Set(filteredRows.map(row => `${row.entity}|${row.employeeName}`));
  const totals = filteredRows.reduce(
    (sum, row) => {
      if (row.currency === "JPY") {
        sum.jpyTotal += Number(row.netPay || 0);
        sum.jpyCashflowTotal += Number(row.cashflowAmount || 0);
      }
      if (row.currency === "CNY") {
        sum.cnyTotal += Number(row.netPay || 0);
        sum.cnyCashflowTotal += Number(row.cashflowAmount || 0);
      }
      return sum;
    },
    { jpyTotal: 0, cnyTotal: 0, jpyCashflowTotal: 0, cnyCashflowTotal: 0 },
  );

  return {
    rows: filteredRows,
    recordCount: filteredRows.length,
    employeeCount: employees.size,
    jpyTotal: Math.round(totals.jpyTotal * 100) / 100,
    cnyTotal: Math.round(totals.cnyTotal * 100) / 100,
    jpyCashflowTotal: Math.round(totals.jpyCashflowTotal * 100) / 100,
    cnyCashflowTotal: Math.round(totals.cnyCashflowTotal * 100) / 100,
  };
}
