// Test drizzle insert with the exact same DATABASE_URL that the deployed app uses
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// The issue might be that drizzle(url) doesn't handle TiDB's SSL params correctly
// Let's test both approaches

console.log("=== Test 1: drizzle(DATABASE_URL) directly ===");
try {
  const db1 = drizzle(process.env.DATABASE_URL);
  // Import the schema
  const { festivalCompanyApplications } = await import("./drizzle/festivalSchema.ts");
  
  const result = await db1.insert(festivalCompanyApplications).values({
    companyName: "Debug Test 1",
    contactName: "テスト",
    contactDepartment: "テスト部",
    contactNameKana: "テスト",
    postalCode: "100-0001",
    address: "東京都",
    phone: "03-0000-0000",
    email: "debug1@test.com",
    websiteUrl: "https://debug1.test",
    lineOrLark: null,
    tiktokShopSellerName: "DebugShop1",
    brandIntro: "デバッグテスト1",
    tiktokShopUrl: null,
    matchingProducts: null,
    targetAudience: "テスト",
    salesLicense: "特になし",
    eventYear: "2026",
  });
  console.log("SUCCESS:", JSON.stringify(result));
} catch(e) {
  console.error("ERROR:", e.message);
}

console.log("\n=== Test 2: drizzle with mysql2 pool ===");
try {
  // Parse the URL manually
  const url = new URL(process.env.DATABASE_URL);
  const pool = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });
  
  const db2 = drizzle(pool);
  const { festivalCompanyApplications } = await import("./drizzle/festivalSchema.ts");
  
  const result = await db2.insert(festivalCompanyApplications).values({
    companyName: "Debug Test 2",
    contactName: "テスト",
    contactDepartment: "テスト部",
    contactNameKana: "テスト",
    postalCode: "100-0001",
    address: "東京都",
    phone: "03-0000-0000",
    email: "debug2@test.com",
    websiteUrl: "https://debug2.test",
    lineOrLark: null,
    tiktokShopSellerName: "DebugShop2",
    brandIntro: "デバッグテスト2",
    tiktokShopUrl: null,
    matchingProducts: null,
    targetAudience: "テスト",
    salesLicense: "特になし",
    eventYear: "2026",
  });
  console.log("SUCCESS:", JSON.stringify(result));
  await pool.end();
} catch(e) {
  console.error("ERROR:", e.message);
  console.error("Stack:", e.stack?.split('\n').slice(0, 5).join('\n'));
}

process.exit(0);
