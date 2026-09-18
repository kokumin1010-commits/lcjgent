import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lcjBrainProjectUpdateInput } from "./lcjBrainProjectRouter";
import { canTransitionProjectStatus } from "../shared/lcjBrainProjectSop";

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
});
