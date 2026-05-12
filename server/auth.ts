import bcrypt from "bcrypt";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createUser, getUserByEmail, getUserById, updateUserLastSignedIn, createUserPasswordResetToken, getUserPasswordResetToken, markUserPasswordResetTokenUsed, updateUserPassword, getActiveStaff } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

const SALT_ROUNDS = 10;

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("有効なメールアドレスを入力してください"),
        password: z.string().min(6, "パスワードは6文字以上である必要があります"),
        name: z.string().min(1, "名前を入力してください"),
      })
    )
    .mutation(async ({ input }) => {
      const existingUser = await getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このメールアドレスは既に登録されています",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

      await createUser({
        email: input.email,
        password: hashedPassword,
        name: input.name,
        role: "user",
      });

      return { success: true };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("有効なメールアドレスを入力してください"),
        password: z.string().min(1, "パスワードを入力してください"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        });
      }

      const isPasswordValid = await bcrypt.compare(input.password, user.password);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        });
      }

      await updateUserLastSignedIn(user.id);

      // Auto-promote to admin if user is in staff table
      if (user.role !== 'admin') {
        try {
          const activeStaff = await getActiveStaff();
          const isStaffMember = activeStaff.some(
            (s: any) => s.email.toLowerCase() === input.email.toLowerCase()
          );
          if (isStaffMember) {
            const db = await getDb();
            if (db) {
              await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
              user.role = 'admin' as any;
              console.log(`[Auth] Auto-promoted staff member to admin: ${input.email}`);
            }
          }
        } catch (e) {
          console.error('[Auth] Failed to check staff auto-promote:', e);
        }
      }

      // Create JWT token (10 years expiration for persistent login)
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("3650d") // 10 years session for persistent login
        .sign(secret);

      // Set cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 3650 * 24 * 60 * 60 * 1000, // 10 years in milliseconds
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  me: publicProcedure.query(({ ctx }) => ctx.user),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // Request password reset
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      
      // Always return success to not reveal if email exists
      if (!user) {
        return {
          success: true,
          message: "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました",
        };
      }
      
      // Generate token
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Save token to database
      await createUserPasswordResetToken(user.id, input.email, token, expiresAt);
      
      // Send email with reset link
      const resetUrl = `${process.env.APP_URL || 'https://lcjmall.com'}/reset-password-admin?token=${token}`;
      
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        
        await transporter.sendMail({
          from: `"業務自動化システム" <${process.env.SMTP_USER}>`,
          to: input.email,
          subject: "【業務自動化システム】パスワードリセットのご案内",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">パスワードリセットのご案内</h2>
              <p>${user.name || 'お客'}様</p>
              <p>業務自動化システムのパスワードリセットをリクエストいただきました。</p>
              <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
              <p style="margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  パスワードをリセットする
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">このリンクは1時間後に無効になります。</p>
              <p style="color: #666; font-size: 14px;">このメールに心当たりがない場合は、無視してください。</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">業務自動化システム</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
      }
      
      return {
        success: true,
        message: "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました",
      };
    }),

  // Verify password reset token
  verifyPasswordResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const resetToken = await getUserPasswordResetToken(input.token);
      
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
      const resetToken = await getUserPasswordResetToken(input.token);
      
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
      const hashedPassword = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
      
      // Update user password
      await updateUserPassword(resetToken.userId, hashedPassword);
      
      // Mark token as used
      await markUserPasswordResetTokenUsed(resetToken.id);
      
      return {
        success: true,
        message: "パスワードが正常にリセットされました",
      };
    }),
});
