import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Test Admin",
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

describe("autoPost router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("listSchedules", () => {
    it("returns an array of schedules", async () => {
      const result = await caller.autoPost.listSchedules();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("listKeywords", () => {
    it("returns an array of keywords", async () => {
      const result = await caller.autoPost.listKeywords();
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns keywords with expected fields", async () => {
      const result = await caller.autoPost.listKeywords();
      if (result.length > 0) {
        const kw = result[0];
        expect(kw).toHaveProperty("id");
        expect(kw).toHaveProperty("keyword");
        expect(kw).toHaveProperty("category");
        expect(kw).toHaveProperty("priority");
        expect(kw).toHaveProperty("usedCount");
        expect(kw).toHaveProperty("enabled");
      }
    });
  });

  describe("listLogs", () => {
    it("returns an array of logs", async () => {
      const result = await caller.autoPost.listLogs();
      expect(Array.isArray(result)).toBe(true);
    });

    it("accepts optional filter parameters", async () => {
      const result = await caller.autoPost.listLogs({ limit: 10, offset: 0 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("stats", () => {
    it("returns dashboard statistics", async () => {
      const result = await caller.autoPost.stats();
      expect(result).toHaveProperty("totalSchedules");
      expect(result).toHaveProperty("activeSchedules");
      expect(result).toHaveProperty("totalKeywords");
      expect(result).toHaveProperty("unusedKeywords");
      expect(result).toHaveProperty("totalPostsGenerated");
      expect(typeof result.totalSchedules).toBe("number");
      expect(typeof result.activeSchedules).toBe("number");
      expect(typeof result.totalKeywords).toBe("number");
      expect(typeof result.unusedKeywords).toBe("number");
      expect(typeof result.totalPostsGenerated).toBe("number");
    });
  });

  describe("createSchedule + deleteSchedule", () => {
    it("creates a schedule and then deletes it", async () => {
      const created = await caller.autoPost.createSchedule({
        name: "Test Schedule " + Date.now(),
        intervalDays: 2,
        preferredHour: 14,
        keywordStrategy: "preset",
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      });

      expect(created).toBeTruthy();
      expect(created!.name).toContain("Test Schedule");
      expect(created!.intervalDays).toBe(2);
      expect(created!.preferredHour).toBe(14);
      expect(created!.enabled).toBe(false);

      // Clean up
      const deleteResult = await caller.autoPost.deleteSchedule({ id: created!.id });
      expect(deleteResult).toEqual({ success: true });
    });
  });

  describe("toggleSchedule", () => {
    it("toggles schedule enabled state", async () => {
      // Create a test schedule
      const created = await caller.autoPost.createSchedule({
        name: "Toggle Test " + Date.now(),
        intervalDays: 1,
        preferredHour: 10,
        keywordStrategy: "preset",
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      });

      expect(created!.enabled).toBe(false);

      // Toggle on
      const toggled = await caller.autoPost.toggleSchedule({ id: created!.id, enabled: true });
      expect(toggled!.enabled).toBe(true);

      // Toggle off
      const toggledOff = await caller.autoPost.toggleSchedule({ id: created!.id, enabled: false });
      expect(toggledOff!.enabled).toBe(false);

      // Clean up
      await caller.autoPost.deleteSchedule({ id: created!.id });
    });
  });

  describe("addKeyword + deleteKeyword", () => {
    it("adds a keyword and then deletes it", async () => {
      const added = await caller.autoPost.addKeyword({
        keyword: "test keyword " + Date.now(),
        category: "test",
        priority: 7,
      });

      expect(added).toBeTruthy();
      expect(added!.keyword).toContain("test keyword");
      expect(added!.category).toBe("test");
      expect(added!.priority).toBe(7);

      // Clean up
      const deleteResult = await caller.autoPost.deleteKeyword({ id: added!.id });
      expect(deleteResult).toEqual({ success: true });
    });
  });

  describe("recoverStuck", () => {
    it("returns recovery result", async () => {
      const result = await caller.autoPost.recoverStuck();
      expect(result).toHaveProperty("recovered");
      expect(result).toHaveProperty("total");
      expect(typeof result.recovered).toBe("number");
      expect(typeof result.total).toBe("number");
    });
  });
});
