import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lcjBrainProjectUpdateInput } from "./lcjBrainProjectRouter";
import {
  applyReusableSopTemplateContent,
  buildReusableProjectMilestones,
  buildReusableSopTemplateContent,
  canTransitionProjectStatus,
} from "../shared/lcjBrainProjectSop";

describe("LCJ Brain project archive", () => {
  it("parses a status-only archive update without create defaults", () => {
    const parsed = lcjBrainProjectUpdateInput.parse({
      projectId: 1,
      expectedVersion: 8,
      status: "archived",
    });

    expect(parsed).toEqual({
      projectId: 1,
      expectedVersion: 8,
      status: "archived",
    });
    expect(parsed).not.toHaveProperty("projectType");
    expect(parsed).not.toHaveProperty("memberUserIds");
    expect(parsed).not.toHaveProperty("memberStaffIds");
    expect(parsed).not.toHaveProperty("keywords");
    expect(parsed).not.toHaveProperty("milestones");
    expect(parsed).not.toHaveProperty("autoCollectEnabled");
    expect(parsed).not.toHaveProperty("autoCollectMode");
  });

  it("allows draft, active and completed projects to be archived", () => {
    expect(canTransitionProjectStatus("draft", "archived")).toBe(true);
    expect(canTransitionProjectStatus("active", "archived")).toBe(true);
    expect(canTransitionProjectStatus("completed", "archived")).toBe(true);
  });

  it("validates auto-collection requirements only while a project is active", () => {
    const router = readFileSync(
      new URL("./lcjBrainProjectRouter.ts", import.meta.url),
      "utf8"
    );
    expect(router).toContain(".input(lcjBrainProjectUpdateInput)");
    expect(router).toContain('nextStatus === "active"');
  });

  it("returns to the project list after archive succeeds", () => {
    const ui = readFileSync(
      new URL("../client/src/components/LcjBrainProjects.tsx", import.meta.url),
      "utf8"
    );
    expect(ui).toContain('result.project.status === "archived"');
    expect(ui).toContain("await utils.lcjBrainProject.list.invalidate()");
    expect(ui).toContain('update.isPending ? "归档中…" : "归档"');
    expect(ui).toContain('role="alert"');
  });

  it("removes old evidence and open gaps from reusable SOP templates", () => {
    const reusable = buildReusableSopTemplateContent({
      title: "旧项目SOP",
      objective: { text: "目标", sourceRefs: [1, 2] },
      phases: [
        {
          name: "执行",
          sourceRefs: [2],
          steps: [{ action: "确认", owner: "旧负责人", sourceRefs: [3] }],
        },
      ],
      gaps: ["旧项目缺口"],
      unresolvedQuestions: ["旧项目未解决问题"],
      sourceIndex: [{ sourceId: 1, label: "旧证据" }],
      _generation: { includedSourceIds: [1, 2, 3] },
    });

    expect(reusable.objective).toEqual({ text: "目标", sourceRefs: [] });
    expect((reusable.phases as any[])[0].sourceRefs).toEqual([]);
    expect((reusable.phases as any[])[0].steps[0].sourceRefs).toEqual([]);
    expect((reusable.phases as any[])[0].steps[0].owner).toBeNull();
    expect(reusable.gaps).toEqual([]);
    expect(reusable.unresolvedQuestions).toEqual([]);
    expect(reusable.sourceIndex).toEqual([]);
    expect(reusable).not.toHaveProperty("_generation");

    const applied = applyReusableSopTemplateContent(reusable, "新项目");
    expect(applied.title).toBe("新项目 SOP");
    expect(applied.objective).toEqual({ text: "目标", sourceRefs: [] });

    expect(
      buildReusableProjectMilestones([
        {
          id: "old-1",
          title: "会场确认",
          dueDate: "2026-09-01",
          completedAt: "2026-09-02",
          status: "completed",
        },
      ])
    ).toEqual([{ id: "template-1", title: "会场确认", status: "pending" }]);
  });

  it("creates an immutable SOP template snapshot before changing archive status", () => {
    const router = readFileSync(
      new URL("./lcjBrainProjectRouter.ts", import.meta.url),
      "utf8"
    );
    const upgrade = readFileSync(
      new URL("./lcjBrainProjectUpgrade.ts", import.meta.url),
      "utf8"
    );
    expect(upgrade).toContain("lcj_brain_project_sop_templates");
    expect(upgrade).toContain("backfillArchivedSopTemplates");
    expect(upgrade).toContain("sop_template_backfill_skipped_no_sop");
    expect(router).toContain("archiveProjectWithSopTemplate");
    expect(router).toContain("归档前请先生成SOP");
    expect(router).toContain("请先更新SOP再归档");
    expect(router).toContain('action: "sop_template_created"');
    expect(
      router.indexOf("INSERT INTO lcj_brain_project_sop_templates")
    ).toBeLessThan(router.indexOf("SET status='archived'"));
  });

  it("shows archived projects and lets a new project use a sanitized template", () => {
    const router = readFileSync(
      new URL("./lcjBrainProjectRouter.ts", import.meta.url),
      "utf8"
    );
    const ui = readFileSync(
      new URL("../client/src/components/LcjBrainProjects.tsx", import.meta.url),
      "utf8"
    );
    expect(ui).toContain("includeArchived: true");
    expect(ui).toContain("已归档项目 ·");
    expect(ui).toContain("只读归档 · 可查看SOP");
    expect(ui).toContain("已生成流程模板：");
    expect(ui).toContain("此历史归档没有SOP，因此不会生成空白模板");
    expect(ui).toContain("lcjBrainProject.templates.useQuery");
    expect(ui).toContain("SOP流程模板（可选）");
    expect(ui).toContain(
      "不会复制原成员、日期、资料、日报、证据编号或历史记录"
    );
    expect(router).toContain("project_created_from_template");
    expect(router).toContain("archiveTemplate: archiveTemplateRows[0]");
    expect(router).toContain("applyReusableSopTemplateContent");
    expect(
      router.match(
        /SELECT status FROM lcj_brain_projects WHERE id=\? LIMIT 1 FOR UPDATE/g
      )?.length || 0
    ).toBeGreaterThanOrEqual(4);
    expect(router).toContain("sourceIds,model,promptVersion");
    expect(router).toContain("JSON.stringify([])");
    expect(
      router.match(/assertProjectWritable\(/g)?.length || 0
    ).toBeGreaterThanOrEqual(5);
  });
});
