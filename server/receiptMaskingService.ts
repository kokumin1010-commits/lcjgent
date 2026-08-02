/**
 * Receipt Image Masking Service
 * レシート画像の個人情報（名前、住所、電話番号等）をAI検出＋Sharpぼかし処理で自動マスキング
 * 
 * Flow:
 * 1. 画像をgpt-4o-mini Visionに送信し、個人情報の位置を検出
 * 2. 検出された領域をSharpでぼかし処理
 * 3. マスキング済み画像をS3にアップロード
 * 4. DBにマスキング済みURLを保存
 */

import * as sharp from "sharp";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// ===== Types =====

interface PersonalInfoRegion {
  type: "name" | "phone" | "address" | "postal_code" | "card_number" | "email" | "other";
  description: string;
  // Relative coordinates (0-1 range, percentage of image dimensions)
  x: number; // left edge
  y: number; // top edge
  width: number;
  height: number;
  confidence: number; // 0-1
}

interface DetectionResult {
  regions: PersonalInfoRegion[];
  hasPersonalInfo: boolean;
  summary: string;
}

interface MaskingResult {
  success: boolean;
  maskedImageUrl: string | null;
  maskedImageKey: string | null;
  regionsDetected: number;
  error?: string;
  processingTimeMs: number;
}

// ===== AI Detection =====

/**
 * AI Visionを使って画像内の個人情報の位置を検出
 */
export async function detectPersonalInfo(imageUrl: string): Promise<DetectionResult> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたは画像内の個人情報（PII: Personally Identifiable Information）を検出する専門AIです。

以下の個人情報を検出し、画像内での位置を相対座標（0〜1の範囲、画像全体に対する割合）で返してください。

【検出対象】
1. 名前（漢字・カタカナ・ひらがな・ローマ字）- 配送先の名前、注文者名
2. 電話番号 - 080/090/070で始まる番号、+81形式、固定電話
3. 住所 - 都道府県〜番地、マンション名・部屋番号
4. 郵便番号 - XXX-XXXX形式
5. カード番号 - クレジットカード番号の一部でも
6. メールアドレス

【検出しない（残す）もの】
- 商品名・商品画像
- 金額・価格
- 注文番号
- ショップ名・ブランド名
- 配送ステータス（配達済み等）
- 配送業者名

【座標の返し方】
- x: 個人情報テキストの左端の位置（0=画像の左端、1=画像の右端）
- y: 個人情報テキストの上端の位置（0=画像の上端、1=画像の下端）
- width: テキスト領域の幅（画像幅に対する割合）
- height: テキスト領域の高さ（画像高さに対する割合）

【重要ルール】
- 少しでも個人情報が含まれる可能性がある場合は検出する（過検出OK、見逃しNG）
- 「配送先住所」セクション全体を1つの大きな領域として検出してもOK
- 座標は多少大きめに取る（周囲に5%程度のマージンを含める）
- confidenceは検出確度（0.5以上なら検出対象とする）

必ずJSON形式のみで回答してください。`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "この画像内の個人情報（名前、住所、電話番号、郵便番号、カード番号、メールアドレス）の位置を検出してください。検出された各領域の相対座標を返してください。",
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "personal_info_detection",
          strict: false,
          schema: {
            type: "object",
            properties: {
              hasPersonalInfo: {
                type: "boolean",
                description: "個人情報が検出されたかどうか",
              },
              summary: {
                type: "string",
                description: "検出結果の概要（例：名前1件、住所1件、電話番号1件を検出）",
              },
              regions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["name", "phone", "address", "postal_code", "card_number", "email", "other"],
                      description: "個人情報の種類",
                    },
                    description: {
                      type: "string",
                      description: "検出された内容の説明（例：配送先の名前「田中太郎」）",
                    },
                    x: {
                      type: "number",
                      description: "左端のX座標（0-1）",
                    },
                    y: {
                      type: "number",
                      description: "上端のY座標（0-1）",
                    },
                    width: {
                      type: "number",
                      description: "幅（0-1）",
                    },
                    height: {
                      type: "number",
                      description: "高さ（0-1）",
                    },
                    confidence: {
                      type: "number",
                      description: "検出確度（0-1）",
                    },
                  },
                  required: ["type", "description", "x", "y", "width", "height", "confidence"],
                },
                description: "検出された個人情報領域のリスト",
              },
            },
            required: ["hasPersonalInfo", "summary", "regions"],
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return { regions: [], hasPersonalInfo: false, summary: "AI応答なし" };
    }

    let parsed: any;
    try {
      // Remove markdown code fences if present
      let jsonStr: string = content;
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[MaskingService] Failed to parse AI response:", content);
      return { regions: [], hasPersonalInfo: false, summary: "AI応答パースエラー" };
    }

    // Filter regions with confidence >= 0.5
    const validRegions = (parsed.regions || []).filter(
      (r: PersonalInfoRegion) => r.confidence >= 0.5 && r.width > 0 && r.height > 0
    );

    return {
      regions: validRegions,
      hasPersonalInfo: parsed.hasPersonalInfo || validRegions.length > 0,
      summary: parsed.summary || `${validRegions.length}件の個人情報を検出`,
    };
  } catch (error: any) {
    console.error("[MaskingService] Detection error:", error.message);
    return { regions: [], hasPersonalInfo: false, summary: `検出エラー: ${error.message}` };
  }
}

// ===== Image Masking with Sharp =====

/**
 * 検出された領域にぼかし処理を適用
 */
export async function applyMasking(
  imageBuffer: Buffer,
  regions: PersonalInfoRegion[]
): Promise<Buffer> {
  if (regions.length === 0) return imageBuffer;

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const imgWidth = metadata.width || 1;
  const imgHeight = metadata.height || 1;

  // Create composite operations for each region
  // Strategy: Extract each region, blur it heavily, then composite back
  let result = sharp(imageBuffer);

  for (const region of regions) {
    // Convert relative coordinates to absolute pixels
    const left = Math.max(0, Math.floor(region.x * imgWidth));
    const top = Math.max(0, Math.floor(region.y * imgHeight));
    const width = Math.min(imgWidth - left, Math.ceil(region.width * imgWidth));
    const height = Math.min(imgHeight - top, Math.ceil(region.height * imgHeight));

    if (width <= 0 || height <= 0) continue;

    // Extract the region, apply heavy blur, then create an overlay
    const blurredRegion = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .blur(Math.max(15, Math.min(width, height) / 3)) // Heavy blur proportional to region size
      .toBuffer();

    // Composite the blurred region back onto the image
    const currentBuffer = await result.toBuffer();
    result = sharp(currentBuffer).composite([
      {
        input: blurredRegion,
        left,
        top,
      },
    ]);
  }

  return await result.jpeg({ quality: 85 }).toBuffer();
}

// ===== End-to-End Masking =====

/**
 * 画像URLからマスキング済み画像を生成してS3にアップロード
 */
export async function maskReceiptImage(
  imageUrl: string,
  receiptId: number | string,
  prefix: string = "masked-receipts"
): Promise<MaskingResult> {
  const startTime = Date.now();

  try {
    // 1. Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return {
        success: false,
        maskedImageUrl: null,
        maskedImageKey: null,
        regionsDetected: 0,
        error: `画像ダウンロード失敗: HTTP ${response.status}`,
        processingTimeMs: Date.now() - startTime,
      };
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // 2. Detect personal info regions
    const detection = await detectPersonalInfo(imageUrl);

    if (!detection.hasPersonalInfo || detection.regions.length === 0) {
      // No personal info detected - still save a copy as "masked" (original is safe)
      return {
        success: true,
        maskedImageUrl: imageUrl, // Use original since no PII found
        maskedImageKey: null,
        regionsDetected: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 3. Apply masking (blur)
    const maskedBuffer = await applyMasking(imageBuffer, detection.regions);

    // 4. Upload to S3
    const fileKey = `${prefix}/${receiptId}-${nanoid(8)}.jpg`;
    const { url: maskedUrl } = await storagePut(fileKey, maskedBuffer, "image/jpeg");

    console.log(
      `[MaskingService] Masked ${detection.regions.length} regions for receipt ${receiptId}: ${detection.summary}`
    );

    return {
      success: true,
      maskedImageUrl: maskedUrl,
      maskedImageKey: fileKey,
      regionsDetected: detection.regions.length,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error(`[MaskingService] Error masking receipt ${receiptId}:`, error.message);
    return {
      success: false,
      maskedImageUrl: null,
      maskedImageKey: null,
      regionsDetected: 0,
      error: error.message,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * 複数画像を一括マスキング
 */
export async function maskMultipleImages(
  imageUrls: string[],
  receiptId: number | string,
  prefix: string = "masked-receipts"
): Promise<MaskingResult[]> {
  const results: MaskingResult[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    if (!url || !url.startsWith("http")) {
      results.push({
        success: false,
        maskedImageUrl: null,
        maskedImageKey: null,
        regionsDetected: 0,
        error: "無効なURL",
        processingTimeMs: 0,
      });
      continue;
    }

    const result = await maskReceiptImage(url, `${receiptId}-img${i}`, prefix);
    results.push(result);

    // Rate limiting: wait 500ms between API calls
    if (i < imageUrls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
