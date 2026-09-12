export type IpoMonthlyPnlStatus = "draft" | "closed" | "audited";

export type IpoMonthlyPnl = {
  month: string;
  revenueJpy: number;
  grossProfitJpy: number;
  operatingProfitJpy: number;
  netProfitJpy?: number | null;
  status: IpoMonthlyPnlStatus;
  note?: string | null;
  updatedAt?: Date | string | null;
};

export type IpoCashReferenceMonth = {
  month: string;
  operatingIncomeReferenceJpy: number;
  operatingExpenseReferenceJpy: number;
  operatingNetReferenceJpy: number;
};

export type IpoRoadmapStage = {
  key: "n2_h1" | "n2_full" | "n1_full" | "listing_h1" | "listing";
  label: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  targetOperatingProfitJpy: number | null;
  targetType: "company_plan" | "milestone";
};

const IPO_ROADMAP: IpoRoadmapStage[] = [
  {
    key: "n2_h1",
    label: "N-2期・上期",
    periodLabel: "2026年8月〜2027年1月",
    startDate: "2026-08-01",
    endDate: "2027-01-31",
    targetOperatingProfitJpy: 100_000_000,
    targetType: "company_plan",
  },
  {
    key: "n2_full",
    label: "N-2期・通期",
    periodLabel: "2026年8月〜2027年7月",
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    targetOperatingProfitJpy: 200_000_000,
    targetType: "company_plan",
  },
  {
    key: "n1_full",
    label: "N-1期・通期",
    periodLabel: "2027年8月〜2028年7月",
    startDate: "2027-08-01",
    endDate: "2028-07-31",
    targetOperatingProfitJpy: 500_000_000,
    targetType: "company_plan",
  },
  {
    key: "listing_h1",
    label: "上場準備期・上期",
    periodLabel: "2028年8月〜2029年1月",
    startDate: "2028-08-01",
    endDate: "2029-01-31",
    targetOperatingProfitJpy: 500_000_000,
    targetType: "company_plan",
  },
  {
    key: "listing",
    label: "最短上場目標",
    periodLabel: "2029年中旬",
    startDate: "2029-02-01",
    endDate: "2029-07-31",
    targetOperatingProfitJpy: null,
    targetType: "milestone",
  },
];

function isoDate(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function monthFromDate(value: string): string {
  return value.slice(0, 7);
}

function monthIndex(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

function monthCountInclusive(startMonth: string, endMonth: string): number {
  return Math.max(0, monthIndex(endMonth) - monthIndex(startMonth) + 1);
}

function monthSequence(startMonth: string, endMonth: string): string[] {
  const start = monthIndex(startMonth);
  const end = monthIndex(endMonth);
  const months: string[] = [];
  for (let index = start; index <= end; index += 1) {
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function previousMonth(asOf: string): string {
  const date = new Date(`${asOf}T00:00:00Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function inStageMonth(month: string, stage: IpoRoadmapStage): boolean {
  return month >= monthFromDate(stage.startDate) && month <= monthFromDate(stage.endDate);
}

function finite(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round(value);
}

function currentStageFor(asOf: string): IpoRoadmapStage {
  if (asOf <= IPO_ROADMAP[0].endDate) return IPO_ROADMAP[0];
  if (asOf <= IPO_ROADMAP[1].endDate) return IPO_ROADMAP[1];
  if (asOf <= IPO_ROADMAP[2].endDate) return IPO_ROADMAP[2];
  if (asOf <= IPO_ROADMAP[3].endDate) return IPO_ROADMAP[3];
  return IPO_ROADMAP[4];
}

export function buildIpoReadinessCommandCenter(input: {
  monthlyPnl: IpoMonthlyPnl[];
  cashReferenceMonths: IpoCashReferenceMonth[];
  now?: Date | string;
}) {
  const asOf = isoDate(input.now || new Date());
  const asOfMonth = monthFromDate(asOf);
  const currentStage = currentStageFor(asOf);
  const target = currentStage.targetOperatingProfitJpy;
  const currentPnlRows = input.monthlyPnl
    .filter((row) => inStageMonth(row.month, currentStage))
    .sort((left, right) => left.month.localeCompare(right.month));
  const finalizedRows = currentPnlRows.filter((row) => row.status === "closed" || row.status === "audited");
  const draftRows = currentPnlRows.filter((row) => row.status === "draft");
  const formalOperatingProfitJpy = round(finalizedRows.reduce((total, row) => total + finite(row.operatingProfitJpy), 0));
  const draftOperatingProfitJpy = round(draftRows.reduce((total, row) => total + finite(row.operatingProfitJpy), 0));
  const formalRevenueJpy = round(finalizedRows.reduce((total, row) => total + finite(row.revenueJpy), 0));
  const formalGrossProfitJpy = round(finalizedRows.reduce((total, row) => total + finite(row.grossProfitJpy), 0));
  const formalNetProfitJpy = round(finalizedRows.reduce((total, row) => total + finite(row.netProfitJpy), 0));
  const grossMargin = formalRevenueJpy > 0 ? formalGrossProfitJpy / formalRevenueJpy : null;
  const expectedCloseEndMonth = previousMonth(asOf);
  const expectedMonths = expectedCloseEndMonth < monthFromDate(currentStage.startDate)
    ? []
    : monthSequence(monthFromDate(currentStage.startDate), expectedCloseEndMonth > monthFromDate(currentStage.endDate) ? monthFromDate(currentStage.endDate) : expectedCloseEndMonth);
  const finalizedMonths = new Set(finalizedRows.map((row) => row.month));
  const missingCloseMonths = expectedMonths.filter((month) => !finalizedMonths.has(month));
  const totalStageMonths = monthCountInclusive(monthFromDate(currentStage.startDate), monthFromDate(currentStage.endDate));
  const remainingMonths = Math.max(0, totalStageMonths - finalizedMonths.size);
  const targetGapJpy = target == null ? null : Math.max(0, target - formalOperatingProfitJpy);
  const requiredMonthlyOperatingProfitJpy = targetGapJpy == null || remainingMonths === 0 ? null : round(targetGapJpy / remainingMonths);
  const averageFinalizedOperatingProfitJpy = finalizedRows.length > 0 ? formalOperatingProfitJpy / finalizedRows.length : null;
  const projectedOperatingProfitJpy = averageFinalizedOperatingProfitJpy == null
    ? null
    : round(formalOperatingProfitJpy + averageFinalizedOperatingProfitJpy * remainingMonths);
  const progressRate = target && finalizedRows.length > 0 ? formalOperatingProfitJpy / target : null;
  const projectionGapJpy = target == null || projectedOperatingProfitJpy == null ? null : projectedOperatingProfitJpy - target;
  const cashReferenceRows = input.cashReferenceMonths
    .filter((row) => inStageMonth(row.month, currentStage))
    .sort((left, right) => left.month.localeCompare(right.month));
  const cashReference = {
    operatingIncomeReferenceJpy: round(cashReferenceRows.reduce((total, row) => total + finite(row.operatingIncomeReferenceJpy), 0)),
    operatingExpenseReferenceJpy: round(cashReferenceRows.reduce((total, row) => total + finite(row.operatingExpenseReferenceJpy), 0)),
    operatingNetReferenceJpy: round(cashReferenceRows.reduce((total, row) => total + finite(row.operatingNetReferenceJpy), 0)),
    months: cashReferenceRows.length,
    basis: "bank_cashflow_reference" as const,
  };
  const dataStatus = finalizedRows.length === 0 ? "missing" as const : missingCloseMonths.length > 0 ? "partial" as const : "current" as const;
  const actions: Array<{
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
    target: "monthly_pnl" | "cashflow" | "expenses";
  }> = [];
  if (finalizedRows.length === 0) {
    actions.push({
      key: "monthly_pnl_missing",
      severity: "high",
      title: "正式月次损益尚未登记",
      detail: "先录入最近已完成月份的营业收入、毛利和营业利润，目标完成率才可判断。",
      target: "monthly_pnl",
    });
  } else if (missingCloseMonths.length > 0) {
    actions.push({
      key: "monthly_close_overdue",
      severity: "high",
      title: "月结数据尚未齐全",
      detail: `${missingCloseMonths.join("、")} 尚未完成月结，请财务补录或确认。`,
      target: "monthly_pnl",
    });
  }
  if (projectionGapJpy != null && projectionGapJpy < 0) {
    actions.push({
      key: "projection_below_target",
      severity: "high",
      title: "按当前速度预计无法达到利益目标",
      detail: `期末预测较公司计划少${Math.abs(round(projectionGapJpy)).toLocaleString()}日元，需提高毛利或降低费用。`,
      target: "expenses",
    });
  }
  if (cashReference.operatingNetReferenceJpy < 0) {
    actions.push({
      key: "cash_reference_negative",
      severity: "medium",
      title: "经营现金参考为净流出",
      detail: `本阶段银行经营收支参考为${cashReference.operatingNetReferenceJpy.toLocaleString()}日元，请核对月别入金与高额支出。`,
      target: "cashflow",
    });
  }
  if (requiredMonthlyOperatingProfitJpy != null && averageFinalizedOperatingProfitJpy != null && averageFinalizedOperatingProfitJpy < requiredMonthlyOperatingProfitJpy) {
    actions.push({
      key: "monthly_pace_below_required",
      severity: "high",
      title: "当前月均营业利润低于必要速度",
      detail: `已月结平均${round(averageFinalizedOperatingProfitJpy).toLocaleString()}日元／月，剩余月份需${requiredMonthlyOperatingProfitJpy.toLocaleString()}日元／月。`,
      target: "expenses",
    });
  }

  const roadmap = IPO_ROADMAP.map((stage) => {
    const rows = input.monthlyPnl.filter((row) => inStageMonth(row.month, stage) && (row.status === "closed" || row.status === "audited"));
    const actual = round(rows.reduce((total, row) => total + finite(row.operatingProfitJpy), 0));
    return {
      ...stage,
      actualOperatingProfitJpy: actual,
      finalizedMonthCount: rows.length,
      progressRate: stage.targetOperatingProfitJpy && rows.length > 0 ? actual / stage.targetOperatingProfitJpy : null,
      status: asOf > stage.endDate ? "past" as const : asOf >= stage.startDate ? "current" as const : "future" as const,
    };
  });

  return {
    asOf,
    fiscalYearEndMonth: 7,
    fiscalYearLabel: `${Number(currentStage.endDate.slice(0, 4))}年7月期`,
    listingTargetLabel: "2029年中旬（最短・条件達成前提）",
    targetBasis: "company_plan" as const,
    actualMetric: "operating_profit" as const,
    actualBasis: finalizedRows.length > 0 ? "monthly_pnl" as const : "not_available" as const,
    currentStage,
    actual: {
      formalOperatingProfitJpy,
      draftOperatingProfitJpy,
      formalRevenueJpy,
      formalGrossProfitJpy,
      formalNetProfitJpy,
      grossMargin,
      finalizedMonthCount: finalizedRows.length,
      draftMonthCount: draftRows.length,
      missingCloseMonths,
      latestFinalizedMonth: finalizedRows.at(-1)?.month || null,
      dataStatus,
    },
    pace: {
      targetOperatingProfitJpy: target,
      targetGapJpy,
      progressRate,
      totalStageMonths,
      remainingMonths,
      requiredMonthlyOperatingProfitJpy,
      averageFinalizedOperatingProfitJpy: averageFinalizedOperatingProfitJpy == null ? null : round(averageFinalizedOperatingProfitJpy),
      projectedOperatingProfitJpy,
      projectionGapJpy: projectionGapJpy == null ? null : round(projectionGapJpy),
    },
    cashReference,
    monthlyPnl: currentPnlRows,
    roadmap,
    actions,
    disclaimers: [
      "利益目标是公司计划，不是已实现业绩或上市保证。",
      "目标完成率仅使用月结或审计状态的月次营业利润。",
      "银行经营收支仅为现金参考，不等于会计利润。",
    ],
    asOfMonth,
  };
}

export const IPO_READINESS_ROADMAP = IPO_ROADMAP;
