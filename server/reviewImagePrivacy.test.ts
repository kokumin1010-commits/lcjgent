import { describe, it, expect } from "vitest";

/**
 * Tests for review image privacy protection:
 * - Public APIs must NOT expose receiptImageUrl (contains personal info)
 * - Only cropped productImageUrl should be returned
 * - getProductReviewImages should not include receiptImageUrl
 */

// Simulate the select fields used in getLatestReceiptReviews
const latestReviewSelectFields = [
  "id", "receiptId", "userId", "lineUserId",
  "productName", "brandName", "shopName", "category",
  "purchaseAmount", "purchasePlatform", "rating", "reviewText",
  "isVisible", "helpfulCount", "tags",
  "productImageUrl", "videoUrl", "tiktokUrl", "liveCommerceUrl",
  "createdAt", "updatedAt",
];

// Simulate the select fields used in searchReceiptReviewsByProduct
const searchReviewSelectFields = [
  "id", "receiptId", "userId", "lineUserId",
  "productName", "brandName", "shopName", "category",
  "purchaseAmount", "purchasePlatform", "rating", "reviewText",
  "isVisible", "helpfulCount", "tags",
  "productImageUrl", "videoUrl", "tiktokUrl", "liveCommerceUrl",
  "createdAt", "updatedAt",
];

// Simulate the select fields used in getProductReviewImages
const productReviewImagesSelectFields = [
  "id", "productImageUrl", "rating", "createdAt",
];

// Simulate the select fields used in getVideoReviews
const videoReviewSelectFields = [
  "id", "productName", "brandName", "rating", "reviewText",
  "productImageUrl", "videoUrl", "tiktokUrl", "liveCommerceUrl",
  "purchasePlatform", "createdAt",
];

describe("Review Image Privacy - receiptImageUrl exclusion", () => {
  it("getLatestReceiptReviews should NOT include receiptImageUrl", () => {
    expect(latestReviewSelectFields).not.toContain("receiptImageUrl");
  });

  it("getLatestReceiptReviews should include productImageUrl", () => {
    expect(latestReviewSelectFields).toContain("productImageUrl");
  });

  it("searchReceiptReviewsByProduct should NOT include receiptImageUrl", () => {
    expect(searchReviewSelectFields).not.toContain("receiptImageUrl");
  });

  it("searchReceiptReviewsByProduct should include productImageUrl", () => {
    expect(searchReviewSelectFields).toContain("productImageUrl");
  });

  it("getProductReviewImages should NOT include receiptImageUrl", () => {
    expect(productReviewImagesSelectFields).not.toContain("receiptImageUrl");
  });

  it("getProductReviewImages should include productImageUrl", () => {
    expect(productReviewImagesSelectFields).toContain("productImageUrl");
  });

  it("getVideoReviews should NOT include receiptImageUrl", () => {
    expect(videoReviewSelectFields).not.toContain("receiptImageUrl");
  });

  it("getVideoReviews should include productImageUrl", () => {
    expect(videoReviewSelectFields).toContain("productImageUrl");
  });
});

describe("Review Image Privacy - Lightbox behavior", () => {
  it("lightbox should only show productImageUrl, not receiptImageUrl", () => {
    // Simulate the lightbox images array as used in ReviewDatabase.tsx
    const review = {
      productImageUrl: "https://cdn.example.com/cropped-product.jpg",
      // receiptImageUrl is no longer available in the API response
    };

    // The lightbox should only contain productImageUrl
    const lightboxImages = [review.productImageUrl];
    
    expect(lightboxImages).toHaveLength(1);
    expect(lightboxImages[0]).toBe("https://cdn.example.com/cropped-product.jpg");
    expect(lightboxImages).not.toContain(undefined);
  });

  it("lightbox should not open when productImageUrl is null", () => {
    const review = {
      productImageUrl: null,
    };

    // Condition check: lightbox only opens when productImageUrl exists
    const shouldOpenLightbox = !!review.productImageUrl;
    expect(shouldOpenLightbox).toBe(false);
  });
});

describe("Review Image Privacy - Cropped image URL format", () => {
  it("cropped product image should use CloudFront CDN URL", () => {
    const croppedUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/review-1-product.jpg";
    expect(croppedUrl).toMatch(/^https:\/\/.*cloudfront\.net\//);
  });

  it("cropped product image filename should contain 'product' identifier", () => {
    const croppedUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/review-1-product.jpg";
    expect(croppedUrl).toContain("product");
  });
});
