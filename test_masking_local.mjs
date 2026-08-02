/**
 * レシート画像マスキングテスト（ローカル画像使用）
 * lcj-siteのFORGE APIを使ってVision検出 → Sharpでぼかし処理
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// FORGE API設定
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_API_URL || !FORGE_API_KEY) {
  console.error("ERROR: BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY are required");
  console.log("URL:", FORGE_API_URL ? "SET" : "NOT SET");
  console.log("KEY:", FORGE_API_KEY ? "SET" : "NOT SET");
  process.exit(1);
}

// テスト用画像（ローカルファイル → base64でVision APIに送信）
const TEST_IMAGES = [
  { path: "/home/ubuntu/upload/search_images/FTSjcgo19Zim.png", desc: "TikTok Shop Customer Info (name, phone, address)" },
  { path: "/home/ubuntu/upload/search_images/dZGxP8WiV0OP.png", desc: "日本の領収書 (名前: 佐藤鈴木, 住所, 電話番号)" },
  { path: "/home/ubuntu/upload/search_images/CiENEQH1RWsY.png", desc: "Invoice (addresses, emails, phone numbers)" },
  { path: "/home/ubuntu/upload/search_images/Bh30VIaGEcDy.png", desc: "配送先住所設定画面 (住所, 電話番号)" },
  { path: "/home/ubuntu/upload/search_images/9OKFJ46smr4H.jpeg", desc: "Proof of Delivery (address info)" },
];

/**
 * AI Vision APIで個人情報の座標を検出
 */
async function detectPersonalInfo(imageBase64, mimeType) {
  const apiUrl = `${FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`;
  
  const systemPrompt = `あなたは画像内の個人情報を検出するAIです。
レシート画像や配送画像から以下の個人情報を検出し、その位置を返してください：

検出対象：
- 氏名（漢字・カタカナ・ひらがな・ローマ字）
- 電話番号（+81, 0X0-XXXX-XXXX, (+1)XXX等）
- 住所（都道府県〜番地、マンション名、部屋番号、海外住所も含む）
- 郵便番号（XXX-XXXX、zipcode）
- メールアドレス
- クレジットカード番号

重要：
- 画像の幅と高さを1.0として正規化した座標で返してください
- 各検出領域は矩形（左上x, 左上y, 幅, 高さ）で表現
- 個人情報が含まれない領域は返さないでください
- 商品名、金額、注文番号、ショップ名、会社名は個人情報ではないので検出しないでください
- ただし、個人の名前（宛名）は検出してください

JSON形式で返してください：
{
  "regions": [
    {
      "type": "name|phone|address|postal_code|email|card_number",
      "text": "検出したテキスト",
      "bbox": [x, y, width, height]
    }
  ],
  "has_personal_info": true/false
}`;

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "この画像内の個人情報を検出してください。座標は画像全体を1.0x1.0として正規化してください。" },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Vision API");

  return JSON.parse(content);
}

/**
 * Sharpでぼかし処理
 */
async function applyBlur(imageBuffer, regions) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height || regions.length === 0) {
    return { buffer: imageBuffer, applied: 0 };
  }

  let compositeOps = [];

  for (const region of regions) {
    const [rx, ry, rw, rh] = region.bbox;
    
    // 正規化座標を実際のピクセルに変換（少し余白を追加）
    const padding = 0.01;
    const left = Math.max(0, Math.floor((rx - padding) * width));
    const top = Math.max(0, Math.floor((ry - padding) * height));
    const regionWidth = Math.min(width - left, Math.ceil((rw + padding * 2) * width));
    const regionHeight = Math.min(height - top, Math.ceil((rh + padding * 2) * height));

    if (regionWidth <= 2 || regionHeight <= 2) continue;

    try {
      // 領域を切り出してぼかし
      const blurredRegion = await sharp(imageBuffer)
        .extract({ left, top, width: regionWidth, height: regionHeight })
        .blur(Math.max(20, Math.min(regionWidth, regionHeight) / 3)) // 強めのぼかし
        .toBuffer();

      compositeOps.push({
        input: blurredRegion,
        left,
        top,
      });
    } catch (e) {
      console.warn(`    ⚠️ ぼかし処理スキップ: ${e.message} (region: ${JSON.stringify(region.bbox)})`);
    }
  }

  if (compositeOps.length === 0) return { buffer: imageBuffer, applied: 0 };

  // 元画像にぼかし領域を合成
  const result = await sharp(imageBuffer)
    .composite(compositeOps)
    .png()
    .toBuffer();

  return { buffer: result, applied: compositeOps.length };
}

/**
 * メイン処理
 */
async function main() {
  console.log("=== レシート画像マスキングテスト（ローカル画像） ===\n");
  console.log(`API URL: ${FORGE_API_URL.substring(0, 40)}...`);
  console.log(`テスト画像数: ${TEST_IMAGES.length}\n`);

  const outputDir = "/home/ubuntu/masking_test_output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TEST_IMAGES.length; i++) {
    const { path: imgPath, desc } = TEST_IMAGES[i];
    console.log(`\n--- 画像 ${i + 1}/${TEST_IMAGES.length}: ${desc} ---`);
    console.log(`  ファイル: ${path.basename(imgPath)}`);

    try {
      // 1. 画像読み込み
      const imageBuffer = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/png';
      const base64 = imageBuffer.toString('base64');
      console.log(`  サイズ: ${(imageBuffer.length / 1024).toFixed(1)}KB`);

      // 2. AI Vision検出
      console.log("  AI Vision で個人情報検出中...");
      const startTime = Date.now();
      const detection = await detectPersonalInfo(base64, mimeType);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  検出完了 (${elapsed}s)`);
      console.log(`  個人情報: ${detection.has_personal_info ? "✅ あり" : "❌ なし"}`);
      
      if (detection.regions && detection.regions.length > 0) {
        console.log(`  検出領域数: ${detection.regions.length}`);
        for (const region of detection.regions) {
          console.log(`    - [${region.type}] "${region.text}" @ [${region.bbox.map(v => v.toFixed(3)).join(", ")}]`);
        }

        // 3. ぼかし処理
        console.log("  ぼかし処理中...");
        const { buffer: maskedBuffer, applied } = await applyBlur(imageBuffer, detection.regions);
        const outputPath = path.join(outputDir, `masked_${i + 1}${ext}`);
        fs.writeFileSync(outputPath, maskedBuffer);
        console.log(`  ✅ マスキング完了: ${applied}箇所ぼかし適用`);
        console.log(`  出力: ${outputPath} (${(maskedBuffer.length / 1024).toFixed(1)}KB)`);
        successCount++;
      } else {
        console.log("  ℹ️ 個人情報が検出されませんでした（マスキング不要）");
        const outputPath = path.join(outputDir, `masked_${i + 1}${ext}`);
        fs.writeFileSync(outputPath, imageBuffer);
        successCount++;
      }

      // 検出結果をJSONで保存
      fs.writeFileSync(
        path.join(outputDir, `detection_${i + 1}.json`),
        JSON.stringify(detection, null, 2)
      );

    } catch (error) {
      console.error(`  ❌ エラー: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n\n=== 結果サマリー ===`);
  console.log(`成功: ${successCount}/${TEST_IMAGES.length}`);
  console.log(`失敗: ${failCount}/${TEST_IMAGES.length}`);
  console.log(`出力先: ${outputDir}/`);
  console.log(`\n確認方法: ls ${outputDir}/`);
}

main().catch(console.error);
