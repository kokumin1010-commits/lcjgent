import type { buildIpoReadinessCommandCenter } from "./ipoReadinessCommandCenter";
import { IPO_TARGET_OPERATING_MARGIN_PCT } from "./ipoReadinessAssumptions";

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
    const marginRate = IPO_TARGET_OPERATING_MARGIN_PCT / 100;
    const revenueTargetJpy = planOperatingProfitJpy == null
      ? null
      : round(planOperatingProfitJpy / marginRate);
    const operatingCostTargetJpy = revenueTargetJpy == null || planOperatingProfitJpy == null
      ? null
      : round(revenueTargetJpy - planOperatingProfitJpy);
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
      revenueTargetJpy,
      grossProfitTargetJpy: override?.grossProfitTargetJpy ?? null,
      planOperatingProfitJpy,
      operatingCostTargetJpy,
      targetOperatingMarginPct: IPO_TARGET_OPERATING_MARGIN_PCT,
      revenueTargetSource: "operating_margin_plan" as const,
      planSource: hasOverride ? "monthly_override" as const : "equal_company_plan" as const,
      formalRevenueJpy,
      formalGrossProfitJpy,
      formalOperatingProfitJpy,
      revenueVarianceJpy: formalRevenueJpy == null || revenueTargetJpy == null ? null : formalRevenueJpy - round(revenueTargetJpy),
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
  const marginPct = IPO_TARGET_OPERATING_MARGIN_PCT;
  const marginRate = marginPct / 100;
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
    ready: remainingOperatingProfitJpy != null && remainingMonths > 0,
    basis: "company_plan_minus_formal_operating_profit" as const,
  };
}

export function buildIpoScenarios(input: {
  core: IpoReadinessCore;
  settings: IpoPlanningSettings;
}) {
  const factors = [
    { key: "downside" as const, label: "保守", factor: input.settings.downsideFactor },
    { key: "base" as const, label: "基本", factor: input.settings.baseFactor },
    { key: "upside" as const, label: "強化", factor: input.settings.upsideFactor },
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
    disclaimer: "シナリオは現在の月平均ペースによる感応度計算であり、会社の確約ではありません。現金シナリオは会計上の利益ではありません。",
  };
}

export function buildIpoTaxFundingReference(core: IpoReadinessCore) {
  const finalizedMonthCount = core.actual.finalizedMonthCount;
  const finalizedNetProfitMonthCount = core.actual.finalizedNetProfitMonthCount;
  const reconciliationReady = finalizedMonthCount > 0
    && finalizedNetProfitMonthCount === finalizedMonthCount
    && core.actual.formalNetProfitJpy != null;
  const operatingProfitToNetProfitDifferenceJpy = reconciliationReady
    ? round(core.actual.formalOperatingProfitJpy - Number(core.actual.formalNetProfitJpy))
    : null;
  return {
    targetOperatingMarginPct: core.operatingPlan.targetOperatingMarginPct,
    formalOperatingProfitJpy: finalizedMonthCount > 0 ? core.actual.formalOperatingProfitJpy : null,
    formalNetProfitJpy: reconciliationReady ? core.actual.formalNetProfitJpy : null,
    operatingProfitToNetProfitDifferenceJpy,
    finalizedMonthCount,
    finalizedNetProfitMonthCount,
    reconciliationReady,
    taxReserveRatePct: null,
    taxReserveJpy: null,
    afterTaxProfitForecastJpy: null,
    basis: core.taxFundingPolicy.basis,
    disclaimer: core.taxFundingPolicy.descriptionJa,
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
      ? `${overdueRows[0].month}の月次P/Lを月次決算済みまたは監査済みにする`
      : draftRows[0]
        ? `${draftRows[0].month}の下書きを確認して月次決算を完了する`
        : missingRows[0]
          ? `${missingRows[0].month}の月次P/Lを登録する`
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
    disclaimer: "銀行キャッシュ支出分類は経営確認用であり、正式な会計費用ではありません。",
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
      title: "正式月次P/Lが未登録",
      detail: "上場業績の達成率と正式シナリオ予測を判定できません。",
      action: "直近月の売上高・売上総利益・営業利益の月次決算を完了してください。",
    });
  }
  if (input.closeQuality.overdueMonths.length > 0) {
    risks.push({
      key: "monthly_close_overdue",
      severity: "critical",
      title: "月次決算の期限超過",
      detail: `${input.closeQuality.overdueMonths.join("、")} の月次決算が未完了です。`,
      action: input.closeQuality.nextRequiredAction || "月次決算を完了してください。",
    });
  }
  if (input.taskReadiness.blockedCount > 0) {
    risks.push({
      key: "blocked_tasks",
      severity: "high",
      title: "上場準備タスクに阻害要因あり",
      detail: `${input.taskReadiness.blockedCount}件のタスクに阻害要因があります。`,
      action: "阻害要因・意思決定者・解消予定日を明確にしてください。",
    });
  }
  if (input.taskReadiness.overdueCount > 0) {
    risks.push({
      key: "overdue_tasks",
      severity: "high",
      title: "上場準備タスクの期限超過",
      detail: `${input.taskReadiness.overdueCount}件の未完了タスクが期限を超えています。`,
      action: "責任者と期限を再設定するか、正式な延期理由を記録してください。",
    });
  }
  if (input.taskReadiness.completedWithoutEvidenceCount > 0) {
    risks.push({
      key: "completed_without_evidence",
      severity: "high",
      title: "完了タスクの証拠不足",
      detail: `${input.taskReadiness.completedWithoutEvidenceCount}件の完了タスクに証拠リンクがありません。`,
      action: "検証可能な規程・議事録・契約書・監査資料のリンクを追加してください。",
    });
  }
  if (input.taskReadiness.ownerMissingCount > 0 || input.taskReadiness.dueDateMissingCount > 0) {
    risks.push({
      key: "task_governance_missing",
      severity: "medium",
      title: "タスクの責任者・期限が未設定",
      detail: `責任者未設定 ${input.taskReadiness.ownerMissingCount}件、期限未設定 ${input.taskReadiness.dueDateMissingCount}件です。`,
      action: "すべての進行中タスクに単一責任者と期限を設定してください。",
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
  taxFunding: ReturnType<typeof buildIpoTaxFundingReference>;
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
      targetOperatingMarginPct: input.core.operatingPlan.targetOperatingMarginPct,
      requiredRevenueJpy: input.core.operatingPlan.requiredRevenueJpy,
      operatingCostLimitJpy: input.core.operatingPlan.operatingCostLimitJpy,
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
    taxFunding: input.taxFunding,
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
      "正式実績は月次決算済みまたは監査済みのP/Lだけを使用します。",
      "銀行の営業現金と支出分類は管理参考であり、会計上の利益または費用ではありません。",
      "シナリオ予測は感応度計算であり、会社の確約または上場保証ではありません。",
      input.core.taxFundingPolicy.descriptionJa,
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
    disclaimer: "月次目標と月次決算済み／監査済みP/Lの両方がある月だけを差額計算に含めます。銀行分類は別モジュールで現金参考として表示します。",
  };
}
