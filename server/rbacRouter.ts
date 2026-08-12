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
        // Use custom role permissions
        const roleId = assignment[0].roleId;
        const [perms] = (await db.execute(sql`
          SELECT pageKey, canView, canEdit FROM role_permissions WHERE roleId = ${roleId}
        `)) as any;
        return {
          roleName: assignment[0].roleName,
          roleId,
          isAdmin: true,
          permissions: perms || [],
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
        permissions: perms || [],
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
});
