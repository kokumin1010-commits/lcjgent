import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Test the input validation schema for createLivestream
const createLivestreamInputSchema = z.object({
  brandId: z.number(),
  liverId: z.number(),
  scheduleId: z.number().optional(),
  livestreamDate: z.string(),
  livestreamEndTime: z.string().optional(),
  salesAmount: z.number().optional(),
  viewerCount: z.number().optional(),
  peakViewerCount: z.number().optional(),
  duration: z.number().optional(),
  productClicks: z.number().optional(),
  orderCount: z.number().optional(),
  impressions: z.number().optional(),
  gmv: z.number().optional(),
  cvr: z.string().optional(),
  ctr: z.string().optional(),
  result: z.enum(["成功", "失敗"]).optional(),
  impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional(),
  resultReason: z.string().optional(),
  remarks: z.string().optional(),
  screenshotUrl: z.string().optional(),
  aiAdvice: z.string().optional(),
  structuredAdvice: z.object({
    summary: z.string().optional(),
    goodPoints: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
    nextActions: z.array(z.object({
      action: z.string(),
      reason: z.string(),
      timing: z.string(),
    })).optional(),
    targetForNextTime: z.string().optional(),
  }).optional(),
  calculatedMetrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

describe("Liver Livestream Creation", () => {
  describe("Input Validation", () => {
    it("should accept valid minimal input", () => {
      const input = {
        brandId: 1,
        liverId: 1,
        livestreamDate: "2025-02-04T09:00:00.000Z",
      };
      
      const result = createLivestreamInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept valid full input", () => {
      const input = {
        brandId: 1,
        liverId: 1,
        livestreamDate: "2025-02-04T09:00:00.000Z",
        livestreamEndTime: "2025-02-04T12:00:00.000Z",
        salesAmount: 99682,
        viewerCount: 5010,
        peakViewerCount: 3970,
        duration: 135,
        productClicks: 100,
        orderCount: 14,
        result: "失敗" as const,
        impactFactor: "構成" as const,
        resultReason: "成功と思ってたものの、セットの在庫などが不安でセットをうまく流れを出し切れませんでした。",
      };
      
      const result = createLivestreamInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid brandId", () => {
      const input = {
        brandId: "invalid",
        liverId: 1,
        livestreamDate: "2025-02-04T09:00:00.000Z",
      };
      
      const result = createLivestreamInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const input = {
        brandId: 1,
        // missing liverId and livestreamDate
      };
      
      const result = createLivestreamInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid result enum values", () => {
      const successInput = {
        brandId: 1,
        liverId: 1,
        livestreamDate: "2025-02-04T09:00:00.000Z",
        result: "成功" as const,
      };
      
      const failureInput = {
        brandId: 1,
        liverId: 1,
        livestreamDate: "2025-02-04T09:00:00.000Z",
        result: "失敗" as const,
      };
      
      expect(createLivestreamInputSchema.safeParse(successInput).success).toBe(true);
      expect(createLivestreamInputSchema.safeParse(failureInput).success).toBe(true);
    });

    it("should reject invalid result enum values", () => {
      const input = {
        brandId: 1,
        liverId: 1,
        livestreamDate: "2025-02-04T09:00:00.000Z",
        result: "無効な値",
      };
      
      const result = createLivestreamInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid impactFactor enum values", () => {
      const factors = ["構成", "商品", "ライバー", "広告", "その他"];
      
      for (const factor of factors) {
        const input = {
          brandId: 1,
          liverId: 1,
          livestreamDate: "2025-02-04T09:00:00.000Z",
          impactFactor: factor,
        };
        
        const result = createLivestreamInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Form Data Processing", () => {
    it("should correctly parse date string to ISO format", () => {
      const dateStr = "2025-02-04";
      const timeStr = "09:00";
      const livestreamDateTime = new Date(`${dateStr}T${timeStr}`);
      
      expect(livestreamDateTime.toISOString()).toContain("2025-02-04");
    });

    it("should correctly calculate CVR", () => {
      const productClicks = 100;
      const orderCount = 14;
      
      const cvr = ((orderCount / productClicks) * 100).toFixed(2) + '%';
      expect(cvr).toBe("14.00%");
    });

    it("should handle zero productClicks without division error", () => {
      const productClicks = 0;
      const orderCount = 14;
      
      let cvr: string | undefined;
      if (productClicks && orderCount && productClicks > 0) {
        cvr = ((orderCount / productClicks) * 100).toFixed(2) + '%';
      }
      
      expect(cvr).toBeUndefined();
    });
  });
});
