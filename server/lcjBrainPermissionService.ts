import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { createRbacTables } from "./migrations/createRbacTables";
import { getSystemUserHierarchy } from "./systemUserHierarchyService";
import { getUserManagementAccess } from "./userManagementAccess";

const CORE_SUPER_ADMINS = [
  {
    email: "ryuhairartist@gmail.com",
    displayName: "京極琉（KG）",
  },
  {
    email: "cindy121481@gmail.com",
    displayName: "Cindy",
  },
] as const;

let coreSuperAdminSetup: Promise<void> | null = null;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function canonicalDisplayName(email: string, fallback: string | null): string {
  const normalized = email.trim().toLocaleLowerCase();
  const core = CORE_SUPER_ADMINS.find(item => item.email === normalized);
  return core?.displayName || fallback?.trim() || "未命名账号";
}

export function ensureLcjBrainCoreSuperAdmins(): Promise<void> {
  if (!coreSuperAdminSetup) {
    coreSuperAdminSetup = (async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await createRbacTables(db as any);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS system_roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description VARCHAR(500),
          color VARCHAR(20) DEFAULT '#6366f1',
          isSystem BOOLEAN NOT NULL DEFAULT FALSE,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY idx_role_name (name)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_role_assignments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          roleId INT NOT NULL,
          assignedBy INT,
          assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY idx_user_role (userId),
          INDEX idx_roleId (roleId)
        )
      `);
      await db.execute(sql`
        INSERT INTO system_roles (name, description, color, isSystem)
        VALUES ('超级管理员', '全部权限，系统最高权限', '#ef4444', TRUE)
        ON DUPLICATE KEY UPDATE
          description = VALUES(description),
          color = VALUES(color),
          isSystem = TRUE
      `);
      await db.execute(sql`
        INSERT INTO user_role_assignments (userId, roleId, assignedBy)
        SELECT user.id, role.id, NULL
        FROM users user
        INNER JOIN system_roles role
          ON role.name = '超级管理员' AND role.isSystem = TRUE
        WHERE LOWER(TRIM(user.email)) IN (
          'ryuhairartist@gmail.com',
          'cindy121481@gmail.com'
        )
        ON DUPLICATE KEY UPDATE
          roleId = VALUES(roleId),
          assignedBy = NULL
      `);
      await db.execute(sql`
        UPDATE users
        SET role = 'admin'
        WHERE LOWER(TRIM(email)) IN (
          'ryuhairartist@gmail.com',
          'cindy121481@gmail.com'
        )
      `);
    })().catch(error => {
      coreSuperAdminSetup = null;
      throw error;
    });
  }
  return coreSuperAdminSetup;
}

export async function getLcjBrainPermissionHealth() {
  await ensureLcjBrainCoreSuperAdmins();
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT user.id) AS total
    FROM users user
    INNER JOIN user_role_assignments assignment
      ON assignment.userId = user.id
    INNER JOIN system_roles role
      ON role.id = assignment.roleId AND role.isSystem = TRUE
    WHERE LOWER(TRIM(user.email)) IN (
      'ryuhairartist@gmail.com',
      'cindy121481@gmail.com'
    )
      AND user.role = 'admin'
  `);
  const total = Number(
    rowsOf<{ total?: number | string }>(result)[0]?.total || 0
  );
  return {
    ok: total === CORE_SUPER_ADMINS.length,
    configuredCoreSuperAdminCount: total,
    expectedCoreSuperAdminCount: CORE_SUPER_ADMINS.length,
  };
}

export async function getLcjBrainPermissionSummary(actor: {
  id: number;
  email: string;
  name?: string | null;
}) {
  await ensureLcjBrainCoreSuperAdmins();
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const access = await getUserManagementAccess(db, actor.id);
  const currentResult = await db.execute(sql`
    SELECT
      COALESCE(staff.name, user.name) AS displayName,
      staff.department,
      staff.position
    FROM users user
    LEFT JOIN staff
      ON LOWER(TRIM(staff.email)) = LOWER(TRIM(
        REGEXP_REPLACE(user.email, '^(resigned|disabled)_[0-9]+_', '')
      ))
      AND staff.archivedAt IS NULL
      AND staff.mergedIntoStaffId IS NULL
    WHERE user.id = ${actor.id}
    ORDER BY staff.id ASC
    LIMIT 1
  `);
  const current = rowsOf<{
    displayName?: string | null;
    department?: string | null;
    position?: string | null;
  }>(currentResult)[0];

  const level = access.isSuperAdmin
    ? ("super_admin" as const)
    : access.level === "department_manager"
      ? ("department_manager" as const)
      : ("employee" as const);
  const levelLabel = access.isSuperAdmin
    ? "超级管理员"
    : level === "department_manager"
      ? "部门负责人"
      : "普通员工";
  const scopeLabel = access.isSuperAdmin
    ? "可只读查询全公司全部在职员工的工作资料"
    : level === "department_manager"
      ? `可只读查询${access.managedDepartment || "已配置部门"}的在职员工工作资料`
      : "只能只读查询本人的工作资料";

  const base = {
    currentAccount: {
      displayName: canonicalDisplayName(
        actor.email,
        current?.displayName || actor.name || null
      ),
      department: current?.department || access.staffDepartment || null,
      position: current?.position || null,
      level,
      levelLabel,
      managedDepartment: access.managedDepartment,
      scopeLabel,
      systemAccessLabel: access.isSuperAdmin
        ? "全部系统功能可用"
        : "按已分配角色使用系统功能",
    },
    privacyNotice:
      "工资、电话、生日、住址、LINE、紧急联系人、邮箱、原文件名和存储地址不会进入AI回答。",
    canViewPermissionDirectory: access.canManageAccounts,
    permissionDirectory: null as null | {
      accounts: Array<{
        displayName: string;
        department: string | null;
        position: string | null;
        level: "super_admin" | "department_manager" | "employee";
        levelLabel: string;
        scopeLabel: string;
      }>;
      counts: {
        superAdmins: number;
        departmentManagers: number;
        employees: number;
      };
    },
  };

  if (!access.canManageAccounts) return base;

  const hierarchy = await getSystemUserHierarchy(db, actor.id);
  const accounts = [
    ...hierarchy.superAdmins,
    ...hierarchy.departments.flatMap(department => department.accounts),
  ];
  const deduped = Array.from(
    new Map(accounts.map(account => [account.userId, account])).values()
  ).map(account => {
    const accountLevel = account.managementLevel;
    const accountLevelLabel =
      accountLevel === "super_admin"
        ? "超级管理员"
        : accountLevel === "department_manager"
          ? "部门负责人"
          : "普通员工";
    const accountScopeLabel =
      accountLevel === "super_admin"
        ? "全公司"
        : accountLevel === "department_manager"
          ? account.managedDepartment || "未配置负责部门"
          : "本人";
    return {
      displayName: canonicalDisplayName(account.email, account.name),
      department: account.department,
      position: account.position,
      level: accountLevel,
      levelLabel: accountLevelLabel,
      scopeLabel: accountScopeLabel,
    };
  });

  return {
    ...base,
    permissionDirectory: {
      accounts: deduped,
      counts: {
        superAdmins: deduped.filter(item => item.level === "super_admin")
          .length,
        departmentManagers: deduped.filter(
          item => item.level === "department_manager"
        ).length,
        employees: deduped.filter(item => item.level === "employee").length,
      },
    },
  };
}

export const LCJ_BRAIN_CORE_SUPER_ADMIN_EMAILS = CORE_SUPER_ADMINS.map(
  item => item.email
);
