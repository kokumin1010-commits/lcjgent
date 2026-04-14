/**
 * Brand Portal Router - ブランドポータルシステム
 *
 * ブランド方がトークン付きリンクでアクセスし、商品情報を入力・配信実績を確認するシステム。
 * LCJ管理者はポータル作成・チューニング・シミュレーション・承認を行う。
 *
 * 独立ルーターファイル（routers.tsの変更で消失しないよう分離）
 */
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import {
  brandPortals, InsertBrandPortal,
  brandPortalProducts, InsertBrandPortalProduct,
  brandPortalSimulations, InsertBrandPortalSimulation,
  brandPortalPerformance, InsertBrandPortalPerformance,
  brands,
  brandLivestreams,
  livestreamProducts,
} from "../drizzle/schema";
import crypto from "crypto";

// ============================================================
// Helper: Generate secure random token
// ============================================================
function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

// ============================================================
// Brand Portal Router
// ============================================================
export const brandPortalRouter = router({

  // ============================================================
  // 【管理者】ポータル管理
  // ============================================================

  // ポータル作成（ブランドにリンクを発行）
  createPortal: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      portalName: z.string().optional(),
      welcomeMessage: z.string().optional(),
      expiresAt: z.string().optional(), // ISO date string
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Check if portal already exists for this brand
      const existing = await db.select().from(brandPortals)
        .where(eq(brandPortals.brandId, input.brandId))
        .limit(1);
      
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このブランドには既にポータルが存在します。既存のポータルを使用してください。",
        });
      }

      const accessToken = generateToken(32);
      
      await db.insert(brandPortals).values({
        brandId: input.brandId,
        accessToken,
        portalName: input.portalName,
        welcomeMessage: input.welcomeMessage,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdBy: ctx.user.id,
      } as any);

      return { accessToken, url: `https://lcjmall.com/brand/${accessToken}` };
    }),

  // ポータル一覧取得
  listPortals: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const portals = await db.select({
      id: brandPortals.id,
      brandId: brandPortals.brandId,
      accessToken: brandPortals.accessToken,
      portalName: brandPortals.portalName,
      status: brandPortals.status,
      expiresAt: brandPortals.expiresAt,
      lastAccessedAt: brandPortals.lastAccessedAt,
      accessCount: brandPortals.accessCount,
      createdAt: brandPortals.createdAt,
      brandName: brands.name,
      brandNameJa: brands.nameJa,
    })
    .from(brandPortals)
    .leftJoin(brands, eq(brandPortals.brandId, brands.id))
    .orderBy(desc(brandPortals.createdAt));

    return portals;
  }),

  // ポータル詳細取得（管理者用）
  getPortalDetail: protectedProcedure
    .input(z.object({ portalId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const portal = await db.select()
        .from(brandPortals)
        .where(eq(brandPortals.id, input.portalId))
        .limit(1);

      if (portal.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ポータルが見つかりません" });
      }

      // Get brand info
      const brand = await db.select().from(brands)
        .where(eq(brands.id, portal[0].brandId))
        .limit(1);

      // Get products
      const products = await db.select().from(brandPortalProducts)
        .where(and(
          eq(brandPortalProducts.portalId, input.portalId),
          isNull(brandPortalProducts.deletedAt),
        ))
        .orderBy(desc(brandPortalProducts.createdAt));

      return {
        portal: portal[0],
        brand: brand[0] || null,
        products,
      };
    }),

  // ポータルステータス更新
  updatePortalStatus: protectedProcedure
    .input(z.object({
      portalId: z.number(),
      status: z.enum(["active", "suspended", "expired"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      await db.update(brandPortals)
        .set({ status: input.status } as any)
        .where(eq(brandPortals.id, input.portalId));

      return { success: true };
    }),

  // ============================================================
  // 【ブランド方】トークン認証 & ポータルアクセス
  // ============================================================

  // トークンでポータル情報を取得（公開API）
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const portal = await db.select()
        .from(brandPortals)
        .where(eq(brandPortals.accessToken, input.token))
        .limit(1);

      if (portal.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "無効なリンクです" });
      }

      const p = portal[0];

      // Check status
      if (p.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "このポータルは現在利用できません" });
      }

      // Check expiry
      if (p.expiresAt && new Date(p.expiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "このリンクの有効期限が切れています" });
      }

      // Update access count and last accessed
      await db.update(brandPortals)
        .set({
          accessCount: sql`${brandPortals.accessCount} + 1`,
          lastAccessedAt: new Date(),
        } as any)
        .where(eq(brandPortals.id, p.id));

      // Get brand info
      const brand = await db.select({
        id: brands.id,
        name: brands.name,
        nameJa: brands.nameJa,
        logoUrl: brands.logoUrl,
      }).from(brands)
        .where(eq(brands.id, p.brandId))
        .limit(1);

      // Get products for this portal
      const products = await db.select().from(brandPortalProducts)
        .where(and(
          eq(brandPortalProducts.portalId, p.id),
          isNull(brandPortalProducts.deletedAt),
        ))
        .orderBy(desc(brandPortalProducts.createdAt));

      // Get performance data
      const performances = await db.select().from(brandPortalPerformance)
        .where(and(
          eq(brandPortalPerformance.brandId, p.brandId),
          eq(brandPortalPerformance.isVisible, true),
        ))
        .orderBy(desc(brandPortalPerformance.livestreamDate));

      return {
        portal: {
          id: p.id,
          portalName: p.portalName,
          welcomeMessage: p.welcomeMessage,
          brandId: p.brandId,
        },
        brand: brand[0] || null,
        products,
        performances,
      };
    }),

  // ============================================================
  // 【ブランド方】商品登録・編集
  // ============================================================

  // 商品登録（ブランド方がフォームから入力）
  submitProduct: publicProcedure
    .input(z.object({
      token: z.string(),
      productName: z.string().min(1),
      productCode: z.string().optional(),
      category: z.string().optional(),
      listPrice: z.number().optional(),
      livePrice: z.number().optional(),
      costPrice: z.number().optional(),
      commissionRate: z.string().optional(),
      productDescription: z.string().optional(),
      specifications: z.string().optional(),
      targetAudience: z.string().optional(),
      sellingPoint1: z.string().optional(),
      sellingPoint2: z.string().optional(),
      sellingPoint3: z.string().optional(),
      sellingPoint4: z.string().optional(),
      sellingPoint5: z.string().optional(),
      sellingPoint6: z.string().optional(),
      usageMethod: z.string().optional(),
      ingredients: z.string().optional(),
      shippingInfo: z.string().optional(),
      stockQuantity: z.number().optional(),
      imageUrls: z.array(z.string()).optional(),
      imageKeys: z.array(z.string()).optional(),
      salesMechanism: z.string().optional(),
      giftItems: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Validate token
      const portal = await db.select()
        .from(brandPortals)
        .where(eq(brandPortals.accessToken, input.token))
        .limit(1);

      if (portal.length === 0 || portal[0].status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "無効なアクセスです" });
      }

      const p = portal[0];

      await db.insert(brandPortalProducts).values({
        portalId: p.id,
        brandId: p.brandId,
        productName: input.productName,
        productCode: input.productCode,
        category: input.category,
        listPrice: input.listPrice,
        livePrice: input.livePrice,
        costPrice: input.costPrice,
        commissionRate: input.commissionRate,
        productDescription: input.productDescription,
        specifications: input.specifications,
        targetAudience: input.targetAudience,
        sellingPoint1: input.sellingPoint1,
        sellingPoint2: input.sellingPoint2,
        sellingPoint3: input.sellingPoint3,
        sellingPoint4: input.sellingPoint4,
        sellingPoint5: input.sellingPoint5,
        sellingPoint6: input.sellingPoint6,
        usageMethod: input.usageMethod,
        ingredients: input.ingredients,
        shippingInfo: input.shippingInfo,
        stockQuantity: input.stockQuantity,
        imageUrls: input.imageUrls || [],
        imageKeys: input.imageKeys || [],
        salesMechanism: input.salesMechanism,
        giftItems: input.giftItems,
        status: "submitted",
        submittedAt: new Date(),
      } as any);

      return { success: true, message: "商品情報を送信しました" };
    }),

  // 商品更新（ブランド方がdraft/submitted状態の商品を編集）
  updateProduct: publicProcedure
    .input(z.object({
      token: z.string(),
      productId: z.number(),
      productName: z.string().optional(),
      productCode: z.string().optional(),
      category: z.string().optional(),
      listPrice: z.number().optional(),
      livePrice: z.number().optional(),
      costPrice: z.number().optional(),
      commissionRate: z.string().optional(),
      productDescription: z.string().optional(),
      specifications: z.string().optional(),
      targetAudience: z.string().optional(),
      sellingPoint1: z.string().optional(),
      sellingPoint2: z.string().optional(),
      sellingPoint3: z.string().optional(),
      sellingPoint4: z.string().optional(),
      sellingPoint5: z.string().optional(),
      sellingPoint6: z.string().optional(),
      usageMethod: z.string().optional(),
      ingredients: z.string().optional(),
      shippingInfo: z.string().optional(),
      stockQuantity: z.number().optional(),
      imageUrls: z.array(z.string()).optional(),
      imageKeys: z.array(z.string()).optional(),
      salesMechanism: z.string().optional(),
      giftItems: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Validate token
      const portal = await db.select()
        .from(brandPortals)
        .where(eq(brandPortals.accessToken, input.token))
        .limit(1);

      if (portal.length === 0 || portal[0].status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "無効なアクセスです" });
      }

      // Check product belongs to this portal and is editable
      const product = await db.select().from(brandPortalProducts)
        .where(and(
          eq(brandPortalProducts.id, input.productId),
          eq(brandPortalProducts.portalId, portal[0].id),
          isNull(brandPortalProducts.deletedAt),
        ))
        .limit(1);

      if (product.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
      }

      const editableStatuses = ["draft", "submitted"];
      if (!editableStatuses.includes(product[0].status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "この商品は現在編集できません" });
      }

      const { token, productId, ...updateData } = input;
      await db.update(brandPortalProducts)
        .set(updateData as any)
        .where(eq(brandPortalProducts.id, productId));

      return { success: true };
    }),

  // ============================================================
  // 【ブランド方】シミュレーション閲覧・回答
  // ============================================================

  // シミュレーション取得（共有トークンで）
  getSimulationByToken: publicProcedure
    .input(z.object({ shareToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const sim = await db.select().from(brandPortalSimulations)
        .where(eq(brandPortalSimulations.shareToken, input.shareToken))
        .limit(1);

      if (sim.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "シミュレーションが見つかりません" });
      }

      // Get product info
      const product = await db.select().from(brandPortalProducts)
        .where(eq(brandPortalProducts.id, sim[0].portalProductId))
        .limit(1);

      return {
        simulation: sim[0],
        product: product[0] || null,
      };
    }),

  // ブランド方がシミュレーションに回答
  respondToSimulation: publicProcedure
    .input(z.object({
      shareToken: z.string(),
      selectedScenarioIndex: z.number(),
      brandFeedback: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const sim = await db.select().from(brandPortalSimulations)
        .where(eq(brandPortalSimulations.shareToken, input.shareToken))
        .limit(1);

      if (sim.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "シミュレーションが見つかりません" });
      }

      await db.update(brandPortalSimulations)
        .set({
          selectedScenarioIndex: input.selectedScenarioIndex,
          brandFeedback: input.brandFeedback,
          respondedAt: new Date(),
          status: "responded",
        } as any)
        .where(eq(brandPortalSimulations.id, sim[0].id));

      return { success: true, message: "回答を送信しました" };
    }),

  // ============================================================
  // 【管理者】商品チューニング
  // ============================================================

  // 商品チューニング（価格・割引率・贈品の調整）
  tuneProduct: protectedProcedure
    .input(z.object({
      productId: z.number(),
      adjustedLivePrice: z.number().optional(),
      adjustedDiscountRate: z.string().optional(),
      adjustedGiftItems: z.string().optional(),
      tuningNotes: z.string().optional(),
      status: z.enum(["reviewing", "tuning", "simulating", "proposed", "approved", "live_ready", "live_done", "rejected"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const updateData: any = {};
      if (input.adjustedLivePrice !== undefined) updateData.adjustedLivePrice = input.adjustedLivePrice;
      if (input.adjustedDiscountRate !== undefined) updateData.adjustedDiscountRate = input.adjustedDiscountRate;
      if (input.adjustedGiftItems !== undefined) updateData.adjustedGiftItems = input.adjustedGiftItems;
      if (input.tuningNotes !== undefined) updateData.tuningNotes = input.tuningNotes;
      if (input.status !== undefined) updateData.status = input.status;
      updateData.tunedBy = ctx.user.id;
      updateData.tunedAt = new Date();

      await db.update(brandPortalProducts)
        .set(updateData)
        .where(eq(brandPortalProducts.id, input.productId));

      return { success: true };
    }),

  // 商品ステータス更新
  updateProductStatus: protectedProcedure
    .input(z.object({
      productId: z.number(),
      status: z.enum(["draft", "submitted", "reviewing", "tuning", "simulating", "proposed", "approved", "live_ready", "live_done", "rejected"]),
      rejectionReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const updateData: any = { status: input.status };
      if (input.status === "rejected") {
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = input.rejectionReason;
      }
      if (input.status === "approved") {
        updateData.approvedAt = new Date();
      }

      await db.update(brandPortalProducts)
        .set(updateData)
        .where(eq(brandPortalProducts.id, input.productId));

      return { success: true };
    }),

  // ============================================================
  // 【管理者】シミュレーション作成・管理
  // ============================================================

  // シミュレーション作成
  createSimulation: protectedProcedure
    .input(z.object({
      portalProductId: z.number(),
      simulationName: z.string().optional(),
      priceScenarios: z.array(z.object({
        label: z.string(),
        livePrice: z.number(),
        discountRate: z.number(),
        giftItems: z.string(),
        estimatedSalesCount: z.number(),
        estimatedGmv: z.number(),
        estimatedProfit: z.number(),
        commissionAmount: z.number(),
      })),
      recommendedScenarioIndex: z.number().optional(),
      recommendationReason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Get product to find brandId
      const product = await db.select().from(brandPortalProducts)
        .where(eq(brandPortalProducts.id, input.portalProductId))
        .limit(1);

      if (product.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
      }

      const shareToken = generateToken(32);

      await db.insert(brandPortalSimulations).values({
        portalProductId: input.portalProductId,
        brandId: product[0].brandId,
        simulationName: input.simulationName,
        priceScenarios: input.priceScenarios,
        recommendedScenarioIndex: input.recommendedScenarioIndex,
        recommendationReason: input.recommendationReason,
        shareToken,
        createdBy: ctx.user.id,
      } as any);

      return { success: true, shareToken };
    }),

  // シミュレーション共有（ブランド方に送るリンクを生成）
  shareSimulation: protectedProcedure
    .input(z.object({ simulationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const sim = await db.select().from(brandPortalSimulations)
        .where(eq(brandPortalSimulations.id, input.simulationId))
        .limit(1);

      if (sim.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "シミュレーションが見つかりません" });
      }

      await db.update(brandPortalSimulations)
        .set({
          status: "shared",
          sharedAt: new Date(),
        } as any)
        .where(eq(brandPortalSimulations.id, input.simulationId));

      return {
        success: true,
        shareUrl: `https://lcjmall.com/brand/simulation/${sim[0].shareToken}`,
      };
    }),

  // シミュレーション一覧（商品別）
  getSimulations: protectedProcedure
    .input(z.object({ portalProductId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const sims = await db.select().from(brandPortalSimulations)
        .where(eq(brandPortalSimulations.portalProductId, input.portalProductId))
        .orderBy(desc(brandPortalSimulations.createdAt));

      return sims;
    }),

  // ============================================================
  // 【管理者】配信実績管理
  // ============================================================

  // 配信実績を手動登録
  addPerformance: protectedProcedure
    .input(z.object({
      portalProductId: z.number(),
      livestreamId: z.number().optional(),
      livestreamDate: z.string(), // ISO date
      streamerName: z.string().optional(),
      platform: z.string().optional(),
      duration: z.number().optional(),
      salesAmount: z.number().optional(),
      gmv: z.number().optional(),
      salesCount: z.number().optional(),
      orderCount: z.number().optional(),
      viewerCount: z.number().optional(),
      peakViewers: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Get product to find brandId
      const product = await db.select().from(brandPortalProducts)
        .where(eq(brandPortalProducts.id, input.portalProductId))
        .limit(1);

      if (product.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
      }

      await db.insert(brandPortalPerformance).values({
        portalProductId: input.portalProductId,
        brandId: product[0].brandId,
        livestreamId: input.livestreamId,
        livestreamDate: new Date(input.livestreamDate),
        streamerName: input.streamerName,
        platform: input.platform,
        duration: input.duration,
        salesAmount: input.salesAmount,
        gmv: input.gmv,
        salesCount: input.salesCount,
        orderCount: input.orderCount,
        viewerCount: input.viewerCount,
        peakViewers: input.peakViewers,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        notes: input.notes,
      } as any);

      return { success: true };
    }),

  // brandLivestreamsから配信実績を自動取り込み
  syncPerformanceFromLivestream: protectedProcedure
    .input(z.object({
      portalProductId: z.number(),
      livestreamId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Get livestream data
      const ls = await db.select().from(brandLivestreams)
        .where(eq(brandLivestreams.id, input.livestreamId))
        .limit(1);

      if (ls.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "配信データが見つかりません" });
      }

      const livestream = ls[0];

      // Get product to find brandId
      const product = await db.select().from(brandPortalProducts)
        .where(eq(brandPortalProducts.id, input.portalProductId))
        .limit(1);

      if (product.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
      }

      await db.insert(brandPortalPerformance).values({
        portalProductId: input.portalProductId,
        brandId: product[0].brandId,
        livestreamId: input.livestreamId,
        livestreamDate: livestream.livestreamDate,
        streamerName: livestream.streamerName,
        platform: livestream.platform,
        duration: livestream.duration,
        salesAmount: livestream.salesAmount,
        gmv: livestream.gmv,
        salesCount: livestream.salesCount || livestream.itemsSold,
        orderCount: livestream.orderCount,
        viewerCount: livestream.viewerCount,
        peakViewers: livestream.peakViewers,
        likes: livestream.likes,
        comments: livestream.comments,
        shares: livestream.shares,
      } as any);

      return { success: true };
    }),

  // 配信実績一覧（管理者用）
  getPerformances: protectedProcedure
    .input(z.object({ portalProductId: z.number().optional(), brandId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const conditions = [];
      if (input.portalProductId) conditions.push(eq(brandPortalPerformance.portalProductId, input.portalProductId));
      if (input.brandId) conditions.push(eq(brandPortalPerformance.brandId, input.brandId));

      const perfs = await db.select().from(brandPortalPerformance)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(brandPortalPerformance.livestreamDate));

      return perfs;
    }),

  // ============================================================
  // 【管理者】ブランド一覧（ポータル未作成含む）
  // ============================================================
  getBrandsForPortal: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const allBrands = await db.select({
      id: brands.id,
      name: brands.name,
      nameJa: brands.nameJa,
      status: brands.status,
      category: brands.category,
    }).from(brands)
      .where(isNull(brands.deletedAt))
      .orderBy(desc(brands.id));

    // Get existing portals
    const existingPortals = await db.select({
      brandId: brandPortals.brandId,
      portalId: brandPortals.id,
      accessToken: brandPortals.accessToken,
      portalStatus: brandPortals.status,
    }).from(brandPortals);

    const portalMap = new Map(existingPortals.map(p => [p.brandId, p]));

    return allBrands.map(b => ({
      ...b,
      hasPortal: portalMap.has(b.id),
      portal: portalMap.get(b.id) || null,
    }));
  }),

  // ============================================================
  // 【画像アップロード】ブランド方の商品画像
  // ============================================================
  getUploadUrl: publicProcedure
    .input(z.object({
      token: z.string(),
      fileName: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Validate token
      const portal = await db.select()
        .from(brandPortals)
        .where(eq(brandPortals.accessToken, input.token))
        .limit(1);

      if (portal.length === 0 || portal[0].status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "無効なアクセスです" });
      }

      // Generate S3 key
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `brand-portal/${portal[0].brandId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      // Import storagePut dynamically to avoid circular deps
      const { storagePut } = await import("./storage");

      return { key, uploadKey: key, contentType: input.contentType };
    }),
});
