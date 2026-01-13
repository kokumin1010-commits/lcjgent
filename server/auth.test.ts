import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createUser, getUserByEmail } from "./db";
import bcrypt from "bcrypt";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(): { ctx: TrpcContext; clearedCookies: any[]; setCookies: any[] } {
  const clearedCookies: any[] = [];
  const setCookies: any[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
    } as any,
  };

  return { ctx, clearedCookies, setCookies };
}

describe("auth router", () => {
  it("should register a new user successfully", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `test-${Date.now()}@example.com`;
    const result = await caller.auth.register({
      email: testEmail,
      password: "password123",
      name: "Test User",
    });

    expect(result.success).toBe(true);

    // Verify user was created in database
    const user = await getUserByEmail(testEmail);
    expect(user).toBeDefined();
    expect(user?.email).toBe(testEmail);
    expect(user?.name).toBe("Test User");
  });

  it("should not allow duplicate email registration", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `duplicate-${Date.now()}@example.com`;
    
    // First registration
    await caller.auth.register({
      email: testEmail,
      password: "password123",
      name: "First User",
    });

    // Second registration with same email should fail
    await expect(
      caller.auth.register({
        email: testEmail,
        password: "password456",
        name: "Second User",
      })
    ).rejects.toThrow("このメールアドレスは既に登録されています");
  });

  it("should login with correct credentials", async () => {
    const { ctx, setCookies } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = "password123";

    // Register user first
    await caller.auth.register({
      email: testEmail,
      password: testPassword,
      name: "Login Test User",
    });

    // Login
    const result = await caller.auth.login({
      email: testEmail,
      password: testPassword,
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe(testEmail);
    expect(setCookies.length).toBeGreaterThan(0);
  });

  it("should not login with incorrect password", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `wrong-password-${Date.now()}@example.com`;

    // Register user first
    await caller.auth.register({
      email: testEmail,
      password: "correctpassword",
      name: "Wrong Password Test",
    });

    // Try to login with wrong password
    await expect(
      caller.auth.login({
        email: testEmail,
        password: "wrongpassword",
      })
    ).rejects.toThrow("メールアドレスまたはパスワードが正しくありません");
  });

  it("should not login with non-existent email", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "nonexistent@example.com",
        password: "anypassword",
      })
    ).rejects.toThrow("メールアドレスまたはパスワードが正しくありません");
  });
});
