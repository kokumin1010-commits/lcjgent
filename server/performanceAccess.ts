import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { staff } from "../drizzle/schema";
import type { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";
import { ensurePerformanceTables } from "./performanceUpgrade";

export type PerformanceDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type PerformanceAccess = {
  userId: number;
  staffId: number | null;
  staffName: string | null;
  department: string | null;
  level: "employee" | "department_manager" | "super_admin";
  managedDepartment: string | null;
  isSuperAdmin: boolean;
  reviewableStaffIds: number[];
};

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

export async function resolvePerformanceAccess(
  db: PerformanceDatabase,
  user: { id: number; email: string | null },
  effectiveFrom: string,
): Promise<PerformanceAccess> {
  await ensurePerformanceTables(db, effectiveFrom);
  const management = await getUserManagementAccess(db, user.id);
  const ownRows = user.email
    ? await db.select({ id: staff.id, name: staff.name, department: staff.department })
      .from(staff)
      .where(and(
        sql`LOWER(TRIM(${staff.email})) = LOWER(TRIM(REGEXP_REPLACE(${user.email}, '^(resigned|disabled)_[0-9]+_', '')))`,
        eq(staff.isActive, "active"),
        isNull(staff.archivedAt),
        isNull(staff.mergedIntoStaffId),
      ))
      .limit(1)
    : [];
  const own = ownRows[0] || null;

  if (management.isSuperAdmin) {
    const result = await db.execute(sql`
      SELECT id
      FROM staff
      WHERE isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
      ORDER BY id
    `);
    return {
      userId: user.id,
      staffId: own?.id || null,
      staffName: own?.name || null,
      department: own?.department || null,
      level: "super_admin",
      managedDepartment: null,
      isSuperAdmin: true,
      reviewableStaffIds: rowsOf<{ id: number }>(result).map(row => Number(row.id)),
    };
  }

  if (!own) {
    return {
      userId: user.id,
      staffId: null,
      staffName: null,
      department: null,
      level: "employee",
      managedDepartment: null,
      isSuperAdmin: false,
      reviewableStaffIds: [],
    };
  }

  const reviewableIds = new Set<number>();
  if (management.level === "department_manager" && management.managedDepartment) {
    const departmentRows = await db.execute(sql`
      SELECT id
      FROM staff
      WHERE isActive = 'active'
        AND archivedAt IS NULL
        AND mergedIntoStaffId IS NULL
        AND LOWER(TRIM(department)) = LOWER(TRIM(${management.managedDepartment}))
    `);
    rowsOf<{ id: number }>(departmentRows).forEach(row => reviewableIds.add(Number(row.id)));
  }
  const assignmentRows = await db.execute(sql`
    SELECT DISTINCT staffId
    FROM performance_role_assignments
    WHERE reviewerStaffId = ${own.id}
      AND status = 'active'
      AND effectiveFrom <= CURRENT_DATE
      AND (effectiveTo IS NULL OR effectiveTo >= CURRENT_DATE)
  `);
  rowsOf<{ staffId: number }>(assignmentRows).forEach(row => reviewableIds.add(Number(row.staffId)));
  reviewableIds.delete(own.id);

  return {
    userId: user.id,
    staffId: own.id,
    staffName: own.name,
    department: own.department || null,
    level: management.level === "department_manager" ? "department_manager" : "employee",
    managedDepartment: management.managedDepartment,
    isSuperAdmin: false,
    reviewableStaffIds: [...reviewableIds],
  };
}

export function requirePerformanceStaff(access: PerformanceAccess): number {
  if (!access.staffId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "当前账号尚未关联有效HR员工主档" });
  }
  return access.staffId;
}

export function requirePerformanceAdmin(access: PerformanceAccess): void {
  if (!access.isSuperAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅超级管理员可以修改组织与积分规则" });
  }
}

export function assertCanViewPerformanceStaff(access: PerformanceAccess, targetStaffId: number): void {
  if (access.isSuperAdmin || access.staffId === targetStaffId || access.reviewableStaffIds.includes(targetStaffId)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "无权查看该员工的执行积分详情" });
}

export function assertCanReviewPerformanceStaff(access: PerformanceAccess, targetStaffId: number): void {
  if (access.staffId === targetStaffId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "不能审核自己的积分候选" });
  }
  if (access.isSuperAdmin || access.reviewableStaffIds.includes(targetStaffId)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "无权审核该员工的积分候选" });
}
