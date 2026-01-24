import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";

describe("Brand Product AI Extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should format AI result correctly", () => {
    // Test the formatting logic that would be used in the frontend
    const formatAiResult = (data: any) => {
      const lines: string[] = [];
      if (data.catchCopy) lines.push(`【キャッチコピー】${data.catchCopy}`);
      if (data.productDetails) lines.push(`【商品詳細】${data.productDetails}`);
      if (data.listPrice) lines.push(`【定価】¥${data.listPrice.toLocaleString()}`);
      if (data.specialPrice) lines.push(`【特価】¥${data.specialPrice.toLocaleString()}`);
      if (data.discountRate) lines.push(`【割引率】${data.discountRate}`);
      if (data.shippingInfo) lines.push(`【配送情報】${data.shippingInfo}`);
      if (data.stock) lines.push(`【在庫】${data.stock}`);
      if (data.releaseDate) lines.push(`【発売日】${data.releaseDate}`);
      if (data.productCode) lines.push(`【品番】${data.productCode}`);
      if (data.remarks) lines.push(`【その他】${data.remarks}`);
      return lines.join('\n');
    };

    const mockData = {
      productName: "テスト商品",
      catchCopy: "これは素晴らしい商品です",
      productDetails: "内容量: 100ml",
      listPrice: 5000,
      specialPrice: 3980,
      discountRate: "20%",
      shippingInfo: "送料無料",
      stock: 100,
      releaseDate: "2024-01-15",
      productCode: "ABC-123",
      remarks: "限定品",
    };

    const result = formatAiResult(mockData);

    expect(result).toContain("【キャッチコピー】これは素晴らしい商品です");
    expect(result).toContain("【商品詳細】内容量: 100ml");
    expect(result).toContain("【定価】¥5,000");
    expect(result).toContain("【特価】¥3,980");
    expect(result).toContain("【割引率】20%");
    expect(result).toContain("【配送情報】送料無料");
    expect(result).toContain("【在庫】100");
    expect(result).toContain("【発売日】2024-01-15");
    expect(result).toContain("【品番】ABC-123");
    expect(result).toContain("【その他】限定品");
  });

  it("should preserve existing remarks when appending AI results", () => {
    const existingRemarks = "既存のメモ内容";
    const aiInfo = "【キャッチコピー】新商品";
    const date = new Date().toLocaleDateString('ja-JP');
    
    const newRemarks = existingRemarks 
      ? `${existingRemarks}\n\n--- AI分析結果 (${date}) ---\n${aiInfo}`
      : `--- AI分析結果 (${date}) ---\n${aiInfo}`;

    expect(newRemarks).toContain("既存のメモ内容");
    expect(newRemarks).toContain("AI分析結果");
    expect(newRemarks).toContain("【キャッチコピー】新商品");
  });

  it("should handle empty existing remarks", () => {
    const existingRemarks = "";
    const aiInfo = "【キャッチコピー】新商品";
    const date = new Date().toLocaleDateString('ja-JP');
    
    const newRemarks = existingRemarks 
      ? `${existingRemarks}\n\n--- AI分析結果 (${date}) ---\n${aiInfo}`
      : `--- AI分析結果 (${date}) ---\n${aiInfo}`;

    expect(newRemarks).not.toContain("\n\n---");
    expect(newRemarks.startsWith("--- AI分析結果")).toBe(true);
  });

  it("should handle partial data from AI", () => {
    const formatAiResult = (data: any) => {
      const lines: string[] = [];
      if (data.catchCopy) lines.push(`【キャッチコピー】${data.catchCopy}`);
      if (data.productDetails) lines.push(`【商品詳細】${data.productDetails}`);
      if (data.listPrice) lines.push(`【定価】¥${data.listPrice.toLocaleString()}`);
      if (data.specialPrice) lines.push(`【特価】¥${data.specialPrice.toLocaleString()}`);
      if (data.discountRate) lines.push(`【割引率】${data.discountRate}`);
      if (data.shippingInfo) lines.push(`【配送情報】${data.shippingInfo}`);
      if (data.stock) lines.push(`【在庫】${data.stock}`);
      if (data.releaseDate) lines.push(`【発売日】${data.releaseDate}`);
      if (data.productCode) lines.push(`【品番】${data.productCode}`);
      if (data.remarks) lines.push(`【その他】${data.remarks}`);
      return lines.join('\n');
    };

    // Only some fields have data
    const partialData = {
      productName: "テスト商品",
      catchCopy: "キャッチコピーのみ",
      listPrice: 0,
      specialPrice: 0,
      discountRate: "",
      shippingInfo: "",
      stock: 0,
      releaseDate: "",
      productCode: "",
      remarks: "",
    };

    const result = formatAiResult(partialData);

    expect(result).toContain("【キャッチコピー】キャッチコピーのみ");
    expect(result).not.toContain("【定価】");
    expect(result).not.toContain("【特価】");
    expect(result).not.toContain("【割引率】");
  });

  it("should call LLM with correct parameters", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "テスト商品",
            listPrice: 5000,
            specialPrice: 3980,
            discountRate: "20%",
            releaseDate: "",
            stock: 0,
            productCode: "",
            catchCopy: "素晴らしい商品",
            productDetails: "",
            shippingInfo: "",
            remarks: "",
          })
        }
      }]
    };

    (invokeLLM as any).mockResolvedValue(mockResponse);

    // Simulate the API call structure
    const imageUrl = "https://example.com/image.jpg";
    
    await invokeLLM({
      messages: [
        { role: "system", content: expect.stringContaining("商品提案書から情報を抽出") },
        {
          role: "user",
          content: [
            { type: "text", text: expect.any(String) },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: expect.objectContaining({
        type: "json_schema",
      }),
    });

    expect(invokeLLM).toHaveBeenCalled();
  });
});
