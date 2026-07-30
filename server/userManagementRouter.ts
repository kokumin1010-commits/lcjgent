/**
 * User Management Router - 后台员工账号管理
 * 
 * Admin-only procedures for managing staff login accounts (employees only):
 * - Only shows users whose email matches an active staff member in the staff table
 * - Update user roles (admin/user)
 * - Disable/enable accounts
 * - Delete accounts
 */
import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { staff } from "../drizzle/schema";
import { eq, like, or, desc, sql, and, not, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const userManagementRouter = router({
  // List staff users only (employees who use the backend)
  list: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      roleFilter: z.enum(["all", "admin", "user"]).optional().default("all"),
      statusFilter: z.enum(["all", "active", "disabled"]).optional().default("all"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get all staff emails (active + inactive) to identify employee accounts
      const allStaff = await db.select({
        email: staff.email,
        name: staff.name,
        department: staff.department,
        position: staff.position,
        isActive: staff.isActive,
      }).from(staff);

      const staffEmails = new Set(allStaff.map(s => s.email.toLowerCase()));

      // Get all users
      const allUsers = await db.select().from(users).orderBy(desc(users.lastSignedIn));

      // Filter to only staff members (match by email)
      const staffUsers = allUsers.filter(u => {
        // Check direct email match
        if (staffEmails.has(u.email.toLowerCase())) return true;
        // Check disabled/resigned prefix pattern
        if (u.email.startsWith("resigned_") || u.email.startsWith("disabled_")) {
          const match = u.email.match(/^(?:resigned|disabled)_\d+_(.+)$/);
          if (match && staffEmails.has(match[1].toLowerCase())) return true;
        }
        return false;
      });

      // Process users to determine status and enrich with staff info
      let result = staffUsers.map(u => {
        const isDisabled = u.email.startsWith("resigned_") || u.email.startsWith("disabled_");
        // Extract original email for display
        let displayEmail = u.email;
        if (u.email.startsWith("resigned_")) {
          const match = u.email.match(/^resigned_\d+_(.+)$/);
          if (match) displayEmail = match[1];
        } else if (u.email.startsWith("disabled_")) {
          const match = u.email.match(/^disabled_\d+_(.+)$/);
          if (match) displayEmail = match[1];
        }

        // Find matching staff record for department/position info
        const staffRecord = allStaff.find(s => s.email.toLowerCase() === displayEmail.toLowerCase());

        return {
          id: u.id,
          email: u.email,
          displayEmail,
          name: u.name || staffRecord?.name || null,
          role: u.role,
          status: isDisabled ? "disabled" as const : "active" as const,
          department: staffRecord?.department || null,
          position: staffRecord?.position || null,
          staffActive: staffRecord?.isActive === "active",
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          lastSignedIn: u.lastSignedIn,
        };
      });

      // Apply search filter
      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        result = result.filter(u =>
          u.displayEmail.toLowerCase().includes(searchLower) ||
          (u.name && u.name.toLowerCase().includes(searchLower)) ||
          (u.department && u.department.toLowerCase().includes(searchLower))
        );
      }

      // Apply role filter
      if (input?.roleFilter && input.roleFilter !== "all") {
        result = result.filter(u => u.role === input.roleFilter);
      }

      // Apply status filter
      if (input?.statusFilter && input.statusFilter !== "all") {
        result = result.filter(u => u.status === input.statusFilter);
      }

      return {
        users: result,
        total: result.length,
        stats: {
          totalStaff: staffUsers.length,
          adminCount: staffUsers.filter(u => u.role === "admin").length,
          activeCount: staffUsers.filter(u => !u.email.startsWith("resigned_") && !u.email.startsWith("disabled_")).length,
          disabledCount: staffUsers.filter(u => u.email.startsWith("resigned_") || u.email.startsWith("disabled_")).length,
        },
      };
    }),

  // Update user role
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      newRole: z.enum(["admin", "user"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Prevent self-demotion
      if (ctx.user.id === input.userId && input.newRole !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "自分自身のロールを降格することはできません / 不能降级自己的权限" });
      }

      await db.update(users).set({ role: input.newRole }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Disable user account (prefix email with disabled_{id}_)
  disable: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Prevent self-disable
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "自分自身のアカウントを無効化することはできません / 不能禁用自己的账号" });
      }

      // Check if already disabled
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (user.email.startsWith("disabled_") || user.email.startsWith("resigned_")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "アカウントは既に無効化されています / 账号已经被禁用" });
      }

      // Disable by prefixing email
      await db.execute(sql`UPDATE users SET email = CONCAT('disabled_', id, '_', email), role = 'user' WHERE id = ${input.userId}`);
      return { success: true };
    }),

  // Enable (re-activate) user account
  enable: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      if (!user.email.startsWith("disabled_") && !user.email.startsWith("resigned_")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "アカウントは既にアクティブです / 账号已经是活跃状态" });
      }

      // Restore original email
      let originalEmail = user.email;
      if (user.email.startsWith("resigned_")) {
        const match = user.email.match(/^resigned_\d+_(.+)$/);
        if (match) originalEmail = match[1];
      } else if (user.email.startsWith("disabled_")) {
        const match = user.email.match(/^disabled_\d+_(.+)$/);
        if (match) originalEmail = match[1];
      }

      await db.update(users).set({ email: originalEmail }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Delete user account
  delete: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Prevent self-deletion
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "自分自身のアカウントを削除することはできません / 不能删除自己的账号" });
      }

      await db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
