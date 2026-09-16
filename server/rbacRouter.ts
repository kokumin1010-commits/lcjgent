/**
 * RBAC Router - Role-Based Access Control
 *
 * Manages:
 * - System roles (CRUD)
 * - Role permissions (which pages each role can access)
 * - User role assignments (assign roles to users)
 * - Permission queries (check what current user can access)
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";
import {
  getUserManagementAccess,
  requireSystemSuperAdmin,
} from "./userManagementAccess";
import {
  appendUserManagementAudit,
  ensureUserManagementAudit,
  updateHierarchyAssignment,
} from "./systemUserHierarchyService";

const systemSuperAdminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }
    const managementAccess = await requireSystemSuperAdmin(db, ctx.user.id);
    return next({ ctx: { ...ctx, managementAccess } });
  }
);

export const rbacRouter = router({
  // List all roles
  listRoles: systemSuperAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const roles = await db.execute(sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM user_role_assignments WHERE roleId = r.id) as userCount
      FROM system_roles r
      ORDER BY r.isSystem DESC, r.id ASC
    `);
    return (roles as any)[0] || [];
  }),

  // Create a new role
  createRole: systemSuperAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await ensureUserManagementAudit(db);
      const requestId = randomUUID();
      let roleId = 0;
      await db.transaction(async transaction => {
        const result = (await transaction.execute(sql`
          INSERT INTO system_roles (name, description, color, isSystem)
          VALUES (${input.name}, ${input.description || null}, ${input.color || '#6366f1'}, FALSE)
        `)) as any;
        roleId = Number(result?.[0]?.insertId || 0);
        await appendUserManagementAudit(transaction as any, {
          requestId,
          actorUserId: ctx.user.id,
          targetType: "role",
          targetId: String(roleId),
          action: "create_function_role",
          beforeState: null,
          afterState: { name: input.name, description: input.description || null, color: input.color || "#6366f1" },
        });
      });
      return { success: true, roleId };
    }),

  // Update a role
  updateRole: systemSuperAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await ensureUserManagementAudit(db);
      const [roleRows] = (await db.execute(sql`SELECT id, name, description, color, isSystem FROM system_roles WHERE id = ${input.id} LIMIT 1`)) as any;
      const role = roleRows?.[0];
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "角色不存在" });
      if (role.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "系统超级管理员角色为只读，不能修改" });
      }
      await db.transaction(async transaction => {
        await transaction.execute(sql`
          UPDATE system_roles SET name = ${input.name}, description = ${input.description || null}, color = ${input.color || '#6366f1'}
          WHERE id = ${input.id}
        `);
        await appendUserManagementAudit(transaction as any, {
          requestId: randomUUID(),
          actorUserId: ctx.user.id,
          targetType: "role",
          targetId: String(input.id),
          action: "update_function_role",
          beforeState: { name: role.name, description: role.description, color: role.color },
          afterState: { name: input.name, description: input.description || null, color: input.color || "#6366f1" },
        });
      });
      return { success: true };
    }),

  // Delete a role (non-system only)
  deleteRole: systemSuperAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await ensureUserManagementAudit(db);
      const [roleRows] = (await db.execute(sql`SELECT id, name, description, color, isSystem FROM system_roles WHERE id = ${input.id} LIMIT 1`)) as any;
      const role = roleRows?.[0];
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "角色不存在" });
      if (role.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "系统超级管理员角色不能删除" });
      }
      await db.transaction(async transaction => {
        const [permissionRows] = (await transaction.execute(sql`
          SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${input.id} ORDER BY pageKey
        `)) as any;
        const [assignmentRows] = (await transaction.execute(sql`
          SELECT userId FROM user_role_assignments WHERE roleId = ${input.id} ORDER BY userId
        `)) as any;
        await transaction.execute(sql`DELETE FROM user_role_assignments WHERE roleId = ${input.id}`);
        await transaction.execute(sql`DELETE FROM role_permissions WHERE roleId = ${input.id}`);
        await transaction.execute(sql`DELETE FROM system_roles WHERE id = ${input.id}`);
        await appendUserManagementAudit(transaction as any, {
          requestId: randomUUID(),
          actorUserId: ctx.user.id,
          targetType: "role",
          targetId: String(input.id),
          action: "delete_function_role",
          beforeState: { role, permissions: permissionRows || [], assignedUserIds: (assignmentRows || []).map((row: any) => row.userId) },
          afterState: null,
        });
      });
      return { success: true };
    }),

  // Get permissions for a specific role
  getRolePermissions: systemSuperAdminProcedure
    .input(z.object({ roleId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const perms = await db.execute(sql`
        SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${input.roleId}
      `);
      return (perms as any)[0] || [];
    }),

  // Update permissions for a role (bulk replace)
  updateRolePermissions: systemSuperAdminProcedure
    .input(z.object({
      roleId: z.number(),
      permissions: z.array(z.object({
        pageKey: z.string(),
        canView: z.boolean(),
        canEdit: z.boolean(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await ensureUserManagementAudit(db);
      const [roleRows] = (await db.execute(sql`SELECT id, name, isSystem FROM system_roles WHERE id = ${input.roleId} LIMIT 1`)) as any;
      const role = roleRows?.[0];
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "角色不存在" });
      if (role.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "系统超级管理员角色拥有固定全权限，不能修改" });
      }
      const requestId = randomUUID();
      await db.transaction(async transaction => {
        const [beforeRows] = (await transaction.execute(sql`
          SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${input.roleId} ORDER BY pageKey
        `)) as any;
        await transaction.execute(sql`DELETE FROM role_permissions WHERE roleId = ${input.roleId}`);
        for (const perm of input.permissions) {
          if (perm.canView || perm.canEdit) {
            await transaction.execute(sql`
              INSERT INTO role_permissions (roleId, pageKey, canView, canEdit)
              VALUES (${input.roleId}, ${perm.pageKey}, ${perm.canView}, ${perm.canEdit})
            `);
          }
        }
        const [afterRows] = (await transaction.execute(sql`
          SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${input.roleId} ORDER BY pageKey
        `)) as any;
        await appendUserManagementAudit(transaction as any, {
          requestId,
          actorUserId: ctx.user.id,
          targetType: "permission",
          targetId: String(input.roleId),
          action: "update_role_permissions",
          beforeState: { roleName: role.name, permissions: beforeRows || [] },
          afterState: { roleName: role.name, permissions: afterRows || [] },
        });
      });
      return { success: true };
    }),

  // Assign a role to a user
  assignUserRole: systemSuperAdminProcedure
    .input(z.object({
      userId: z.number(),
      roleId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const targetAccess = await getUserManagementAccess(db, input.userId);
      const [roleRows] = (await db.execute(sql`SELECT isSystem FROM system_roles WHERE id = ${input.roleId} LIMIT 1`)) as any;
      const role = roleRows?.[0];
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "角色不存在" });
      if (targetAccess.isSuperAdmin && !role.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请在层级权限树中调整超级管理员，避免误降级" });
      }
      return updateHierarchyAssignment(db, ctx.user.id, {
        userId: input.userId,
        managementLevel: role.isSystem ? "super_admin" : targetAccess.level,
        roleId: role.isSystem ? null : input.roleId,
        requestId: randomUUID(),
      });
    }),

  // Remove role assignment from a user
  removeUserRole: systemSuperAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const targetAccess = await getUserManagementAccess(db, input.userId);
      if (targetAccess.isSuperAdmin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请在层级权限树中安全调整超级管理员" });
      }
      return updateHierarchyAssignment(db, ctx.user.id, {
        userId: input.userId,
        managementLevel: targetAccess.level,
        roleId: null,
        requestId: randomUUID(),
      });
    }),

  // Get all user role assignments (for the admin table)
  listUserRoleAssignments: systemSuperAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const assignments = await db.execute(sql`
      SELECT ura.userId, ura.roleId, r.name as roleName, r.color as roleColor
      FROM user_role_assignments ura
      JOIN system_roles r ON r.id = ura.roleId
    `);
    return (assignments as any)[0] || [];
  }),

  // Get current user's permissions (for frontend sidebar filtering)
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const managementAccess = await getUserManagementAccess(db, ctx.user.id);

    // Keep the legacy technical admin behavior for existing business pages,
    // while exposing the explicit account-management hierarchy separately.
    if (ctx.user.role === "admin") {
      return {
        roleName: managementAccess.isSuperAdmin ? "超级管理员" : "兼容管理员",
        roleId: null,
        isAdmin: true,
        managementLevel: managementAccess.level,
        managedDepartment: managementAccess.managedDepartment,
        canManageSystemUsers: managementAccess.canManageAccounts,
        permissions: null,
      };
    }

    // Non-admin user: check custom role
    const [assignment] = (await db.execute(sql`
      SELECT ura.roleId, r.name as roleName
      FROM user_role_assignments ura
      JOIN system_roles r ON r.id = ura.roleId
      WHERE ura.userId = ${ctx.user.id}
    `)) as any;

    if (assignment && assignment.length > 0) {
      const roleId = assignment[0].roleId;
      const [perms] = (await db.execute(sql`
        SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${roleId}
      `)) as any;
      return {
        roleName: assignment[0].roleName,
        roleId,
        isAdmin: false,
        managementLevel: managementAccess.level,
        managedDepartment: managementAccess.managedDepartment,
        canManageSystemUsers: managementAccess.canManageAccounts,
        permissions: (perms || []).map((p: any) => ({ ...p, canView: !!p.canView, canEdit: !!p.canEdit })),
      };
    }

    // No role assigned = basic access (dashboard only)
    return {
      roleName: "未分配",
      roleId: null,
      isAdmin: false,
      managementLevel: managementAccess.level,
      managedDepartment: managementAccess.managedDepartment,
      canManageSystemUsers: managementAccess.canManageAccounts,
      permissions: [{ pageKey: "/master", canView: true, canEdit: false }],
    };
  }),

  // Request permission for a page
  requestPermission: protectedProcedure
    .input(z.object({
      pageKey: z.string(),
      pageName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Create the permission_requests table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS permission_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          userName VARCHAR(255),
          userEmail VARCHAR(320),
          pageKey VARCHAR(255) NOT NULL,
          pageName VARCHAR(255) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          reviewedBy INT,
          reviewedAt TIMESTAMP NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_userId (userId)
        )
      `);

      // Check if already has a pending request for this page
      const [existing] = (await db.execute(sql`
        SELECT id FROM permission_requests WHERE userId = ${ctx.user.id} AND pageKey = ${input.pageKey} AND status = 'pending'
      `)) as any;
      if (existing && existing.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "已有待审核的申请 / 既に申請済みです" });
      }

      // Insert request
      await db.execute(sql`
        INSERT INTO permission_requests (userId, userName, userEmail, pageKey, pageName)
        VALUES (${ctx.user.id}, ${ctx.user.name || ''}, ${ctx.user.email}, ${input.pageKey}, ${input.pageName})
      `);

      // Notify admin (yanghao)
      try {
        await notifyOwner({
          title: "权限申请 / 権限申請",
          content: `${ctx.user.name || ctx.user.email} 申请访问「${input.pageName}」(${input.pageKey})\n\n请在 lcjmall.com/master/system-users 审核。`,
        });
      } catch (e) {
        console.error("[RBAC] Failed to notify owner:", e);
      }

      return { success: true };
    }),

  // List pending permission requests (admin only)
  listPermissionRequests: systemSuperAdminProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("pending"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Ensure table exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS permission_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          userName VARCHAR(255),
          userEmail VARCHAR(320),
          pageKey VARCHAR(255) NOT NULL,
          pageName VARCHAR(255) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          reviewedBy INT,
          reviewedAt TIMESTAMP NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_userId (userId)
        )
      `);

      const statusFilter = input?.status || "pending";
      let rows;
      if (statusFilter === "all") {
        [rows] = (await db.execute(sql`SELECT * FROM permission_requests ORDER BY createdAt DESC LIMIT 100`)) as any;
      } else {
        [rows] = (await db.execute(sql`SELECT * FROM permission_requests WHERE status = ${statusFilter} ORDER BY createdAt DESC LIMIT 100`)) as any;
      }
      return rows || [];
    }),

  // Approve permission request
  approvePermissionRequest: systemSuperAdminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the request
      const [req] = (await db.execute(sql`SELECT * FROM permission_requests WHERE id = ${input.requestId}`)) as any;
      if (!req || !req[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      const request = req[0];

      // Update request status
      await db.execute(sql`
        UPDATE permission_requests SET status = 'approved', reviewedBy = ${ctx.user.id}, reviewedAt = CURRENT_TIMESTAMP
        WHERE id = ${input.requestId}
      `);

      // Get user's current role assignment
      const [assignment] = (await db.execute(sql`
        SELECT roleId FROM user_role_assignments WHERE userId = ${request.userId}
      `)) as any;

      if (assignment && assignment.length > 0) {
        // Add the page permission to their existing role
        const roleId = assignment[0].roleId;
        await db.execute(sql`
          INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
          VALUES (${roleId}, ${request.pageKey}, TRUE, TRUE)
        `);
      } else {
        // User has no role - create a personal role or assign to 普通员工 with extra permission
        // For simplicity, assign to 普通员工 (roleId=6) and add the permission
        await db.execute(sql`
          INSERT INTO user_role_assignments (userId, roleId, assignedBy)
          VALUES (${request.userId}, 6, ${ctx.user.id})
          ON DUPLICATE KEY UPDATE roleId = 6, assignedBy = ${ctx.user.id}
        `);
        await db.execute(sql`
          INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
          VALUES (6, ${request.pageKey}, TRUE, TRUE)
        `);
      }

      return { success: true };
    }),

  // Reject permission request
  rejectPermissionRequest: systemSuperAdminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.execute(sql`
        UPDATE permission_requests SET status = 'rejected', reviewedBy = ${ctx.user.id}, reviewedAt = CURRENT_TIMESTAMP
        WHERE id = ${input.requestId}
      `);
      return { success: true };
    }),
});
