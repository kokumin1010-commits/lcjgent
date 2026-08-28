import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF forgot-password delivery contract", () => {
  const router = read("server/festivalAuthRouter.ts");
  const emailService = read("server/emailService.ts");
  const start = router.indexOf("forgotPassword: publicProcedure");
  const forgot = router.slice(start);

  it("passes the email service a recipient array plus text and HTML bodies", () => {
    expect(forgot).toContain("to: [account.email]");
    expect(forgot).not.toContain("to: account.email,");
    expect(forgot).toContain("content: `Live Commerce Festival 2026");
    expect(forgot).toContain("html: `<div");
    expect(emailService).toContain('to: message.to.join(", ")');
  });

  it("restores the previous password hash when delivery fails", () => {
    expect(forgot).toContain("const previousHash = account.passwordHash");
    expect(forgot).toContain("if (!sent.success) throw new Error");
    expect(forgot).toContain(".set({ passwordHash: previousHash })");
    expect(forgot).toContain("forgotPassword email failed; password hash restored");
  });

  it("uses one generic response for unknown addresses and delivery failures", () => {
    const genericMessage = "メールアドレスが登録されている場合、新しいパスワードを送信しました。";
    expect(forgot.split(genericMessage).length - 1).toBeGreaterThanOrEqual(3);
    expect(forgot).not.toContain("メール送信に失敗しました。しばらくしてから再度お試しください。");
  });

  it("keeps input validation and per-address/IP rate limiting", () => {
    expect(forgot).toContain("z.string().trim().toLowerCase().email().max(320)");
    expect(forgot).toContain("enforceRateLimit(`forgot:${ip}:${input.email.toLowerCase()}`");
  });
});
