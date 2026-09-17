import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  buildProjectSourceKey,
  canTransitionProjectStatus,
  collectValidSourceRefs,
  hasUnknownSourceRefs,
  LCJ_BRAIN_DAILY_SUMMARY_JSON_SCHEMA,
  LCJ_BRAIN_SOP_JSON_SCHEMA,
  matchAutoCollectCandidate,
  normalizeProjectKeywords,
  sopContentToMarkdown,
  todayInTokyo,
} from "../shared/lcjBrainProjectSop";

function assertStrictObjects(schema: any) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object") {
    expect(schema.additionalProperties).toBe(false);
    expect(new Set(schema.required || [])).toEqual(
      new Set(Object.keys(schema.properties || {}))
    );
  }
  Object.values(schema).forEach(assertStrictObjects);
}

describe("LCJ Brain project SOP domain", () => {
  it("enforces the supported lifecycle without destructive delete transitions", () => {
    expect(canTransitionProjectStatus("draft", "active")).toBe(true);
    expect(canTransitionProjectStatus("active", "completed")).toBe(true);
    expect(canTransitionProjectStatus("completed", "active")).toBe(true);
    expect(canTransitionProjectStatus("archived", "draft")).toBe(false);
    expect(canTransitionProjectStatus("draft", "completed")).toBe(false);
  });

  it("normalizes and deduplicates project keywords", () => {
    expect(
      normalizeProjectKeywords([" LCF ", "lcf", "直播", " ", "x"])
    ).toEqual(["lcf", "直播"]);
  });

  it("uses JST as the scheduler day boundary", () => {
    expect(todayInTokyo(new Date("2026-09-16T15:05:00.000Z"))).toBe(
      "2026-09-17"
    );
  });

  it("requires both a project member and keyword in strict mode", () => {
    const scope = {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      keywords: ["LCF"],
      memberUserIds: [12],
      memberStaffIds: [34],
      mode: "strict" as const,
    };
    expect(
      matchAutoCollectCandidate(scope, {
        occurredDate: "2026-09-17",
        text: "LCF 会场准备",
        personIds: [34],
      }).matched
    ).toBe(true);
    expect(
      matchAutoCollectCandidate(scope, {
        occurredDate: "2026-09-17",
        text: "其他工作",
        personIds: [34],
      }).matched
    ).toBe(false);
    expect(
      matchAutoCollectCandidate(scope, {
        occurredDate: "2026-09-17",
        text: "LCF 会场准备",
        personIds: [99],
      }).matched
    ).toBe(false);
    expect(
      matchAutoCollectCandidate(scope, {
        occurredDate: "2026-10-01",
        text: "LCF 会场准备",
        personIds: [34],
      }).matched
    ).toBe(false);
  });

  it("supports explicit member-only mode but never global collection", () => {
    const scope = {
      startDate: "2026-09-01",
      keywords: [],
      memberUserIds: [],
      memberStaffIds: [34],
      mode: "member_only" as const,
    };
    expect(
      matchAutoCollectCandidate(scope, {
        occurredDate: "2026-09-17",
        text: "任意内容",
        personIds: [34],
      }).matched
    ).toBe(true);
    expect(
      matchAutoCollectCandidate(scope, {
        occurredDate: "2026-09-17",
        text: "任意内容",
        personIds: [99],
      }).matched
    ).toBe(false);
  });

  it("builds stable source keys and validates only known source references", () => {
    expect(buildProjectSourceKey("daily_report", 123)).toBe("daily_report:123");
    const content = {
      objective: { text: "目标", sourceRefs: [2, 1] },
      phases: [{ sourceRefs: [2, 999] }],
    };
    expect(collectValidSourceRefs(content, [1, 2, 3])).toEqual([1, 2]);
    expect(hasUnknownSourceRefs(content, [1, 2, 3])).toBe(true);
    expect(hasUnknownSourceRefs({ sourceRefs: [1, 2] }, [1, 2, 3])).toBe(false);
  });

  it("defines strict JSON schemas recursively", () => {
    assertStrictObjects(LCJ_BRAIN_DAILY_SUMMARY_JSON_SCHEMA.schema);
    assertStrictObjects(LCJ_BRAIN_SOP_JSON_SCHEMA.schema);
  });

  it("renders evidence references and unresolved gaps in SOP markdown", () => {
    const markdown = sopContentToMarkdown({
      title: "活动SOP",
      objective: { text: "完成活动", sourceRefs: [4] },
      scope: { text: "线上", sourceRefs: [4] },
      roles: [],
      prerequisites: [],
      phases: [],
      checklists: [],
      exceptionHandling: [],
      risks: [],
      lessonsLearned: [],
      gaps: ["缺少供应商确认"],
      unresolvedQuestions: ["预算由谁审批"],
      sourceIndex: [{ sourceId: 4, label: "复盘记录" }],
    });
    expect(markdown).toContain("[S4]");
    expect(markdown).toContain("缺少供应商确认");
    expect(markdown).toContain("预算由谁审批");
  });
});

describe("LCJ Brain project SOP infrastructure contracts", () => {
  it("creates all six tables under a singleton MySQL lock", async () => {
    const source = await readFile(
      new URL("./lcjBrainProjectUpgrade.ts", import.meta.url),
      "utf8"
    );
    for (const table of [
      "lcj_brain_projects",
      "lcj_brain_project_sources",
      "lcj_brain_project_daily_summaries",
      "lcj_brain_project_sop_versions",
      "lcj_brain_project_runs",
      "lcj_brain_project_audit_logs",
    ]) {
      expect(source).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(source).toContain("GET_LOCK");
    expect(source).toContain("RELEASE_LOCK");
    expect(source).toContain("upgradePromise");
  });

  it("keeps source snapshots idempotent, protects private issues and versions SOPs immutably", async () => {
    const source = await readFile(
      new URL("./lcjBrainProjectRouter.ts", import.meta.url),
      "utf8"
    );
    const upgrade = await readFile(
      new URL("./lcjBrainProjectUpgrade.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("WHERE projectId = ? AND sourceKey = ?");
    expect(upgrade).toContain("uq_lcj_brain_project_source");
    expect(source).toContain("isPrivate = 0");
    expect(source).toContain("无权导入该私密问题");
    expect(source).toContain("MAX(version)");
    expect(source).toContain("SOP_UNKNOWN_SOURCE_REFERENCE");
    expect(source).toContain("expectedVersion");
    expect(source).not.toContain("DELETE FROM lcj_brain_project_sources");
  });
});
