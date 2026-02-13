import { describe, it, expect } from "vitest";
import {
  getProductReviews,
  getProductReviewStats,
  getRelatedProducts,
  getProductDescImages,
  hasUserReviewedProduct,
  getAllProductReviewStats,
} from "./db";

describe("Mall Product Reviews API", () => {
  it("getProductReviews returns array for a product", async () => {
    const reviews = await getProductReviews(30023);
    expect(Array.isArray(reviews)).toBe(true);
  });

  it("getProductReviewStats returns stats object with expected fields", async () => {
    const stats = await getProductReviewStats(30023);
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("totalReviews");
    expect(stats).toHaveProperty("avgRating");
    expect(stats).toHaveProperty("rating1");
    expect(stats).toHaveProperty("rating2");
    expect(stats).toHaveProperty("rating3");
    expect(stats).toHaveProperty("rating4");
    expect(stats).toHaveProperty("rating5");
  });

  it("getProductReviewStats returns numeric values", async () => {
    const stats = await getProductReviewStats(30023);
    expect(Number(stats.totalReviews)).toBeGreaterThanOrEqual(0);
    expect(Number(stats.avgRating)).toBeGreaterThanOrEqual(0);
    expect(Number(stats.avgRating)).toBeLessThanOrEqual(5);
  });

  it("hasUserReviewedProduct returns false for non-existent user", async () => {
    const result = await hasUserReviewedProduct(30023, 999999);
    expect(result).toBe(false);
  });
});

describe("All Product Review Stats API", () => {
  it("getAllProductReviewStats returns object with product IDs as keys", async () => {
    const stats = await getAllProductReviewStats();
    expect(typeof stats).toBe("object");
    expect(stats).not.toBeNull();
  });

  it("getAllProductReviewStats values have avgRating and totalReviews", async () => {
    const stats = await getAllProductReviewStats();
    const keys = Object.keys(stats);
    if (keys.length > 0) {
      const firstKey = Number(keys[0]);
      expect(stats[firstKey]).toHaveProperty("avgRating");
      expect(stats[firstKey]).toHaveProperty("totalReviews");
      expect(Number(stats[firstKey].avgRating)).toBeGreaterThanOrEqual(0);
      expect(Number(stats[firstKey].avgRating)).toBeLessThanOrEqual(5);
      expect(Number(stats[firstKey].totalReviews)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Related Products API", () => {
  it("getRelatedProducts returns array", async () => {
    const products = await getRelatedProducts(30023, 8);
    expect(Array.isArray(products)).toBe(true);
  });

  it("getRelatedProducts excludes the current product", async () => {
    const products = await getRelatedProducts(30023, 8);
    const ids = products.map((p) => p.id);
    expect(ids).not.toContain(30023);
  });

  it("getRelatedProducts respects limit parameter", async () => {
    const products = await getRelatedProducts(30023, 3);
    expect(products.length).toBeLessThanOrEqual(3);
  });
});

describe("Product Description Images API", () => {
  it("getProductDescImages returns array", async () => {
    const images = await getProductDescImages(30023);
    expect(Array.isArray(images)).toBe(true);
  });

  it("getProductDescImages returns sorted by sortOrder", async () => {
    const images = await getProductDescImages(30023);
    if (images.length > 1) {
      for (let i = 1; i < images.length; i++) {
        expect(images[i].sortOrder).toBeGreaterThanOrEqual(images[i - 1].sortOrder);
      }
    }
  });
});
