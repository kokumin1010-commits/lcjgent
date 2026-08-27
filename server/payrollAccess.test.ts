import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { payrollProcedure, router } from "./_core/trpc";
import {
  PAYROLL_ACCESS_COOKIE,
  PAYROLL_ACCESS_TTL_SECONDS,
  hasPayrollAccess,
  lockPayrollAccess,
  resetPayrollAccessAttemptsForTests,
  verifyAndUnlockPayroll,
} from "./payrollAccess";

type CookieWrite = { name: string; value?: string; options: Record<string, unknown> };

function createContext(userId = 101) {
  const cookies: CookieWrite[] = [];
  const cleared: CookieWrite[] = [];
  const ctx = {
    user: {
      id: userId,
      openId: `payroll-test-${userId}`,
      email: `payroll-${userId}@example.com`,
      name: "Payroll Test",
      loginMethod: "password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      hostname: "lcjmall.com",
      headers: { "x-forwarded-proto": "https" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    },
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: (name: string, options: Record<string, unknown>) => cleared.push({ name, options }),
    },
  } as unknown as TrpcContext;
  return { ctx, cookies, cleared };
}

const guardedRouter = router({
  secret: payrollProcedure.query(() => ({ visible: true })),
});

describe("payroll access security", () => {
  const originalHash = process.env.PAYROLL_ACCESS_PASSWORD_HASH;

  beforeEach(() => {
    resetPayrollAccessAttemptsForTests();
    process.env.PAYROLL_ACCESS_PASSWORD_HASH = bcrypt.hashSync("unit-test-payroll-password", 4);
  });

  afterEach(() => {
    if (originalHash === undefined) delete process.env.PAYROLL_ACCESS_PASSWORD_HASH;
    else process.env.PAYROLL_ACCESS_PASSWORD_HASH = originalHash;
  });

  it("rejects a wrong password without writing an unlock cookie", async () => {
    const { ctx, cookies } = createContext();
    await expect(verifyAndUnlockPayroll(ctx, "wrong-password")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });

  it("writes an HttpOnly 8-hour cookie and unlocks only the same user", async () => {
    const { ctx, cookies } = createContext(101);
    await expect(verifyAndUnlockPayroll(ctx, "unit-test-payroll-password")).resolves.toEqual({
      unlocked: true,
      expiresInSeconds: PAYROLL_ACCESS_TTL_SECONDS,
    });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: PAYROLL_ACCESS_COOKIE,
      options: { httpOnly: true, secure: true, sameSite: "lax", maxAge: PAYROLL_ACCESS_TTL_SECONDS * 1000 },
    });

    ctx.req.headers.cookie = `${PAYROLL_ACCESS_COOKIE}=${cookies[0]?.value}`;
    await expect(hasPayrollAccess(ctx)).resolves.toBe(true);

    const otherUser = createContext(202).ctx;
    otherUser.req.headers.cookie = ctx.req.headers.cookie;
    await expect(hasPayrollAccess(otherUser)).resolves.toBe(false);
  });

  it("blocks a guarded procedure before unlock and permits it after unlock", async () => {
    const { ctx, cookies } = createContext();
    await expect(guardedRouter.createCaller(ctx).secret()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await verifyAndUnlockPayroll(ctx, "unit-test-payroll-password");
    ctx.req.headers.cookie = `${PAYROLL_ACCESS_COOKIE}=${cookies[0]?.value}`;
    await expect(guardedRouter.createCaller(ctx).secret()).resolves.toEqual({ visible: true });
  });

  it("rejects a tampered unlock cookie", async () => {
    const { ctx } = createContext();
    ctx.req.headers.cookie = `${PAYROLL_ACCESS_COOKIE}=tampered-token`;
    await expect(hasPayrollAccess(ctx)).resolves.toBe(false);
    await expect(guardedRouter.createCaller(ctx).secret()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rate limits repeated wrong password attempts", async () => {
    const { ctx } = createContext();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(verifyAndUnlockPayroll(ctx, "wrong-password")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(verifyAndUnlockPayroll(ctx, "wrong-password")).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("clears the unlock cookie when payroll is locked again", () => {
    const { ctx, cleared } = createContext();
    expect(lockPayrollAccess(ctx)).toEqual({ unlocked: false });
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({ name: PAYROLL_ACCESS_COOKIE, options: { maxAge: -1 } });
  });
});
