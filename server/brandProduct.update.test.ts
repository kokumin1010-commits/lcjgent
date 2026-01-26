import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";

// Test the product update validation schema
describe("Brand Product Update Validation", () => {
  // Define the same schema as in routers.ts
  const updateProductSchema = z.object({
    id: z.number(),
    productName: z.string().optional(),
    listPrice: z.number().optional(),
    specialPrice: z.number().optional(),
    discountRate: z.string().optional(),
    sampleProduct: z.string().optional(),
    productCode: z.string().optional(),
    influencer: z.string().optional(),
    purchasePrice: z.number().optional(),
    remarks: z.string().optional(),
    imageUrls: z.array(z.string()).max(2).optional(),
    imageKeys: z.array(z.string()).max(2).optional(),
    commissionRate: z.string().optional(),
    releaseDate: z.string().optional(),
    catchCopy: z.string().optional(),
    features: z.string().optional(),
    productDetails: z.string().optional(),
    accessories: z.string().optional(),
    shippingInfo: z.string().optional(),
    targetAudience: z.string().optional(),
    usageMethod: z.string().optional(),
    createdAt: z.string().optional(),
  });

  it("should validate product update with commissionRate as string", () => {
    const input = {
      id: 1,
      productName: "Test Product",
      commissionRate: "20",
    };
    
    const result = updateProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate product update with commissionRate containing percentage", () => {
    const input = {
      id: 1,
      productName: "Test Product",
      commissionRate: "20%",
    };
    
    const result = updateProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate product update with empty commissionRate", () => {
    const input = {
      id: 1,
      productName: "Test Product",
      commissionRate: "",
    };
    
    const result = updateProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate product update with all fields", () => {
    const input = {
      id: 1,
      productName: "Test Product",
      listPrice: 10000,
      specialPrice: 8000,
      discountRate: "20%",
      commissionRate: "15%",
      productCode: "ABC123",
      releaseDate: "2025/01/01",
      catchCopy: "Best product ever",
      features: "Feature 1, Feature 2",
      productDetails: "100ml",
      accessories: "Box, Manual",
      shippingInfo: "48時間以内発送",
      targetAudience: "20-30代女性",
      usageMethod: "朝晩使用",
      createdAt: "2025-01-26T00:00:00.000Z",
    };
    
    const result = updateProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject product update with invalid createdAt format", () => {
    const input = {
      id: 1,
      productName: "Test Product",
      createdAt: 12345, // Should be string, not number
    };
    
    const result = updateProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should validate product update with null-like values converted to undefined", () => {
    const input = {
      id: 1,
      productName: "Test Product",
      listPrice: 0,
      specialPrice: 0,
      commissionRate: "",
    };
    
    const result = updateProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// Test ROAS calculation logic
describe("ROAS Calculation", () => {
  const INDUSTRY_AVG_ROAS = 0.8;

  it("should calculate ROAS correctly with valid data", () => {
    const linkedLivestreams = [
      { gmv: 500000, impressions: 10000 },
      { gmv: 633514, impressions: 10732 },
    ];
    
    const totalGmv = linkedLivestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
    const totalImpressions = linkedLivestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
    const adValue = totalImpressions * 15; // CPM ¥15,000 = ¥15 per impression
    const roas = adValue > 0 ? totalGmv / adValue : 0;
    
    expect(totalGmv).toBe(1133514);
    expect(totalImpressions).toBe(20732);
    expect(adValue).toBe(310980);
    expect(roas).toBeCloseTo(3.64, 1);
  });

  it("should handle zero impressions", () => {
    const linkedLivestreams = [
      { gmv: 500000, impressions: 0 },
    ];
    
    const totalGmv = linkedLivestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
    const totalImpressions = linkedLivestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
    const adValue = totalImpressions * 15;
    const roas = adValue > 0 ? totalGmv / adValue : 0;
    
    expect(roas).toBe(0);
  });

  it("should handle null/undefined gmv and impressions", () => {
    const linkedLivestreams = [
      { gmv: null, impressions: null },
      { gmv: 500000, impressions: 10000 },
    ] as any[];
    
    const totalGmv = linkedLivestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
    const totalImpressions = linkedLivestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
    const adValue = totalImpressions * 15;
    const roas = adValue > 0 ? totalGmv / adValue : 0;
    
    expect(totalGmv).toBe(500000);
    expect(totalImpressions).toBe(10000);
    expect(roas).toBeCloseTo(3.33, 1);
  });

  it("should calculate vs industry average correctly", () => {
    const roas = 3.64;
    const vsIndustry = roas / INDUSTRY_AVG_ROAS;
    
    expect(vsIndustry).toBeCloseTo(4.55, 1);
  });
});
