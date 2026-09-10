import { sql } from "drizzle-orm";

export async function addMallProductSelectionSource(db: any): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE mall_products ADD COLUMN selectionProductId INT DEFAULT NULL`);
    console.log("[Migration] Added selectionProductId to mall_products");
  } catch (error: any) {
    if (error?.message?.includes("Duplicate column")) {
      console.log("[Migration] selectionProductId already exists in mall_products");
    } else {
      throw error;
    }
  }

  try {
    await db.execute(sql`CREATE UNIQUE INDEX uk_mall_products_selection_product ON mall_products (selectionProductId)`);
    console.log("[Migration] Added unique selection product index to mall_products");
  } catch (error: any) {
    if (error?.message?.includes("Duplicate key name") || error?.message?.includes("Duplicate")) {
      console.log("[Migration] selection product index already exists in mall_products");
    } else {
      throw error;
    }
  }
}
