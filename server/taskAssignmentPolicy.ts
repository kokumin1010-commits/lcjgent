import { TRPCError } from "@trpc/server";
import type { Staff } from "../drizzle/schema";
import type { TaskExecutionAccess } from "./taskExecutionService";

export type TaskAssigneeDirectoryEntry = {
  id: number;
  name: string;
  department: string | null;
};

export function toTaskAssigneeDirectoryEntry(staff: Staff): TaskAssigneeDirectoryEntry {
  return { id: staff.id, name: staff.name, department: staff.department };
}

export function filterAssignableStaff(
  activeStaff: Staff[],
  access: TaskExecutionAccess
): Staff[] {
  if (access.isSuperAdmin) return activeStaff;
  const allowed = new Set([
    ...(access.staffId ? [access.staffId] : []),
    ...access.reviewableStaffIds,
  ]);
  return activeStaff.filter(person => allowed.has(person.id));
}

export function validateTaskAssignees(requestedIds: number[], assignableStaff: Staff[]) {
  const uniqueIds = [...new Set(requestedIds)];
  const byId = new Map(assignableStaff.map(person => [person.id, person]));
  if (uniqueIds.some(id => !byId.has(id))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "指派对象不存在、已离职、已合并，或不在您的管理范围内",
    });
  }
  return { uniqueIds, byId };
}

export function assertTaskSuperAdmin(access: TaskExecutionAccess) {
  if (!access.isSuperAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅超级管理员可以执行此操作" });
  }
}
