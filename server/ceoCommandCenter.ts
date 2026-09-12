import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { isFeishuConfigured } from "./feishuService";

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
  current30Gmv: number;
  previous30Gmv: number;
  current30Orders: number;
  current30AdCost: number;
  current30SessionCount: number;
  previous30SessionCount: number;
  trendRows: Array<{
    date: string;
    gmv: number;
    orders: number;
    sessionCount: number;
  }>;
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

function makeTrend(today: string, rows: CeoCommandCenterRawData["trendRows"]): CeoTrendPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return Array.from({ length: 14 }, (_, index) => {
    const date = shiftDate(today, index - 13);
    const row = byDate.get(date);
    return row
      ? {
          date,
          gmv: numberValue(row.gmv),
          orders: numberValue(row.orders),
          sessionCount: numberValue(row.sessionCount),
          hasData: true,
        }
      : { date, gmv: null, orders: null, sessionCount: 0, hasData: false };
  });
}

export function buildCeoCommandCenterOverview(raw: CeoCommandCenterRawData) {
  const submitted = Math.min(raw.activeReportProfiles, raw.submittedReportProfiles);
  const missingReports = Math.max(0, raw.activeReportProfiles - submitted);
  const reportRate = raw.activeReportProfiles > 0
    ? Math.round((submitted / raw.activeReportProfiles) * 1000) / 10
    : null;
  const currentHour = hourInTimeZone(raw.generatedAt);
  const gmvChangePercent = relativeChange(raw.current30Gmv, raw.previous30Gmv);
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

  if (raw.current30SessionCount === 0) {
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
      status: raw.current30SessionCount === 0 ? "info" : gmvChangePercent !== null && gmvChangePercent <= -20 ? "warning" : "healthy",
      headline: raw.current30SessionCount === 0 ? "直近30日データ未登録" : `登録GMV ¥${Math.round(raw.current30Gmv).toLocaleString()}`,
      detail: raw.current30SessionCount === 0
        ? "実績0とは断定しません"
        : `${raw.current30SessionCount}配信・${raw.current30Orders}注文`,
      href: "/master/livers-dashboard",
      sourceIds: ["livestream"],
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
    { id: "livestream", label: "登録済みライブ実績", href: "/master/livers-dashboard", period: "直近30日", updatedAt: generatedAt },
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
      registeredGmv30d: raw.current30SessionCount > 0 ? raw.current30Gmv : null,
      registeredOrders30d: raw.current30SessionCount > 0 ? raw.current30Orders : null,
      registeredAdCost30d: raw.current30SessionCount > 0 ? raw.current30AdCost : null,
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
    trend: makeTrend(raw.today, raw.trendRows),
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
      registeredGmv: "brand_livestreamsに登録済みのGMV。未登録日は0ではなくnullとして扱います。",
      reportRate: "在職HRに紐づくactive日報profileのうち、当日に1件以上提出したprofileの割合です。",
      finance: "財務金額は既存の二次認証を迂回せず、財務司令塔で確認します。",
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
    commerceResult,
    trendResult,
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
      SELECT
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN COALESCE(NULLIF(salesAmount, 0), NULLIF(gmv, 0), 0) ELSE 0 END) AS currentGmv,
        SUM(CASE WHEN livestreamDate >= ${previous30Start} AND livestreamDate < ${previous30End} THEN COALESCE(NULLIF(salesAmount, 0), NULLIF(gmv, 0), 0) ELSE 0 END) AS previousGmv,
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN COALESCE(orderCount, 0) ELSE 0 END) AS currentOrders,
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN COALESCE(adCost, 0) ELSE 0 END) AS currentAdCost,
        SUM(CASE WHEN livestreamDate >= ${current30Start} AND livestreamDate < ${tomorrow} THEN 1 ELSE 0 END) AS currentSessions,
        SUM(CASE WHEN livestreamDate >= ${previous30Start} AND livestreamDate < ${previous30End} THEN 1 ELSE 0 END) AS previousSessions
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
  const commerce = rowsFromResult<RawRow>(commerceResult)[0] || {};
  const trendRows = rowsFromResult<RawRow>(trendResult);

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
    current30Gmv: numberValue(commerce.currentGmv),
    previous30Gmv: numberValue(commerce.previousGmv),
    current30Orders: numberValue(commerce.currentOrders),
    current30AdCost: numberValue(commerce.currentAdCost),
    current30SessionCount: numberValue(commerce.currentSessions),
    previous30SessionCount: numberValue(commerce.previousSessions),
    trendRows: trendRows.map((row) => ({
      date: stringValue(row.date),
      gmv: numberValue(row.gmv),
      orders: numberValue(row.orders),
      sessionCount: numberValue(row.sessionCount),
    })),
  });
}
