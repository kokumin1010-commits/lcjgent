import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF secure password-recovery contract", () => {
  const router = read("server/festivalAuthRouter.ts");
  const festivalRouter = read("server/festivalRouter.ts");
  const emailService = read("server/emailService.ts");
  const schema = read("drizzle/festivalSchema.ts");
  const migration = read("drizzle/0126_lcf_secure_password_reset.sql");
  const app = read("client/src/App.tsx");
  const loginPage = read("client/src/pages/LcfLogin.tsx");
  const resetPage = read("client/src/pages/LcfResetPassword.tsx");

  const forgotStart = router.indexOf("forgotPassword: publicProcedure");
  const verifyStart = router.indexOf("verifyPasswordResetToken: publicProcedure");
  const resetStart = router.indexOf("resetPasswordWithToken: publicProcedure");
  const forgot = router.slice(forgotStart, verifyStart);
  const verify = router.slice(verifyStart, resetStart);
  const reset = router.slice(resetStart);

  it("stores only a SHA-256 digest and keeps the raw token in the emailed HTTPS link", () => {
    expect(router).toContain('crypto.randomBytes(32).toString("base64url")');
    expect(router).toContain('crypto.createHash("sha256")');
    expect(forgot).toContain("token_hash, expires_at");
    expect(forgot).toContain("encodeURIComponent(rawToken)");
    expect(forgot).not.toContain("VALUES (?, ?, ?)`,\n          [account.id, rawToken");
    expect(forgot).toContain("https://www.livecommercefestival.com/lcf/reset-password?token=");
  });

  it("issues a one-hour, newest-only token under an account row lock", () => {
    expect(router).toContain("const FESTIVAL_RESET_TOKEN_TTL_MS = 60 * 60 * 1000");
    expect(forgot).toContain("beginTransaction()");
    expect(forgot).toContain("FOR UPDATE");
    expect(forgot).toContain("SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL");
    expect(forgot).toContain("tokenConnection.commit()");
  });

  it("emails a one-time reset link and never emails or preemptively changes a password", () => {
    expect(forgot).toContain("to: [account.email]");
    expect(forgot).toContain("content: `Live Commerce Festival 2026");
    expect(forgot).toContain("html: `<div");
    expect(forgot).toContain("このリンクは一度だけ使用できます");
    expect(forgot).not.toContain("generatePassword()");
    expect(forgot).not.toContain("passwordHash");
    expect(forgot).not.toContain("新しいパスワード: ${");
  });

  it("invalidates a token when delivery fails and uses an enumeration-safe response", () => {
    expect(forgot).toContain("forgotPassword email failed; reset token invalidated");
    expect(forgot).toContain("where(eq(festivalPasswordResetTokens.tokenHash, tokenHash))");
    expect(router).toContain("FESTIVAL_RESET_GENERIC_MESSAGE");
    expect(forgot).not.toContain("メール送信に失敗しました。しばらくしてから再度お試しください。");
  });

  it("validates expiry and used state without returning account email", () => {
    expect(verify).toContain("!resetToken.usedAt");
    expect(verify).toContain("resetToken.expiresAt.getTime() > Date.now()");
    expect(verify).toContain("{ valid: true as const }");
    expect(verify).not.toContain("email:");
  });

  it("consumes the token and changes the password atomically", () => {
    expect(reset).toContain("LIMIT 1 FOR UPDATE");
    expect(reset).toContain("hashPassword(input.newPassword)");
    expect(reset).toContain("auth_version = auth_version + 1");
    expect(reset).toContain("SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL");
    expect(reset).toContain("password_reset_completed");
    expect(reset).toContain("connection.commit()");
    expect(reset).toContain("connection.rollback()");
  });

  it("enforces strong passwords, rate limits, and revokes previous LCF sessions", () => {
    expect(reset).toContain('z.string().min(12, "パスワードは12文字以上にしてください")');
    expect(reset).toContain('.regex(/[A-Za-z]/');
    expect(reset).toContain('.regex(/[0-9]/');
    expect(forgot).toContain("enforceRateLimit(`forgot-ip:${ip}`");
    expect(forgot).toContain("enforceRateLimit(`forgot:${ip}:${input.email}`");
    expect(reset).toContain("enforceRateLimit(`reset-password:${ip}`");
    expect(router).toContain("account.authVersion !== payload.authVersion");
    expect(router).toContain("セッションが無効です。再度ログインしてください");
    expect(festivalRouter).not.toContain("verifyFestivalToken(");
  });

  it("keeps runtime migration and Drizzle schema aligned", () => {
    expect(schema).toContain('authVersion: int("auth_version").default(1).notNull()');
    expect(schema).toContain('mysqlTable("festival_password_reset_tokens"');
    expect(schema).toContain('tokenHash: varchar("token_hash", { length: 64 }).notNull()');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS `auth_version`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `festival_password_reset_tokens`");
    expect(router).toContain("CREATE TABLE IF NOT EXISTS festival_password_reset_tokens");
  });

  it("supports both configured SMTP providers without exposing credentials", () => {
    expect(emailService).toContain("process.env.SMTP_USER");
    expect(emailService).toContain("process.env.EMAIL_USER");
    expect(emailService).toContain('process.env.EMAIL_SMTP_HOST || "smtp.qiye.aliyun.com"');
    expect(emailService).toContain('to: message.to.join(", ")');
    expect(emailService).not.toContain("console.log(smtpPass)");
    expect(emailService).not.toContain("console.log(customPass)");
  });

  it("exposes a Japanese reset UI and accurate link-based login copy", () => {
    expect(app).toContain('const LcfResetPassword = lazy(() => import("./pages/LcfResetPassword"))');
    expect(app).toContain('<Route path="/lcf/reset-password" component={LcfResetPassword} />');
    expect(loginPage).toContain("1時間有効・1回のみ使用できるパスワード再設定リンク");
    expect(loginPage).toContain("再設定リンクを送信");
    expect(resetPage).toContain("新しいパスワードを設定");
    expect(resetPage).toContain("確認用パスワードが一致しません");
    expect(resetPage).toContain("以前ログインしていた端末のセッションは無効になりました");
    expect(resetPage).toContain('window.history.replaceState({}, document.title, "/lcf/reset-password")');
  });
});
