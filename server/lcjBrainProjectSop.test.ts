import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  attachSopGenerationMetadata,
  buildProjectSourceKey,
  canTransitionProjectStatus,
  collectValidSourceRefs,
  hasUnknownSourceRefs,
  LCJ_BRAIN_DAILY_SUMMARY_JSON_SCHEMA,
  LCJ_BRAIN_SOP_JSON_SCHEMA,
  matchAutoCollectCandidate,
  normalizeProjectKeywords,
  pendingSopSourceIds,
  readSopGenerationMetadata,
  sopContentToMarkdown,
  stripSopGenerationMetadata,
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

  it("tracks included, new and removed sources for immutable SOP updates", () => {
    const metadata = {
      mode: "incremental" as const,
      baseVersionId: 8,
      includedSourceIds: [1, 2, 11, 12, 13, 14, 15],
      newSourceIds: [11, 12, 13, 14, 15],
      removedSourceIds: [3],
      generatedAt: "2026-09-17T04:30:00.000Z",
    };
    const content = attachSopGenerationMetadata(
      { title: "LCF展会活动", sourceIndex: [] },
      metadata
    );
    expect(readSopGenerationMetadata(content)).toEqual(metadata);
    expect(stripSopGenerationMetadata(content)).toEqual({
      title: "LCF展会活动",
      sourceIndex: [],
    });
    expect(pendingSopSourceIds([1, 2, 11, 12, 13, 14, 15], [1, 2])).toEqual([
      11, 12, 13, 14, 15,
    ]);
    expect(pendingSopSourceIds([1, 2, 2], [1, 2])).toEqual([]);
  });

  it("rejects malformed generation metadata without trusting arbitrary source ids", () => {
    expect(
      readSopGenerationMetadata({ _generation: { mode: "other" } })
    ).toBeNull();
    expect(
      readSopGenerationMetadata({
        _generation: {
          mode: "full",
          baseVersionId: -1,
          includedSourceIds: [1, "2", 0, "bad"],
          newSourceIds: [],
          removedSourceIds: [],
          generatedAt: "2026-09-17T04:30:00.000Z",
        },
      })
    ).toBeNull();
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

  it("uses the searchable member multi-select in both create and settings flows", async () => {
    const ui = await readFile(
      new URL("../client/src/components/LcjBrainProjects.tsx", import.meta.url),
      "utf8"
    );
    expect(ui).toContain("function MemberMultiSelect");
    expect(ui).toContain("输入姓名、部门或职位");
    expect(ui).toContain("可多选");
    expect(ui).toContain("已选择 ${value.length} 人");
    expect(ui).toContain("memberStaffIds: createMemberIds");
    expect(ui).toContain("memberStaffIds: settingsMemberIds");
    expect(ui).toContain("aria-label={`移除${member.name}`}");
    expect(ui).not.toContain('name="staffId"');
  });

  it("supports source-aware incremental SOP updates without overwriting old versions", async () => {
    const routerSource = await readFile(
      new URL("./lcjBrainProjectRouter.ts", import.meta.url),
      "utf8"
    );
    const uiSource = await readFile(
      new URL("../client/src/components/LcjBrainProjects.tsx", import.meta.url),
      "utf8"
    );
    expect(routerSource).toContain('mode: z.enum(["full", "incremental"])');
    expect(routerSource).toContain("SOP_NEW_SOURCE_NOT_INDEXED");
    expect(routerSource).toContain("SOP已由其他成员更新");
    expect(routerSource).toContain("action:");
    expect(routerSource).toContain('"sop_incremental_updated"');
    expect(routerSource).toContain("attachSopGenerationMetadata");
    expect(routerSource).toContain("includedSourceIds");
    expect(routerSource).toContain("removedSourceIds");
    expect(routerSource).toContain("ORDER BY version DESC LIMIT 1 FOR UPDATE");
    expect(routerSource).not.toContain(
      "UPDATE lcj_brain_project_sop_versions SET"
    );
    expect(uiSource).toContain("补充更新SOP");
    expect(uiSource).toContain("pendingSourceCount");
    expect(uiSource).toContain("旧版本不会覆盖");
    expect(uiSource).toContain("补充并生成新版本");
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
