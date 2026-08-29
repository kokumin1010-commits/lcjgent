import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF secure password-recovery and email-delivery contract", () => {
  const router = read("server/festivalAuthRouter.ts");
  const festivalRouter = read("server/festivalRouter.ts");
  const emailService = read("server/emailService.ts");
  const schema = read("drizzle/festivalSchema.ts");
  const resetMigration = read("drizzle/0126_lcf_secure_password_reset.sql");
  const emailMigration = read("drizzle/0127_lcf_email_delivery_audit.sql");
  const app = read("client/src/App.tsx");
  const loginPage = read("client/src/pages/LcfLogin.tsx");
  const resetPage = read("client/src/pages/LcfResetPassword.tsx");
  const mypage = read("client/src/pages/LcfMypage.tsx");
  const adminPage = read("client/src/pages/LcfAdmin.tsx");

  const linkHelperStart = router.indexOf("async function sendFestivalPasswordResetLink");
  const changedHelperStart = router.indexOf("async function sendFestivalPasswordChangedNotification");
  const verifyPasswordStart = router.indexOf("function verifyPassword", changedHelperStart);
  const linkHelper = router.slice(linkHelperStart, changedHelperStart);
  const changedHelper = router.slice(changedHelperStart, verifyPasswordStart);
  const adminResetStart = router.indexOf("resetPassword: festivalAdminProcedure");
  const forgotStart = router.indexOf("forgotPassword: publicProcedure");
  const verifyStart = router.indexOf("verifyPasswordResetToken: publicProcedure");
  const resetStart = router.indexOf("resetPasswordWithToken: publicProcedure");
  const adminReset = router.slice(adminResetStart, forgotStart);
  const forgot = router.slice(forgotStart, verifyStart);
  const verify = router.slice(verifyStart, resetStart);
  const reset = router.slice(resetStart);

  it("stores only a SHA-256 digest and keeps the raw token only in the HTTPS email link", () => {
    expect(linkHelper).toContain('crypto.randomBytes(32).toString("base64url")');
    expect(router).toContain('crypto.createHash("sha256")');
    expect(linkHelper).toContain("token_hash, expires_at");
    expect(linkHelper).toContain("encodeURIComponent(rawToken)");
    expect(linkHelper).not.toContain("[account.id, rawToken");
    expect(linkHelper).toContain("https://www.livecommercefestival.com/lcf/reset-password?token=");
  });

  it("issues a one-hour, newest-only token under an account row lock", () => {
    expect(router).toContain("const FESTIVAL_RESET_TOKEN_TTL_MS = 60 * 60 * 1000");
    expect(linkHelper).toContain("beginTransaction()");
    expect(linkHelper).toContain("LIMIT 1 FOR UPDATE");
    expect(linkHelper).toContain("SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL");
    expect(linkHelper).toContain("connection.commit()");
  });

  it("emails a one-time reset link and never preemptively changes a password", () => {
    expect(linkHelper).toContain("to: [account.email]");
    expect(linkHelper).toContain("content: `Live Commerce Festival 2026");
    expect(linkHelper).toContain("html: `<div");
    expect(linkHelper).toContain("このリンクは一度だけ使用できます");
    expect(linkHelper).not.toContain("generatePassword()");
    expect(linkHelper).not.toContain("passwordHash");
    expect(linkHelper).not.toContain("新しいパスワード: ${");
  });

  it("invalidates the token on delivery failure while public responses remain enumeration-safe", () => {
    expect(linkHelper).toContain("if (!delivery.success)");
    expect(linkHelper).toContain("where(eq(festivalPasswordResetTokens.tokenHash, tokenHash))");
    expect(forgot).toContain("sendFestivalPasswordResetLink");
    expect(forgot).toContain("FESTIVAL_RESET_GENERIC_MESSAGE");
    expect(forgot).not.toContain("アカウントが見つかりません");
  });

  it("replaces the admin plaintext-password reset with an explicit one-time link send", () => {
    expect(adminReset).toContain('source: "admin"');
    expect(adminReset).toContain("本人が再設定を完了するまで有効です");
    expect(adminReset).not.toContain("generatePassword()");
    expect(adminReset).not.toContain("newPassword");
    expect(adminReset).not.toContain("passwordHash");
    expect(adminPage).toContain("再設定リンク送信");
    expect(adminPage).not.toContain("新パスワード:");
  });

  it("notifies users after mypage password changes without rolling back a successful password change", () => {
    expect(changedHelper).toContain("パスワード変更のお知らせ");
    expect(changedHelper).toContain('purpose: "password_changed"');
    expect(changedHelper).toContain("source: params.source");
    expect(router).toContain('source: "mypage"');
    expect(router).toContain("Password changed but notification processing failed");
    expect(router).toContain("確認メールは送信できませんでしたが、新しいパスワードと現在のログインは有効です");
    expect(mypage).toContain("setPwMsg(data.message)");
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
    expect(reset).toContain("sendFestivalPasswordChangedNotification");
    expect(reset).toContain('source: "self_service"');
    expect(reset).toContain("確認メールは送信できませんでしたが、新しいパスワードは有効です");
  });

  it("enforces one password policy, rate limits, and session revocation across all account types", () => {
    expect(router.match(/\.regex\(\/\[A-Za-z\]\//g)?.length).toBeGreaterThanOrEqual(2);
    expect(router.match(/\.regex\(\/\[0-9\]\//g)?.length).toBeGreaterThanOrEqual(2);
    expect(forgot).toContain("enforceRateLimit(`forgot-ip:${ip}`");
    expect(forgot).toContain("enforceRateLimit(`forgot:${ip}:${input.email}`");
    expect(reset).toContain("enforceRateLimit(`reset-password:${ip}`");
    expect(router).toContain("account.authVersion !== payload.authVersion");
    expect(festivalRouter).not.toContain("verifyFestivalToken(");
  });

  it("keeps runtime migration, Drizzle schema, and ordered SQL migrations aligned", () => {
    expect(schema).toContain('authVersion: int("auth_version").default(1).notNull()');
    expect(schema).toContain('mysqlTable("festival_password_reset_tokens"');
    expect(schema).toContain('mysqlTable("festival_email_delivery_logs"');
    expect(resetMigration).toContain("CREATE TABLE IF NOT EXISTS `festival_password_reset_tokens`");
    expect(emailMigration).toContain("CREATE TABLE IF NOT EXISTS `festival_email_delivery_logs`");
    expect(router).toContain("CREATE TABLE IF NOT EXISTS festival_email_delivery_logs");
  });

  it("tries the enterprise mailbox first and only fails over for transport/auth failures", () => {
    expect(emailService).toContain('provider: "aliyun"');
    expect(emailService).toContain('provider: "gmail"');
    expect(emailService.indexOf('provider: "aliyun"')).toBeLessThan(emailService.indexOf('provider: "gmail"'));
    expect(emailService).toContain("safeError.canFailover");
    expect(emailService).toContain('"EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"');
    expect(emailService).toContain("messageId");
    expect(emailService).not.toContain("console.log(customPass)");
    expect(emailService).not.toContain("console.log(gmailPass)");
  });

  it("stores password-mail results without a plaintext recipient address", () => {
    expect(schema).toContain('recipientHash: varchar("recipient_hash", { length: 64 }).notNull()');
    expect(schema).toContain('recipientDomain: varchar("recipient_domain", { length: 255 }).notNull()');
    expect(schema).not.toContain('festivalEmailDeliveryLogs = mysqlTable("festival_email_delivery_logs", {\n  id: int("id").autoincrement().primaryKey(),\n  email:');
    expect(router).toContain("hashRecipientEmail(params.email)");
    expect(router).toContain("errorCode: params.result.errorCode");
  });

  it("exposes admin-only provider status, per-account latest status, and detailed delivery logs", () => {
    expect(router).toContain("emailDeliveryDiagnostics: festivalAdminProcedure");
    expect(router).toContain("latestEmailStatus");
    expect(router).toContain("getEmailProviderConfiguration");
    expect(adminPage).toContain("パスワード関連メール配信ログ");
    expect(adminPage).toContain("阿里企業メール");
    expect(adminPage).toContain("Gmail予備経路");
    expect(adminPage).toContain("SMTP受付");
  });

  it("exposes a Japanese reset UI and accurate link-based login copy", () => {
    expect(app).toContain('const LcfResetPassword = lazy(() => import("./pages/LcfResetPassword"))');
    expect(app).toContain('<Route path="/lcf/reset-password" component={LcfResetPassword} />');
    expect(loginPage).toContain("1時間有効・1回のみ使用できるパスワード再設定リンク");
    expect(loginPage).toContain("再設定リンクを送信");
    expect(resetPage).toContain("新しいパスワードを設定");
    expect(resetPage).toContain("setCompletedMessage(data.message)");
    expect(resetPage).toContain("以前ログインしていた端末のセッションは無効になりました");
    expect(resetPage).toContain('window.history.replaceState({}, document.title, "/lcf/reset-password")');
  });
});
