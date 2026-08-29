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
import { festivalAccounts, festivalActivityLogs, festivalEmailDeliveryLogs, festivalPasswordResetTokens } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS festival_email_delivery_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          account_id INT NOT NULL,
          recipient_hash VARCHAR(64) NOT NULL,
          recipient_domain VARCHAR(255) NOT NULL,
          purpose ENUM('password_reset','password_changed') NOT NULL,
          source ENUM('self_service','mypage','admin') NOT NULL,
          status ENUM('accepted','failed') NOT NULL,
          provider VARCHAR(32) NULL,
          message_id VARCHAR(255) NULL,
          error_code VARCHAR(100) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_festival_email_delivery_account_created (account_id, created_at),
          INDEX idx_festival_email_delivery_status_created (status, created_at)
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashRecipientEmail(email: string): string {
  return crypto.createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}

function getRecipientDomain(email: string): string {
  return normalizeEmail(email).split("@").pop()?.slice(0, 255) || "unknown";
}

async function recordFestivalEmailDelivery(params: {
  accountId: number;
  email: string;
  purpose: "password_reset" | "password_changed";
  source: "self_service" | "mypage" | "admin";
  result: { success: boolean; provider?: string; messageId?: string; errorCode?: string };
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(festivalEmailDeliveryLogs).values({
      accountId: params.accountId,
      recipientHash: hashRecipientEmail(params.email),
      recipientDomain: getRecipientDomain(params.email),
      purpose: params.purpose,
      source: params.source,
      status: params.result.success ? "accepted" : "failed",
      provider: params.result.provider?.slice(0, 32) || null,
      messageId: params.result.messageId?.slice(0, 255) || null,
      errorCode: params.result.errorCode?.slice(0, 100) || null,
    });
  } catch (error) {
    console.error("[LCF] Email delivery audit failed:", error instanceof Error ? error.message : "unknown");
  }
}

async function sendFestivalPasswordResetLink(params: {
  account: { id: number; email: string; accountType: "company" | "liver" | "general" | "admin"; isActive: boolean };
  source: "self_service" | "admin";
  req: any;
}): Promise<{ success: boolean; provider?: string; messageId?: string; errorCode?: string }> {
  const { account, source, req } = params;
  if (!account.isActive || !process.env.DATABASE_URL) {
    return { success: false, errorCode: account.isActive ? "DB_NOT_CONFIGURED" : "ACCOUNT_INACTIVE" };
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + FESTIVAL_RESET_TOKEN_TTL_MS);
  const mysql = await import("mysql2/promise");
  const connection = await (mysql as any).createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    const [lockedRows] = await connection.execute(
      `SELECT id FROM festival_accounts WHERE id = ? AND is_active = 1 LIMIT 1 FOR UPDATE`,
      [account.id],
    );
    if (!(lockedRows as any[]).length) {
      await connection.rollback();
      return { success: false, errorCode: "ACCOUNT_INACTIVE" };
    }
    await connection.execute(
      `UPDATE festival_password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL`,
      [account.id],
    );
    await connection.execute(
      `INSERT INTO festival_password_reset_tokens (account_id, token_hash, expires_at) VALUES (?, ?, ?)`,
      [account.id, tokenHash, expiresAt],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.end();
  }

  const resetUrl = `https://www.livecommercefestival.com/lcf/reset-password?token=${encodeURIComponent(rawToken)}`;
  const { sendEmail } = await import("./emailService");
  const delivery = await sendEmail({
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
  await recordFestivalEmailDelivery({ accountId: account.id, email: account.email, purpose: "password_reset", source, result: delivery });

  const db = await getDb();
  if (!delivery.success) {
    if (db) {
      await db.update(festivalPasswordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(festivalPasswordResetTokens.tokenHash, tokenHash));
    }
    return delivery;
  }

  if (db) {
    const ip = req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || req?.socket?.remoteAddress || null;
    await db.insert(festivalActivityLogs).values({
      accountId: account.id,
      accountEmail: account.email,
      accountType: account.accountType,
      action: "password_reset_requested",
      details: JSON.stringify({ delivery: "email_link", source, provider: delivery.provider || null, expiresInMinutes: 60 }),
      ipAddress: ip,
      userAgent: req?.headers?.['user-agent']?.substring(0, 500) || null,
    }).catch((error) => console.error("[LCF] Password reset activity audit failed:", error));
  }
  return delivery;
}

async function sendFestivalPasswordChangedNotification(params: {
  account: { id: number; email: string; accountType: "company" | "liver" | "general" | "admin" };
  source: "self_service" | "mypage";
  req: any;
}): Promise<{ success: boolean; provider?: string; messageId?: string; errorCode?: string }> {
  const { sendEmail } = await import("./emailService");
  const result = await sendEmail({
    to: [params.account.email],
    subject: "【LCF 2026】パスワード変更のお知らせ",
    content: `Live Commerce Festival 2026\n\nマイページのパスワードが変更されました。\nご自身で変更した場合、追加の操作は不要です。\n\n心当たりがない場合は、ログイン画面の「パスワードをお忘れの方」から直ちに再設定してください。\nhttps://www.livecommercefestival.com/lcf/login`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#f59e0b;">Live Commerce Festival 2026</h2>
      <p>マイページのパスワードが変更されました。</p>
      <p>ご自身で変更した場合、追加の操作は不要です。</p>
      <div style="background:#fff7ed;border:1px solid #fdba74;padding:16px;border-radius:10px;margin:18px 0;">
        <p style="margin:0;color:#9a3412;">心当たりがない場合は、ログイン画面から直ちにパスワードを再設定してください。</p>
      </div>
      <a href="https://www.livecommercefestival.com/lcf/login" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">ログイン画面を開く</a>
    </div>`,
  });
  await recordFestivalEmailDelivery({
    accountId: params.account.id,
    email: params.account.email,
    purpose: "password_changed",
    source: params.source,
    result,
  });
  const db = await getDb();
  if (db) {
    const ip = params.req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() || params.req?.socket?.remoteAddress || null;
    await db.insert(festivalActivityLogs).values({
      accountId: params.account.id,
      accountEmail: params.account.email,
      accountType: params.account.accountType,
      action: result.success ? "password_changed" : "password_changed_notification_failed",
      details: JSON.stringify({ notificationAccepted: result.success, provider: result.provider || null, errorCode: result.errorCode || null }),
      ipAddress: ip,
      userAgent: params.req?.headers?.['user-agent']?.substring(0, 500) || null,
    }).catch((error) => console.error("[LCF] Password change activity audit failed:", error));
  }
  return result;
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
      newPassword: z.string().min(12, "パスワードは12文字以上にしてください").max(128)
        .regex(/[A-Za-z]/, "英字を1文字以上含めてください")
        .regex(/[0-9]/, "数字を1文字以上含めてください"),
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

      let notificationAccepted = false;
      try {
        const notification = await sendFestivalPasswordChangedNotification({
          account: { id: account.id, email: account.email, accountType: account.accountType },
          source: "mypage",
          req: ctx.req,
        });
        notificationAccepted = notification.success;
      } catch (error) {
        console.error("[LCF] Password changed but notification processing failed:", error instanceof Error ? error.message : "unknown");
      }
      return {
        success: true,
        notificationAccepted,
        message: notificationAccepted
          ? "パスワードを変更しました。確認メールを送信しました"
          : "パスワードを変更しました。確認メールは送信できませんでしたが、新しいパスワードと現在のログインは有効です",
      };
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
        latestEmailStatus: sql<string | null>`(
          SELECT delivery.status FROM festival_email_delivery_logs delivery
          WHERE delivery.account_id = ${festivalAccounts.id}
          ORDER BY delivery.created_at DESC, delivery.id DESC LIMIT 1
        )`,
        latestEmailPurpose: sql<string | null>`(
          SELECT delivery.purpose FROM festival_email_delivery_logs delivery
          WHERE delivery.account_id = ${festivalAccounts.id}
          ORDER BY delivery.created_at DESC, delivery.id DESC LIMIT 1
        )`,
        latestEmailProvider: sql<string | null>`(
          SELECT delivery.provider FROM festival_email_delivery_logs delivery
          WHERE delivery.account_id = ${festivalAccounts.id}
          ORDER BY delivery.created_at DESC, delivery.id DESC LIMIT 1
        )`,
        latestEmailAt: sql<Date | null>`(
          SELECT delivery.created_at FROM festival_email_delivery_logs delivery
          WHERE delivery.account_id = ${festivalAccounts.id}
          ORDER BY delivery.created_at DESC, delivery.id DESC LIMIT 1
        )`,
      }).from(festivalAccounts)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return result;
    }),

  emailDeliveryDiagnostics: festivalAdminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const { getEmailProviderConfiguration } = await import("./emailService");
      const providers = getEmailProviderConfiguration();
      const logs = await db.select({
        id: festivalEmailDeliveryLogs.id,
        accountId: festivalEmailDeliveryLogs.accountId,
        accountEmail: festivalAccounts.email,
        displayName: festivalAccounts.displayName,
        accountType: festivalAccounts.accountType,
        purpose: festivalEmailDeliveryLogs.purpose,
        source: festivalEmailDeliveryLogs.source,
        status: festivalEmailDeliveryLogs.status,
        provider: festivalEmailDeliveryLogs.provider,
        messageId: festivalEmailDeliveryLogs.messageId,
        errorCode: festivalEmailDeliveryLogs.errorCode,
        recipientDomain: festivalEmailDeliveryLogs.recipientDomain,
        createdAt: festivalEmailDeliveryLogs.createdAt,
      }).from(festivalEmailDeliveryLogs)
        .innerJoin(festivalAccounts, eq(festivalEmailDeliveryLogs.accountId, festivalAccounts.id))
        .orderBy(desc(festivalEmailDeliveryLogs.createdAt), desc(festivalEmailDeliveryLogs.id))
        .limit(input?.limit || 50);
      const accepted = logs.filter((log) => log.status === "accepted").length;
      const failed = logs.filter((log) => log.status === "failed").length;
      return {
        providers,
        summary: { total: logs.length, accepted, failed },
        logs,
      };
    }),

  // 管理者用: 既存パスワードを変更せず、ワンタイム再設定リンクを送信する。
  resetPassword: festivalAdminProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, input.accountId))
        .limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "アカウントが見つかりません" });
      if (!account.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "無効なアカウントには送信できません" });

      const delivery = await sendFestivalPasswordResetLink({ account, source: "admin", req: ctx.req });
      return {
        success: delivery.success,
        email: account.email,
        status: delivery.success ? "accepted" as const : "failed" as const,
        provider: delivery.provider || null,
        messageId: delivery.messageId || null,
        errorCode: delivery.errorCode || null,
        message: delivery.success
          ? "パスワード再設定リンクを送信しました。現在のパスワードは、本人が再設定を完了するまで有効です"
          : "再設定リンクを送信できませんでした。現在のパスワードは変更されていません",
      };
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

      await sendFestivalPasswordResetLink({ account, source: "self_service", req: ctx.req })
        .catch((error) => console.error("[LCF] forgotPassword delivery failed:", error instanceof Error ? error.message : "unknown"));
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
      let changedAccount: { id: number; email: string; accountType: "company" | "liver" | "general" | "admin" } | null = null;
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
        changedAccount = {
          id: Number(record.account_id),
          email: String(record.email),
          accountType: record.account_type as "company" | "liver" | "general" | "admin",
        };
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        await connection.end();
      }
      if (ctx.res) {
        ctx.res.cookie("lcf_token", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
      }
      let notificationAccepted = false;
      if (changedAccount) {
        try {
          const notification = await sendFestivalPasswordChangedNotification({ account: changedAccount, source: "self_service", req: ctx.req });
          notificationAccepted = notification.success;
        } catch (error) {
          console.error("[LCF] Password reset completed but confirmation notification failed:", error instanceof Error ? error.message : "unknown");
        }
      }
      return {
        success: true,
        notificationAccepted,
        message: notificationAccepted
          ? "パスワードを再設定しました。確認メールを送信しました。新しいパスワードでログインしてください。"
          : "パスワードを再設定しました。確認メールは送信できませんでしたが、新しいパスワードは有効です。",
      };
    }),
});
