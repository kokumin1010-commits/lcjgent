import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PERFORMANCE_DIMENSION_CAPS,
  reminderLevelForItem,
  calculateFactDimensionScore,
  shouldRequireSecondReview,
} from "../shared/performancePolicy";
import {
  PERFORMANCE_RULE_VERSION_CODE,
  PERFORMANCE_TEMPLATE_CATALOG,
  PERFORMANCE_TEMPLATE_CATALOG_HASH,
} from "./performanceTemplateCatalog";
import { performanceJstDateForTests } from "./performanceReconciliationService";

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
});

describe("performance V2 implementation contracts", () => {
  const policy = source("shared/performancePolicy.ts");
  const upgrade = source("server/performanceUpgrade.ts");
  const reconciliation = source("server/performanceReconciliationService.ts");
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
