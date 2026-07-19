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

// Auto-migration: ensure festival_accounts has role column and admin support
let migrationDone = false;
async function ensureFestivalAdminSchema() {
  if (migrationDone) return;
  migrationDone = true;
  if (!process.env.DATABASE_URL) { console.log("[LCF] No DATABASE_URL, skip migration"); return; }
  let conn: any = null;
  try {
    const mysql = await import("mysql2/promise");
    conn = await (mysql as any).createConnection(process.env.DATABASE_URL);
    // Ensure table exists with role column
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
        last_login_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_email (email)
      )
    `);
    // Add role column if table existed without it
    try {
      await conn.execute(`ALTER TABLE festival_accounts ADD COLUMN role ENUM('applicant', 'admin') NOT NULL DEFAULT 'applicant' AFTER account_type`);
      console.log("[LCF] role column added");
    } catch (e: any) { /* column already exists */ }
    // Update account_type enum
    try {
      await conn.execute(`ALTER TABLE festival_accounts MODIFY COLUMN account_type ENUM('company','liver','general','admin') NOT NULL`);
    } catch (e: any) { /* ignore */ }
    // Make application_id nullable
    try {
      await conn.execute(`ALTER TABLE festival_accounts MODIFY COLUMN application_id INT NULL`);
    } catch (e: any) { /* ignore */ }
    await conn.end();
    console.log("[LCF] festival_accounts schema ensured");
  } catch (e: any) {
    console.error("[LCF] Migration failed:", e.message);
    if (conn) try { await conn.end(); } catch (_) {}
  }
}
// Run migration on import
ensureFestivalAdminSchema().catch(() => {});

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

export async function createFestivalToken(accountId: number, email: string, accountType: string, role?: string): Promise<string> {
  return await new jose.SignJWT({ accountId, email, accountType, role: role || "applicant", scope: "festival" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyFestivalToken(token: string): Promise<{ accountId: number; email: string; accountType: string; role?: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (payload.scope !== "festival") return null;
    return {
      accountId: payload.accountId as number,
      email: payload.email as string,
      accountType: payload.accountType as string,
      role: (payload.role as string) || "applicant",
    };
  } catch {
    return null;
  }
}

// Create admin account helper
export async function createFestivalAdminAccount(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ success: boolean; accountId?: number; error?: string }> {
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
  // 一時的なマイグレーションエンドポイント (mysql2直接接続)
  runMigration: publicProcedure
    .mutation(async () => {
      const results: string[] = [];
      let conn: any = null;
      try {
        const mysql = await import("mysql2/promise");
        conn = await (mysql as any).createConnection(process.env.DATABASE_URL);
        results.push(`connected to DB`);

        // Check what tables exist
        const [tables]: any = await conn.execute(`SHOW TABLES`);
        const tableNames = tables.map((t: any) => Object.values(t)[0]);
        results.push(`tables (${tableNames.length}): ${tableNames.filter((t: string) => t.includes('festival')).join(', ')}`);

        // Create festival_accounts if not exists (with role column from the start)
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
            last_login_at timestamp NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_email (email)
          )
        `);
        results.push("festival_accounts table ensured");

        // Check columns after creation
        const [cols]: any = await conn.execute(`SHOW COLUMNS FROM festival_accounts`);
        const colNames = cols.map((c: any) => c.Field);
        results.push(`columns: ${JSON.stringify(colNames)}`);

        // Add role column if not exists (for existing tables without role)
        if (!colNames.includes('role')) {
          await conn.execute(`ALTER TABLE festival_accounts ADD COLUMN role ENUM('applicant', 'admin') NOT NULL DEFAULT 'applicant' AFTER account_type`);
          results.push("role column added");
        } else {
          results.push("role column already exists");
        }

        // Update account_type enum
        try {
          await conn.execute(`ALTER TABLE festival_accounts MODIFY COLUMN account_type ENUM('company','liver','general','admin') NOT NULL`);
          results.push("account_type updated");
        } catch (e: any) {
          results.push(`account_type: ${e.message?.substring(0, 200)}`);
        }

        // Make application_id nullable
        try {
          await conn.execute(`ALTER TABLE festival_accounts MODIFY COLUMN application_id INT NULL`);
          results.push("application_id nullable");
        } catch (e: any) {
          results.push(`application_id: ${e.message?.substring(0, 200)}`);
        }

        await conn.end();
      } catch (e: any) {
        results.push(`error: ${e.message?.substring(0, 400)}`);
        if (conn) try { await conn.end(); } catch (_) {}
      }
      return { success: true, results };
    }),

  // ログイン
  login: publicProcedure
    .input(z.object({
      email: z.string().email("有効なメールアドレスを入力してください"),
      password: z.string().min(1, "パスワードを入力してください"),
    }))
    .mutation(async ({ input, ctx }) => {
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

      const token = await createFestivalToken(account.id, account.email, account.accountType, account.role);

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
      const token = getCookie(ctx.req, 'lcf_token');
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
      newPassword: z.string().min(6, "パスワードは6文字以上にしてください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = getCookie(ctx.req, 'lcf_token');
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

  // 管理者アカウント作成（初回セットアップ用、既にadminがいる場合はadmin認証必要）
  createAdmin: publicProcedure
    .input(z.object({
      email: z.string().email("有効なメールアドレスを入力してください"),
      password: z.string().min(6, "パスワードは6文字以上にしてください"),
      displayName: z.string().min(1, "名前を入力してください"),
      setupKey: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // Ensure role column exists before proceeding
      migrationDone = false;
      await ensureFestivalAdminSchema();

      // Check if any admin exists
      const existingAdmins = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.role, "admin"))
        .limit(1);

      if (existingAdmins.length > 0) {
        // Admin exists - require lcf_token with admin role
        const token = getCookie(ctx.req, 'lcf_token');
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
        const payload = await verifyFestivalToken(token);
        if (!payload || payload.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
      }

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
  listAccounts: publicProcedure
    .input(z.object({
      accountType: z.enum(["company", "liver", "general", "admin"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      // Admin check via main auth OR lcf admin token
      const lcfToken = getCookie(ctx.req, 'lcf_token');
      const lcfPayload = lcfToken ? await verifyFestivalToken(lcfToken) : null;
      if (!(ctx as any).user && lcfPayload?.role !== "admin") throw new TRPCError({ code: "UNAUTHORIZED" });

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
