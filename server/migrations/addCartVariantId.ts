import { sql } from "drizzle-orm";

/**
 * カートテーブルにvariantIdカラムを追加
 * バリアント選択をカートに保存するため
 */
export async function addCartVariantId(db: any) {
  try {
    await db.execute(sql`ALTER TABLE mall_carts ADD COLUMN variantId INT DEFAULT NULL`);
    console.log("[Migration] Added variantId column to mall_carts");
  } catch (e: any) {
    if (e.message?.includes("Duplicate column")) {
      console.log("[Migration] variantId column already exists in mall_carts");
    } else {
      console.error("[Migration] Error adding variantId to mall_carts:", e.message);
    }
  }

  // variantIdとproductIdの組み合わせでユニーク制約を更新
  // 同じ商品でもバリアントが違えば別のカートアイテムとして扱う
  try {
    // 既存のユニーク制約を削除（あれば）
    await db.execute(sql`ALTER TABLE mall_carts DROP INDEX IF EXISTS uk_user_product_variant`);
  } catch (e: any) {
    // ignore
  }
  try {
    await db.execute(sql`CREATE UNIQUE INDEX uk_user_product_variant ON mall_carts (lineUserId, productId, variantId)`);
    console.log("[Migration] Created unique index uk_user_product_variant on mall_carts");
  } catch (e: any) {
    if (e.message?.includes("Duplicate")) {
      console.log("[Migration] uk_user_product_variant index already exists");
    } else {
      console.error("[Migration] Error creating index:", e.message);
    }
  }

  // mall_order_itemsにもvariantId, variantNameカラムを追加
  try {
    await db.execute(sql`ALTER TABLE mall_order_items ADD COLUMN variantId INT DEFAULT NULL`);
    console.log("[Migration] Added variantId column to mall_order_items");
  } catch (e: any) {
    if (e.message?.includes("Duplicate column")) {
      console.log("[Migration] variantId column already exists in mall_order_items");
    } else {
      console.error("[Migration] Error adding variantId to mall_order_items:", e.message);
    }
  }
  try {
    await db.execute(sql`ALTER TABLE mall_order_items ADD COLUMN variantName VARCHAR(255) DEFAULT NULL`);
    console.log("[Migration] Added variantName column to mall_order_items");
  } catch (e: any) {
    if (e.message?.includes("Duplicate column")) {
      console.log("[Migration] variantName column already exists in mall_order_items");
    } else {
      console.error("[Migration] Error adding variantName to mall_order_items:", e.message);
    }
  }
}
