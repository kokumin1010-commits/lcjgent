import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  PERFORMANCE_DIMENSION_CAPS,
  PERFORMANCE_DIMENSION_LABELS,
  calculateFactDimensionScore,
  normalizePerformanceDimension,
  shouldRequireSecondReview,
  type PerformanceDimension,
} from "../shared/performancePolicy";
import type { PerformanceAccess } from "./performanceAccess";
import {
  assertCanReviewPerformanceStaff,
  assertCanViewPerformanceStaff,
  requirePerformanceAdmin,
  requirePerformanceStaff,
} from "./performanceAccess";
import { ensurePerformanceInitialized, runPerformanceReconciliation } from "./performanceReconciliationService";
import type { PerformanceDatabase } from "./performanceUpgrade";

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function jstDate(value = new Date()): string {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function currentYearMonth(value = new Date()): string {
  return jstDate(value).slice(0, 7);
}

function normalizeYearMonth(value: string | undefined): string {
  const month = value || currentYearMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "月份格式必须为YYYY-MM" });
  }
  return month;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

async function appendAudit(
  executor: Pick<PerformanceDatabase, "execute">,
  input: {
    requestId: string;
    actorUserId: number;
    actorStaffId: number | null;
    entityType: string;
    entityId: string;
    action: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
  },
): Promise<void> {
  await executor.execute(sql`
    INSERT INTO performance_audit_logs (
      requestId, actorUserId, actorStaffId, entityType, entityId,
      action, beforeState, afterState
    ) VALUES (
      ${input.requestId}, ${input.actorUserId}, ${input.actorStaffId},
      ${input.entityType}, ${input.entityId}, ${input.action},
      ${JSON.stringify(input.beforeState)}, ${JSON.stringify(input.afterState)}
    )
  `);
}

export function buildDimensionRows(items: any[], ledger: any[]) {
  const completionItems = items.filter(item =>
    !["exception", "cancelled", "source_error"].includes(String(item.status))
    && String(item.applicabilityStatus || "applicable") === "applicable"
  );
  const completionAchieved = completionItems.reduce((sum, item) => {
    if (item.completionRate != null && Number.isFinite(Number(item.completionRate))) {
      return sum + Math.min(1, Math.max(0, Number(item.completionRate)));
    }
    return sum + Number(String(item.status) === "completed");
  }, 0);
  const timedItems = completionItems.filter(item => Boolean(item.dueAt));
  const timedAchieved = timedItems.filter(item => String(item.status) === "completed" && Boolean(item.isOnTime)).length;
  const closureItems = completionItems.filter(item => String(item.primaryDimension) === "accuracy_closure");
  const closureAchieved = closureItems.filter(item => String(item.status) === "completed").length;
  const ledgerByDimension = new Map<PerformanceDimension, number>();
  for (const row of ledger) {
    const dimension = normalizePerformanceDimension(row.dimension);
    ledgerByDimension.set(dimension, (ledgerByDimension.get(dimension) || 0) + Number(row.points || 0));
  }

  const base: Record<PerformanceDimension, { applicable: number; achieved: number; score: number | null }> = {
    completion: {
      applicable: completionItems.length,
      achieved: completionAchieved,
      score: calculateFactDimensionScore({ dimension: "completion", applicableCount: completionItems.length, achievedCount: completionAchieved }),
    },
    timeliness: {
      applicable: timedItems.length,
      achieved: timedAchieved,
      score: calculateFactDimensionScore({ dimension: "timeliness", applicableCount: timedItems.length, achievedCount: timedAchieved }),
    },
    accuracy_closure: {
      applicable: closureItems.length,
      achieved: closureAchieved,
      score: calculateFactDimensionScore({ dimension: "accuracy_closure", applicableCount: closureItems.length, achievedCount: closureAchieved }),
    },
    quality: { applicable: 0, achieved: 0, score: null },
    initiative: { applicable: 0, achieved: 0, score: null },
    manager_evaluation: { applicable: 0, achieved: 0, score: null },
  };

  const dimensions = (Object.keys(PERFORMANCE_DIMENSION_CAPS) as PerformanceDimension[]).map(dimension => {
    const adjustment = Math.round((ledgerByDimension.get(dimension) || 0) * 10) / 10;
    const baseScore = base[dimension].score;
    const applicable = base[dimension].applicable > 0 || adjustment !== 0;
    const rawScore = baseScore == null ? adjustment : baseScore + adjustment;
    const score = applicable
      ? Math.round(Math.min(PERFORMANCE_DIMENSION_CAPS[dimension], Math.max(0, rawScore)) * 10) / 10
      : null;
    return {
      dimension,
      label: PERFORMANCE_DIMENSION_LABELS[dimension],
      cap: PERFORMANCE_DIMENSION_CAPS[dimension],
      applicable,
      applicableCount: base[dimension].applicable,
      achievedCount: base[dimension].achieved,
      baseScore,
      adjustment,
      score,
    };
  });
  const applicableMaximum = dimensions.filter(row => row.applicable).reduce((sum, row) => sum + row.cap, 0);
  const shadowScore = dimensions.reduce((sum, row) => sum + (row.score || 0), 0);
  const normalizedScore = applicableMaximum > 0 ? Math.round((shadowScore / applicableMaximum) * 1000) / 10 : null;
  return { dimensions, applicableMaximum, shadowScore, normalizedScore };
}

export async function getPerformanceDashboard(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { staffId?: number; yearMonth?: string },
) {
  const initialized = await ensurePerformanceInitialized(db, access.userId);
  const staffId = input.staffId || requirePerformanceStaff(access);
  assertCanViewPerformanceStaff(access, staffId);
  const yearMonth = normalizeYearMonth(input.yearMonth);
  const staffResult = await db.execute(sql`
    SELECT id, name, department, position, country
    FROM staff WHERE id = ${staffId} AND isActive = 'active'
      AND archivedAt IS NULL AND mergedIntoStaffId IS NULL LIMIT 1
  `);
  const staffRow = rowsOf<any>(staffResult)[0];
  if (!staffRow) throw new TRPCError({ code: "NOT_FOUND", message: "员工不存在或已归档" });

  const itemResult = await db.execute(sql`
    SELECT item.id, item.evidenceKey, item.businessDate, item.dueAt, item.status,
      item.completedAt, item.isOnTime, item.sourceType, item.sourceId,
      item.primaryDimension, item.dataQuality, item.completionNumerator,
      item.completionDenominator, item.completionRate, item.applicabilityStatus, item.updatedAt,
      template.templateCode, template.title, template.evidenceSource
    FROM performance_item_instances item
    INNER JOIN performance_templates template ON template.id = item.templateId
    WHERE item.staffId = ${staffId}
      AND DATE_FORMAT(item.businessDate, '%Y-%m') = ${yearMonth}
    ORDER BY item.businessDate DESC, item.id DESC
    LIMIT 500
  `);
  const ledgerResult = await db.execute(sql`
    SELECT id, dimension, points, mode, evidenceKey, reason, createdAt
    FROM performance_ledger
    WHERE staffId = ${staffId} AND yearMonth = ${yearMonth}
    ORDER BY id DESC
  `);
  const reminderResult = await db.execute(sql`
    SELECT reminder.id, reminder.level, reminder.status, reminder.remediateBy, reminder.createdAt,
      item.businessDate, item.sourceType, template.title
    FROM performance_reminders reminder
    INNER JOIN performance_item_instances item ON item.id = reminder.itemId
    INNER JOIN performance_templates template ON template.id = item.templateId
    WHERE item.staffId = ${staffId} AND reminder.status = 'open'
    ORDER BY reminder.createdAt DESC LIMIT 100
  `);
  const candidateResult = await db.execute(sql`
    SELECT id, dimension, recommendedPoints, candidateType, confidence, reason, status, createdAt
    FROM performance_score_candidates
    WHERE staffId = ${staffId} AND DATE_FORMAT(createdAt, '%Y-%m') = ${yearMonth}
    ORDER BY id DESC LIMIT 100
  `);
  const appealResult = await db.execute(sql`
    SELECT id, candidateId, ledgerId, managerReviewId, statement, status, resolution, createdAt, resolvedAt
    FROM performance_appeals WHERE staffId = ${staffId} ORDER BY id DESC LIMIT 100
  `);
  const responseResult = await db.execute(sql`
    SELECT channel, status, speedBand, responseMinutes, closureMinutes, applicable, exclusionReason
    FROM performance_response_facts
    WHERE staffId = ${staffId} AND DATE_FORMAT(businessDate, '%Y-%m') = ${yearMonth}
    ORDER BY businessDate DESC, id DESC
  `);
  const assignmentResult = await db.execute(sql`
    SELECT id, assignmentType, roleCode, roleName, scopeType, scopeId, scopeLabel,
      reviewerStaffId, effectiveFrom, effectiveTo, status, source
    FROM performance_role_assignments
    WHERE staffId = ${staffId}
      AND status = 'active'
      AND effectiveFrom <= LAST_DAY(CONCAT(${yearMonth}, '-01'))
      AND (effectiveTo IS NULL OR effectiveTo >= CONCAT(${yearMonth}, '-01'))
    ORDER BY assignmentType, id DESC
  `);

  const items = rowsOf<any>(itemResult);
  const ledger = rowsOf<any>(ledgerResult);
  const responseFacts = rowsOf<any>(responseResult);
  const applicableResponseFacts = responseFacts.filter(row => Boolean(Number(row.applicable)));
  const respondedFacts = applicableResponseFacts.filter(row => row.responseMinutes != null);
  const averageResponseMinutes = respondedFacts.length > 0
    ? Math.round(respondedFacts.reduce((sum, row) => sum + Number(row.responseMinutes || 0), 0) / respondedFacts.length)
    : null;
  const score = buildDimensionRows(items, ledger);
  return {
    mode: initialized.settings.mode,
    safeBoundaries: {
      impactsBonus: initialized.settings.impactsBonus,
      impactsLcjCoin: initialized.settings.impactsLcjCoin,
      aiCandidatesEnabled: initialized.settings.aiCandidatesEnabled,
      externalNotificationsEnabled: initialized.settings.externalNotificationsEnabled,
      retrospectiveScoringEnabled: false,
    },
    effectiveFrom: initialized.settings.effectiveFrom,
    yearMonth,
    staff: {
      id: Number(staffRow.id),
      name: String(staffRow.name),
      department: staffRow.department || null,
      position: staffRow.position || null,
      country: staffRow.country || null,
    },
    access: {
      canReview: access.isSuperAdmin || access.reviewableStaffIds.includes(staffId),
      canViewTeam: access.isSuperAdmin || access.reviewableStaffIds.length > 0,
      canConfigure: access.isSuperAdmin,
      isSelf: access.staffId === staffId,
    },
    score,
    responseMetrics: {
      applicableCount: applicableResponseFacts.length,
      respondedCount: respondedFacts.length,
      pendingCount: applicableResponseFacts.filter(row => String(row.status) === "pending").length,
      excludedCount: responseFacts.length - applicableResponseFacts.length,
      averageResponseMinutes,
      within24HoursCount: respondedFacts.filter(row => ["within_2h", "within_8h", "within_24h"].includes(String(row.speedBand))).length,
      byChannel: Object.fromEntries(["line", "sales_email", "internal_chat", "issue"].map(channel => [
        channel,
        applicableResponseFacts.filter(row => String(row.channel) === channel).length,
      ])),
      contentIncluded: false,
    },
    summary: {
      itemCount: items.length,
      completedCount: items.filter(item => String(item.status) === "completed").length,
      overdueCount: items.filter(item => ["first_reminder", "yellow", "orange_review", "red_review"].includes(String(item.status))).length,
      exceptionCount: items.filter(item => String(item.status) === "exception").length,
      openReminderCount: rowsOf(reminderResult).length,
      pendingCandidateCount: rowsOf<any>(candidateResult).filter(row => ["pending_review", "second_review"].includes(String(row.status))).length,
    },
    assignments: rowsOf<any>(assignmentResult).map(row => ({ ...row, id: Number(row.id), reviewerStaffId: row.reviewerStaffId ? Number(row.reviewerStaffId) : null })),
    items: items.map(item => ({
      ...item,
      id: Number(item.id),
      isOnTime: item.isOnTime == null ? null : Boolean(Number(item.isOnTime)),
      completionNumerator: item.completionNumerator == null ? null : Number(item.completionNumerator),
      completionDenominator: item.completionDenominator == null ? null : Number(item.completionDenominator),
      completionRate: item.completionRate == null ? null : Number(item.completionRate),
    })),
    reminders: rowsOf<any>(reminderResult).map(row => ({ ...row, id: Number(row.id) })),
    ledger: ledger.map(row => ({ ...row, id: Number(row.id), points: Number(row.points || 0) })),
    candidates: rowsOf<any>(candidateResult).map(row => ({
      ...row,
      id: Number(row.id),
      recommendedPoints: Number(row.recommendedPoints || 0),
      confidence: row.confidence == null ? null : Number(row.confidence),
    })),
    appeals: rowsOf<any>(appealResult).map(row => ({ ...row, id: Number(row.id) })),
  };
}

export async function getPerformanceTeamDashboard(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  yearMonthInput?: string,
) {
  await ensurePerformanceInitialized(db, access.userId);
  const yearMonth = normalizeYearMonth(yearMonthInput);
  const visibleStaffIds = access.isSuperAdmin
    ? rowsOf<{ id: number }>(await db.execute(sql`
        SELECT id FROM staff WHERE isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL ORDER BY id
      `)).map(row => Number(row.id))
    : [...new Set([...(access.staffId ? [access.staffId] : []), ...access.reviewableStaffIds])];
  if (visibleStaffIds.length === 0) return { yearMonth, members: [], summary: { memberCount: 0, completed: 0, overdue: 0, openReminders: 0 } };

  const staffResult = await db.execute(sql`
    SELECT id, name, department, position
    FROM staff
    WHERE id IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
      AND isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
    ORDER BY department, name
  `);
  const itemResult = await db.execute(sql`
    SELECT staffId, primaryDimension, status, dueAt, completedAt, isOnTime,
      completionRate, applicabilityStatus
    FROM performance_item_instances
    WHERE staffId IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
      AND DATE_FORMAT(businessDate, '%Y-%m') = ${yearMonth}
  `);
  const reminderResult = await db.execute(sql`
    SELECT item.staffId, COUNT(*) AS total
    FROM performance_reminders reminder
    INNER JOIN performance_item_instances item ON item.id = reminder.itemId
    WHERE item.staffId IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
      AND reminder.status = 'open'
    GROUP BY item.staffId
  `);
  const ledgerResult = await db.execute(sql`
    SELECT staffId, dimension, points FROM performance_ledger
    WHERE staffId IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
      AND yearMonth = ${yearMonth}
  `);
  const responseResult = await db.execute(sql`
    SELECT staffId, status, speedBand, responseMinutes, applicable
    FROM performance_response_facts
    WHERE staffId IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
      AND DATE_FORMAT(businessDate, '%Y-%m') = ${yearMonth}
  `);
  const aiResult = await db.execute(sql`
    SELECT assessment.staffId, assessment.id, assessment.status, assessment.version,
      assessment.structuredJson, assessment.generatedAt
    FROM performance_ai_monthly_assessments assessment
    INNER JOIN (
      SELECT staffId, MAX(version) AS version
      FROM performance_ai_monthly_assessments
      WHERE staffId IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
        AND yearMonth = ${yearMonth}
      GROUP BY staffId
    ) latest ON latest.staffId = assessment.staffId AND latest.version = assessment.version
    WHERE assessment.yearMonth = ${yearMonth}
  `);
  const monthlyReviewResult = await db.execute(sql`
    SELECT review_row.staffId, review_row.id, review_row.status, review_row.version,
      review_row.normalizedScore, review_row.submittedAt, review_row.lockedAt
    FROM performance_manager_monthly_reviews review_row
    INNER JOIN (
      SELECT staffId, MAX(version) AS version
      FROM performance_manager_monthly_reviews
      WHERE staffId IN (${sql.join(visibleStaffIds.map(id => sql`${id}`), sql`, `)})
        AND yearMonth = ${yearMonth}
      GROUP BY staffId
    ) latest ON latest.staffId = review_row.staffId AND latest.version = review_row.version
    WHERE review_row.yearMonth = ${yearMonth}
  `);
  const itemsByStaff = new Map<number, any[]>();
  for (const row of rowsOf<any>(itemResult)) {
    const id = Number(row.staffId);
    itemsByStaff.set(id, [...(itemsByStaff.get(id) || []), row]);
  }
  const ledgerByStaff = new Map<number, any[]>();
  for (const row of rowsOf<any>(ledgerResult)) {
    const id = Number(row.staffId);
    ledgerByStaff.set(id, [...(ledgerByStaff.get(id) || []), row]);
  }
  const reminderByStaff = new Map(rowsOf<any>(reminderResult).map(row => [Number(row.staffId), Number(row.total || 0)]));
  const aiByStaff = new Map(rowsOf<any>(aiResult).map(row => [Number(row.staffId), row]));
  const monthlyReviewByStaff = new Map(rowsOf<any>(monthlyReviewResult).map(row => [Number(row.staffId), row]));
  const responsesByStaff = new Map<number, any[]>();
  for (const row of rowsOf<any>(responseResult)) {
    const id = Number(row.staffId);
    responsesByStaff.set(id, [...(responsesByStaff.get(id) || []), row]);
  }
  const members = rowsOf<any>(staffResult).map(member => {
    const id = Number(member.id);
    const items = itemsByStaff.get(id) || [];
    const score = buildDimensionRows(items, ledgerByStaff.get(id) || []);
    const responseFacts = (responsesByStaff.get(id) || []).filter(row => Boolean(Number(row.applicable)));
    const respondedFacts = responseFacts.filter(row => row.responseMinutes != null);
    return {
      staffId: id,
      name: String(member.name),
      department: member.department || null,
      position: member.position || null,
      score,
      itemCount: items.length,
      completedCount: items.filter(item => String(item.status) === "completed").length,
      overdueCount: items.filter(item => ["first_reminder", "yellow", "orange_review", "red_review"].includes(String(item.status))).length,
      openReminderCount: reminderByStaff.get(id) || 0,
      responseMetrics: {
        applicableCount: responseFacts.length,
        respondedCount: respondedFacts.length,
        averageResponseMinutes: respondedFacts.length > 0
          ? Math.round(respondedFacts.reduce((sum, row) => sum + Number(row.responseMinutes || 0), 0) / respondedFacts.length)
          : null,
      },
      aiAssessment: aiByStaff.get(id) ? {
        id: Number(aiByStaff.get(id).id),
        status: String(aiByStaff.get(id).status),
        version: Number(aiByStaff.get(id).version),
        normalizedScore: parseJson<any>(aiByStaff.get(id).structuredJson, null)?.normalizedScore ?? null,
        generatedAt: aiByStaff.get(id).generatedAt || null,
      } : null,
      managerReview: monthlyReviewByStaff.get(id) ? {
        id: Number(monthlyReviewByStaff.get(id).id),
        status: String(monthlyReviewByStaff.get(id).status),
        version: Number(monthlyReviewByStaff.get(id).version),
        normalizedScore: Number(monthlyReviewByStaff.get(id).normalizedScore || 0),
        submittedAt: monthlyReviewByStaff.get(id).submittedAt || null,
        lockedAt: monthlyReviewByStaff.get(id).lockedAt || null,
      } : null,
      canReview: access.isSuperAdmin || access.reviewableStaffIds.includes(id),
    };
  });
  return {
    yearMonth,
    members,
    summary: {
      memberCount: members.length,
      completed: members.reduce((sum, member) => sum + member.completedCount, 0),
      overdue: members.reduce((sum, member) => sum + member.overdueCount, 0),
      openReminders: members.reduce((sum, member) => sum + member.openReminderCount, 0),
    },
  };
}

export async function getPerformanceConfiguration(db: PerformanceDatabase, access: PerformanceAccess) {
  requirePerformanceAdmin(access);
  const initialized = await ensurePerformanceInitialized(db, access.userId);
  const templateResult = await db.execute(sql`
    SELECT id, templateCode, responsibilityLine, roleName, triggerCycle, title,
      defaultDeadline, evidenceSource, completionCondition, reviewerRole,
      primaryDimension, sourceAdapter, status, sourceHash, updatedAt
    FROM performance_templates
    WHERE ruleVersionId = ${initialized.ruleVersionId}
    ORDER BY templateCode
  `);
  const staffDirectoryResult = await db.execute(sql`
    SELECT id, name, department, position, country
    FROM staff
    WHERE isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
    ORDER BY department, name
  `);
  const assignmentResult = await db.execute(sql`
    SELECT assignment.id, assignment.staffId, member.name AS staffName, member.department,
      member.position, assignment.assignmentType, assignment.roleCode, assignment.roleName,
      assignment.scopeType, assignment.scopeId, assignment.scopeLabel,
      assignment.reviewerStaffId, reviewer.name AS reviewerName,
      assignment.effectiveFrom, assignment.effectiveTo, assignment.status, assignment.source
    FROM performance_role_assignments assignment
    INNER JOIN staff member ON member.id = assignment.staffId
    LEFT JOIN staff reviewer ON reviewer.id = assignment.reviewerStaffId
    WHERE assignment.status = 'active'
    ORDER BY member.department, member.name, assignment.assignmentType
  `);
  const exceptionResult = await db.execute(sql`
    SELECT exception_row.id, exception_row.staffId, member.name AS staffName,
      exception_row.templateId, template.templateCode, exception_row.exceptionType,
      exception_row.reason, exception_row.startsAt, exception_row.endsAt,
      exception_row.status, exception_row.createdAt
    FROM performance_exceptions exception_row
    INNER JOIN staff member ON member.id = exception_row.staffId
    LEFT JOIN performance_templates template ON template.id = exception_row.templateId
    ORDER BY exception_row.createdAt DESC LIMIT 200
  `);
  const runResult = await db.execute(sql`
    SELECT runKey, mode, startedAt, finishedAt, status, countersJson, errorMessage
    FROM performance_reconciliation_runs ORDER BY id DESC LIMIT 20
  `);
  return {
    settings: initialized.settings,
    ruleVersionId: initialized.ruleVersionId,
    templateCount: initialized.templates,
    templates: rowsOf<any>(templateResult).map(row => ({ ...row, id: Number(row.id) })),
    staffDirectory: rowsOf<any>(staffDirectoryResult).map(row => ({ ...row, id: Number(row.id) })),
    assignments: rowsOf<any>(assignmentResult).map(row => ({ ...row, id: Number(row.id), staffId: Number(row.staffId), reviewerStaffId: row.reviewerStaffId ? Number(row.reviewerStaffId) : null })),
    exceptions: rowsOf<any>(exceptionResult).map(row => ({ ...row, id: Number(row.id), staffId: Number(row.staffId) })),
    recentRuns: rowsOf<any>(runResult).map(row => ({ ...row, counters: parseJson(row.countersJson, {}) })),
    safety: {
      modeLockedToShadow: true,
      externalNotificationsDisabled: !initialized.settings.externalNotificationsEnabled,
      aiCandidatesDisabled: !initialized.settings.aiCandidatesEnabled,
      bonusImpactDisabled: !initialized.settings.impactsBonus,
      lcjCoinImpactDisabled: !initialized.settings.impactsLcjCoin,
      retrospectiveScoringDisabled: true,
    },
  };
}

export async function updatePerformanceTemplateStatus(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { templateId: number; status: "draft" | "shadow"; requestId: string },
) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  return db.transaction(async tx => {
    const beforeResult = await tx.execute(sql`SELECT id, templateCode, status FROM performance_templates WHERE id = ${input.templateId} FOR UPDATE`);
    const before = rowsOf<any>(beforeResult)[0];
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "岗位事项模板不存在" });
    await tx.execute(sql`UPDATE performance_templates SET status = ${input.status} WHERE id = ${input.templateId}`);
    const afterState = { ...before, status: input.status };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: access.staffId,
      entityType: "template",
      entityId: String(input.templateId),
      action: "update_status",
      beforeState: before,
      afterState,
    });
    return afterState;
  });
}

export async function createPerformanceAssignment(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    staffId: number;
    assignmentType: "primary" | "responsibility" | "project";
    roleCode: string;
    roleName: string;
    scopeType: "company" | "department" | "project" | "brand" | "store";
    scopeId?: string | null;
    scopeLabel?: string | null;
    reviewerStaffId?: number | null;
    effectiveFrom: string;
    requestId: string;
  },
) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  if (input.reviewerStaffId === input.staffId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "审核人不能是员工本人" });
  }
  return db.transaction(async tx => {
    const staffRows = rowsOf<any>(await tx.execute(sql`
      SELECT id, name FROM staff WHERE id IN (${input.staffId}, ${input.reviewerStaffId || input.staffId})
        AND isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
    `));
    if (!staffRows.some(row => Number(row.id) === input.staffId)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "目标员工不存在或已归档" });
    }
    if (input.reviewerStaffId && !staffRows.some(row => Number(row.id) === input.reviewerStaffId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "审核人不存在或已归档" });
    }
    const beforeResult = await tx.execute(sql`
      SELECT * FROM performance_role_assignments
      WHERE staffId = ${input.staffId} AND assignmentType = ${input.assignmentType}
        AND status = 'active' ORDER BY id DESC FOR UPDATE
    `);
    const before = rowsOf<any>(beforeResult);
    if (input.assignmentType === "primary") {
      await tx.execute(sql`
        UPDATE performance_role_assignments SET status = 'ended', effectiveTo = DATE_SUB(${input.effectiveFrom}, INTERVAL 1 DAY)
        WHERE staffId = ${input.staffId} AND assignmentType = 'primary' AND status = 'active'
      `);
    }
    const inserted = await tx.execute(sql`
      INSERT INTO performance_role_assignments (
        staffId, assignmentType, roleCode, roleName, scopeType, scopeId, scopeLabel,
        reviewerStaffId, effectiveFrom, status, source, createdBy
      ) VALUES (
        ${input.staffId}, ${input.assignmentType}, ${input.roleCode}, ${input.roleName},
        ${input.scopeType}, ${input.scopeId || null}, ${input.scopeLabel || null},
        ${input.reviewerStaffId || null}, ${input.effectiveFrom}, 'active', 'manual', ${access.userId}
      )
    `);
    const assignmentId = Number((inserted as any)?.[0]?.insertId || 0);
    const afterState = { ...input, id: assignmentId, status: "active", source: "manual" };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: access.staffId,
      entityType: "assignment",
      entityId: String(assignmentId),
      action: "create",
      beforeState: { assignments: before },
      afterState,
    });
    return afterState;
  });
}

export async function createPerformanceException(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    staffId: number;
    templateId?: number | null;
    exceptionType: "leave" | "system_outage" | "cancelled" | "responsibility_changed" | "not_applicable";
    reason: string;
    startsAt: string;
    endsAt: string;
    requestId: string;
  },
) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "例外结束时间不能早于开始时间" });
  }
  return db.transaction(async tx => {
    const inserted = await tx.execute(sql`
      INSERT INTO performance_exceptions (
        staffId, templateId, exceptionType, reason, startsAt, endsAt,
        status, approvedByStaffId, createdBy
      ) VALUES (
        ${input.staffId}, ${input.templateId || null}, ${input.exceptionType},
        ${input.reason}, ${new Date(input.startsAt)}, ${new Date(input.endsAt)},
        'approved', ${access.staffId}, ${access.userId}
      )
    `);
    const id = Number((inserted as any)?.[0]?.insertId || 0);
    const afterState = { ...input, id, status: "approved" };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: access.staffId,
      entityType: "exception",
      entityId: String(id),
      action: "approve",
      beforeState: null,
      afterState,
    });
    return afterState;
  });
}

export async function createManualScoreCandidate(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    staffId: number;
    itemId?: number | null;
    dimension: PerformanceDimension;
    recommendedPoints: number;
    reason: string;
    requestId: string;
  },
) {
  await ensurePerformanceInitialized(db, access.userId);
  assertCanReviewPerformanceStaff(access, input.staffId);
  if (Math.abs(input.recommendedPoints) > 20) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "单次候选调整不得超过20分" });
  }
  return db.transaction(async tx => {
    const inserted = await tx.execute(sql`
      INSERT INTO performance_score_candidates (
        itemId, staffId, dimension, recommendedPoints, candidateType,
        confidence, reason, citationsJson, status
      ) VALUES (
        ${input.itemId || null}, ${input.staffId}, ${input.dimension},
        ${input.recommendedPoints}, 'manual', NULL, ${input.reason}, ${JSON.stringify([])},
        'pending_review'
      )
    `);
    const id = Number((inserted as any)?.[0]?.insertId || 0);
    const afterState = { ...input, id, status: "pending_review" };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: access.staffId,
      entityType: "candidate",
      entityId: String(id),
      action: "create_manual",
      beforeState: null,
      afterState,
    });
    return afterState;
  });
}

export async function reviewScoreCandidate(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    candidateId: number;
    decision: "approve" | "reject";
    finalPoints?: number | null;
    reason: string;
    requestId: string;
  },
) {
  const reviewerStaffId = requirePerformanceStaff(access);
  await ensurePerformanceInitialized(db, access.userId);
  return db.transaction(async tx => {
    const candidateResult = await tx.execute(sql`
      SELECT * FROM performance_score_candidates WHERE id = ${input.candidateId} FOR UPDATE
    `);
    const candidate = rowsOf<any>(candidateResult)[0];
    if (!candidate) throw new TRPCError({ code: "NOT_FOUND", message: "积分候选不存在" });
    assertCanReviewPerformanceStaff(access, Number(candidate.staffId));
    if (!["pending_review", "second_review"].includes(String(candidate.status))) {
      throw new TRPCError({ code: "CONFLICT", message: "该积分候选已经处理" });
    }
    const points = input.decision === "approve"
      ? Number(input.finalPoints ?? candidate.recommendedPoints)
      : 0;
    if (Math.abs(points) > 20) throw new TRPCError({ code: "BAD_REQUEST", message: "单次调整不得超过20分" });

    const previousDecisions = rowsOf<any>(await tx.execute(sql`
      SELECT reviewerStaffId, decision FROM performance_review_decisions
      WHERE candidateId = ${input.candidateId} ORDER BY id
    `));
    if (previousDecisions.some(row => Number(row.reviewerStaffId) === reviewerStaffId)) {
      throw new TRPCError({ code: "CONFLICT", message: "同一审核人不能重复审核该候选" });
    }
    const decisionInsert = await tx.execute(sql`
      INSERT INTO performance_review_decisions (
        candidateId, reviewerStaffId, decision, finalPoints, reason
      ) VALUES (
        ${input.candidateId}, ${reviewerStaffId}, ${input.decision},
        ${input.decision === "approve" ? points : null}, ${input.reason}
      )
    `);
    const decisionId = Number((decisionInsert as any)?.[0]?.insertId || 0);
    let nextStatus = input.decision === "reject" ? "rejected" : "approved";
    if (input.decision === "approve" && shouldRequireSecondReview(points) && previousDecisions.length === 0) {
      nextStatus = "second_review";
    }
    await tx.execute(sql`
      UPDATE performance_score_candidates SET status = ${nextStatus} WHERE id = ${input.candidateId}
    `);
    if (nextStatus === "approved" && points !== 0) {
      const yearMonthResult = candidate.itemId
        ? await tx.execute(sql`
            SELECT DATE_FORMAT(businessDate, '%Y-%m') AS yearMonth, evidenceKey
            FROM performance_item_instances WHERE id = ${Number(candidate.itemId)} LIMIT 1
          `)
        : null;
      const item = yearMonthResult ? rowsOf<any>(yearMonthResult)[0] : null;
      const yearMonth = String(item?.yearMonth || currentYearMonth());
      const ledgerKey = `candidate:${input.candidateId}`;
      await tx.execute(sql`
        INSERT IGNORE INTO performance_ledger (
          ledgerKey, staffId, yearMonth, dimension, points, mode,
          evidenceKey, reviewDecisionId, reason
        ) VALUES (
          ${ledgerKey}, ${Number(candidate.staffId)}, ${yearMonth}, ${candidate.dimension},
          ${points}, 'shadow', ${item?.evidenceKey || null}, ${decisionId}, ${input.reason}
        )
      `);
    }
    const afterState = { candidateId: input.candidateId, status: nextStatus, decision: input.decision, points };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: reviewerStaffId,
      entityType: "candidate",
      entityId: String(input.candidateId),
      action: `review_${input.decision}`,
      beforeState: candidate,
      afterState,
    });
    return afterState;
  });
}

export async function createPerformanceAppeal(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { candidateId?: number | null; ledgerId?: number | null; managerReviewId?: number | null; statement: string; requestId: string },
) {
  const staffId = requirePerformanceStaff(access);
  await ensurePerformanceInitialized(db, access.userId);
  const referenceCount = [input.candidateId, input.ledgerId, input.managerReviewId].filter(Boolean).length;
  if (referenceCount !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "申诉必须且只能关联积分候选、流水或月末终评之一" });
  }
  return db.transaction(async tx => {
    const ownershipResult = input.candidateId
      ? await tx.execute(sql`SELECT id FROM performance_score_candidates WHERE id = ${input.candidateId} AND staffId = ${staffId} LIMIT 1`)
      : input.ledgerId
        ? await tx.execute(sql`SELECT id FROM performance_ledger WHERE id = ${input.ledgerId} AND staffId = ${staffId} LIMIT 1`)
        : await tx.execute(sql`SELECT id FROM performance_manager_monthly_reviews WHERE id = ${input.managerReviewId} AND staffId = ${staffId} AND status = 'locked' LIMIT 1`);
    if (rowsOf(ownershipResult).length === 0) {
      throw new TRPCError({ code: "FORBIDDEN", message: "只能申诉自己的积分记录" });
    }
    const inserted = await tx.execute(sql`
      INSERT INTO performance_appeals (
        staffId, candidateId, ledgerId, managerReviewId, statement, attachmentsJson, status
      ) VALUES (
        ${staffId}, ${input.candidateId || null}, ${input.ledgerId || null},
        ${input.managerReviewId || null}, ${input.statement}, ${JSON.stringify([])}, 'submitted'
      )
    `);
    const id = Number((inserted as any)?.[0]?.insertId || 0);
    const afterState = { id, staffId, ...input, status: "submitted" };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: staffId,
      entityType: "appeal",
      entityId: String(id),
      action: "submit",
      beforeState: null,
      afterState,
    });
    return afterState;
  });
}

export async function getPerformanceReviewQueue(db: PerformanceDatabase, access: PerformanceAccess) {
  await ensurePerformanceInitialized(db, access.userId);
  const visibleIds: number[] | null = access.isSuperAdmin ? null : access.reviewableStaffIds;
  if (visibleIds !== null && visibleIds.length === 0) return { candidates: [], appeals: [] };
  const candidateResult = visibleIds
    ? await db.execute(sql`
        SELECT candidate.*, member.name AS staffName, member.department, template.title AS itemTitle
        FROM performance_score_candidates candidate
        INNER JOIN staff member ON member.id = candidate.staffId
        LEFT JOIN performance_item_instances item ON item.id = candidate.itemId
        LEFT JOIN performance_templates template ON template.id = item.templateId
        WHERE candidate.status IN ('pending_review', 'second_review')
          AND candidate.staffId IN (${sql.join(visibleIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY candidate.createdAt DESC
      `)
    : await db.execute(sql`
        SELECT candidate.*, member.name AS staffName, member.department, template.title AS itemTitle
        FROM performance_score_candidates candidate
        INNER JOIN staff member ON member.id = candidate.staffId
        LEFT JOIN performance_item_instances item ON item.id = candidate.itemId
        LEFT JOIN performance_templates template ON template.id = item.templateId
        WHERE candidate.status IN ('pending_review', 'second_review')
        ORDER BY candidate.createdAt DESC
      `);
  const appealResult = visibleIds
    ? await db.execute(sql`
        SELECT appeal.*, member.name AS staffName, member.department
        FROM performance_appeals appeal
        INNER JOIN staff member ON member.id = appeal.staffId
        WHERE appeal.status IN ('submitted', 'first_review')
          AND appeal.staffId IN (${sql.join(visibleIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY appeal.createdAt DESC
      `)
    : await db.execute(sql`
        SELECT appeal.*, member.name AS staffName, member.department
        FROM performance_appeals appeal
        INNER JOIN staff member ON member.id = appeal.staffId
        WHERE appeal.status IN ('submitted', 'first_review')
        ORDER BY appeal.createdAt DESC
      `);
  const monthlyReviewResult = visibleIds
    ? await db.execute(sql`
        SELECT review_row.*, member.name AS staffName, member.department,
          submitter.name AS submittedByName
        FROM performance_manager_monthly_reviews review_row
        INNER JOIN staff member ON member.id = review_row.staffId
        LEFT JOIN staff submitter ON submitter.id = review_row.submittedByStaffId
        WHERE review_row.status = 'pending_second_review'
          AND review_row.staffId IN (${sql.join(visibleIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY review_row.createdAt DESC
      `)
    : await db.execute(sql`
        SELECT review_row.*, member.name AS staffName, member.department,
          submitter.name AS submittedByName
        FROM performance_manager_monthly_reviews review_row
        INNER JOIN staff member ON member.id = review_row.staffId
        LEFT JOIN staff submitter ON submitter.id = review_row.submittedByStaffId
        WHERE review_row.status = 'pending_second_review'
        ORDER BY review_row.createdAt DESC
      `);
  return {
    candidates: rowsOf<any>(candidateResult).map(row => ({ ...row, id: Number(row.id), staffId: Number(row.staffId), recommendedPoints: Number(row.recommendedPoints || 0) })),
    appeals: rowsOf<any>(appealResult).map(row => ({ ...row, id: Number(row.id), staffId: Number(row.staffId) })),
    monthlyReviews: rowsOf<any>(monthlyReviewResult).map(row => ({
      ...row,
      id: Number(row.id),
      staffId: Number(row.staffId),
      version: Number(row.version),
      submittedByStaffId: Number(row.submittedByStaffId),
      aiAssessmentId: row.aiAssessmentId ? Number(row.aiAssessmentId) : null,
      applicableMaximum: Number(row.applicableMaximum || 0),
      finalScore: Number(row.finalScore || 0),
      normalizedScore: Number(row.normalizedScore || 0),
      dimensionScores: parseJson(row.dimensionScoresJson, []),
    })),
  };
}

export async function reconcilePerformanceNow(db: PerformanceDatabase, access: PerformanceAccess) {
  requirePerformanceAdmin(access);
  return runPerformanceReconciliation(db, { actorUserId: access.userId, force: true });
}

export async function getPerformanceAudit(db: PerformanceDatabase, access: PerformanceAccess, limit = 100) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  const safeLimit = Math.min(200, Math.max(1, limit));
  const result = await db.execute(sql.raw(`
    SELECT audit.id, audit.requestId, audit.actorUserId, audit.actorStaffId,
      actor.name AS actorName, audit.entityType, audit.entityId, audit.action,
      audit.beforeState, audit.afterState, audit.createdAt
    FROM performance_audit_logs audit
    LEFT JOIN staff actor ON actor.id = audit.actorStaffId
    ORDER BY audit.id DESC LIMIT ${safeLimit}
  `));
  return rowsOf<any>(result).map(row => ({
    ...row,
    id: Number(row.id),
    beforeState: parseJson(row.beforeState, null),
    afterState: parseJson(row.afterState, null),
  }));
}

export async function resolvePerformanceAppeal(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    appealId: number;
    decision: "accept" | "reject";
    resolution: string;
    requestId: string;
  },
) {
  const reviewerStaffId = requirePerformanceStaff(access);
  await ensurePerformanceInitialized(db, access.userId);
  return db.transaction(async tx => {
    const appealResult = await tx.execute(sql`
      SELECT * FROM performance_appeals WHERE id = ${input.appealId} FOR UPDATE
    `);
    const appeal = rowsOf<any>(appealResult)[0];
    if (!appeal) throw new TRPCError({ code: "NOT_FOUND", message: "申诉不存在" });
    assertCanReviewPerformanceStaff(access, Number(appeal.staffId));
    if (!["submitted", "first_review"].includes(String(appeal.status))) {
      throw new TRPCError({ code: "CONFLICT", message: "该申诉已经处理" });
    }

    const nextStatus = input.decision === "accept" ? "accepted" : "rejected";
    if (input.decision === "accept" && appeal.ledgerId) {
      const ledgerResult = await tx.execute(sql`
        SELECT * FROM performance_ledger WHERE id = ${Number(appeal.ledgerId)} LIMIT 1
      `);
      const original = rowsOf<any>(ledgerResult)[0];
      if (original) {
        await tx.execute(sql`
          INSERT IGNORE INTO performance_ledger (
            ledgerKey, staffId, yearMonth, dimension, points, mode,
            evidenceKey, reversalOfLedgerId, reason
          ) VALUES (
            ${`appeal:${input.appealId}:reversal`}, ${Number(original.staffId)},
            ${String(original.yearMonth)}, ${String(original.dimension)},
            ${-Number(original.points || 0)}, 'shadow', ${original.evidenceKey || null},
            ${Number(original.id)}, ${input.resolution}
          )
        `);
      }
    }
    await tx.execute(sql`
      UPDATE performance_appeals
      SET status = ${nextStatus}, resolution = ${input.resolution},
        resolvedByStaffId = ${reviewerStaffId}, resolvedAt = NOW(3)
      WHERE id = ${input.appealId}
    `);
    const afterState = { appealId: input.appealId, status: nextStatus, resolution: input.resolution };
    await appendAudit(tx as any, {
      requestId: input.requestId,
      actorUserId: access.userId,
      actorStaffId: reviewerStaffId,
      entityType: "appeal",
      entityId: String(input.appealId),
      action: `resolve_${input.decision}`,
      beforeState: appeal,
      afterState,
    });
    return afterState;
  });
}
