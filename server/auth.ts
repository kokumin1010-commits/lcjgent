import bcrypt from "bcrypt";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createUser, getUserByEmail, getUserById, updateUserLastSignedIn } from "./db";
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

      // Create JWT token
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);

      // Set cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

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
});
