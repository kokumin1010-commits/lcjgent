import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const pageSource = fs.readFileSync(path.join(root, "client/src/pages/StaffSchedule.tsx"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const dbSource = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");

describe("staff schedule candidate contract", () => {
  it("uses a schedule-specific active staff query", () => {
    expect(pageSource).toContain("trpc.staff.listScheduleCandidates.useQuery");
    expect(pageSource).not.toContain("trpc.staff.listActive.useQuery(undefined, { enabled: !!user })");
  });

  it("keeps the general active staff route but projects a limited directory DTO", () => {
    expect(routerSource).toContain("listActive: protectedProcedure.query");
    expect(routerSource).toContain("const rows = await getActiveStaff()");
    expect(routerSource).toContain("email: person.email.toLowerCase()");
  });

  it("filters only the schedule candidate response without mutating HR data", () => {
    expect(routerSource).toContain("listScheduleCandidates: protectedProcedure.query");
    expect(routerSource).toContain("const rows = await getScheduleStaffCandidates()");
    expect(routerSource).toContain("avatarUrl: person.avatarUrl");
    expect(dbSource).toContain("return filterStaffScheduleCandidates(active)");
  });

  it("continues to load saved schedules independently from the candidate roster", () => {
    expect(pageSource).toContain("trpc.staffSchedule.getByDateRange.useQuery");
    expect(pageSource).toContain("return applyFilters([...saved, ...resting])");
  });
});
