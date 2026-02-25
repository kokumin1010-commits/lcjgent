import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.im';
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function invokeLLM(messages, responseFormat) {
  const payload = {
    model: 'gemini-2.5-flash',
    messages,
    max_tokens: 4096,
    thinking: { budget_tokens: 128 },
  };
  if (responseFormat) payload.response_format = responseFormat;

  const res = await fetch(`${FORGE_API_URL.replace(/\/$/, '')}/v1/chat/completions`, {
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

async function analyzeReceiptImage(imageUrl) {
  const result = await invokeLLM([
    {
      role: 'system',
      content: `あなたはTikTok Shopの注文スクリーンショットを分析する専門家です。
画像を分析して、商品情報が表示されている領域（商品画像、商品名、価格が含まれる部分）の座標を返してください。
個人情報（名前、住所、電話番号）が含まれる領域は絶対に含めないでください。

画像の高さを100%として、商品情報領域の開始位置（top_percent）と終了位置（bottom_percent）をパーセンテージで返してください。
また、画像に個人情報が含まれているかどうかも判定してください。`
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

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // テスト用にレシート画像を5枚取得
  const [rows] = await conn.execute(`
    SELECT lr.id, lr.imageUrls, lr.storeName, rr.productName
    FROM line_receipts lr
    JOIN receipt_reviews rr ON rr.receiptId = lr.id
    WHERE lr.imageUrls IS NOT NULL
    AND JSON_LENGTH(lr.imageUrls) >= 1
    ORDER BY RAND()
    LIMIT 5
  `);

  console.log(`\n=== テスト: ${rows.length}枚のレシート画像を分析 ===\n`);

  for (const row of rows) {
    const urls = typeof row.imageUrls === 'string' ? JSON.parse(row.imageUrls) : row.imageUrls;
    const imageUrl = urls[0]; // 1枚目のレシート画像

    console.log(`--- Receipt #${row.id} | ${row.storeName} | ${row.productName} ---`);
    console.log(`  Image URL: ${imageUrl.substring(0, 80)}...`);

    try {
      const analysis = await analyzeReceiptImage(imageUrl);
      console.log(`  商品情報あり: ${analysis.has_product_info}`);
      console.log(`  個人情報あり: ${analysis.has_personal_info}`);
      console.log(`  切り抜き範囲: ${analysis.top_percent}% ~ ${analysis.bottom_percent}%`);
      console.log(`  説明: ${analysis.description}`);
      console.log('');
    } catch (err) {
      console.log(`  エラー: ${err.message}`);
      console.log('');
    }
  }

  await conn.end();
}

main().catch(console.error);
