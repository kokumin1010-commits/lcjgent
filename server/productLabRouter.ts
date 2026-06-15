/**
 * 24H爆速商品ラボ ルーター
 * - 商品登録・管理
 * - パイプラインステータス管理
 * - テスト配信アサイン（LINE通知）
 * - 売上データCSVインポート
 * - 横推一键通知
 * - 統計・スコアリング
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  productPipeline,
  productTestAssignment,
  productLabSalesData,
  livers,
} from "../drizzle/schema";
import { eq, desc, and, sql, count, inArray, like, or } from "drizzle-orm";
import { pushMessage } from "./line";

export const productLabRouter = router({
  // ===== 商品一覧取得 =====
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["candidate", "testing", "hit", "spreading", "standard", "eliminated", "all"]).default("all"),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const conditions: any[] = [];
      if (input.status !== "all") {
        conditions.push(eq(productPipeline.status, input.status));
      }
      if (input.search) {
        conditions.push(
          or(
            like(productPipeline.name, `%${input.search}%`),
            like(productPipeline.category, `%${input.search}%`)
          )
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.limit;

      const [items, totalResult] = await Promise.all([
        db.select().from(productPipeline)
          .where(where)
          .orderBy(desc(productPipeline.updatedAt))
          .limit(input.limit)
          .offset(offset),
        db.select({ count: count() }).from(productPipeline).where(where),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  // ===== 商品登録 =====
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "商品名は必須です"),
      imageUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
      sourceType: z.enum(["1688", "aliexpress", "manual"]).default("manual"),
      costPrice: z.string().min(1, "原価は必須です"),
      sellPrice: z.string().min(1, "売値は必須です"),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      talkScript: z.string().optional(),
      productDescription: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const cost = parseFloat(input.costPrice);
      const sell = parseFloat(input.sellPrice);
      const margin = sell > 0 ? ((sell - cost) / sell * 100).toFixed(2) : "0";

      await db.insert(productPipeline).values({
        name: input.name,
        imageUrl: input.imageUrl || null,
        sourceUrl: input.sourceUrl || null,
        sourceType: input.sourceType,
        costPrice: input.costPrice,
        sellPrice: input.sellPrice,
        profitMargin: margin,
        category: input.category || null,
        tags: input.tags || null,
        talkScript: input.talkScript || null,
        productDescription: input.productDescription || null,
        notes: input.notes || null,
        status: "candidate",
      });

      return { success: true, message: "商品を登録しました" };
    }),

  // ===== 商品更新 =====
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      imageUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
      sourceType: z.enum(["1688", "aliexpress", "manual"]).optional(),
      costPrice: z.string().optional(),
      sellPrice: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      talkScript: z.string().optional(),
      productDescription: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const { id, ...updates } = input;
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
      if (updates.sourceUrl !== undefined) updateData.sourceUrl = updates.sourceUrl;
      if (updates.sourceType !== undefined) updateData.sourceType = updates.sourceType;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.talkScript !== undefined) updateData.talkScript = updates.talkScript;
      if (updates.productDescription !== undefined) updateData.productDescription = updates.productDescription;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      if (updates.costPrice !== undefined || updates.sellPrice !== undefined) {
        if (updates.costPrice !== undefined) updateData.costPrice = updates.costPrice;
        if (updates.sellPrice !== undefined) updateData.sellPrice = updates.sellPrice;
        // 利益率再計算
        const cost = parseFloat(updates.costPrice || "0");
        const sell = parseFloat(updates.sellPrice || "0");
        if (sell > 0) {
          updateData.profitMargin = ((sell - cost) / sell * 100).toFixed(2);
        }
      }

      await db.update(productPipeline).set(updateData).where(eq(productPipeline.id, id));
      return { success: true };
    }),

  // ===== ステータス変更 =====
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["candidate", "testing", "hit", "spreading", "standard", "eliminated"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      await db.update(productPipeline)
        .set({ status: input.status })
        .where(eq(productPipeline.id, input.id));

      return { success: true, message: `ステータスを「${getStatusLabel(input.status)}」に変更しました` };
    }),

  // ===== 商品削除 =====
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      await db.delete(productPipeline).where(eq(productPipeline.id, input.id));
      return { success: true };
    }),

  // ===== テスト配信アサイン（LINE通知付き） =====
  assignTest: protectedProcedure
    .input(z.object({
      productId: z.number(),
      liverId: z.number(),
      scheduledAt: z.string().optional(), // ISO date string
      durationMinutes: z.number().default(5),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // 商品情報取得
      const [product] = await db.select().from(productPipeline).where(eq(productPipeline.id, input.productId));
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });

      // ライバー情報取得
      const [liver] = await db.select().from(livers).where(eq(livers.id, input.liverId));
      if (!liver) throw new TRPCError({ code: "NOT_FOUND", message: "ライバーが見つかりません" });

      // アサインメント作成
      const [result] = await db.insert(productTestAssignment).values({
        productId: input.productId,
        liverId: input.liverId,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        durationMinutes: input.durationMinutes,
        notes: input.notes || null,
        lineNotifyStatus: "pending",
      }).$returningId();

      // 商品ステータスを「テスト中」に変更
      await db.update(productPipeline)
        .set({ status: "testing" })
        .where(eq(productPipeline.id, input.productId));

      // LINE通知送信
      let lineNotifyStatus: "sent" | "failed" = "failed";
      if (liver.lineUserId) {
        const message = buildTestAssignMessage(product, liver.name, input.durationMinutes, input.scheduledAt);
        const success = await pushMessage(liver.lineUserId, [{ type: "text", text: message }]);
        lineNotifyStatus = success ? "sent" : "failed";
        
        // 通知ステータス更新
        await db.update(productTestAssignment)
          .set({ 
            lineNotifyStatus,
            lineNotifiedAt: success ? new Date() : null,
          })
          .where(eq(productTestAssignment.id, result.id));
      }

      return { 
        success: true, 
        assignmentId: result.id,
        lineNotifyStatus,
        message: lineNotifyStatus === "sent" 
          ? `${liver.name}にLINE通知を送信しました` 
          : liver.lineUserId 
            ? "LINE通知の送信に失敗しました（アサインは完了）" 
            : "ライバーのLINE未連携のため通知なし（アサインは完了）",
      };
    }),

  // ===== テスト配信一覧 =====
  listAssignments: protectedProcedure
    .input(z.object({
      productId: z.number().optional(),
      liverId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const conditions: any[] = [];
      if (input.productId) conditions.push(eq(productTestAssignment.productId, input.productId));
      if (input.liverId) conditions.push(eq(productTestAssignment.liverId, input.liverId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const assignments = await db.select({
        assignment: productTestAssignment,
        productName: productPipeline.name,
        liverName: livers.name,
      })
        .from(productTestAssignment)
        .leftJoin(productPipeline, eq(productTestAssignment.productId, productPipeline.id))
        .leftJoin(livers, eq(productTestAssignment.liverId, livers.id))
        .where(where)
        .orderBy(desc(productTestAssignment.createdAt));

      return assignments;
    }),

  // ===== 売上データ記録（テスト結果入力） =====
  recordSalesResult: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      salesCount: z.number().default(0),
      gmv: z.string().default("0"),
      viewCount: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const convRate = input.viewCount > 0 
        ? ((input.salesCount / input.viewCount) * 100).toFixed(2) 
        : "0";

      await db.update(productTestAssignment)
        .set({
          salesCount: input.salesCount,
          gmv: input.gmv,
          viewCount: input.viewCount,
          conversionRate: convRate,
          completedAt: new Date(),
        })
        .where(eq(productTestAssignment.id, input.assignmentId));

      // 商品の累計データ更新
      const [assignment] = await db.select().from(productTestAssignment)
        .where(eq(productTestAssignment.id, input.assignmentId));
      
      if (assignment) {
        // 全アサインメントの合計を計算
        const allAssignments = await db.select().from(productTestAssignment)
          .where(eq(productTestAssignment.productId, assignment.productId));
        
        const totalSales = allAssignments.reduce((sum, a) => sum + (a.salesCount || 0), 0);
        const totalGmv = allAssignments.reduce((sum, a) => sum + parseFloat(String(a.gmv) || "0"), 0);
        const totalViews = allAssignments.reduce((sum, a) => sum + (a.viewCount || 0), 0);
        const avgConvRate = totalViews > 0 ? ((totalSales / totalViews) * 100).toFixed(2) : "0";

        // スコア計算: 転換率×販売数×利益率 / 1000
        const [product] = await db.select().from(productPipeline)
          .where(eq(productPipeline.id, assignment.productId));
        const profitMargin = parseFloat(String(product?.profitMargin) || "0");
        const score = ((parseFloat(avgConvRate) * totalSales * profitMargin) / 1000).toFixed(2);

        await db.update(productPipeline)
          .set({
            totalSales,
            totalGmv: totalGmv.toFixed(2),
            conversionRate: avgConvRate,
            score,
          })
          .where(eq(productPipeline.id, assignment.productId));
      }

      return { success: true, message: "売上データを記録しました" };
    }),

  // ===== CSVインポート =====
  importSalesCsv: protectedProcedure
    .input(z.object({
      productId: z.number(),
      csvData: z.array(z.object({
        salesDate: z.string().optional(),
        quantity: z.number().default(0),
        revenue: z.string().default("0"),
        liverName: z.string().optional(),
        rawData: z.record(z.string(), z.unknown()).optional(),
      })),
      importSource: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      let importedCount = 0;
      for (const row of input.csvData) {
        await db.insert(productLabSalesData).values({
          productId: input.productId,
          salesDate: row.salesDate ? new Date(row.salesDate) : null,
          quantity: row.quantity,
          revenue: row.revenue,
          importSource: input.importSource || null,
          rawData: row.rawData || null,
        });
        importedCount++;
      }

      // 商品の累計データ更新
      const allSales = await db.select().from(productLabSalesData)
        .where(eq(productLabSalesData.productId, input.productId));
      const totalSales = allSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const totalGmv = allSales.reduce((sum, s) => sum + parseFloat(String(s.revenue) || "0"), 0);

      await db.update(productPipeline)
        .set({
          totalSales,
          totalGmv: totalGmv.toFixed(2),
        })
        .where(eq(productPipeline.id, input.productId));

      return { success: true, importedCount, message: `${importedCount}件のデータをインポートしました` };
    }),

  // ===== 横推一键通知（全主播LINE一斉送信） =====
  broadcastHit: protectedProcedure
    .input(z.object({
      productId: z.number(),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // 商品情報取得
      const [product] = await db.select().from(productPipeline).where(eq(productPipeline.id, input.productId));
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });

      // 全アクティブ主播を取得（LINE連携済み）
      const activeLivers = await db.select().from(livers)
        .where(and(
          eq(livers.isActive, true),
          sql`${livers.lineUserId} IS NOT NULL AND ${livers.lineUserId} != ''`
        ));

      if (activeLivers.length === 0) {
        return { success: false, message: "LINE連携済みのアクティブ主播がいません", sentCount: 0, failedCount: 0 };
      }

      // 横推メッセージ作成
      const message = buildBroadcastMessage(product, input.customMessage);

      // 一斉送信
      let sentCount = 0;
      let failedCount = 0;
      for (const liver of activeLivers) {
        if (liver.lineUserId) {
          const success = await pushMessage(liver.lineUserId, [{ type: "text", text: message }]);
          if (success) sentCount++;
          else failedCount++;
        }
      }

      // ステータスを「横推中」に変更
      await db.update(productPipeline)
        .set({ status: "spreading" })
        .where(eq(productPipeline.id, input.productId));

      return { 
        success: true, 
        sentCount, 
        failedCount, 
        totalLivers: activeLivers.length,
        message: `${sentCount}名の主播にLINE通知を送信しました（失敗: ${failedCount}名）`,
      };
    }),

  // ===== 統計ダッシュボード =====
  stats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const allProducts = await db.select().from(productPipeline);
      
      const statusCounts = {
        candidate: 0,
        testing: 0,
        hit: 0,
        spreading: 0,
        standard: 0,
        eliminated: 0,
      };
      
      let totalGmv = 0;
      let totalProducts = allProducts.length;

      for (const p of allProducts) {
        statusCounts[p.status as keyof typeof statusCounts]++;
        totalGmv += parseFloat(String(p.totalGmv) || "0");
      }

      // トップ商品（スコア順）
      const topProducts = [...allProducts]
        .sort((a, b) => parseFloat(String(b.score) || "0") - parseFloat(String(a.score) || "0"))
        .slice(0, 10);

      return {
        statusCounts,
        totalProducts,
        totalGmv,
        topProducts,
      };
    }),

  // ===== ライバー一覧取得（アサイン用） =====
  getLivers: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const activeLivers = await db.select({
        id: livers.id,
        name: livers.name,
        lineUserId: livers.lineUserId,
        isActive: livers.isActive,
        tiktokAccount: livers.tiktokAccount,
      }).from(livers)
        .where(eq(livers.isActive, true))
        .orderBy(livers.name);

      return activeLivers;
    }),

  // ===== 商品詳細取得 =====
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const [product] = await db.select().from(productPipeline).where(eq(productPipeline.id, input.id));
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });

      // テスト配信履歴
      const assignments = await db.select({
        assignment: productTestAssignment,
        liverName: livers.name,
      })
        .from(productTestAssignment)
        .leftJoin(livers, eq(productTestAssignment.liverId, livers.id))
        .where(eq(productTestAssignment.productId, input.id))
        .orderBy(desc(productTestAssignment.createdAt));

      // 売上データ
      const salesData = await db.select().from(productLabSalesData)
        .where(eq(productLabSalesData.productId, input.id))
        .orderBy(desc(productLabSalesData.salesDate));

      return { product, assignments, salesData };
    }),
});

// ===== ヘルパー関数 =====

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    candidate: "候補",
    testing: "テスト中",
    hit: "爆品🔥",
    spreading: "横推中",
    standard: "定番",
    eliminated: "淘汰",
  };
  return labels[status] || status;
}

function buildTestAssignMessage(product: any, liverName: string, duration: number, scheduledAt?: string): string {
  const scheduleStr = scheduledAt 
    ? `\n📅 配信予定: ${new Date(scheduledAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}` 
    : "";
  
  return `🧪【テスト配信依頼】

こんにちは、${liverName}さん！
新商品のテスト配信をお願いします。

━━━━━━━━━━━━━━━
📦 商品名: ${product.name}
💰 売値: ¥${product.sellPrice}
⏱ 配信時間: ${duration}分${scheduleStr}
━━━━━━━━━━━━━━━

${product.talkScript ? `\n💬 話術ポイント:\n${product.talkScript}\n` : ""}
${product.productDescription ? `\n📝 商品説明:\n${product.productDescription}\n` : ""}
よろしくお願いします！🙏`;
}

function buildBroadcastMessage(product: any, customMessage?: string): string {
  return `🔥【爆品横推通知】🔥

━━━━━━━━━━━━━━━
📦 ${product.name}
💰 売値: ¥${product.sellPrice}
📊 スコア: ${product.score}
📈 転換率: ${product.conversionRate}%
🛒 累計販売: ${product.totalSales}個
━━━━━━━━━━━━━━━

${product.talkScript ? `💬 話術:\n${product.talkScript}\n\n` : ""}${customMessage ? `📢 ${customMessage}\n\n` : ""}この商品は爆品認定されました！
全主播で販売を開始してください 💪`;
}
