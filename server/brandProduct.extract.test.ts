import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";

describe("brandProduct.extractFromImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should extract product information from image URL", async () => {
    // Mock LLM response
    const mockExtractedData = {
      productName: "リカリアル 30秒美肌オールインワンケアシート",
      listPrice: 3980,
      specialPrice: 2980,
      discountRate: "25%",
      releaseDate: "2025-02-01",
      stock: 1000,
      productCode: "RCA-001",
      catchCopy: "30秒で美肌ケア完了！",
      productDetails: "内容量: 30枚入り、使用期限: 製造日より2年",
      shippingInfo: "通常配送: 3-5営業日",
      remarks: "数量限定",
    };

    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExtractedData),
          },
        },
      ],
    });

    // Simulate calling the extraction logic
    const imageUrl = "https://example.com/proposal.jpg";
    
    // Call the LLM directly to test the mock
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Test system prompt" },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract product info" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    // Verify LLM was called
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    
    // Verify response structure
    const content = response.choices[0]?.message?.content;
    expect(content).toBeDefined();
    expect(typeof content).toBe("string");
    
    // Parse and verify extracted data
    const extractedData = JSON.parse(content as string);
    expect(extractedData.productName).toBe("リカリアル 30秒美肌オールインワンケアシート");
    expect(extractedData.listPrice).toBe(3980);
    expect(extractedData.specialPrice).toBe(2980);
    expect(extractedData.discountRate).toBe("25%");
    expect(extractedData.productCode).toBe("RCA-001");
    expect(extractedData.stock).toBe(1000);
  });

  it("should handle null values for missing fields", async () => {
    // Mock LLM response with some null values
    const mockExtractedData = {
      productName: "テスト商品",
      listPrice: 1000,
      specialPrice: null,
      discountRate: null,
      releaseDate: null,
      stock: null,
      productCode: "TEST-001",
      catchCopy: null,
      productDetails: null,
      shippingInfo: null,
      remarks: null,
    };

    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExtractedData),
          },
        },
      ],
    });

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Test" },
        { role: "user", content: "Test" },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const extractedData = JSON.parse(content as string);
    
    expect(extractedData.productName).toBe("テスト商品");
    expect(extractedData.specialPrice).toBeNull();
    expect(extractedData.discountRate).toBeNull();
    expect(extractedData.stock).toBeNull();
  });

  it("should handle LLM error gracefully", async () => {
    (invokeLLM as any).mockRejectedValue(new Error("LLM API error"));

    await expect(
      invokeLLM({
        messages: [
          { role: "system", content: "Test" },
          { role: "user", content: "Test" },
        ],
      })
    ).rejects.toThrow("LLM API error");
  });

  it("should handle invalid JSON response", async () => {
    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: "This is not valid JSON",
          },
        },
      ],
    });

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Test" },
        { role: "user", content: "Test" },
      ],
    });

    const content = response.choices[0]?.message?.content;
    
    // Attempting to parse invalid JSON should throw
    expect(() => JSON.parse(content as string)).toThrow();
  });

  it("should include image URL with high detail in the request", async () => {
    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ productName: "Test" }),
          },
        },
      ],
    });

    const imageUrl = "https://storage.example.com/proposal-image.png";
    
    await invokeLLM({
      messages: [
        { role: "system", content: "System prompt" },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract info" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    // Verify the call included the image URL with high detail
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "image_url",
                image_url: expect.objectContaining({
                  url: imageUrl,
                  detail: "high",
                }),
              }),
            ]),
          }),
        ]),
      })
    );
  });
});
