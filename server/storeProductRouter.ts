import { TRPCError } from "@trpc/server";
import { z } from "zod";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";

let poolInstance: Pool | null = null;
async function getPool(): Promise<Pool> {
  if (poolInstance) return poolInstance;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  poolInstance = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 5 });
  return poolInstance;
}

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const moneySchema = z.number().min(0).max(9_999_999_999).nullable().optional();
const statusSchema = z.enum(["draft", "online", "offline"]);
const skuStatusSchema = z.enum(["active", "inactive"]);

const productFieldsSchema = z.object({
  selectionProductId: z.number().int().positive().nullable().optional(),
  platformProductId: nullableText(128),
  spuCode: nullableText(128),
  productName: z.string().trim().min(1).max(500),
  brandName: nullableText(255),
  category: nullableText(255),
  productUrl: z.string().trim().url().max(1000).nullable().optional().or(z.literal("")),
  basePrice: moneySchema,
  currency: z.string().trim().min(1).max(16).default("JPY"),
  stock: z.number().int().min(0).max(2_147_483_647).default(0),
  status: statusSchema.default("draft"),
  notes: nullableText(10_000),
});

function actor(ctx: any): { id: number | null; name: string } {
  return {
    id: ctx?.user?.id ? Number(ctx.user.id) : null,
    name: String(ctx?.user?.name || ctx?.user?.email || "Unknown").slice(0, 255),
  };
}

function normalizeNullable(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  return value;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function audit(
  conn: PoolConnection,
  params: {
    storeId: number;
    action: string;
    productId?: number | null;
    skuId?: number | null;
    promotionId?: number | null;
    before?: unknown;
    after?: unknown;
    actorId: number | null;
    actorName: string;
  },
): Promise<void> {
  await conn.query(
    `INSERT INTO store_product_audit_logs
      (productId, skuId, promotionId, storeId, action, beforeJson, afterJson, actorId, actorName)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.productId ?? null,
      params.skuId ?? null,
      params.promotionId ?? null,
      params.storeId,
      params.action,
      params.before === undefined ? null : JSON.stringify(params.before),
      params.after === undefined ? null : JSON.stringify(params.after),
      params.actorId,
      params.actorName,
    ],
  );
}

async function assertActiveStore(conn: PoolConnection | Pool, storeId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM managed_stores WHERE id = ? AND isActive = 1 LIMIT 1",
    [storeId],
  );
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "店铺不存在或已停用" });
}

async function getProductRow(conn: PoolConnection | Pool, productId: number): Promise<any> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM store_products WHERE id = ? LIMIT 1",
    [productId],
  );
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "店铺商品不存在" });
  return row;
}

function mapProductRow(row: any): any {
  return {
    ...row,
    basePrice: numberOrNull(row.basePrice),
    stock: Number(row.stock || 0),
    skuCount: Number(row.skuCount || 0),
    imageCount: Number(row.imageCount || 0),
    promotionId: row.promotionId === null || row.promotionId === undefined ? null : Number(row.promotionId),
    activePromotionCount: Number(row.activePromotionCount || 0),
    lowestPromotionPrice: numberOrNull(row.lowestPromotionPrice),
    promotionPrice: numberOrNull(row.promotionPrice),
    discountValue: numberOrNull(row.discountValue),
    promotionEnabled: Boolean(row.promotionEnabled),
  };
}

export function calculatePromotion(input: {
  basePrice: number;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  isEnabled: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}): { promotionPrice: number; status: "scheduled" | "active" | "paused" | "ended" } {
  if (input.basePrice <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "推广需要先登记大于0的正常售价" });
  if (input.discountType === "percentage" && (input.discountValue <= 0 || input.discountValue > 100)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "百分比折扣必须大于0且不超过100%" });
  }
  if (input.discountType === "fixed_amount" && (input.discountValue <= 0 || input.discountValue > input.basePrice)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "固定优惠必须大于0且不能超过正常售价" });
  }
  if (input.startsAt && input.endsAt && new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "推广结束时间不能早于开始时间" });
  }
  const rawPrice = input.discountType === "percentage"
    ? input.basePrice * (1 - input.discountValue / 100)
    : input.basePrice - input.discountValue;
  const promotionPrice = Math.max(0, Math.round(rawPrice));
  const now = Date.now();
  const startsAt = input.startsAt ? new Date(input.startsAt).getTime() : null;
  const endsAt = input.endsAt ? new Date(input.endsAt).getTime() : null;
  let status: "scheduled" | "active" | "paused" | "ended" = "active";
  if (!input.isEnabled) status = "paused";
  else if (endsAt !== null && endsAt < now) status = "ended";
  else if (startsAt !== null && startsAt > now) status = "scheduled";
  return { promotionPrice, status };
}


async function getPromotionBasePrice(
  conn: PoolConnection,
  product: any,
  productId: number,
  skuId?: number | null,
): Promise<{ basePrice: number; sku: any | null }> {
  if (!skuId) {
    const basePrice = numberOrNull(product.basePrice);
    if (basePrice === null) throw new TRPCError({ code: "BAD_REQUEST", message: "请先登记商品正常售价" });
    return { basePrice, sku: null };
  }

  const [skuRows] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM store_product_skus WHERE id=? AND productId=? AND deletedAt IS NULL LIMIT 1",
    [skuId, productId],
  );
  const sku = skuRows[0];
  if (!sku) throw new TRPCError({ code: "NOT_FOUND", message: "SKU不存在或已归档" });
  const basePrice = numberOrNull(sku.salePrice) ?? numberOrNull(product.basePrice);
  if (basePrice === null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请先登记SKU售价或商品正常售价" });
  }
  return { basePrice, sku };
}

function uniqueConstraintError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Duplicate entry")) {
    throw new TRPCError({ code: "CONFLICT", message: "同一店铺内商品ID、SPU或SKU已存在" });
  }
  throw error;
}

export const storeProductRouter = router({
  list: protectedProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      search: z.string().trim().max(200).optional(),
      brandName: z.string().trim().max(255).optional(),
      status: statusSchema.optional(),
      promotion: z.enum(["all", "active", "none"]).default("all"),
      includeArchived: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const pool = await getPool();
      await assertActiveStore(pool, input.storeId);
      const where = ["p.storeId = ?"];
      const params: any[] = [input.storeId];
      if (!input.includeArchived) where.push("p.deletedAt IS NULL");
      if (input.search) {
        const like = `%${input.search}%`;
        where.push(`(p.productName LIKE ? OR p.platformProductId LIKE ? OR p.spuCode LIKE ? OR EXISTS (
          SELECT 1 FROM store_product_skus sx
           WHERE sx.productId = p.id AND sx.deletedAt IS NULL
             AND (sx.skuCode LIKE ? OR sx.platformSkuId LIKE ? OR sx.barcode LIKE ? OR sx.variantName LIKE ?)
        ))`);
        params.push(like, like, like, like, like, like, like);
      }
      if (input.brandName) {
        where.push("p.brandName = ?");
        params.push(input.brandName);
      }
      if (input.status) {
        where.push("p.status = ?");
        params.push(input.status);
      }
      if (input.promotion === "active") {
        where.push("EXISTS (SELECT 1 FROM store_product_promotions px WHERE px.productId=p.id AND px.deletedAt IS NULL AND px.isEnabled=1 AND px.status IN ('scheduled','active'))");
      } else if (input.promotion === "none") {
        where.push("NOT EXISTS (SELECT 1 FROM store_product_promotions px WHERE px.productId=p.id AND px.deletedAt IS NULL AND px.isEnabled=1 AND px.status IN ('scheduled','active'))");
      }
      const whereSql = where.join(" AND ");
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM store_products p WHERE ${whereSql}`,
        params,
      );
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.*,
                (SELECT COUNT(*) FROM store_product_skus s WHERE s.productId=p.id AND s.deletedAt IS NULL) AS skuCount,
                (SELECT COUNT(*) FROM store_product_images i WHERE i.productId=p.id AND i.deletedAt IS NULL) AS imageCount,
                promo.id AS promotionId, promo.isEnabled AS promotionEnabled,
                promo.discountType, promo.discountValue, promo.promotionPrice,
                promo.startsAt AS promotionStartsAt, promo.endsAt AS promotionEndsAt,
                promo.status AS promotionStatus,
                (SELECT COUNT(*) FROM store_product_promotions pa
                  WHERE pa.productId=p.id AND pa.deletedAt IS NULL AND pa.isEnabled=1
                    AND pa.status IN ('scheduled','active')) AS activePromotionCount,
                (SELECT MIN(pa.promotionPrice) FROM store_product_promotions pa
                  WHERE pa.productId=p.id AND pa.deletedAt IS NULL AND pa.isEnabled=1
                    AND pa.status IN ('scheduled','active')) AS lowestPromotionPrice
           FROM store_products p
           LEFT JOIN store_product_promotions promo ON promo.id = (
             SELECT pp.id FROM store_product_promotions pp
              WHERE pp.productId=p.id AND pp.deletedAt IS NULL
              ORDER BY pp.isEnabled DESC, pp.id DESC LIMIT 1
           )
          WHERE ${whereSql}
          ORDER BY p.deletedAt IS NOT NULL, p.updatedAt DESC, p.id DESC
          LIMIT ? OFFSET ?`,
        [...params, input.limit, input.offset],
      );
      return { items: rows.map(mapProductRow), total: Number(countRows[0]?.total || 0) };
    }),

  summary: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pool = await getPool();
      await assertActiveStore(pool, input.storeId);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='online' THEN 1 ELSE 0 END) AS onlineCount,
          SUM(CASE WHEN status='offline' THEN 1 ELSE 0 END) AS offlineCount,
          SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS draftCount,
          SUM(stock) AS totalStock,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM store_product_promotions pp
             WHERE pp.productId=p.id AND pp.deletedAt IS NULL AND pp.isEnabled=1 AND pp.status IN ('scheduled','active')
          ) THEN 1 ELSE 0 END) AS promotedCount
         FROM store_products p
         WHERE storeId=? AND deletedAt IS NULL`,
        [input.storeId],
      );
      const row = rows[0] || {};
      return {
        total: Number(row.total || 0),
        onlineCount: Number(row.onlineCount || 0),
        offlineCount: Number(row.offlineCount || 0),
        draftCount: Number(row.draftCount || 0),
        totalStock: Number(row.totalStock || 0),
        promotedCount: Number(row.promotedCount || 0),
      };
    }),

  detail: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pool = await getPool();
      const product = await getProductRow(pool, input.productId);
      const [skuRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM store_product_skus WHERE productId=? AND deletedAt IS NULL ORDER BY id",
        [input.productId],
      );
      const [imageRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM store_product_images WHERE productId=? AND deletedAt IS NULL ORDER BY isPrimary DESC, sortOrder, id",
        [input.productId],
      );
      const [promotionRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM store_product_promotions WHERE productId=? AND deletedAt IS NULL ORDER BY id DESC",
        [input.productId],
      );
      const [auditRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, productId, skuId, promotionId, storeId, action, beforeJson, afterJson, actorId, actorName, createdAt
           FROM store_product_audit_logs WHERE productId=? ORDER BY id DESC LIMIT 100`,
        [input.productId],
      );
      return {
        product: mapProductRow(product),
        skus: skuRows.map((row) => ({ ...row, salePrice: numberOrNull(row.salePrice), stock: Number(row.stock || 0) })),
        images: imageRows.map((row) => ({ ...row, fileSize: Number(row.fileSize || 0), sortOrder: Number(row.sortOrder || 0), isPrimary: Boolean(row.isPrimary) })),
        promotions: promotionRows.map((row) => ({
          ...row,
          isEnabled: Boolean(row.isEnabled),
          discountValue: Number(row.discountValue || 0),
          basePriceSnapshot: Number(row.basePriceSnapshot || 0),
          promotionPrice: Number(row.promotionPrice || 0),
        })),
        audit: auditRows,
      };
    }),

  selectionCandidates: protectedProcedure
    .input(z.object({ search: z.string().trim().max(200).optional(), limit: z.number().int().min(1).max(200).default(100) }))
    .query(async ({ input }) => {
      const pool = await getPool();
      const params: any[] = [];
      let where = "WHERE deletedAt IS NULL";
      if (input.search) {
        const like = `%${input.search}%`;
        where += " AND (productName LIKE ? OR brandName LIKE ? OR productId LIKE ? OR barcode LIKE ?)";
        params.push(like, like, like, like);
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, productName, brandName, productId, barcode, price, marketPrice, stock, images, status
           FROM selection_products ${where} ORDER BY updatedAt DESC, id DESC LIMIT ?`,
        [...params, input.limit],
      );
      return rows.map((row) => ({ ...row, price: numberOrNull(row.price), marketPrice: numberOrNull(row.marketPrice), stock: Number(row.stock || 0) }));
    }),

  create: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive(), data: productFieldsSchema }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        await assertActiveStore(conn, input.storeId);
        if (input.data.selectionProductId) {
          const [rows] = await conn.query<RowDataPacket[]>(
            "SELECT id FROM selection_products WHERE id=? AND deletedAt IS NULL LIMIT 1",
            [input.data.selectionProductId],
          );
          if (!rows[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "关联的选品商品不存在" });
        }
        const d = input.data;
        const [result] = await conn.query<ResultSetHeader>(
          `INSERT INTO store_products
            (storeId, selectionProductId, platformProductId, spuCode, productName, brandName, category, productUrl,
             basePrice, currency, stock, status, notes, createdById, createdByName, updatedById, updatedByName)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.storeId,
            d.selectionProductId ?? null,
            normalizeNullable(d.platformProductId),
            normalizeNullable(d.spuCode),
            d.productName.trim(),
            normalizeNullable(d.brandName),
            normalizeNullable(d.category),
            normalizeNullable(d.productUrl),
            d.basePrice ?? null,
            d.currency || "JPY",
            d.stock,
            d.status,
            normalizeNullable(d.notes),
            who.id,
            who.name,
            who.id,
            who.name,
          ],
        );
        const productId = Number(result.insertId);
        const created = await getProductRow(conn, productId);
        await audit(conn, { storeId: input.storeId, productId, action: "product_created", after: created, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { id: productId };
      } catch (error) {
        await conn.rollback();
        uniqueConstraintError(error);
      } finally {
        conn.release();
      }
    }),

  update: protectedProcedure
    .input(z.object({ productId: z.number().int().positive(), data: productFieldsSchema.partial() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const before = await getProductRow(conn, input.productId);
        const fields = input.data;
        const sets: string[] = [];
        const params: any[] = [];
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) continue;
          sets.push(`${key}=?`);
          params.push(normalizeNullable(value));
        }
        if (sets.length > 0) {
          sets.push("updatedById=?", "updatedByName=?");
          params.push(who.id, who.name, input.productId);
          await conn.query(`UPDATE store_products SET ${sets.join(",")} WHERE id=?`, params);
        }
        const after = await getProductRow(conn, input.productId);
        await audit(conn, { storeId: Number(before.storeId), productId: input.productId, action: "product_updated", before, after, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) {
        await conn.rollback();
        uniqueConstraintError(error);
      } finally {
        conn.release();
      }
    }),

  archive: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const before = await getProductRow(conn, input.productId);
        await conn.query("UPDATE store_products SET deletedAt=CURRENT_TIMESTAMP, updatedById=?, updatedByName=? WHERE id=?", [who.id, who.name, input.productId]);
        await audit(conn, { storeId: Number(before.storeId), productId: input.productId, action: "product_archived", before, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally { conn.release(); }
    }),

  restore: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const before = await getProductRow(conn, input.productId);
        await conn.query("UPDATE store_products SET deletedAt=NULL, updatedById=?, updatedByName=? WHERE id=?", [who.id, who.name, input.productId]);
        const after = await getProductRow(conn, input.productId);
        await audit(conn, { storeId: Number(before.storeId), productId: input.productId, action: "product_restored", before, after, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) {
        await conn.rollback();
        uniqueConstraintError(error);
      } finally { conn.release(); }
    }),

  saveSku: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      skuId: z.number().int().positive().optional(),
      platformSkuId: nullableText(128),
      skuCode: nullableText(128),
      barcode: nullableText(128),
      variantName: z.string().trim().min(1).max(500),
      imageUrl: nullableText(1000),
      imageKey: nullableText(500),
      salePrice: moneySchema,
      stock: z.number().int().min(0).max(2_147_483_647).default(0),
      status: skuStatusSchema.default("active"),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        let skuId = input.skuId;
        let before: any = null;
        const values = [
          normalizeNullable(input.platformSkuId), normalizeNullable(input.skuCode), normalizeNullable(input.barcode),
          input.variantName.trim(), normalizeNullable(input.imageUrl), normalizeNullable(input.imageKey), input.salePrice ?? null,
          input.stock, input.status, who.id, who.name,
        ];
        if (skuId) {
          const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_skus WHERE id=? AND productId=? LIMIT 1", [skuId, input.productId]);
          before = rows[0];
          if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "SKU不存在" });
          await conn.query(
            `UPDATE store_product_skus SET platformSkuId=?, skuCode=?, barcode=?, variantName=?, imageUrl=?, imageKey=?, salePrice=?, stock=?, status=?, updatedById=?, updatedByName=? WHERE id=?`,
            [...values, skuId],
          );
        } else {
          const [result] = await conn.query<ResultSetHeader>(
            `INSERT INTO store_product_skus
              (productId, platformSkuId, skuCode, barcode, variantName, imageUrl, imageKey, salePrice, stock, status, createdById, createdByName, updatedById, updatedByName)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [input.productId, ...values.slice(0, 9), who.id, who.name, who.id, who.name],
          );
          skuId = Number(result.insertId);
        }
        const [afterRows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_skus WHERE id=? LIMIT 1", [skuId]);
        await audit(conn, { storeId: Number(product.storeId), productId: input.productId, skuId, action: before ? "sku_updated" : "sku_created", before, after: afterRows[0], actorId: who.id, actorName: who.name });
        await conn.commit();
        return { id: skuId! };
      } catch (error) {
        await conn.rollback();
        uniqueConstraintError(error);
      } finally { conn.release(); }
    }),

  archiveSku: protectedProcedure
    .input(z.object({ productId: z.number().int().positive(), skuId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_skus WHERE id=? AND productId=? LIMIT 1", [input.skuId, input.productId]);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "SKU不存在" });
        await conn.query("UPDATE store_product_skus SET deletedAt=CURRENT_TIMESTAMP, updatedById=?, updatedByName=? WHERE id=?", [who.id, who.name, input.skuId]);
        await conn.query(
          "UPDATE store_product_promotions SET isEnabled=0, status='paused', updatedById=?, updatedByName=? WHERE skuId=? AND deletedAt IS NULL",
          [who.id, who.name, input.skuId],
        );
        await audit(conn, { storeId: Number(product.storeId), productId: input.productId, skuId: input.skuId, action: "sku_archived", before: rows[0], actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
    }),

  addImage: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      skuId: z.number().int().positive().nullable().optional(),
      imageUrl: z.string().min(1).max(1000),
      imageKey: z.string().min(1).max(500),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      fileSize: z.number().int().min(1).max(8 * 1024 * 1024),
      isPrimary: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        const [countRows] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM store_product_images WHERE productId=? AND deletedAt IS NULL", [input.productId]);
        if (Number(countRows[0]?.count || 0) >= 8) throw new TRPCError({ code: "BAD_REQUEST", message: "每个商品最多登记8张图片" });
        if (input.skuId) {
          const [skuRows] = await conn.query<RowDataPacket[]>("SELECT id FROM store_product_skus WHERE id=? AND productId=? AND deletedAt IS NULL LIMIT 1", [input.skuId, input.productId]);
          if (!skuRows[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "图片SKU不属于该商品" });
        }
        const makePrimary = input.isPrimary || Number(countRows[0]?.count || 0) === 0;
        if (makePrimary && !input.skuId) await conn.query("UPDATE store_product_images SET isPrimary=0 WHERE productId=? AND skuId IS NULL AND deletedAt IS NULL", [input.productId]);
        const [sortRows] = await conn.query<RowDataPacket[]>("SELECT COALESCE(MAX(sortOrder), -1) + 1 AS nextOrder FROM store_product_images WHERE productId=? AND deletedAt IS NULL", [input.productId]);
        const [result] = await conn.query<ResultSetHeader>(
          `INSERT INTO store_product_images (productId, skuId, imageUrl, imageKey, mimeType, fileSize, sortOrder, isPrimary, uploadedById, uploadedByName)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.productId, input.skuId ?? null, input.imageUrl, input.imageKey, input.mimeType, input.fileSize, Number(sortRows[0]?.nextOrder || 0), makePrimary ? 1 : 0, who.id, who.name],
        );
        if (makePrimary && !input.skuId) {
          await conn.query("UPDATE store_products SET mainImageUrl=?, mainImageKey=?, updatedById=?, updatedByName=? WHERE id=?", [input.imageUrl, input.imageKey, who.id, who.name, input.productId]);
        }
        if (input.skuId) await conn.query("UPDATE store_product_skus SET imageUrl=?, imageKey=?, updatedById=?, updatedByName=? WHERE id=?", [input.imageUrl, input.imageKey, who.id, who.name, input.skuId]);
        const imageId = Number(result.insertId);
        await audit(conn, { storeId: Number(product.storeId), productId: input.productId, skuId: input.skuId, action: "image_added", after: { imageId, imageKey: input.imageKey, isPrimary: makePrimary }, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { id: imageId };
      } catch (error) { await conn.rollback(); uniqueConstraintError(error); } finally { conn.release(); }
    }),

  setPrimaryImage: protectedProcedure
    .input(z.object({ productId: z.number().int().positive(), imageId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_images WHERE id=? AND productId=? AND skuId IS NULL AND deletedAt IS NULL LIMIT 1", [input.imageId, input.productId]);
        const image = rows[0];
        if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "商品图片不存在" });
        await conn.query("UPDATE store_product_images SET isPrimary=0 WHERE productId=? AND skuId IS NULL AND deletedAt IS NULL", [input.productId]);
        await conn.query("UPDATE store_product_images SET isPrimary=1 WHERE id=?", [input.imageId]);
        await conn.query("UPDATE store_products SET mainImageUrl=?, mainImageKey=?, updatedById=?, updatedByName=? WHERE id=?", [image.imageUrl, image.imageKey, who.id, who.name, input.productId]);
        await audit(conn, { storeId: Number(product.storeId), productId: input.productId, action: "primary_image_changed", after: { imageId: input.imageId, imageKey: image.imageKey }, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
    }),

  removeImage: protectedProcedure
    .input(z.object({ productId: z.number().int().positive(), imageId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_images WHERE id=? AND productId=? AND deletedAt IS NULL LIMIT 1", [input.imageId, input.productId]);
        const image = rows[0];
        if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "商品图片不存在" });
        await conn.query("UPDATE store_product_images SET deletedAt=CURRENT_TIMESTAMP, isPrimary=0 WHERE id=?", [input.imageId]);
        if (image.skuId) {
          await conn.query("UPDATE store_product_skus SET imageUrl=NULL, imageKey=NULL, updatedById=?, updatedByName=? WHERE id=? AND imageKey=?", [who.id, who.name, image.skuId, image.imageKey]);
        } else if (image.isPrimary) {
          const [nextRows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_images WHERE productId=? AND skuId IS NULL AND deletedAt IS NULL ORDER BY sortOrder, id LIMIT 1", [input.productId]);
          const next = nextRows[0];
          if (next) await conn.query("UPDATE store_product_images SET isPrimary=1 WHERE id=?", [next.id]);
          await conn.query("UPDATE store_products SET mainImageUrl=?, mainImageKey=?, updatedById=?, updatedByName=? WHERE id=?", [next?.imageUrl || null, next?.imageKey || null, who.id, who.name, input.productId]);
        }
        await audit(conn, { storeId: Number(product.storeId), productId: input.productId, skuId: image.skuId, action: "image_removed", before: { imageId: input.imageId, imageKey: image.imageKey }, actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
    }),

  savePromotion: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      skuId: z.number().int().positive().nullable().optional(),
      promotionId: z.number().int().positive().optional(),
      isEnabled: z.boolean().default(true),
      discountType: z.enum(["percentage", "fixed_amount"]),
      discountValue: z.number().positive().max(9_999_999_999),
      startsAt: z.string().datetime({ offset: true }).nullable().optional(),
      endsAt: z.string().datetime({ offset: true }).nullable().optional(),
      channel: nullableText(100),
      notes: nullableText(5000),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        const skuId = input.skuId ?? null;
        const { basePrice } = await getPromotionBasePrice(conn, product, input.productId, skuId);
        if (skuId) {
          const [legacyRows] = await conn.query<RowDataPacket[]>(
            "SELECT * FROM store_product_promotions WHERE productId=? AND skuId IS NULL AND deletedAt IS NULL",
            [input.productId],
          );
          if (legacyRows.length > 0) {
            await conn.query(
              "UPDATE store_product_promotions SET isEnabled=0, status='paused', deletedAt=CURRENT_TIMESTAMP, updatedById=?, updatedByName=? WHERE productId=? AND skuId IS NULL AND deletedAt IS NULL",
              [who.id, who.name, input.productId],
            );
            for (const legacy of legacyRows) {
              await audit(conn, {
                storeId: Number(product.storeId),
                productId: input.productId,
                promotionId: Number(legacy.id),
                action: "legacy_product_promotion_archived",
                before: legacy,
                after: { replacedBySkuId: skuId },
                actorId: who.id,
                actorName: who.name,
              });
            }
          }
        }
        const calculated = calculatePromotion({
          basePrice,
          discountType: input.discountType,
          discountValue: input.discountValue,
          isEnabled: input.isEnabled,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        });
        let promotionId = input.promotionId;
        let before: any = null;
        if (promotionId) {
          const [rows] = await conn.query<RowDataPacket[]>(
            "SELECT * FROM store_product_promotions WHERE id=? AND productId=? AND deletedAt IS NULL LIMIT 1",
            [promotionId, input.productId],
          );
          before = rows[0];
          if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "推广记录不存在" });
          const beforeSkuId = before.skuId === null ? null : Number(before.skuId);
          if (beforeSkuId !== skuId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "推广记录与当前SKU不一致" });
          }
        }
        if (input.isEnabled) {
          await conn.query(
            `UPDATE store_product_promotions
                SET isEnabled=0, status='paused', updatedById=?, updatedByName=?
              WHERE productId=? AND deletedAt IS NULL AND id<>?
                AND ((skuId IS NULL AND ? IS NULL) OR skuId=?)`,
            [who.id, who.name, input.productId, promotionId || 0, skuId, skuId],
          );
        }
        if (promotionId) {
          await conn.query(
            `UPDATE store_product_promotions
                SET isEnabled=?, discountType=?, discountValue=?, basePriceSnapshot=?, promotionPrice=?,
                    startsAt=?, endsAt=?, channel=?, status=?, notes=?, updatedById=?, updatedByName=?
              WHERE id=?`,
            [
              input.isEnabled ? 1 : 0,
              input.discountType,
              input.discountValue,
              basePrice,
              calculated.promotionPrice,
              input.startsAt ? new Date(input.startsAt) : null,
              input.endsAt ? new Date(input.endsAt) : null,
              normalizeNullable(input.channel),
              calculated.status,
              normalizeNullable(input.notes),
              who.id,
              who.name,
              promotionId,
            ],
          );
        } else {
          const [result] = await conn.query<ResultSetHeader>(
            `INSERT INTO store_product_promotions
              (productId, skuId, isEnabled, discountType, discountValue, basePriceSnapshot, promotionPrice,
               startsAt, endsAt, channel, status, notes, createdById, createdByName, updatedById, updatedByName)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              input.productId,
              skuId,
              input.isEnabled ? 1 : 0,
              input.discountType,
              input.discountValue,
              basePrice,
              calculated.promotionPrice,
              input.startsAt ? new Date(input.startsAt) : null,
              input.endsAt ? new Date(input.endsAt) : null,
              normalizeNullable(input.channel),
              calculated.status,
              normalizeNullable(input.notes),
              who.id,
              who.name,
              who.id,
              who.name,
            ],
          );
          promotionId = Number(result.insertId);
        }
        const [afterRows] = await conn.query<RowDataPacket[]>(
          "SELECT * FROM store_product_promotions WHERE id=? LIMIT 1",
          [promotionId],
        );
        await audit(conn, {
          storeId: Number(product.storeId),
          productId: input.productId,
          skuId,
          promotionId,
          action: before ? "promotion_updated" : "promotion_created",
          before,
          after: afterRows[0],
          actorId: who.id,
          actorName: who.name,
        });
        await conn.commit();
        return { id: promotionId!, skuId, promotionPrice: calculated.promotionPrice, status: calculated.status };
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }),

  pausePromotion: protectedProcedure
    .input(z.object({ productId: z.number().int().positive(), promotionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const product = await getProductRow(conn, input.productId);
        const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_product_promotions WHERE id=? AND productId=? AND deletedAt IS NULL LIMIT 1", [input.promotionId, input.productId]);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "推广记录不存在" });
        await conn.query("UPDATE store_product_promotions SET isEnabled=0, status='paused', updatedById=?, updatedByName=? WHERE id=?", [who.id, who.name, input.promotionId]);
        await audit(conn, { storeId: Number(product.storeId), productId: input.productId, promotionId: input.promotionId, action: "promotion_paused", before: rows[0], actorId: who.id, actorName: who.name });
        await conn.commit();
        return { success: true };
      } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
    }),

  migrateLegacyPromotions: adminProcedure
    .input(z.object({ dryRun: z.boolean().default(true), productId: z.number().int().positive().optional() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      const who = actor(ctx);
      try {
        await conn.beginTransaction();
        const params: any[] = [];
        let productFilter = "";
        if (input.productId) {
          productFilter = " AND promo.productId=?";
          params.push(input.productId);
        }
        const [legacyRows] = await conn.query<RowDataPacket[]>(
          `SELECT promo.*, p.storeId, p.basePrice AS productBasePrice
             FROM store_product_promotions promo
             INNER JOIN store_products p ON p.id=promo.productId AND p.deletedAt IS NULL
            WHERE promo.skuId IS NULL AND promo.deletedAt IS NULL
              AND EXISTS (SELECT 1 FROM store_product_skus sx WHERE sx.productId=promo.productId AND sx.deletedAt IS NULL)
              ${productFilter}
            ORDER BY promo.id`,
          params,
        );
        let createdCount = 0;
        let skuTargetCount = 0;
        const productIds = new Set<number>();
        for (const legacy of legacyRows) {
          const productId = Number(legacy.productId);
          productIds.add(productId);
          const [skuRows] = await conn.query<RowDataPacket[]>(
            "SELECT * FROM store_product_skus WHERE productId=? AND deletedAt IS NULL ORDER BY id",
            [productId],
          );
          skuTargetCount += skuRows.length;
          if (input.dryRun) continue;

          for (const sku of skuRows) {
            const basePrice = numberOrNull(sku.salePrice) ?? numberOrNull(legacy.productBasePrice) ?? numberOrNull(legacy.basePriceSnapshot);
            if (basePrice === null) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `SKU #${sku.id}缺少正常售价，无法迁移折扣` });
            }
            const calculated = calculatePromotion({
              basePrice,
              discountType: legacy.discountType,
              discountValue: Number(legacy.discountValue),
              isEnabled: Boolean(legacy.isEnabled),
              startsAt: legacy.startsAt ? new Date(legacy.startsAt).toISOString() : null,
              endsAt: legacy.endsAt ? new Date(legacy.endsAt).toISOString() : null,
            });
            const [result] = await conn.query<ResultSetHeader>(
              `INSERT INTO store_product_promotions
                (productId, skuId, isEnabled, discountType, discountValue, basePriceSnapshot, promotionPrice,
                 startsAt, endsAt, channel, status, notes, createdById, createdByName, updatedById, updatedByName)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                productId,
                Number(sku.id),
                legacy.isEnabled ? 1 : 0,
                legacy.discountType,
                Number(legacy.discountValue),
                basePrice,
                calculated.promotionPrice,
                legacy.startsAt,
                legacy.endsAt,
                legacy.channel,
                calculated.status,
                legacy.notes,
                who.id,
                who.name,
                who.id,
                who.name,
              ],
            );
            const promotionId = Number(result.insertId);
            await audit(conn, {
              storeId: Number(legacy.storeId),
              productId,
              skuId: Number(sku.id),
              promotionId,
              action: "promotion_migrated_to_sku",
              before: { legacyPromotionId: Number(legacy.id) },
              after: { skuId: Number(sku.id), discountType: legacy.discountType, discountValue: Number(legacy.discountValue) },
              actorId: who.id,
              actorName: who.name,
            });
            createdCount += 1;
          }

          await conn.query(
            "UPDATE store_product_promotions SET isEnabled=0, status='paused', deletedAt=CURRENT_TIMESTAMP, updatedById=?, updatedByName=? WHERE id=?",
            [who.id, who.name, Number(legacy.id)],
          );
          await audit(conn, {
            storeId: Number(legacy.storeId),
            productId,
            promotionId: Number(legacy.id),
            action: "legacy_product_promotion_archived",
            before: legacy,
            after: { migratedSkuCount: skuRows.length },
            actorId: who.id,
            actorName: who.name,
          });
        }
        if (input.dryRun) await conn.rollback();
        else await conn.commit();
        return {
          dryRun: input.dryRun,
          legacyPromotionCount: legacyRows.length,
          productCount: productIds.size,
          skuTargetCount,
          createdCount,
        };
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }),

  listPromotions: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive(), includeEnded: z.boolean().default(true) }))
    .query(async ({ input }) => {
      const pool = await getPool();
      await assertActiveStore(pool, input.storeId);
      const params: any[] = [input.storeId];
      let status = "";
      if (!input.includeEnded) {
        status = " AND promo.status IN ('scheduled','active','paused')";
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT promo.*, p.productName, p.platformProductId, p.spuCode, p.mainImageUrl, p.basePrice, p.currency,
                s.variantName, s.skuCode, s.platformSkuId, s.salePrice AS skuSalePrice
           FROM store_product_promotions promo
           INNER JOIN store_products p ON p.id=promo.productId AND p.storeId=? AND p.deletedAt IS NULL
           LEFT JOIN store_product_skus s ON s.id=promo.skuId AND s.deletedAt IS NULL
          WHERE promo.deletedAt IS NULL ${status}
          ORDER BY promo.isEnabled DESC, promo.startsAt DESC, promo.id DESC`,
        params,
      );
      return rows.map((row) => ({ ...row, isEnabled: Boolean(row.isEnabled), discountValue: Number(row.discountValue || 0), basePriceSnapshot: Number(row.basePriceSnapshot || 0), promotionPrice: Number(row.promotionPrice || 0), basePrice: numberOrNull(row.basePrice) }));
    }),
});
