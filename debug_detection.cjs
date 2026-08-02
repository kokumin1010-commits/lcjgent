/**
 * Debug: Why is the test script not detecting PII?
 */
require('dotenv').config({ path: '/home/ubuntu/lcj-site/.env' });
const fs = require('fs');
const sharp = require('sharp');

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const MIN_CONFIDENCE = 0.4;

const SYSTEM_PROMPT = `あなたは画像内の個人情報（PII: Personally Identifiable Information）を検出する専門AIです。
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
{"hasPersonalInfo": true/false, "summary": "検出概要", "regions": [...]}`;

async function callAPI(dataUrl) {
  const body = {
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
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

function parseResponse(content) {
  let jsonStr = content.trim();
  // Remove markdown code fences
  if (jsonStr.includes("```")) {
    const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      jsonStr = match[1].trim();
      console.log("  [parse] Extracted from code fence");
    }
  }
  // Try to find JSON object
  if (!jsonStr.startsWith("{")) {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
      console.log("  [parse] Extracted JSON object from text");
    }
  }
  return JSON.parse(jsonStr);
}

async function main() {
  console.log("=== Debug Detection Test ===");
  console.log("API URL:", FORGE_API_URL ? "SET" : "MISSING");
  console.log("API KEY:", FORGE_API_KEY ? FORGE_API_KEY.substring(0, 10) + "..." : "MISSING");

  // Test with japanese receipt
  const imgPath = "/home/ubuntu/upload/search_images/dZGxP8WiV0OP.png";
  console.log("\nImage:", imgPath);

  const buffer = fs.readFileSync(imgPath);
  console.log("Original size:", buffer.length, "bytes");

  const resized = await sharp(buffer).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  console.log("Resized:", resized.length, "bytes");

  const base64 = resized.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  console.log("DataURL length:", dataUrl.length);

  console.log("\nCalling API...");
  const content = await callAPI(dataUrl);
  console.log("\nRaw response length:", content.length);
  console.log("Raw response (first 1000):", content.substring(0, 1000));

  try {
    const parsed = parseResponse(content);
    console.log("\n=== Parsed Result ===");
    console.log("hasPersonalInfo:", parsed.hasPersonalInfo);
    console.log("summary:", parsed.summary);
    console.log("regions count:", parsed.regions?.length);

    const validRegions = (parsed.regions || []).filter(
      (r) => r.confidence >= MIN_CONFIDENCE && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x <= 1 && r.y <= 1
    );
    console.log("Valid regions after filter:", validRegions.length);
    validRegions.forEach((r) => {
      console.log(`  - ${r.type}: ${r.description} (conf: ${r.confidence}, x:${r.x} y:${r.y} w:${r.width} h:${r.height})`);
    });
  } catch (e) {
    console.log("Parse error:", e.message);
  }
}

main().catch(console.error);
