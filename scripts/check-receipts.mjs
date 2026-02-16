import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Count approved receipts
const [countResult] = await db.execute(sql`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN ocrRawText IS NOT NULL AND ocrRawText != '' THEN 1 ELSE 0 END) as with_ocr
  FROM line_receipts WHERE status = 'approved'
`);
console.log("Approved receipts:", countResult);

// Sample OCR text to understand the format
const samples = await db.execute(sql`
  SELECT id, storeName, totalAmount, SUBSTRING(ocrRawText, 1, 500) as ocrSample
  FROM line_receipts 
  WHERE status = 'approved' AND ocrRawText IS NOT NULL AND ocrRawText != ''
  LIMIT 5
`);
console.log("\nSample OCR data:");
for (const row of samples[0]) {
  console.log(`\n--- Receipt #${row.id} ---`);
  console.log(`Store: ${row.storeName}`);
  console.log(`Amount: ${row.totalAmount}`);
  console.log(`OCR: ${row.ocrSample}`);
}

await connection.end();
