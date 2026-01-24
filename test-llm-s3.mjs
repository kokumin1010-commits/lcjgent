// Test LLM Vision API with S3 image URL
import { config } from "dotenv";
config();

const ENV = {
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL,
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY,
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

// Test with JSON schema response format
async function testLLMVisionWithSchema(imageUrl) {
  const systemPrompt = `あなたは商品提案書から情報を抽出する専門家です。
提案書画像から以下の情報を正確に抽出してください。日本語のテキストを正確に読み取ってください。

抽出する情報：
- productName: 商品名（必須）
- listPrice: 公式価格・定価（数値のみ、円記号なし）
- specialPrice: ライブ価格・特別価格（数値のみ、円記号なし）
- discountRate: 割引率（例: "20%"）
- releaseDate: 発売日（YYYY-MM-DD形式）
- stock: 在庫数（数値のみ）
- productCode: 商品ID・コード品番
- catchCopy: キャッチコピー・特徴
- productDetails: 商品詳細（内容量、販売価格、生産ロット、使用期限など）
- shippingInfo: 配送情報
- remarks: その他の備考

画像から読み取れない情報はnullとしてください。`;

  const payload = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "この提案書画像から商品情報を抽出してください。" },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 32768,
    thinking: {
      budget_tokens: 128
    },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "product_info",
        strict: true,
        schema: {
          type: "object",
          properties: {
            productName: { type: "string", description: "商品名（不明な場合は空文字列）" },
            listPrice: { type: "number", description: "公式価格・定価（不明な場合は0）" },
            specialPrice: { type: "number", description: "ライブ価格・特別価格（不明な場合は0）" },
            discountRate: { type: "string", description: "割引率（不明な場合は空文字列）" },
            releaseDate: { type: "string", description: "発売日（不明な場合は空文字列）" },
            stock: { type: "number", description: "在庫数（不明な場合は0）" },
            productCode: { type: "string", description: "商品ID・コード品番（不明な場合は空文字列）" },
            catchCopy: { type: "string", description: "キャッチコピー・特徴（不明な場合は空文字列）" },
            productDetails: { type: "string", description: "商品詳細（不明な場合は空文字列）" },
            shippingInfo: { type: "string", description: "配送情報（不明な場合は空文字列）" },
            remarks: { type: "string", description: "その他の備考（不明な場合は空文字列）" },
          },
          required: [
            "productName",
            "listPrice",
            "specialPrice",
            "discountRate",
            "releaseDate",
            "stock",
            "productCode",
            "catchCopy",
            "productDetails",
            "shippingInfo",
            "remarks",
          ],
          additionalProperties: false,
        },
      },
    },
  };

  console.log("Testing with image URL:", imageUrl);
  console.log("Sending request to:", resolveApiUrl());

  try {
    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("Response status:", response.status, response.statusText);
    
    const responseText = await response.text();
    console.log("Response body:", responseText.substring(0, 2000));

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log("\n=== SUCCESS ===");
      console.log("Content:", result.choices?.[0]?.message?.content);
      if (result.choices?.[0]?.message?.content) {
        try {
          const parsed = JSON.parse(result.choices[0].message.content);
          console.log("\nParsed data:", JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log("Could not parse as JSON");
        }
      }
    } else {
      console.log("\n=== ERROR ===");
      console.log("Full response:", responseText);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Get image URL from command line or use a test URL
const imageUrl = process.argv[2] || "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png";
testLLMVisionWithSchema(imageUrl);
