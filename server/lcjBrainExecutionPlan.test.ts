import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  executionPlanValidationErrors,
  executionTaskDateRange,
  LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA,
  LCJ_BRAIN_EXECUTION_PLAN_MODEL,
  normalizeExecutionPlanDraft,
} from "../shared/lcjBrainExecutionPlan";

const root = process.cwd();
const service = readFileSync(
  `${root}/server/lcjBrainExecutionPlanService.ts`,
  "utf8"
);
const router = readFileSync(`${root}/server/lcjBrainProjectRouter.ts`, "utf8");
const upgrade = readFileSync(
  `${root}/server/lcjBrainProjectUpgrade.ts`,
  "utf8"
);
const ui = readFileSync(
  `${root}/client/src/components/LcjBrainExecutionPlan.tsx`,
  "utf8"
);
const projectsUi = readFileSync(
  `${root}/client/src/components/LcjBrainProjects.tsx`,
  "utf8"
);
const mainRouter = readFileSync(`${root}/server/routers.ts`, "utf8");
const taskDetail = readFileSync(
  `${root}/client/src/pages/TaskDetail.tsx`,
  "utf8"
);

function draft() {
  return normalizeExecutionPlanDraft({
    summary: "执行方案",
    roles: [
      {
        key: "project_owner",
        title: "项目负责人",
        departmentHint: "运营",
        responsibility: "统筹并验收",
        required: true,
      },
      {
        key: "operator",
        title: "执行负责人",
        departmentHint: "运营",
        responsibility: "完成准备和提交证据",
        required: true,
      },
    ],
    tasks: [
      {
        key: "confirm_scope",
        phase: "筹备",
        title: "确认范围",
        instructions: "确认项目范围和目标。",
        ownerRoleKey: "operator",
        reviewerRoleKey: "project_owner",
        collaboratorRoleKeys: [],
        startOffsetDays: 0,
        dueOffsetDays: 2,
        dependencyTaskKeys: [],
        materials: [
          {
            name: "项目简报",
            purpose: "确认范围",
            ownerRoleKey: "operator",
            format: "PDF",
            preparationInstructions: "填写目标和范围。",
            requiredFields: ["目标", "范围"],
            acceptanceCriteria: ["字段完整"],
          },
        ],
        evidenceRequirements: ["简报链接"],
        acceptanceCriteria: ["负责人确认"],
        risks: [],
        required: true,
      },
    ],
    unresolvedQuestions: [],
  });
}

describe("LCJ Brain AI execution plan policy", () => {
  it("uses the approved low-frequency model and strict schema", () => {
    expect(LCJ_BRAIN_EXECUTION_PLAN_MODEL).toBe("gpt-5-mini");
    expect(LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA.strict).toBe(true);
    expect(
      LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA.schema.additionalProperties
    ).toBe(false);
    expect(
      LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA.schema.properties.roles.items
        .additionalProperties
    ).toBe(false);
    expect(
      LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA.schema.properties.tasks.items
        .additionalProperties
    ).toBe(false);
    expect(
      LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA.schema.properties.tasks.items
        .properties.materials.items.additionalProperties
    ).toBe(false);
  });

  it("requires administrator-confirmed staff assignments and independent review", () => {
    const plan = draft();
    expect(
      executionPlanValidationErrors(plan, {}, { requireAssignments: true })
    ).toContain("必需角色尚未分配：项目负责人");
    expect(
      executionPlanValidationErrors(
        plan,
        { project_owner: 10, operator: 10 },
        { requireAssignments: true }
      )
    ).toContain("任务“确认范围”的执行人和验收人必须不同");
    expect(
      executionPlanValidationErrors(
        plan,
        { project_owner: 10, operator: 11 },
        { requireAssignments: true }
      )
    ).toEqual([]);
  });

  it("rejects missing evidence, acceptance criteria and unknown dependencies", () => {
    const plan = draft();
    plan.tasks[0].evidenceRequirements = [];
    plan.tasks[0].acceptanceCriteria = [];
    plan.tasks[0].dependencyTaskKeys = ["missing_task"];
    expect(executionPlanValidationErrors(plan)).toEqual(
      expect.arrayContaining([
        "任务“确认范围”的前置任务不存在：missing_task",
        "任务“确认范围”缺少完成证据要求",
        "任务“确认范围”缺少验收标准",
      ])
    );
  });

  it("rejects cyclic task dependencies", () => {
    const plan = draft();
    plan.tasks.push({
      ...plan.tasks[0],
      key: "second_task",
      title: "第二任务",
      dependencyTaskKeys: ["confirm_scope"],
    });
    plan.tasks[0].dependencyTaskKeys = ["second_task"];
    expect(executionPlanValidationErrors(plan)).toContain(
      "任务前置关系存在循环依赖"
    );
  });

  it("computes task dates deterministically from the project start date", () => {
    expect(addDaysToDateKey("2026-10-05", 7)).toBe("2026-10-12");
    expect(
      executionTaskDateRange("2026-10-05", {
        startOffsetDays: 1,
        dueOffsetDays: 4,
      })
    ).toEqual({ startDate: "2026-10-06", dueDate: "2026-10-09" });
  });

  it("persists AI draft versions and publishes only after validation", () => {
    expect(upgrade).toContain("lcj_brain_project_execution_plans");
    expect(upgrade).toContain("lcj_brain_project_execution_runs");
    expect(upgrade).toContain("lcj_brain_project_execution_task_states");
    expect(upgrade).toContain("lcj_brain_project_execution_task_links");
    expect(service).toContain("execution_plan_ai_draft_generated");
    expect(service).toContain(
      "executionPlanValidationErrors(draft, assignments, {"
    );
    expect(service).toContain("仍有未解决问题，请编辑草案并清空后再发布");
    expect(service).toContain("管理员确认AI草案后发布；未发送外部通知");
  });

  it("never lets AI assign real staff or publish work automatically", () => {
    expect(service).toContain(
      "角色只使用稳定英文key，不写任何实际员工姓名或staffId"
    );
    expect(service).toContain(
      "AI只能提出草案，不能指定实际人员、不能发布任务、不能发送通知"
    );
    expect(service).not.toContain("sendReminderEmail(");
    expect(service).not.toContain("notifyOwner(");
    expect(router).toContain("generateExecutionPlan: protectedProcedure");
    expect(router).toContain("saveExecutionPlan: protectedProcedure");
    expect(router).toContain("publishExecutionPlan: protectedProcedure");
    expect(router).toContain('"manage"');
    expect(router).toContain("publishExecutionPlan({");
  });

  it("bridges published work to the task list without bypassing evidence review", () => {
    expect(service).toContain("INSERT INTO tasks");
    expect(service).toContain("VALUES (?,'pending'");
    expect(service).toContain("completionToken,notes,startDate,createdBy");
    expect(service).toContain("lcj_brain_project_execution_task_links");
    expect(mainRouter).toContain(
      'assertLcjBrainLinkedTaskMutationAllowed(input.id, "update")'
    );
    expect(mainRouter).toContain(
      'assertLcjBrainLinkedTaskMutationAllowed(input.id, "delete")'
    );
    expect(mainRouter).toContain(
      'assertLcjBrainLinkedTaskMutationAllowed(input.taskId, "notify")'
    );
    expect(mainRouter).toContain(
      'assertLcjBrainLinkedTaskMutationAllowed(taskData.task.id, "update")'
    );
    expect(taskDetail).toContain("Brain执行计划任务");
    expect(taskDetail).toContain("进入LCJ Brain执行计划");
  });

  it("provides the manager draft editor and employee evidence workflow", () => {
    expect(projectsUi).toContain('["execution", "执行计划", true]');
    expect(projectsUi).toContain(
      'setProjectInitialTab(r.templateId ? "execution"'
    );
    expect(ui).toContain("AI生成执行草案（gpt-5-mini）");
    expect(ui).toContain("管理员确认并发布");
    expect(ui).toContain("应该如何准备");
    expect(ui).toContain("提交给验收人");
    expect(ui).toContain("验收通过");
    expect(ui).toContain("退回修改");
    expect(router).toContain("assertProjectWritable(project)");
    expect(service).toContain("该事项正在等待验收，不能覆盖已提交证据");
    expect(ui).toContain(
      'state?.status === "todo" || state?.status === "rejected"'
    );
    expect(service).toContain("reviewerStaffId && !reviewerMatched");
    expect(router).toContain("executionEvidenceLinkInput");
    expect(router).toContain("证据链接仅支持HTTP或HTTPS");
    expect(ui).toContain("safeEvidenceHref");
  });
});
