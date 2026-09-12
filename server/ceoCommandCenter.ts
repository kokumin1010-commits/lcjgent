import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { isFeishuConfigured } from "./feishuService";
import { CASHFLOW_REFERENCE_CNY_JPY } from "./cashflowMonthlySummary";

export type CeoHealthStatus = "critical" | "warning" | "healthy" | "info" | "restricted";
export type CeoAlertSeverity = "high" | "medium" | "info";

export type CeoSource = {
  id: string;
  label: string;
  href: string;
  period: string;
  updatedAt: string | null;
};

export type CeoAlert = {
  id: string;
  severity: CeoAlertSeverity;
  title: string;
  detail: string;
  count: number | null;
  href: string;
  sourceIds: string[];
};

export type CeoDepartment = {
  id: string;
  label: string;
  status: CeoHealthStatus;
  headline: string;
  detail: string;
  href: string;
  sourceIds: string[];
};

export type CeoTrendPoint = {
  date: string;
  gmv: number | null;
  orders: number | null;
  sessionCount: number;
  hasData: boolean;
  storeGmv: number | null;
  livestreamGmv: number | null;
  pitFeeReferenceJpy: number | null;
  storeHasData: boolean;
  livestreamHasData: boolean;
  pitFeeRegistered: boolean;
};

export type CeoRevenuePeriod = {
  storeGmv: number;
  storeOrders: number;
  storeSourceRows: number;
  storeCountWithData: number;
  storeUpdatedAt: Date | string | null;
  livestreamGmv: number;
  livestreamOrders: number;
  livestreamSessionCount: number;
  livestreamUpdatedAt: Date | string | null;
  pitFeeJpy: number;
  pitFeeCny: number;
  pitFeeReferenceJpy: number;
  pitFeeRecordCount: number;
  pitFeeUpdatedAt: Date | string | null;
};

export type CeoRevenueTrendRow = {
  date: string;
  storeGmv: number;
  storeOrders: number;
  storeSourceRows: number;
  livestreamGmv: number;
  livestreamOrders: number;
  livestreamSessionCount: number;
  pitFeeReferenceJpy: number;
  pitFeeRecordCount: number;
};

export type CeoCommandCenterRawData = {
  today: string;
  generatedAt: Date;
  activeStaff: number;
  activeReportProfiles: number;
  submittedReportProfiles: number;
  missingReportNames: string[];
  taskTotal: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeIssues: number;
  urgentHighIssues: number;
  overdueIssues: number;
  topIssues: Array<{
    id: number;
    title: string;
    priority: string;
    status: string;
    deadline: string | null;
  }>;
  morningTotal: number;
  morningCompleted: number;
  morningFailed: number;
  morningProcessing: number;
  activeBrands: number;
  larkLinkedBrands: number;
  larkConfigured: boolean;
  larkLatestStatus: string | null;
  larkLatestSyncedAt: Date | string | null;
  larkLatestTotalRecords: number;
  larkLatestUpdatedRecords: number;
  activeStoreCount: number;
  currentRevenue: CeoRevenuePeriod;
  previousRevenue: CeoRevenuePeriod;
  current30AdCost: number;
  revenueTrendRows: CeoRevenueTrendRow[];
};

export type CeoCommandCenterOverview = ReturnType<typeof buildCeoCommandCenterOverview>;

type RawRow = Record<string, unknown>;

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function rowsFromResult<T extends RawRow>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  const rows = result[0];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function dateOnly(value: unknown): string | null {
  const text = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? "").trim().slice(0, 10).replace(/\//g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function metricNumber(value: unknown): number {
  if (value && typeof value === "object" && "value" in value) {
    return metricNumber((value as { value: unknown }).value);
  }
  const parsed = Number(String(value ?? "").normalize("NFKC").replace(/[¥￥,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function exactMetric(row: Record<string, unknown>, candidates: string[]): number {
  const candidateSet = new Set(candidates.map((candidate) => candidate.normalize("NFKC").toLowerCase()));
  const key = Object.keys(row).find((current) => candidateSet.has(current.normalize("NFKC").trim().toLowerCase()));
  return key ? metricNumber(row[key]) : 0;
}

function monthBounds(yearValue: unknown, monthValue: unknown): { start: string; end: string } | null {
  const year = Number(yearValue);
  const month = Number(monthValue);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export type CeoStoreUploadRow = {
  storeId: unknown;
  year: unknown;
  month: unknown;
  dataJson: unknown;
  uploadedAt?: Date | string | null;
};

export function aggregateStoreRevenueUploads(
  uploads: CeoStoreUploadRow[],
  periodStart: string,
  periodEnd: string,
) {
  let gmv = 0;
  let orders = 0;
  let sourceRows = 0;
  let updatedAt: Date | string | null = null;
  const stores = new Set<number>();
  const daily = new Map<string, { gmv: number; orders: number; sourceRows: number }>();

  for (const upload of uploads) {
    let rows: Array<Record<string, unknown>> = [];
    try {
      const parsed = typeof upload.dataJson === "string" ? JSON.parse(upload.dataJson) : upload.dataJson;
      rows = Array.isArray(parsed) ? parsed.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : [];
    } catch {
      rows = [];
    }
    const datedRows = rows.filter((row) => {
      const date = dateOnly(row["日期"] ?? row["日付"] ?? row["Date"] ?? row["按天"]);
      return Boolean(date && date >= periodStart && date <= periodEnd);
    });
    const bounds = monthBounds(upload.year, upload.month);
    const selectedRows = datedRows.length > 0
      ? datedRows
      : bounds && periodStart <= bounds.start && periodEnd >= bounds.end
        ? rows.filter((row) => row._type === "summary")
        : [];
    if (selectedRows.length === 0) continue;

    const storeId = Number(upload.storeId);
    if (Number.isFinite(storeId)) stores.add(storeId);
    const uploadIso = asIsoOrNull(upload.uploadedAt || null);
    const currentUpdatedIso = asIsoOrNull(updatedAt);
    if (uploadIso && (!currentUpdatedIso || uploadIso > currentUpdatedIso)) updatedAt = upload.uploadedAt || null;

    for (const row of selectedRows) {
      const rowGmv = exactMetric(row, ["GMV", "总成交额", "売上", "销售额", "Gross revenue", "収益総額"]);
      const rowOrders = exactMetric(row, ["注文", "注文数", "订单数", "Orders"]);
      gmv += rowGmv;
      orders += rowOrders;
      sourceRows += 1;
      const rowDate = dateOnly(row["日期"] ?? row["日付"] ?? row["Date"] ?? row["按天"]);
      if (rowDate) {
        const point = daily.get(rowDate) || { gmv: 0, orders: 0, sourceRows: 0 };
        point.gmv += rowGmv;
        point.orders += rowOrders;
        point.sourceRows += 1;
        daily.set(rowDate, point);
      }
    }
  }

  return {
    gmv,
    orders,
    sourceRows,
    storeCountWithData: stores.size,
    updatedAt,
    daily,
  };
}

function formatDateInTimeZone(date: Date, timeZone = "Asia/Tokyo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function hourInTimeZone(date: Date, timeZone = "Asia/Tokyo"): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
}

function shiftDate(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function asIsoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function relativeChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function larkFreshnessHours(now: Date, syncedAt: Date | string | null): number | null {
  const iso = asIsoOrNull(syncedAt);
  if (!iso) return null;
  const diff = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.round((diff / 3_600_000) * 10) / 10);
}

function makeTrend(today: string, rows: CeoCommandCenterRawData["revenueTrendRows"]): CeoTrendPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return Array.from({ length: 14 }, (_, index) => {
    const date = shiftDate(today, index - 13);
    const row = byDate.get(date);
    const storeHasData = numberValue(row?.storeSourceRows) > 0;
    const livestreamHasData = numberValue(row?.livestreamSessionCount) > 0;
    const pitFeeRegistered = numberValue(row?.pitFeeRecordCount) > 0;
    const livestreamGmv = livestreamHasData ? numberValue(row?.livestreamGmv) : null;
    return {
      date,
      gmv: livestreamGmv,
      orders: livestreamHasData ? numberValue(row?.livestreamOrders) : null,
      sessionCount: numberValue(row?.livestreamSessionCount),
      hasData: storeHasData || livestreamHasData || pitFeeRegistered,
      storeGmv: storeHasData ? numberValue(row?.storeGmv) : null,
      livestreamGmv,
      pitFeeReferenceJpy: pitFeeRegistered ? numberValue(row?.pitFeeReferenceJpy) : null,
      storeHasData,
      livestreamHasData,
      pitFeeRegistered,
    };
  });
}

export function buildCeoCommandCenterOverview(raw: CeoCommandCenterRawData) {
  const submitted = Math.min(raw.activeReportProfiles, raw.submittedReportProfiles);
  const missingReports = Math.max(0, raw.activeReportProfiles - submitted);
  const reportRate = raw.activeReportProfiles > 0
    ? Math.round((submitted / raw.activeReportProfiles) * 1000) / 10
    : null;
  const currentHour = hourInTimeZone(raw.generatedAt);
  const current = raw.currentRevenue;
  const previous = raw.previousRevenue;
  const currentPrimarySource = current.storeSourceRows > 0
    ? "store"
    : current.livestreamSessionCount > 0
      ? "livestream_fallback"
      : "none";
  const previousPrimarySource = previous.storeSourceRows > 0
    ? "store"
    : previous.livestreamSessionCount > 0
      ? "livestream_fallback"
      : "none";
  const currentPrimarySales = currentPrimarySource === "store"
    ? current.storeGmv
    : currentPrimarySource === "livestream_fallback"
      ? current.livestreamGmv
      : null;
  const previousPrimarySales = previousPrimarySource === "store"
    ? previous.storeGmv
    : previousPrimarySource === "livestream_fallback"
      ? previous.livestreamGmv
      : null;
  const currentPitRegistered = current.pitFeeRecordCount > 0;
  const previousPitRegistered = previous.pitFeeRecordCount > 0;
  const recognizedRevenueReferenceJpy = currentPrimarySales === null && !currentPitRegistered
    ? null
    : numberValue(currentPrimarySales) + (currentPitRegistered ? current.pitFeeReferenceJpy : 0);
  const previousRecognizedRevenueReferenceJpy = previousPrimarySales === null && !previousPitRegistered
    ? null
    : numberValue(previousPrimarySales) + (previousPitRegistered ? previous.pitFeeReferenceJpy : 0);
  const comparableRevenue = currentPrimarySource !== "none"
    && currentPrimarySource === previousPrimarySource
    && currentPrimarySales !== null
    && previousPrimarySales !== null;
  const comparisonIncludesPitFee = comparableRevenue && currentPitRegistered && previousPitRegistered;
  const currentComparableRevenue = comparableRevenue
    ? numberValue(currentPrimarySales) + (comparisonIncludesPitFee ? current.pitFeeReferenceJpy : 0)
    : null;
  const previousComparableRevenue = comparableRevenue
    ? numberValue(previousPrimarySales) + (comparisonIncludesPitFee ? previous.pitFeeReferenceJpy : 0)
    : null;
  const revenueChangePercent = currentComparableRevenue === null || previousComparableRevenue === null
    ? null
    : relativeChange(currentComparableRevenue, previousComparableRevenue);
  const gmvChangePercent = relativeChange(current.livestreamGmv, previous.livestreamGmv);
  const storeCoverageComplete = raw.activeStoreCount > 0 && current.storeCountWithData >= raw.activeStoreCount;
  const larkAgeHours = larkFreshnessHours(raw.generatedAt, raw.larkLatestSyncedAt);
  const larkHealthy = raw.larkConfigured
    && raw.larkLatestStatus === "success"
    && larkAgeHours !== null
    && larkAgeHours <= 8;

  const alerts: CeoAlert[] = [];

  if (raw.overdueTasks > 0) {
    alerts.push({
      id: "overdue-tasks",
      severity: "high",
      title: "期限超過タスクがあります",
      detail: `未完了の期限超過タスクが${raw.overdueTasks}件あります。担当者と期限を確認してください。`,
      count: raw.overdueTasks,
      href: "/master/tasks",
      sourceIds: ["tasks"],
    });
  }

  if (raw.urgentHighIssues > 0 || raw.overdueIssues > 0) {
    alerts.push({
      id: "priority-issues",
      severity: "high",
      title: "優先対応が必要な問題があります",
      detail: `緊急・高優先度${raw.urgentHighIssues}件、期限超過${raw.overdueIssues}件です。`,
      count: Math.max(raw.urgentHighIssues, raw.overdueIssues),
      href: "/master/issues",
      sourceIds: ["issues"],
    });
  }

  if (raw.morningFailed > 0) {
    alerts.push({
      id: "morning-failed",
      severity: "high",
      title: "早会処理に失敗があります",
      detail: `原音声を保持したfailed記録が${raw.morningFailed}件あります。正式摘要は未生成です。`,
      count: raw.morningFailed,
      href: "/master/morning-meeting",
      sourceIds: ["morning-meeting"],
    });
  } else if (raw.morningProcessing > 0) {
    alerts.push({
      id: "morning-processing",
      severity: "medium",
      title: "早会を処理中です",
      detail: `${raw.morningProcessing}件が録音・転写・摘要処理中です。`,
      count: raw.morningProcessing,
      href: "/master/morning-meeting",
      sourceIds: ["morning-meeting"],
    });
  } else if (raw.morningTotal === 0) {
    alerts.push({
      id: "morning-not-registered",
      severity: currentHour >= 11 ? "medium" : "info",
      title: "本日のチーム早会は未登録です",
      detail: currentHour >= 11
        ? "中国・日本チームの当日記録を確認してください。未登録であり、実施0とは断定しません。"
        : "始業前または登録前の可能性があります。11時以降も未登録の場合に確認してください。",
      count: null,
      href: "/master/morning-meeting",
      sourceIds: ["morning-meeting"],
    });
  }

  if (missingReports > 0) {
    const severity: CeoAlertSeverity = currentHour >= 18 ? "high" : currentHour >= 12 ? "medium" : "info";
    alerts.push({
      id: "daily-report-progress",
      severity,
      title: severity === "info" ? "本日の日報提出状況" : "本日の日報に未提出があります",
      detail: `${submitted}/${raw.activeReportProfiles}名が提出済みです。未提出${missingReports}名。`,
      count: missingReports,
      href: "/master/reports",
      sourceIds: ["daily-reports", "hr"],
    });
  }

  if (!raw.larkConfigured || raw.larkLatestStatus === "error") {
    alerts.push({
      id: "lark-unavailable",
      severity: "high",
      title: "Lark連携を確認してください",
      detail: raw.larkConfigured ? "最新のブランドCRM同期が失敗しています。" : "Lark/Feishu APIが未設定です。",
      count: null,
      href: "/master/brands",
      sourceIds: ["lark"],
    });
  } else if (larkAgeHours === null || larkAgeHours > 8) {
    alerts.push({
      id: "lark-stale",
      severity: "medium",
      title: "Lark同期データが古くなっています",
      detail: larkAgeHours === null ? "同期履歴が見つかりません。" : `最終同期から約${larkAgeHours}時間経過しています。`,
      count: null,
      href: "/master/brands",
      sourceIds: ["lark"],
    });
  }

  if (raw.activeStoreCount > 0 && current.storeCountWithData < raw.activeStoreCount) {
    alerts.push({
      id: "store-sales-coverage",
      severity: "medium",
      title: "店舗売上データに未登録店舗があります",
      detail: `直近30日は${current.storeCountWithData}/${raw.activeStoreCount}店舗のGMVを確認済みです。未登録店舗を0売上とは扱っていません。`,
      count: raw.activeStoreCount - current.storeCountWithData,
      href: "/master/store-management",
      sourceIds: ["store-sales"],
    });
  }

  if (current.livestreamSessionCount === 0) {
    alerts.push({
      id: "livestream-no-data",
      severity: "info",
      title: "直近30日のライブ実績は未登録です",
      detail: "実績0ではなく、登録済みライブデータがない状態です。必要に応じて元データを確認してください。",
      count: null,
      href: "/master/livers-dashboard",
      sourceIds: ["livestream"],
    });
  } else if (gmvChangePercent !== null && gmvChangePercent <= -20) {
    alerts.push({
      id: "livestream-gmv-down",
      severity: "medium",
      title: "登録GMVが前期間より低下しています",
      detail: `直近30日の登録GMVは前30日比${Math.abs(gmvChangePercent)}%減です。登録範囲と実績原因を確認してください。`,
      count: null,
      href: "/master/livers-dashboard",
      sourceIds: ["livestream"],
    });
  }

  const severityOrder: Record<CeoAlertSeverity, number> = { high: 0, medium: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const departments: CeoDepartment[] = [
    {
      id: "work",
      label: "マイワーク",
      status: raw.overdueTasks > 0 || raw.overdueIssues > 0 ? "critical" : raw.activeIssues > 0 ? "warning" : "healthy",
      headline: `実行中${raw.pendingTasks + raw.inProgressTasks}件・問題${raw.activeIssues}件`,
      detail: `期限超過タスク${raw.overdueTasks}件、期限超過問題${raw.overdueIssues}件`,
      href: "/master/tasks",
      sourceIds: ["tasks", "issues"],
    },
    {
      id: "hr",
      label: "人事・日報",
      status: missingReports > 0 && currentHour >= 18 ? "critical" : missingReports > 0 ? "warning" : "healthy",
      headline: `在職${raw.activeStaff}名・日報${submitted}/${raw.activeReportProfiles}`,
      detail: reportRate === null ? "日報対象者が未登録です" : `本日の提出率${reportRate}%`,
      href: "/master/hr",
      sourceIds: ["hr", "daily-reports"],
    },
    {
      id: "operations",
      label: "運営・ライブ",
      status: recognizedRevenueReferenceJpy === null ? "info" : !storeCoverageComplete ? "warning" : "healthy",
      headline: recognizedRevenueReferenceJpy === null
        ? "直近30日売上データ未登録"
        : `確認済み売上・収入 ¥${Math.round(recognizedRevenueReferenceJpy).toLocaleString()}`,
      detail: currentPrimarySource === "store"
        ? `店舗${current.storeCountWithData}/${raw.activeStoreCount}店・坑位费${currentPitRegistered ? `${current.pitFeeRecordCount}件` : "未登録"}`
        : currentPrimarySource === "livestream_fallback"
          ? `店舗未登録のためライブ${current.livestreamSessionCount}配信を暫定利用`
          : currentPitRegistered
            ? `坑位费${current.pitFeeRecordCount}件のみ確認済み`
            : "実績0とは断定しません",
      href: "/master/store-management",
      sourceIds: ["store-sales", "livestream", "pit-fee"],
    },
    {
      id: "business",
      label: "商務・Lark",
      status: larkHealthy ? "healthy" : raw.larkConfigured ? "warning" : "critical",
      headline: `稼働ブランド${raw.activeBrands}件・Lark連携${raw.larkLinkedBrands}件`,
      detail: larkHealthy ? `同期正常・最新${raw.larkLatestTotalRecords}件` : "同期状態を確認してください",
      href: "/master/brands",
      sourceIds: ["brands", "lark"],
    },
    {
      id: "morning",
      label: "朝会・組織実行",
      status: raw.morningFailed > 0 ? "critical" : raw.morningCompleted > 0 ? "healthy" : currentHour >= 11 ? "warning" : "info",
      headline: raw.morningTotal === 0 ? "本日未登録" : `完了${raw.morningCompleted}件・処理中${raw.morningProcessing}件`,
      detail: raw.morningFailed > 0 ? `failed ${raw.morningFailed}件・正式摘要未生成` : "原音声・転写品質・参加状況を確認",
      href: "/master/morning-meeting",
      sourceIds: ["morning-meeting"],
    },
    {
      id: "finance",
      label: "財務",
      status: "restricted",
      headline: "二次認証で保護",
      detail: "金額は財務パスワード解除後の財務司令塔で確認",
      href: "/master/finance?tab=finance-command",
      sourceIds: ["finance"],
    },
  ];

  const generatedAt = raw.generatedAt.toISOString();
  const larkUpdatedAt = asIsoOrNull(raw.larkLatestSyncedAt);
  const sources: CeoSource[] = [
    { id: "tasks", label: "タスク管理", href: "/master/tasks", period: "現在", updatedAt: generatedAt },
    { id: "issues", label: "問題管理", href: "/master/issues", period: "現在", updatedAt: generatedAt },
    { id: "hr", label: "人事管理", href: "/master/hr", period: "現在", updatedAt: generatedAt },
    { id: "daily-reports", label: "スタッフ日報", href: "/master/reports", period: raw.today, updatedAt: generatedAt },
    { id: "morning-meeting", label: "早会", href: "/master/morning-meeting", period: raw.today, updatedAt: generatedAt },
    { id: "store-sales", label: "店舗管理・shop_stats", href: "/master/store-management", period: "直近30日", updatedAt: asIsoOrNull(current.storeUpdatedAt) },
    { id: "livestream", label: "登録済みライブ実績", href: "/master/livers-dashboard", period: "直近30日", updatedAt: asIsoOrNull(current.livestreamUpdatedAt) },
    { id: "pit-fee", label: "坑位费・ライブ枠料収入", href: "/master/finance?tab=cashflow", period: "直近30日", updatedAt: asIsoOrNull(current.pitFeeUpdatedAt) },
    { id: "brands", label: "ブランド管理", href: "/master/brands", period: "現在", updatedAt: generatedAt },
    { id: "lark", label: "Lark/FeishuブランドCRM同期", href: "/master/brands", period: "最新同期", updatedAt: larkUpdatedAt },
    { id: "finance", label: "財務司令塔", href: "/master/finance?tab=finance-command", period: "二次認証後", updatedAt: null },
  ];

  return {
    generatedAt,
    timezone: "Asia/Tokyo" as const,
    today: raw.today,
    readOnly: true as const,
    kpis: {
      activeStaff: raw.activeStaff,
      reportSubmitted: submitted,
      reportExpected: raw.activeReportProfiles,
      reportMissing: missingReports,
      reportRate,
      activeTasks: raw.pendingTasks + raw.inProgressTasks,
      overdueTasks: raw.overdueTasks,
      activeIssues: raw.activeIssues,
      urgentHighIssues: raw.urgentHighIssues,
      recognizedRevenueReferenceJpy,
      revenueChangePercent,
      registeredGmv30d: current.livestreamSessionCount > 0 ? current.livestreamGmv : null,
      registeredOrders30d: current.livestreamSessionCount > 0 ? current.livestreamOrders : null,
      registeredAdCost30d: current.livestreamSessionCount > 0 ? raw.current30AdCost : null,
      gmvChangePercent,
      morningStatus: raw.morningFailed > 0
        ? "failed"
        : raw.morningCompleted > 0
          ? "completed"
          : raw.morningProcessing > 0
            ? "processing"
            : "not_registered",
    },
    alerts,
    departments,
    revenue: {
      period: { start: shiftDate(raw.today, -29), end: raw.today },
      recognizedRevenueReferenceJpy,
      previousRecognizedRevenueReferenceJpy,
      primarySource: currentPrimarySource,
      changePercent: revenueChangePercent,
      comparisonIncludesPitFee,
      store: {
        gmv: current.storeSourceRows > 0 ? current.storeGmv : null,
        orders: current.storeSourceRows > 0 ? current.storeOrders : null,
        sourceRows: current.storeSourceRows,
        storesWithData: current.storeCountWithData,
        activeStores: raw.activeStoreCount,
        coverageComplete: storeCoverageComplete,
        updatedAt: asIsoOrNull(current.storeUpdatedAt),
      },
      livestream: {
        gmv: current.livestreamSessionCount > 0 ? current.livestreamGmv : null,
        orders: current.livestreamSessionCount > 0 ? current.livestreamOrders : null,
        sessions: current.livestreamSessionCount,
        possibleStoreOverlap: current.storeSourceRows > 0 && current.livestreamSessionCount > 0,
        addedToRecognizedTotal: currentPrimarySource === "livestream_fallback",
        updatedAt: asIsoOrNull(current.livestreamUpdatedAt),
      },
      pitFee: {
        registered: currentPitRegistered,
        recordCount: current.pitFeeRecordCount,
        jpy: currentPitRegistered ? current.pitFeeJpy : null,
        cny: currentPitRegistered ? current.pitFeeCny : null,
        referenceRateCnyToJpy: CASHFLOW_REFERENCE_CNY_JPY,
        referenceJpy: currentPitRegistered ? current.pitFeeReferenceJpy : null,
        updatedAt: asIsoOrNull(current.pitFeeUpdatedAt),
      },
    },
    trend: makeTrend(raw.today, raw.revenueTrendRows),
    reports: {
      missingNames: raw.missingReportNames,
      missingNamesTruncated: missingReports > raw.missingReportNames.length,
    },
    issues: {
      top: raw.topIssues,
    },
    lark: {
      configured: raw.larkConfigured,
      status: raw.larkLatestStatus,
      syncedAt: larkUpdatedAt,
      ageHours: larkAgeHours,
      totalRecords: raw.larkLatestTotalRecords,
      updatedRecords: raw.larkLatestUpdatedRecords,
      linkedBrands: raw.larkLinkedBrands,
      healthy: larkHealthy,
    },
    sources,
    definitions: {
      recognizedRevenue: "店舗shop_statsのGMVを主売上とし、坑位费のJPY参考額を加算します。店舗GMVが未登録の場合だけ登録ライブGMVをfallback利用します。",
      storeGmv: "currentかつ非削除のshop_stats日付行を期間内集計します。ads帰因GMVは重複のため加算しません。",
      registeredGmv: "brand_livestreamsに登録済みのGMV。店舗GMVにライブ帰因が含まれるため、店舗データがある時は全社主指標へ単純加算しません。",
      pitFee: `cashflowの売上高-ライブ枠料収入。CNYは既存財務参考レート1 CNY=${CASHFLOW_REFERENCE_CNY_JPY} JPYで参考換算し、個別取引は返しません。`,
      reportRate: "在職HRに紐づくactive日報profileのうち、当日に1件以上提出したprofileの割合です。",
      finance: "CEO司令塔へ返す財務値は坑位费の期間aggregateだけです。個別取引・給与・その他財務は既存の二次認証で保護します。",
    },
  };
}

export async function getCeoCommandCenterOverview(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = formatDateInTimeZone(now);
  const tomorrow = shiftDate(today, 1);
  const current30Start = shiftDate(today, -29);
  const previous30Start = shiftDate(today, -59);
  const previous30End = current30Start;
  const trendStart = shiftDate(today, -13);

  const [
    workforceResult,
    reportResult,
    missingReportResult,
    taskResult,
    issueResult,
    topIssueResult,
    morningResult,
    brandResult,
    larkResult,
    activeStoreResult,
    storeUploadResult,
    livestreamPeriodResult,
    livestreamTrendResult,
    pitFeePeriodResult,
    pitFeeTrendResult,
  ] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS activeStaff
        FROM staff
       WHERE isActive = 'active'
         AND archivedAt IS NULL
         AND mergedIntoStaffId IS NULL
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS activeProfiles,
        COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN rs.id END) AS submittedProfiles
      FROM report_staff rs
      LEFT JOIN staff s ON s.id = rs.linkedStaffId
      LEFT JOIN reports r
        ON r.reportStaffId = rs.id
       AND DATE(r.reportDate) = ${today}
      WHERE rs.isActive = 'active'
        AND rs.archivedAt IS NULL
        AND (rs.linkedStaffId IS NULL OR (
          s.id IS NOT NULL
          AND s.isActive = 'active'
          AND s.archivedAt IS NULL
          AND s.mergedIntoStaffId IS NULL
        ))
    `),
    db.execute(sql`
      SELECT COALESCE(s.name, rs.name) AS name
      FROM report_staff rs
      LEFT JOIN staff s ON s.id = rs.linkedStaffId
      LEFT JOIN reports r
        ON r.reportStaffId = rs.id
       AND DATE(r.reportDate) = ${today}
      WHERE rs.isActive = 'active'
        AND rs.archivedAt IS NULL
        AND r.id IS NULL
        AND (rs.linkedStaffId IS NULL OR (
          s.id IS NOT NULL
          AND s.isActive = 'active'
          AND s.archivedAt IS NULL
          AND s.mergedIntoStaffId IS NULL
        ))
      ORDER BY COALESCE(s.name, rs.name)
      LIMIT 12
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline < NOW() AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) AS overdue
      FROM tasks
    `),
    db.execute(sql`
      SELECT
        SUM(CASE WHEN status IN ('pending', 'in_progress', 'waiting_confirm') THEN 1 ELSE 0 END) AS activeIssues,
        SUM(CASE WHEN status IN ('pending', 'in_progress', 'waiting_confirm') AND priority IN ('urgent', 'high') THEN 1 ELSE 0 END) AS urgentHighIssues,
        SUM(CASE WHEN status IN ('pending', 'in_progress', 'waiting_confirm') AND deadline IS NOT NULL AND deadline < NOW() THEN 1 ELSE 0 END) AS overdueIssues
      FROM issues
    `),
    db.execute(sql`
      SELECT id, title, priority, status, deadline
      FROM issues
      WHERE status IN ('pending', 'in_progress', 'waiting_confirm')
      ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        CASE WHEN deadline IS NOT NULL AND deadline < NOW() THEN 0 ELSE 1 END,
        createdAt DESC
      LIMIT 5
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status NOT IN ('completed', 'failed') THEN 1 ELSE 0 END) AS processing
      FROM morning_meetings
      WHERE date = ${today}
        AND recordingKind = 'daily_team'
    `),
    db.execute(sql`
      SELECT
        SUM(CASE WHEN status <> '終了' THEN 1 ELSE 0 END) AS activeBrands,
        SUM(CASE WHEN larkRecordId IS NOT NULL AND larkRecordId <> '' THEN 1 ELSE 0 END) AS larkLinkedBrands
      FROM brands
      WHERE deletedAt IS NULL
    `),
    db.execute(sql`
      SELECT status, totalRecords, updatedRecords, syncedAt
      FROM feishu_sync_history
      ORDER BY syncedAt DESC, id DESC
      LIMIT 1
    `),
    db.execute(sql`
      SELECT COUNT(*) AS activeStores
      FROM managed_stores
      WHERE isActive = 1
    `),
    db.execute(sql`
      SELECT storeId, year, month, dataJson, uploadedAt
      FROM store_data_uploads
      WHERE dataType = 'shop_stats'
        AND isCurrent = 1
        AND deletedAt IS NULL
        AND STR_TO_DATE(CONCAT(year, '-', LPAD(month, 2, '0'), '-01'), '%Y-%m-%d') < ${tomorrow}
        AND LAST_DAY(STR_TO_DATE(CONCAT(year, '-', LPAD(month, 2, '0'), '-01'), '%Y-%m-%d')) >= ${previous30Start}
      ORDER BY year, month, storeId
    `),
    db.execute(sql`
      SELECT
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN COALESCE(NULLIF(salesAmount, 0), NULLIF(gmv, 0), 0) ELSE 0 END) AS currentGmv,
        SUM(CASE WHEN livestreamDate >= ${previous30Start} AND livestreamDate < ${previous30End} THEN COALESCE(NULLIF(salesAmount, 0), NULLIF(gmv, 0), 0) ELSE 0 END) AS previousGmv,
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN COALESCE(orderCount, 0) ELSE 0 END) AS currentOrders,
        SUM(CASE WHEN livestreamDate >= ${previous30Start} AND livestreamDate < ${previous30End} THEN COALESCE(orderCount, 0) ELSE 0 END) AS previousOrders,
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN COALESCE(adCost, 0) ELSE 0 END) AS currentAdCost,
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN 1 ELSE 0 END) AS currentSessions,
        SUM(CASE WHEN livestreamDate >= ${previous30Start} AND livestreamDate < ${previous30End} THEN 1 ELSE 0 END) AS previousSessions,
        MAX(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN updatedAt END) AS currentUpdatedAt,
        MAX(CASE WHEN livestreamDate >= ${previous30Start} AND livestreamDate < ${previous30End} THEN updatedAt END) AS previousUpdatedAt
      FROM brand_livestreams
      WHERE deletedAt IS NULL
        AND livestreamDate >= ${previous30Start}
        AND livestreamDate < ${tomorrow}
    `),
    db.execute(sql`
      SELECT
        DATE_FORMAT(livestreamDate, '%Y-%m-%d') AS date,
        SUM(COALESCE(NULLIF(salesAmount, 0), NULLIF(gmv, 0), 0)) AS gmv,
        SUM(COALESCE(orderCount, 0)) AS orders,
        COUNT(*) AS sessionCount
      FROM brand_livestreams
      WHERE deletedAt IS NULL
        AND livestreamDate >= ${trendStart}
        AND livestreamDate < ${tomorrow}
      GROUP BY DATE(livestreamDate), DATE_FORMAT(livestreamDate, '%Y-%m-%d')
      ORDER BY DATE(livestreamDate)
    `),
    db.execute(sql`
      SELECT
        SUM(CASE WHEN transactionDate >= ${current30Start} AND transactionDate <= ${today} AND currency = 'JPY' THEN amount ELSE 0 END) AS currentJpy,
        SUM(CASE WHEN transactionDate >= ${current30Start} AND transactionDate <= ${today} AND currency = 'CNY' THEN amount ELSE 0 END) AS currentCny,
        SUM(CASE WHEN transactionDate >= ${current30Start} AND transactionDate <= ${today} THEN amount * CASE WHEN currency = 'CNY' THEN ${CASHFLOW_REFERENCE_CNY_JPY} ELSE 1 END ELSE 0 END) AS currentReferenceJpy,
        SUM(CASE WHEN transactionDate >= ${current30Start} AND transactionDate <= ${today} THEN 1 ELSE 0 END) AS currentRecords,
        MAX(CASE WHEN transactionDate >= ${current30Start} AND transactionDate <= ${today} THEN updatedAt END) AS currentUpdatedAt,
        SUM(CASE WHEN transactionDate >= ${previous30Start} AND transactionDate < ${previous30End} AND currency = 'JPY' THEN amount ELSE 0 END) AS previousJpy,
        SUM(CASE WHEN transactionDate >= ${previous30Start} AND transactionDate < ${previous30End} AND currency = 'CNY' THEN amount ELSE 0 END) AS previousCny,
        SUM(CASE WHEN transactionDate >= ${previous30Start} AND transactionDate < ${previous30End} THEN amount * CASE WHEN currency = 'CNY' THEN ${CASHFLOW_REFERENCE_CNY_JPY} ELSE 1 END ELSE 0 END) AS previousReferenceJpy,
        SUM(CASE WHEN transactionDate >= ${previous30Start} AND transactionDate < ${previous30End} THEN 1 ELSE 0 END) AS previousRecords,
        MAX(CASE WHEN transactionDate >= ${previous30Start} AND transactionDate < ${previous30End} THEN updatedAt END) AS previousUpdatedAt
      FROM company_cashflows
      WHERE deletedAt IS NULL
        AND type = 'income'
        AND category = '売上高-ライブ枠料収入'
        AND transactionDate >= ${previous30Start}
        AND transactionDate <= ${today}
    `),
    db.execute(sql`
      SELECT
        transactionDate AS date,
        SUM(amount * CASE WHEN currency = 'CNY' THEN ${CASHFLOW_REFERENCE_CNY_JPY} ELSE 1 END) AS referenceJpy,
        COUNT(*) AS recordCount
      FROM company_cashflows
      WHERE deletedAt IS NULL
        AND type = 'income'
        AND category = '売上高-ライブ枠料収入'
        AND transactionDate >= ${trendStart}
        AND transactionDate <= ${today}
      GROUP BY transactionDate
      ORDER BY transactionDate
    `),
  ]);

  const workforce = rowsFromResult<RawRow>(workforceResult)[0] || {};
  const report = rowsFromResult<RawRow>(reportResult)[0] || {};
  const missingReportRows = rowsFromResult<RawRow>(missingReportResult);
  const task = rowsFromResult<RawRow>(taskResult)[0] || {};
  const issue = rowsFromResult<RawRow>(issueResult)[0] || {};
  const topIssues = rowsFromResult<RawRow>(topIssueResult);
  const morning = rowsFromResult<RawRow>(morningResult)[0] || {};
  const brand = rowsFromResult<RawRow>(brandResult)[0] || {};
  const lark = rowsFromResult<RawRow>(larkResult)[0] || {};
  const activeStore = rowsFromResult<RawRow>(activeStoreResult)[0] || {};
  const storeUploads = rowsFromResult<CeoStoreUploadRow & RawRow>(storeUploadResult);
  const currentStore = aggregateStoreRevenueUploads(storeUploads, current30Start, today);
  const previousStore = aggregateStoreRevenueUploads(storeUploads, previous30Start, shiftDate(current30Start, -1));
  const livestream = rowsFromResult<RawRow>(livestreamPeriodResult)[0] || {};
  const livestreamTrendRows = rowsFromResult<RawRow>(livestreamTrendResult);
  const pitFee = rowsFromResult<RawRow>(pitFeePeriodResult)[0] || {};
  const pitFeeTrendRows = rowsFromResult<RawRow>(pitFeeTrendResult);
  const livestreamTrendByDate = new Map(livestreamTrendRows.map((row) => [dateOnly(row.date), row]));
  const pitFeeTrendByDate = new Map(pitFeeTrendRows.map((row) => [dateOnly(row.date), row]));
  const revenueTrendRows: CeoRevenueTrendRow[] = Array.from({ length: 14 }, (_, index) => {
    const date = shiftDate(today, index - 13);
    const storeRow = currentStore.daily.get(date);
    const livestreamRow = livestreamTrendByDate.get(date) || {};
    const pitFeeRow = pitFeeTrendByDate.get(date) || {};
    return {
      date,
      storeGmv: numberValue(storeRow?.gmv),
      storeOrders: numberValue(storeRow?.orders),
      storeSourceRows: numberValue(storeRow?.sourceRows),
      livestreamGmv: numberValue(livestreamRow.gmv),
      livestreamOrders: numberValue(livestreamRow.orders),
      livestreamSessionCount: numberValue(livestreamRow.sessionCount),
      pitFeeReferenceJpy: numberValue(pitFeeRow.referenceJpy),
      pitFeeRecordCount: numberValue(pitFeeRow.recordCount),
    };
  });

  return buildCeoCommandCenterOverview({
    today,
    generatedAt: now,
    activeStaff: numberValue(workforce.activeStaff),
    activeReportProfiles: numberValue(report.activeProfiles),
    submittedReportProfiles: numberValue(report.submittedProfiles),
    missingReportNames: missingReportRows.map((row) => stringValue(row.name)).filter(Boolean),
    taskTotal: numberValue(task.total),
    pendingTasks: numberValue(task.pending),
    inProgressTasks: numberValue(task.inProgress),
    completedTasks: numberValue(task.completed),
    overdueTasks: numberValue(task.overdue),
    activeIssues: numberValue(issue.activeIssues),
    urgentHighIssues: numberValue(issue.urgentHighIssues),
    overdueIssues: numberValue(issue.overdueIssues),
    topIssues: topIssues.map((row) => ({
      id: numberValue(row.id),
      title: stringValue(row.title),
      priority: stringValue(row.priority),
      status: stringValue(row.status),
      deadline: asIsoOrNull(row.deadline as Date | string | null),
    })),
    morningTotal: numberValue(morning.total),
    morningCompleted: numberValue(morning.completed),
    morningFailed: numberValue(morning.failed),
    morningProcessing: numberValue(morning.processing),
    activeBrands: numberValue(brand.activeBrands),
    larkLinkedBrands: numberValue(brand.larkLinkedBrands),
    larkConfigured: isFeishuConfigured(),
    larkLatestStatus: stringValue(lark.status) || null,
    larkLatestSyncedAt: (lark.syncedAt as Date | string | null) || null,
    larkLatestTotalRecords: numberValue(lark.totalRecords),
    larkLatestUpdatedRecords: numberValue(lark.updatedRecords),
    activeStoreCount: numberValue(activeStore.activeStores),
    currentRevenue: {
      storeGmv: currentStore.gmv,
      storeOrders: currentStore.orders,
      storeSourceRows: currentStore.sourceRows,
      storeCountWithData: currentStore.storeCountWithData,
      storeUpdatedAt: currentStore.updatedAt,
      livestreamGmv: numberValue(livestream.currentGmv),
      livestreamOrders: numberValue(livestream.currentOrders),
      livestreamSessionCount: numberValue(livestream.currentSessions),
      livestreamUpdatedAt: (livestream.currentUpdatedAt as Date | string | null) || null,
      pitFeeJpy: numberValue(pitFee.currentJpy),
      pitFeeCny: numberValue(pitFee.currentCny),
      pitFeeReferenceJpy: numberValue(pitFee.currentReferenceJpy),
      pitFeeRecordCount: numberValue(pitFee.currentRecords),
      pitFeeUpdatedAt: (pitFee.currentUpdatedAt as Date | string | null) || null,
    },
    previousRevenue: {
      storeGmv: previousStore.gmv,
      storeOrders: previousStore.orders,
      storeSourceRows: previousStore.sourceRows,
      storeCountWithData: previousStore.storeCountWithData,
      storeUpdatedAt: previousStore.updatedAt,
      livestreamGmv: numberValue(livestream.previousGmv),
      livestreamOrders: numberValue(livestream.previousOrders),
      livestreamSessionCount: numberValue(livestream.previousSessions),
      livestreamUpdatedAt: (livestream.previousUpdatedAt as Date | string | null) || null,
      pitFeeJpy: numberValue(pitFee.previousJpy),
      pitFeeCny: numberValue(pitFee.previousCny),
      pitFeeReferenceJpy: numberValue(pitFee.previousReferenceJpy),
      pitFeeRecordCount: numberValue(pitFee.previousRecords),
      pitFeeUpdatedAt: (pitFee.previousUpdatedAt as Date | string | null) || null,
    },
    current30AdCost: numberValue(livestream.currentAdCost),
    revenueTrendRows,
  });
}
