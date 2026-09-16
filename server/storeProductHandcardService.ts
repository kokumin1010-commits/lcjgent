import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import {
  mapStoreProductHandcardRow,
  storeProductHandcardInputSchema,
  storeProductHandcardPdfSchema,
  type StoreProductHandcardContent,
  type StoreProductHandcardPdf,
  validateStoreProductHandcardEvidence,
} from "../shared/storeProductHandcard";
import { storageGet, storagePut } from "./storage";
import { inspectStoreProductHandcardPdf } from "./storeProductHandcardPdf";

let setupPromise: Promise<void> | null = null;
let drAlbaSeedPromise: Promise<void> | null = null;

const handcardPdfVariantSchema = z.enum(["normal", "mirror"]);
export type StoreProductHandcardPdfVariant = z.infer<typeof handcardPdfVariantSchema>;

const DR_ALBA_PLATFORM_PRODUCT_ID = "1735202677797193331";
const DR_ALBA_PDF_SEEDS = {
  normal: {
    sourceUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/RbqvBGZNROrueuCE.pdf",
    storageKey: "store-product-handcards/dr-alba/1735202677797193331/normal-b0f63bc6690290715da43a2b288a8187051cf30b4ff0148cea2b387b80db5763.pdf",
    fileName: "DrAlba_A4_KT板_4K.pdf",
    fileSize: 11_110_781,
    sha256: "b0f63bc6690290715da43a2b288a8187051cf30b4ff0148cea2b387b80db5763",
  },
  mirror: {
    sourceUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ZNxbJidtRqpKeScB.pdf",
    storageKey: "store-product-handcards/dr-alba/1735202677797193331/mirror-3ed27180787431ff484d70a470208d2921714d2f548b8c0f376666dde8d558a5.pdf",
    fileName: "DrAlba_A4_KT板_4K_ミラー.pdf",
    fileSize: 11_110_827,
    sha256: "3ed27180787431ff484d70a470208d2921714d2f548b8c0f376666dde8d558a5",
  },
} as const;

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

function stripMetadata(handcard: ReturnType<typeof mapStoreProductHandcardRow>): StoreProductHandcardContent {
  const { exists: _exists, revision: _revision, updatedAt: _updatedAt, updatedByName: _updatedByName, ...content } = handcard;
  return content;
}

async function getProductImageIds(conn: PoolConnection, productId: number): Promise<number[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM store_product_images WHERE productId=? AND deletedAt IS NULL",
    [productId],
  );
  return rows.map((row) => Number(row.id));
}

async function copyVerifiedSeedPdf(
  variant: StoreProductHandcardPdfVariant,
): Promise<StoreProductHandcardPdf> {
  const seed = DR_ALBA_PDF_SEEDS[variant];
  const response = await fetch(seed.sourceUrl, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Dr.Alba ${variant} PDF迁移源读取失败：HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const inspected = await inspectStoreProductHandcardPdf({
    buffer,
    fileName: seed.fileName,
    declaredMimeType: response.headers.get("content-type") || "application/pdf",
  });
  if (inspected.sha256 !== seed.sha256 || inspected.fileSize !== seed.fileSize || inspected.pageCount !== 3) {
    throw new Error(`Dr.Alba ${variant} PDF校验不一致，已停止登记`);
  }
  await storagePut(seed.storageKey, buffer, "application/pdf");
  return storeProductHandcardPdfSchema.parse({
    storageKey: seed.storageKey,
    fileName: inspected.fileName,
    fileSize: inspected.fileSize,
    sha256: inspected.sha256,
    pageCount: inspected.pageCount,
    isA4: true,
    uploadedAt: new Date().toISOString(),
    uploadedByName: "系统迁移（用户提供PDF）",
  });
}

async function seedDrAlbaHandcardPdfs(pool: Pool): Promise<void> {
  await ensureStoreProductHandcardTable(pool);
  const [productRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, storeId
       FROM store_products
      WHERE deletedAt IS NULL
        AND (platformProductId=? OR productName LIKE ?)
      ORDER BY CASE WHEN platformProductId=? THEN 0 ELSE 1 END, id
      LIMIT 1`,
    [DR_ALBA_PLATFORM_PRODUCT_ID, "%Dr alba ダーマプログラムディープアンチエイジング%", DR_ALBA_PLATFORM_PRODUCT_ID],
  );
  const product = productRows[0];
  if (!product) {
    drAlbaSeedPromise = null;
    return;
  }
  const [existingRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1",
    [Number(product.id)],
  );
  const current = mapStoreProductHandcardRow(
    existingRows[0] ? { ...parseContentJson(existingRows[0].contentJson), ...existingRows[0] } : null,
  );
  if (current.normalPdf && current.mirrorPdf) return;

  const normalPdf = current.normalPdf || await copyVerifiedSeedPdf("normal");
  const mirrorPdf = current.mirrorPdf || await copyVerifiedSeedPdf("mirror");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [lockedRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1 FOR UPDATE",
      [Number(product.id)],
    );
    const locked = mapStoreProductHandcardRow(
      lockedRows[0] ? { ...parseContentJson(lockedRows[0].contentJson), ...lockedRows[0] } : null,
    );
    if (locked.normalPdf && locked.mirrorPdf) {
      await conn.rollback();
      return;
    }
    const before = lockedRows[0] ? locked : null;
    const next: StoreProductHandcardContent = {
      ...stripMetadata(locked),
      normalPdf: locked.normalPdf || normalPdf,
      mirrorPdf: locked.mirrorPdf || mirrorPdf,
    };
    await conn.query(
      `INSERT INTO store_product_handcards
        (productId, contentJson, revision, createdById, createdByName, updatedById, updatedByName)
       VALUES (?, ?, 1, NULL, ?, NULL, ?)
       ON DUPLICATE KEY UPDATE
         contentJson=VALUES(contentJson), revision=revision+1,
         updatedById=NULL, updatedByName=VALUES(updatedByName), updatedAt=CURRENT_TIMESTAMP`,
      [Number(product.id), JSON.stringify(next), "系统迁移（用户提供PDF）", "系统迁移（用户提供PDF）"],
    );
    await conn.query(
      `INSERT INTO store_product_audit_logs
        (productId, skuId, promotionId, storeId, action, beforeJson, afterJson, actorId, actorName)
       VALUES (?, NULL, NULL, ?, 'handcard_pdf_seeded', ?, ?, NULL, ?)`,
      [Number(product.id), Number(product.storeId), before ? JSON.stringify(before) : null, JSON.stringify(next), "系统迁移（用户提供PDF）"],
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function ensureDrAlbaHandcardPdfSeed(pool: Pool): Promise<void> {
  if (!drAlbaSeedPromise) {
    drAlbaSeedPromise = seedDrAlbaHandcardPdfs(pool).catch((error) => {
      drAlbaSeedPromise = null;
      throw error;
    });
  }
  return drAlbaSeedPromise;
}

async function resolvePdf(pdf: StoreProductHandcardPdf | null) {
  if (!pdf) return null;
  const signed = await storageGet(pdf.storageKey);
  return { ...pdf, url: signed.url };
}

export async function getStoreProductHandcard(pool: Pool, productId: number) {
  await ensureStoreProductHandcardTable(pool);
  const [productRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM store_products WHERE id=? LIMIT 1",
    [productId],
  );
  const product = productRows[0];
  if (!product) throw new Error("店铺商品不存在");
  const isDrAlbaSeedTarget = String(product.platformProductId || "") === DR_ALBA_PLATFORM_PRODUCT_ID
    || String(product.productName || "").includes("Dr alba ダーマプログラムディープアンチエイジング");
  if (isDrAlbaSeedTarget) await ensureDrAlbaHandcardPdfSeed(pool);
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
  const handcard = mapStoreProductHandcardRow(raw);
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
    handcard: {
      ...handcard,
      normalPdf: await resolvePdf(handcard.normalPdf),
      mirrorPdf: await resolvePdf(handcard.mirrorPdf),
    },
  };
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
    const before = beforeRows[0]
      ? mapStoreProductHandcardRow({ ...parseContentJson(beforeRows[0].contentJson), ...beforeRows[0] })
      : null;
    const previous = before ? stripMetadata(before) : null;
    const protectedContent: StoreProductHandcardContent = {
      ...content,
      normalPdf: previous?.normalPdf || null,
      mirrorPdf: previous?.mirrorPdf || null,
    };
    await conn.query(
      `INSERT INTO store_product_handcards
        (productId, contentJson, revision, createdById, createdByName, updatedById, updatedByName)
       VALUES (?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         contentJson=VALUES(contentJson), revision=revision+1,
         updatedById=VALUES(updatedById), updatedByName=VALUES(updatedByName), updatedAt=CURRENT_TIMESTAMP`,
      [productId, JSON.stringify(protectedContent), actor.id, actor.name, actor.id, actor.name],
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
      [productId, Number(product.storeId), before ? JSON.stringify(before) : null, JSON.stringify(after), actor.id, actor.name],
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

export async function registerStoreProductHandcardPdf(
  pool: Pool,
  input: {
    productId: number;
    variant: StoreProductHandcardPdfVariant;
    storageKey: string;
    fileName: string;
    fileSize: number;
    sha256: string;
    pageCount: number;
    isA4: boolean | null;
  },
  actor: { id: number | null; name: string },
): Promise<{ productId: number; pdf: StoreProductHandcardPdf; previousStorageKey: string | null; revision: number }> {
  const variant = handcardPdfVariantSchema.parse(input.variant);
  const pdf = storeProductHandcardPdfSchema.parse({
    storageKey: input.storageKey,
    fileName: input.fileName,
    fileSize: input.fileSize,
    sha256: input.sha256,
    pageCount: input.pageCount,
    isA4: input.isA4,
    uploadedAt: new Date().toISOString(),
    uploadedByName: actor.name,
  });
  await ensureStoreProductHandcardTable(pool);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [productRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM store_products WHERE id=? LIMIT 1 FOR UPDATE",
      [input.productId],
    );
    const product = productRows[0];
    if (!product) throw new Error("店铺商品不存在");
    const [beforeRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1 FOR UPDATE",
      [input.productId],
    );
    const before = mapStoreProductHandcardRow(
      beforeRows[0] ? { ...parseContentJson(beforeRows[0].contentJson), ...beforeRows[0] } : null,
    );
    const field = variant === "normal" ? "normalPdf" : "mirrorPdf";
    const previousStorageKey = before[field]?.storageKey || null;
    const next: StoreProductHandcardContent = { ...stripMetadata(before), [field]: pdf };
    await conn.query(
      `INSERT INTO store_product_handcards
        (productId, contentJson, revision, createdById, createdByName, updatedById, updatedByName)
       VALUES (?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         contentJson=VALUES(contentJson), revision=revision+1,
         updatedById=VALUES(updatedById), updatedByName=VALUES(updatedByName), updatedAt=CURRENT_TIMESTAMP`,
      [input.productId, JSON.stringify(next), actor.id, actor.name, actor.id, actor.name],
    );
    await conn.query(
      `INSERT INTO store_product_audit_logs
        (productId, skuId, promotionId, storeId, action, beforeJson, afterJson, actorId, actorName)
       VALUES (?, NULL, NULL, ?, 'handcard_pdf_uploaded', ?, ?, ?, ?)`,
      [input.productId, Number(product.storeId), JSON.stringify(before[field] || null), JSON.stringify({ variant, ...pdf }), actor.id, actor.name],
    );
    const [revisionRows] = await conn.query<RowDataPacket[]>(
      "SELECT revision FROM store_product_handcards WHERE productId=? LIMIT 1",
      [input.productId],
    );
    await conn.commit();
    return { productId: input.productId, pdf, previousStorageKey, revision: Number(revisionRows[0]?.revision || 1) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function removeStoreProductHandcardPdf(
  pool: Pool,
  input: { productId: number; variant: StoreProductHandcardPdfVariant },
  actor: { id: number | null; name: string },
): Promise<{ productId: number; removedStorageKey: string | null }> {
  const variant = handcardPdfVariantSchema.parse(input.variant);
  await ensureStoreProductHandcardTable(pool);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [productRows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_products WHERE id=? LIMIT 1 FOR UPDATE", [input.productId]);
    const product = productRows[0];
    if (!product) throw new Error("店铺商品不存在");
    const [beforeRows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_handcards WHERE productId=? LIMIT 1 FOR UPDATE", [input.productId]);
    const before = mapStoreProductHandcardRow(beforeRows[0] ? { ...parseContentJson(beforeRows[0].contentJson), ...beforeRows[0] } : null);
    const field = variant === "normal" ? "normalPdf" : "mirrorPdf";
    const removedStorageKey = before[field]?.storageKey || null;
    if (!removedStorageKey) {
      await conn.rollback();
      return { productId: input.productId, removedStorageKey: null };
    }
    const next: StoreProductHandcardContent = { ...stripMetadata(before), [field]: null };
    await conn.query(
      `UPDATE store_product_handcards
          SET contentJson=?, revision=revision+1, updatedById=?, updatedByName=?, updatedAt=CURRENT_TIMESTAMP
        WHERE productId=?`,
      [JSON.stringify(next), actor.id, actor.name, input.productId],
    );
    await conn.query(
      `INSERT INTO store_product_audit_logs
        (productId, skuId, promotionId, storeId, action, beforeJson, afterJson, actorId, actorName)
       VALUES (?, NULL, NULL, ?, 'handcard_pdf_removed', ?, ?, ?, ?)`,
      [input.productId, Number(product.storeId), JSON.stringify({ variant, pdf: before[field] }), JSON.stringify({ variant, pdf: null }), actor.id, actor.name],
    );
    await conn.commit();
    return { productId: input.productId, removedStorageKey };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
