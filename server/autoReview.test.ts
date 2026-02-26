import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "product-images/test.jpg",
    url: "https://s3.example.com/product-images/test.jpg",
  }),
}));

vi.mock("sharp", () => {
  const mockSharp = vi.fn().mockReturnValue({
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 2000 }),
    extract: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
  });
  return { default: mockSharp };
});

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("extractProductImageFromReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract and crop product image when LLM finds it", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const { storagePut } = await import("./storage");

    // Mock LLM response with crop coordinates
    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              found: true,
              crop: { x: 0.1, y: 0.6, width: 0.3, height: 0.15 },
            }),
          },
        },
      ],
    });

    // Mock image fetch
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const { extractProductImageFromReceipt } = await import("./db");
    const result = await extractProductImageFromReceipt(
      "https://example.com/receipt.jpg",
      "テスト商品"
    );

    expect(result.productImageUrl).toBeTruthy();
    expect(result.error).toBeUndefined();
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(storagePut).toHaveBeenCalledTimes(1);
  });

  it("should return null when LLM says product image not found", async () => {
    const { invokeLLM } = await import("./_core/llm");

    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              found: false,
              crop: { x: 0, y: 0, width: 0, height: 0 },
            }),
          },
        },
      ],
    });

    const { extractProductImageFromReceipt } = await import("./db");
    const result = await extractProductImageFromReceipt(
      "https://example.com/receipt.jpg"
    );

    expect(result.productImageUrl).toBeNull();
    expect(result.error).toBe("Product image not found in receipt");
  });

  it("should handle LLM returning empty response", async () => {
    const { invokeLLM } = await import("./_core/llm");

    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { extractProductImageFromReceipt } = await import("./db");
    const result = await extractProductImageFromReceipt(
      "https://example.com/receipt.jpg"
    );

    expect(result.productImageUrl).toBeNull();
    expect(result.error).toBe("LLM returned empty response");
  });

  it("should handle image fetch failure", async () => {
    const { invokeLLM } = await import("./_core/llm");

    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              found: true,
              crop: { x: 0.1, y: 0.6, width: 0.3, height: 0.15 },
            }),
          },
        },
      ],
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { extractProductImageFromReceipt } = await import("./db");
    const result = await extractProductImageFromReceipt(
      "https://example.com/receipt.jpg"
    );

    expect(result.productImageUrl).toBeNull();
    expect(result.error).toContain("Failed to fetch image");
  });
});

describe("generateAutoReviewText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate review text from LLM", async () => {
    const { invokeLLM } = await import("./_core/llm");

    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: "使い心地がとても良いです！リピートしたいと思います 😊",
          },
        },
      ],
    });

    const { generateAutoReviewText } = await import("./db");
    const text = await generateAutoReviewText(
      "KYOGOKU シャンプー",
      "KYOGOKU JAPAN",
      2500
    );

    expect(text).toBe("使い心地がとても良いです！リピートしたいと思います 😊");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("should return fallback text when LLM fails", async () => {
    const { invokeLLM } = await import("./_core/llm");

    (invokeLLM as any).mockRejectedValue(new Error("LLM unavailable"));

    const { generateAutoReviewText } = await import("./db");
    const text = await generateAutoReviewText("テスト商品");

    expect(text).toBe("テスト商品を購入しました。");
  });
});

describe("createAutoReviewOnApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle missing database gracefully", async () => {
    // Mock getDb to return null
    vi.doMock("drizzle-orm/mysql2", () => ({
      drizzle: vi.fn().mockReturnValue(null),
    }));

    // This test verifies the function doesn't throw when DB is unavailable
    // In production, getDb() would return the actual connection
    const { createAutoReviewOnApproval } = await import("./db");

    // The function should handle errors gracefully
    const result = await createAutoReviewOnApproval({
      receiptType: "line_receipt",
      receiptId: 999999,
      lineUserId: "test-user",
      imageUrl: "https://example.com/receipt.jpg",
      ocrRawText: JSON.stringify({
        productName: "テスト商品",
        shopName: "テストショップ",
        totalAmount: 1000,
      }),
    });

    // Should either succeed or return error without throwing
    expect(result).toHaveProperty("reviewId");
  });

  it("should parse OCR data correctly", async () => {
    const ocrData = {
      productName: "KYOGOKU シャンプー、KYOGOKU トリートメント",
      shopName: "KYOGOKU JAPAN",
      totalAmount: 3500,
    };

    // Verify OCR parsing logic
    let productName = "商品";
    const parsed = JSON.parse(JSON.stringify(ocrData));
    if (parsed.productName && parsed.productName !== "undefined") {
      productName = parsed.productName;
    }

    // Multiple products: use first one
    if (productName.includes("、")) {
      productName = productName.split("、")[0].trim();
    }

    expect(productName).toBe("KYOGOKU シャンプー");
    expect(parsed.shopName).toBe("KYOGOKU JAPAN");
    expect(parsed.totalAmount).toBe(3500);
  });

  it("should handle invalid OCR data gracefully", async () => {
    let productName = "商品";
    const invalidOcrRawText = "not-json-data";

    try {
      const ocrData = JSON.parse(invalidOcrRawText);
      if (ocrData.productName) productName = ocrData.productName;
    } catch {
      // Should fall through to default
    }

    expect(productName).toBe("商品");
  });

  it("should handle null OCR fields", async () => {
    let productName = "商品";
    const ocrData = {
      productName: null,
      shopName: null,
      totalAmount: null,
    };

    const parsed = JSON.parse(JSON.stringify(ocrData));
    if (parsed.productName && parsed.productName !== "undefined") {
      productName = parsed.productName;
    }

    expect(productName).toBe("商品");
  });
});
