import { sql } from "drizzle-orm";

export async function addSelectionProductFields(db: any) {
  // Add productId column
  try {
    const [cols1] = await db.execute(sql`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'selection_products' 
      AND COLUMN_NAME = 'productId'
    `);
    if (!cols1 || (Array.isArray(cols1) && cols1.length === 0)) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN productId VARCHAR(100) DEFAULT NULL`);
      console.log("[Migration] Added selection_products.productId column");
    }
  } catch (err: any) {
    if (!err.message?.includes("Duplicate column")) throw err;
  }

  // Add talentExclusive column
  try {
    const [cols2] = await db.execute(sql`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'selection_products' 
      AND COLUMN_NAME = 'talentExclusive'
    `);
    if (!cols2 || (Array.isArray(cols2) && cols2.length === 0)) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN talentExclusive TINYINT DEFAULT 0`);
      console.log("[Migration] Added selection_products.talentExclusive column");
    }
  } catch (err: any) {
    if (!err.message?.includes("Duplicate column")) throw err;
  }
}
