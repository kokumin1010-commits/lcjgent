/**
 * Migration: Add missing columns to selection_products and selection_categories tables
 * 
 * Columns added to selection_products: productNameCn, productId, talentExclusive, exclusiveLiverIds, tags
 * Columns added to selection_categories: nameCn
 */
import { sql } from "drizzle-orm";

export async function addSelectionCenterColumns(db: any) {
  try {
    // Check selection_products columns
    const [productCols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'selection_products' 
      AND COLUMN_NAME IN ('productNameCn', 'productId', 'talentExclusive', 'exclusiveLiverIds', 'tags')
    `);
    const existingProductCols = new Set((productCols as any[]).map((r: any) => r.COLUMN_NAME));

    if (!existingProductCols.has('productNameCn')) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN productNameCn VARCHAR(500) DEFAULT NULL AFTER productName`);
      console.log('[Migration] Added column: selection_products.productNameCn');
    }
    if (!existingProductCols.has('productId')) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN productId VARCHAR(100) DEFAULT NULL`);
      console.log('[Migration] Added column: selection_products.productId');
    }
    if (!existingProductCols.has('talentExclusive')) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN talentExclusive TINYINT DEFAULT 0`);
      console.log('[Migration] Added column: selection_products.talentExclusive');
    }
    if (!existingProductCols.has('exclusiveLiverIds')) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN exclusiveLiverIds TEXT DEFAULT NULL`);
      console.log('[Migration] Added column: selection_products.exclusiveLiverIds');
    }
    if (!existingProductCols.has('tags')) {
      await db.execute(sql`ALTER TABLE selection_products ADD COLUMN tags TEXT DEFAULT NULL`);
      console.log('[Migration] Added column: selection_products.tags');
    }

    // Check selection_categories columns
    const [catCols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'selection_categories' 
      AND COLUMN_NAME IN ('nameCn')
    `);
    const existingCatCols = new Set((catCols as any[]).map((r: any) => r.COLUMN_NAME));

    if (!existingCatCols.has('nameCn')) {
      await db.execute(sql`ALTER TABLE selection_categories ADD COLUMN nameCn VARCHAR(100) DEFAULT NULL AFTER name`);
      console.log('[Migration] Added column: selection_categories.nameCn');
    }

    console.log('[Migration] selection center columns check complete');
  } catch (error) {
    console.error('[Migration] Error adding selection center columns:', error);
  }
}
