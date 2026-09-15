/**
 * System staff-account management with department-scoped hierarchy.
 *
 * The legacy users.role flag remains untouched because many existing business
 * routes still rely on it. Account-management authority is instead resolved
 * from the explicit hierarchy table plus the system “超级管理员” RBAC role.
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { staff, users } from "../drizzle/schema";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  canDepartmentManagerToggleAccount,
  canViewManagedAccount,
  normalizeManagedAccountEmail,
  resolveEffectiveManagementLevel,
  USER_MANAGEMENT_LEVELS,
  type EffectiveUserManagementLevel,
  type UserManagementLevel,
} from "../shared/userManagementHierarchy";
import {
  ensureUserManagementHierarchy,
  getUserManagementAccess,
  requireSystemSuperAdmin,
  requireUserManagementAccess,
  type UserManagementAccess,
} from "./userManagementAccess";

type StaffDirectoryRecord = {
  email: string;
  name: string;
  department: string | null;
  position: string | null;
  isActive: "active" | "inactive";
};

type HierarchyRow = {
  userId: number | string;
  storedLevel: string | null;
  managedDepartment: string | null;
  hasSuperAdminRole: number | string | boolean;
  roleId: number | string | null;
  roleName: string | null;
  roleColor: string | null;
};

type ManagedTarget = {
  id: number;
  email: string;
  displayEmail: string;
  department: string | null;
  level: EffectiveUserManagementLevel;
};

function executeRows<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function findStaffRecord(
  records: StaffDirectoryRecord[],
  accountEmail: string
): StaffDirectoryRecord | undefined {
  const normalizedEmail = normalizeManagedAccountEmail(accountEmail);
  return records.find(
    record => normalizeManagedAccountEmail(record.email) === normalizedEmail
  );
}

async function loadStaffDirectory(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<StaffDirectoryRecord[]> {
  return db
    .select({
      email: staff.email,
      name: staff.name,
      department: staff.department,
      position: staff.position,
      isActive: staff.isActive,
    })
    .from(staff)
    .where(isNull(staff.mergedIntoStaffId));
}

async function loadHierarchyRows(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<Map<number, HierarchyRow>> {
  await ensureUserManagementHierarchy(db);
  const result = await db.execute(sql`
    SELECT
      u.id AS userId,
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
    LEFT JOIN user_management_scopes ums ON ums.userId = u.id
    LEFT JOIN user_role_assignments ura ON ura.userId = u.id
    LEFT JOIN system_roles role ON role.id = ura.roleId
  `);
  return new Map(
    executeRows<HierarchyRow>(result).map(row => [Number(row.userId), row])
  );
}

async function loadManagedTarget(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  staffDirectory?: StaffDirectoryRecord[]
): Promise<ManagedTarget> {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在" });
  }

  const directory = staffDirectory || (await loadStaffDirectory(db));
  const staffRecord = findStaffRecord(directory, user.email);
  const hierarchy = await loadHierarchyRows(db);
  const row = hierarchy.get(user.id);
  const level = resolveEffectiveManagementLevel({
    hasSuperAdminRole: Boolean(Number(row?.hasSuperAdminRole || 0)),
    storedLevel: row?.storedLevel,
  });

  return {
    id: user.id,
    email: user.email,
    displayEmail: normalizeManagedAccountEmail(user.email),
    department: staffRecord?.department || null,
    level,
  };
}

function assertCanToggleAccount(
  actor: UserManagementAccess,
  target: ManagedTarget
): void {
  if (actor.userId === target.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "不能禁用或启用自己的账号",
    });
  }
  if (actor.isSuperAdmin) return;
  if (
    !canDepartmentManagerToggleAccount({
      actorUserId: actor.userId,
      actorDepartment: actor.managedDepartment,
      targetUserId: target.id,
      targetLevel: target.level,
      targetDepartment: target.department,
    })
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "部门负责人只能启用或禁用本部门普通员工账号",
    });
  }
}

const listInput = z
  .object({
    search: z.string().optional(),
    roleFilter: z.enum(["all", "admin", "user"]).optional().default("all"),
    statusFilter: z
      .enum(["all", "active", "disabled"])
      .optional()
      .default("all"),
    levelFilter: z
      .enum(["all", ...USER_MANAGEMENT_LEVELS, "super_admin"])
      .optional()
      .default("all"),
  })
  .optional();

export const userManagementRouter = router({
  myAccess: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    return getUserManagementAccess(db, ctx.user.id);
  }),

  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });

    const actor = await requireUserManagementAccess(db, ctx.user.id);
    const allStaff = await loadStaffDirectory(db);
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.lastSignedIn));
    const hierarchy = await loadHierarchyRows(db);
    const staffEmails = new Set(
      allStaff.map(record => normalizeManagedAccountEmail(record.email))
    );

    const accounts = allUsers
      .filter(user => staffEmails.has(normalizeManagedAccountEmail(user.email)))
      .map(user => {
        const staffRecord = findStaffRecord(allStaff, user.email);
        const hierarchyRow = hierarchy.get(user.id);
        const managementLevel = resolveEffectiveManagementLevel({
          hasSuperAdminRole: Boolean(
            Number(hierarchyRow?.hasSuperAdminRole || 0)
          ),
          storedLevel: hierarchyRow?.storedLevel,
        });
        const isDisabled =
          user.email.startsWith("resigned_") ||
          user.email.startsWith("disabled_");

        return {
          id: user.id,
          email: user.email,
          displayEmail: normalizeManagedAccountEmail(user.email),
          name: staffRecord?.name || user.name || null,
          role: user.role,
          status: isDisabled ? ("disabled" as const) : ("active" as const),
          department: staffRecord?.department || null,
          position: staffRecord?.position || null,
          staffActive: staffRecord?.isActive === "active",
          managementLevel,
          managedDepartment: hierarchyRow?.managedDepartment || null,
          roleAssignment: hierarchyRow?.roleId
            ? {
                roleId: Number(hierarchyRow.roleId),
                roleName: hierarchyRow.roleName || "未命名角色",
                roleColor: hierarchyRow.roleColor || "#6b7280",
              }
            : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastSignedIn: user.lastSignedIn,
        };
      });

    const visibleAccounts = accounts.filter(account =>
      canViewManagedAccount({
        actorLevel: actor.level,
        actorDepartment: actor.managedDepartment,
        targetLevel: account.managementLevel,
        targetDepartment: account.department,
      })
    );

    let result = visibleAccounts;
    if (input?.search) {
      const searchLower = input.search.toLocaleLowerCase();
      result = result.filter(
        account =>
          account.displayEmail.toLocaleLowerCase().includes(searchLower) ||
          account.name?.toLocaleLowerCase().includes(searchLower) ||
          account.department?.toLocaleLowerCase().includes(searchLower) ||
          account.position?.toLocaleLowerCase().includes(searchLower)
      );
    }
    if (input?.roleFilter && input.roleFilter !== "all") {
      result = result.filter(account => account.role === input.roleFilter);
    }
    if (input?.statusFilter && input.statusFilter !== "all") {
      result = result.filter(account => account.status === input.statusFilter);
    }
    if (input?.levelFilter && input.levelFilter !== "all") {
      result = result.filter(
        account => account.managementLevel === input.levelFilter
      );
    }

    const availableDepartments = Array.from(
      new Set(
        (actor.isSuperAdmin
          ? allStaff.map(record => record.department)
          : [actor.managedDepartment]
        ).filter((department): department is string =>
          Boolean(department?.trim())
        )
      )
    ).sort((left, right) => left.localeCompare(right, "zh-CN"));

    return {
      users: result,
      total: result.length,
      access: actor,
      availableDepartments,
      stats: {
        totalStaff: visibleAccounts.length,
        superAdminCount: visibleAccounts.filter(
          account => account.managementLevel === "super_admin"
        ).length,
        departmentManagerCount: visibleAccounts.filter(
          account => account.managementLevel === "department_manager"
        ).length,
        employeeCount: visibleAccounts.filter(
          account => account.managementLevel === "employee"
        ).length,
        activeCount: visibleAccounts.filter(
          account => account.status === "active"
        ).length,
        disabledCount: visibleAccounts.filter(
          account => account.status === "disabled"
        ).length,
      },
    };
  }),

  updateManagementLevel: protectedProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        managementLevel: z.enum(USER_MANAGEMENT_LEVELS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });

      await requireSystemSuperAdmin(db, ctx.user.id);
      const target = await loadManagedTarget(db, input.userId);
      if (target.level === "super_admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "超级管理员层级由系统角色决定，不能在此修改",
        });
      }
      if (
        input.managementLevel === "department_manager" &&
        !target.department?.trim()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "该员工尚未在HR资料中设置部门，不能设为部门负责人",
        });
      }

      const managedDepartment =
        input.managementLevel === "department_manager"
          ? target.department!.trim()
          : null;
      await db.execute(sql`
        INSERT INTO user_management_scopes (
          userId,
          managementLevel,
          managedDepartment,
          assignedBy
        ) VALUES (
          ${input.userId},
          ${input.managementLevel},
          ${managedDepartment},
          ${ctx.user.id}
        )
        ON DUPLICATE KEY UPDATE
          managementLevel = VALUES(managementLevel),
          managedDepartment = VALUES(managedDepartment),
          assignedBy = VALUES(assignedBy),
          updatedAt = CURRENT_TIMESTAMP
      `);
      return { success: true, managedDepartment };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        newRole: z.enum(["admin", "user"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      await requireSystemSuperAdmin(db, ctx.user.id);
      if (ctx.user.id === input.userId && input.newRole !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "不能降级自己的技术角色",
        });
      }
      await db
        .update(users)
        .set({ role: input.newRole })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  disable: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      const actor = await requireUserManagementAccess(db, ctx.user.id);
      const target = await loadManagedTarget(db, input.userId);
      assertCanToggleAccount(actor, target);
      if (
        target.email.startsWith("disabled_") ||
        target.email.startsWith("resigned_")
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "账号已经被禁用" });
      }
      await db.execute(sql`
        UPDATE users
        SET email = CONCAT('disabled_', id, '_', email), role = 'user'
        WHERE id = ${input.userId}
      `);
      return { success: true };
    }),

  enable: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      const actor = await requireUserManagementAccess(db, ctx.user.id);
      const target = await loadManagedTarget(db, input.userId);
      assertCanToggleAccount(actor, target);
      if (
        !target.email.startsWith("disabled_") &&
        !target.email.startsWith("resigned_")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "账号已经是活跃状态",
        });
      }
      await db
        .update(users)
        .set({ email: target.displayEmail })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      await requireSystemSuperAdmin(db, ctx.user.id);
      if (ctx.user.id === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "不能删除自己的账号",
        });
      }
      await db.transaction(async transaction => {
        await transaction.execute(
          sql`DELETE FROM user_role_assignments WHERE userId = ${input.userId}`
        );
        await transaction.execute(
          sql`DELETE FROM user_management_scopes WHERE userId = ${input.userId}`
        );
        await transaction.delete(users).where(eq(users.id, input.userId));
      });
      return { success: true };
    }),

  syncNames: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    await requireSystemSuperAdmin(db, ctx.user.id);

    const allStaff = await loadStaffDirectory(db);
    const allUsers = await db.select().from(users);
    let updatedCount = 0;
    for (const staffRecord of allStaff) {
      if (!staffRecord.name) continue;
      const matchingUser = allUsers.find(
        user =>
          normalizeManagedAccountEmail(user.email) ===
          normalizeManagedAccountEmail(staffRecord.email)
      );
      if (matchingUser && matchingUser.name !== staffRecord.name) {
        await db
          .update(users)
          .set({ name: staffRecord.name })
          .where(eq(users.id, matchingUser.id));
        updatedCount += 1;
      }
    }

    return { success: true, updatedCount };
  }),
});
