/**
 * TikTok Commission CSV Import Script v3
 * - Python csv module for proper parsing
 * - GB18030 encoding
 * - Handles comma-formatted subOrderIds
 * - All data → brandId=0 (LCJ global)
 */
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');

const DB_URL = 'mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw';

function parseDateDDMMYYYY(str) {
  if (!str || !str.trim()) return null;
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = match;
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function pf(str) {
  if (!str || !str.trim()) return null;
  const n = parseFloat(str.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function pi(str) {
  if (!str || !str.trim()) return null;
  const n = parseInt(str.replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

// Clean subOrderId - remove commas from number-formatted IDs, truncate if still too long
function cleanId(str) {
  if (!str) return '';
  // Remove commas and spaces
  let cleaned = str.replace(/,/g, '').replace(/\s/g, '').trim();
  // Truncate to 128 chars max
  if (cleaned.length > 128) cleaned = cleaned.substring(0, 128);
  return cleaned;
}

async function main() {
  // Step 1: Parse CSV with Python
  console.log('Parsing CSV with Python...');
  const pyScript = `
import csv, io, json
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
  fs.writeFileSync('/tmp/parse_csv.py', pyScript);
  const count = execSync('python3 /tmp/parse_csv.py').toString().trim();
  console.log(`Parsed ${count} rows`);
  
  const rows = JSON.parse(fs.readFileSync('/tmp/tiktok_csv_parsed.json', 'utf-8'));
  
  // Connect to DB
  const conn = await mysql.createConnection({
    uri: DB_URL,
    ssl: { rejectUnauthorized: true }
  });
  
  // Check existing subOrderIds
  const allSubIds = rows.map(r => cleanId(r['サブ注文ID'])).filter(s => s);
  console.log(`Checking ${allSubIds.length} subOrderIds...`);
  
  const existingSet = new Set();
  for (let i = 0; i < allSubIds.length; i += 1000) {
    const batch = allSubIds.slice(i, i + 1000);
    const [existing] = await conn.query(
      'SELECT subOrderId FROM tiktok_commission_orders WHERE subOrderId IN (?)',
      [batch]
    );
    existing.forEach(r => existingSet.add(r.subOrderId));
  }
  console.log(`Found ${existingSet.size} existing records`);
  
  const newRows = rows.filter(r => !existingSet.has(cleanId(r['サブ注文ID'])));
  console.log(`New rows to insert: ${newRows.length}`);
  
  if (newRows.length === 0) {
    console.log('No new data.');
    await conn.end();
    return;
  }
  
  // Bulk insert
  const BATCH = 200;
  let inserted = 0;
  let skipped = 0;
  
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    
    const values = batch.map(r => [
      0, 0,
      (r['注文ID'] || '').substring(0, 64),
      cleanId(r['サブ注文ID']),
      r['注文状況'] || null,
      r['クリエイターのユーザー名'] || '',
      r['商品名'] || '',
      r['SKU'] || null,
      (r['商品ID'] || '').substring(0, 64),
      pi(r['価格']) || 0,
      pi(r['数量']) || 1,
      r['ショップ名'] || null,
      (r['ショップコード'] || '').substring(0, 64) || null,
      r['コンテンツタイプ'] || null,
      (r['コンテンツID'] || '').substring(0, 64),
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
      (r['支払いID'] || '').substring(0, 64),
      r['支払い方法'] || null,
      r['支払い口座'] || null,
      pi(r['IVA']) || 0,
      pi(r['ISR']) || 0,
      r['プラットフォーム'] || null,
      r['要因のタイプ'] || null,
    ]);
    
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
    
    try {
      await conn.query(insertSQL, [values]);
      inserted += batch.length;
    } catch (e) {
      // Insert one by one
      for (let j = 0; j < batch.length; j++) {
        try {
          await conn.query(insertSQL, [[values[j]]]);
          inserted++;
        } catch (e2) {
          skipped++;
          if (skipped <= 5) console.error(`Skip: ${e2.message.substring(0, 80)}`);
        }
      }
    }
    
    if ((i + BATCH) % 2000 < BATCH || i + BATCH >= newRows.length) {
      console.log(`Progress: ${inserted} inserted, ${skipped} skipped / ${newRows.length} total`);
    }
  }
  
  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);
  
  const [byBrand] = await conn.query('SELECT brandId, count(*) as cnt FROM tiktok_commission_orders GROUP BY brandId');
  console.log('Final by brand:', byBrand);
  
  await conn.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
