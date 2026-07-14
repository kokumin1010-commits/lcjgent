/**
 * CSV/Excel Snapshot Procedures for TikTok Shop Product Data Analysis
 * Handles upload, storage, comparison, and AI analysis of product-level data
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { livestreamCsvSnapshots, livestreamCsvProducts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";

// CSV product data schema (matches TikTok Shop export format)
const csvProductSchema = z.object({
  productId: z.string().optional(),
  productName: z.string(),
  gmv: z.number().default(0),
  orderCount: z.number().default(0),
  customerCount: z.number().default(0),
  avgOrderAmount: z.number().default(0),
  skuOrderCount: z.number().default(0),
  totalOrderCount: z.number().default(0),
  paymentRate: z.number().default(0),
  impressionCount: z.number().default(0),
  clickRate: z.number().default(0),
  cartAddCount: z.number().default(0),
  skuConversionRate: z.number().default(0),
  conversionRate: z.number().default(0),
  gpm: z.number().default(0),
  clickCount: z.number().default(0),
  availableStock: z.number().default(0),
});

export const csvSnapshotRouter = router({
  // CSVスナップショット追加
  addCsvSnapshot: protectedProcedure
    .input(z.object({
      livestreamId: z.number(),
      liverId: z.number().optional(),
      fileName: z.string(),
      timeSlot: z.string(),
      products: z.array(csvProductSchema),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });

      // Create tables if not exist (first-time setup)
      const mysql2 = await import('mysql2/promise');
      const pool = mysql2.createPool(process.env.DATABASE_URL!);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS livestream_csv_snapshots (
          id INT AUTO_INCREMENT PRIMARY KEY,
          livestreamId INT NOT NULL,
          liverId INT DEFAULT NULL,
          fileName VARCHAR(512) NOT NULL,
          timeSlot VARCHAR(20) NOT NULL,
          totalProducts INT DEFAULT 0,
          totalGmv BIGINT DEFAULT 0,
          totalOrders INT DEFAULT 0,
          totalImpressions BIGINT DEFAULT 0,
          totalClicks INT DEFAULT 0,
          avgGpm BIGINT DEFAULT 0,
          avgClickRate DECIMAL(10,6) DEFAULT NULL,
          avgConversionRate DECIMAL(10,6) DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          uploadedBy VARCHAR(255) DEFAULT NULL,
          snapshotAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS livestream_csv_products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          snapshotId INT NOT NULL,
          livestreamId INT NOT NULL,
          productId VARCHAR(100) DEFAULT NULL,
          productName VARCHAR(500) NOT NULL,
          gmv BIGINT DEFAULT 0,
          orderCount INT DEFAULT 0,
          customerCount INT DEFAULT 0,
          avgOrderAmount BIGINT DEFAULT 0,
          skuOrderCount INT DEFAULT 0,
          totalOrderCount INT DEFAULT 0,
          paymentRate DECIMAL(10,6) DEFAULT NULL,
          impressionCount BIGINT DEFAULT 0,
          clickRate DECIMAL(10,6) DEFAULT NULL,
          cartAddCount INT DEFAULT 0,
          skuConversionRate DECIMAL(10,6) DEFAULT NULL,
          conversionRate DECIMAL(10,6) DEFAULT NULL,
          gpm BIGINT DEFAULT 0,
          clickCount INT DEFAULT 0,
          availableStock INT DEFAULT 0,
          gmvRank INT DEFAULT NULL,
          orderRank INT DEFAULT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // Calculate summary metrics
      const totalGmv = input.products.reduce((sum, p) => sum + (p.gmv || 0), 0);
      const totalOrders = input.products.reduce((sum, p) => sum + (p.orderCount || 0), 0);
      const totalImpressions = input.products.reduce((sum, p) => sum + (p.impressionCount || 0), 0);
      const totalClicks = input.products.reduce((sum, p) => sum + (p.clickCount || 0), 0);
      const avgGpm = input.products.length > 0
        ? Math.round(input.products.reduce((sum, p) => sum + (p.gpm || 0), 0) / input.products.length)
        : 0;
      const avgClickRate = input.products.length > 0
        ? input.products.reduce((sum, p) => sum + (p.clickRate || 0), 0) / input.products.length
        : 0;
      const avgConversionRate = input.products.length > 0
        ? input.products.reduce((sum, p) => sum + (p.conversionRate || 0), 0) / input.products.length
        : 0;

      // Insert snapshot
      const [snapshotResult] = await pool.query(
        `INSERT INTO livestream_csv_snapshots (livestreamId, liverId, fileName, timeSlot, totalProducts, totalGmv, totalOrders, totalImpressions, totalClicks, avgGpm, avgClickRate, avgConversionRate, notes, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.livestreamId, input.liverId || null, input.fileName, input.timeSlot, input.products.length, totalGmv, totalOrders, totalImpressions, totalClicks, avgGpm, avgClickRate, avgConversionRate, input.notes || null, ctx.user.name || ctx.user.email]
      ) as any;
      const snapshotId = (snapshotResult as any).insertId;

      // Sort products by GMV for ranking
      const sortedByGmv = [...input.products].sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
      const sortedByOrders = [...input.products].sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));

      // Insert products with rankings
      for (const product of input.products) {
        const gmvRank = sortedByGmv.findIndex(p => p.productName === product.productName) + 1;
        const orderRank = sortedByOrders.findIndex(p => p.productName === product.productName) + 1;

        await pool.query(
          `INSERT INTO livestream_csv_products (snapshotId, livestreamId, productId, productName, gmv, orderCount, customerCount, avgOrderAmount, skuOrderCount, totalOrderCount, paymentRate, impressionCount, clickRate, cartAddCount, skuConversionRate, conversionRate, gpm, clickCount, availableStock, gmvRank, orderRank) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [snapshotId, input.livestreamId, product.productId || null, product.productName, product.gmv || 0, product.orderCount || 0, product.customerCount || 0, product.avgOrderAmount || 0, product.skuOrderCount || 0, product.totalOrderCount || 0, product.paymentRate || null, product.impressionCount || 0, product.clickRate || null, product.cartAddCount || 0, product.skuConversionRate || null, product.conversionRate || null, product.gpm || 0, product.clickCount || 0, product.availableStock || 0, gmvRank, orderRank]
        );
      }

      await pool.end();

      return {
        success: true,
        snapshot: {
          id: snapshotId,
          totalProducts: input.products.length,
          totalGmv,
          totalOrders,
          avgGpm,
          timeSlot: input.timeSlot,
        },
      };
    }),

  // CSVスナップショット一覧取得
  getCsvSnapshots: protectedProcedure
    .input(z.object({
      livestreamId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const results = await db.select()
          .from(livestreamCsvSnapshots)
          .where(eq(livestreamCsvSnapshots.livestreamId, input.livestreamId))
          .orderBy(livestreamCsvSnapshots.snapshotAt);
        return results;
      } catch {
        return [];
      }
    }),

  // CSVスナップショットの商品データ取得
  getCsvSnapshotProducts: protectedProcedure
    .input(z.object({
      snapshotId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const results = await db.select()
          .from(livestreamCsvProducts)
          .where(eq(livestreamCsvProducts.snapshotId, input.snapshotId));
        return results;
      } catch {
        return [];
      }
    }),

  // 2つのスナップショット比較
  compareCsvSnapshots: protectedProcedure
    .input(z.object({
      snapshotIdA: z.number(), // 前のスナップショット
      snapshotIdB: z.number(), // 後のスナップショット
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });

      // Get products for both snapshots
      const productsA = await db.select()
        .from(livestreamCsvProducts)
        .where(eq(livestreamCsvProducts.snapshotId, input.snapshotIdA));
      const productsB = await db.select()
        .from(livestreamCsvProducts)
        .where(eq(livestreamCsvProducts.snapshotId, input.snapshotIdB));

      // Get snapshot metadata
      const [snapshotA] = await db.select()
        .from(livestreamCsvSnapshots)
        .where(eq(livestreamCsvSnapshots.id, input.snapshotIdA));
      const [snapshotB] = await db.select()
        .from(livestreamCsvSnapshots)
        .where(eq(livestreamCsvSnapshots.id, input.snapshotIdB));

      // Build comparison by product name
      const productMapA = new Map(productsA.map(p => [p.productName, p]));
      const productMapB = new Map(productsB.map(p => [p.productName, p]));
      const allProductNames = new Set([...productMapA.keys(), ...productMapB.keys()]);

      const comparison = Array.from(allProductNames).map(name => {
        const a = productMapA.get(name);
        const b = productMapB.get(name);
        return {
          productName: name,
          productId: b?.productId || a?.productId || null,
          // Current values (snapshot B)
          gmv: b?.gmv || 0,
          orderCount: b?.orderCount || 0,
          impressionCount: b?.impressionCount || 0,
          clickCount: b?.clickCount || 0,
          gpm: b?.gpm || 0,
          clickRate: b?.clickRate ? parseFloat(String(b.clickRate)) : 0,
          conversionRate: b?.conversionRate ? parseFloat(String(b.conversionRate)) : 0,
          availableStock: b?.availableStock || 0,
          gmvRank: b?.gmvRank || null,
          orderRank: b?.orderRank || null,
          // Previous values (snapshot A)
          prevGmv: a?.gmv || 0,
          prevOrderCount: a?.orderCount || 0,
          prevImpressionCount: a?.impressionCount || 0,
          prevClickCount: a?.clickCount || 0,
          prevGpm: a?.gpm || 0,
          prevGmvRank: a?.gmvRank || null,
          prevOrderRank: a?.orderRank || null,
          prevAvailableStock: a?.availableStock || 0,
          // Deltas
          gmvDelta: (b?.gmv || 0) - (a?.gmv || 0),
          orderDelta: (b?.orderCount || 0) - (a?.orderCount || 0),
          impressionDelta: (b?.impressionCount || 0) - (a?.impressionCount || 0),
          clickDelta: (b?.clickCount || 0) - (a?.clickCount || 0),
          gpmDelta: (b?.gpm || 0) - (a?.gpm || 0),
          stockDelta: (b?.availableStock || 0) - (a?.availableStock || 0),
          rankChange: (a?.gmvRank || 0) - (b?.gmvRank || 0), // positive = improved
          isNew: !a, // New product in snapshot B
          isRemoved: !b, // Product removed in snapshot B
        };
      }).sort((a, b) => b.gmvDelta - a.gmvDelta); // Sort by GMV growth

      return {
        snapshotA: snapshotA || null,
        snapshotB: snapshotB || null,
        comparison,
        summary: {
          totalGmvGrowth: (snapshotB?.totalGmv || 0) - (snapshotA?.totalGmv || 0),
          totalOrderGrowth: (snapshotB?.totalOrders || 0) - (snapshotA?.totalOrders || 0),
          totalImpressionGrowth: (snapshotB?.totalImpressions || 0) - (snapshotA?.totalImpressions || 0),
          newProducts: comparison.filter(c => c.isNew).length,
          removedProducts: comparison.filter(c => c.isRemoved).length,
          improvedProducts: comparison.filter(c => c.gmvDelta > 0 && !c.isNew).length,
          declinedProducts: comparison.filter(c => c.gmvDelta < 0 && !c.isRemoved).length,
        },
      };
    }),

  // AI分析（CSVデータに基づくインサイト生成）
  analyzeCsvData: protectedProcedure
    .input(z.object({
      livestreamId: z.number(),
      snapshotId: z.number().optional(), // 特定スナップショットの分析
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });

      // Get all snapshots for this livestream
      const snapshots = await db.select()
        .from(livestreamCsvSnapshots)
        .where(eq(livestreamCsvSnapshots.livestreamId, input.livestreamId))
        .orderBy(livestreamCsvSnapshots.snapshotAt);

      if (snapshots.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'CSVデータがありません' });
      }

      // Get products for the latest (or specified) snapshot
      const targetSnapshotId = input.snapshotId || snapshots[snapshots.length - 1].id;
      const products = await db.select()
        .from(livestreamCsvProducts)
        .where(eq(livestreamCsvProducts.snapshotId, targetSnapshotId));

      // Build analysis prompt
      const productSummary = products
        .sort((a, b) => (b.gmv || 0) - (a.gmv || 0))
        .slice(0, 20)
        .map((p, i) => `${i + 1}. ${p.productName}: GMV=¥${(p.gmv || 0).toLocaleString()}, 注文=${p.orderCount || 0}件, GPM=¥${(p.gpm || 0).toLocaleString()}, クリック率=${p.clickRate ? (parseFloat(String(p.clickRate)) * 100).toFixed(2) : '0'}%, 転化率=${p.conversionRate ? (parseFloat(String(p.conversionRate)) * 100).toFixed(2) : '0'}%, 在庫=${p.availableStock || 0}`)
        .join('\n');

      const snapshotInfo = snapshots.map(s => `${s.timeSlot}: GMV=¥${(s.totalGmv || 0).toLocaleString()}, 注文=${s.totalOrders || 0}件, 商品数=${s.totalProducts || 0}`).join('\n');

      const prompt = `あなたはTikTokライブコマースの専門アナリストです。以下の配信データを分析し、具体的なアクションアドバイスを日本語で提供してください。

## 配信スナップショット推移
${snapshotInfo}

## 最新スナップショットの商品データ（GMV順TOP20）
${productSummary}

## 分析してほしいポイント
1. **トップ商品分析**: GMVトップ商品の特徴と成功要因
2. **改善機会**: クリック率は高いが転化率が低い商品（ファネル漏れ）
3. **在庫アラート**: 在庫が少ない人気商品
4. **GPM最適化**: GPMが低い商品の改善提案
5. **次のアクション**: 配信中にすぐ実行できる具体的な改善策3つ

簡潔に、箇条書きで回答してください。`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "あなたはTikTokライブコマースの専門アナリストです。データに基づいた具体的で実行可能なアドバイスを提供します。" },
            { role: "user", content: prompt },
          ],
        });

        const analysis = response.choices?.[0]?.message?.content || "分析結果を取得できませんでした";
        return { success: true, analysis, snapshotCount: snapshots.length, productCount: products.length };
      } catch (err: any) {
        console.error("[analyzeCsvData] LLM error:", err);
        return { success: false, analysis: "AI分析中にエラーが発生しました: " + (err.message || "不明なエラー"), snapshotCount: snapshots.length, productCount: products.length };
      }
    }),

  // CSVスナップショット削除
  deleteCsvSnapshot: protectedProcedure
    .input(z.object({
      snapshotId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });
      
      // Delete products first
      await db.delete(livestreamCsvProducts)
        .where(eq(livestreamCsvProducts.snapshotId, input.snapshotId));
      // Delete snapshot
      await db.delete(livestreamCsvSnapshots)
        .where(eq(livestreamCsvSnapshots.id, input.snapshotId));
      
      return { success: true };
    }),
});
