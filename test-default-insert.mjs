import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Test 1: Using DEFAULT keyword like drizzle does
console.log("=== Test: INSERT with DEFAULT keyword ===");
try {
  const [result] = await conn.query(
    "INSERT INTO `festival_company_applications` (`id`, `company_name`, `contact_name`, `contact_department`, `contact_name_kana`, `postal_code`, `address`, `phone`, `email`, `website_url`, `line_or_lark`, `tiktok_shop_seller_name`, `brand_intro`, `tiktok_shop_url`, `matching_products`, `target_audience`, `sales_license`, `status`, `notes`, `event_year`, `created_at`, `updated_at`) values (default, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, default, default, ?, default, default)",
    ['DefaultTest', 'テスト', 'テスト部', 'テスト', '100-0001', '東京都', '03-0000-0000', 'default@test.com', 'https://default.test', null, 'DefaultShop', 'テスト紹介', null, null, 'テスト', '特になし', '2026']
  );
  console.log("SUCCESS:", result.insertId);
} catch(e) {
  console.error("ERROR:", e.message);
  console.error("Code:", e.code);
  console.error("SQL State:", e.sqlState);
}

await conn.end();
process.exit(0);
