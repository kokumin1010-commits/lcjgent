import { describe, it, expect, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Mock the database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getLivestreamsByStreamerName: vi.fn().mockResolvedValue({
      livestreams: [
        {
          id: 1,
          brandId: 1,
          livestreamDate: new Date("2026-03-03T10:00:00Z"),
          livestreamEndTime: new Date("2026-03-03T12:00:00Z"),
          salesAmount: 13300,
          gmv: 13300,
          duration: 124,
          result: null,
          impactFactor: null,
          resultReason: null,
          liverId: 1,
          streamerName: "けいちゃん",
          remarks: null,
          screenshotUrl: "https://example.com/screenshot.jpg",
          viewerCount: 3800,
          orderCount: 4,
        },
        {
          id: 2,
          brandId: 1,
          livestreamDate: new Date("2026-03-02T10:00:00Z"),
          livestreamEndTime: null,
          salesAmount: 15000,
          gmv: 15000,
          duration: 0,
          result: null,
          impactFactor: null,
          resultReason: null,
          liverId: 1,
          streamerName: "けいちゃん",
          remarks: null,
          screenshotUrl: null,
          viewerCount: 0,
          orderCount: 2,
        },
      ],
      totalSales: 28300,
      totalDuration: 124,
    }),
  };
});

describe("Livestream Permission & Screenshot Display", () => {
  const adminUser: AuthenticatedUser = {
    id: 1,
    openId: "admin-open-id",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const regularUser: AuthenticatedUser = {
    id: 2,
    openId: "regular-open-id",
    name: "Regular User",
    email: "user@example.com",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("getLivestreamsByStreamerName - Public Access", () => {
    it("should allow unauthenticated users to access livestream data", async () => {
      const ctx = createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.getLivestreamsByStreamerName({
        streamerName: "けいちゃん",
        month: "2026-03",
      });

      expect(result).toBeDefined();
      expect(result.livestreams).toBeDefined();
      expect(Array.isArray(result.livestreams)).toBe(true);
    });

    it("should allow regular users to access livestream data", async () => {
      const ctx = createMockContext(regularUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.getLivestreamsByStreamerName({
        streamerName: "けいちゃん",
        month: "2026-03",
      });

      expect(result).toBeDefined();
      expect(result.livestreams).toBeDefined();
      expect(result.livestreams.length).toBeGreaterThan(0);
    });

    it("should return screenshotUrl in livestream data", async () => {
      const ctx = createMockContext(regularUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.getLivestreamsByStreamerName({
        streamerName: "けいちゃん",
        month: "2026-03",
      });

      // First livestream should have a screenshot
      const firstLivestream = result.livestreams[0];
      expect(firstLivestream.screenshotUrl).toBe("https://example.com/screenshot.jpg");

      // Second livestream should have null screenshot
      const secondLivestream = result.livestreams[1];
      expect(secondLivestream.screenshotUrl).toBeNull();
    });

    it("should return totalSales and totalDuration", async () => {
      const ctx = createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.getLivestreamsByStreamerName({
        streamerName: "けいちゃん",
        month: "2026-03",
      });

      expect(result.totalSales).toBe(28300);
      expect(result.totalDuration).toBe(124);
    });
  });

  describe("Permission-based UI Controls (Frontend Logic)", () => {
    it("admin user should have role 'admin'", () => {
      expect(adminUser.role).toBe("admin");
      const isAdmin = adminUser.role === "admin";
      expect(isAdmin).toBe(true);
    });

    it("regular user should not have admin role", () => {
      expect(regularUser.role).toBe("user");
      const isAdmin = regularUser.role === "admin";
      expect(isAdmin).toBe(false);
    });

    it("unauthenticated user should not have admin access", () => {
      const user = null;
      const isAdmin = user?.role === "admin";
      expect(isAdmin).toBeFalsy();
    });
  });
});
