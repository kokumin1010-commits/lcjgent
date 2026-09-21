import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PERFORMANCE_DIMENSION_CAPS,
  canonicalizePerformanceItems,
  reminderLevelForItem,
  calculateCompletionRate,
  calculateFactDimensionScore,
  responseSpeedBand,
  shouldRequireManagerDifferenceReason,
  shouldRequireMonthlyReviewSecondApproval,
  shouldRequireSecondReview,
} from "../shared/performancePolicy";
import {
  PERFORMANCE_RULE_VERSION_CODE,
  PERFORMANCE_TEMPLATE_CATALOG,
  PERFORMANCE_TEMPLATE_CATALOG_HASH,
} from "./performanceTemplateCatalog";
import {
  PERFORMANCE_ALL_DAY_DEADLINE_EFFECTIVE_FROM,
  performanceDailyObligationDeadline,
  performanceJstDateForTests,
  performanceManualChecklistDueAt,
} from "./performanceReconciliationService";
import { buildResponseFactKey, responseMinutesBetween } from "./performanceResponseService";
import {
  PERFORMANCE_AI_SCHEMA_VERSION,
  validateAiMonthlyAssessment,
} from "./performanceMonthlyReviewService";
import {
  buildDimensionRows,
  performanceItemDateGroup,
  performanceLocalBusinessDate,
} from "./performanceService";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("performance V2 policy", () => {
  it("imports every provided position item with deterministic codes and hash", () => {
    expect(PERFORMANCE_TEMPLATE_CATALOG).toHaveLength(42);
    expect(new Set(PERFORMANCE_TEMPLATE_CATALOG.map(item => item.templateCode)).size).toBe(42);
    expect(PERFORMANCE_TEMPLATE_CATALOG_HASH).toMatch(/^[a-f0-9]{64}$/);
    expect(PERFORMANCE_RULE_VERSION_CODE).toBe("LCJ-PERFORMANCE-V2-SHADOW");
  });

  it("only enables implemented evidence adapters in shadow mode", () => {
    const shadowAdapters = PERFORMANCE_TEMPLATE_CATALOG
      .filter(item => item.defaultStatus === "shadow")
      .map(item => item.sourceAdapter)
      .sort();
    expect(shadowAdapters).toEqual([
      "daily_report",
      "issue",
      "livestream_registration",
      "morning_meeting",
      "task",
    ]);
    expect(PERFORMANCE_TEMPLATE_CATALOG.filter(item => item.sourceAdapter === "manual").every(item => item.defaultStatus === "draft")).toBe(true);
  });

  it("uses applicable denominators and never treats not-applicable as zero", () => {
    expect(calculateFactDimensionScore({ dimension: "completion", applicableCount: 0, achievedCount: 0 })).toBeNull();
    expect(calculateFactDimensionScore({ dimension: "completion", applicableCount: 4, achievedCount: 3 })).toBe(22.5);
    expect(calculateFactDimensionScore({ dimension: "timeliness", applicableCount: 2, achievedCount: 1 })).toBe(10);
    expect(Object.values(PERFORMANCE_DIMENSION_CAPS).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("keeps fractional item completion bounded and treats non-applicable as null", () => {
    expect(calculateCompletionRate({ numerator: 1, denominator: 2 })).toBe(0.5);
    expect(calculateCompletionRate({ numerator: 3, denominator: 2 })).toBe(1);
    expect(calculateCompletionRate({ numerator: -1, denominator: 2 })).toBe(0);
    expect(calculateCompletionRate({ numerator: 0, denominator: 0 })).toBeNull();
    expect(calculateCompletionRate({ numerator: 1, denominator: 2, applicable: false })).toBeNull();
  });

  it("classifies only attributable response durations and keeps missing durations as N/A", () => {
    expect(responseMinutesBetween(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-01T01:30:00Z"))).toBe(90);
    expect(responseMinutesBetween(new Date("2026-09-01T02:00:00Z"), new Date("2026-09-01T01:30:00Z"))).toBeNull();
    expect(responseSpeedBand(120)).toBe("within_2h");
    expect(responseSpeedBand(121)).toBe("within_8h");
    expect(responseSpeedBand(1_441)).toBe("over_24h");
    expect(responseSpeedBand(null)).toBe("na");
    expect(buildResponseFactKey({ channel: "line", sourceType: "line_message", sourceId: "synthetic-1", staffId: 42 }))
      .toBe("line:line_message:synthetic-1:42");
  });

  it("requires manager difference reasons and second review at deterministic thresholds", () => {
    expect(shouldRequireManagerDifferenceReason({ aiNormalizedScore: 80, managerNormalizedScore: 85, maximumDimensionDelta: 1 })).toBe(true);
    expect(shouldRequireManagerDifferenceReason({ aiNormalizedScore: 80, managerNormalizedScore: 82, maximumDimensionDelta: 2 })).toBe(true);
    expect(shouldRequireManagerDifferenceReason({ aiNormalizedScore: null, managerNormalizedScore: 90, maximumDimensionDelta: 0 })).toBe(false);
    expect(shouldRequireMonthlyReviewSecondApproval({ aiNormalizedScore: 80, managerNormalizedScore: 90, maximumDimensionDeltaRatio: 0.1 })).toBe(true);
    expect(shouldRequireMonthlyReviewSecondApproval({ aiNormalizedScore: 80, managerNormalizedScore: 85, maximumDimensionDeltaRatio: 0.51 })).toBe(true);
  });

  it("validates AI month results against fixed dimensions and allowed evidence", () => {
    const factsCutoffAt = "2026-09-30T14:59:59.000Z";
    const assessment = {
      schemaVersion: PERFORMANCE_AI_SCHEMA_VERSION,
      staffId: 42,
      yearMonth: "2026-09",
      factsCutoffAt,
      dimensions: [
        { dimension: "completion", applicable: true, score: 24, cap: 30, confidence: 0.9, reason: "synthetic", evidenceIds: ["item:1"] },
        { dimension: "timeliness", applicable: true, score: 16, cap: 20, confidence: 0.8, reason: "synthetic", evidenceIds: ["response:2"] },
        { dimension: "quality", applicable: false, score: null, cap: 20, confidence: 0.2, reason: "N/A", evidenceIds: [] },
        { dimension: "accuracy_closure", applicable: true, score: 8, cap: 10, confidence: 0.8, reason: "synthetic", evidenceIds: ["item:3"] },
        { dimension: "initiative", applicable: false, score: null, cap: 10, confidence: 0.2, reason: "N/A", evidenceIds: [] },
        { dimension: "manager_evaluation", applicable: false, score: null, cap: 10, confidence: 0, reason: "管理员专用", evidenceIds: [] },
      ],
      applicableMaximum: 60,
      totalScore: 48,
      normalizedScore: 80,
      overallConfidence: 0.8,
      keyContributions: ["synthetic"],
      risks: [],
      nextMonthSuggestions: ["synthetic"],
      dataGaps: [],
    };
    const validated = validateAiMonthlyAssessment(assessment, {
      staffId: 42,
      yearMonth: "2026-09",
      factsCutoffAt,
      allowedEvidenceIds: new Set(["item:1", "response:2", "item:3"]),
    });
    expect(validated.normalizedScore).toBe(80);
    expect(() => validateAiMonthlyAssessment({ ...assessment, dimensions: assessment.dimensions.map((row, index) => index === 0 ? { ...row, evidenceIds: ["item:missing"] } : row) }, {
      staffId: 42,
      yearMonth: "2026-09",
      factsCutoffAt,
      allowedEvidenceIds: new Set(["item:1", "response:2", "item:3"]),
    })).toThrow(/不存在的证据/);
  });

  it("requires a second reviewer only above five absolute points", () => {
    expect(shouldRequireSecondReview(5)).toBe(false);
    expect(shouldRequireSecondReview(-5)).toBe(false);
    expect(shouldRequireSecondReview(5.1)).toBe(true);
    expect(shouldRequireSecondReview(-8)).toBe(true);
  });

  it("escalates 2h, 6h, next day and second day without auto penalties", () => {
    const dueAt = new Date("2026-09-17T00:00:00Z");
    const levelAt = (value: string) => reminderLevelForItem({ status: "pending", dueAt, now: new Date(value) });
    expect(levelAt("2026-09-17T01:59:00Z")).toBe("pending");
    expect(levelAt("2026-09-17T02:00:00Z")).toBe("first_reminder");
    expect(levelAt("2026-09-17T06:00:00Z")).toBe("yellow");
    expect(levelAt("2026-09-18T01:00:00Z")).toBe("orange_review");
    expect(levelAt("2026-09-19T01:00:00Z")).toBe("red_review");
  });

  it("keeps JST business dates deterministic", () => {
    expect(performanceJstDateForTests(new Date("2026-09-16T15:30:00Z"))).toBe("2026-09-17");
  });

  it("gives daily obligations the full local business day without changing prior dates", () => {
    expect(PERFORMANCE_ALL_DAY_DEADLINE_EFFECTIVE_FROM).toBe("2026-09-17");
    expect(performanceDailyObligationDeadline({ businessDate: "2026-09-17", offsetHours: 9, legacyHour: 12 }).toISOString())
      .toBe("2026-09-17T14:59:59.000Z");
    expect(performanceDailyObligationDeadline({ businessDate: "2026-09-17", offsetHours: 8, legacyHour: 12 }).toISOString())
      .toBe("2026-09-17T15:59:59.000Z");
    expect(performanceDailyObligationDeadline({ businessDate: "2026-09-16", offsetHours: 9, legacyHour: 12 }).toISOString())
      .toBe("2026-09-16T03:00:00.000Z");
  });

  it("applies custom system-item deadlines in each employee's local timezone", () => {
    expect(performanceManualChecklistDueAt({ businessDate: "2026-09-18", country: "日本", deadlineTime: "18:30" }).toISOString())
      .toBe("2026-09-18T09:30:59.000Z");
    expect(performanceManualChecklistDueAt({ businessDate: "2026-09-18", country: "中国", deadlineTime: "18:30" }).toISOString())
      .toBe("2026-09-18T10:30:59.000Z");
  });

  it("groups items by each employee's local business date", () => {
    const instant = new Date("2026-09-17T15:30:00.000Z");
    expect(performanceLocalBusinessDate("中国", instant)).toBe("2026-09-17");
    expect(performanceLocalBusinessDate("日本", instant)).toBe("2026-09-18");
    expect(performanceItemDateGroup("2026-09-18", "2026-09-18")).toBe("today");
    expect(performanceItemDateGroup("2026-09-17", "2026-09-18")).toBe("history");
    expect(performanceItemDateGroup("2026-09-19", "2026-09-18")).toBe("upcoming");
  });

  it("keeps one canonical daily item per template, staff and business date", () => {
    const rows = canonicalizePerformanceItems([
      { id: 11, evidenceKey: "ALL-D01:40:daily_report:2026-09-17", templateCode: "ALL-D01", staffId: 40, sourceType: "daily_report", businessDate: "2026-09-17", status: "pending", dataQuality: "verified", completionRate: 0 },
      { id: 12, evidenceKey: "ALL-D01:40:daily_report:299", templateCode: "ALL-D01", staffId: 40, sourceType: "daily_report", businessDate: "2026-09-17", status: "completed", dataQuality: "verified", completionRate: 1 },
      { id: 15, evidenceKey: "ALL-D01:40:daily_report:2026-09-18", templateCode: "ALL-D01", staffId: 40, sourceType: "daily_report", businessDate: "2026-09-18", status: "completed", dataQuality: "verified", completionRate: 1 },
      { id: 16, evidenceKey: "ALL-D01:40:daily_report:300", templateCode: "ALL-D01", staffId: 40, sourceType: "daily_report", businessDate: "2026-09-18", status: "completed", dataQuality: "verified", completionRate: 1 },
      { id: 13, evidenceKey: "ALL-D02:40:task:501", templateCode: "ALL-D02", staffId: 40, sourceType: "task", businessDate: "2026-09-17", status: "completed", dataQuality: "verified", completionRate: 1 },
      { id: 14, evidenceKey: "ALL-D02:40:task:502", templateCode: "ALL-D02", staffId: 40, sourceType: "task", businessDate: "2026-09-17", status: "pending", dataQuality: "verified", completionRate: 0 },
    ]);
    expect(rows.map(row => row.id)).toEqual([12, 15, 13, 14]);
  });

  it("excludes archived and cancelled source facts from completion and timeliness scoring", () => {
    const score = buildDimensionRows([
      { status: "completed", applicabilityStatus: "applicable", completionRate: 1, dueAt: new Date(), isOnTime: true, primaryDimension: "completion" },
      { status: "cancelled", applicabilityStatus: "excluded", completionRate: 1, dueAt: new Date(), isOnTime: true, primaryDimension: "completion" },
      { status: "pending", applicabilityStatus: "excluded", completionRate: 0, dueAt: new Date(), isOnTime: false, primaryDimension: "completion" },
    ], []);
    const completion = score.dimensions.find(row => row.dimension === "completion");
    const timeliness = score.dimensions.find(row => row.dimension === "timeliness");
    expect(completion).toMatchObject({ applicableCount: 1, achievedCount: 1 });
    expect(timeliness).toMatchObject({ applicableCount: 1, achievedCount: 1 });
  });
});

describe("performance V2 implementation contracts", () => {
  const policy = source("shared/performancePolicy.ts");
  const upgrade = source("server/performanceUpgrade.ts");
  const reconciliation = source("server/performanceReconciliationService.ts");
  const responseService = source("server/performanceResponseService.ts");
  const monthlyReviewService = source("server/performanceMonthlyReviewService.ts");
  const access = source("server/performanceAccess.ts");
  const service = source("server/performanceService.ts");
  const router = source("server/performanceRouter.ts");
  const scheduler = source("server/performanceScheduler.ts");
  const page = source("client/src/pages/PerformanceCenter.tsx");
  const app = source("client/src/App.tsx");
  const menu = source("client/src/lib/adminMenuConfig.ts");

  it("creates isolated performance tables and never writes LCJ Coin or member points", () => {
    expect(upgrade).toContain("performance_system_settings");
    expect(upgrade).toContain("performance_ledger");
    expect(upgrade).toContain("performance_audit_logs");
    expect(upgrade).toContain("impactsLcjCoin BOOLEAN NOT NULL DEFAULT FALSE");
    expect(upgrade).not.toMatch(/UPDATE\s+(users|members|point_transactions)/i);
    expect(service).not.toMatch(/INSERT\s+INTO\s+(point_transactions|lcj_coin)/i);
  });

  it("enforces non-retroactive reconciliation and idempotent evidence keys", () => {
    expect(reconciliation).toContain("maxDate(settings.effectiveFrom, dateMinusDays(today, 2))");
    expect(reconciliation).toContain("INSERT IGNORE INTO performance_reconciliation_runs");
    expect(reconciliation).toContain("ON DUPLICATE KEY UPDATE");
    expect(reconciliation).toContain("evidenceKey");
    expect(reconciliation).not.toMatch(/points\s*=\s*-/i);
  });

  it("supports multiple active templates per adapter and stores fractional completion", () => {
    expect(reconciliation).toContain("Map<string, TemplateRow[]>");
    expect(reconciliation).toContain('for (const template of templates.get("daily_report") || [])');
    expect(reconciliation).toContain("completionNumerator");
    expect(reconciliation).toContain("completionDenominator");
    expect(reconciliation).toContain("completionRate");
  });

  it("uses stable daily report evidence identity and deduplicates legacy reads", () => {
    expect(reconciliation).toContain('sourceType: "daily_report",\n        sourceId: date');
    expect(service).toContain("canonicalizePerformanceItems(rowsOf<any>(itemResult))");
    expect(monthlyReviewService).toContain("canonicalizePerformanceItems(rowsOf<any>(itemResult))");
  });

  it("labels automatic daily obligations as local-day deadlines and suppresses stale open reminders", () => {
    expect(reconciliation).toContain("PERFORMANCE_ALL_DAY_DEADLINE_EFFECTIVE_FROM");
    expect(reconciliation).toContain("performanceDailyObligationDeadline");
    expect(reconciliation).toContain("status = 'open', closedAt = NULL, remediateBy = VALUES(remediateBy)");
    expect(service).toContain("item.status IN ('first_reminder', 'yellow', 'orange_review', 'red_review')");
    expect(service).toContain('deadlineMode: ["daily_report", "morning_meeting"]');
    expect(page).toContain('item?.deadlineMode === "local_day_end"');
    expect(page).toContain("当日内（当地）");
  });

  it("keeps only today's actionable reminders and moves prior items into history presentation", () => {
    expect(service).toContain("performanceLocalBusinessDate(staffRow.country)");
    expect(service).toContain("DATE_FORMAT(item.businessDate, '%Y-%m-%d') = ${localBusinessDate}");
    expect(service).toContain("dateGroup: performanceItemDateGroup(item.businessDate, localBusinessDate)");
    expect(service).toContain("localDateByStaff");
    expect(page).toContain("今日事项");
    expect(page).toContain("历史事项");
    expect(page).toContain("历史未完成");
    expect(page).toContain("之后事项");
    expect(page).toContain("这里只显示今天仍需处理的提醒");
    expect(page).toContain("今日开放提醒");
  });

  it("collects only attributable response facts without chat content or ordinary group silence", () => {
    expect(responseService).toContain("respondedBy->line_users.staffId");
    expect(responseService).toContain("reply.replyToId IS NOT NULL");
    expect(responseService).toContain("ordinaryGroupSilenceExcluded: true");
    expect(responseService).toContain("contentIncluded: false");
    expect(responseService).not.toContain("message.content AS");
    expect(responseService).not.toMatch(/INSERT\s+INTO\s+performance_ledger/i);
  });

  it("keeps AI monthly scoring advisory, versioned and strictly structured", () => {
    expect(monthlyReviewService).toContain('export const PERFORMANCE_AI_MODEL = "gpt-5-mini"');
    expect(monthlyReviewService).toContain('type: "json_schema"');
    expect(monthlyReviewService).toContain("strict: true");
    expect(monthlyReviewService).toContain("additionalProperties: false");
    expect(monthlyReviewService).toContain("inputHash");
    expect(monthlyReviewService).toContain("retryCount");
    expect(monthlyReviewService).not.toMatch(/INSERT\s+(IGNORE\s+)?INTO\s+performance_ledger/i);
  });

  it("keeps AI and manager month scores separate with difference reason and second review", () => {
    expect(upgrade).toContain("performance_ai_monthly_assessments");
    expect(upgrade).toContain("performance_manager_monthly_reviews");
    expect(monthlyReviewService).toContain("differenceReason");
    expect(monthlyReviewService).toContain("pending_second_review");
    expect(monthlyReviewService).toContain("第一审核人不能进行二审");
    expect(monthlyReviewService).toContain("supersedesReviewId");
    expect(monthlyReviewService).toContain("管理员终评前必须先生成AI独立月评");
    expect(router).toContain("aiAssessmentId: z.number().int().positive()");
  });

  it("creates all-staff daily report obligations even when a report profile is missing", () => {
    expect(reconciliation).toContain("FROM staff s");
    expect(reconciliation).toContain("SELECT rs.id");
    expect(reconciliation).toContain("reportProfileAvailable: Boolean(reportStaffId)");
    expect(reconciliation).not.toContain("FROM report_staff rs\n    INNER JOIN staff s ON s.id = rs.linkedStaffId");
    expect(reconciliation).not.toMatch(/points\s*=\s*-/i);
  });

  it("uses stable staff ids, department scope and forbids self review", () => {
    expect(access).toContain("LOWER(TRIM");
    expect(access).toContain("managedDepartment");
    expect(access).toContain("reviewableIds.delete(own.id)");
    expect(access).toContain("不能审核自己的积分候选");
  });

  it("requires explicit review, second review, append-only reversal and audit request ids", () => {
    expect(service).toContain('nextStatus = "second_review"');
    expect(service).toContain("同一审核人不能重复审核该候选");
    expect(service).toContain("reversalOfLedgerId");
    expect(service).toContain("performance_audit_logs");
    expect(router).toContain("requestId = z.string().uuid()");
    expect(router).toContain("resolveAppeal");
  });

  it("runs in application background without external notification or AI scoring calls", () => {
    expect(scheduler).toContain("15 * 60 * 1000");
    expect(scheduler).toContain("shadow mode");
    expect(reconciliation).not.toMatch(/send(Line|Email|Feishu)|invokeLLM|openai/i);
    expect(policy).toContain("AUTO_NEGATIVE_SCORE_ALLOWED = false");
  });

  it("supports audited departments and non-retroactive manual system items", () => {
    expect(upgrade).toContain("performance_departments");
    expect(upgrade).toContain("performance_manual_item_completions");
    expect(upgrade).toContain('["performance_templates", "effectiveFrom", "DATE NULL"]');
    expect(reconciliation).toContain('templates.get("manual_system")');
    expect(reconciliation).toContain("assignment.scopeType = 'department'");
    expect(reconciliation).toContain("const effectiveFrom = maxDate(endDate, template.effectiveFrom || endDate)");
    expect(service).toContain("createPerformanceDepartment");
    expect(service).toContain("createPerformanceTemplate");
    expect(service).toContain("completeManualPerformanceItem");
    expect(service).toContain("只能确认自己的执行事项");
    const manualCompletion = service.slice(
      service.indexOf("export async function completeManualPerformanceItem"),
      service.indexOf("export async function createPerformanceAssignment"),
    );
    expect(manualCompletion).not.toMatch(/INSERT\s+INTO\s+performance_ledger/i);
    expect(router).toContain("createDepartment: protectedProcedure");
    expect(router).toContain("createTemplate: protectedProcedure");
    expect(router).toContain("completeManualItem: protectedProcedure");
    expect(page).toContain("新增部门");
    expect(page).toContain("添加执行事项");
    expect(page).toContain("canComplete &&");
    expect(page).toContain("确认完成并留痕");
  });

  it("ships self, team, review and admin interfaces with visible safety boundaries", () => {
    expect(app).toContain('path="/my/performance"');
    expect(app).toContain('path="/master/performance/team"');
    expect(app).toContain('path="/master/performance/reviews"');
    expect(app).toContain('path="/master/performance/settings"');
    expect(menu).toContain("我的执行积分");
    expect(page).toContain("不影响奖金");
    expect(page).toContain("不影响LCJ Coin");
    expect(page).toContain("不追溯历史");
    expect(page).toContain("确认并记录审计");
  });
});
