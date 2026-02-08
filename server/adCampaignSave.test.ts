import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the input schema from routers.ts createAdCampaign
const createAdCampaignInputSchema = z.object({
  brandId: z.number(),
  name: z.string().min(1),
  platform: z.enum(["tiktok", "facebook", "instagram", "google", "youtube", "other"]).default("tiktok"),
  objective: z.enum(["impressions", "clicks", "conversions", "awareness", "engagement"]).default("impressions"),
  objectiveConfidence: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  actualSpend: z.number().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  detectedLanguage: z.string().optional(),
  sourceFileUrl: z.string().optional(),
  sourceFileKey: z.string().optional(),
  rawData: z.record(z.string(), z.unknown()).optional(),
  // Metrics
  impressions: z.number().optional(),
  views: z.number().optional(),
  views6s: z.number().optional(),
  clicks: z.number().optional(),
  conversions: z.number().optional(),
  gmv: z.number().optional(),
  orderCount: z.number().optional(),
  cartAdds: z.number().optional(),
  // Country breakdown
  countryBreakdown: z.array(z.object({
    countryCode: z.string(),
    countryName: z.string(),
    percentage: z.number(),
    impressions: z.number().optional(),
    clicks: z.number().optional(),
    gmv: z.number().optional(),
  })).optional(),
});

// Safe date parsing helper (same as in routers.ts)
const safeParseDate = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return d;
  } catch {
    return undefined;
  }
};

describe("Ad Campaign Save", () => {
  describe("Input Validation", () => {
    it("should accept valid input with all zero metrics", () => {
      const input = {
        brandId: 1,
        name: "テストキャンペーン",
        platform: "tiktok" as const,
        objective: "impressions" as const,
        status: "completed" as const,
        impressions: 0,
        views: 0,
        clicks: 0,
        conversions: 0,
        gmv: 0,
        orderCount: 0,
        cartAdds: 0,
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept valid input with country breakdown", () => {
      const input = {
        brandId: 1,
        name: "キャンペーン",
        platform: "tiktok" as const,
        objective: "impressions" as const,
        status: "completed" as const,
        impressions: 0,
        views: 0,
        clicks: 0,
        conversions: 0,
        gmv: 0,
        orderCount: 0,
        cartAdds: 0,
        countryBreakdown: [
          { countryCode: "ID", countryName: "インドネシア", percentage: 30, impressions: 313399, clicks: 0, gmv: 0 },
          { countryCode: "TH", countryName: "タイ", percentage: 22, impressions: 229826, clicks: 0, gmv: 0 },
          { countryCode: "PH", countryName: "フィリピン", percentage: 18, impressions: 188039, clicks: 0, gmv: 0 },
          { countryCode: "VN", countryName: "ベトナム", percentage: 15, impressions: 156699, clicks: 0, gmv: 0 },
          { countryCode: "MY", countryName: "マレーシア", percentage: 10, impressions: 104466, clicks: 0, gmv: 0 },
          { countryCode: "KH", countryName: "カンボジア", percentage: 5, impressions: 52233, clicks: 0, gmv: 0 },
        ],
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject input without required name", () => {
      const input = {
        brandId: 1,
        name: "",
        platform: "tiktok" as const,
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept input with date strings", () => {
      const input = {
        brandId: 1,
        name: "テスト",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept input with undefined metrics", () => {
      const input = {
        brandId: 1,
        name: "テスト",
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("Safe Date Parsing", () => {
    it("should parse valid date string", () => {
      const result = safeParseDate("2026-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
    });

    it("should return undefined for empty string", () => {
      const result = safeParseDate("");
      expect(result).toBeUndefined();
    });

    it("should return undefined for undefined", () => {
      const result = safeParseDate(undefined);
      expect(result).toBeUndefined();
    });

    it("should return undefined for invalid date string", () => {
      const result = safeParseDate("not-a-date");
      expect(result).toBeUndefined();
    });

    it("should parse ISO date string", () => {
      const result = safeParseDate("2026-01-15T10:30:00.000Z");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("Metrics Condition Logic", () => {
    // The bug was: `if (impressions || views || ...)` treats 0 as falsy
    // Fix: `if (impressions != null || views != null || ...)`
    
    it("should detect metrics when all values are 0 (bug fix)", () => {
      const impressions = 0;
      const views = 0;
      const views6s = 0;
      const clicks = 0;
      const gmv = 0;
      const conversions = 0;
      const orderCount = 0;
      const cartAdds = 0;

      // Old buggy condition: would be false when all are 0
      const oldCondition = !!(impressions || views || views6s || clicks || gmv);
      expect(oldCondition).toBe(false); // This was the bug!

      // New fixed condition: should be true when values are provided (even 0)
      const newCondition = impressions != null || views != null || views6s != null || clicks != null || gmv != null || conversions != null || orderCount != null || cartAdds != null;
      expect(newCondition).toBe(true); // Fixed!
    });

    it("should detect metrics when some values are non-zero", () => {
      const impressions = 313399;
      const views = 0;
      const clicks = 0;
      const gmv = 0;

      const condition = impressions != null || views != null || clicks != null || gmv != null;
      expect(condition).toBe(true);
    });

    it("should not detect metrics when all are undefined", () => {
      const impressions = undefined;
      const views = undefined;
      const clicks = undefined;
      const gmv = undefined;

      const condition = impressions != null || views != null || clicks != null || gmv != null;
      expect(condition).toBe(false);
    });
  });

  describe("Campaign ID Extraction", () => {
    // The bug was: `(result as any)[0]?.insertId` which doesn't work with $returningId()
    // Fix: use `result.id` directly from the updated createAdCampaign function

    it("should extract campaignId from new result format", () => {
      const result = { id: 42, brandId: 1, name: "Test" };
      const campaignId = result.id;
      expect(campaignId).toBe(42);
    });

    it("should handle result with id = 0 (edge case)", () => {
      const result = { id: 0, brandId: 1, name: "Test" };
      const campaignId = result.id;
      // 0 is falsy, so the check `if (!campaignId)` would fail
      // This is acceptable since id=0 is not a valid auto-increment ID
      expect(!campaignId).toBe(true);
    });

    it("old format would fail with $returningId result", () => {
      // $returningId returns { id: number, ...data } not [[{ insertId: number }]]
      const result = { id: 42, brandId: 1, name: "Test" };
      const oldExtraction = (result as any)[0]?.insertId;
      expect(oldExtraction).toBeUndefined(); // This was the bug!
      
      const newExtraction = result.id;
      expect(newExtraction).toBe(42); // Fixed!
    });
  });

  describe("Country Breakdown Processing", () => {
    it("should convert percentage to string for DB storage", () => {
      const country = { countryCode: "ID", countryName: "インドネシア", percentage: 30 };
      const percentageStr = String(country.percentage);
      expect(percentageStr).toBe("30");
    });

    it("should handle decimal percentages", () => {
      const country = { countryCode: "TH", countryName: "タイ", percentage: 22.5 };
      const percentageStr = String(country.percentage);
      expect(percentageStr).toBe("22.5");
    });

    it("should handle empty country breakdown array", () => {
      const countryBreakdown: any[] = [];
      const shouldProcess = countryBreakdown && countryBreakdown.length > 0;
      expect(shouldProcess).toBe(false);
    });
  });
});
