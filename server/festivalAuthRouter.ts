/**
 * Live Commerce Festival - アカウント認証ルーター
 * - フォーム送信時の自動アカウント作成
 * - メール+パスワードでのログイン
 * - JWTトークンベースのセッション管理
 */
import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { festivalAccounts } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";
import * as jose from "jose";

// Simple password hashing (bcrypt alternative without native deps)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return hash === verify;
}

// Generate random password (8 chars, alphanumeric)
export function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars[crypto.randomInt(chars.length)];
  }
  return password;
}

// JWT helpers
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "lcf-secret-key-2026");

export async function createFestivalToken(accountId: number, email: string, accountType: string): Promise<string> {
  return await new jose.SignJWT({ accountId, email, accountType, scope: "festival" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyFestivalToken(token: string): Promise<{ accountId: number; email: string; accountType: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (payload.scope !== "festival") return null;
    return {
      accountId: payload.accountId as number,
      email: payload.email as string,
      accountType: payload.accountType as string,
    };
  } catch {
    return null;
  }
}

// Create account helper (called from festivalRouter on form submission)
export async function createFestivalAccount(params: {
  email: string;
  accountType: "company" | "liver" | "general";
  applicationId: number;
  displayName: string;
}): Promise<{ password: string; accountId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  // Check if email already exists
  const existing = await db.select().from(festivalAccounts)
    .where(eq(festivalAccounts.email, params.email))
    .limit(1);

  if (existing.length > 0) {
    // Account already exists - update application link
    await db.update(festivalAccounts)
      .set({ applicationId: params.applicationId, displayName: params.displayName })
      .where(eq(festivalAccounts.id, existing[0].id));
    return null; // Don't generate new password
  }

  const password = generatePassword();
  const passwordHash = hashPassword(password);

  const result = await db.insert(festivalAccounts).values({
    email: params.email,
    passwordHash,
    accountType: params.accountType,
    applicationId: params.applicationId,
    displayName: params.displayName,
    isActive: true,
  });

  return { password, accountId: (result as any)[0]?.insertId || 0 };
}

export const festivalAuthRouter = router({
  // ログイン
  login: publicProcedure
    .input(z.object({
      email: z.string().email("有効なメールアドレスを入力してください"),
      password: z.string().min(1, "パスワードを入力してください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.email, input.email))
        .limit(1);

      if (!account) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "メールアドレスまたはパスワードが正しくありません" });
      }

      if (!account.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "このアカウントは無効化されています" });
      }

      if (!verifyPassword(input.password, account.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "メールアドレスまたはパスワードが正しくありません" });
      }

      // Update last login
      await db.update(festivalAccounts)
        .set({ lastLoginAt: new Date() })
        .where(eq(festivalAccounts.id, account.id));

      const token = await createFestivalToken(account.id, account.email, account.accountType);

      // Set cookie
      if (ctx.res) {
        ctx.res.cookie("lcf_token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          path: "/",
        });
      }

      return {
        success: true,
        account: {
          id: account.id,
          email: account.email,
          accountType: account.accountType,
          displayName: account.displayName,
        },
        token,
      };
    }),

  // 自分の情報取得
  me: publicProcedure
    .query(async ({ ctx }) => {
      const token = (ctx.req as any)?.cookies?.lcf_token;
      if (!token) return null;

      const payload = await verifyFestivalToken(token);
      if (!payload) return null;

      const db = await getDb();
      if (!db) return null;

      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);

      if (!account || !account.isActive) return null;

      return {
        id: account.id,
        email: account.email,
        accountType: account.accountType,
        displayName: account.displayName,
        applicationId: account.applicationId,
      };
    }),

  // ログアウト
  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.res) {
        ctx.res.cookie("lcf_token", "", {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 0,
          path: "/",
        });
      }
      return { success: true };
    }),

  // パスワード変更
  changePassword: publicProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, "パスワードは6文字以上にしてください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = (ctx.req as any)?.cookies?.lcf_token;
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください" });

      const payload = await verifyFestivalToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);

      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      if (!verifyPassword(input.currentPassword, account.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "現在のパスワードが正しくありません" });
      }

      const newHash = hashPassword(input.newPassword);
      await db.update(festivalAccounts)
        .set({ passwordHash: newHash })
        .where(eq(festivalAccounts.id, account.id));

      return { success: true, message: "パスワードを変更しました" };
    }),

  // アカウント一覧（管理者用）
  listAccounts: publicProcedure
    .input(z.object({
      accountType: z.enum(["company", "liver", "general"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      // Admin check via main auth
      if (!(ctx as any).user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input?.accountType) conditions.push(eq(festivalAccounts.accountType, input.accountType));

      const result = await db.select({
        id: festivalAccounts.id,
        email: festivalAccounts.email,
        accountType: festivalAccounts.accountType,
        displayName: festivalAccounts.displayName,
        isActive: festivalAccounts.isActive,
        lastLoginAt: festivalAccounts.lastLoginAt,
        createdAt: festivalAccounts.createdAt,
      }).from(festivalAccounts)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return result;
    }),
});
