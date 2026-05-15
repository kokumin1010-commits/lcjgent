import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
  createLiverPasswordResetToken,
  getLiverPasswordResetToken,
  markLiverPasswordResetTokenUsed,
  updateLiverPassword,
  getLiverGoal,
  upsertLiverGoal,
  getLiverDashboardStats,
  getOrCreateReferralCode,
  getReferralStats,
  isLiverAitherhubLinked,
  getLiverMonthlyProducts,
  getLiverBrandDurationStats,
  getLiverRecentHourlyRate,
  getMegaChannelSettings,
  getMegaChannelQualification,
  checkAndUpdateMegaChannelQualification,
} from "./db";
import { nanoid } from "nanoid";
import nodemailer from "nodemailer";

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
        agencyCode: z.string().optional(), // 事務所コード（loginId）でagencyId自動紐付け
        tiktokAccount: z.string().optional(),
        instagramAccount: z.string().optional(),
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

      // Resolve agencyId from agencyCode if provided
      let agencyId: number | null = null;
      if (input.agencyCode) {
        const { eq } = await import("drizzle-orm");
        const { agencies } = await import("../drizzle/schema");
        const { getDb: getDbFn } = await import("./db");
        const db = await getDbFn();
        if (db) {
          const results = await db.select().from(agencies).where(eq(agencies.loginId, input.agencyCode)).limit(1);
          if (results[0] && results[0].isActive) {
            agencyId = results[0].id;
          }
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create liver
      const liverId = await createLiver({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        color: input.color || "#FF69B4",
        ...(agencyId ? { agencyId } : {}),
        ...(input.tiktokAccount ? { tiktokAccount: input.tiktokAccount } : {}),
        ...(input.instagramAccount ? { instagramAccount: input.instagramAccount } : {}),
      });

      // Get the created liver
      const liver = await getLiverById(liverId);
      if (!liver) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "アカウントの作成に失敗しました",
        });
      }

      // Generate JWT token (10 years expiration for persistent login)
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ liverId: liver.id, type: "liver" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("3650d")
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
          role: liver.role || 'liver',
        },
      };
    }),
  // Loginn
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

      // Generate JWT token (10 years expiration for persistent login)
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ liverId: liver.id, type: "liver" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("3650d")
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
          language: liver.language || 'ja',
          role: liver.role || 'liver',
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

    // Aitherhub連携状態を確認
    const aitherhubLinked = await isLiverAitherhubLinked(liver.id);

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
      language: liver.language || 'ja',
      aitherhubLinked,
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
        language: z.enum(['ja', 'zh-TW', 'en']).optional(),
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

      const { generateLiverLinkCode, saveLinkCodeForLiver } = await import("./lineWebhook");
      const linkCode = generateLiverLinkCode();
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

  // Request password reset - sends email with reset link
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      // Find liver by email
      const liver = await getLiverByEmail(input.email);
      if (!liver) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました",
        };
      }
      
      // Generate reset token
      const token = nanoid(64);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Save token to database
      await createLiverPasswordResetToken(liver.id, input.email, token, expiresAt);
      
      // Send email with reset link
      const resetUrl = `${process.env.APP_URL || 'https://lcjmall.com'}/liver/reset-password?token=${token}`;
      
      try {
        // Create transporter
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        
        // Send email
        await transporter.sendMail({
          from: `"LCJスケジュール" <${process.env.SMTP_USER}>`,
          to: input.email,
          subject: "【LCJスケジュール】パスワードリセットのご案内",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ec4899;">パスワードリセットのご案内</h2>
              <p>${liver.name} 様</p>
              <p>パスワードリセットのリクエストを受け付けました。</p>
              <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
              <p style="margin: 24px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(to right, #ec4899, #a855f7); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  パスワードをリセット
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">※ このリンクは1時間有効です。</p>
              <p style="color: #666; font-size: 14px;">※ このメールに心当たりがない場合は、無視してください。</p>
              <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
              <p style="color: #999; font-size: 12px;">LCJスケジュール</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        // Still return success to not reveal email existence
      }
      
      return {
        success: true,
        message: "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました",
      };
    }),

  // Verify password reset token
  verifyResetToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ input }) => {
      const resetToken = await getLiverPasswordResetToken(input.token);
      
      if (!resetToken) {
        return { valid: false, message: "無効なリンクです" };
      }
      
      if (resetToken.usedAt) {
        return { valid: false, message: "このリンクは既に使用されています" };
      }
      
      if (new Date(resetToken.expiresAt) < new Date()) {
        return { valid: false, message: "このリンクは有効期限が切れています" };
      }
      
      return { valid: true, email: resetToken.email };
    }),

  // Reset password with token
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const resetToken = await getLiverPasswordResetToken(input.token);
      
      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "無効なリンクです",
        });
      }
      
      if (resetToken.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "このリンクは既に使用されています",
        });
      }
      
      if (new Date(resetToken.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "このリンクは有効期限が切れています",
        });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      
      // Update password
      await updateLiverPassword(resetToken.liverId, hashedPassword);
      
      // Mark token as used
      await markLiverPasswordResetTokenUsed(resetToken.id);
      
      return { success: true };
    }),

  // ===== Goal Management =====
  
  getGoal: publicProcedure
    .input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .query(async ({ ctx, input }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      
      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
      }
      
      const goal = await getLiverGoal(payload.liverId, input.yearMonth);
      return goal;
    }),

  setGoal: publicProcedure
    .input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      salesGoal: z.number().min(0),
      streamCountGoal: z.number().min(0).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      
      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
      }
      
      const goal = await upsertLiverGoal({
        liverId: payload.liverId,
        yearMonth: input.yearMonth,
        salesGoal: input.salesGoal,
        streamCountGoal: input.streamCountGoal || 0,
        notes: input.notes,
      });
      
      return goal;
    }),

  getDashboardStats: publicProcedure
    .input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .query(async ({ ctx, input }) => {
      const token = getLiverToken(ctx);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      
      const payload = await verifyLiverToken(token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
      }
      
      const stats = await getLiverDashboardStats(payload.liverId, input.yearMonth);
      return stats;
    }),

  // ==========================================
  // 紹介コードシステム (Referral Code System for Livers)
  // ==========================================

  // 紹介コード取得（未作成なら自動生成）
  getMyReferralCode: publicProcedure.query(async ({ ctx }) => {
    const token = getLiverToken(ctx);
    if (!token) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
    }
    const payload = await verifyLiverToken(token);
    if (!payload) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
    }
    const code = await getOrCreateReferralCode(payload.liverId);
    return code;
  }),

  // 紹介統計情報取得
  getReferralStats: publicProcedure.query(async ({ ctx }) => {
    const token = getLiverToken(ctx);
    if (!token) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
    }
    const payload = await verifyLiverToken(token);
    if (!payload) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
    }
    const stats = await getReferralStats(payload.liverId);
    return stats;
  }),

  // ライバーの月別売上商品一覧
  getMonthlyProducts: publicProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ input, ctx }) => {
      const token = getLiverToken(ctx as any);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyLiverToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });
      return await getLiverMonthlyProducts(payload.liverId, input.year, input.month);
    }),

  // ライバーのブランド別配信時間集計
  getBrandDurationStats: publicProcedure
    .input(z.object({
      yearMonth: z.string().optional(), // "2026-04" format
    }))
    .query(async ({ input, ctx }) => {
      const token = getLiverToken(ctx as any);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyLiverToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });
      return await getLiverBrandDurationStats(payload.liverId, input.yearMonth);
    }),

  // メガチャンネル: ライバー自身のステータスを取得
  getMegaChannelStatus: publicProcedure.query(async ({ ctx }) => {
    const token = getLiverToken(ctx as any);
    if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
    const payload = await verifyLiverToken(token);
    if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });
    
    const [settings, qualification, rateData] = await Promise.all([
      getMegaChannelSettings(),
      getMegaChannelQualification(payload.liverId),
      getLiverRecentHourlyRate(payload.liverId, 3),
    ]);
    
    return {
      settings,
      qualification,
      rateData,
      liverId: payload.liverId,
    };
  }),

  // メガチャンネル: 資格チェック・更新
  checkMegaChannelQualification: publicProcedure.mutation(async ({ ctx }) => {
    const token = getLiverToken(ctx as any);
    if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
    const payload = await verifyLiverToken(token);
    if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });
    
    return await checkAndUpdateMegaChannelQualification(payload.liverId);
  }),

  // Admin: Bulk deactivate livers by IDs
  bulkDeactivate: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      let count = 0;
      for (const id of input.ids) {
        await updateLiver(id, { isActive: false } as any);
        count++;
      }
      return { success: true, deactivatedCount: count };
    }),
});
