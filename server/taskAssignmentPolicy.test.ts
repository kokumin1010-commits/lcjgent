import { describe, expect, it } from "vitest";
import type { Staff } from "../drizzle/schema";
import type { TaskExecutionAccess } from "./taskExecutionService";
import {
  assertTaskSuperAdmin,
  filterAssignableStaff,
  toTaskAssigneeDirectoryEntry,
  validateTaskAssignees,
} from "./taskAssignmentPolicy";

const people = [
  { id: 1, name: "Self", department: "Sales", email: "self@example.test", phone: "secret" },
  { id: 2, name: "Team", department: "Sales", email: "team@example.test", phone: "secret" },
  { id: 3, name: "Other", department: "Finance", email: "other@example.test", phone: "secret" },
] as Staff[];

const access: TaskExecutionAccess = {
  userId: 10,
  staffId: 1,
  staffName: "Self",
  department: "Sales",
  level: "department_manager",
  managedDepartment: "Sales",
  isSuperAdmin: false,
  reviewableStaffIds: [2],
};

describe("task assignment policy", () => {
  it("limits department managers to self and reviewable staff", () => {
    expect(filterAssignableStaff(people, access).map(person => person.id)).toEqual([1, 2]);
    expect(() => validateTaskAssignees([2, 3], filterAssignableStaff(people, access))).toThrow(/不在您的管理范围/);
  });

  it("accepts the whole request only when every assignee is allowed and de-duplicates ids", () => {
    const result = validateTaskAssignees([2, 1, 2], filterAssignableStaff(people, access));
    expect(result.uniqueIds).toEqual([2, 1]);
  });

  it("serializes no email, phone, salary or other HR fields", () => {
    expect(toTaskAssigneeDirectoryEntry(people[0])).toEqual({
      id: 1,
      name: "Self",
      department: "Sales",
    });
    expect(toTaskAssigneeDirectoryEntry(people[0])).not.toHaveProperty("email");
  });

  it("rejects ordinary or department-manager access from global HR operations", () => {
    expect(() => assertTaskSuperAdmin(access)).toThrow(/超级管理员/);
    expect(() => assertTaskSuperAdmin({ ...access, isSuperAdmin: true })).not.toThrow();
  });
});
