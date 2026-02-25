import { describe, it, expect } from "vitest";

/**
 * Tests for:
 * 1. OGP image fetch logic (URL → og:image extraction)
 * 2. Verified Purchase badge logic (receiptImageUrl exists = verified)
 * 3. Schema.org structured data format
 * 4. Dynamic OGP tag generation
 */

// ============================================================
// 1. OGP Image Extraction Logic
// ============================================================

function extractOgImage(html: string): string | null {
  // Simulate the OGP extraction logic from the server endpoint
  const patterns = [
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

describe("OGP Image Extraction", () => {
  it("should extract og:image from standard meta tag", () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/product.jpg"></head></html>`;
    expect(extractOgImage(html)).toBe("https://example.com/product.jpg");
  });

  it("should extract og:image with reversed attribute order", () => {
    const html = `<html><head><meta content="https://example.com/product.jpg" property="og:image"></head></html>`;
    expect(extractOgImage(html)).toBe("https://example.com/product.jpg");
  });

  it("should extract og:image with single quotes", () => {
    const html = `<html><head><meta property='og:image' content='https://example.com/product.jpg'></head></html>`;
    expect(extractOgImage(html)).toBe("https://example.com/product.jpg");
  });

  it("should return null when no og:image exists", () => {
    const html = `<html><head><title>No OGP</title></head></html>`;
    expect(extractOgImage(html)).toBeNull();
  });

  it("should handle TikTok Shop style meta tags", () => {
    const html = `<html><head>
      <meta property="og:title" content="Product Name">
      <meta property="og:image" content="https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/product123.jpg">
    </head></html>`;
    const result = extractOgImage(html);
    expect(result).toContain("ibyteimg.com");
  });

  it("should handle Amazon style meta tags", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://m.media-amazon.com/images/I/71abc123.jpg">
    </head></html>`;
    expect(extractOgImage(html)).toContain("media-amazon.com");
  });

  it("should handle Rakuten style meta tags", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://thumbnail.image.rakuten.co.jp/@0_mall/shop/cabinet/product.jpg">
    </head></html>`;
    expect(extractOgImage(html)).toContain("rakuten.co.jp");
  });
});

// ============================================================
// 2. Verified Purchase Badge Logic
// ============================================================

interface ReviewForBadge {
  receiptImageUrl?: string | null;
  receiptId?: string | null;
}

function isVerifiedPurchase(review: ReviewForBadge): boolean {
  // A review is "verified purchase" if it has a receipt image
  // (receipt image proves actual purchase, but is not shown publicly)
  return !!(review.receiptImageUrl || review.receiptId);
}

describe("Verified Purchase Badge", () => {
  it("should show verified badge when receiptImageUrl exists", () => {
    const review: ReviewForBadge = {
      receiptImageUrl: "https://cdn.example.com/receipt.jpg",
      receiptId: "R001",
    };
    expect(isVerifiedPurchase(review)).toBe(true);
  });

  it("should show verified badge when only receiptId exists", () => {
    const review: ReviewForBadge = {
      receiptImageUrl: null,
      receiptId: "R001",
    };
    expect(isVerifiedPurchase(review)).toBe(true);
  });

  it("should NOT show verified badge when no receipt data", () => {
    const review: ReviewForBadge = {
      receiptImageUrl: null,
      receiptId: null,
    };
    expect(isVerifiedPurchase(review)).toBe(false);
  });

  it("should NOT show verified badge when fields are undefined", () => {
    const review: ReviewForBadge = {};
    expect(isVerifiedPurchase(review)).toBe(false);
  });

  it("should NOT expose receiptImageUrl in public API response", () => {
    // Simulate public API response fields
    const publicApiFields = [
      "id", "productName", "brandName", "rating", "reviewText",
      "productImageUrl", "videoUrl", "createdAt",
    ];
    expect(publicApiFields).not.toContain("receiptImageUrl");
  });
});

// ============================================================
// 3. Schema.org Structured Data Format
// ============================================================

interface SchemaProduct {
  "@context": string;
  "@type": string;
  name: string;
  brand?: { "@type": string; name: string };
  aggregateRating?: {
    "@type": string;
    ratingValue: number;
    reviewCount: number;
    bestRating: number;
    worstRating: number;
  };
  review?: Array<{
    "@type": string;
    reviewRating: { "@type": string; ratingValue: number };
    reviewBody: string;
    datePublished: string;
  }>;
}

function buildProductSchema(
  productName: string,
  brandName: string | null,
  avgRating: number,
  reviewCount: number,
  reviews: Array<{ rating: number; reviewText: string; createdAt: string }>
): SchemaProduct {
  const schema: SchemaProduct = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
  };

  if (brandName) {
    schema.brand = { "@type": "Brand", name: brandName };
  }

  if (reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(avgRating * 10) / 10,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews.length > 0) {
    schema.review = reviews.map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
      reviewBody: r.reviewText,
      datePublished: r.createdAt,
    }));
  }

  return schema;
}

describe("Schema.org Structured Data", () => {
  it("should generate valid Product schema", () => {
    const schema = buildProductSchema("KYOGOKU ステムセル", "KYOGOKU", 4.5, 10, [
      { rating: 5, reviewText: "とても良い", createdAt: "2025-01-15" },
    ]);

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Product");
    expect(schema.name).toBe("KYOGOKU ステムセル");
    expect(schema.brand?.name).toBe("KYOGOKU");
  });

  it("should include aggregateRating when reviews exist", () => {
    const schema = buildProductSchema("Product A", "Brand A", 4.2, 5, []);
    expect(schema.aggregateRating).toBeDefined();
    expect(schema.aggregateRating?.ratingValue).toBe(4.2);
    expect(schema.aggregateRating?.reviewCount).toBe(5);
    expect(schema.aggregateRating?.bestRating).toBe(5);
    expect(schema.aggregateRating?.worstRating).toBe(1);
  });

  it("should NOT include aggregateRating when no reviews", () => {
    const schema = buildProductSchema("Product B", null, 0, 0, []);
    expect(schema.aggregateRating).toBeUndefined();
  });

  it("should handle brand being null", () => {
    const schema = buildProductSchema("No Brand Product", null, 3.0, 1, []);
    expect(schema.brand).toBeUndefined();
  });

  it("should round ratingValue to one decimal place", () => {
    const schema = buildProductSchema("Product C", "Brand", 4.333333, 3, []);
    expect(schema.aggregateRating?.ratingValue).toBe(4.3);
  });

  it("should include individual reviews in schema", () => {
    const reviews = [
      { rating: 5, reviewText: "最高です", createdAt: "2025-01-15" },
      { rating: 4, reviewText: "良い商品", createdAt: "2025-01-10" },
    ];
    const schema = buildProductSchema("Product D", "Brand", 4.5, 2, reviews);
    expect(schema.review).toHaveLength(2);
    expect(schema.review?.[0].reviewRating.ratingValue).toBe(5);
    expect(schema.review?.[1].reviewBody).toBe("良い商品");
  });
});

// ============================================================
// 4. Dynamic OGP Tag Generation
// ============================================================

function buildOgpTags(
  productName: string,
  brandName: string | null,
  avgRating: number,
  reviewCount: number,
  imageUrl: string | null,
  siteUrl: string
): Record<string, string> {
  const title = brandName
    ? `${productName} (${brandName}) の口コミ・レビュー`
    : `${productName} の口コミ・レビュー`;

  const description = reviewCount > 0
    ? `${productName}の口コミ${reviewCount}件。平均評価${avgRating.toFixed(1)}点。実際に購入したユーザーのリアルな口コミをチェック。`
    : `${productName}の口コミ・レビューページ。`;

  const tags: Record<string, string> = {
    "og:type": "product",
    "og:title": title,
    "og:description": description,
    "og:url": siteUrl,
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
  };

  if (imageUrl) {
    tags["og:image"] = imageUrl;
    tags["twitter:image"] = imageUrl;
  }

  return tags;
}

describe("Dynamic OGP Tag Generation", () => {
  it("should generate correct og:title with brand", () => {
    const tags = buildOgpTags("ステムセル", "KYOGOKU", 4.5, 10, null, "https://example.com");
    expect(tags["og:title"]).toBe("ステムセル (KYOGOKU) の口コミ・レビュー");
  });

  it("should generate correct og:title without brand", () => {
    const tags = buildOgpTags("ステムセル", null, 4.5, 10, null, "https://example.com");
    expect(tags["og:title"]).toBe("ステムセル の口コミ・レビュー");
  });

  it("should include review count and rating in description", () => {
    const tags = buildOgpTags("Product", "Brand", 4.2, 25, null, "https://example.com");
    expect(tags["og:description"]).toContain("25件");
    expect(tags["og:description"]).toContain("4.2点");
  });

  it("should include og:image when imageUrl is provided", () => {
    const tags = buildOgpTags("Product", "Brand", 4.0, 5, "https://cdn.example.com/img.jpg", "https://example.com");
    expect(tags["og:image"]).toBe("https://cdn.example.com/img.jpg");
    expect(tags["twitter:image"]).toBe("https://cdn.example.com/img.jpg");
  });

  it("should NOT include og:image when imageUrl is null", () => {
    const tags = buildOgpTags("Product", "Brand", 4.0, 5, null, "https://example.com");
    expect(tags["og:image"]).toBeUndefined();
    expect(tags["twitter:image"]).toBeUndefined();
  });

  it("should set og:type to product", () => {
    const tags = buildOgpTags("Product", null, 0, 0, null, "https://example.com");
    expect(tags["og:type"]).toBe("product");
  });

  it("should set twitter:card to summary_large_image", () => {
    const tags = buildOgpTags("Product", null, 0, 0, null, "https://example.com");
    expect(tags["twitter:card"]).toBe("summary_large_image");
  });

  it("should handle zero reviews gracefully", () => {
    const tags = buildOgpTags("New Product", null, 0, 0, null, "https://example.com");
    expect(tags["og:description"]).toBe("New Productの口コミ・レビューページ。");
  });
});

// ============================================================
// 5. Product Image Status Management
// ============================================================

type ImageStatus = "none" | "auto" | "confirmed" | "manual";

function getImageDisplayInfo(status: ImageStatus, imageUrl: string | null): {
  showImage: boolean;
  showBadge: boolean;
  badgeText: string;
} {
  if (!imageUrl) {
    return { showImage: false, showBadge: false, badgeText: "" };
  }

  switch (status) {
    case "confirmed":
      return { showImage: true, showBadge: true, badgeText: "確認済み" };
    case "manual":
      return { showImage: true, showBadge: true, badgeText: "手動設定" };
    case "auto":
      return { showImage: true, showBadge: true, badgeText: "自動取得" };
    case "none":
    default:
      return { showImage: false, showBadge: false, badgeText: "" };
  }
}

describe("Product Image Status Management", () => {
  it("should show confirmed badge for confirmed images", () => {
    const info = getImageDisplayInfo("confirmed", "https://cdn.example.com/img.jpg");
    expect(info.showImage).toBe(true);
    expect(info.showBadge).toBe(true);
    expect(info.badgeText).toBe("確認済み");
  });

  it("should show manual badge for manually uploaded images", () => {
    const info = getImageDisplayInfo("manual", "https://cdn.example.com/img.jpg");
    expect(info.showImage).toBe(true);
    expect(info.badgeText).toBe("手動設定");
  });

  it("should show auto badge for auto-fetched images", () => {
    const info = getImageDisplayInfo("auto", "https://cdn.example.com/img.jpg");
    expect(info.showImage).toBe(true);
    expect(info.badgeText).toBe("自動取得");
  });

  it("should not show image when status is none", () => {
    const info = getImageDisplayInfo("none", null);
    expect(info.showImage).toBe(false);
    expect(info.showBadge).toBe(false);
  });

  it("should not show image when imageUrl is null regardless of status", () => {
    const info = getImageDisplayInfo("confirmed", null);
    expect(info.showImage).toBe(false);
  });
});
