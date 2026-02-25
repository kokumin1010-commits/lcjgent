/**
 * バッチ処理: レシート画像から商品部分を切り抜いてS3にアップロード
 * 
 * 処理フロー:
 * 1. productImageUrlが設定されているレビューを取得
 * 2. 各画像をLLM Vision APIで分析し、商品領域の座標を取得
 * 3. sharpで画像を切り抜き
 * 4. S3にアップロード
 * 5. DBのproductImageUrlを更新
 */
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const FORGE_API_URL = (process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.ai').replace(/\/$/, '');
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// 並列処理の設定
const CONCURRENCY = 3; // 同時処理数
const RETRY_MAX = 2;   // リトライ回数
const DELAY_MS = 500;  // リクエスト間のディレイ

// 処理結果の追跡
let processed = 0;
let succeeded = 0;
let failed = 0;
let skipped = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function invokeLLM(messages, responseFormat) {
  const payload = {
    model: 'gemini-2.5-flash',
    messages,
    max_tokens: 4096,
    thinking: { budget_tokens: 128 },
  };
  if (responseFormat) payload.response_format = responseFormat;

  const res = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error: ${res.status} ${err}`);
  }
  return await res.json();
}

async function storagePut(relKey, data, contentType = 'application/octet-stream') {
  const key = relKey.replace(/^\/+/, '');
  const url = new URL('v1/storage/upload', FORGE_API_URL + '/');
  url.searchParams.set('path', key);

  const blob = new Blob([data], { type: contentType });
  const form = new FormData();
  form.append('file', blob, key.split('/').pop() || 'file');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FORGE_API_KEY}` },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status}): ${message}`);
  }
  const result = await response.json();
  return { key, url: result.url };
}

async function analyzeReceiptImage(imageUrl) {
  const result = await invokeLLM([
    {
      role: 'system',
      content: `あなたはTikTok Shopの注文スクリーンショットを分析する専門家です。
画像を分析して、商品情報が表示されている領域（商品画像、商品名、価格が含まれる部分）の座標を返してください。
個人情報（名前、住所、電話番号）が含まれる領域は絶対に含めないでください。

画像の高さを100%として、商品情報領域の開始位置（top_percent）と終了位置（bottom_percent）をパーセンテージで返してください。
左右は画像全体を使います（left=0%, width=100%）。

注意:
- 商品画像のサムネイル、商品名、価格、数量が含まれる領域を特定してください
- 配送先住所、受取人名、電話番号は絶対に含めないでください
- 注文番号や支払い方法の情報も含めないでください
- 商品情報が見つからない場合は has_product_info を false にしてください`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'この画像から商品情報の領域を特定してください。個人情報は絶対に含めないでください。' },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
      ]
    }
  ], {
    type: 'json_schema',
    json_schema: {
      name: 'crop_region',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          has_product_info: { type: 'boolean', description: '商品情報（商品画像・商品名・価格）が含まれているか' },
          has_personal_info: { type: 'boolean', description: '個人情報（名前・住所・電話番号）が含まれているか' },
          top_percent: { type: 'number', description: '商品情報領域の上端（画像高さの0-100%）' },
          bottom_percent: { type: 'number', description: '商品情報領域の下端（画像高さの0-100%）' },
          description: { type: 'string', description: '画像の内容の簡単な説明' },
        },
        required: ['has_product_info', 'has_personal_info', 'top_percent', 'bottom_percent', 'description'],
        additionalProperties: false,
      }
    }
  });

  const content = result.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : content[0].text);
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function cropImage(imageBuffer, topPercent, bottomPercent) {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  // パーセンテージからピクセルに変換
  const top = Math.max(0, Math.floor(height * (topPercent / 100)));
  const bottom = Math.min(height, Math.ceil(height * (bottomPercent / 100)));
  const cropHeight = bottom - top;

  if (cropHeight < 50) {
    throw new Error(`Crop height too small: ${cropHeight}px`);
  }

  // 切り抜き実行
  const cropped = await sharp(imageBuffer)
    .extract({ left: 0, top, width, height: cropHeight })
    .jpeg({ quality: 85 })
    .toBuffer();

  return cropped;
}

async function processOneReview(conn, review) {
  const { id, productImageUrl, receiptId } = review;

  // 既にクロップ済みの画像（S3パスにcropped-productsが含まれる）はスキップ
  if (productImageUrl.includes('cropped-products/')) {
    skipped++;
    return;
  }

  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    try {
      // 1. LLM Vision APIで商品領域を分析
      const analysis = await analyzeReceiptImage(productImageUrl);

      if (!analysis.has_product_info) {
        console.log(`  [${id}] 商品情報なし - スキップ`);
        skipped++;
        return;
      }

      // 2. 画像をダウンロード
      const imageBuffer = await downloadImage(productImageUrl);

      // 3. 切り抜き
      const croppedBuffer = await cropImage(imageBuffer, analysis.top_percent, analysis.bottom_percent);

      // 4. S3にアップロード
      const suffix = crypto.randomBytes(4).toString('hex');
      const s3Key = `cropped-products/review-${id}-${suffix}.jpg`;
      const { url: croppedUrl } = await storagePut(s3Key, croppedBuffer, 'image/jpeg');

      // 5. DB更新
      await conn.execute(
        'UPDATE receipt_reviews SET productImageUrl = ? WHERE id = ?',
        [croppedUrl, id]
      );

      succeeded++;
      console.log(`  [${id}] ✅ 切り抜き成功 (${analysis.top_percent}%~${analysis.bottom_percent}%) → ${croppedUrl.substring(0, 60)}...`);
      return;

    } catch (err) {
      if (attempt < RETRY_MAX) {
        console.log(`  [${id}] ⚠️ リトライ ${attempt + 1}/${RETRY_MAX}: ${err.message}`);
        await sleep(2000 * (attempt + 1));
      } else {
        failed++;
        console.log(`  [${id}] ❌ 失敗: ${err.message}`);
      }
    }
  }
}

async function main() {
  const startArg = process.argv[2] ? parseInt(process.argv[2]) : 0;
  const limitArg = process.argv[3] ? parseInt(process.argv[3]) : 0; // 0 = all

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // productImageUrlが設定されているレビューを取得
  let query = `
    SELECT rr.id, rr.productImageUrl, rr.receiptId
    FROM receipt_reviews rr
    WHERE rr.productImageUrl IS NOT NULL
    AND rr.productImageUrl != ''
    AND rr.productImageUrl NOT LIKE '%cropped-products%'
    ORDER BY rr.id
  `;
  if (limitArg > 0) {
    query += ` LIMIT ${limitArg} OFFSET ${startArg}`;
  } else if (startArg > 0) {
    query += ` OFFSET ${startArg}`;
  }

  const [reviews] = await conn.execute(query);
  const total = reviews.length;
  console.log(`\n=== バッチ処理開始: ${total}件のレビュー画像を処理 ===\n`);

  // 並列処理
  const queue = [...reviews];
  const workers = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const review = queue.shift();
        if (!review) break;
        processed++;

        if (processed % 10 === 0 || processed === total) {
          console.log(`\n--- 進捗: ${processed}/${total} (成功: ${succeeded}, 失敗: ${failed}, スキップ: ${skipped}) ---`);
        }

        await processOneReview(conn, review);
        await sleep(DELAY_MS);
      }
    })());
  }

  await Promise.all(workers);

  console.log(`\n=== バッチ処理完了 ===`);
  console.log(`  合計: ${total}`);
  console.log(`  成功: ${succeeded}`);
  console.log(`  失敗: ${failed}`);
  console.log(`  スキップ: ${skipped}`);

  await conn.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
