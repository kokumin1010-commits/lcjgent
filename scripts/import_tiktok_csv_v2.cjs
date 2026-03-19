/**
 * TikTok Commission CSV Import Script v2
 * - Uses proper CSV parsing via Python pre-processing
 * - GB18030 encoding support
 * - Duplicate check by subOrderId
 * - All data goes to brandId=0 (LCJ global)
 */
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');

const DB_URL = 'mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw';

// Step 1: Use Python to properly parse CSV and output JSON
const pythonScript = `
import csv, io, json, sys

with open('/home/ubuntu/upload/pasted_file_QXhCOA_all_00010101000000_00010101000000_577660607.csv', 'rb') as f:
    raw = f.read()

text = raw.decode('gb18030')
reader = csv.reader(io.StringIO(text))
header = next(reader)
rows = []
for row in reader:
    d = {}
    for i, h in enumerate(header):
        d[h] = row[i] if i < len(row) else ''
    rows.append(d)

with open('/tmp/tiktok_csv_parsed.json', 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False)
print(len(rows))
`;

function parseDateDDMMYYYY(str) {
  if (!str || !str.trim()) return null;
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = match;
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function pf(str) {
  if (!str || !str.trim()) return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function pi(str) {
  if (!str || !str.trim()) return null;
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

async function main() {
  // Parse CSV with Python
  console.log('Parsing CSV with Python...');
  fs.writeFileSync('/tmp/parse_csv.py', pythonScript);
  const count = execSync('python3 /tmp/parse_csv.py').toString().trim();
  console.log(`Parsed ${count} rows`);
  
  // Load parsed JSON
  const rows = JSON.parse(fs.readFileSync('/tmp/tiktok_csv_parsed.json', 'utf-8'));
  console.log(`Loaded ${rows.length} rows from JSON`);
  
  // Connect to DB
  const conn = await mysql.createConnection({
    uri: DB_URL,
    ssl: { rejectUnauthorized: true }
  });
  
  // Check existing subOrderIds (batch check)
  const allSubIds = rows.map(r => r['サブ注文ID'] || '').filter(s => s);
  console.log(`Checking ${allSubIds.length} subOrderIds for duplicates...`);
  
  const existingSet = new Set();
  // Check in batches of 1000
  for (let i = 0; i < allSubIds.length; i += 1000) {
    const batch = allSubIds.slice(i, i + 1000);
    const [existing] = await conn.query(
      'SELECT subOrderId FROM tiktok_commission_orders WHERE subOrderId IN (?)',
      [batch]
    );
    existing.forEach(r => existingSet.add(r.subOrderId));
  }
  console.log(`Found ${existingSet.size} existing records`);
  
  // Filter new rows
  const newRows = rows.filter(r => !existingSet.has(r['サブ注文ID'] || ''));
  console.log(`New rows to insert: ${newRows.length}`);
  
  if (newRows.length === 0) {
    console.log('No new data to insert.');
    await conn.end();
    return;
  }
  
  // Bulk insert in batches of 200
  const BATCH = 200;
  let inserted = 0;
  
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    
    const insertSQL = `INSERT INTO tiktok_commission_orders (
      brandId, importHistoryId, orderId, subOrderId, orderStatus,
      creatorUsername, productName, sku, productId, price, quantity,
      shopName, shopCode, contentType, contentId,
      partnerCommissionRate, creatorCommissionRate,
      partnerRewardRate, creatorRewardRate,
      partnerShopAdRate, creatorShopAdRate,
      estimatedCommissionBase, estimatedPartnerCommission,
      estimatedCreatorCommission, estimatedPartnerReward,
      estimatedCreatorReward, estimatedCreatorShopAdPay,
      estimatedPartnerShopAdPay,
      actualCommissionBase, actualPartnerCommission,
      actualCreatorCommission, actualPartnerReward,
      actualCreatorReward, actualPartnerShopAdPay,
      actualCreatorShopAdPay,
      returnQuantity, refundQuantity,
      orderCreatedAt, orderDeliveredAt, commissionSettledAt,
      paymentId, paymentMethod, paymentAccount,
      iva, isr, platform, factorType
    ) VALUES ?`;
    
    const values = batch.map(r => [
      0, // brandId = 0 for global LCJ data
      0, // importHistoryId
      r['注文ID'] || '',
      r['サブ注文ID'] || '',
      r['注文状況'] || null,
      r['クリエイターのユーザー名'] || '',
      r['商品名'] || '',
      r['SKU'] || null,
      r['商品ID'] || '',
      pi(r['価格']) || 0,
      pi(r['数量']) || 1,
      r['ショップ名'] || null,
      r['ショップコード'] || null,
      r['コンテンツタイプ'] || null,
      r['コンテンツID'] || '',
      pf(r['アフィリエイトパートナー成果報酬率']),
      pf(r['クリエイター成果報酬率']),
      pi(r['パートナー成果報酬リワード率']) || 0,
      pi(r['クリエイターの手数料リワード率']) || 0,
      pi(r['アフィリエイトパートナーのショップ広告成果報酬率']) || 0,
      pi(r['クリエイターのショップ広告成果報酬率']) || 0,
      pi(r['推定成果報酬ベース']) || 0,
      pf(r['推定アフィリエイトパートナー手数料額']),
      pf(r['推定クリエイター手数料額']),
      pi(r['パートナーの推定成果報酬リワード料']) || 0,
      pi(r['クリエイターの推定成果報酬リワード料']) || 0,
      pi(r['クリエイターのショップ広告成果報酬支払額（推定）']) || 0,
      pi(r['アフィリエイトパートナーのショップ広告成果報酬支払額（推定）']) || 0,
      pf(r['実際の手数料ベース']),
      pf(r['実際のアフィリエイトパートナー手数料額']),
      pf(r['クリエイターの実際の手数料額']),
      pf(r['パートナーの実際の手数料リワード料']),
      pf(r['クリエイターの実際の手数料リワード料']),
      pf(r['アフィリエイトパートナーのショップ広告成果報酬支払額（実際）']),
      pf(r['クリエイターのショップ広告成果報酬支払額（実際）']),
      pi(r['返品される商品の数量']) || 0,
      pi(r['返金される商品の数量']) || 0,
      parseDateDDMMYYYY(r['作成日時']),
      parseDateDDMMYYYY(r['注文配達日時']),
      parseDateDDMMYYYY(r['手数料決済日時']),
      r['支払いID'] || '',
      r['支払い方法'] || null,
      r['支払い口座'] || null,
      pi(r['IVA']) || 0,
      pi(r['ISR']) || 0,
      r['プラットフォーム'] || null,
      r['要因のタイプ'] || null,
    ]);
    
    try {
      await conn.query(insertSQL, [values]);
      inserted += batch.length;
      if (inserted % 1000 === 0 || i + BATCH >= newRows.length) {
        console.log(`Inserted ${inserted}/${newRows.length}`);
      }
    } catch (e) {
      console.error(`Error at batch starting row ${i}:`, e.message);
      // Try inserting one by one to find the problem row
      for (let j = 0; j < batch.length; j++) {
        try {
          await conn.query(insertSQL, [[values[j]]]);
          inserted++;
        } catch (e2) {
          console.error(`  Skipping row ${i+j}: ${e2.message.substring(0, 100)}`);
        }
      }
    }
  }
  
  console.log(`\nDone! Total inserted: ${inserted}`);
  
  // Verify
  const [total] = await conn.query('SELECT count(*) as cnt FROM tiktok_commission_orders');
  console.log(`Total records in DB: ${total[0].cnt}`);
  const [byBrand] = await conn.query('SELECT brandId, count(*) as cnt FROM tiktok_commission_orders GROUP BY brandId');
  console.log('By brand:', byBrand);
  
  await conn.end();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
