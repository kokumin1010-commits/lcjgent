/**
 * バッチ処理: 商品マスター登録 + Google画像検索サムネイル取得
 * 
 * 1. receipt_reviewsのユニーク商品名をproduct_masterに登録
 * 2. LLM APIで検索クエリ・カテゴリを推定
 * 3. Google画像検索のサムネイル(encrypted-tbn)を取得
 * 4. LLM Vision APIで最適な画像を選定
 * 5. S3にアップロードしてproduct_masterを更新
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import https from 'https';
import http from 'http';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.ai';
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// ===== LLM API =====
async function invokeLLM(messages, responseFormat) {
  const payload = {
    model: 'gemini-2.5-flash',
    messages,
    max_tokens: 4096,
  };
  if (responseFormat) {
    payload.response_format = responseFormat;
  }
  
  const resp = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM error: ${resp.status} ${text.substring(0, 200)}`);
  }
  
  return await resp.json();
}

// ===== Google Image Search (mobile HTML → encrypted-tbn thumbnails) =====
async function searchGoogleImageThumbnails(query, numResults = 5) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch&hl=ja`;
  
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });
    
    const html = await resp.text();
    
    // Extract encrypted-tbn thumbnail URLs
    const regex = /src="(https:\/\/encrypted-tbn[^"]+)"/g;
    let match;
    const urls = [];
    while ((match = regex.exec(html)) !== null && urls.length < numResults) {
      urls.push(match[1].replace(/&amp;/g, '&'));
    }
    
    return urls;
  } catch (err) {
    console.error(`  Google search failed for "${query}":`, err.message);
    return [];
  }
}

// ===== Download image to buffer =====
async function downloadImage(url, timeout = 10000) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

// ===== S3 Upload =====
async function storagePut(relKey, data, contentType) {
  const resp = await fetch(`${FORGE_API_URL}/v1/storage/put`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FORGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: relKey,
      content: data.toString('base64'),
      contentType: contentType || 'image/jpeg',
      encoding: 'base64',
    }),
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Storage put failed: ${resp.status} ${text.substring(0, 200)}`);
  }
  
  return await resp.json();
}

// ===== LLM Vision: 画像の中から最も商品画像として適切なものを選ぶ =====
async function selectBestImage(productName, brandName, thumbnailUrls) {
  if (thumbnailUrls.length === 0) return null;
  if (thumbnailUrls.length === 1) return 0;
  
  const content = [
    {
      type: 'text',
      text: `以下の画像は「${brandName || ''} ${productName}」のGoogle画像検索結果です。
この商品の公式商品画像（パッケージ写真や商品単体の写真）として最も適切な画像の番号を1つ選んでください。
人物写真、関係ない商品、テキストだけの画像は避けてください。
適切な画像がない場合は0を返してください。
数字のみで回答してください。`
    },
  ];
  
  // 最大5枚まで
  const urls = thumbnailUrls.slice(0, 5);
  urls.forEach((url, i) => {
    content.push({ type: 'text', text: `画像${i + 1}:` });
    content.push({ type: 'image_url', image_url: { url } });
  });
  
  try {
    const result = await invokeLLM([{ role: 'user', content }]);
    const answer = result.choices[0].message.content.trim();
    const num = parseInt(answer.replace(/[^0-9]/g, ''));
    if (num >= 1 && num <= urls.length) return num - 1;
    return null; // 適切な画像なし
  } catch (err) {
    console.error(`  Vision選定失敗:`, err.message);
    return 0; // フォールバック: 最初の画像
  }
}

// ===== Main batch process =====
async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  const MODE = process.argv[2] || 'all'; // 'test' for first 5, 'all' for all
  const LIMIT = MODE === 'test' ? 5 : 9999;
  
  console.log(`=== 商品マスター登録 + 画像取得バッチ (mode: ${MODE}) ===\n`);
  
  // Step 1: receipt_reviewsのユニーク商品名を取得（レビュー数2件以上を優先）
  const [products] = await conn.execute(`
    SELECT 
      productName, 
      COUNT(*) as reviewCount,
      GROUP_CONCAT(DISTINCT brandName SEPARATOR ', ') as brands
    FROM receipt_reviews 
    WHERE productName IS NOT NULL AND productName != ''
    GROUP BY productName 
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
    LIMIT ${LIMIT}
  `);
  
  console.log(`対象商品数: ${products.length}件\n`);
  
  // Step 2: 既にproduct_masterに画像付きで登録済みの商品を除外
  const [existing] = await conn.execute(
    "SELECT canonicalName FROM product_master WHERE imageUrl IS NOT NULL AND imageUrl != ''"
  );
  const existingNames = new Set(existing.map(e => e.canonicalName));
  
  const newProducts = products.filter(p => !existingNames.has(p.productName));
  console.log(`処理対象: ${newProducts.length}件（画像取得済み: ${existingNames.size}件）\n`);
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  // バッチサイズでLLM分析（10件ずつ）
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
    const batch = newProducts.slice(i, i + BATCH_SIZE);
    console.log(`\n--- バッチ ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(newProducts.length/BATCH_SIZE)} ---`);
    
    // LLMで検索クエリを一括生成
    const productList = batch.map((p, idx) => 
      `${idx + 1}. "${p.productName}" (brand: ${p.brands || 'unknown'})`
    ).join('\n');
    
    let productInfos;
    try {
      const llmResult = await invokeLLM([
        {
          role: 'system',
          content: `あなたは日本のEC商品の専門家です。商品名からGoogle画像検索用のクエリを生成してください。
- searchQuery: ブランド名+商品の一般名で、商品パッケージ画像が見つかりやすい検索クエリ（日本語）
- category: コスメ/スキンケア/ヘアケア/サプリ/ファッション/家電/食品/その他
JSON配列で返してください。`
        },
        { role: 'user', content: productList }
      ], {
        type: 'json_schema',
        json_schema: {
          name: 'product_queries',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'integer' },
                    searchQuery: { type: 'string' },
                    category: { type: 'string' },
                  },
                  required: ['index', 'searchQuery', 'category'],
                  additionalProperties: false,
                },
              },
            },
            required: ['products'],
            additionalProperties: false,
          },
        },
      });
      
      productInfos = JSON.parse(llmResult.choices[0].message.content).products;
    } catch (err) {
      console.error(`  LLM分析失敗:`, err.message);
      failCount += batch.length;
      continue;
    }
    
    // 各商品を処理
    for (let j = 0; j < batch.length; j++) {
      const product = batch[j];
      const info = productInfos.find(p => p.index === j + 1) || {};
      const searchQuery = info.searchQuery || product.productName;
      
      console.log(`\n[${i + j + 1}/${newProducts.length}] ${product.productName.substring(0, 50)}`);
      console.log(`  検索: "${searchQuery}" | カテゴリ: ${info.category || 'N/A'}`);
      
      // product_masterに登録（まだ存在しない場合）
      try {
        await conn.execute(
          `INSERT INTO product_master (canonicalName, category, imageStatus) 
           VALUES (?, ?, 'none')
           ON DUPLICATE KEY UPDATE category = COALESCE(VALUES(category), category)`,
          [product.productName, info.category || null]
        );
      } catch (err) {
        console.error(`  DB登録失敗:`, err.message);
      }
      
      // Google画像検索
      const thumbnails = await searchGoogleImageThumbnails(searchQuery + ' 商品', 5);
      
      if (thumbnails.length === 0) {
        console.log(`  画像なし（検索結果0件）`);
        skipCount++;
        continue;
      }
      
      console.log(`  サムネイル ${thumbnails.length}件取得`);
      
      // LLM Visionで最適な画像を選定
      const bestIdx = await selectBestImage(product.productName, product.brands, thumbnails);
      
      if (bestIdx === null) {
        console.log(`  適切な商品画像なし`);
        skipCount++;
        continue;
      }
      
      const selectedUrl = thumbnails[bestIdx];
      console.log(`  選定: 画像${bestIdx + 1}`);
      
      // ダウンロード＆S3アップロード
      try {
        const { buffer, contentType } = await downloadImage(selectedUrl);
        
        if (buffer.length < 2000) {
          console.log(`  画像が小さすぎる（${buffer.length}B）`);
          skipCount++;
          continue;
        }
        
        const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
        const safeName = product.productName.substring(0, 30).replace(/[^a-zA-Z0-9\u3040-\u9fff]/g, '_');
        const key = `product-master/${safeName}-${hash}.jpg`;
        
        const result = await storagePut(key, buffer, contentType);
        
        // DB更新
        await conn.execute(
          `UPDATE product_master SET imageUrl = ?, imageKey = ?, imageStatus = 'auto_fetched', imageSource = 'google' WHERE canonicalName = ?`,
          [result.url, key, product.productName]
        );
        
        console.log(`  ✅ 成功: ${result.url.substring(0, 70)}...`);
        successCount++;
      } catch (err) {
        console.log(`  ❌ DL/アップロード失敗: ${err.message}`);
        failCount++;
      }
      
      // レート制限対策（Google + LLM API）
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`\n\n=== 完了 ===`);
  console.log(`成功: ${successCount}件`);
  console.log(`失敗: ${failCount}件`);
  console.log(`スキップ: ${skipCount}件`);
  
  // receipt_reviewsの画像補完
  console.log(`\n--- receipt_reviewsの画像補完 ---`);
  const [updateResult] = await conn.execute(`
    UPDATE receipt_reviews rr
    INNER JOIN product_master pm ON rr.productName = pm.canonicalName
    SET rr.productImageUrl = pm.imageUrl
    WHERE (rr.productImageUrl IS NULL OR rr.productImageUrl = '')
    AND pm.imageUrl IS NOT NULL AND pm.imageUrl != ''
  `);
  console.log(`補完件数: ${updateResult.affectedRows}件`);
  
  await conn.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
