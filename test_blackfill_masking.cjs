/**
 * テスト: 黒塗り版マスキング（PERFECT EDITION）
 * lcj-siteのFORGE APIを使って5枚テスト
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// lcj-site env
require("dotenv").config({ path: "/home/ubuntu/lcj-site/.env" });
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const PADDING_PX = 40;
const MASK_COLOR = { r: 30, g: 30, b: 30, alpha: 255 };
const MIN_CONFIDENCE = 0.4;

const OUTPUT_DIR = "/home/ubuntu/masking_test_blackfill";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Test images (from previous test)
const TEST_IMAGES = [
  { path: "/home/ubuntu/upload/search_images/FTSjcgo19Zim.png", name: "tiktok_customer_info" },
  { path: "/home/ubuntu/upload/search_images/dZGxP8WiV0OP.png", name: "japanese_receipt" },
  { path: "/home/ubuntu/upload/search_images/CiENEQH1RWsY.png", name: "invoice_english" },
  { path: "/home/ubuntu/real_receipts/receipt_3.png", name: "lcjmall_receipt_3" },
  { path: "/home/ubuntu/real_receipts/receipt_5.png", name: "lcjmall_receipt_5" },
];

async function callVisionAPI(base64DataUrl, prompt) {
  const body = {
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `あなたは画像内の個人情報（PII: Personally Identifiable Information）を検出する専門AIです。
画像を分析し、個人情報の位置を相対座標で返してください。

【検出対象 - 必ず全て検出すること】
1. 名前（漢字・カタカナ・ひらがな・ローマ字）- 配送先の名前、注文者名、受取人名
2. 電話番号 - 080/090/070で始まる番号、+81形式、固定電話、ハイフンあり/なし両方
3. 住所 - 都道府県〜番地、マンション名・部屋番号、英語住所も含む
4. 郵便番号 - XXX-XXXX形式、〒マーク付き
5. カード番号 - クレジットカード番号（下4桁のみでも）、visa(XXXX)形式も
6. メールアドレス - @を含むテキスト
7. 配送先セクション全体 - 「配送先」「お届け先」「Delivery Address」等のヘッダーから、そのセクション末尾まで

【検出しない（残す）もの】
- 商品名・商品画像・ブランドロゴ
- 金額・価格・割引額
- 注文番号
- ショップ名・ブランド名（KYOGOKU, LCJ等）
- 配送ステータス（配達済み等）
- 配送業者名
- 注文日時・配達日時

【座標の返し方】
- x: 個人情報テキストの左端の位置（0=画像の左端、1=画像の右端）
- y: 個人情報テキストの上端の位置（0=画像の上端、1=画像の下端）
- width: テキスト領域の幅（画像幅に対する割合）
- height: テキスト領域の高さ（画像高さに対する割合）

【最重要ルール】
- 過検出OK、見逃しNG（迷ったら検出する）
- 座標は大きめに取る（テキストの周囲に余裕を持たせる）
- 「配送先住所」セクションがある場合は、セクション全体を1つの大きな矩形で覆う
- 名前が複数箇所にある場合は全て検出する
- カード番号の下4桁表示（例: visa(1530)）も検出対象

必ずJSON形式のみで回答してください。他のテキストは一切含めないでください。
回答フォーマット:
{"hasPersonalInfo": true/false, "summary": "検出概要", "regions": [...]}`,
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: base64DataUrl, detail: "high" } },
          { type: "text", text: "この画像内の個人情報を全て検出し、JSON形式で座標を返してください。配送先セクションがある場合はセクション全体を大きく覆ってください。" },
        ],
      },
    ],
  };

  const resp = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API error ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function applyBlackFill(imageBuffer, regions) {
  if (regions.length === 0) return imageBuffer;

  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 1;
  const imgHeight = metadata.height || 1;

  const compositeOps = [];

  for (const region of regions) {
    const rawLeft = Math.floor(region.x * imgWidth);
    const rawTop = Math.floor(region.y * imgHeight);
    const rawWidth = Math.ceil(region.width * imgWidth);
    const rawHeight = Math.ceil(region.height * imgHeight);

    const left = Math.max(0, rawLeft - PADDING_PX);
    const top = Math.max(0, rawTop - PADDING_PX);
    const right = Math.min(imgWidth, rawLeft + rawWidth + PADDING_PX);
    const bottom = Math.min(imgHeight, rawTop + rawHeight + PADDING_PX);
    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) continue;

    const blackRect = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: MASK_COLOR,
      },
    })
      .png()
      .toBuffer();

    compositeOps.push({ input: blackRect, left, top });
  }

  if (compositeOps.length === 0) return imageBuffer;

  return await sharp(imageBuffer).composite(compositeOps).jpeg({ quality: 90 }).toBuffer();
}

async function processImage(imgInfo, index) {
  console.log(`\n=== [${index + 1}/5] ${imgInfo.name} ===`);
  const startTime = Date.now();

  // Read and resize for API (max 1024px to avoid token issues)
  const buffer = fs.readFileSync(imgInfo.path);
  const resized = await sharp(buffer).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
  const base64 = resized.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  console.log(`  画像サイズ: ${buffer.length} → ${resized.length} bytes (リサイズ済み)`);

  // Detect
  console.log("  検出中...");
  const aiResponse = await callVisionAPI(dataUrl, "detect");

  let parsed;
  try {
    let jsonStr = aiResponse.trim();
    if (jsonStr.includes("```")) {
      const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) jsonStr = match[1].trim();
    }
    if (!jsonStr.startsWith("{")) {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error("  ❌ JSON parse error:", aiResponse.substring(0, 200));
    return { success: false, name: imgInfo.name, error: "parse_error" };
  }

  // Normalize regions: confidence defaults to 1.0 if missing, description falls back to text
  const regions = (parsed.regions || []).map(r => ({
    ...r,
    confidence: r.confidence ?? 1.0,
    description: r.description || r.text || r.type,
  })).filter(
    (r) => r.confidence >= MIN_CONFIDENCE && r.width > 0 && r.height > 0
  );

  console.log(`  検出結果: ${regions.length}件`);
  regions.forEach((r) => {
    console.log(`    - ${r.type}: ${r.description} (conf: ${r.confidence})`);
  });

  if (regions.length === 0) {
    console.log("  → 個人情報なし（マスキング不要）");
    // Copy original
    const outPath = path.join(OUTPUT_DIR, `${index + 1}_${imgInfo.name}_no_pii.jpg`);
    fs.writeFileSync(outPath, buffer);
    return { success: true, name: imgInfo.name, regions: 0, time: Date.now() - startTime };
  }

  // Apply black fill on the ORIGINAL image (not resized) for best quality
  console.log("  黒塗り処理中...");
  const maskedBuffer = await applyBlackFill(buffer, regions);

  // Save
  const outPath = path.join(OUTPUT_DIR, `${index + 1}_${imgInfo.name}_masked.jpg`);
  fs.writeFileSync(outPath, maskedBuffer);
  console.log(`  ✓ 保存: ${outPath}`);

  const elapsed = Date.now() - startTime;
  console.log(`  処理時間: ${(elapsed / 1000).toFixed(1)}s`);

  return { success: true, name: imgInfo.name, regions: regions.length, time: elapsed };
}

async function main() {
  console.log("=== 黒塗りマスキングテスト（PERFECT EDITION） ===");
  console.log(`パディング: ${PADDING_PX}px | 最低信頼度: ${MIN_CONFIDENCE}`);
  console.log(`出力先: ${OUTPUT_DIR}\n`);

  const results = [];
  for (let i = 0; i < TEST_IMAGES.length; i++) {
    if (!fs.existsSync(TEST_IMAGES[i].path)) {
      console.log(`  ⚠️ ファイルなし: ${TEST_IMAGES[i].path}`);
      continue;
    }
    const result = await processImage(TEST_IMAGES[i], i);
    results.push(result);
    // Rate limit
    if (i < TEST_IMAGES.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n\n=== 最終結果 ===");
  results.forEach((r) => {
    if (r.success) {
      console.log(`  ✓ ${r.name}: ${r.regions}件検出, ${(r.time / 1000).toFixed(1)}s`);
    } else {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    }
  });
  console.log(`\n成功: ${results.filter((r) => r.success).length}/${results.length}`);
}

main().catch(console.error);
