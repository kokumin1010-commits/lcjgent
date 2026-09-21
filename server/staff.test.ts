import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("server/routers.ts", "utf8");

describe("staff router authorization", () => {
  it("protects complete HR reads and writes with the unified super-admin procedure", () => {
    const start = source.indexOf("staff: router({");
    const end = source.indexOf("task: router({", start);
    const staffRouter = source.slice(start, end);
    for (const route of [
      "create", "list", "update", "delete", "resign", "reinstate",
      "uploadAvatar", "statistics", "archiveResigned", "restoreArchived", "updateTier",
    ]) {
      expect(staffRouter).toContain(`${route}: taskSuperAdminProcedure`);
    }
  });

  it("keeps the general active directory to non-sensitive fields and self email only", () => {
    const start = source.indexOf("listActive: protectedProcedure.query");
    const end = source.indexOf("listScheduleCandidates:", start);
    const route = source.slice(start, end);
    expect(route).toContain("id: person.id");
    expect(route).toContain("department: person.department");
    expect(route).toContain('person.email.toLowerCase() === (ctx.user.email || "").toLowerCase()');
    for (const sensitive of ["phone", "salary", "birthDate", "emergencyContact", "notes"]) {
      expect(route).not.toContain(`${sensitive}: person.${sensitive}`);
    }
  });
});
