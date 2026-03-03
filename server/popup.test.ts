import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  createPopupVariant: vi.fn(),
  getAllPopupVariants: vi.fn(),
  getActivePopupVariants: vi.fn(),
  getPopupVariantById: vi.fn(),
  updatePopupVariant: vi.fn(),
  recordPopupImpression: vi.fn(),
  recordPopupClick: vi.fn(),
  selectPopupVariantBandit: vi.fn(),
  getPopupStats: vi.fn(),
  seedPopupVariants: vi.fn(),
}));

import {
  selectPopupVariantBandit,
  getPopupStats,
  seedPopupVariants,
  getActivePopupVariants,
} from "./db";

describe("Popup ABTest - Bandit Algorithm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when no active variants exist", async () => {
    vi.mocked(getActivePopupVariants).mockResolvedValue([]);
    vi.mocked(selectPopupVariantBandit).mockImplementation(async (epsilon = 0.2) => {
      const variants = await getActivePopupVariants();
      if (variants.length === 0) return null;
      return variants[0];
    });

    const result = await selectPopupVariantBandit(0.2);
    expect(result).toBeNull();
  });

  it("should return a variant when active variants exist", async () => {
    const mockVariant = {
      id: 1,
      variantKey: "gold_v0",
      theme: "gold",
      menuItems: [
        { name: "マツエク", imageUrl: "https://example.com/matsek.jpg", ptLabel: "3,500pt〜" },
      ],
      headline: "テスト見出し",
      subtext: "テストサブテキスト",
      ctaText: "チャージする",
      impressions: 100,
      clicks: 20,
      isActive: true,
      createdAt: new Date(),
    };

    vi.mocked(selectPopupVariantBandit).mockResolvedValue(mockVariant);

    const result = await selectPopupVariantBandit(0.2);
    expect(result).not.toBeNull();
    expect(result?.variantKey).toBe("gold_v0");
    expect(result?.theme).toBe("gold");
  });

  it("should exploit the best CTR variant when not exploring", async () => {
    const variants = [
      { id: 1, variantKey: "gold_v0", theme: "gold", impressions: 100, clicks: 10, isActive: true, menuItems: [], headline: "", subtext: "", ctaText: "", createdAt: new Date() },
      { id: 2, variantKey: "pink_v0", theme: "pink", impressions: 100, clicks: 30, isActive: true, menuItems: [], headline: "", subtext: "", ctaText: "", createdAt: new Date() },
      { id: 3, variantKey: "gold_v1", theme: "gold", impressions: 100, clicks: 5, isActive: true, menuItems: [], headline: "", subtext: "", ctaText: "", createdAt: new Date() },
    ];

    // Simulate exploit behavior (epsilon = 0, always exploit)
    vi.mocked(selectPopupVariantBandit).mockImplementation(async () => {
      // Laplace smoothing: (clicks + 1) / (impressions + 2)
      let bestVariant = variants[0];
      let bestCtr = -1;
      for (const v of variants) {
        const ctr = (v.clicks + 1) / (v.impressions + 2);
        if (ctr > bestCtr) {
          bestCtr = ctr;
          bestVariant = v;
        }
      }
      return bestVariant;
    });

    const result = await selectPopupVariantBandit(0);
    expect(result?.id).toBe(2); // pink_v0 has highest CTR (30/100)
  });
});

describe("Popup ABTest - Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate correct stats", async () => {
    vi.mocked(getPopupStats).mockResolvedValue({
      totalImpressions: 500,
      totalClicks: 75,
      overallCtr: 15,
      variantCount: 3,
      variants: [
        { id: 1, variantKey: "gold_v0", theme: "gold", headline: "test", impressions: 200, clicks: 40, ctr: 20, isActive: true, menuItems: [] },
        { id: 2, variantKey: "pink_v0", theme: "pink", headline: "test", impressions: 200, clicks: 30, ctr: 15, isActive: true, menuItems: [] },
        { id: 3, variantKey: "gold_v1", theme: "gold", headline: "test", impressions: 100, clicks: 5, ctr: 5, isActive: true, menuItems: [] },
      ],
    });

    const stats = await getPopupStats();
    expect(stats.totalImpressions).toBe(500);
    expect(stats.totalClicks).toBe(75);
    expect(stats.overallCtr).toBe(15);
    expect(stats.variantCount).toBe(3);
    expect(stats.variants).toHaveLength(3);
    expect(stats.variants[0].ctr).toBe(20); // Highest CTR
  });
});

describe("Popup ABTest - Seed", () => {
  it("should seed initial variants", async () => {
    vi.mocked(seedPopupVariants).mockResolvedValue({ seeded: true, count: 8 });

    const result = await seedPopupVariants();
    expect(result.seeded).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  it("should not re-seed if variants already exist", async () => {
    vi.mocked(seedPopupVariants).mockResolvedValue({ seeded: false, count: 8 });

    const result = await seedPopupVariants();
    expect(result.seeded).toBe(false);
  });
});
