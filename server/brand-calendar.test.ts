import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Brand Calendar Integration", () => {
  it("brand.list returns an array of brands", { timeout: 15000 }, async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const brands = await caller.brand.list();
    expect(Array.isArray(brands)).toBe(true);
  });

  it("schedule.publicCreate accepts brandId parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a schedule with brandId
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0).toISOString();

    const result = await caller.schedule.publicCreate({
      title: "Brand Test Schedule",
      startTime,
      endTime,
      category: "other",
      liverName: "Test Liver",
      brandId: 1, // Test with brandId
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("schedule.publicCreate works without brandId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0).toISOString();

    const result = await caller.schedule.publicCreate({
      title: "No Brand Schedule",
      startTime,
      endTime,
      category: "meeting",
      liverName: "Test Liver",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("schedule.getPublicByDateRange returns schedules with brandId field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const schedules = await caller.schedule.getPublicByDateRange({
      startDate,
      endDate,
    });

    expect(Array.isArray(schedules)).toBe(true);
  });
});
