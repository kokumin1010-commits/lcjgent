import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { reportStaff, staff } from "../drizzle/schema";
import type { EffectiveUserManagementLevel } from "../shared/userManagementHierarchy";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type ReportVisibilityScope = {
  userId: number;
  level: EffectiveUserManagementLevel;
  managedDepartment: string | null;
  ownStaffId: number | null;
  ownReportStaffIds: number[];
  visibleReportStaffIds: number[] | null;
  canViewAllReports: boolean;
  scopeLabel: "self" | "department" | "all";
};

type ReportIdentity = {
  reportStaffId: number;
  createdBy: number;
};

function uniqueIds(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(values.filter((value): value is number => Number.isInteger(value)))
  );
}

export async function resolveReportVisibilityScope(user: {
  id: number;
  email: string | null;
}): Promise<ReportVisibilityScope> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "数据库不可用",
    });
  }
  return getReportVisibilityScope(db, user);
}

export async function getReportVisibilityScope(
  db: Database,
  user: { id: number; email: string | null }
): Promise<ReportVisibilityScope> {
  const management = await getUserManagementAccess(db, user.id);
  if (management.isSuperAdmin) {
    return {
      userId: user.id,
      level: "super_admin",
      managedDepartment: null,
      ownStaffId: null,
      ownReportStaffIds: [],
      visibleReportStaffIds: null,
      canViewAllReports: true,
      scopeLabel: "all",
    };
  }

  const ownStaffRows = user.email
    ? await db
        .select({ id: staff.id })
        .from(staff)
        .where(
          and(
            sql`LOWER(${staff.email}) = LOWER(${user.email})`,
            eq(staff.isActive, "active"),
            isNull(staff.archivedAt),
            isNull(staff.mergedIntoStaffId)
          )
        )
        .limit(1)
    : [];
  const ownStaffId = ownStaffRows[0]?.id || null;
  const ownReportStaffRows = ownStaffId
    ? await db
        .select({ id: reportStaff.id })
        .from(reportStaff)
        .where(eq(reportStaff.linkedStaffId, ownStaffId))
    : [];
  const ownReportStaffIds = uniqueIds(
    ownReportStaffRows.map(record => record.id)
  );

  if (
    management.level === "department_manager" &&
    management.managedDepartment
  ) {
    const departmentReportStaffRows = await db
      .select({ id: reportStaff.id })
      .from(reportStaff)
      .innerJoin(staff, eq(reportStaff.linkedStaffId, staff.id))
      .where(
        and(
          sql`LOWER(TRIM(${staff.department})) = LOWER(TRIM(${management.managedDepartment}))`,
          isNull(staff.archivedAt),
          isNull(staff.mergedIntoStaffId),
          isNull(reportStaff.archivedAt)
        )
      );

    return {
      userId: user.id,
      level: "department_manager",
      managedDepartment: management.managedDepartment,
      ownStaffId,
      ownReportStaffIds,
      visibleReportStaffIds: uniqueIds([
        ...ownReportStaffIds,
        ...departmentReportStaffRows.map(record => record.id),
      ]),
      canViewAllReports: false,
      scopeLabel: "department",
    };
  }

  return {
    userId: user.id,
    level: "employee",
    managedDepartment: null,
    ownStaffId,
    ownReportStaffIds,
    visibleReportStaffIds: ownReportStaffIds,
    canViewAllReports: false,
    scopeLabel: "self",
  };
}

export function canReadReport(
  scope: ReportVisibilityScope,
  report: ReportIdentity
): boolean {
  if (scope.canViewAllReports) return true;
  return (
    report.createdBy === scope.userId ||
    scope.visibleReportStaffIds?.includes(report.reportStaffId) === true
  );
}

export function canWriteReport(
  scope: ReportVisibilityScope,
  report: ReportIdentity
): boolean {
  if (scope.canViewAllReports) return true;
  return (
    report.createdBy === scope.userId ||
    scope.ownReportStaffIds.includes(report.reportStaffId)
  );
}

export function canCreateForReportStaff(
  scope: ReportVisibilityScope,
  reportStaffId: number
): boolean {
  return (
    scope.canViewAllReports || scope.ownReportStaffIds.includes(reportStaffId)
  );
}

export function canReadReportStaff(
  scope: ReportVisibilityScope,
  reportStaffId: number
): boolean {
  return (
    scope.canViewAllReports ||
    scope.visibleReportStaffIds?.includes(reportStaffId) === true
  );
}

export function assertCanReadReport(
  scope: ReportVisibilityScope,
  report: ReportIdentity | null | undefined
): asserts report is ReportIdentity {
  if (!report || !canReadReport(scope, report)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "无权查看该日报",
    });
  }
}

export function assertCanWriteReport(
  scope: ReportVisibilityScope,
  report: ReportIdentity | null | undefined
): asserts report is ReportIdentity {
  if (!report || !canWriteReport(scope, report)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "只能修改自己的日报",
    });
  }
}

export function assertCanCreateForReportStaff(
  scope: ReportVisibilityScope,
  reportStaffId: number
): void {
  if (!canCreateForReportStaff(scope, reportStaffId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "只能以自己的员工身份提交日报",
    });
  }
}

export function assertCanReadReportStaff(
  scope: ReportVisibilityScope,
  reportStaffId: number
): void {
  if (!canReadReportStaff(scope, reportStaffId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "无权查看该员工的日报",
    });
  }
}

export function filterVisibleReportStaff<T extends { id: number }>(
  scope: ReportVisibilityScope,
  records: T[]
): T[] {
  if (scope.visibleReportStaffIds === null) return records;
  const visibleIds = new Set(scope.visibleReportStaffIds);
  return records.filter(record => visibleIds.has(record.id));
}

export function buildReportVisibilityFilter(scope: ReportVisibilityScope): {
  visibleReportStaffIds: number[] | null;
  createdByUserId?: number;
} {
  return {
    visibleReportStaffIds: scope.visibleReportStaffIds,
    createdByUserId: scope.canViewAllReports ? undefined : scope.userId,
  };
}

export function buildReportWriteFilter(scope: ReportVisibilityScope): {
  visibleReportStaffIds: number[] | null;
  createdByUserId?: number;
} {
  return {
    visibleReportStaffIds: scope.canViewAllReports
      ? null
      : scope.ownReportStaffIds,
    createdByUserId: scope.canViewAllReports ? undefined : scope.userId,
  };
}
