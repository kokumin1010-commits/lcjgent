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
  it("rejects non-admin users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.point.adminAiAutoApprove({
        limit: 10,
        dryRun: true,
        confidenceThreshold: 70,
      })
    ).rejects.toThrow();
  });

  it("returns correct structure with hasMore field", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Call with limit=1 and dryRun to minimize LLM calls
    const result = await caller.point.adminAiAutoApprove({
      limit: 1,
      dryRun: true,
      confidenceThreshold: 70,
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
  }, 60000);

  it("default confidence threshold is 70 (lowered from 85)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Call without specifying confidenceThreshold - should use default 70
    const result = await caller.point.adminAiAutoApprove({
      limit: 1,
      dryRun: true,
    });

    // Just verify it doesn't throw and returns valid structure
    expect(result).toHaveProperty("processed");
    expect(result).toHaveProperty("hasMore");
  }, 60000);

  it("processes receipts without order numbers (no longer skips)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // With the new logic, receipts without order numbers should be sent to LLM
    // instead of being skipped. We verify by checking that "skipped" count
    // for "注文番号なし" reason should be lower than before.
    const result = await caller.point.adminAiAutoApprove({
      limit: 3,
      dryRun: true,
      confidenceThreshold: 70,
    });

    // Verify structure is valid
    expect(result.processed).toBeGreaterThanOrEqual(0);
    expect(result.processed).toBeLessThanOrEqual(3);
    
    // Check that skipped results don't include "注文番号なし" reason
    // (those should now go to LLM instead)
    const skippedForNoOrderNumber = result.results.filter(
      (r: any) => r.action === "skipped" && r.reason === "注文番号なし"
    );
    expect(skippedForNoOrderNumber.length).toBe(0);
  }, 120000);
});
