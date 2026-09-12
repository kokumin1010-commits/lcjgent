import type { buildIpoReadinessCommandCenter } from "./ipoReadinessCommandCenter";

export type IpoReadinessCore = ReturnType<typeof buildIpoReadinessCommandCenter>;

export type IpoMonthlyPlanRecord = {
  month: string;
  revenueTargetJpy: number | null;
  grossProfitTargetJpy: number | null;
  operatingProfitTargetJpy: number | null;
  note?: string | null;
};

export type IpoPlanningSettings = {
  targetOperatingMarginPct: number | null;
  downsideFactor: number;
  baseFactor: number;
  upsideFactor: number;
  monthlyCloseDueDay: number;
};

export type IpoTaskRecord = {
  id: number;
  workstream: string;
  title: string;
  description?: string | null;
  ownerName?: string | null;
  priority: string;
  status: string;
  progress: number;
  dueDate?: string | null;
  blocker?: string | null;
  evidence: Array<{ label: string; url: string }>;
};

export type IpoCashExpenseCategory = {
  category: string;
  currency: "JPY" | "CNY";
  amount: number;
  referenceJpy: number;
  recordCount: number;
};

function monthIndex(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  return year * 12 + monthValue - 1;
}

function monthSequence(startMonth: string, endMonth: string) {
  const result: string[] = [];
  for (let index = monthIndex(startMonth); index <= monthIndex(endMonth); index += 1) {
    result.push(`${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`);
  }
  return result;
}

function addMonths(month: string, count: number) {
  const index = monthIndex(month) + count;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function closeDueDate(month: string, dueDay: number) {
  const next = addMonths(month, 1);
  const [year, monthValue] = next.split("-").map(Number);
  const day = Math.min(Math.max(1, Math.trunc(dueDay)), daysInMonth(year, monthValue));
  return `${next}-${String(day).padStart(2, "0")}`;
}

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function exactEqualAllocation(total: number, index: number, count: number) {
  return round(total * (index + 1) / count) - round(total * index / count);
}

export function buildIpoMonthlyTrend(input: {
  core: IpoReadinessCore;
  monthlyPlans: IpoMonthlyPlanRecord[];
}) {
  const startMonth = input.core.currentStage.startDate.slice(0, 7);
  const endMonth = input.core.currentStage.endDate.slice(0, 7);
  const months = monthSequence(startMonth, endMonth);
  const target = input.core.currentStage.targetOperatingProfitJpy;
  const plansByMonth = new Map(input.monthlyPlans.map((row) => [row.month, row]));
  const pnlByMonth = new Map(input.core.monthlyPnl.map((row) => [row.month, row]));
  const cashByMonth = new Map(input.core.cashReference.monthly.map((row) => [row.month, row]));
  const overriddenTotal = months.reduce((sum, month) => {
    const value = plansByMonth.get(month)?.operatingProfitTargetJpy;
    return value == null ? sum : sum + round(value);
  }, 0);
  const automaticMonths = months.filter((month) => plansByMonth.get(month)?.operatingProfitTargetJpy == null);
  const automaticTarget = target == null ? null : Math.max(0, target - overriddenTotal);
  let automaticIndex = 0;
  let cumulativePlanJpy = 0;
  let cumulativeFormalJpy = 0;
  let cumulativeCashReferenceJpy = 0;
  return months.map((month) => {
    const override = plansByMonth.get(month);
    const pnl = pnlByMonth.get(month);
    const cash = cashByMonth.get(month);
    const hasOverride = override?.operatingProfitTargetJpy != null;
    const planOperatingProfitJpy = hasOverride
      ? round(override.operatingProfitTargetJpy as number)
      : automaticTarget == null || automaticMonths.length === 0 ? null : exactEqualAllocation(automaticTarget, automaticIndex++, automaticMonths.length);
    if (planOperatingProfitJpy != null) cumulativePlanJpy += planOperatingProfitJpy;
    const finalized = pnl?.status === "closed" || pnl?.status === "audited";
    const formalRevenueJpy = finalized ? round(pnl.revenueJpy) : null;
    const formalGrossProfitJpy = finalized ? round(pnl.grossProfitJpy) : null;
    const formalOperatingProfitJpy = finalized ? round(pnl.operatingProfitJpy) : null;
    if (formalOperatingProfitJpy != null) cumulativeFormalJpy += formalOperatingProfitJpy;
    const cashOperatingNetReferenceJpy = cash ? round(cash.operatingNetReferenceJpy) : null;
    if (cashOperatingNetReferenceJpy != null) cumulativeCashReferenceJpy += cashOperatingNetReferenceJpy;
    return {
      month,
      revenueTargetJpy: override?.revenueTargetJpy ?? null,
      grossProfitTargetJpy: override?.grossProfitTargetJpy ?? null,
      planOperatingProfitJpy,
      planSource: hasOverride ? "monthly_override" as const : "equal_company_plan" as const,
      formalRevenueJpy,
      formalGrossProfitJpy,
      formalOperatingProfitJpy,
      revenueVarianceJpy: formalRevenueJpy == null || override?.revenueTargetJpy == null ? null : formalRevenueJpy - round(override.revenueTargetJpy),
      grossProfitVarianceJpy: formalGrossProfitJpy == null || override?.grossProfitTargetJpy == null ? null : formalGrossProfitJpy - round(override.grossProfitTargetJpy),
      draftOperatingProfitJpy: pnl?.status === "draft" ? round(pnl.operatingProfitJpy) : null,
      formalStatus: pnl?.status || "missing" as const,
      cashOperatingNetReferenceJpy,
      cumulativePlanJpy,
      cumulativeFormalJpy,
      cumulativeCashReferenceJpy,
      formalVarianceJpy: formalOperatingProfitJpy == null || planOperatingProfitJpy == null ? null : formalOperatingProfitJpy - planOperatingProfitJpy,
      cashReferenceVarianceJpy: cashOperatingNetReferenceJpy == null || planOperatingProfitJpy == null ? null : cashOperatingNetReferenceJpy - planOperatingProfitJpy,
      note: override?.note || null,
    };
  });
}

export function buildIpoCloseCalendar(input: {
  core: IpoReadinessCore;
  monthlyCloseDueDay: number;
}) {
  const asOf = input.core.asOf;
  const trend = buildIpoMonthlyTrend({ core: input.core, monthlyPlans: [] });
  return trend.map((row) => {
    const dueDate = closeDueDate(row.month, input.monthlyCloseDueDay);
    const expected = row.month < input.core.asOfMonth;
    const isFinalized = row.formalStatus === "closed" || row.formalStatus === "audited";
    return {
      month: row.month,
      status: row.formalStatus,
      dueDate,
      expected,
      isFinalized,
      overdue: expected && !isFinalized && dueDate < asOf,
    };
  });
}

export function buildIpoTargetReverse(input: {
  core: IpoReadinessCore;
  settings: IpoPlanningSettings;
}) {
  const marginPct = input.settings.targetOperatingMarginPct;
  const marginRate = marginPct != null && marginPct > 0 ? marginPct / 100 : null;
  const remainingOperatingProfitJpy = input.core.pace.targetGapJpy;
  const remainingMonths = input.core.pace.remainingMonths;
  const requiredRemainingRevenueJpy = marginRate != null && remainingOperatingProfitJpy != null
    ? round(remainingOperatingProfitJpy / marginRate)
    : null;
  return {
    remainingOperatingProfitJpy,
    remainingMonths,
    requiredMonthlyOperatingProfitJpy: input.core.pace.requiredMonthlyOperatingProfitJpy,
    targetOperatingMarginPct: marginPct,
    requiredRemainingRevenueJpy,
    requiredMonthlyRevenueJpy: requiredRemainingRevenueJpy == null || remainingMonths === 0
      ? null
      : round(requiredRemainingRevenueJpy / remainingMonths),
    ready: marginRate != null && remainingOperatingProfitJpy != null && remainingMonths > 0,
    basis: "company_plan_minus_formal_operating_profit" as const,
  };
}

export function buildIpoScenarios(input: {
  core: IpoReadinessCore;
  settings: IpoPlanningSettings;
}) {
  const factors = [
    { key: "downside" as const, label: "保守", factor: input.settings.downsideFactor },
    { key: "base" as const, label: "当前", factor: input.settings.baseFactor },
    { key: "upside" as const, label: "冲刺", factor: input.settings.upsideFactor },
  ];
  const formalAverage = input.core.pace.averageFinalizedOperatingProfitJpy;
  const formalActual = input.core.actual.formalOperatingProfitJpy;
  const formalRemainingMonths = input.core.pace.remainingMonths;
  const cashMonthCount = input.core.cashReference.completedMonthCount;
  const cashAverage = cashMonthCount > 0
    ? input.core.cashReference.completedOperatingNetReferenceJpy / cashMonthCount
    : null;
  const cashRemainingMonths = input.core.cashReference.remainingMonths;
  const target = input.core.pace.targetOperatingProfitJpy;
  return {
    formalReady: formalAverage != null && input.core.actual.finalizedMonthCount > 0,
    cashReferenceReady: cashAverage != null,
    formalAverageMonthlyOperatingProfitJpy: formalAverage,
    cashAverageMonthlyOperatingNetReferenceJpy: cashAverage == null ? null : round(cashAverage),
    scenarios: factors.map((scenario) => {
      const formalProjectedOperatingProfitJpy = formalAverage == null
        ? null
        : round(formalActual + formalAverage * scenario.factor * formalRemainingMonths);
      const cashReferenceProjectedJpy = cashAverage == null
        ? null
        : round(input.core.cashReference.completedOperatingNetReferenceJpy + cashAverage * scenario.factor * cashRemainingMonths);
      return {
        ...scenario,
        formalProjectedOperatingProfitJpy,
        formalGapJpy: formalProjectedOperatingProfitJpy == null || target == null ? null : formalProjectedOperatingProfitJpy - target,
        cashReferenceProjectedJpy,
        cashReferenceGapJpy: cashReferenceProjectedJpy == null || target == null ? null : cashReferenceProjectedJpy - target,
      };
    }),
    disclaimer: "情景为当前月均速度的敏感度计算，不是公司承诺；现金情景不等于会计利润。",
  };
}

export function buildIpoProfitBridge(core: IpoReadinessCore) {
  if (core.actual.finalizedMonthCount === 0) {
    return {
      ready: false,
      revenueJpy: null,
      costOfSalesJpy: null,
      grossProfitJpy: null,
      operatingExpensesJpy: null,
      operatingProfitJpy: null,
      netProfitJpy: null,
      grossMarginPct: null,
      operatingMarginPct: null,
      basis: "formal_monthly_pnl" as const,
    };
  }
  const revenueJpy = core.actual.formalRevenueJpy;
  const grossProfitJpy = core.actual.formalGrossProfitJpy;
  const operatingProfitJpy = core.actual.formalOperatingProfitJpy;
  const costOfSalesJpy = revenueJpy - grossProfitJpy;
  const operatingExpensesJpy = grossProfitJpy - operatingProfitJpy;
  return {
    ready: true,
    revenueJpy,
    costOfSalesJpy,
    grossProfitJpy,
    operatingExpensesJpy,
    operatingProfitJpy,
    netProfitJpy: core.actual.formalNetProfitJpy,
    grossMarginPct: revenueJpy === 0 ? null : grossProfitJpy / revenueJpy * 100,
    operatingMarginPct: revenueJpy === 0 ? null : operatingProfitJpy / revenueJpy * 100,
    basis: "formal_monthly_pnl" as const,
  };
}

export function buildIpoCloseQuality(input: {
  core: IpoReadinessCore;
  monthlyCloseDueDay: number;
}) {
  const calendar = buildIpoCloseCalendar(input);
  const expectedRows = calendar.filter((row) => row.expected);
  const finalizedRows = expectedRows.filter((row) => row.isFinalized);
  const overdueRows = expectedRows.filter((row) => row.overdue);
  const draftRows = expectedRows.filter((row) => row.status === "draft");
  const missingRows = expectedRows.filter((row) => row.status === "missing");
  return {
    calendar,
    expectedMonthCount: expectedRows.length,
    finalizedMonthCount: finalizedRows.length,
    closeCompletionRate: expectedRows.length === 0 ? null : finalizedRows.length / expectedRows.length,
    overdueMonths: overdueRows.map((row) => row.month),
    draftMonths: draftRows.map((row) => row.month),
    missingMonths: missingRows.map((row) => row.month),
    nextRequiredAction: overdueRows[0]
      ? `${overdueRows[0].month}月次P/Lを月結または审计状态にする`
      : draftRows[0]
        ? `${draftRows[0].month}草稿を确认して月结する`
        : missingRows[0]
          ? `${missingRows[0].month}月次P/Lを登记する`
          : null,
  };
}

export function buildIpoCashExpenseDrivers(categories: IpoCashExpenseCategory[]) {
  const grouped = new Map<string, IpoCashExpenseCategory>();
  for (const row of categories) {
    if (!Number.isFinite(row.referenceJpy) || row.referenceJpy <= 0) continue;
    const key = `${row.category}\u0000${row.currency}`;
    const current = grouped.get(key) || { category: row.category, currency: row.currency, amount: 0, referenceJpy: 0, recordCount: 0 };
    current.amount += Number(row.amount || 0);
    current.referenceJpy += Number(row.referenceJpy || 0);
    current.recordCount += Number(row.recordCount || 0);
    grouped.set(key, current);
  }
  const rows = [...grouped.values()]
    .sort((left, right) => right.referenceJpy - left.referenceJpy || left.category.localeCompare(right.category));
  const totalReferenceJpy = round(rows.reduce((sum, row) => sum + row.referenceJpy, 0));
  return {
    totalReferenceJpy,
    rows: rows.slice(0, 8).map((row) => ({
      ...row,
      amount: Number(row.amount),
      referenceJpy: round(row.referenceJpy),
      recordCount: Number(row.recordCount || 0),
      share: totalReferenceJpy > 0 ? row.referenceJpy / totalReferenceJpy : null,
    })),
    basis: "bank_operating_cash_expense_reference" as const,
    disclaimer: "银行现金支出分类用于经营核对，不等于正式会计费用。",
  };
}

export function buildIpoTaskReadiness(input: {
  tasks: IpoTaskRecord[];
  asOf: string;
}) {
  const activeTasks = input.tasks.filter((task) => task.status !== "done");
  const completedTasks = input.tasks.filter((task) => task.status === "done");
  const withEvidence = input.tasks.filter((task) => task.evidence.length > 0);
  const completedWithoutEvidence = completedTasks.filter((task) => task.evidence.length === 0);
  const overdue = activeTasks.filter((task) => task.dueDate != null && task.dueDate < input.asOf);
  const blocked = activeTasks.filter((task) => task.status === "blocked");
  const ownerMissing = activeTasks.filter((task) => !task.ownerName);
  const dueDateMissing = activeTasks.filter((task) => !task.dueDate);
  const workstreamMap = new Map<string, IpoTaskRecord[]>();
  for (const task of input.tasks) {
    const rows = workstreamMap.get(task.workstream) || [];
    rows.push(task);
    workstreamMap.set(task.workstream, rows);
  }
  const workstreams = Array.from(workstreamMap.entries()).map(([workstream, tasks]) => {
    const doneCount = tasks.filter((task) => task.status === "done").length;
    const evidenceCount = tasks.filter((task) => task.evidence.length > 0).length;
    return {
      workstream,
      totalCount: tasks.length,
      doneCount,
      blockedCount: tasks.filter((task) => task.status === "blocked").length,
      overdueCount: tasks.filter((task) => task.status !== "done" && task.dueDate != null && task.dueDate < input.asOf).length,
      completionRate: tasks.length === 0 ? null : doneCount / tasks.length,
      evidenceCoverageRate: tasks.length === 0 ? null : evidenceCount / tasks.length,
    };
  });
  return {
    totalCount: input.tasks.length,
    completedCount: completedTasks.length,
    activeCount: activeTasks.length,
    blockedCount: blocked.length,
    overdueCount: overdue.length,
    withEvidenceCount: withEvidence.length,
    completedWithoutEvidenceCount: completedWithoutEvidence.length,
    ownerMissingCount: ownerMissing.length,
    dueDateMissingCount: dueDateMissing.length,
    completionRate: input.tasks.length === 0 ? null : completedTasks.length / input.tasks.length,
    evidenceCoverageRate: input.tasks.length === 0 ? null : withEvidence.length / input.tasks.length,
    overdueTaskIds: overdue.map((task) => task.id),
    blockedTaskIds: blocked.map((task) => task.id),
    completedWithoutEvidenceTaskIds: completedWithoutEvidence.map((task) => task.id),
    workstreams,
  };
}

export function buildIpoRiskRegister(input: {
  core: IpoReadinessCore;
  closeQuality: ReturnType<typeof buildIpoCloseQuality>;
  taskReadiness: ReturnType<typeof buildIpoTaskReadiness>;
}) {
  const risks: Array<{
    key: string;
    severity: "critical" | "high" | "medium";
    title: string;
    detail: string;
    action: string;
  }> = [];
  if (input.core.actual.finalizedMonthCount === 0) {
    risks.push({
      key: "formal_pnl_missing",
      severity: "critical",
      title: "正式月次P/L未登记",
      detail: "上场业绩完成率和正式情景预测无法判断。",
      action: "完成最近月份的销售、毛利、营业利润月结。",
    });
  }
  if (input.closeQuality.overdueMonths.length > 0) {
    risks.push({
      key: "monthly_close_overdue",
      severity: "critical",
      title: "月结逾期",
      detail: `${input.closeQuality.overdueMonths.join("、")} 尚未完成月结。`,
      action: input.closeQuality.nextRequiredAction || "完成月结。",
    });
  }
  if (input.taskReadiness.blockedCount > 0) {
    risks.push({
      key: "blocked_tasks",
      severity: "high",
      title: "上场准备任务受阻",
      detail: `${input.taskReadiness.blockedCount}项任务标记为受阻。`,
      action: "明确阻塞原因、决策人和解除日期。",
    });
  }
  if (input.taskReadiness.overdueCount > 0) {
    risks.push({
      key: "overdue_tasks",
      severity: "high",
      title: "上场准备任务逾期",
      detail: `${input.taskReadiness.overdueCount}项未完成任务超过期限。`,
      action: "重设责任人与截止日，或记录正式延期理由。",
    });
  }
  if (input.taskReadiness.completedWithoutEvidenceCount > 0) {
    risks.push({
      key: "completed_without_evidence",
      severity: "high",
      title: "完成项缺少证据",
      detail: `${input.taskReadiness.completedWithoutEvidenceCount}项已完成任务没有证据链接。`,
      action: "补充可验证的制度、议事录、合同或审计资料链接。",
    });
  }
  if (input.taskReadiness.ownerMissingCount > 0 || input.taskReadiness.dueDateMissingCount > 0) {
    risks.push({
      key: "task_governance_missing",
      severity: "medium",
      title: "任务责任与期限未完整设置",
      detail: `未设负责人${input.taskReadiness.ownerMissingCount}项，未设期限${input.taskReadiness.dueDateMissingCount}项。`,
      action: "为所有进行中任务指定单一负责人和截止日。",
    });
  }
  return risks;
}

export function buildIpoBoardReportSummary(input: {
  core: IpoReadinessCore;
  trend: ReturnType<typeof buildIpoMonthlyTrend>;
  targetReverse: ReturnType<typeof buildIpoTargetReverse>;
  performanceVariance: ReturnType<typeof buildIpoPerformanceVariance>;
  scenarios: ReturnType<typeof buildIpoScenarios>;
  profitBridge: ReturnType<typeof buildIpoProfitBridge>;
  closeQuality: ReturnType<typeof buildIpoCloseQuality>;
  taskReadiness: ReturnType<typeof buildIpoTaskReadiness>;
  risks: ReturnType<typeof buildIpoRiskRegister>;
  cashExpenseDrivers: ReturnType<typeof buildIpoCashExpenseDrivers>;
}) {
  return {
    schemaVersion: 1,
    asOf: input.core.asOf,
    asOfMonth: input.core.asOfMonth,
    fiscalYearLabel: input.core.fiscalYearLabel,
    stage: {
      key: input.core.currentStage.key,
      label: input.core.currentStage.label,
      periodLabel: input.core.currentStage.periodLabel,
      targetOperatingProfitJpy: input.core.currentStage.targetOperatingProfitJpy,
    },
    formalPerformance: {
      operatingProfitJpy: input.core.actual.formalOperatingProfitJpy,
      revenueJpy: input.core.actual.formalRevenueJpy,
      grossProfitJpy: input.core.actual.formalGrossProfitJpy,
      finalizedMonthCount: input.core.actual.finalizedMonthCount,
      dataStatus: input.core.actual.dataStatus,
      targetGapJpy: input.core.pace.targetGapJpy,
      requiredMonthlyOperatingProfitJpy: input.core.pace.requiredMonthlyOperatingProfitJpy,
      projectedOperatingProfitJpy: input.core.pace.projectedOperatingProfitJpy,
    },
    cashReference: {
      completedOperatingNetReferenceJpy: input.core.cashReference.completedOperatingNetReferenceJpy,
      completedMonthCount: input.core.cashReference.completedMonthCount,
      targetGapReferenceJpy: input.core.cashReference.targetGapReferenceJpy,
      requiredMonthlyReferenceJpy: input.core.cashReference.requiredMonthlyReferenceJpy,
      basis: input.core.cashReference.basis,
    },
    targetReverse: input.targetReverse,
    performanceVariance: input.performanceVariance,
    scenarios: input.scenarios,
    profitBridge: input.profitBridge,
    closeQuality: {
      expectedMonthCount: input.closeQuality.expectedMonthCount,
      finalizedMonthCount: input.closeQuality.finalizedMonthCount,
      closeCompletionRate: input.closeQuality.closeCompletionRate,
      overdueMonths: input.closeQuality.overdueMonths,
      draftMonths: input.closeQuality.draftMonths,
      missingMonths: input.closeQuality.missingMonths,
    },
    readiness: input.taskReadiness,
    risks: input.risks,
    topCashExpenseDrivers: input.cashExpenseDrivers.rows,
    monthlyTrend: input.trend,
    disclaimers: [
      "正式业绩仅使用月结或审计状态的月次P/L。",
      "银行经营现金与分类支出仅为管理参考，不等于会计利润或费用。",
      "情景预测为敏感度计算，不是公司承诺或上市保证。",
    ],
  };
}

export function buildIpoPerformanceVariance(trend: ReturnType<typeof buildIpoMonthlyTrend>) {
  const formalRows = trend.filter((row) => row.formalOperatingProfitJpy != null);
  const revenueRows = formalRows.filter((row) => row.revenueTargetJpy != null && row.formalRevenueJpy != null);
  const grossProfitRows = formalRows.filter((row) => row.grossProfitTargetJpy != null && row.formalGrossProfitJpy != null);
  const operatingRows = formalRows.filter((row) => row.planOperatingProfitJpy != null);
  const revenueTargetJpy = round(revenueRows.reduce((sum, row) => sum + Number(row.revenueTargetJpy || 0), 0));
  const formalRevenueJpy = round(revenueRows.reduce((sum, row) => sum + Number(row.formalRevenueJpy || 0), 0));
  const grossProfitTargetJpy = round(grossProfitRows.reduce((sum, row) => sum + Number(row.grossProfitTargetJpy || 0), 0));
  const formalGrossProfitJpy = round(grossProfitRows.reduce((sum, row) => sum + Number(row.formalGrossProfitJpy || 0), 0));
  const operatingProfitTargetJpy = round(operatingRows.reduce((sum, row) => sum + Number(row.planOperatingProfitJpy || 0), 0));
  const formalOperatingProfitJpy = round(operatingRows.reduce((sum, row) => sum + Number(row.formalOperatingProfitJpy || 0), 0));
  const expenseRows = formalRows.filter((row) => row.grossProfitTargetJpy != null && row.planOperatingProfitJpy != null && row.formalGrossProfitJpy != null);
  const plannedOperatingExpensesJpy = round(expenseRows.reduce((sum, row) => sum + Number(row.grossProfitTargetJpy || 0) - Number(row.planOperatingProfitJpy || 0), 0));
  const formalOperatingExpensesJpy = round(expenseRows.reduce((sum, row) => sum + Number(row.formalGrossProfitJpy || 0) - Number(row.formalOperatingProfitJpy || 0), 0));
  return {
    formalMonthCount: formalRows.length,
    revenue: {
      ready: revenueRows.length > 0,
      monthCount: revenueRows.length,
      targetJpy: revenueRows.length ? revenueTargetJpy : null,
      actualJpy: revenueRows.length ? formalRevenueJpy : null,
      varianceJpy: revenueRows.length ? formalRevenueJpy - revenueTargetJpy : null,
    },
    grossProfit: {
      ready: grossProfitRows.length > 0,
      monthCount: grossProfitRows.length,
      targetJpy: grossProfitRows.length ? grossProfitTargetJpy : null,
      actualJpy: grossProfitRows.length ? formalGrossProfitJpy : null,
      varianceJpy: grossProfitRows.length ? formalGrossProfitJpy - grossProfitTargetJpy : null,
    },
    operatingExpenses: {
      ready: expenseRows.length > 0,
      monthCount: expenseRows.length,
      targetJpy: expenseRows.length ? plannedOperatingExpensesJpy : null,
      actualJpy: expenseRows.length ? formalOperatingExpensesJpy : null,
      varianceJpy: expenseRows.length ? plannedOperatingExpensesJpy - formalOperatingExpensesJpy : null,
    },
    operatingProfit: {
      ready: operatingRows.length > 0,
      monthCount: operatingRows.length,
      targetJpy: operatingRows.length ? operatingProfitTargetJpy : null,
      actualJpy: operatingRows.length ? formalOperatingProfitJpy : null,
      varianceJpy: operatingRows.length ? formalOperatingProfitJpy - operatingProfitTargetJpy : null,
    },
    basis: "monthly_plan_vs_formal_pnl" as const,
    disclaimer: "只有同时登记月度目标和月结／审计P/L的月份才计入差额；银行分类仅在另一模块作为现金参考显示。",
  };
}
