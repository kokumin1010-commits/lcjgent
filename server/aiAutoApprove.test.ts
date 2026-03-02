import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "normal-user",
    email: "user@example.com",
    name: "Normal User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("adminAiAutoApprove", () => {
  it("returns correct structure with hasMore field when no candidates", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Call with small limit - should return hasMore field
    const result = await caller.point.adminAiAutoApprove({
      limit: 1,
      dryRun: true,
      confidenceThreshold: 85,
    });

    // Verify the response structure includes hasMore
    expect(result).toHaveProperty("processed");
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("hasMore");
    expect(typeof result.hasMore).toBe("boolean");
    
    // Verify summary structure
    expect(result.summary).toHaveProperty("approved");
    expect(result.summary).toHaveProperty("skipped");
    expect(result.summary).toHaveProperty("held");
    expect(result.summary).toHaveProperty("rejectedDuplicate");
    expect(result.summary).toHaveProperty("rejectedAi");
  });

  it("rejects non-admin users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.point.adminAiAutoApprove({
        limit: 10,
        dryRun: true,
        confidenceThreshold: 85,
      })
    ).rejects.toThrow();
  });

  it("returns hasMore=false when no pending receipts exist", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.point.adminAiAutoApprove({
      limit: 20,
      dryRun: true,
      confidenceThreshold: 85,
    });

    // When there are no candidates, processed should be 0 and hasMore should be false
    if (result.processed === 0) {
      expect(result.hasMore).toBe(false);
    }
  });

  it("respects limit parameter", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.point.adminAiAutoApprove({
      limit: 5,
      dryRun: true,
      confidenceThreshold: 85,
    });

    // processed should not exceed the limit
    expect(result.processed).toBeLessThanOrEqual(5);
  });
});
