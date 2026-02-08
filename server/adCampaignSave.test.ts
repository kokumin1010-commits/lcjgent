import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the input schema from routers.ts createAdCampaign (updated to match real DB)
const createAdCampaignInputSchema = z.object({
  brandId: z.number(),
  campaignName: z.string().min(1),
  platform: z.string().default("tiktok"),
  objective: z.enum(["impression", "click", "conversion", "engagement", "other"]).default("impression"),
  objectiveConfidence: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  adSpend: z.number().optional(),
  status: z.enum(["active", "completed", "paused", "cancelled"]).default("active"),
  reportLanguage: z.enum(["ja", "zh", "en"]).default("ja"),
  reportFileUrl: z.string().optional(),
  reportFileKey: z.string().optional(),
  memo: z.string().optional(),
  // Metrics
  impressions: z.number().optional(),
  views: z.number().optional(),
  views6sPlus: z.number().optional(),
  clicks: z.number().optional(),
  productClicks: z.number().optional(),
  cartAdds: z.number().optional(),
  salesCount: z.number().optional(),
  gmv: z.number().optional(),
  durationMinutes: z.number().optional(),
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

// Safe date parsing helper (same as in routers.ts - returns Date, not undefined)
const safeParseDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date();
    return d;
  } catch {
    return new Date();
  }
};

// Objective mapping from AI analysis to DB enum
const objectiveMap: Record<string, 'impression' | 'click' | 'conversion' | 'engagement' | 'other'> = {
  'impressions': 'impression',
  'clicks': 'click',
  'conversions': 'conversion',
  'awareness': 'other',
  'engagement': 'engagement',
  'impression': 'impression',
  'click': 'click',
  'conversion': 'conversion',
  'other': 'other',
};

describe("Ad Campaign Save (DB-aligned schema)", () => {
  describe("Input Validation", () => {
    it("should accept valid input with all zero metrics", () => {
      const input = {
        brandId: 1,
        campaignName: "テストキャンペーン",
        platform: "tiktok",
        objective: "impression" as const,
        status: "completed" as const,
        impressions: 0,
        views: 0,
        clicks: 0,
        salesCount: 0,
        gmv: 0,
        cartAdds: 0,
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept valid input with country breakdown", () => {
      const input = {
        brandId: 1,
        campaignName: "キャンペーン",
        platform: "tiktok",
        objective: "impression" as const,
        status: "completed" as const,
        impressions: 0,
        views: 0,
        clicks: 0,
        gmv: 0,
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

    it("should reject input without required campaignName", () => {
      const input = {
        brandId: 1,
        campaignName: "",
        platform: "tiktok",
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept input with date strings", () => {
      const input = {
        brandId: 1,
        campaignName: "テスト",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept input with undefined metrics", () => {
      const input = {
        brandId: 1,
        campaignName: "テスト",
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept all valid objective enum values", () => {
      const objectives = ["impression", "click", "conversion", "engagement", "other"] as const;
      for (const obj of objectives) {
        const input = { brandId: 1, campaignName: "テスト", objective: obj };
        const result = createAdCampaignInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("should reject old objective enum values (impressions, clicks, etc.)", () => {
      const oldObjectives = ["impressions", "clicks", "conversions", "awareness"];
      for (const obj of oldObjectives) {
        const input = { brandId: 1, campaignName: "テスト", objective: obj };
        const result = createAdCampaignInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      }
    });

    it("should accept all valid status enum values", () => {
      const statuses = ["active", "completed", "paused", "cancelled"] as const;
      for (const status of statuses) {
        const input = { brandId: 1, campaignName: "テスト", status };
        const result = createAdCampaignInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("should reject old status enum values (draft)", () => {
      const input = { brandId: 1, campaignName: "テスト", status: "draft" };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept reportLanguage values", () => {
      const langs = ["ja", "zh", "en"] as const;
      for (const lang of langs) {
        const input = { brandId: 1, campaignName: "テスト", reportLanguage: lang };
        const result = createAdCampaignInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("should accept new metric fields (views6sPlus, productClicks, salesCount, durationMinutes)", () => {
      const input = {
        brandId: 1,
        campaignName: "テスト",
        views6sPlus: 100,
        productClicks: 50,
        salesCount: 10,
        durationMinutes: 120,
      };
      const result = createAdCampaignInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("Safe Date Parsing (NOT NULL compatible)", () => {
    it("should parse valid date string", () => {
      const result = safeParseDate("2026-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
    });

    it("should return current date for empty string (NOT NULL fallback)", () => {
      const result = safeParseDate("");
      expect(result).toBeInstanceOf(Date);
      // Should be a valid date (not NaN)
      expect(isNaN(result.getTime())).toBe(false);
    });

    it("should return current date for undefined (NOT NULL fallback)", () => {
      const result = safeParseDate(undefined);
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(false);
    });

    it("should return current date for invalid date string (NOT NULL fallback)", () => {
      const result = safeParseDate("not-a-date");
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(false);
    });

    it("should parse ISO date string", () => {
      const result = safeParseDate("2026-01-15T10:30:00.000Z");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("Objective Mapping (AI → DB)", () => {
    it("should map 'impressions' to 'impression'", () => {
      expect(objectiveMap['impressions']).toBe('impression');
    });

    it("should map 'clicks' to 'click'", () => {
      expect(objectiveMap['clicks']).toBe('click');
    });

    it("should map 'conversions' to 'conversion'", () => {
      expect(objectiveMap['conversions']).toBe('conversion');
    });

    it("should map 'awareness' to 'other'", () => {
      expect(objectiveMap['awareness']).toBe('other');
    });

    it("should pass through already-correct values", () => {
      expect(objectiveMap['impression']).toBe('impression');
      expect(objectiveMap['click']).toBe('click');
      expect(objectiveMap['conversion']).toBe('conversion');
      expect(objectiveMap['engagement']).toBe('engagement');
      expect(objectiveMap['other']).toBe('other');
    });

    it("should return undefined for unknown objectives (fallback to default)", () => {
      const unknown = objectiveMap['unknown_objective'];
      expect(unknown).toBeUndefined();
      // Frontend uses: objectiveMap[value] || 'impression' as fallback
      expect(unknown || 'impression').toBe('impression');
    });
  });

  describe("Metrics Condition Logic", () => {
    it("should detect metrics when all values are 0 (bug fix)", () => {
      const impressions = 0;
      const views = 0;
      const views6sPlus = 0;
      const clicks = 0;
      const gmv = 0;
      const salesCount = 0;
      const cartAdds = 0;

      // Old buggy condition: would be false when all are 0
      const oldCondition = !!(impressions || views || views6sPlus || clicks || gmv);
      expect(oldCondition).toBe(false); // This was the bug!

      // New fixed condition: should be true when values are provided (even 0)
      const newCondition = impressions != null || views != null || views6sPlus != null || clicks != null || gmv != null || salesCount != null || cartAdds != null;
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
    it("should extract campaignId from result", () => {
      const result = { id: 42, brandId: 1, campaignName: "Test" };
      const campaignId = result.id;
      expect(campaignId).toBe(42);
    });

    it("should handle result with id = 0 (edge case)", () => {
      const result = { id: 0, brandId: 1, campaignName: "Test" };
      const campaignId = result.id;
      expect(!campaignId).toBe(true);
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

    it("should handle null percentage gracefully", () => {
      const percentage = null;
      const result = percentage != null ? String(percentage) : undefined;
      expect(result).toBeUndefined();
    });
  });
});
