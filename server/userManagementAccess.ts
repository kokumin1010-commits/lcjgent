import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { getDb } from "./db";
import {
  isDepartmentManagerScopeValid,
  resolveEffectiveManagementLevel,
  type EffectiveUserManagementLevel,
  type UserManagementLevel,
} from "../shared/userManagementHierarchy";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type UserManagementAccess = {
  userId: number;
  level: EffectiveUserManagementLevel;
  storedLevel: UserManagementLevel;
  managedDepartment: string | null;
  staffDepartment: string | null;
  canManageAccounts: boolean;
  isSuperAdmin: boolean;
};

let hierarchySetup: Promise<void> | null = null;

export function ensureUserManagementHierarchy(db: Database): Promise<void> {
  if (!hierarchySetup) {
    hierarchySetup = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_management_scopes (
          userId INT NOT NULL PRIMARY KEY,
          managementLevel ENUM('employee', 'department_manager') NOT NULL DEFAULT 'employee',
          managedDepartment VARCHAR(255),
          assignedBy INT,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_management_level (managementLevel),
          INDEX idx_managed_department (managedDepartment)
        )
      `);
      await db.execute(sql`
        INSERT IGNORE INTO user_management_scopes (userId, managementLevel)
        SELECT id, 'employee' FROM users
      `);
    })().catch(error => {
      hierarchySetup = null;
      throw error;
    });
  }
  return hierarchySetup;
}

export async function getUserManagementAccess(
  db: Database,
  userId: number
): Promise<UserManagementAccess> {
  await ensureUserManagementHierarchy(db);

  const [rows] = (await db.execute(sql`
    SELECT
      u.id AS userId,
      COALESCE(ums.managementLevel, 'employee') AS storedLevel,
      ums.managedDepartment,
      s.department AS staffDepartment,
      EXISTS(
        SELECT 1
        FROM user_role_assignments ura
        INNER JOIN system_roles r ON r.id = ura.roleId
        WHERE ura.userId = u.id AND r.isSystem = TRUE
      ) AS hasSuperAdminRole
    FROM users u
    LEFT JOIN user_management_scopes ums ON ums.userId = u.id
    LEFT JOIN staff s
      ON LOWER(TRIM(s.email)) = LOWER(TRIM(
        REGEXP_REPLACE(u.email, '^(resigned|disabled)_[0-9]+_', '')
      ))
      AND s.archivedAt IS NULL
      AND s.mergedIntoStaffId IS NULL
    WHERE u.id = ${userId}
    ORDER BY s.id ASC
    LIMIT 1
  `)) as any;

  const row = rows?.[0];
  if (!row) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "账号不存在" });
  }

  const storedLevel: UserManagementLevel =
    row.storedLevel === "department_manager"
      ? "department_manager"
      : "employee";
  const level = resolveEffectiveManagementLevel({
    hasSuperAdminRole:
      row.hasSuperAdminRole === true || Number(row.hasSuperAdminRole) === 1,
    storedLevel,
  });
  const managedDepartment = row.managedDepartment || null;

  return {
    userId: Number(row.userId),
    level,
    storedLevel,
    managedDepartment,
    staffDepartment: row.staffDepartment || null,
    canManageAccounts:
      level === "super_admin" ||
      (level === "department_manager" &&
        isDepartmentManagerScopeValid(level, managedDepartment)),
    isSuperAdmin: level === "super_admin",
  };
}

export async function requireUserManagementAccess(
  db: Database,
  userId: number
): Promise<UserManagementAccess> {
  const access = await getUserManagementAccess(db, userId);
  if (!access.canManageAccounts) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "员工账号管理仅限超级管理员或已配置部门的部门负责人",
    });
  }
  return access;
}

export async function requireSystemSuperAdmin(
  db: Database,
  userId: number
): Promise<UserManagementAccess> {
  const access = await getUserManagementAccess(db, userId);
  if (!access.isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "此操作仅限超级管理员",
    });
  }
  return access;
}
