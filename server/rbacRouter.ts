/**
 * RBAC Router - Role-Based Access Control
 * 
 * Manages:
 * - System roles (CRUD)
 * - Role permissions (which pages each role can access)
 * - User role assignments (assign roles to users)
 * - Permission queries (check what current user can access)
 */
import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";

export const rbacRouter = router({
  // List all roles
  listRoles: adminProcedure.query(async () => {
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
  createRole: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(20).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.execute(sql`
        INSERT INTO system_roles (name, description, color, isSystem)
        VALUES (${input.name}, ${input.description || null}, ${input.color || '#6366f1'}, FALSE)
      `);
      return { success: true };
    }),

  // Update a role
  updateRole: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(20).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Don't allow editing system roles' name
      const [role] = (await db.execute(sql`SELECT isSystem FROM system_roles WHERE id = ${input.id}`)) as any;
      if (role?.[0]?.isSystem && input.name !== role[0].name) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot rename system roles" });
      }

      await db.execute(sql`
        UPDATE system_roles SET name = ${input.name}, description = ${input.description || null}, color = ${input.color || '#6366f1'}
        WHERE id = ${input.id}
      `);
      return { success: true };
    }),

  // Delete a role (non-system only)
  deleteRole: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [role] = (await db.execute(sql`SELECT isSystem FROM system_roles WHERE id = ${input.id}`)) as any;
      if (role?.[0]?.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete system roles" });
      }

      // Remove all user assignments for this role
      await db.execute(sql`DELETE FROM user_role_assignments WHERE roleId = ${input.id}`);
      // Remove all permissions for this role
      await db.execute(sql`DELETE FROM role_permissions WHERE roleId = ${input.id}`);
      // Delete the role
      await db.execute(sql`DELETE FROM system_roles WHERE id = ${input.id}`);
      return { success: true };
    }),

  // Get permissions for a specific role
  getRolePermissions: adminProcedure
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
  updateRolePermissions: adminProcedure
    .input(z.object({
      roleId: z.number(),
      permissions: z.array(z.object({
        pageKey: z.string(),
        canView: z.boolean(),
        canEdit: z.boolean(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Delete existing permissions for this role
      await db.execute(sql`DELETE FROM role_permissions WHERE roleId = ${input.roleId}`);

      // Insert new permissions
      for (const perm of input.permissions) {
        if (perm.canView || perm.canEdit) {
          await db.execute(sql`
            INSERT INTO role_permissions (roleId, pageKey, canView, canEdit)
            VALUES (${input.roleId}, ${perm.pageKey}, ${perm.canView}, ${perm.canEdit})
          `);
        }
      }
      return { success: true };
    }),

  // Assign a role to a user
  assignUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      roleId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Upsert: replace existing assignment
      await db.execute(sql`
        INSERT INTO user_role_assignments (userId, roleId, assignedBy)
        VALUES (${input.userId}, ${input.roleId}, ${ctx.user.id})
        ON DUPLICATE KEY UPDATE roleId = ${input.roleId}, assignedBy = ${ctx.user.id}, assignedAt = CURRENT_TIMESTAMP
      `);
      return { success: true };
    }),

  // Remove role assignment from a user
  removeUserRole: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.execute(sql`DELETE FROM user_role_assignments WHERE userId = ${input.userId}`);
      return { success: true };
    }),

  // Get all user role assignments (for the admin table)
  listUserRoleAssignments: adminProcedure.query(async () => {
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

    // If user is admin (legacy role), they have full access
    if (ctx.user.role === "admin") {
      // Check if they have a custom role assigned
      const [assignment] = (await db.execute(sql`
        SELECT ura.roleId, r.name as roleName
        FROM user_role_assignments ura
        JOIN system_roles r ON r.id = ura.roleId
        WHERE ura.userId = ${ctx.user.id}
      `)) as any;

      if (assignment && assignment.length > 0) {
        // If custom role is '超级管理员', give full access (same as no custom role)
        const roleName = assignment[0].roleName;
        if (roleName === '超级管理員' || roleName === '超级管理员' || roleName.includes('超级') || roleName.includes('スーパー')) {
          return {
            roleName,
            roleId: assignment[0].roleId,
            isAdmin: true,
            permissions: null, // null means full access
          };
        }
        // Use custom role permissions
        const roleId = assignment[0].roleId;
        const [perms] = (await db.execute(sql`
          SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${roleId}
        `)) as any;
        return {
          roleName,
          roleId,
          isAdmin: true,
          permissions: (perms || []).map((p: any) => ({ ...p, canView: !!p.canView, canEdit: !!p.canEdit })),
        };
      }

      // No custom role = super admin (full access)
      return {
        roleName: "超级管理员",
        roleId: null,
        isAdmin: true,
        permissions: null, // null means full access
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
        permissions: (perms || []).map((p: any) => ({ ...p, canView: !!p.canView, canEdit: !!p.canEdit })),
      };
    }

    // No role assigned = basic access (dashboard only)
    return {
      roleName: "未分配",
      roleId: null,
      isAdmin: false,
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
  listPermissionRequests: adminProcedure
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
  approvePermissionRequest: adminProcedure
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
  rejectPermissionRequest: adminProcedure
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
