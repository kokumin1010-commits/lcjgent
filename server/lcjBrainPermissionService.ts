import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";
import { LCJ_BRAIN_CORE_SUPER_ADMINS } from "../shared/lcjBrainCoreAdmins";
import { getDb } from "./db";
import { getEmailProviderConfiguration } from "./emailService";
import { createRbacTables } from "./migrations/createRbacTables";
import { getSystemUserHierarchy } from "./systemUserHierarchyService";
import { getUserManagementAccess } from "./userManagementAccess";

type BrainPermissionDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type BrainPermissionExecutor = Pick<BrainPermissionDatabase, "execute">;

let coreSuperAdminSetup: Promise<void> | null = null;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function canonicalDisplayName(email: string, fallback: string | null): string {
  const normalized = email.trim().toLocaleLowerCase();
  const core = LCJ_BRAIN_CORE_SUPER_ADMINS.find(
    item => item.email === normalized
  );
  return core?.displayName || fallback?.trim() || "未命名账号";
}

async function ensureUserSessionVersionColumn(
  db: BrainPermissionExecutor
): Promise<void> {
  const columnsResult = await db.execute(
    sql`SHOW COLUMNS FROM users LIKE 'sessionVersion'`
  );
  if (rowsOf(columnsResult).length > 0) return;
  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN sessionVersion INT NOT NULL DEFAULT 1 AFTER role
    `);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code !== "ER_DUP_FIELDNAME") throw error;
  }
}

function assertCorePasswordResetDeliveryConfigured(): void {
  if (getEmailProviderConfiguration().priority.length === 0) {
    throw new Error("Core account password reset delivery is not configured");
  }
}

async function ensureCoreSuperAdminUserRows(
  db: BrainPermissionExecutor
): Promise<void> {
  for (const account of LCJ_BRAIN_CORE_SUPER_ADMINS) {
    const activeStaffResult = await db.execute(sql`
      SELECT id
      FROM staff
      WHERE LOWER(TRIM(email)) = ${account.email}
        AND isActive = 'active'
        AND archivedAt IS NULL
        AND mergedIntoStaffId IS NULL
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE
    `);
    if (rowsOf<{ id: number | string }>(activeStaffResult).length === 0) {
      throw new Error(`Missing active HR identity for ${account.displayName}`);
    }

    const exactResult = await db.execute(sql`
      SELECT
        user.id,
        EXISTS(
          SELECT 1
          FROM user_role_assignments assignment
          INNER JOIN system_roles role ON role.id = assignment.roleId
          WHERE assignment.userId = user.id AND role.isSystem = TRUE
        ) AS hasSystemRole,
        user.sessionVersion
      FROM users user
      WHERE LOWER(TRIM(user.email)) = ${account.email}
      LIMIT 1
      FOR UPDATE
    `);
    const exact = rowsOf<{
      id: number | string;
      hasSystemRole?: boolean | number | string;
      sessionVersion?: number | string;
    }>(exactResult)[0];
    if (
      exact &&
      (exact.hasSystemRole === true || Number(exact.hasSystemRole) === 1) &&
      Number(exact.sessionVersion || 1) >= account.requiredSessionVersion
    ) {
      continue;
    }

    // The HR directory proves this exact email is an active staff identity, but
    // historical recovery may have restored only staff data. Replace any untrusted
    // pre-role credential (including a registration made during an older deployment)
    // or create the missing row with a non-guessable password. The owner can then use
    // the existing email-based password reset flow. Existing true super-admin passwords
    // are never changed.
    assertCorePasswordResetDeliveryConfigured();
    const unusablePassword = randomBytes(48).toString("base64url");
    const passwordHash = await bcrypt.hash(unusablePassword, 10);
    if (exact) {
      await db.execute(sql`
        UPDATE users
        SET
          password = ${passwordHash},
          name = ${account.displayName},
          role = 'admin',
          sessionVersion = ${account.requiredSessionVersion}
        WHERE id = ${Number(exact.id)}
      `);
      continue;
    }
    await db.execute(sql`
      INSERT INTO users (email, password, name, role, sessionVersion)
      VALUES (
        ${account.email},
        ${passwordHash},
        ${account.displayName},
        'admin',
        ${account.requiredSessionVersion}
      )
    `);
  }
}

export function ensureLcjBrainCoreSuperAdmins(): Promise<void> {
  if (!coreSuperAdminSetup) {
    coreSuperAdminSetup = (async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await ensureUserSessionVersionColumn(db);
      await createRbacTables(db as any);
      await db.transaction(async transaction => {
        await transaction.execute(sql`
          INSERT INTO system_roles (name, description, color, isSystem)
          VALUES ('超级管理员', '全部权限，系统最高权限', '#ef4444', TRUE)
          ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            color = VALUES(color),
            isSystem = TRUE
        `);
        await ensureCoreSuperAdminUserRows(transaction);
        await transaction.execute(sql`
          INSERT IGNORE INTO user_management_scopes (userId, managementLevel)
          SELECT id, 'employee'
          FROM users
          WHERE LOWER(TRIM(email)) IN (
            'ryuhairartist@gmail.com',
            'cindy121481@gmail.com'
          )
        `);
        await transaction.execute(sql`
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
        await transaction.execute(sql`
          UPDATE users
          SET role = 'admin'
          WHERE LOWER(TRIM(email)) IN (
            'ryuhairartist@gmail.com',
            'cindy121481@gmail.com'
          )
        `);
        const verificationResult = await transaction.execute(sql`
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
            AND user.sessionVersion >= CASE
              WHEN LOWER(TRIM(user.email)) = 'cindy121481@gmail.com' THEN 2
              ELSE 1
            END
        `);
        const verifiedCount = Number(
          rowsOf<{ total?: number | string }>(verificationResult)[0]?.total || 0
        );
        if (verifiedCount !== LCJ_BRAIN_CORE_SUPER_ADMINS.length) {
          throw new Error("Core super administrator verification failed");
        }
      });
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
      AND user.sessionVersion >= CASE
        WHEN LOWER(TRIM(user.email)) = 'cindy121481@gmail.com' THEN 2
        ELSE 1
      END
  `);
  const total = Number(
    rowsOf<{ total?: number | string }>(result)[0]?.total || 0
  );
  return {
    ok: total === LCJ_BRAIN_CORE_SUPER_ADMINS.length,
    configuredCoreSuperAdminCount: total,
    expectedCoreSuperAdminCount: LCJ_BRAIN_CORE_SUPER_ADMINS.length,
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

export const LCJ_BRAIN_CORE_SUPER_ADMIN_EMAILS =
  LCJ_BRAIN_CORE_SUPER_ADMINS.map(item => item.email);
