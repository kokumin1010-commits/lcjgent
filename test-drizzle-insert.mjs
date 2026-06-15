import { drizzle } from "drizzle-orm/mysql2";
import { festivalCompanyApplications } from "./drizzle/festivalSchema.ts";

const db = drizzle(process.env.DATABASE_URL);

try {
  const result = await db.insert(festivalCompanyApplications).values({
    companyName: "DrizzleTest株式会社",
    contactName: "テスト太郎",
    contactDepartment: "テスト部",
    contactNameKana: "テスト タロウ",
    postalCode: "100-0001",
    address: "東京都千代田区テスト1-1",
    phone: "03-0000-0000",
    email: "drizzle@test.com",
    websiteUrl: "https://drizzle-test.com",
    lineOrLark: null,
    tiktokShopSellerName: "DrizzleTestShop",
    brandIntro: "Drizzleテスト用ブランド紹介文です。",
    tiktokShopUrl: null,
    matchingProducts: null,
    targetAudience: "テスト用ターゲット",
    salesLicense: "特になし",
    eventYear: "2026",
  });
  console.log("SUCCESS:", JSON.stringify(result));
} catch(e) {
  console.error("ERROR:", e.message);
  console.error("Full error:", e);
}
process.exit(0);
