import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { getDb } from "./db";
import {
  ensureUserManagementHierarchy,
  requireSystemSuperAdmin,
  requireUserManagementAccess,
} from "./userManagementAccess";
import {
  canViewManagedAccount,
  normalizeManagedAccountEmail,
  resolveEffectiveManagementLevel,
  type EffectiveUserManagementLevel,
} from "../shared/userManagementHierarchy";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Executor = Pick<Database, "execute">;

export type HierarchyAccount = {
  userId: number;
  name: string | null;
  email: string;
  department: string | null;
  position: string | null;
  status: "active" | "disabled";
  managementLevel: EffectiveUserManagementLevel;
  managedDepartment: string | null;
  roleId: number | null;
  roleName: string | null;
  roleColor: string | null;
};

export type HierarchyAssignmentInput = {
  userId: number;
  managementLevel: EffectiveUserManagementLevel;
  roleId: number | null;
  requestId: string;
};

export type HierarchyAuditInput = {
  requestId: string;
  actorUserId: number;
  targetType: "account" | "role" | "permission";
  targetId: string;
  action: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
};

let auditSetup: Promise<void> | null = null;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

export function ensureUserManagementAudit(db: Database): Promise<void> {
  if (!auditSetup) {
    auditSetup = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS user_management_audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          requestId VARCHAR(128) NOT NULL,
          actorUserId INT NOT NULL,
          targetType ENUM('account','role','permission') NOT NULL,
          targetId VARCHAR(128) NOT NULL,
          action VARCHAR(100) NOT NULL,
          beforeState JSON,
          afterState JSON,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_management_audit_request (requestId),
          KEY idx_user_management_audit_actor (actorUserId, createdAt),
          KEY idx_user_management_audit_target (targetType, targetId, createdAt)
        )
      `)
      .then(() => undefined)
      .catch(error => {
        auditSetup = null;
        throw error;
      });
  }
  return auditSetup;
}

export async function appendUserManagementAudit(
  db: Executor,
  input: HierarchyAuditInput
): Promise<void> {
  await db.execute(sql`
    INSERT INTO user_management_audit_logs (
      requestId, actorUserId, targetType, targetId, action, beforeState, afterState
    ) VALUES (
      ${input.requestId},
      ${input.actorUserId},
      ${input.targetType},
      ${input.targetId},
      ${input.action},
      ${JSON.stringify(input.beforeState)},
      ${JSON.stringify(input.afterState)}
    )
  `);
}

async function loadAccounts(db: Database): Promise<HierarchyAccount[]> {
  await ensureUserManagementHierarchy(db);
  const result = await db.execute(sql`
    SELECT
      u.id AS userId,
      u.name AS accountName,
      u.email AS accountEmail,
      s.name AS staffName,
      s.department,
      s.position,
      COALESCE(ums.managementLevel, 'employee') AS storedLevel,
      ums.managedDepartment,
      EXISTS(
        SELECT 1
        FROM user_role_assignments super_ura
        INNER JOIN system_roles super_role ON super_role.id = super_ura.roleId
        WHERE super_ura.userId = u.id AND super_role.isSystem = TRUE
      ) AS hasSuperAdminRole,
      ura.roleId,
      role.name AS roleName,
      role.color AS roleColor
    FROM users u
    INNER JOIN staff s
      ON LOWER(TRIM(s.email)) = LOWER(TRIM(
        REGEXP_REPLACE(u.email, '^(resigned|disabled)_[0-9]+_', '')
      ))
      AND s.archivedAt IS NULL
      AND s.mergedIntoStaffId IS NULL
    LEFT JOIN user_management_scopes ums ON ums.userId = u.id
    LEFT JOIN user_role_assignments ura ON ura.userId = u.id
    LEFT JOIN system_roles role ON role.id = ura.roleId
    ORDER BY s.department ASC, s.name ASC, u.id ASC
  `);

  return rowsOf<any>(result).map(row => {
    const email = String(row.accountEmail || "");
    return {
      userId: Number(row.userId),
      name: row.staffName || row.accountName || null,
      email: normalizeManagedAccountEmail(email),
      department: row.department || null,
      position: row.position || null,
      status:
        email.startsWith("disabled_") || email.startsWith("resigned_")
          ? "disabled"
          : "active",
      managementLevel: resolveEffectiveManagementLevel({
        hasSuperAdminRole: Boolean(Number(row.hasSuperAdminRole || 0)),
        storedLevel: row.storedLevel,
      }),
      managedDepartment: row.managedDepartment || null,
      roleId: row.roleId ? Number(row.roleId) : null,
      roleName: row.roleName || null,
      roleColor: row.roleColor || null,
    };
  });
}

export async function getSystemUserHierarchy(db: Database, actorUserId: number) {
  const access = await requireUserManagementAccess(db, actorUserId);
  const accounts = (await loadAccounts(db)).filter(account =>
    canViewManagedAccount({
      actorLevel: access.level,
      actorDepartment: access.managedDepartment,
      targetLevel: account.managementLevel,
      targetDepartment: account.department,
    })
  );

  const rolesResult = await db.execute(sql`
    SELECT
      role.id,
      role.name,
      role.description,
      role.color,
      role.isSystem,
      COUNT(DISTINCT ura.userId) AS userCount,
      COUNT(DISTINCT CASE WHEN permission.canView = TRUE THEN permission.pageKey END) AS viewPermissionCount,
      COUNT(DISTINCT CASE WHEN permission.canEdit = TRUE THEN permission.pageKey END) AS editPermissionCount
    FROM system_roles role
    LEFT JOIN user_role_assignments ura ON ura.roleId = role.id
    LEFT JOIN role_permissions permission ON permission.roleId = role.id
    GROUP BY role.id, role.name, role.description, role.color, role.isSystem
    ORDER BY role.isSystem DESC, role.id ASC
  `);
  const roles = rowsOf<any>(rolesResult).map(role => ({
    id: Number(role.id),
    name: String(role.name),
    description: role.description || null,
    color: role.color || "#64748b",
    isSystem: Boolean(role.isSystem),
    userCount: Number(role.userCount || 0),
    viewPermissionCount: Number(role.viewPermissionCount || 0),
    editPermissionCount: Number(role.editPermissionCount || 0),
  }));

  const superAdmins = accounts.filter(
    account => account.managementLevel === "super_admin"
  );
  const departmentMap = new Map<string, HierarchyAccount[]>();
  for (const account of accounts) {
    if (account.managementLevel === "super_admin") continue;
    const department = account.department?.trim() || "未设置部门";
    const existing = departmentMap.get(department) || [];
    existing.push(account);
    departmentMap.set(department, existing);
  }

  const departments = Array.from(departmentMap.entries())
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
    .map(([name, departmentAccounts]) => {
      const managers = departmentAccounts.filter(
        account =>
          account.managementLevel === "department_manager" &&
          account.managedDepartment === name
      );
      const roleMap = new Map<string, { roleId: number | null; roleName: string; roleColor: string; accounts: HierarchyAccount[] }>();
      for (const account of departmentAccounts) {
        const key = account.roleId ? String(account.roleId) : "unassigned";
        const node = roleMap.get(key) || {
          roleId: account.roleId,
          roleName: account.roleName || "未分配角色",
          roleColor: account.roleColor || "#64748b",
          accounts: [],
        };
        node.accounts.push(account);
        roleMap.set(key, node);
      }
      return {
        name,
        managers,
        accounts: departmentAccounts,
        roles: Array.from(roleMap.values()).sort((left, right) =>
          left.roleName.localeCompare(right.roleName, "zh-CN")
        ),
      };
    });

  return {
    access,
    summary: {
      accountCount: accounts.length,
      superAdminCount: superAdmins.length,
      departmentCount: departments.length,
      departmentManagerCount: accounts.filter(
        account => account.managementLevel === "department_manager"
      ).length,
      missingManagerCount: departments.filter(
        department =>
          department.name !== "未设置部门" && department.managers.length === 0
      ).length,
    },
    superAdmins,
    departments,
    roles,
  };
}

async function lockSuperAdminAssignments(db: Executor): Promise<number[]> {
  const result = await db.execute(sql`
    SELECT ura.userId
    FROM user_role_assignments ura
    INNER JOIN system_roles role ON role.id = ura.roleId
    WHERE role.isSystem = TRUE
    ORDER BY ura.userId
    FOR UPDATE
  `);
  return rowsOf<{ userId: number | string }>(result).map(row => Number(row.userId));
}

async function getAccountSnapshot(
  db: Executor,
  userId: number,
  lock = false
): Promise<Record<string, unknown>> {
  const lockClause = lock ? sql` FOR UPDATE` : sql``;
  const result = await db.execute(sql`
    SELECT
      u.id AS userId,
      u.role AS technicalRole,
      u.email,
      s.department,
      COALESCE(ums.managementLevel, 'employee') AS storedLevel,
      ums.managedDepartment,
      role.id AS roleId,
      role.name AS roleName,
      role.isSystem
    FROM users u
    LEFT JOIN staff s
      ON LOWER(TRIM(s.email)) = LOWER(TRIM(
        REGEXP_REPLACE(u.email, '^(resigned|disabled)_[0-9]+_', '')
      ))
      AND s.archivedAt IS NULL
      AND s.mergedIntoStaffId IS NULL
    LEFT JOIN user_management_scopes ums ON ums.userId = u.id
    LEFT JOIN user_role_assignments ura ON ura.userId = u.id
    LEFT JOIN system_roles role ON role.id = ura.roleId
    WHERE u.id = ${userId}
    LIMIT 1${lockClause}
  `);
  const row = rowsOf<any>(result)[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在" });
  }
  const level = resolveEffectiveManagementLevel({
    hasSuperAdminRole: Boolean(row.isSystem),
    storedLevel: row.storedLevel,
  });
  return {
    userId: Number(row.userId),
    technicalRole: row.technicalRole,
    department: row.department || null,
    managementLevel: level,
    managedDepartment: row.managedDepartment || null,
    roleId: row.roleId ? Number(row.roleId) : null,
    roleName: row.roleName || null,
  };
}

export async function updateHierarchyAssignment(
  db: Database,
  actorUserId: number,
  input: HierarchyAssignmentInput
) {
  await requireSystemSuperAdmin(db, actorUserId);
  await ensureUserManagementAudit(db);

  try {
    return await db.transaction(async transaction => {
      const existingAudit = await transaction.execute(sql`
        SELECT afterState
        FROM user_management_audit_logs
        WHERE requestId = ${input.requestId}
        LIMIT 1
      `);
      const existing = rowsOf<{ afterState: unknown }>(existingAudit)[0];
      if (existing) {
        return { success: true, idempotent: true, account: existing.afterState };
      }

      const before = await getAccountSnapshot(transaction as Executor, input.userId, true);
      const lockedSuperAdminUserIds = await lockSuperAdminAssignments(transaction as Executor);
      const currentLevel = before.managementLevel as EffectiveUserManagementLevel;
      const department = String(before.department || "").trim();

      if (actorUserId === input.userId && currentLevel === "super_admin" && input.managementLevel !== "super_admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能降低自己的超级管理员层级" });
      }
      if (input.managementLevel === "department_manager" && !department) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先在HR资料中设置该员工的部门" });
      }
      if (currentLevel === "super_admin" && input.managementLevel !== "super_admin" && lockedSuperAdminUserIds.length <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "至少需要保留一名超级管理员" });
      }

      const systemRoleResult = await transaction.execute(sql`
        SELECT id FROM system_roles WHERE isSystem = TRUE ORDER BY id ASC LIMIT 1
      `);
      const systemRoleId = Number(rowsOf<{ id: number | string }>(systemRoleResult)[0]?.id || 0);
      if (!systemRoleId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "系统超级管理员角色尚未初始化" });
      }

      if (input.managementLevel === "super_admin") {
        await transaction.execute(sql`
          INSERT INTO user_role_assignments (userId, roleId, assignedBy)
          VALUES (${input.userId}, ${systemRoleId}, ${actorUserId})
          ON DUPLICATE KEY UPDATE roleId = VALUES(roleId), assignedBy = VALUES(assignedBy), assignedAt = CURRENT_TIMESTAMP
        `);
        await transaction.execute(sql`UPDATE users SET role = 'admin' WHERE id = ${input.userId}`);
        await transaction.execute(sql`
          INSERT INTO user_management_scopes (userId, managementLevel, managedDepartment, assignedBy)
          VALUES (${input.userId}, 'employee', NULL, ${actorUserId})
          ON DUPLICATE KEY UPDATE managementLevel = 'employee', managedDepartment = NULL, assignedBy = VALUES(assignedBy), updatedAt = CURRENT_TIMESTAMP
        `);
      } else {
        if (input.roleId !== null) {
          const roleResult = await transaction.execute(sql`
            SELECT id FROM system_roles WHERE id = ${input.roleId} AND isSystem = FALSE LIMIT 1
          `);
          if (!rowsOf(roleResult).length) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "请选择有效的功能角色" });
          }
          await transaction.execute(sql`
            INSERT INTO user_role_assignments (userId, roleId, assignedBy)
            VALUES (${input.userId}, ${input.roleId}, ${actorUserId})
            ON DUPLICATE KEY UPDATE roleId = VALUES(roleId), assignedBy = VALUES(assignedBy), assignedAt = CURRENT_TIMESTAMP
          `);
        } else {
          await transaction.execute(sql`DELETE FROM user_role_assignments WHERE userId = ${input.userId}`);
        }
        if (currentLevel === "super_admin") {
          await transaction.execute(sql`UPDATE users SET role = 'user' WHERE id = ${input.userId}`);
        }
        await transaction.execute(sql`
          INSERT INTO user_management_scopes (userId, managementLevel, managedDepartment, assignedBy)
          VALUES (
            ${input.userId},
            ${input.managementLevel},
            ${input.managementLevel === "department_manager" ? department : null},
            ${actorUserId}
          )
          ON DUPLICATE KEY UPDATE
            managementLevel = VALUES(managementLevel),
            managedDepartment = VALUES(managedDepartment),
            assignedBy = VALUES(assignedBy),
            updatedAt = CURRENT_TIMESTAMP
        `);
      }

      const after = await getAccountSnapshot(transaction as Executor, input.userId);
      await appendUserManagementAudit(transaction as Executor, {
        requestId: input.requestId,
        actorUserId,
        targetType: "account",
        targetId: String(input.userId),
        action: "update_hierarchy_assignment",
        beforeState: before,
        afterState: after,
      });
      return { success: true, idempotent: false, account: after };
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const result = await db.execute(sql`
        SELECT afterState FROM user_management_audit_logs WHERE requestId = ${input.requestId} LIMIT 1
      `);
      return { success: true, idempotent: true, account: rowsOf<any>(result)[0]?.afterState || null };
    }
    throw error;
  }
}

export async function listUserManagementAudits(
  db: Database,
  actorUserId: number,
  limit = 50
) {
  await requireSystemSuperAdmin(db, actorUserId);
  await ensureUserManagementAudit(db);
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const result = await db.execute(sql`
    SELECT
      audit.id,
      audit.actorUserId,
      actor.name AS actorName,
      audit.targetType,
      audit.targetId,
      CASE
        WHEN audit.targetType = 'account' THEN target.name
        WHEN audit.targetType IN ('role', 'permission') THEN targetRole.name
        ELSE NULL
      END AS targetName,
      audit.action,
      audit.beforeState,
      audit.afterState,
      audit.createdAt
    FROM user_management_audit_logs audit
    LEFT JOIN users actor ON actor.id = audit.actorUserId
    LEFT JOIN users target
      ON audit.targetType = 'account'
      AND target.id = CAST(audit.targetId AS UNSIGNED)
    LEFT JOIN system_roles targetRole
      ON audit.targetType IN ('role', 'permission')
      AND targetRole.id = CAST(audit.targetId AS UNSIGNED)
    ORDER BY audit.id DESC
    LIMIT ${safeLimit}
  `);
  return rowsOf(result);
}
