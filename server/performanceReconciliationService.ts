import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  buildPerformanceEvidenceKey,
  calculateCompletionRate,
  normalizePerformanceDimension,
  reminderLevelForItem,
} from "../shared/performancePolicy";
import { currentStaffCondition } from "./staffIdentityQuery";
import { staffCountryToTeamCode } from "./teamMorningMeetingPolicy";
import type { PerformanceDatabase } from "./performanceUpgrade";
import { reconcilePerformanceResponseFacts } from "./performanceResponseService";
import { ensurePerformanceTables } from "./performanceUpgrade";
import {
  PERFORMANCE_RULE_VERSION_CODE,
  PERFORMANCE_TEMPLATE_CATALOG,
  PERFORMANCE_TEMPLATE_CATALOG_HASH,
} from "./performanceTemplateCatalog";

export type PerformanceReconciliationCounters = {
  staffAssignments: number;
  templates: number;
  itemsObserved: number;
  evidenceSnapshots: number;
  remindersOpened: number;
  responseFactsObserved: number;
  sourceErrors: number;
};

type TemplateRow = {
  id: number;
  templateCode: string;
  ruleVersionId: number;
  primaryDimension: string;
  sourceAdapter: string;
  status: string;
};

type FactObservation = {
  template: TemplateRow;
  staffId: number;
  reviewerStaffId: number | null;
  businessDate: string;
  dueAt: Date | null;
  status: "pending" | "completed" | "cancelled" | "source_error";
  completedAt: Date | null;
  isOnTime: boolean | null;
  sourceType: string;
  sourceId: string;
  dataQuality: "verified" | "partial" | "source_error";
  completionNumerator: number | null;
  completionDenominator: number | null;
  applicabilityStatus: "applicable" | "na" | "excluded";
  summary: Record<string, unknown>;
};

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function jstDate(value = new Date()): string {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateMinusDays(date: string, days: number): string {
  const instant = new Date(`${date}T00:00:00+09:00`);
  instant.setUTCDate(instant.getUTCDate() - days);
  return jstDate(instant);
}

function maxDate(left: string, right: string): string {
  return left >= right ? left : right;
}

function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  let cursor = new Date(`${from}T00:00:00+09:00`);
  const end = new Date(`${to}T00:00:00+09:00`);
  while (cursor.getTime() <= end.getTime()) {
    result.push(jstDate(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return result;
}

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  return day !== 0 && day !== 6;
}

export const PERFORMANCE_ALL_DAY_DEADLINE_EFFECTIVE_FROM = "2026-09-17";

function dueAt(date: string, hour: number, offsetHours = 9, minute = 0, second = 0): Date {
  const offset = `${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${offset}`);
}

export function performanceDailyObligationDeadline(input: {
  businessDate: string;
  offsetHours: number;
  legacyHour: number;
}): Date {
  if (input.businessDate < PERFORMANCE_ALL_DAY_DEADLINE_EFFECTIVE_FROM) {
    return dueAt(input.businessDate, input.legacyHour, input.offsetHours);
  }
  return dueAt(input.businessDate, 23, input.offsetHours, 59, 59);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashSummary(summary: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(summary)).digest("hex");
}

async function loadSettings(db: PerformanceDatabase): Promise<{
  mode: string;
  effectiveFrom: string;
  aiCandidatesEnabled: boolean;
  externalNotificationsEnabled: boolean;
  impactsBonus: boolean;
  impactsLcjCoin: boolean;
}> {
  const result = await db.execute(sql`
    SELECT mode, DATE_FORMAT(effectiveFrom, '%Y-%m-%d') AS effectiveFrom,
      aiCandidatesEnabled, externalNotificationsEnabled, impactsBonus, impactsLcjCoin
    FROM performance_system_settings WHERE id = 1 LIMIT 1
  `);
  const row = rowsOf<any>(result)[0];
  return {
    mode: String(row?.mode || "shadow"),
    effectiveFrom: String(row?.effectiveFrom || jstDate()),
    aiCandidatesEnabled: Boolean(Number(row?.aiCandidatesEnabled || 0)),
    externalNotificationsEnabled: Boolean(Number(row?.externalNotificationsEnabled || 0)),
    impactsBonus: Boolean(Number(row?.impactsBonus || 0)),
    impactsLcjCoin: Boolean(Number(row?.impactsLcjCoin || 0)),
  };
}

async function seedRuleAndTemplates(db: PerformanceDatabase, actorUserId: number | null): Promise<number> {
  const settings = await loadSettings(db);
  const versionCode = `${PERFORMANCE_RULE_VERSION_CODE}-${PERFORMANCE_TEMPLATE_CATALOG_HASH.slice(0, 8)}`;
  await db.execute(sql`
    INSERT IGNORE INTO performance_rule_versions (
      versionCode, status, mode, effectiveFrom, sourceHash, createdBy
    ) VALUES (
      ${versionCode}, 'shadow', 'shadow', ${settings.effectiveFrom},
      ${PERFORMANCE_TEMPLATE_CATALOG_HASH}, ${actorUserId}
    )
  `);
  const versionResult = await db.execute(sql`
    SELECT id FROM performance_rule_versions WHERE versionCode = ${versionCode} LIMIT 1
  `);
  const ruleVersionId = Number(rowsOf<{ id: number }>(versionResult)[0]?.id || 0);
  if (!ruleVersionId) throw new Error("performance rule version initialization failed");

  for (const template of PERFORMANCE_TEMPLATE_CATALOG) {
    const sourceHash = createHash("sha256").update(stableJson(template)).digest("hex");
    await db.execute(sql`
      INSERT IGNORE INTO performance_templates (
        templateCode, ruleVersionId, responsibilityLine, roleName, triggerCycle,
        title, defaultDeadline, evidenceSource, completionCondition, reviewerRole,
        primaryDimension, sourceAdapter, status, sourceHash
      ) VALUES (
        ${template.templateCode}, ${ruleVersionId}, ${template.responsibilityLine},
        ${template.roleName}, ${template.triggerCycle}, ${template.title},
        ${template.defaultDeadline}, ${template.evidenceSource},
        ${template.completionCondition}, ${template.reviewerRole},
        ${template.primaryDimension}, ${template.sourceAdapter},
        ${template.defaultStatus}, ${sourceHash}
      )
    `);
  }
  return ruleVersionId;
}

async function seedPrimaryAssignments(
  db: PerformanceDatabase,
  actorUserId: number,
  effectiveFrom: string,
): Promise<number> {
  const beforeResult = await db.execute(sql`SELECT COUNT(*) AS total FROM performance_role_assignments`);
  const before = Number(rowsOf<{ total: number }>(beforeResult)[0]?.total || 0);
  await db.execute(sql`
    INSERT INTO performance_role_assignments (
      staffId, assignmentType, roleCode, roleName, scopeType, scopeId, scopeLabel,
      reviewerStaffId, effectiveFrom, status, source, createdBy
    )
    SELECT
      s.id,
      'primary',
      CONCAT('HR-', s.id),
      COALESCE(NULLIF(TRIM(s.position), ''), '岗位未配置'),
      'department',
      COALESCE(NULLIF(TRIM(s.department), ''), 'UNASSIGNED'),
      NULLIF(TRIM(s.department), ''),
      (
        SELECT manager_staff.id
        FROM user_management_scopes ums
        INNER JOIN users manager_user ON manager_user.id = ums.userId
        INNER JOIN staff manager_staff
          ON LOWER(TRIM(manager_staff.email)) = LOWER(TRIM(REGEXP_REPLACE(manager_user.email, '^(resigned|disabled)_[0-9]+_', '')))
          AND manager_staff.isActive = 'active'
          AND manager_staff.archivedAt IS NULL
          AND manager_staff.mergedIntoStaffId IS NULL
        WHERE ums.managementLevel = 'department_manager'
          AND LOWER(TRIM(ums.managedDepartment)) = LOWER(TRIM(s.department))
          AND manager_staff.id <> s.id
        ORDER BY manager_staff.id
        LIMIT 1
      ),
      ${effectiveFrom},
      'active',
      'hr_current',
      ${actorUserId}
    FROM staff s
    WHERE s.isActive = 'active'
      AND s.archivedAt IS NULL
      AND s.mergedIntoStaffId IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM performance_role_assignments existing
        WHERE existing.staffId = s.id
          AND existing.assignmentType = 'primary'
          AND existing.status = 'active'
          AND (existing.effectiveTo IS NULL OR existing.effectiveTo >= ${effectiveFrom})
      )
  `);
  const afterResult = await db.execute(sql`SELECT COUNT(*) AS total FROM performance_role_assignments`);
  const after = Number(rowsOf<{ total: number }>(afterResult)[0]?.total || 0);
  return Math.max(0, after - before);
}

export async function ensurePerformanceInitialized(
  db: PerformanceDatabase,
  actorUserId = 0,
): Promise<{ ruleVersionId: number; settings: Awaited<ReturnType<typeof loadSettings>>; templates: number; assignments: number }> {
  const today = jstDate();
  await ensurePerformanceTables(db, today);
  const ruleVersionId = await seedRuleAndTemplates(db, actorUserId || null);
  const settings = await loadSettings(db);
  const assignments = await seedPrimaryAssignments(db, actorUserId, settings.effectiveFrom);
  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM performance_templates WHERE ruleVersionId = ${ruleVersionId}
  `);
  return {
    ruleVersionId,
    settings,
    templates: Number(rowsOf<{ total: number }>(countResult)[0]?.total || 0),
    assignments,
  };
}

async function loadActiveTemplates(db: PerformanceDatabase, ruleVersionId: number): Promise<Map<string, TemplateRow[]>> {
  const result = await db.execute(sql`
    SELECT id, templateCode, ruleVersionId, primaryDimension, sourceAdapter, status
    FROM performance_templates
    WHERE ruleVersionId = ${ruleVersionId} AND status IN ('shadow', 'active')
    ORDER BY sourceAdapter, templateCode
  `);
  const templates = new Map<string, TemplateRow[]>();
  for (const row of rowsOf<any>(result)) {
    const sourceAdapter = String(row.sourceAdapter);
    const template: TemplateRow = {
      id: Number(row.id),
      templateCode: String(row.templateCode),
      ruleVersionId: Number(row.ruleVersionId),
      primaryDimension: String(row.primaryDimension),
      sourceAdapter,
      status: String(row.status),
    };
    templates.set(sourceAdapter, [...(templates.get(sourceAdapter) || []), template]);
  }
  return templates;
}

async function loadReviewerMap(db: PerformanceDatabase): Promise<Map<number, number | null>> {
  const result = await db.execute(sql`
    SELECT staffId, reviewerStaffId
    FROM performance_role_assignments
    WHERE assignmentType = 'primary' AND status = 'active'
      AND effectiveFrom <= CURRENT_DATE
      AND (effectiveTo IS NULL OR effectiveTo >= CURRENT_DATE)
    ORDER BY id DESC
  `);
  const map = new Map<number, number | null>();
  for (const row of rowsOf<any>(result)) {
    const staffId = Number(row.staffId);
    if (!map.has(staffId)) map.set(staffId, row.reviewerStaffId ? Number(row.reviewerStaffId) : null);
  }
  return map;
}

async function collectDailyReportFacts(
  db: PerformanceDatabase,
  template: TemplateRow,
  fromDate: string,
  endDate: string,
  reviewerMap: Map<number, number | null>,
): Promise<FactObservation[]> {
  const profileResult = await db.execute(sql`
    SELECT
      s.id AS staffId,
      s.country,
      (
        SELECT rs.id
        FROM report_staff rs
        WHERE rs.linkedStaffId = s.id
          AND rs.isActive = 'active'
          AND rs.archivedAt IS NULL
        ORDER BY rs.updatedAt DESC, rs.id DESC
        LIMIT 1
      ) AS reportStaffId
    FROM staff s
    WHERE s.isActive = 'active'
      AND s.archivedAt IS NULL
      AND s.mergedIntoStaffId IS NULL
  `);
  const reportsResult = await db.execute(sql`
    SELECT r.id, r.reportStaffId, DATE_FORMAT(r.reportDate, '%Y-%m-%d') AS businessDate,
      r.workContent, r.issues, r.remarks, r.createdAt, r.updatedAt
    FROM reports r
    WHERE DATE(r.reportDate) BETWEEN ${fromDate} AND ${endDate}
    ORDER BY r.updatedAt DESC, r.id DESC
  `);
  const reportByProfileDate = new Map<string, any>();
  for (const row of rowsOf<any>(reportsResult)) {
    const key = `${row.reportStaffId}:${row.businessDate}`;
    if (!reportByProfileDate.has(key)) reportByProfileDate.set(key, row);
  }
  const facts: FactObservation[] = [];
  for (const profile of rowsOf<any>(profileResult)) {
    const staffId = Number(profile.staffId);
    const offset = /中国|china|cn/i.test(String(profile.country || "")) ? 8 : 9;
    for (const date of dateRange(fromDate, endDate)) {
      if (!isWeekday(date)) continue;
      const reportStaffId = profile.reportStaffId ? Number(profile.reportStaffId) : null;
      const report = reportStaffId ? reportByProfileDate.get(`${reportStaffId}:${date}`) : undefined;
      const contentLength = String(report?.workContent || "").trim().length;
      const completedAt = contentLength > 0 ? toDate(report?.createdAt) : null;
      const deadline = performanceDailyObligationDeadline({ businessDate: date, offsetHours: offset, legacyHour: 23 });
      facts.push({
        template,
        staffId,
        reviewerStaffId: reviewerMap.get(staffId) || null,
        businessDate: date,
        dueAt: deadline,
        status: completedAt ? "completed" : "pending",
        completedAt,
        isOnTime: completedAt ? completedAt.getTime() <= deadline.getTime() : null,
        sourceType: "daily_report",
        sourceId: date,
        dataQuality: !reportStaffId || (report && contentLength < 20) ? "partial" : "verified",
        completionNumerator: completedAt ? 1 : 0,
        completionDenominator: 1,
        applicabilityStatus: "applicable",
        summary: {
          reportProfileAvailable: Boolean(reportStaffId),
          reportId: report ? Number(report.id) : null,
          submitted: Boolean(completedAt),
          contentLength,
          hasIssues: Boolean(String(report?.issues || "").trim()),
          hasRemarks: Boolean(String(report?.remarks || "").trim()),
          businessDate: date,
        },
      });
    }
  }
  return facts;
}

async function collectTaskFacts(
  db: PerformanceDatabase,
  template: TemplateRow,
  effectiveFrom: string,
  reviewerMap: Map<number, number | null>,
): Promise<FactObservation[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT t.id, t.taskId, assigned.staffId, t.status, t.deadline, t.completedAt,
      t.startDate, t.createdAt, t.updatedAt
    FROM tasks t
    INNER JOIN (
      SELECT taskId, staffId FROM task_staff
      UNION
      SELECT id AS taskId, staffId FROM tasks
    ) assigned ON assigned.taskId = t.id
    INNER JOIN staff s ON s.id = assigned.staffId
    WHERE DATE(t.createdAt) >= ${effectiveFrom}
      AND s.isActive = 'active' AND s.archivedAt IS NULL AND s.mergedIntoStaffId IS NULL
  `);
  return rowsOf<any>(result).map(row => {
    const completedAt = toDate(row.completedAt ? Number(row.completedAt) : null);
    const deadline = toDate(row.deadline);
    const status = row.status === "cancelled" ? "cancelled" : row.status === "completed" ? "completed" : "pending";
    const staffId = Number(row.staffId);
    return {
      template,
      staffId,
      reviewerStaffId: reviewerMap.get(staffId) || null,
      businessDate: jstDate(toDate(row.createdAt) || new Date()),
      dueAt: deadline,
      status,
      completedAt,
      isOnTime: completedAt && deadline ? completedAt.getTime() <= deadline.getTime() : null,
      sourceType: "task",
      sourceId: String(row.id),
      dataQuality: "verified",
      completionNumerator: status === "completed" ? 1 : 0,
      completionDenominator: 1,
      applicabilityStatus: "applicable",
      summary: {
        taskId: String(row.taskId),
        status: String(row.status),
        hasDeadline: Boolean(deadline),
        completedAt: completedAt?.toISOString() || null,
      },
    } as FactObservation;
  });
}

async function collectIssueFacts(
  db: PerformanceDatabase,
  template: TemplateRow,
  effectiveFrom: string,
  reviewerMap: Map<number, number | null>,
): Promise<FactObservation[]> {
  try {
    const result = await db.execute(sql`
      SELECT i.id, i.status, i.deadline, i.completedAt, i.createdAt, i.priority,
        staff_member.id AS staffId
      FROM issues i
      INNER JOIN users account ON account.id = i.assigneeId
      INNER JOIN staff staff_member
        ON LOWER(TRIM(staff_member.email)) = LOWER(TRIM(REGEXP_REPLACE(account.email, '^(resigned|disabled)_[0-9]+_', '')))
        AND staff_member.isActive = 'active'
        AND staff_member.archivedAt IS NULL
        AND staff_member.mergedIntoStaffId IS NULL
      WHERE DATE(i.createdAt) >= ${effectiveFrom}
    `);
    return rowsOf<any>(result).map(row => {
      const completedAt = toDate(row.completedAt);
      const deadline = toDate(row.deadline);
      const staffId = Number(row.staffId);
      return {
        template,
        staffId,
        reviewerStaffId: reviewerMap.get(staffId) || null,
        businessDate: jstDate(toDate(row.createdAt) || new Date()),
        dueAt: deadline,
        status: ["completed", "closed"].includes(String(row.status)) ? "completed" : "pending",
        completedAt,
        isOnTime: completedAt && deadline ? completedAt.getTime() <= deadline.getTime() : null,
        sourceType: "issue",
        sourceId: String(row.id),
        dataQuality: "verified",
        completionNumerator: ["completed", "closed"].includes(String(row.status))
          ? 1
          : String(row.status) === "waiting_confirm"
            ? 0.75
            : String(row.status) === "in_progress"
              ? 0.5
              : 0,
        completionDenominator: 1,
        applicabilityStatus: "applicable",
        summary: {
          issueId: Number(row.id),
          status: String(row.status),
          priority: String(row.priority || "medium"),
          hasDeadline: Boolean(deadline),
          completedAt: completedAt?.toISOString() || null,
        },
      } as FactObservation;
    });
  } catch (error: any) {
    if (/doesn't exist|does not exist|ER_NO_SUCH_TABLE/i.test(String(error?.message || error))) return [];
    throw error;
  }
}

async function collectMorningFacts(
  db: PerformanceDatabase,
  template: TemplateRow,
  fromDate: string,
  endDate: string,
  reviewerMap: Map<number, number | null>,
): Promise<FactObservation[]> {
  const staffResult = await db.execute(sql`
    SELECT id, country
    FROM staff
    WHERE isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
  `);
  const recitationResult = await db.execute(sql`
    SELECT date, targetKey, createdAt
    FROM morning_principle_recitations
    WHERE date BETWEEN ${fromDate} AND ${endDate}
      AND recordingType = 'principles' AND status = 'completed'
  `);
  const meetingResult = await db.execute(sql`
    SELECT date, teamCode, participantSnapshot, createdAt
    FROM morning_meetings
    WHERE date BETWEEN ${fromDate} AND ${endDate}
      AND recordingKind = 'daily_team' AND status = 'completed'
    ORDER BY createdAt DESC
  `);
  const recitationByKey = new Map<string, any>();
  for (const row of rowsOf<any>(recitationResult)) {
    const key = `${row.date}:${row.targetKey}`;
    if (!recitationByKey.has(key)) recitationByKey.set(key, row);
  }
  const participantsByDateTeam = new Map<string, Set<string>>();
  for (const row of rowsOf<any>(meetingResult)) {
    const key = `${row.date}:${row.teamCode}`;
    if (participantsByDateTeam.has(key)) continue;
    let snapshot: any[] = [];
    try {
      snapshot = Array.isArray(row.participantSnapshot)
        ? row.participantSnapshot
        : JSON.parse(String(row.participantSnapshot || "[]"));
    } catch {
      snapshot = [];
    }
    participantsByDateTeam.set(key, new Set(snapshot.map(item => String(item?.targetKey || "")).filter(Boolean)));
  }
  const facts: FactObservation[] = [];
  for (const member of rowsOf<any>(staffResult)) {
    const staffId = Number(member.id);
    const teamCode = staffCountryToTeamCode(member.country);
    if (!teamCode) continue;
    for (const date of dateRange(fromDate, endDate)) {
      if (!isWeekday(date)) continue;
      const targetKey = `staff:${staffId}`;
      const recitation = recitationByKey.get(`${date}:${targetKey}`);
      const attended = participantsByDateTeam.get(`${date}:${teamCode}`)?.has(targetKey) || false;
      const completed = Boolean(recitation && attended);
      const deadline = performanceDailyObligationDeadline({
        businessDate: date,
        offsetHours: teamCode === "china" ? 8 : 9,
        legacyHour: 12,
      });
      facts.push({
        template,
        staffId,
        reviewerStaffId: reviewerMap.get(staffId) || null,
        businessDate: date,
        dueAt: deadline,
        status: completed ? "completed" : "pending",
        completedAt: completed ? toDate(recitation.createdAt) : null,
        isOnTime: completed && recitation ? (toDate(recitation.createdAt)?.getTime() || Infinity) <= deadline.getTime() : null,
        sourceType: "morning_meeting",
        sourceId: date,
        dataQuality: "verified",
        completionNumerator: Number(Boolean(recitation)) + Number(attended),
        completionDenominator: 2,
        applicabilityStatus: "applicable",
        summary: { businessDate: date, principlesCompleted: Boolean(recitation), attendedTeamMeeting: attended, teamCode },
      });
    }
  }
  return facts;
}

async function collectLivestreamFacts(
  db: PerformanceDatabase,
  template: TemplateRow,
  effectiveFrom: string,
  reviewerMap: Map<number, number | null>,
): Promise<FactObservation[]> {
  const result = await db.execute(sql`
    SELECT live.id, live.livestreamDate, live.livestreamEndTime, live.createdAt, live.updatedAt,
      live.createdBy, live.result, live.resultReason, staff_member.id AS staffId
    FROM brand_livestreams live
    INNER JOIN users account ON account.id = live.createdBy
    INNER JOIN staff staff_member
      ON LOWER(TRIM(staff_member.email)) = LOWER(TRIM(REGEXP_REPLACE(account.email, '^(resigned|disabled)_[0-9]+_', '')))
      AND staff_member.isActive = 'active'
      AND staff_member.archivedAt IS NULL
      AND staff_member.mergedIntoStaffId IS NULL
    WHERE live.deletedAt IS NULL AND DATE(live.createdAt) >= ${effectiveFrom}
  `);
  return rowsOf<any>(result).map(row => {
    const staffId = Number(row.staffId);
    const businessDate = jstDate(toDate(row.livestreamDate) || toDate(row.createdAt) || new Date());
    const deadline = dueAt(dateMinusDays(businessDate, -1), 18, 9);
    const completedAt = toDate(row.updatedAt) || toDate(row.createdAt);
    return {
      template,
      staffId,
      reviewerStaffId: reviewerMap.get(staffId) || null,
      businessDate,
      dueAt: deadline,
      status: "completed",
      completedAt,
      isOnTime: completedAt ? completedAt.getTime() <= deadline.getTime() : null,
      sourceType: "livestream_registration",
      sourceId: String(row.id),
      dataQuality: row.result && row.resultReason ? "verified" : "partial",
      completionNumerator: 1 + Number(Boolean(row.result)) + Number(Boolean(String(row.resultReason || "").trim())),
      completionDenominator: 3,
      applicabilityStatus: "applicable",
      summary: {
        livestreamId: Number(row.id),
        businessDate,
        hasResult: Boolean(row.result),
        hasReviewReason: Boolean(String(row.resultReason || "").trim()),
      },
    } as FactObservation;
  });
}

async function hasApprovedException(
  db: PerformanceDatabase,
  fact: FactObservation,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT id FROM performance_exceptions
    WHERE staffId = ${fact.staffId}
      AND status = 'approved'
      AND startsAt <= ${fact.dueAt || new Date(`${fact.businessDate}T23:59:59+09:00`)}
      AND endsAt >= ${new Date(`${fact.businessDate}T00:00:00+09:00`)}
      AND (templateId IS NULL OR templateId = ${fact.template.id})
    LIMIT 1
  `);
  return rowsOf(result).length > 0;
}

async function upsertFact(
  db: PerformanceDatabase,
  fact: FactObservation,
  counters: PerformanceReconciliationCounters,
  now: Date,
): Promise<void> {
  const evidenceKey = buildPerformanceEvidenceKey({
    templateCode: fact.template.templateCode,
    staffId: fact.staffId,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
  });
  const exception = await hasApprovedException(db, fact);
  const storedStatus = exception ? "exception" : fact.status;
  const applicabilityStatus = exception ? "excluded" : fact.applicabilityStatus;
  const completionRate = calculateCompletionRate({
    numerator: Number(fact.completionNumerator || 0),
    denominator: Number(fact.completionDenominator || 0),
    applicable: applicabilityStatus === "applicable",
  });
  await db.execute(sql`
    INSERT INTO performance_item_instances (
      evidenceKey, templateId, staffId, reviewerStaffId, businessDate, dueAt,
      status, completedAt, isOnTime, sourceType, sourceId, primaryDimension,
      dataQuality, completionNumerator, completionDenominator, completionRate,
      applicabilityStatus, ruleVersionId, lastObservedAt
    ) VALUES (
      ${evidenceKey}, ${fact.template.id}, ${fact.staffId}, ${fact.reviewerStaffId},
      ${fact.businessDate}, ${fact.dueAt}, ${storedStatus}, ${fact.completedAt},
      ${fact.isOnTime}, ${fact.sourceType}, ${fact.sourceId},
      ${normalizePerformanceDimension(fact.template.primaryDimension)},
      ${fact.dataQuality}, ${fact.completionNumerator}, ${fact.completionDenominator},
      ${completionRate}, ${applicabilityStatus}, ${fact.template.ruleVersionId}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      reviewerStaffId = VALUES(reviewerStaffId),
      dueAt = VALUES(dueAt),
      status = CASE WHEN status = 'exception' THEN status ELSE VALUES(status) END,
      completedAt = VALUES(completedAt),
      isOnTime = VALUES(isOnTime),
      dataQuality = VALUES(dataQuality),
      completionNumerator = VALUES(completionNumerator),
      completionDenominator = VALUES(completionDenominator),
      completionRate = VALUES(completionRate),
      applicabilityStatus = VALUES(applicabilityStatus),
      lastObservedAt = VALUES(lastObservedAt)
  `);
  counters.itemsObserved += 1;
  if (fact.dataQuality === "source_error") counters.sourceErrors += 1;

  const itemResult = await db.execute(sql`
    SELECT id, status FROM performance_item_instances WHERE evidenceKey = ${evidenceKey} LIMIT 1
  `);
  const item = rowsOf<any>(itemResult)[0];
  if (!item) return;
  const contentHash = hashSummary(fact.summary);
  const evidenceInsert = await db.execute(sql`
    INSERT IGNORE INTO performance_evidence_snapshots (
      itemId, sourceType, sourceId, summaryJson, contentHash, observedAt
    ) VALUES (
      ${Number(item.id)}, ${fact.sourceType}, ${fact.sourceId},
      ${JSON.stringify(fact.summary)}, ${contentHash}, ${now}
    )
  `);
  counters.evidenceSnapshots += Number((evidenceInsert as any)?.[0]?.affectedRows || 0);

  if (storedStatus === "completed" || storedStatus === "exception" || storedStatus === "cancelled") {
    await db.execute(sql`
      UPDATE performance_reminders SET status = 'closed', closedAt = ${now}
      WHERE itemId = ${Number(item.id)} AND status = 'open'
    `);
    return;
  }
  const reminderCountResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM performance_reminders WHERE itemId = ${Number(item.id)}
  `);
  const reminderCount = Number(rowsOf<{ total: number }>(reminderCountResult)[0]?.total || 0);
  const level = reminderLevelForItem({ status: storedStatus, dueAt: fact.dueAt, now, reminderCount });
  if (level === "pending") return;
  const reminderKey = `${evidenceKey}:${level}`;
  const reminderInsert = await db.execute(sql`
    INSERT INTO performance_reminders (
      reminderKey, itemId, level, channel, status, remediateBy
    ) VALUES (
      ${reminderKey}, ${Number(item.id)}, ${level}, 'in_app', 'open',
      ${fact.dueAt ? new Date(fact.dueAt.getTime() + 24 * 60 * 60 * 1000) : null}
    )
    ON DUPLICATE KEY UPDATE
      status = 'open', closedAt = NULL, remediateBy = VALUES(remediateBy)
  `);
  counters.remindersOpened += Number((reminderInsert as any)?.[0]?.affectedRows || 0) === 1 ? 1 : 0;
  await db.execute(sql`
    UPDATE performance_item_instances
    SET status = ${level}
    WHERE id = ${Number(item.id)} AND status NOT IN ('completed', 'exception', 'cancelled', 'source_error')
  `);
}

export async function runPerformanceReconciliation(
  db: PerformanceDatabase,
  options: { actorUserId?: number; now?: Date; force?: boolean } = {},
): Promise<{ skipped: boolean; runKey: string; counters: PerformanceReconciliationCounters; settings: Awaited<ReturnType<typeof loadSettings>> }> {
  const now = options.now || new Date();
  const initialized = await ensurePerformanceInitialized(db, options.actorUserId || 0);
  const settings = initialized.settings;
  const slot = options.force ? `manual-${now.getTime()}` : String(Math.floor(now.getTime() / (15 * 60 * 1000)));
  const runKey = `${jstDate(now)}:${slot}:${PERFORMANCE_TEMPLATE_CATALOG_HASH.slice(0, 8)}`;
  const counters: PerformanceReconciliationCounters = {
    staffAssignments: initialized.assignments,
    templates: initialized.templates,
    itemsObserved: 0,
    evidenceSnapshots: 0,
    remindersOpened: 0,
    responseFactsObserved: 0,
    sourceErrors: 0,
  };

  try {
    const inserted = await db.execute(sql`
      INSERT IGNORE INTO performance_reconciliation_runs (runKey, mode, countersJson)
      VALUES (${runKey}, 'shadow', ${JSON.stringify(counters)})
    `);
    if (Number((inserted as any)?.[0]?.affectedRows || 0) !== 1) {
      return { skipped: true, runKey, counters, settings };
    }
    const templates = await loadActiveTemplates(db, initialized.ruleVersionId);
    const reviewerMap = await loadReviewerMap(db);
    const today = jstDate(now);
    const fromDate = maxDate(settings.effectiveFrom, dateMinusDays(today, 2));
    const observations: FactObservation[] = [];

    for (const template of templates.get("daily_report") || []) {
      observations.push(...await collectDailyReportFacts(db, template, fromDate, today, reviewerMap));
    }
    for (const template of templates.get("task") || []) {
      observations.push(...await collectTaskFacts(db, template, settings.effectiveFrom, reviewerMap));
    }
    for (const template of templates.get("issue") || []) {
      observations.push(...await collectIssueFacts(db, template, settings.effectiveFrom, reviewerMap));
    }
    for (const template of templates.get("morning_meeting") || []) {
      observations.push(...await collectMorningFacts(db, template, fromDate, today, reviewerMap));
    }
    for (const template of templates.get("livestream_registration") || []) {
      observations.push(...await collectLivestreamFacts(db, template, settings.effectiveFrom, reviewerMap));
    }

    for (const observation of observations) {
      await upsertFact(db, observation, counters, now);
    }
    counters.responseFactsObserved = await reconcilePerformanceResponseFacts(db, settings.effectiveFrom);
    await db.execute(sql`
      UPDATE performance_reconciliation_runs
      SET status = 'completed', finishedAt = ${now}, countersJson = ${JSON.stringify(counters)}
      WHERE runKey = ${runKey}
    `);
    return { skipped: false, runKey, counters, settings };
  } catch (error: any) {
    await db.execute(sql`
      UPDATE performance_reconciliation_runs
      SET status = 'failed', finishedAt = ${now}, errorMessage = ${String(error?.message || error).slice(0, 4000)},
        countersJson = ${JSON.stringify(counters)}
      WHERE runKey = ${runKey}
    `).catch(() => undefined);
    throw error;
  }
}

export function performanceJstDateForTests(value: Date): string {
  return jstDate(value);
}
