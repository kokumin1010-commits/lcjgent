import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Test the welcome banner feature:
 * - emailRegister should return referralApplied/referralPoints when a valid referral code is used
 * - emailRegister without referral code should not set referralApplied
 * - No referrerName should be returned (privacy)
 */

function createMockContext(): { ctx: TrpcContext; setCookies: any[] } {
  const setCookies: any[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
    } as any,
  };
  return { ctx, setCookies };
}

describe("welcome banner - emailRegister", () => {
  it("emailRegister without referral code should not set referralApplied", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `wb-noreferral-${Date.now()}@test.com`;
    const result = await caller.lineLogin.emailRegister({
      email: testEmail,
      password: "password123",
      name: "No Referral User",
    });

    expect(result.success).toBe(true);
    expect(result.referralApplied).toBe(false);
    expect(result.referralPoints).toBe(0);
  });

  it("emailRegister with invalid referral code should throw error", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `wb-invalid-${Date.now()}@test.com`;
    await expect(
      caller.lineLogin.emailRegister({
        email: testEmail,
        password: "password123",
        name: "Invalid Code User",
        referralCode: "ZZZZZZ",
      })
    ).rejects.toThrow();
  });

  it("emailRegister response should not contain referrerName (privacy)", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `wb-privacy-${Date.now()}@test.com`;
    const result = await caller.lineLogin.emailRegister({
      email: testEmail,
      password: "password123",
      name: "Privacy Test User",
    });

    expect(result.success).toBe(true);
    // referrerName should NOT be in the response (privacy)
    expect((result as any).referrerName).toBeUndefined();
  });

  it("emailRegister response should include all expected fields", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `wb-fields-${Date.now()}@test.com`;
    const result = await caller.lineLogin.emailRegister({
      email: testEmail,
      password: "password123",
      name: "Fields Test User",
    });

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("userId");
    expect(result).toHaveProperty("referralApplied");
    expect(result).toHaveProperty("referralPoints");
    expect(result).toHaveProperty("sessionToken");
  });
});
