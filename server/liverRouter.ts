import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import {
  createLiver,
  getLiverByEmail,
  getLiverById,
  getAllActiveLivers,
  updateLiver,
  updateLiverLastLogin,
  checkLiverEmailExists,
  getSchedulesByLiverId,
  createSchedule,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "./db";

// Helper function to get liver token from Authorization header or cookie
function getLiverToken(ctx: { req: { headers: { authorization?: string }; cookies?: { liver_session?: string } } }): string | null {
  // First try Authorization header (for localStorage-based auth)
  const authHeader = ctx.req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Fallback to cookie (for backward compatibility)
  return ctx.req.cookies?.liver_session || null;
}

// Helper function to verify liver token and get liver info
async function verifyLiverToken(token: string): Promise<{ liverId: number; type: string } | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    if (!payload || payload.type !== "liver") return null;
    return { liverId: payload.liverId as number, type: payload.type as string };
  } catch {
    return null;
  }
}

export const liverRouter = router({
  // Register a new liver account
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if email already exists
      const exists = await checkLiverEmailExists(input.email);
      if (exists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このメールアドレスは既に登録されています",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create liver
      const liverId = await createLiver({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        color: input.color || "#FF69B4",
      });

      // Get the created liver
      const liver = await getLiverById(liverId);
      if (!liver) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "アカウントの作成に失敗しました",
        });
      }

      // Generate JWT token
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ liverId: liver.id, type: "liver" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("365d")
        .sign(secret);

      // Update last login
      await updateLiverLastLogin(liver.id);

      return {
        success: true,
        token, // Return token in response body for localStorage storage
        liver: {
          id: liver.id,
          name: liver.name,
          email: liver.email,
          color: liver.color,
        },
      };
    }),

  // Login
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const liver = await getLiverByEmail(input.email);
      if (!liver) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが間違っています",
        });
      }

      // Check password
      const isValid = await bcrypt.compare(input.password, liver.password);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが間違っています",
        });
      }

      // Check if active
      if (!liver.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "このアカウントは無効化されています",
        });
      }

      // Generate JWT token
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ liverId: liver.id, type: "liver" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("365d")
        .sign(secret);

      // Update last login
      await updateLiverLastLogin(liver.id);

      return {
        success: true,
        token, // Return token in response body for localStorage storage
        liver: {
          id: liver.id,
          name: liver.name,
          email: liver.email,
          color: liver.color,
          avatarUrl: liver.avatarUrl,
        },
      };
    }),

  // Logout
  logout: publicProcedure.mutation(async () => {
    // Client will clear localStorage
    return { success: true };
  }),

  // Get current liver (check session)
  me: publicProcedure.query(async ({ ctx }) => {
    const token = getLiverToken(ctx);
    if (!token) return null;

    const payload = await verifyLiverToken(token);
    if (!payload) return null;

    const liver = await getLiverById(payload.liverId);
    if (!liver || !liver.isActive) return null;

    return {
      id: liver.id,
      name: liver.name,
      email: liver.email,
      color: liver.color,
      avatarUrl: liver.avatarUrl,
      bio: liver.bio,
      role: liver.role,
      tiktokAccount: liver.tiktokAccount,
      instagramAccount: liver.instagramAccount,
      youtubeAccount: liver.youtubeAccount,
      otherAccount: liver.otherAccount,
      lineUserId: liver.lineUserId,
      lineNotificationEnabled: liver.lineNotificationEnabled,
    };
  }),

  // Get all active livers (for calendar display)
  listActive: publicProcedure.query(async () => {
    const livers = await getAllActiveLivers();
    return livers.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      avatarUrl: l.avatarUrl,
    }));
  }),

  // Update liver profile
  updateProfile: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        bio: z.string().optional(),
        tiktokAccount: z.string().optional(),
        instagramAccount: z.string().optional(),
        youtubeAccount: z.string().optional(),
        otherAccount: z.string().optional(),
        lineNotificationEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await updateLiver(payload.liverId, input);
      return { success: true };
    }),

  // Create schedule (liver authenticated)
  createSchedule: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startTime: z.string(),
        endTime: z.string().optional(),
        isAllDay: z.boolean().optional(),
        category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }

      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }

      const liver = await getLiverById(payload.liverId);
      if (!liver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ライバーが見つかりません" });
      }

      const schedule = await createSchedule({
        title: input.title,
        description: input.description,
        startTime: new Date(input.startTime),
        endTime: input.endTime ? new Date(input.endTime) : undefined,
        isAllDay: input.isAllDay || false,
        category: input.category || "other",
        liverId: liver.id,
        liverName: liver.name,
        notes: input.notes,
      });
      return schedule;
    }),

  // Update schedule (only own schedules)
  updateSchedule: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        isAllDay: z.boolean().optional(),
        category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }

      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }

      // Check if the schedule belongs to this liver
      const schedule = await getScheduleById(input.id);
      if (!schedule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "スケジュールが見つかりません" });
      }

      // Check ownership (admin can edit any)
      const liver = await getLiverById(payload.liverId);
      if (schedule.liverId !== payload.liverId && liver?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "他のライバーのスケジュールは編集できません" });
      }

      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
      if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
      if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.notes !== undefined) updateData.notes = data.notes;

      await updateSchedule(id, updateData);
      return { success: true };
    }),

  // Delete schedule (only own schedules)
  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }

      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }

      // Check if the schedule belongs to this liver
      const schedule = await getScheduleById(input.id);
      if (!schedule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "スケジュールが見つかりません" });
      }

      // Check ownership (admin can delete any)
      const liver = await getLiverById(payload.liverId);
      if (schedule.liverId !== payload.liverId && liver?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "他のライバーのスケジュールは削除できません" });
      }

      await deleteSchedule(input.id);
      return { success: true };
    }),

  // Get my schedules
  getMySchedules: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) return [];

      const payload = await verifyLiverToken(token);
      if (!payload) return [];

      const startDate = input.startDate ? new Date(input.startDate) : undefined;
      const endDate = input.endDate ? new Date(input.endDate) : undefined;
      return await getSchedulesByLiverId(payload.liverId, startDate, endDate);
    }),

  // Generate LINE link code
  generateLineLinkCode: publicProcedure
    .mutation(async ({ ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const { generateLinkCode, saveLinkCodeForLiver } = await import("./lineWebhook");
      const linkCode = generateLinkCode();
      await saveLinkCodeForLiver(payload.liverId, linkCode);

      return { linkCode, expiresIn: 600 }; // 10 minutes
    }),

  // Unlink LINE account
  unlinkLine: publicProcedure
    .mutation(async ({ ctx }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await updateLiver(payload.liverId, {
        lineUserId: null,
        lineLinkCode: null,
        lineLinkCodeExpiresAt: null,
      });

      return { success: true };
    }),
});
