import { sql } from "drizzle-orm";

export async function createBrandMonthlyGmvTargets(db: any) {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS brand_monthly_gmv_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        brandId INT NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        gmvTarget BIGINT NOT NULL DEFAULT 0,
        memo TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        UNIQUE KEY unique_brand_year_month (brandId, year, month),
        INDEX idx_brand (brandId)
      )
    `);
    console.log("[Migration] brand_monthly_gmv_targets table created/verified");
  } catch (error: any) {
    if (!error.message?.includes("already exists")) {
      throw error;
    }
  }
}
