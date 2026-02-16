// Script to extract product data from approved line_receipts into receipt_products table
// Matches the actual receipt_products schema: id, receiptId, userId, productName, shopName, amount, orderNumber, createdAt
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Get all approved line_receipts with OCR data that haven't been extracted yet
  const [receipts] = await conn.execute(
    `SELECT lr.id, lr.lineUserId, lr.storeName, lr.totalAmount, lr.ocrRawText
     FROM line_receipts lr
     WHERE lr.status = 'approved' 
       AND lr.ocrRawText IS NOT NULL 
       AND lr.ocrRawText != ''
       AND lr.id NOT IN (SELECT DISTINCT receiptId FROM receipt_products)`
  );
  
  console.log(`Found ${receipts.length} approved receipts to process`);
  
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const receipt of receipts) {
    try {
      // Parse OCR JSON
      let ocrData;
      try {
        ocrData = JSON.parse(receipt.ocrRawText);
      } catch {
        console.log(`  Receipt ${receipt.id}: Invalid JSON, skipping`);
        skipped++;
        continue;
      }
      
      // Extract product name from OCR data
      const productName = ocrData.productName;
      if (!productName || productName === 'undefined') {
        console.log(`  Receipt ${receipt.id}: No product name found`);
        skipped++;
        continue;
      }
      
      const shopName = ocrData.shopName || receipt.storeName || null;
      const orderNumber = ocrData.orderNumber || null;
      
      // Handle multi-product receipts (separated by 、 or ,)
      const productNames = productName.includes("、")
        ? productName.split("、").map(n => n.trim()).filter(Boolean)
        : [productName.trim()];
      
      const perProductAmount = productNames.length > 1
        ? Math.floor((receipt.totalAmount || 0) / productNames.length)
        : receipt.totalAmount || 0;
      
      for (const pName of productNames) {
        await conn.execute(
          `INSERT INTO receipt_products (receiptId, userId, productName, shopName, amount, orderNumber)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [receipt.id, null, pName, shopName, perProductAmount, orderNumber]
        );
        inserted++;
      }
      console.log(`  Receipt ${receipt.id}: Extracted ${productNames.length} product(s) - ${productNames.join(", ")}`);
      
    } catch (err) {
      console.error(`  Receipt ${receipt.id}: Error - ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n=== Batch Extraction Complete ===`);
  console.log(`Extracted: ${inserted} products`);
  console.log(`Skipped: ${skipped} receipts`);
  console.log(`Errors: ${errors} receipts`);
  
  // Show summary
  const [summary] = await conn.execute(
    `SELECT COUNT(*) as totalProducts, COUNT(DISTINCT productName) as uniqueProducts, COUNT(DISTINCT shopName) as uniqueShops
     FROM receipt_products`
  );
  console.log(`\nTotal products in DB: ${summary[0].totalProducts}`);
  console.log(`Unique products: ${summary[0].uniqueProducts}`);
  console.log(`Unique shops: ${summary[0].uniqueShops}`);
  
  const [topProducts] = await conn.execute(
    `SELECT productName, shopName, COUNT(*) as cnt, SUM(amount) as totalAmt
     FROM receipt_products
     GROUP BY productName, shopName
     ORDER BY cnt DESC
     LIMIT 15`
  );
  
  console.log('\nTop 15 Products by purchase count:');
  for (const row of topProducts) {
    console.log(`  ${row.cnt}x ${row.productName} (${row.shopName}) - ¥${row.totalAmt}`);
  }
  
  await conn.end();
}

main().catch(console.error);
