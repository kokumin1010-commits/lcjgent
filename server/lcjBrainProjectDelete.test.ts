import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  lcjBrainProjectDeleteInput,
  lcjBrainProjectRestoreInput,
} from "./lcjBrainProjectRouter";

const router = readFileSync(new URL("./lcjBrainProjectRouter.ts", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("./lcjBrainProjectUpgrade.ts", import.meta.url), "utf8");
const scheduler = readFileSync(new URL("./lcjBrainProjectScheduler.ts", import.meta.url), "utf8");
const ui = readFileSync(
  new URL("../client/src/components/LcjBrainProjects.tsx", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../drizzle/0149_lcj_brain_project_soft_delete.sql", import.meta.url),
  "utf8"
);
const migrationRunner = readFileSync(new URL("../run-migrations.mjs", import.meta.url), "utf8");

describe("LCJ Brain project soft delete", () => {
  it("requires project name and optimistic version for delete and restore", () => {
    expect(
      lcjBrainProjectDeleteInput.parse({
        projectId: 12,
        expectedVersion: 3,
        confirmationName: "12月例展会",
      })
    ).toEqual({ projectId: 12, expectedVersion: 3, confirmationName: "12月例展会" });
    expect(
      lcjBrainProjectRestoreInput.parse({
        projectId: 12,
        expectedVersion: 4,
        confirmationName: "12月例展会",
      })
    ).toEqual({ projectId: 12, expectedVersion: 4, confirmationName: "12月例展会" });
    expect(() =>
      lcjBrainProjectDeleteInput.parse({ projectId: 12, expectedVersion: 3, confirmationName: "" })
    ).toThrow();
  });

  it("uses soft-delete columns and never physically deletes the project record", () => {
    for (const source of [upgrade, schema, migration, migrationRunner]) {
      expect(source).toContain("deletedAt");
      expect(source).toContain("deletedBy");
      expect(source).toContain("deletedByName");
    }
    expect(router).toContain("SET deletedAt=?,deletedBy=?,deletedByName=?,autoCollectEnabled=0,version=version+1");
    expect(router).not.toContain("DELETE FROM lcj_brain_projects");
    expect(router).toContain('action: "project_soft_deleted"');
    expect(router).toContain('action: "project_restored"');
  });

  it("hides deleted projects from normal reads and background collection", () => {
    expect(router).toContain("WHERE p.deletedAt IS NULL");
    expect(router).toContain("WHERE id = ? AND deletedAt IS NULL LIMIT 1");
    expect(scheduler).toContain("autoCollectEnabled=1 AND deletedAt IS NULL");
    expect(upgrade).toContain("status='archived' AND deletedAt IS NULL");
  });

  it("cancels unfinished linked tasks, stops runs, and retires derived templates", () => {
    expect(router).toContain("SET status='cancelled'");
    expect(router).toContain("INNER JOIN lcj_brain_project_execution_task_links");
    expect(router).toContain("SET status='superseded'");
    expect(router).toContain("errorCode='PROJECT_DELETED'");
    expect(router).toContain("SET status='retired' WHERE sourceProjectId=?");
    expect(router).toContain("'task',?,'lcj_brain_project_cancel'");
    expect(router).toContain("FOR UPDATE");
  });

  it("shows permission-gated delete, typed confirmation, and admin recovery UI", () => {
    expect(ui).toContain("p.access.canDelete");
    expect(ui).toContain("请完整输入项目名称以确认");
    expect(ui).toContain("trpc.lcjBrainProject.delete.useMutation");
    expect(ui).toContain("trpc.lcjBrainProject.restore.useMutation");
    expect(ui).toContain("已删除项目 ·");
    expect(ui).toContain("仅超级管理员可见和恢复");
    expect(ui).toContain("confirmationName.trim() !==");
  });
});
