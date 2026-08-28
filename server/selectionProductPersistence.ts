import type mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  normalizeSelectionProductSkuVariants,
  normalizeSelectionProductTags,
  SelectionProductValidationError,
  type SelectionProductSkuVariant,
} from "@shared/selectionProductPersistence";

const JSON_COLUMNS = new Set(["images", "detailImages", "videos", "exclusiveLiverIds", "tags", "skuVariants"]);

const UPDATE_COLUMNS = [
  "productName", "productNameCn", "productId", "barcode", "brandName", "brandId", "categoryId",
  "price", "marketPrice", "costPrice", "commissionType", "commissionValue", "images", "detailImages",
  "videos", "productLink", "sellingPoints", "description", "stock", "supplierContact", "talentExclusive",
  "exclusiveLiverIds", "tags", "selfOperated", "purchasePrice", "shippingFee", "platformFee", "deliveryTime",
  "suggestedPrice", "mechanism", "historicalLowestPrice", "discountRate", "secondLowestPrice", "thirdLowestPrice",
  "secondDiscountRate", "thirdDiscountRate", "lowestPriceDate", "secondLowestPriceDate", "thirdLowestPriceDate",
  "skuLowestPrice", "skuDiscountRate", "skuName", "skuPrice", "skuVariants", "skuLowestPriceDate",
  "parentProductId", "promotionType", "actualUnitPrice", "lowestPriceLiver",
] as const;

const CREATE_COLUMNS = [...UPDATE_COLUMNS, "totalCost", "createdBy"] as const;

const SCHEMA_STATEMENTS = [
  "ALTER TABLE selection_products ADD COLUMN productNameCn VARCHAR(255) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN productId VARCHAR(255) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN detailImages JSON DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN talentExclusive TINYINT DEFAULT 0",
  "ALTER TABLE selection_products ADD COLUMN exclusiveLiverIds JSON DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN tags JSON DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN selfOperated TINYINT DEFAULT 0",
  "ALTER TABLE selection_products ADD COLUMN purchasePrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN shippingFee DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN platformFee DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN totalCost DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN deliveryTime VARCHAR(255) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN suggestedPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN mechanism TEXT DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN historicalLowestPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN discountRate DECIMAL(5,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN secondLowestPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN thirdLowestPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN secondDiscountRate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN thirdDiscountRate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN lowestPriceDate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN secondLowestPriceDate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN thirdLowestPriceDate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN skuLowestPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN skuDiscountRate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN skuLowestPriceDate VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN skuName VARCHAR(200) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN skuPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN skuVariants JSON DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN parentProductId INT DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN promotionType VARCHAR(50) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN actualUnitPrice DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE selection_products ADD COLUMN lowestPriceLiver VARCHAR(100) DEFAULT NULL",
  `CREATE TABLE IF NOT EXISTS selection_price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productId INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    note VARCHAR(255) DEFAULT NULL,
    createdBy INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product (productId),
    INDEX idx_price (price)
  )`,
  `CREATE TABLE IF NOT EXISTS selection_discount_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productId INT NOT NULL,
    discountRate DECIMAL(5,2) NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    note VARCHAR(255) DEFAULT NULL,
    createdBy INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product (productId),
    INDEX idx_discount (discountRate)
  )`,
] as const;

let schemaEnsurePromise: Promise<void> | null = null;

function isDuplicateSchemaError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || "");
  return code === "ER_DUP_FIELDNAME" || code === "ER_DUP_KEYNAME";
}

export async function ensureSelectionProductPersistenceSchema(pool: mysql.Pool): Promise<void> {
  if (!schemaEnsurePromise) {
    schemaEnsurePromise = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        try {
          await pool.query(statement);
        } catch (error) {
          if (!isDuplicateSchemaError(error)) throw error;
        }
      }
    })();
  }

  try {
    await schemaEnsurePromise;
  } catch (error) {
    schemaEnsurePromise = null;
    throw error;
  }
}

export function resetSelectionProductSchemaEnsureForTests(): void {
  schemaEnsurePromise = null;
}

function toBadRequest(error: unknown): never {
  if (error instanceof SelectionProductValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

function withStableSkuVariantIds(variants: SelectionProductSkuVariant[]): SelectionProductSkuVariant[] {
  const ids = new Set<string>();
  return variants.map((variant) => {
    let variantId = variant.variantId;
    if (!variantId || ids.has(variantId)) variantId = randomUUID();
    ids.add(variantId);
    return { ...variant, variantId };
  });
}

function canonicalProductInput(input: Record<string, unknown>): Record<string, unknown> {
  try {
    const data = { ...input };
    if (data.productName !== undefined) {
      const productName = String(data.productName).trim();
      if (!productName) {
        throw new SelectionProductValidationError("请输入商品名 / 商品名を入力してください");
      }
      if (productName.length > 255) {
        throw new SelectionProductValidationError("商品名不能超过255字 / 商品名は255文字以内で入力してください");
      }
      data.productName = productName;
    }
    if (data.productNameCn !== undefined && data.productNameCn !== null) {
      const productNameCn = String(data.productNameCn).trim();
      if (productNameCn.length > 255) {
        throw new SelectionProductValidationError("中文商品名不能超过255字 / 中文商品名は255文字以内で入力してください");
      }
      data.productNameCn = productNameCn || null;
    }
    if (data.tags !== undefined) {
      data.tags = normalizeSelectionProductTags(data.tags);
    }
    if (data.skuVariants !== undefined) {
      const variants = withStableSkuVariantIds(normalizeSelectionProductSkuVariants(data.skuVariants));
      const primarySku = variants[0];
      data.skuVariants = variants;
      data.skuName = primarySku?.name ?? null;
      data.skuPrice = primarySku?.price ?? null;
      data.skuLowestPrice = primarySku?.lowestPrice ?? null;
      data.skuDiscountRate = primarySku?.discountRate ?? null;
    }
    return data;
  } catch (error) {
    return toBadRequest(error);
  }
}

function dbValue(column: string, value: unknown): unknown {
  if (JSON_COLUMNS.has(column)) {
    return value === null || value === undefined ? null : JSON.stringify(value);
  }
  return value === undefined ? null : value;
}

function calculateTotalCost(data: Record<string, unknown>): string | null {
  const total = (Number(data.purchasePrice) || 0) + (Number(data.shippingFee) || 0) + (Number(data.platformFee) || 0);
  return total > 0 ? String(total) : null;
}

async function insertPriceHistory(
  connection: mysql.PoolConnection,
  productId: number,
  price: unknown,
  createdBy: number,
  note: string,
): Promise<boolean> {
  if (price === undefined || price === null || Number(price) <= 0) return false;
  await connection.query(
    "INSERT INTO selection_price_history (productId, price, source, note, createdBy) VALUES (?, ?, 'manual', ?, ?)",
    [productId, Number(price), note, createdBy],
  );
  return true;
}

async function insertDiscountHistory(
  connection: mysql.PoolConnection,
  productId: number,
  discountRate: unknown,
  createdBy: number,
  note: string,
): Promise<boolean> {
  if (discountRate === undefined || discountRate === null || Number(discountRate) <= 0) return false;
  await connection.query(
    "INSERT INTO selection_discount_history (productId, discountRate, source, note, createdBy) VALUES (?, ?, 'manual', ?, ?)",
    [productId, Number(discountRate), note, createdBy],
  );
  return true;
}

export async function createSelectionProduct(
  pool: mysql.Pool,
  rawInput: Record<string, unknown>,
  createdBy: number,
): Promise<{ id: number; skuVariants: SelectionProductSkuVariant[] }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const data = canonicalProductInput({ ...rawInput, createdBy });
  data.totalCost = calculateTotalCost(data);
  if (data.commissionType === undefined) data.commissionType = "percentage";
  if (data.stock === undefined) data.stock = 0;
  if (data.talentExclusive === undefined) data.talentExclusive = 0;
  if (data.selfOperated === undefined) data.selfOperated = 0;
  if (data.tags === undefined) data.tags = [];
  if (data.skuVariants === undefined) data.skuVariants = [];
  if (data.skuName === undefined) data.skuName = null;
  if (data.skuPrice === undefined) data.skuPrice = null;
  if (data.skuLowestPrice === undefined) data.skuLowestPrice = null;
  if (data.skuDiscountRate === undefined) data.skuDiscountRate = null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const columns = [...CREATE_COLUMNS];
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((column) => dbValue(column, data[column]));
    const [result] = await connection.query(
      `INSERT INTO selection_products (${columns.join(", ")}) VALUES (${placeholders})`,
      values,
    ) as [mysql.ResultSetHeader, unknown];
    const productId = Number(result.insertId);
    if (!Number.isInteger(productId) || productId <= 0 || result.affectedRows !== 1) {
      throw new Error("商品创建失败：数据库未返回有效ID");
    }

    await insertPriceHistory(connection, productId, data.historicalLowestPrice, createdBy, "商品作成時に設定");
    await insertDiscountHistory(connection, productId, data.discountRate, createdBy, "商品作成時に設定");
    await connection.commit();
    return { id: productId, skuVariants: data.skuVariants as SelectionProductSkuVariant[] };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[createSelectionProduct] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateSelectionProduct(
  pool: mysql.Pool,
  id: number,
  rawInput: Record<string, unknown>,
  createdBy: number,
): Promise<{ success: true; skuVariants?: SelectionProductSkuVariant[] }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const data = canonicalProductInput(rawInput);
  if (data.purchasePrice !== undefined || data.shippingFee !== undefined || data.platformFee !== undefined) {
    data.totalCost = calculateTotalCost(data);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      "SELECT id FROM selection_products WHERE id = ? AND deletedAt IS NULL LIMIT 1 FOR UPDATE",
      [id],
    ) as [Array<{ id: number }>, unknown];
    if (existingRows.length !== 1) {
      throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已删除 / 商品が存在しないか削除済みです" });
    }

    const columns = UPDATE_COLUMNS.filter((column) => data[column] !== undefined);
    if (data.totalCost !== undefined) columns.push("totalCost" as typeof columns[number]);
    if (columns.length > 0) {
      const assignments = columns.map((column) => `${column} = ?`).join(", ");
      const values = columns.map((column) => dbValue(column, data[column]));
      const [result] = await connection.query(
        `UPDATE selection_products SET ${assignments} WHERE id = ? AND deletedAt IS NULL`,
        [...values, id],
      ) as [mysql.ResultSetHeader, unknown];
      if (result.affectedRows !== 1) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品更新失败：目标商品不存在 / 更新対象がありません" });
      }
    }

    const priceHistoryInserted = await insertPriceHistory(connection, id, data.historicalLowestPrice, createdBy, "手動更新");
    if (priceHistoryInserted) {
      const [minRows] = await connection.query(
        "SELECT MIN(price) AS minPrice FROM selection_price_history WHERE productId = ?",
        [id],
      ) as [Array<{ minPrice: string | number | null }>, unknown];
      if (minRows[0]?.minPrice !== null && minRows[0]?.minPrice !== undefined) {
        await connection.query("UPDATE selection_products SET historicalLowestPrice = ? WHERE id = ?", [minRows[0].minPrice, id]);
      }
    }

    const discountHistoryInserted = await insertDiscountHistory(connection, id, data.discountRate, createdBy, "手動更新");
    if (discountHistoryInserted) {
      const [maxRows] = await connection.query(
        "SELECT MAX(discountRate) AS maxDiscount FROM selection_discount_history WHERE productId = ?",
        [id],
      ) as [Array<{ maxDiscount: string | number | null }>, unknown];
      if (maxRows[0]?.maxDiscount !== null && maxRows[0]?.maxDiscount !== undefined) {
        await connection.query("UPDATE selection_products SET discountRate = ? WHERE id = ?", [maxRows[0].maxDiscount, id]);
      }
    }

    await connection.commit();
    return {
      success: true,
      ...(data.skuVariants !== undefined ? { skuVariants: data.skuVariants as SelectionProductSkuVariant[] } : {}),
    };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[updateSelectionProduct] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}
