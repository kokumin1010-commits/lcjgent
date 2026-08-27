import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { TrpcContext } from "./_core/context";
import { brandScopedFinanceProcedure, financeProcedure, router } from "./_core/trpc";
import {
  FINANCE_ACCESS_COOKIE,
  FINANCE_ACCESS_TTL_SECONDS,
  hasFinanceAccess,
  lockFinanceAccess,
  resetFinanceAccessAttemptsForTests,
  verifyAndUnlockFinance,
} from "./financeAccess";

type CookieWrite = { name: string; value?: string; options: Record<string, unknown> };

function createContext(userId = 101) {
  const cookies: CookieWrite[] = [];
  const cleared: CookieWrite[] = [];
  const ctx = {
    user: {
      id: userId,
      openId: `finance-test-${userId}`,
      email: `finance-${userId}@example.invalid`,
      name: "Finance Test",
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
  financeSecret: financeProcedure.query(() => ({ visible: true })),
  brandScoped: brandScopedFinanceProcedure
    .input(z.object({ brandId: z.number().optional() }))
    .query(({ input }) => ({ brandId: input.brandId || 0 })),
});

describe("finance access security", () => {
  const originalHash = process.env.FINANCE_ACCESS_PASSWORD_HASH;

  beforeEach(() => {
    resetFinanceAccessAttemptsForTests();
    process.env.FINANCE_ACCESS_PASSWORD_HASH = bcrypt.hashSync("unit-test-finance-password", 4);
  });

  afterEach(() => {
    if (originalHash === undefined) delete process.env.FINANCE_ACCESS_PASSWORD_HASH;
    else process.env.FINANCE_ACCESS_PASSWORD_HASH = originalHash;
  });

  it("rejects a wrong password without writing an unlock cookie", async () => {
    const { ctx, cookies } = createContext();
    await expect(verifyAndUnlockFinance(ctx, "wrong-password")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });

  it("writes an HttpOnly 8-hour cookie bound to the same user", async () => {
    const { ctx, cookies } = createContext(101);
    await expect(verifyAndUnlockFinance(ctx, "unit-test-finance-password")).resolves.toEqual({
      unlocked: true,
      expiresInSeconds: FINANCE_ACCESS_TTL_SECONDS,
    });
    expect(cookies[0]).toMatchObject({
      name: FINANCE_ACCESS_COOKIE,
      options: { httpOnly: true, secure: true, sameSite: "lax", maxAge: FINANCE_ACCESS_TTL_SECONDS * 1000 },
    });
    ctx.req.headers.cookie = `${FINANCE_ACCESS_COOKIE}=${cookies[0]?.value}`;
    await expect(hasFinanceAccess(ctx)).resolves.toBe(true);

    const otherUser = createContext(202).ctx;
    otherUser.req.headers.cookie = ctx.req.headers.cookie;
    await expect(hasFinanceAccess(otherUser)).resolves.toBe(false);
  });

  it("blocks the finance procedure and master brandId=0 before unlock", async () => {
    const { ctx } = createContext();
    const caller = guardedRouter.createCaller(ctx);
    await expect(caller.financeSecret()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.brandScoped({ brandId: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.brandScoped({ brandId: 9 })).resolves.toEqual({ brandId: 9 });
  });

  it("permits guarded procedures after unlock", async () => {
    const { ctx, cookies } = createContext();
    await verifyAndUnlockFinance(ctx, "unit-test-finance-password");
    ctx.req.headers.cookie = `${FINANCE_ACCESS_COOKIE}=${cookies[0]?.value}`;
    const caller = guardedRouter.createCaller(ctx);
    await expect(caller.financeSecret()).resolves.toEqual({ visible: true });
    await expect(caller.brandScoped({ brandId: 0 })).resolves.toEqual({ brandId: 0 });
  });

  it("rejects a tampered unlock cookie", async () => {
    const { ctx } = createContext();
    ctx.req.headers.cookie = `${FINANCE_ACCESS_COOKIE}=tampered-token`;
    await expect(hasFinanceAccess(ctx)).resolves.toBe(false);
    await expect(guardedRouter.createCaller(ctx).financeSecret()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rate limits repeated wrong passwords", async () => {
    const { ctx } = createContext();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(verifyAndUnlockFinance(ctx, "wrong-password")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(verifyAndUnlockFinance(ctx, "wrong-password")).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("clears the finance cookie on explicit lock", () => {
    const { ctx, cleared } = createContext();
    expect(lockFinanceAccess(ctx)).toEqual({ unlocked: false });
    expect(cleared[0]).toMatchObject({ name: FINANCE_ACCESS_COOKIE, options: { maxAge: -1 } });
  });
});
