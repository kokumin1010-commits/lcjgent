/**
 * TikTok Commission CSV Import Script
 * - GB18030 encoding support
 * - Duplicate check by subOrderId
 * - Bulk insert with brandId=0 (all brands / LCJ global)
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const iconv = require('iconv-lite');

const DB_URL = 'mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw';

function parseDateDDMMYYYY(str) {
  if (!str || !str.trim()) return null;
  // DD/MM/YYYY HH:MM:SS
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = match;
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function parseFloat2(str) {
  if (!str || !str.trim()) return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function parseInt2(str) {
  if (!str || !str.trim()) return null;
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

async function main() {
  const csvPath = '/home/ubuntu/upload/pasted_file_QXhCOA_all_00010101000000_00010101000000_577660607.csv';
  const raw = fs.readFileSync(csvPath);
  
  // Decode GB18030
  const text = iconv.decode(raw, 'gb18030');
  const lines = text.split('\n').filter(l => l.trim());
  
  console.log(`Total lines (incl header): ${lines.length}`);
  
  // Parse header
  const headers = lines[0].split(',').map(h => h.trim());
  console.log(`Headers: ${headers.length} columns`);
  
  // Parse all rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse (no quoted fields with commas in this data)
    const vals = lines[i].split(',');
    if (vals.length < 35) continue;
    
    const row = {};
    for (let j = 0; j < headers.length && j < vals.length; j++) {
      row[headers[j]] = vals[j] ? vals[j].trim() : '';
    }
    rows.push(row);
  }
  
  console.log(`Parsed rows: ${rows.length}`);
  
  // Connect to DB
  const conn = await mysql.createConnection({
    uri: DB_URL,
    ssl: { rejectUnauthorized: true }
  });
  
  // Check existing subOrderIds
  const subIds = rows.map(r => r['サブ注文ID'] || '');
  const [existing] = await conn.query(
    'SELECT subOrderId FROM tiktok_commission_orders WHERE subOrderId IN (?)',
    [subIds]
  );
  const existingSet = new Set(existing.map(r => r.subOrderId));
  console.log(`Existing in DB: ${existingSet.size}`);
  
  // Filter new rows
  const newRows = rows.filter(r => !existingSet.has(r['サブ注文ID'] || ''));
  console.log(`New rows to insert: ${newRows.length}`);
  
  if (newRows.length === 0) {
    console.log('No new data to insert.');
    await conn.end();
    return;
  }
  
  // Bulk insert in batches of 500
  const BATCH = 500;
  let inserted = 0;
  
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
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
      parseInt2(r['価格']) || 0,
      parseInt2(r['数量']) || 1,
      r['ショップ名'] || null,
      r['ショップコード'] || null,
      r['コンテンツタイプ'] || null,
      r['コンテンツID'] || '',
      parseFloat2(r['アフィリエイトパートナー成果報酬率']),
      parseFloat2(r['クリエイター成果報酬率']),
      parseInt2(r['パートナー成果報酬リワード率']),
      parseInt2(r['クリエイターの手数料リワード率']),
      parseInt2(r['アフィリエイトパートナーのショップ広告成果報酬率']),
      parseInt2(r['クリエイターのショップ広告成果報酬率']),
      parseInt2(r['推定成果報酬ベース']),
      parseFloat2(r['推定アフィリエイトパートナー手数料額']),
      parseFloat2(r['推定クリエイター手数料額']),
      parseInt2(r['パートナーの推定成果報酬リワード料']),
      parseInt2(r['クリエイターの推定成果報酬リワード料']),
      parseInt2(r['クリエイターのショップ広告成果報酬支払額（推定）']),
      parseInt2(r['アフィリエイトパートナーのショップ広告成果報酬支払額（推定）']),
      parseFloat2(r['実際の手数料ベース']),
      parseFloat2(r['実際のアフィリエイトパートナー手数料額']),
      parseFloat2(r['クリエイターの実際の手数料額']),
      parseFloat2(r['パートナーの実際の手数料リワード料']),
      parseFloat2(r['クリエイターの実際の手数料リワード料']),
      parseFloat2(r['アフィリエイトパートナーのショップ広告成果報酬支払額（実際）']),
      parseFloat2(r['クリエイターのショップ広告成果報酬支払額（実際）']),
      parseInt2(r['返品される商品の数量']) || 0,
      parseInt2(r['返金される商品の数量']) || 0,
      parseDateDDMMYYYY(r['作成日時']),
      parseDateDDMMYYYY(r['注文配達日時']),
      parseDateDDMMYYYY(r['手数料決済日時']),
      r['支払いID'] || '',
      r['支払い方法'] || null,
      r['支払い口座'] || null,
      parseInt2(r['IVA']) || 0,
      parseInt2(r['ISR']) || 0,
      r['プラットフォーム'] || null,
      r['要因のタイプ'] || null,
    ]);
    
    const placeholders = values.map(() => '(?' + ',?'.repeat(46) + ')').join(',');
    const flat = values.flat();
    
    await conn.query(
      `INSERT INTO tiktok_commission_orders (
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
      ) VALUES ${placeholders}`,
      flat
    );
    
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${newRows.length}`);
  }
  
  console.log(`\nDone! Total inserted: ${inserted}`);
  
  // Verify
  const [total] = await conn.query('SELECT count(*) as cnt FROM tiktok_commission_orders WHERE brandId = 0');
  console.log(`Total records with brandId=0: ${total[0].cnt}`);
  
  await conn.end();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
