import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  mapStoreProductHandcardRow,
  storeProductHandcardInputSchema,
  type StoreProductHandcardContent,
  validateStoreProductHandcardEvidence,
} from "../shared/storeProductHandcard";

let setupPromise: Promise<void> | null = null;

export function ensureStoreProductHandcardTable(pool: Pool): Promise<void> {
  if (!setupPromise) {
    setupPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS store_product_handcards (
        productId INT NOT NULL,
        contentJson JSON NOT NULL,
        revision INT NOT NULL DEFAULT 1,
        createdById INT NULL,
        createdByName VARCHAR(255) NULL,
        updatedById INT NULL,
        updatedByName VARCHAR(255) NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (productId),
        INDEX idx_store_product_handcards_updated (updatedAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => undefined).catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

function parseContentJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getStoreProductHandcard(pool: Pool, productId: number) {
  await ensureStoreProductHandcardTable(pool);
  const [productRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM store_products WHERE id=? LIMIT 1",
    [productId],
  );
  const product = productRows[0];
  if (!product) throw new Error("店铺商品不存在");
  const [handcardRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1",
    [productId],
  );
  const [imageRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, imageUrl, imageKey, mimeType, fileSize, sortOrder, isPrimary
       FROM store_product_images
      WHERE productId=? AND deletedAt IS NULL
      ORDER BY isPrimary DESC, sortOrder, id`,
    [productId],
  );
  const [skuRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, platformSkuId, skuCode, barcode, variantName, salePrice, stock, status, imageUrl
       FROM store_product_skus
      WHERE productId=? AND deletedAt IS NULL
      ORDER BY id`,
    [productId],
  );
  const raw = handcardRows[0]
    ? { ...parseContentJson(handcardRows[0].contentJson), ...handcardRows[0] }
    : null;
  return {
    product: {
      ...product,
      basePrice: product.basePrice === null ? null : Number(product.basePrice),
      stock: Number(product.stock || 0),
    },
    images: imageRows.map((row) => ({
      ...row,
      id: Number(row.id),
      fileSize: Number(row.fileSize || 0),
      sortOrder: Number(row.sortOrder || 0),
      isPrimary: Boolean(row.isPrimary),
    })),
    skus: skuRows.map((row) => ({
      ...row,
      id: Number(row.id),
      salePrice: row.salePrice === null ? null : Number(row.salePrice),
      stock: Number(row.stock || 0),
    })),
    handcard: mapStoreProductHandcardRow(raw),
  };
}

async function getProductImageIds(conn: PoolConnection, productId: number): Promise<number[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM store_product_images WHERE productId=? AND deletedAt IS NULL",
    [productId],
  );
  return rows.map((row) => Number(row.id));
}

export async function saveStoreProductHandcard(
  pool: Pool,
  input: unknown,
  actor: { id: number | null; name: string },
): Promise<{ productId: number; revision: number }> {
  const parsed = storeProductHandcardInputSchema.parse(input);
  await ensureStoreProductHandcardTable(pool);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [productRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM store_products WHERE id=? LIMIT 1 FOR UPDATE",
      [parsed.productId],
    );
    const product = productRows[0];
    if (!product) throw new Error("店铺商品不存在");
    const [beforeRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1 FOR UPDATE",
      [parsed.productId],
    );
    const { productId, ...content } = parsed;
    validateStoreProductHandcardEvidence(content, await getProductImageIds(conn, productId));
    const contentJson = JSON.stringify(content);
    const before = beforeRows[0]
      ? mapStoreProductHandcardRow({ ...parseContentJson(beforeRows[0].contentJson), ...beforeRows[0] })
      : null;
    await conn.query(
      `INSERT INTO store_product_handcards
        (productId, contentJson, revision, createdById, createdByName, updatedById, updatedByName)
       VALUES (?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         contentJson=VALUES(contentJson),
         revision=revision+1,
         updatedById=VALUES(updatedById),
         updatedByName=VALUES(updatedByName),
         updatedAt=CURRENT_TIMESTAMP`,
      [productId, contentJson, actor.id, actor.name, actor.id, actor.name],
    );
    const [afterRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1",
      [productId],
    );
    const after = mapStoreProductHandcardRow({ ...parseContentJson(afterRows[0]?.contentJson), ...afterRows[0] });
    await conn.query(
      `INSERT INTO store_product_audit_logs
        (productId, skuId, promotionId, storeId, action, beforeJson, afterJson, actorId, actorName)
       VALUES (?, NULL, NULL, ?, 'handcard_updated', ?, ?, ?, ?)`,
      [
        productId,
        Number(product.storeId),
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
        actor.id,
        actor.name,
      ],
    );
    await conn.commit();
    return { productId, revision: after.revision };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
