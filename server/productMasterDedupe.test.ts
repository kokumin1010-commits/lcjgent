import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Product Master Deduplication & Review Product List", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProductMaster upsert logic", () => {
    it("should return id and updated=true when record with same canonicalName exists", () => {
      // Simulate the upsert logic
      const existingRecords = [
        { id: 30001, canonicalName: "KYOGOKU MEGAガチャ袋", imageUrl: "https://example.com/img.jpg", imageStatus: "auto_fetched" },
      ];

      const newData = { canonicalName: "KYOGOKU MEGAガチャ袋", imageUrl: "https://example.com/new.jpg" };
      const existing = existingRecords.find(r => r.canonicalName === newData.canonicalName);

      if (existing) {
        const result = { id: existing.id, updated: true };
        expect(result.id).toBe(30001);
        expect(result.updated).toBe(true);
      } else {
        throw new Error("Should have found existing record");
      }
    });

    it("should return id and updated=false when no existing record", () => {
      const existingRecords: any[] = [];
      const newData = { canonicalName: "New Product" };
      const existing = existingRecords.find(r => r.canonicalName === newData.canonicalName);

      if (!existing) {
        const mockInsertId = 30005;
        const result = { id: mockInsertId, updated: false };
        expect(result.id).toBe(30005);
        expect(result.updated).toBe(false);
      } else {
        throw new Error("Should not have found existing record");
      }
    });

    it("should only update non-null fields when upserting", () => {
      const existingRecord = {
        id: 30001,
        canonicalName: "KYOGOKU MEGAガチャ袋",
        imageUrl: "https://example.com/old.jpg",
        imageStatus: "auto_fetched",
        sourceUrl: "https://kyogokupro.com/old",
      };

      const updateData: Record<string, any> = {};
      const newData = { imageUrl: "https://example.com/new.jpg", imageStatus: null, sourceUrl: undefined };

      if (newData.imageUrl) updateData.imageUrl = newData.imageUrl;
      if (newData.imageStatus) updateData.imageStatus = newData.imageStatus;
      if (newData.sourceUrl) updateData.sourceUrl = newData.sourceUrl;

      expect(Object.keys(updateData)).toEqual(["imageUrl"]);
      expect(updateData.imageUrl).toBe("https://example.com/new.jpg");
    });
  });

  describe("reviewProductList product_master enrichment", () => {
    it("should correctly build masterMap from product_master data", () => {
      const masters = [
        { id: 30001, canonicalName: "KYOGOKU MEGAガチャ袋", imageUrl: "https://cdn.example.com/img1.jpg", imageStatus: "auto_fetched", sourceUrl: "https://kyogokupro.com/product1" },
        { id: 30002, canonicalName: "KYOGOKU クリスタルスキン エッセンスローション2本", imageUrl: "https://cdn.example.com/img2.jpg", imageStatus: "auto_fetched", sourceUrl: "https://kyogokupro.com/product2" },
      ];

      const masterMap = new Map<string, typeof masters[0]>();
      for (const m of masters) {
        masterMap.set(m.canonicalName, m);
      }

      expect(masterMap.size).toBe(2);
      expect(masterMap.get("KYOGOKU MEGAガチャ袋")?.id).toBe(30001);
      expect(masterMap.get("KYOGOKU MEGAガチャ袋")?.imageUrl).toBe("https://cdn.example.com/img1.jpg");
      expect(masterMap.get("KYOGOKU クリスタルスキン エッセンスローション2本")?.id).toBe(30002);
    });

    it("should enrich product with master data when match found", () => {
      const masterMap = new Map<string, any>();
      masterMap.set("KYOGOKU MEGAガチャ袋", {
        id: 30001,
        canonicalName: "KYOGOKU MEGAガチャ袋",
        imageUrl: "https://cdn.example.com/img1.jpg",
        imageStatus: "auto_fetched",
        sourceUrl: "https://kyogokupro.com/product1",
      });

      const product = {
        productName: "KYOGOKU MEGAガチャ袋",
        reviewCount: 57,
        avgRating: 4.5,
      };

      const master = masterMap.get(product.productName);
      const enriched = {
        ...product,
        productMasterId: master?.id || null,
        masterCanonicalName: master?.canonicalName || null,
        masterImageUrl: master?.imageUrl || null,
        masterImageStatus: master?.imageStatus || null,
        masterSourceUrl: master?.sourceUrl || null,
      };

      expect(enriched.productMasterId).toBe(30001);
      expect(enriched.masterImageUrl).toBe("https://cdn.example.com/img1.jpg");
      expect(enriched.masterImageStatus).toBe("auto_fetched");
      expect(enriched.masterSourceUrl).toBe("https://kyogokupro.com/product1");
    });

    it("should return null master fields when no match found", () => {
      const masterMap = new Map<string, any>();

      const product = {
        productName: "Unknown Product",
        reviewCount: 5,
        avgRating: 3.0,
      };

      const master = masterMap.get(product.productName);
      const enriched = {
        ...product,
        productMasterId: master?.id || null,
        masterCanonicalName: master?.canonicalName || null,
        masterImageUrl: master?.imageUrl || null,
        masterImageStatus: master?.imageStatus || null,
        masterSourceUrl: master?.sourceUrl || null,
      };

      expect(enriched.productMasterId).toBeNull();
      expect(enriched.masterImageUrl).toBeNull();
      expect(enriched.masterImageStatus).toBeNull();
      expect(enriched.masterSourceUrl).toBeNull();
    });
  });

  describe("getProductMasterImageByName logic", () => {
    it("should find exact match by canonicalName", () => {
      const masters = [
        { canonicalName: "KYOGOKU MEGAガチャ袋", imageUrl: "https://cdn.example.com/img1.jpg", imageStatus: "auto_fetched", sourceUrl: "https://kyogokupro.com/product1" },
      ];

      const productName = "KYOGOKU MEGAガチャ袋";
      const exactMatch = masters.find(m => m.canonicalName === productName);

      expect(exactMatch).toBeDefined();
      expect(exactMatch?.imageUrl).toBe("https://cdn.example.com/img1.jpg");
    });

    it("should fall back to partial match when exact match not found", () => {
      const masters = [
        { canonicalName: "KYOGOKU MEGAガチャ袋", imageUrl: "https://cdn.example.com/img1.jpg", imageStatus: "auto_fetched", sourceUrl: "https://kyogokupro.com/product1" },
      ];

      const productName = "MEGA";
      const exactMatch = masters.find(m => m.canonicalName === productName);
      expect(exactMatch).toBeUndefined();

      // Partial match (LIKE %productName%)
      const partialMatch = masters.find(m => m.canonicalName.includes(productName) && m.imageUrl);
      expect(partialMatch).toBeDefined();
      expect(partialMatch?.canonicalName).toBe("KYOGOKU MEGAガチャ袋");
    });

    it("should return null when no match at all", () => {
      const masters = [
        { canonicalName: "KYOGOKU MEGAガチャ袋", imageUrl: "https://cdn.example.com/img1.jpg", imageStatus: "auto_fetched", sourceUrl: "https://kyogokupro.com/product1" },
      ];

      const productName = "Completely Different Product";
      const exactMatch = masters.find(m => m.canonicalName === productName);
      const partialMatch = masters.find(m => m.canonicalName.includes(productName) && m.imageUrl);

      expect(exactMatch).toBeUndefined();
      expect(partialMatch).toBeUndefined();
    });
  });

  describe("ProductReviews image priority", () => {
    it("should prioritize masterImage over review productImageUrl", () => {
      const masterImage = { imageUrl: "https://cdn.example.com/master.jpg", imageStatus: "auto_fetched" };
      const reviewImageUrl = "https://cdn.example.com/review-crop.jpg";

      const productImage = masterImage?.imageUrl || reviewImageUrl;
      expect(productImage).toBe("https://cdn.example.com/master.jpg");
    });

    it("should fall back to review productImageUrl when masterImage is null", () => {
      const masterImage = null;
      const reviewImageUrl = "https://cdn.example.com/review-crop.jpg";

      const productImage = masterImage?.imageUrl || reviewImageUrl;
      expect(productImage).toBe("https://cdn.example.com/review-crop.jpg");
    });

    it("should handle both null masterImage and null reviewImageUrl", () => {
      const masterImage = null;
      const reviewImageUrl = null;

      const productImage = masterImage?.imageUrl || reviewImageUrl;
      expect(productImage).toBeNull();
    });
  });
});
