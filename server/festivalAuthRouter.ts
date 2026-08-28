/**
 * Live Commerce Festival - アカウント認証ルーター
 * - フォーム送信時の自動アカウント作成
 * - メール+パスワードでのログイン
 * - JWTトークンベースのセッション管理
 */
import { router, publicProcedure, t } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { festivalAccounts, festivalActivityLogs, festivalPasswordResetTokens } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import * as crypto from "crypto";
import * as jose from "jose";

// Helper: parse cookie from request header (no cookie-parser middleware)
function getCookie(req: any, name: string): string | undefined {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c: string) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=').trim();
}

// Auto-migration: ensure the LCF account and recovery schema is ready before use.
let migrationDone = false;
let migrationPromise: Promise<void> | null = null;
async function ensureFestivalAdminSchema(): Promise<void> {
  if (migrationDone) return;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      console.log("[LCF] No DATABASE_URL, skip migration");
      migrationDone = true;
      return;
    }
    let conn: any = null;
    try {
      const mysql = await import("mysql2/promise");
      conn = await (mysql as any).createConnection(process.env.DATABASE_URL);
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS festival_accounts (
          id int AUTO_INCREMENT NOT NULL,
          email varchar(320) NOT NULL,
          password_hash varchar(255) NOT NULL,
          account_type enum('company','liver','general','admin') NOT NULL,
          role enum('applicant','admin') NOT NULL DEFAULT 'applicant',
          application_id int NULL,
          display_name varchar(255) NOT NULL,
          is_active tinyint(1) NOT NULL DEFAULT 1,
          auth_version int NOT NULL DEFAULT 1,
          last_login_at timestamp NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_email (email)
        )
      `);
      try {
        await conn.execute(`ALTER TABLE festival_accounts ADD COLUMN role ENUM('applicant', 'admin') NOT NULL DEFAULT 'applicant' AFTER account_type`);
      } catch (e: any) { /* column already exists */ }
      try {
        await conn.execute(`ALTER TABLE festival_accounts ADD COLUMN auth_version INT NOT NULL DEFAULT 1 AFTER is_active`);
      } catch (e: any) { /* column already exists */ }
      try {
        await conn.execute(`ALTER TABLE festival_accounts MODIFY COLUMN account_type ENUM('company','liver','general','admin') NOT NULL`);
      } catch (e: any) { /* ignore */ }
      try {
        await conn.execute(`ALTER TABLE festival_accounts MODIFY COLUMN application_id INT NULL`);
      } catch (e: any) { /* ignore */ }
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS festival_password_reset_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          account_id INT NOT NULL,
          token_hash VARCHAR(64) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_festival_password_reset_token_hash (token_hash),
          INDEX idx_festival_password_reset_account_active (account_id, used_at, expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      migrationDone = true;
      console.log("[LCF] festival account and password-reset schema ensured");
    } catch (error: any) {
      migrationPromise = null;
      console.error("[LCF] Migration failed:", error.message);
      throw error;
    } finally {
      if (conn) try { await conn.end(); } catch (_) {}
    }
  })();
  return migrationPromise;
}
// Run migration on import.
ensureFestivalAdminSchema().catch(() => {});

// Versioned PBKDF2 hashing. Existing unversioned 10k hashes remain valid and are
// upgraded naturally on password change/reset.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 64, "sha512").toString("hex");
  return `v2:${salt}:${hash}`;
}

const FESTIVAL_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const FESTIVAL_RESET_GENERIC_MESSAGE = "メールアドレスが登録されている場合、パスワードリセット用リンクを送信しました。";

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  const isV2 = parts[0] === "v2";
  const salt = isV2 ? parts[1] : parts[0];
  const expected = isV2 ? parts[2] : parts[1];
  if (!salt || !expected) return false;
  const iterations = isV2 ? 210000 : 10000;
  const actual = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

const authRateLimits = new Map<string, { count: number; resetAt: number }>();
let lastAuthRateLimitCleanup = 0;
function enforceRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now();
  if (now - lastAuthRateLimitCleanup > 10 * 60_000) {
    for (const [storedKey, value] of authRateLimits) {
      if (value.resetAt <= now) authRateLimits.delete(storedKey);
    }
    lastAuthRateLimitCleanup = now;
  }
  const current = authRateLimits.get(key);
  if (!current || current.resetAt <= now) {
    authRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > maxAttempts) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "試行回数が多すぎます。時間をおいて再度お試しください。" });
  }
}

// Generate a strong random password without ambiguous characters.
export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars[crypto.randomInt(chars.length)];
  }
  return password;
}

// JWT helpers
const jwtSecretValue = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "local-development-only-secret-change-me");
if (jwtSecretValue.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);

export async function createFestivalToken(accountId: number, email: string, accountType: string, role?: string, authVersion = 1): Promise<string> {
  return await new jose.SignJWT({ accountId, email, accountType, role: role || "applicant", authVersion, scope: "festival" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyFestivalToken(token: string): Promise<{ accountId: number; email: string; accountType: string; role?: string; authVersion: number } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (payload.scope !== "festival") return null;
    return {
      accountId: payload.accountId as number,
      email: payload.email as string,
      accountType: payload.accountType as string,
      role: (payload.role as string) || "applicant",
      authVersion: Number(payload.authVersion || 1),
    };
  } catch {
    return null;
  }
}

export async function verifyFestivalUserRequest(req: any): Promise<{ accountId: number; email: string; accountType: string; role: string } | null> {
  await ensureFestivalAdminSchema();
  const token = getCookie(req, 'lcf_token');
  const payload = token ? await verifyFestivalToken(token) : null;
  if (!payload) return null;
  const db = await getDb();
  if (!db) return null;
  const [account] = await db.select({
    id: festivalAccounts.id,
    email: festivalAccounts.email,
    accountType: festivalAccounts.accountType,
    role: festivalAccounts.role,
    isActive: festivalAccounts.isActive,
    authVersion: festivalAccounts.authVersion,
  }).from(festivalAccounts)
    .where(eq(festivalAccounts.id, payload.accountId))
    .limit(1);
  if (!account || !account.isActive || account.email.toLowerCase() !== payload.email.toLowerCase() || account.authVersion !== payload.authVersion) return null;
  return { accountId: account.id, email: account.email, accountType: account.accountType, role: account.role || 'applicant' };
}

export async function verifyFestivalAdminRequest(req: any, mainUser?: any): Promise<{ id: number; email: string } | null> {
  if (mainUser?.role === 'admin') {
    return { id: Number(mainUser.id || 0), email: String(mainUser.email || 'main-admin') };
  }
  const account = await verifyFestivalUserRequest(req);
  if (!account || account.role !== 'admin') return null;
  return { id: account.accountId, email: account.email };
}

const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  await ensureFestivalAdminSchema();
  const admin = await verifyFestivalAdminRequest(ctx.req, (ctx as any).user);
  if (!admin) throw new TRPCError({ code: 'UNAUTHORIZED', message: '管理者権限が必要です' });
  return next({ ctx: { ...ctx, lcfAdmin: admin } });
});

// Create admin account helper
export async function createFestivalAdminAccount(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ success: boolean; accountId?: number; error?: string }> {
  await ensureFestivalAdminSchema();
  const db = await getDb();
  if (!db) return { success: false, error: "DB接続エラー" };

  const existing = await db.select().from(festivalAccounts)
    .where(eq(festivalAccounts.email, params.email))
    .limit(1);

  if (existing.length > 0) {
    // Upgrade existing account to admin
    await db.update(festivalAccounts)
      .set({ role: "admin", accountType: "admin" })
      .where(eq(festivalAccounts.id, existing[0].id));
    return { success: true, accountId: existing[0].id };
  }

  const passwordHash = hashPassword(params.password);
  const result = await db.insert(festivalAccounts).values({
    email: params.email,
    passwordHash,
    accountType: "admin",
    role: "admin",
    applicationId: null,
    displayName: params.displayName,
    isActive: true,
  });

  return { success: true, accountId: (result as any)[0]?.insertId || 0 };
}

// Create account helper (called from festivalRouter on form submission)
export async function createFestivalAccount(params: {
  email: string;
  accountType: "company" | "liver" | "general";
  applicationId: number;
  displayName: string;
}): Promise<{ password: string; accountId: number } | null> {
  await ensureFestivalAdminSchema();
  const db = await getDb();
  if (!db) return null;

  // Check if email already exists
  const existing = await db.select().from(festivalAccounts)
    .where(eq(festivalAccounts.email, params.email))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    // A single account currently has one primary application type. Never point an
    // existing account at another table while leaving accountType unchanged.
    if (current.role !== "admin" && current.accountType === params.accountType) {
      await db.update(festivalAccounts)
        .set({ applicationId: params.applicationId, displayName: params.displayName })
        .where(eq(festivalAccounts.id, current.id));
    }
    return null; // Keep the existing password and primary account link.
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
      email: z.string().trim().toLowerCase().email("有効なメールアドレスを入力してください").max(320),
      password: z.string().min(1, "パスワードを入力してください").max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || ctx.req?.socket?.remoteAddress || 'unknown';
      enforceRateLimit(`login:${ip}:${input.email.toLowerCase()}`, 10, 15 * 60 * 1000);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // Ensure role column exists
      if (!migrationDone) await ensureFestivalAdminSchema();

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
      // Log activity
      try {
        const ipAddress = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || null;
        const userAgent = ctx.req?.headers?.['user-agent']?.substring(0, 500) || null;
        await db.insert(festivalActivityLogs).values({
          accountId: account.id,
          accountEmail: account.email,
          accountType: account.accountType as any,
          action: 'login',
          details: null,
          ipAddress,
          userAgent,
        });
      } catch (e) { console.error('[LCF ActivityLog] login log failed:', e); }

      const token = await createFestivalToken(account.id, account.email, account.accountType, account.role, account.authVersion);

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
      };
    }),

  // 自分の情報取得
  me: publicProcedure
    .query(async ({ ctx }) => {
      let token = getCookie(ctx.req, 'lcf_token');
      // Fallback: check Authorization header (for mobile browsers with cookie issues)
      if (!token) {
        const authHeader = ctx.req?.headers?.['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      if (!token) return null;

      const payload = await verifyFestivalToken(token);
      if (!payload) return null;

      await ensureFestivalAdminSchema();
      const db = await getDb();
      if (!db) return null;

      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);

      if (!account || !account.isActive || account.authVersion !== payload.authVersion) return null;

      return {
        id: account.id,
        email: account.email,
        accountType: account.accountType,
        role: account.role,
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
      newPassword: z.string().min(12, "パスワードは12文字以上にしてください").max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      let token = getCookie(ctx.req, 'lcf_token');
      if (!token) {
        const authHeader = ctx.req?.headers?.['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
      }
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください" });

      const payload = await verifyFestivalToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });

      await ensureFestivalAdminSchema();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);

      if (!account || !account.isActive || account.authVersion !== payload.authVersion) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です。再度ログインしてください" });
      }

      if (!verifyPassword(input.currentPassword, account.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "現在のパスワードが正しくありません" });
      }

      const newHash = hashPassword(input.newPassword);
      const nextAuthVersion = account.authVersion + 1;
      await db.update(festivalAccounts)
        .set({ passwordHash: newHash, authVersion: nextAuthVersion })
        .where(eq(festivalAccounts.id, account.id));
      const refreshedToken = await createFestivalToken(account.id, account.email, account.accountType, account.role, nextAuthVersion);
      if (ctx.res) {
        ctx.res.cookie("lcf_token", refreshedToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: "/",
        });
      }

      return { success: true, message: "パスワードを変更しました" };
    }),

  // 管理者アカウント作成（既存管理者のみ）
  createAdmin: festivalAdminProcedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email("有効なメールアドレスを入力してください").max(320),
      password: z.string().min(12, "パスワードは12文字以上にしてください").max(200),
      displayName: z.string().trim().min(1, "名前を入力してください").max(255),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // Ensure role column exists before proceeding
      migrationDone = false;
      await ensureFestivalAdminSchema();

      const result = await createFestivalAdminAccount({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return { success: true, accountId: result.accountId };
    }),

  // アカウント一覧（管理者用 - LCF admin認証対応）
  listAccounts: festivalAdminProcedure
    .input(z.object({
      accountType: z.enum(["company", "liver", "general", "admin"]).optional(),
    }).optional())
    .query(async ({ input }) => {
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

  // パスワードリセット（管理者用）- 新しいパスワードを生成して返す
  resetPassword: festivalAdminProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, input.accountId))
        .limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "アカウントが見つかりません" });

      const newPassword = generatePassword();
      const newHash = hashPassword(newPassword);
      await db.update(festivalAccounts)
        .set({ passwordHash: newHash, authVersion: account.authVersion + 1 })
        .where(eq(festivalAccounts.id, input.accountId));
      // Log activity
      try {
        const adminEmail = (ctx as any).lcfAdmin?.email || (ctx as any).user?.email || 'system';
        const ipAddress = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || null;
        const userAgent = ctx.req?.headers?.['user-agent']?.substring(0, 500) || null;
        await db.insert(festivalActivityLogs).values({
          accountId: account.id,
          accountEmail: account.email,
          accountType: account.accountType as any,
          action: 'password_reset',
          details: JSON.stringify({ resetBy: adminEmail }),
          ipAddress,
          userAgent,
        });
      } catch (e) { console.error('[LCF ActivityLog] password_reset log failed:', e); }
      return { success: true, email: account.email, newPassword };
    }),
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(320) }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || ctx.req?.socket?.remoteAddress || 'unknown';
      enforceRateLimit(`forgot-ip:${ip}`, 20, 60 * 60 * 1000);
      enforceRateLimit(`forgot:${ip}:${input.email}`, 5, 60 * 60 * 1000);
      await ensureFestivalAdminSchema();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.email, input.email))
        .limit(1);
      if (!account || !account.isActive) return { success: true, message: FESTIVAL_RESET_GENERIC_MESSAGE };

      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + FESTIVAL_RESET_TOKEN_TTL_MS);
      if (!process.env.DATABASE_URL) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const mysql = await import("mysql2/promise");
      const tokenConnection = await (mysql as any).createConnection(process.env.DATABASE_URL);
      try {
        await tokenConnection.beginTransaction();
        await tokenConnection.execute(`SELECT id FROM festival_accounts WHERE id = ? AND is_active = 1 FOR UPDATE`, [account.id]);
        await tokenConnection.execute(
          `UPDATE festival_password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL`,
          [account.id],
        );
        await tokenConnection.execute(
          `INSERT INTO festival_password_reset_tokens (account_id, token_hash, expires_at) VALUES (?, ?, ?)`,
          [account.id, tokenHash, expiresAt],
        );
        await tokenConnection.commit();
      } catch (error) {
        await tokenConnection.rollback().catch(() => undefined);
        throw error;
      } finally {
        await tokenConnection.end();
      }

      const resetUrl = `https://www.livecommercefestival.com/lcf/reset-password?token=${encodeURIComponent(rawToken)}`;
      try {
        const { sendEmail } = await import("./emailService");
        const sent = await sendEmail({
          to: [account.email],
          subject: "【LCF 2026】パスワード再設定のご案内",
          content: `Live Commerce Festival 2026\n\nパスワード再設定のリクエストを受け付けました。\n以下のリンクから1時間以内に新しいパスワードを設定してください。\n\n${resetUrl}\n\nこのリンクは一度だけ使用できます。心当たりがない場合は、このメールを破棄してください。`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#f59e0b;">Live Commerce Festival 2026</h2>
            <p>パスワード再設定のリクエストを受け付けました。</p>
            <p>以下のボタンから1時間以内に新しいパスワードを設定してください。</p>
            <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">新しいパスワードを設定する</a>
            <p style="color:#6b7280;font-size:13px;">このリンクは一度だけ使用できます。心当たりがない場合は、このメールを破棄してください。</p>
          </div>`,
        });
        if (!sent.success) throw new Error(sent.error || "メール送信に失敗しました");
        await db.insert(festivalActivityLogs).values({
          accountId: account.id,
          accountEmail: account.email,
          accountType: account.accountType as any,
          action: "password_reset_requested",
          details: JSON.stringify({ delivery: "email_link", expiresInMinutes: 60 }),
          ipAddress: ip === "unknown" ? null : ip,
          userAgent: ctx.req?.headers?.['user-agent']?.substring(0, 500) || null,
        }).catch((error) => console.error("[LCF] password reset request audit failed:", error));
      } catch (error) {
        await db.update(festivalPasswordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(festivalPasswordResetTokens.tokenHash, tokenHash));
        console.error("[LCF] forgotPassword email failed; reset token invalidated:", error);
      }
      return { success: true, message: FESTIVAL_RESET_GENERIC_MESSAGE };
    }),

  verifyPasswordResetToken: publicProcedure
    .input(z.object({ token: z.string().min(32).max(200) }))
    .query(async ({ input, ctx }) => {
      const ip = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || ctx.req?.socket?.remoteAddress || 'unknown';
      enforceRateLimit(`verify-reset:${ip}`, 40, 60 * 60 * 1000);
      await ensureFestivalAdminSchema();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const [resetToken] = await db.select().from(festivalPasswordResetTokens)
        .where(eq(festivalPasswordResetTokens.tokenHash, hashResetToken(input.token)))
        .limit(1);
      const valid = Boolean(resetToken && !resetToken.usedAt && resetToken.expiresAt.getTime() > Date.now());
      return valid
        ? { valid: true as const }
        : { valid: false as const, message: "このリンクは無効、使用済み、または有効期限切れです。" };
    }),

  resetPasswordWithToken: publicProcedure
    .input(z.object({
      token: z.string().min(32).max(200),
      newPassword: z.string().min(12, "パスワードは12文字以上にしてください").max(128)
        .regex(/[A-Za-z]/, "英字を1文字以上含めてください")
        .regex(/[0-9]/, "数字を1文字以上含めてください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || ctx.req?.socket?.remoteAddress || 'unknown';
      enforceRateLimit(`reset-password:${ip}`, 10, 60 * 60 * 1000);
      await ensureFestivalAdminSchema();
      if (!process.env.DATABASE_URL) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const mysql = await import("mysql2/promise");
      const connection = await (mysql as any).createConnection(process.env.DATABASE_URL);
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          `SELECT token.id, token.account_id, token.expires_at, token.used_at,
                  account.email, account.account_type, account.is_active
             FROM festival_password_reset_tokens token
             JOIN festival_accounts account ON account.id = token.account_id
            WHERE token.token_hash = ?
            LIMIT 1 FOR UPDATE`,
          [hashResetToken(input.token)],
        );
        const record = (rows as any[])[0];
        if (!record || record.used_at || new Date(record.expires_at).getTime() <= Date.now() || !record.is_active) {
          await connection.rollback();
          throw new TRPCError({ code: "BAD_REQUEST", message: "このリンクは無効、使用済み、または有効期限切れです。" });
        }
        const newHash = hashPassword(input.newPassword);
        await connection.execute(
          `UPDATE festival_accounts SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ? AND is_active = 1`,
          [newHash, record.account_id],
        );
        await connection.execute(
          `UPDATE festival_password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL`,
          [record.account_id],
        );
        await connection.execute(
          `INSERT INTO festival_activity_logs
            (account_id, account_email, account_type, action, details, ip_address, user_agent)
           VALUES (?, ?, ?, 'password_reset_completed', ?, ?, ?)`,
          [
            record.account_id,
            record.email,
            record.account_type,
            JSON.stringify({ method: "email_reset_link", allSessionsRevoked: true }),
            ip === "unknown" ? null : ip,
            ctx.req?.headers?.['user-agent']?.substring(0, 500) || null,
          ],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        await connection.end();
      }
      if (ctx.res) {
        ctx.res.cookie("lcf_token", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
      }
      return { success: true, message: "パスワードを再設定しました。新しいパスワードでログインしてください。" };
    }),
});
