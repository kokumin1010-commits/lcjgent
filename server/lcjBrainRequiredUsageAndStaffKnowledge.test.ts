import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  boundedStaffKnowledgeText,
  canReadStaffWorkKnowledge,
  shouldQueryScopedStaffReports,
} from "./lcjBrainTools";
import {
  LCF_REQUIRED_ROLE_QUESTIONS,
  isValidLcfRequiredQuestion,
} from "../shared/lcfRequiredUsage";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("LCJ Brain required usage and staff work knowledge", () => {
  it("enforces self, managed-department and super-admin staff visibility", () => {
    const base = {
      isSuperAdmin: false,
      managementLevel: "employee",
      managedDepartment: null,
      actorEmail: "member@example.com",
      targetDepartment: "运营部",
      targetEmail: "member@example.com",
    };
    expect(canReadStaffWorkKnowledge(base)).toBe(true);
    expect(
      canReadStaffWorkKnowledge({
        ...base,
        targetEmail: "other@example.com",
      })
    ).toBe(false);
    expect(
      canReadStaffWorkKnowledge({
        ...base,
        managementLevel: "department_manager",
        managedDepartment: "運営部",
        targetDepartment: "運営部",
        targetEmail: "other@example.com",
      })
    ).toBe(true);
    expect(
      canReadStaffWorkKnowledge({
        ...base,
        managementLevel: "department_manager",
        managedDepartment: "営業部",
        targetDepartment: "運営部",
        targetEmail: "other@example.com",
      })
    ).toBe(false);
    expect(
      canReadStaffWorkKnowledge({
        ...base,
        isSuperAdmin: true,
        targetEmail: "other@example.com",
      })
    ).toBe(true);
  });

  it("redacts contact and password-like content before sending staff text to AI", () => {
    const sanitized = boundedStaffKnowledgeText(
      "联系 me@example.com，电话 090-1234-5678，密码: secret123\n工资是500000\n生日为1990-01-02\n紧急联系人为田中09012345678\n住址: 东京某处\n文件在 https://example.com/signed?token=abc 和 private/hr/secret.pdf\n正常工作内容保留"
    );
    expect(sanitized).not.toContain("me@example.com");
    expect(sanitized).not.toContain("090-1234-5678");
    expect(sanitized).not.toContain("secret123");
    expect(sanitized).not.toContain("500000");
    expect(sanitized).not.toContain("1990-01-02");
    expect(sanitized).not.toContain("09012345678");
    expect(sanitized).not.toContain("东京某处");
    expect(sanitized).not.toContain("example.com");
    expect(sanitized).not.toContain("private/hr/secret.pdf");
    expect(sanitized).toContain("正常工作内容保留");
  });

  it("never falls back to all reports when an authorized staff has no linked report profile", () => {
    expect(shouldQueryScopedStaffReports(101, [])).toBe(false);
    expect(shouldQueryScopedStaffReports(101, [22])).toBe(true);
    expect(shouldQueryScopedStaffReports(undefined, [])).toBe(false);
  });

  it("provides a mandatory per-account LCF question flow", () => {
    const brain = source("./lcjBrain.ts");
    const chat = source("../client/src/pages/LcjBrain.tsx");
    const sidebar = source(
      "../client/src/components/DepartmentSidebarMenu.tsx"
    );
    const index = source("./_core/index.ts");
    const migration = source("../drizzle/0146_lcj_brain_required_usage.sql");
    const journal = source("../drizzle/meta/_journal.json");

    expect(brain).toContain("getLcfRequiredUsageStatus");
    expect(brain).toContain("FROM lcj_brain_required_usage");
    expect(brain).toContain("isValidLcfRequiredQuestion");
    expect(brain).toContain("requiredUsageCompleted = true");
    expect(brain).not.toContain('eq(lcjBrainChatLogs.context, "lcf_owner")');
    expect(chat).toContain("LCF_REQUIRED_ROLE_QUESTIONS");
    expect(chat).toContain("每个账号至少完成1次LCF负责人问答");
    expect(chat).toContain("item.id");
    expect(chat).toContain("result.requiredUsageCompleted === true");
    expect(sidebar).toContain("required-lcj-brain-question");
    expect(sidebar).toContain("必做：向LCJ Brain提问");
    expect(sidebar).toContain("DEFAULT_LCF_REQUIRED_QUESTION.id");
    expect(migration).toContain("lcj_brain_required_usage");
    expect(journal).toContain("0146_lcj_brain_required_usage");
    expect(index).toContain("/api/health/lcf-owner-qa");
    expect(index).toContain("/api/health/staff-work-knowledge");
  });

  it("rejects arbitrary client-declared completion and accepts only a role template", () => {
    expect(isValidLcfRequiredQuestion("project_lead", "随便问一句")).toBe(
      false
    );
    for (const question of LCF_REQUIRED_ROLE_QUESTIONS) {
      expect(isValidLcfRequiredQuestion(question.id, question.question)).toBe(
        true
      );
    }
    expect(isValidLcfRequiredQuestion("unknown", "LCF负责人截止交付验收")).toBe(
      false
    );
  });

  it("forces employee-name questions through permission-filtered HR and report evidence", () => {
    const tools = source("./lcjBrainTools.ts");
    const brain = source("./lcjBrain.ts");

    expect(tools).toContain('name: "search_staff_work_knowledge"');
    expect(tools).toContain("getUserManagementAccess");
    expect(tools).toContain("canReadAllStaff");
    expect(tools).toContain("STAFF_NOT_FOUND_OR_FORBIDDEN");
    expect(tools).toContain('eq(hrRoleDocuments.status, "active")');
    expect(tools).toContain('["submitted", "approved"]');
    expect(tools).toContain("attachmentSummary");
    expect(tools).not.toContain("filename: reportAttachments.filename");
    expect(tools).toContain("eq(reportStaff.linkedStaffId, target.id)");
    expect(tools).not.toContain(
      "inArray(reportStaff.name, reportProfileNames)"
    );
    expect(tools).toContain("普通员工只能查询本人");
    expect(tools).toContain(
      "工资、电话、生日、住址、LINE、紧急联系人、邮箱、离职原因和文件存储地址不进入AI上下文"
    );
    expect(brain).toContain("getStaffWorkKnowledgeEvidenceForQuestion");
    expect(brain).toContain("LCJ服务器已强制加载的员工工作证据");
    expect(brain).toContain("工具拒绝访问时不得换用其他工具绕过权限");
    expect(tools).toContain("getStaffWorkKnowledgeReadiness");
    expect(tools).toContain('accessPolicy: "self_department_superadmin"');
  });

  it("passes authenticated actors into every interactive Brain tool execution", () => {
    const brain = source("./lcjBrain.ts");
    const ceo = source("./ceoCommandCenterRouter.ts");
    expect(brain).toContain("executeToolCall(tc, { actor: ctx.user })");
    expect(brain).toContain("{ actor: ctx.user }");
    expect(ceo).toContain("executeToolCall(toolCall, { actor: ctx.user })");
  });

  it("keeps chat history owner-scoped and disables unscoped global insights", () => {
    const brain = source("./lcjBrain.ts");
    const chat = source("../client/src/pages/LcjBrain.tsx");

    expect(brain).not.toContain('input.password !== "lcj"');
    expect(brain).toContain("Super administrator access required");
    expect(brain).toContain("getUserManagementAccess(db, ctx.user.id)");
    expect(brain).toContain("eq(lcjBrainChatLogs.userId, ctx.user.id)");
    expect(brain).not.toContain("INSERT INTO lcj_brain_insights");
    expect(brain).not.toContain("extractAndSaveInsight(");
    expect(brain).toContain(
      "Legacy global insights are intentionally disabled"
    );
    expect(chat).not.toContain("管理者密码を入力してください");
    expect(chat).toContain("仅超级管理员可查看全员聊天记录");
  });
});
