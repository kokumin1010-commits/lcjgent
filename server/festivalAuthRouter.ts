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

// Auto-migration: ensure festival_accounts has role column and admin support
let migrationDone = false;
async function ensureFestivalAdminSchema() {
  if (migrationDone) return;
  migrationDone = true;
  try {
    const db = await getDb();
    if (!db) { console.log("[LCF] DB not available for migration"); return; }
    // Add role column using sql.raw (same as ensureFestivalTables)
    try {
      await db.execute(sql.raw(`ALTER TABLE festival_accounts ADD COLUMN role ENUM('applicant', 'admin') NOT NULL DEFAULT 'applicant' AFTER account_type`));
      console.log("[LCF] role column added");
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column') && e.code !== 'ER_DUP_FIELDNAME') {
        console.log("[LCF] role migration error:", e.message?.substring(0, 200));
      } else {
        console.log("[LCF] role column already exists");
      }
    }
    // Update account_type enum
    try {
      await db.execute(sql.raw(`ALTER TABLE festival_accounts MODIFY COLUMN account_type ENUM('company','liver','general','admin') NOT NULL`));
      console.log("[LCF] account_type enum updated");
    } catch (e: any) {
      // ignore if already done
    }
    // Make application_id nullable
    try {
      await db.execute(sql.raw(`ALTER TABLE festival_accounts MODIFY COLUMN application_id INT NULL`));
      console.log("[LCF] application_id made nullable");
    } catch (e: any) {
      // ignore
    }
  } catch (e: any) {
    console.error("[LCF] Migration failed:", e.message);
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
  // 一時的なマイグレーションエンドポイント
  runMigration: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false, error: "DB not available", results: [] };
      const results: string[] = [];
      
      // First check current table structure
      try {
        const [cols]: any = await db.execute(sql.raw(`SHOW COLUMNS FROM festival_accounts`));
        results.push(`columns: ${JSON.stringify(cols?.map((c: any) => c.Field || c.COLUMN_NAME))}`);
      } catch (e: any) {
        results.push(`show_cols_error: ${e.message?.substring(0, 300)}`);
      }

      // Try adding role column
      try {
        await db.execute(sql.raw(`ALTER TABLE festival_accounts ADD COLUMN role ENUM('applicant', 'admin') NOT NULL DEFAULT 'applicant' AFTER account_type`));
        results.push("role column added");
      } catch (e: any) {
        results.push(`role_error: ${e.message?.substring(0, 300)}`);
      }
      // Try updating account_type
      try {
        await db.execute(sql.raw(`ALTER TABLE festival_accounts MODIFY COLUMN account_type ENUM('company','liver','general','admin') NOT NULL`));
        results.push("account_type updated");
      } catch (e: any) {
        results.push(`account_type_error: ${e.message?.substring(0, 300)}`);
      }
      // Try making application_id nullable
      try {
        await db.execute(sql.raw(`ALTER TABLE festival_accounts MODIFY COLUMN application_id INT NULL`));
        results.push("application_id nullable");
      } catch (e: any) {
        results.push(`application_id_error: ${e.message?.substring(0, 300)}`);
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
        const token = (ctx.req as any)?.cookies?.lcf_token;
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
      const lcfToken = (ctx.req as any)?.cookies?.lcf_token;
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
