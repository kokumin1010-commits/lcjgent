import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-spin-user",
    email: "spin@example.com",
    name: "Spin Tester",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createAnonContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("friendReferral.getSpinItems", () => {
  it("returns normal spin items with correct format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.friendReferral.getSpinItems({ isSpecial: false });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    for (const item of result) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("emoji");
      expect(item).toHaveProperty("points");
      expect(typeof item.label).toBe("string");
      expect(typeof item.emoji).toBe("string");
      expect(typeof item.points).toBe("number");
      expect(item.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns special spin items with correct format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.friendReferral.getSpinItems({ isSpecial: true });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    for (const item of result) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("emoji");
      expect(item).toHaveProperty("points");
    }
  });
});

describe("friendReferral.spin", () => {
  it("requires authentication", async () => {
    const { ctx } = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.friendReferral.spin({ isSpecial: false })
    ).rejects.toThrow();
  });
});

describe("API items to LuxurySpinWheel format conversion", () => {
  it("converts API items to wheel format correctly", () => {
    const apiItems = [
      { id: "item-1", label: "10pt", emoji: "🎯", points: 10 },
      { id: "item-2", label: "50pt", emoji: "⭐", points: 50 },
      { id: "item-3", label: "100pt", emoji: "🎰", points: 100 },
      { id: "item-4", label: "200pt", emoji: "💎", points: 200 },
    ];

    const wheelItems = apiItems.map((i) => ({ label: i.label, emoji: i.emoji }));

    expect(wheelItems).toHaveLength(4);
    expect(wheelItems[0]).toEqual({ label: "10pt", emoji: "🎯" });
    expect(wheelItems[1]).toEqual({ label: "50pt", emoji: "⭐" });
    expect(wheelItems[2]).toEqual({ label: "100pt", emoji: "🎰" });
    expect(wheelItems[3]).toEqual({ label: "200pt", emoji: "💎" });
  });

  it("finds correct target index from reward item", () => {
    const apiItems = [
      { id: "item-1", label: "10pt", emoji: "🎯", points: 10 },
      { id: "item-2", label: "50pt", emoji: "⭐", points: 50 },
      { id: "item-3", label: "100pt", emoji: "🎰", points: 100 },
      { id: "item-4", label: "200pt", emoji: "💎", points: 200 },
    ];

    const rewardItem = { id: "item-3", label: "100pt", emoji: "🎰", points: 100 };
    const targetIdx = apiItems.findIndex((i) => i.id === rewardItem.id);

    expect(targetIdx).toBe(2);
  });

  it("defaults to index 0 when reward item not found", () => {
    const apiItems = [
      { id: "item-1", label: "10pt", emoji: "🎯", points: 10 },
      { id: "item-2", label: "50pt", emoji: "⭐", points: 50 },
    ];

    const rewardItem = { id: "item-unknown", label: "???", emoji: "❓", points: 0 };
    const targetIdx = apiItems.findIndex((i) => i.id === rewardItem.id);
    const safeIdx = targetIdx >= 0 ? targetIdx : 0;

    expect(safeIdx).toBe(0);
  });
});
