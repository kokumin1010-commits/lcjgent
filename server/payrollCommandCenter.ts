import { normalizePayrollEmployee } from "./cashflowHelpers";

export const PAYROLL_REFERENCE_CNY_JPY = 20.5;

export type PayrollCommandEntity = "japan" | "china";
export type PayrollCommandCurrency = "JPY" | "CNY";

export type PayrollCommandRow = {
  id: number;
  entity: PayrollCommandEntity;
  currency: PayrollCommandCurrency;
  payrollMonth: string;
  employeeName: string;
  netPay: number;
  cashflowId?: number | null;
  cashflowAmount?: number | null;
  cashflowType?: string | null;
  cashflowCategory?: string | null;
  cashflowDeletedAt?: unknown;
  paid: boolean;
  paymentDate?: string | null;
  sourceAccount?: string | null;
  wechatName?: string | null;
  department?: string | null;
};

export type PayrollCommandBudget = {
  entity: PayrollCommandEntity;
  payrollMonth: string;
  budgetAmount: number;
  currency: PayrollCommandCurrency;
};

export type PayrollCommandFxRate = {
  payrollMonth: string;
  cnyToJpyRate: number;
  sourceNote?: string | null;
};

export type PayrollCommandBalance = {
  entity: PayrollCommandEntity;
  currency: PayrollCommandCurrency;
  amount: number;
  asOf?: string | null;
};

export type PayrollAnomalyStatus = {
  anomalyKey: string;
  status: "open" | "in_progress" | "resolved";
  ownerName?: string | null;
  note?: string | null;
  updatedAt?: unknown;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round4 = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

function rowKey(row: Pick<PayrollCommandRow, "entity" | "employeeName">): string {
  return `${row.entity}|${normalizePayrollEmployee(row.employeeName)}`;
}

function sum(rows: PayrollCommandRow[], predicate: (row: PayrollCommandRow) => boolean): number {
  return round2(rows.filter(predicate).reduce((total, row) => total + row.netPay, 0));
}

function rateForMonth(month: string, rates: PayrollCommandFxRate[]) {
  const actual = rates.find((item) => item.payrollMonth === month);
  return {
    rate: actual?.cnyToJpyRate || PAYROLL_REFERENCE_CNY_JPY,
    actualRate: actual?.cnyToJpyRate || null,
    sourceNote: actual?.sourceNote || null,
    rateType: actual ? "actual" as const : "reference" as const,
  };
}

function nextMonths(month: string, count: number): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(Date.UTC(year, monthNumber - 1 + index + 1, 1));
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function isGeneratedCashflowValid(row: PayrollCommandRow): boolean {
  return Boolean(
    row.cashflowId &&
    !row.cashflowDeletedAt &&
    row.cashflowType === "expense" &&
    row.cashflowCategory === "給与・人件費" &&
    row.cashflowAmount != null &&
    Math.abs(Number(row.cashflowAmount) - row.netPay) <= 0.01,
  );
}

type DynamicAnomaly = {
  key: string;
  severity: "high" | "medium" | "low";
  type: string;
  entity?: PayrollCommandEntity;
  payrollMonth?: string;
  employeeName?: string;
  title: string;
  detail: string;
};

export function buildPayrollCommandCenter(input: {
  rows: PayrollCommandRow[];
  budgets?: PayrollCommandBudget[];
  fxRates?: PayrollCommandFxRate[];
  balances?: PayrollCommandBalance[];
  anomalyStatuses?: PayrollAnomalyStatus[];
}) {
  const rows = input.rows;
  const budgets = input.budgets || [];
  const fxRates = input.fxRates || [];
  const balances = input.balances || [];
  const statuses = new Map((input.anomalyStatuses || []).map((item) => [item.anomalyKey, item]));
  const months = [...new Set(rows.map((row) => row.payrollMonth))].sort();
  const currentMonth = months.at(-1) || "";
  const previousMonth = months.at(-2) || "";
  const currentRows = rows.filter((row) => row.payrollMonth === currentMonth);
  const previousRows = rows.filter((row) => row.payrollMonth === previousMonth);
  const currentRate = rateForMonth(currentMonth, fxRates);
  const previousRate = rateForMonth(previousMonth, fxRates);
  const currentJpy = sum(currentRows, (row) => row.entity === "japan");
  const currentCny = sum(currentRows, (row) => row.entity === "china");
  const previousJpy = sum(previousRows, (row) => row.entity === "japan");
  const previousCny = sum(previousRows, (row) => row.entity === "china");
  const currentTotalJpy = round2(currentJpy + currentCny * currentRate.rate);
  const previousTotalJpy = round2(previousJpy + previousCny * previousRate.rate);
  const changeJpy = round2(currentTotalJpy - previousTotalJpy);
  const changePercent = previousTotalJpy ? round2(changeJpy * 100 / previousTotalJpy) : null;
  const currentEmployees = new Set(currentRows.map(rowKey));
  const previousEmployees = new Set(previousRows.map(rowKey));
  const priorCounts = months.slice(0, -1).map((month) => new Set(rows.filter((row) => row.payrollMonth === month).map(rowKey)).size);
  const priorMax = priorCounts.length ? Math.max(...priorCounts) : 0;
  const currentIncomplete = Boolean(priorMax && currentEmployees.size < priorMax * 0.6);

  const paidRows = currentRows.filter((row) => row.paid);
  const paidEmployees = new Set(paidRows.map(rowKey));
  const paidJpy = sum(paidRows, (row) => row.entity === "japan");
  const paidCny = sum(paidRows, (row) => row.entity === "china");
  const unpaidJpy = round2(currentJpy - paidJpy);
  const unpaidCny = round2(currentCny - paidCny);

  const currentByEmployee = new Map(currentRows.map((row) => [rowKey(row), row]));
  const previousByEmployee = new Map(previousRows.map((row) => [rowKey(row), row]));
  const changeKeys = new Set([...currentByEmployee.keys(), ...previousByEmployee.keys()]);
  const employeeChanges = [...changeKeys].map((key) => {
    const current = currentByEmployee.get(key);
    const previous = previousByEmployee.get(key);
    const row = current || previous!;
    const currentAmount = current?.netPay || 0;
    const previousAmount = previous?.netPay || 0;
    const difference = round2(currentAmount - previousAmount);
    const percent = previousAmount ? round2(difference * 100 / previousAmount) : null;
    const status = !previous ? "new" : !current ? "missing" : difference > 0 ? "increased" : difference < 0 ? "decreased" : "unchanged";
    return {
      key,
      entity: row.entity,
      currency: row.currency,
      employeeName: row.employeeName,
      wechatName: current?.wechatName || previous?.wechatName || "",
      department: current?.department || previous?.department || "",
      currentAmount,
      previousAmount,
      difference,
      percent,
      status,
      warning: status === "missing" && currentIncomplete ? "最新月は未完了の可能性があるため、退職とは判定しません" : null,
    };
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  const budgetRows = (["japan", "china"] as PayrollCommandEntity[]).map((entity) => {
    const budget = budgets.find((item) => item.entity === entity && item.payrollMonth === currentMonth);
    const actual = entity === "japan" ? currentJpy : currentCny;
    const difference = budget ? round2(actual - budget.budgetAmount) : null;
    return {
      entity,
      currency: entity === "japan" ? "JPY" as const : "CNY" as const,
      actual,
      budget: budget?.budgetAmount ?? null,
      difference,
      overrunPercent: budget && budget.budgetAmount > 0 ? round2((difference || 0) * 100 / budget.budgetAmount) : null,
    };
  });

  const completeMonths = currentIncomplete ? months.slice(0, -1) : months;
  const baseByEntity = (["japan", "china"] as PayrollCommandEntity[]).map((entity) => {
    const positive = completeMonths.map((month) => ({
      month,
      amount: sum(rows.filter((row) => row.payrollMonth === month), (row) => row.entity === entity),
    })).filter((item) => item.amount > 0).slice(-3);
    const monthlyBase = positive.length ? round2(positive.reduce((total, item) => total + item.amount, 0) / positive.length) : 0;
    return { entity, currency: entity === "japan" ? "JPY" as const : "CNY" as const, monthlyBase, sampleMonths: positive.map((item) => item.month) };
  });
  const forecastRate = currentRate.rate;
  const jpyBase = baseByEntity.find((item) => item.entity === "japan")?.monthlyBase || 0;
  const cnyBase = baseByEntity.find((item) => item.entity === "china")?.monthlyBase || 0;
  const monthlyReferenceJpy = round2(jpyBase + cnyBase * forecastRate);
  const forecast = {
    confidence: months.length >= 6 ? "medium" as const : "low" as const,
    method: "最近最多3个正值完整月份的简单平均",
    currentMonthIncomplete: currentIncomplete,
    bases: baseByEntity,
    months: nextMonths(currentMonth, 6).map((month, index) => ({ month, horizon: index + 1, jpy: jpyBase, cny: cnyBase, referenceJpy: monthlyReferenceJpy })),
    threeMonthReferenceJpy: round2(monthlyReferenceJpy * 3),
    sixMonthReferenceJpy: round2(monthlyReferenceJpy * 6),
  };

  const balanceJpy = round2(balances.filter((item) => item.entity === "japan").reduce((total, item) => total + item.amount, 0));
  const balanceCny = round2(balances.filter((item) => item.entity === "china").reduce((total, item) => total + item.amount, 0));
  const balanceAsOf = balances.map((item) => item.asOf).filter(Boolean).sort().at(-1) || null;
  const runway = {
    japanMonths: jpyBase > 0 ? round2(balanceJpy / jpyBase) : null,
    chinaMonths: cnyBase > 0 ? round2(balanceCny / cnyBase) : null,
    combinedReferenceMonths: monthlyReferenceJpy > 0 ? round2((balanceJpy + balanceCny * forecastRate) / monthlyReferenceJpy) : null,
    balanceJpy,
    balanceCny,
    balanceAsOf,
    monthlyJpyBase: jpyBase,
    monthlyCnyBase: cnyBase,
    rate: forecastRate,
    rateType: currentRate.rateType,
  };

  const departmentMap = new Map<string, { department: string; employeeKeys: Set<string>; jpy: number; cny: number }>();
  for (const row of currentRows) {
    const department = String(row.department || "未设定").trim() || "未设定";
    const item = departmentMap.get(department) || { department, employeeKeys: new Set<string>(), jpy: 0, cny: 0 };
    item.employeeKeys.add(rowKey(row));
    if (row.entity === "japan") item.jpy += row.netPay;
    else item.cny += row.netPay;
    departmentMap.set(department, item);
  }
  const departmentCosts = [...departmentMap.values()].map((item) => ({
    department: item.department,
    employeeCount: item.employeeKeys.size,
    jpy: round2(item.jpy),
    cny: round2(item.cny),
    referenceJpy: round2(item.jpy + item.cny * currentRate.rate),
    sharePercent: currentTotalJpy > 0 ? round2((item.jpy + item.cny * currentRate.rate) * 100 / currentTotalJpy) : 0,
  })).sort((a, b) => b.referenceJpy - a.referenceJpy);

  const anomalies: DynamicAnomaly[] = [];
  for (const row of rows) {
    if (!isGeneratedCashflowValid(row)) {
      anomalies.push({
        key: `cashflow_mismatch|${row.entity}|${row.payrollMonth}|${normalizePayrollEmployee(row.employeeName)}`,
        severity: "high", type: "cashflow_mismatch", entity: row.entity, payrollMonth: row.payrollMonth, employeeName: row.employeeName,
        title: "工资与现金流不一致", detail: `${row.employeeName} ${row.payrollMonth} 的工资金额、分类或现金流关联需要确认`,
      });
    }
  }
  const duplicateMap = new Map<string, PayrollCommandRow[]>();
  for (const row of rows) {
    const key = `${row.entity}|${row.payrollMonth}|${normalizePayrollEmployee(row.employeeName)}`;
    duplicateMap.set(key, [...(duplicateMap.get(key) || []), row]);
  }
  for (const [key, duplicateRows] of duplicateMap) {
    if (duplicateRows.length < 2) continue;
    const row = duplicateRows[0];
    anomalies.push({ key: `duplicate|${key}`, severity: "high", type: "duplicate", entity: row.entity, payrollMonth: row.payrollMonth, employeeName: row.employeeName, title: "工资记录重复", detail: `${row.employeeName} ${row.payrollMonth} 存在${duplicateRows.length}条记录` });
  }
  for (const row of rows.filter((item) => !item.paid)) {
    const historical = row.payrollMonth !== currentMonth;
    anomalies.push({ key: `unpaid|${row.entity}|${row.payrollMonth}|${normalizePayrollEmployee(row.employeeName)}`, severity: historical ? "medium" : "low", type: historical ? "historical_unpaid" : "current_unpaid", entity: row.entity, payrollMonth: row.payrollMonth, employeeName: row.employeeName, title: historical ? "历史工资尚未匹配银行付款" : "本月工资尚未匹配银行付款", detail: `${row.employeeName} ${row.payrollMonth} 尚未匹配权威银行付款` });
  }
  for (const row of currentRows) {
    if (!row.department) anomalies.push({ key: `missing_department|${row.entity}|${normalizePayrollEmployee(row.employeeName)}`, severity: "low", type: "missing_department", entity: row.entity, payrollMonth: currentMonth, employeeName: row.employeeName, title: "员工部门未设定", detail: `${row.employeeName} 尚未设置部门` });
    if (!row.wechatName) anomalies.push({ key: `missing_wechat|${row.entity}|${normalizePayrollEmployee(row.employeeName)}`, severity: "low", type: "missing_wechat", entity: row.entity, payrollMonth: currentMonth, employeeName: row.employeeName, title: "员工微信名未设定", detail: `${row.employeeName} 尚未设置微信显示名` });
  }
  for (const change of employeeChanges) {
    if (change.status === "missing" && currentIncomplete) continue;
    const threshold = change.currency === "JPY" ? 50000 : 500;
    if (change.percent != null && Math.abs(change.percent) >= 30 && Math.abs(change.difference) >= threshold) {
      anomalies.push({ key: `pay_change|${change.entity}|${currentMonth}|${normalizePayrollEmployee(change.employeeName)}`, severity: "medium", type: "pay_change", entity: change.entity, payrollMonth: currentMonth, employeeName: change.employeeName, title: "工资环比变化较大", detail: `${change.employeeName} 较${previousMonth}变化${change.difference >= 0 ? "+" : ""}${change.difference} ${change.currency}（${change.percent}%）` });
    }
  }
  for (const budget of budgetRows) {
    if (budget.budget == null) {
      anomalies.push({ key: `missing_budget|${budget.entity}|${currentMonth}`, severity: "low", type: "missing_budget", entity: budget.entity, payrollMonth: currentMonth, title: "本月工资预算未设定", detail: `${budget.entity === "japan" ? "日本" : "中国"} ${currentMonth} 预算未设定` });
    } else if ((budget.difference || 0) > 0) {
      anomalies.push({ key: `budget_overrun|${budget.entity}|${currentMonth}`, severity: "medium", type: "budget_overrun", entity: budget.entity, payrollMonth: currentMonth, title: "本月工资超过预算", detail: `${budget.entity === "japan" ? "日本" : "中国"} 超出预算${budget.difference} ${budget.currency}` });
    }
  }
  if (!currentRate.actualRate) anomalies.push({ key: `missing_fx|${currentMonth}`, severity: "low", type: "missing_fx", payrollMonth: currentMonth, title: "本月实际汇率未登记", detail: `当前使用参考汇率1 CNY≈${PAYROLL_REFERENCE_CNY_JPY} JPY` });
  if (currentIncomplete) anomalies.push({ key: `incomplete_month|${currentMonth}`, severity: "medium", type: "incomplete_month", payrollMonth: currentMonth, title: "最新月份可能尚未完整导入", detail: `${currentMonth} 当前${currentEmployees.size}人，低于历史月份规模，请勿直接按完整月解读环比` });

  const severityOrder = { high: 0, medium: 1, low: 2 } as const;
  const mergedAnomalies = anomalies.map((item) => ({
    ...item,
    status: statuses.get(item.key)?.status || "open",
    ownerName: statuses.get(item.key)?.ownerName || "",
    note: statuses.get(item.key)?.note || "",
    updatedAt: statuses.get(item.key)?.updatedAt || null,
  })).sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const activeAnomalies = mergedAnomalies.filter((item) => item.status !== "resolved");
  const dataCompletenessTypes = new Set(["missing_budget", "missing_department", "missing_fx", "missing_wechat"]);
  const currentActionTypes = new Set(["cashflow_mismatch", "duplicate", "current_unpaid", "pay_change", "budget_overrun"]);

  return {
    currentMonth,
    previousMonth,
    currentMonthIncomplete: currentIncomplete,
    exchangeRate: {
      ...currentRate,
      referenceRate: PAYROLL_REFERENCE_CNY_JPY,
      currentCnyReferenceJpy: round2(currentCny * PAYROLL_REFERENCE_CNY_JPY),
      currentCnyActualJpy: currentRate.actualRate ? round2(currentCny * currentRate.actualRate) : null,
      actualVsReferenceDifferenceJpy: currentRate.actualRate ? round2(currentCny * (currentRate.actualRate - PAYROLL_REFERENCE_CNY_JPY)) : null,
    },
    summary: {
      currentJpy, currentCny, currentTotalJpy, previousJpy, previousCny, previousTotalJpy,
      changeJpy, changePercent, employeeCount: currentEmployees.size, previousEmployeeCount: previousEmployees.size,
      recordCount: currentRows.length,
      paidCount: paidEmployees.size, unpaidCount: Math.max(0, currentEmployees.size - paidEmployees.size),
      bankUnmatchedCount: currentRows.filter((row) => !row.paid).length,
      paymentProgress: currentEmployees.size ? round2(paidEmployees.size * 100 / currentEmployees.size) : 0,
      paidJpy, paidCny, unpaidJpy, unpaidCny,
    },
    employeeChanges,
    budgets: budgetRows,
    forecast,
    runway,
    departmentCosts,
    anomalies: mergedAnomalies,
    anomalyCounts: {
      open: mergedAnomalies.filter((item) => item.status === "open").length,
      inProgress: mergedAnomalies.filter((item) => item.status === "in_progress").length,
      resolved: mergedAnomalies.filter((item) => item.status === "resolved").length,
      high: mergedAnomalies.filter((item) => item.severity === "high" && item.status !== "resolved").length,
      currentAction: activeAnomalies.filter((item) => currentActionTypes.has(item.type)).length,
      currentUnpaid: activeAnomalies.filter((item) => item.type === "current_unpaid").length,
      payChange: activeAnomalies.filter((item) => item.type === "pay_change").length,
      historicalBacklog: activeAnomalies.filter((item) => item.type === "historical_unpaid").length,
      dataCompleteness: activeAnomalies.filter((item) => dataCompletenessTypes.has(item.type)).length,
      incompleteMonth: activeAnomalies.filter((item) => item.type === "incomplete_month").length,
    },
  };
}
