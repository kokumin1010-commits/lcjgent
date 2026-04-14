import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { adMonthlyPlans, adDailyRecords, brands, livers } from "../drizzle/schema";
import { eq, desc, and, sql, asc, isNull } from "drizzle-orm";

export const adDashboardRouter = router({
  // ===== 月次計画 CRUD =====

  // 月次計画一覧取得（フィルター付き）
  getMonthlyPlans: protectedProcedure
    .input(z.object({
      month: z.string().optional(), // 例: "2026-04"
      liverId: z.number().optional(),
      brandId: z.number().optional(),
      adType: z.enum(["short_video", "live", "mixed"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: any[] = [];
      
      if (input?.month) {
        conditions.push(eq(adMonthlyPlans.month, input.month));
      }
      if (input?.liverId) {
        conditions.push(eq(adMonthlyPlans.liverId, input.liverId));
      }
      if (input?.brandId) {
        conditions.push(eq(adMonthlyPlans.brandId, input.brandId));
      }
      if (input?.adType) {
        conditions.push(eq(adMonthlyPlans.adType, input.adType));
      }

      const plans = await db
        .select()
        .from(adMonthlyPlans)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(adMonthlyPlans.month), asc(adMonthlyPlans.liverName));

      return plans;
    }),

  // 月次計画の作成
  createMonthlyPlan: protectedProcedure
    .input(z.object({
      month: z.string().min(7).max(7),
      liverId: z.number().nullable().optional(),
      liverName: z.string().min(1),
      brandId: z.number().nullable().optional(),
      brandName: z.string().min(1),
      adType: z.enum(["short_video", "live", "mixed"]).default("mixed"),
      budget: z.number().default(0),
      actualSpend: z.number().default(0),
      targetGmv: z.number().default(0),
      targetRoi: z.number().default(0),
      actualGmv: z.number().default(0),
      actualRoi: z.number().default(0),
      impressions: z.number().default(0),
      clicks: z.number().default(0),
      conversions: z.number().default(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const spendRate = input.budget > 0 ? input.actualSpend / input.budget : 0;
      
      const result = await db.insert(adMonthlyPlans).values({
        month: input.month,
        liverId: input.liverId ?? null,
        liverName: input.liverName,
        brandId: input.brandId ?? null,
        brandName: input.brandName,
        adType: input.adType,
        budget: input.budget,
        actualSpend: input.actualSpend,
        spendRate: String(spendRate),
        targetGmv: input.targetGmv,
        targetRoi: String(input.targetRoi),
        actualGmv: input.actualGmv,
        actualRoi: String(input.actualRoi),
        impressions: input.impressions,
        clicks: input.clicks,
        conversions: input.conversions,
        notes: input.notes || null,
        createdBy: (ctx as any).user?.id || null,
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  // 月次計画の更新
  updateMonthlyPlan: protectedProcedure
    .input(z.object({
      id: z.number(),
      budget: z.number().optional(),
      actualSpend: z.number().optional(),
      targetGmv: z.number().optional(),
      targetRoi: z.number().optional(),
      actualGmv: z.number().optional(),
      actualRoi: z.number().optional(),
      impressions: z.number().optional(),
      clicks: z.number().optional(),
      conversions: z.number().optional(),
      notes: z.string().optional(),
      adType: z.enum(["short_video", "live", "mixed"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      
      // Calculate spendRate if budget and actualSpend are provided
      const updateData: any = {};
      if (updates.budget !== undefined) updateData.budget = updates.budget;
      if (updates.actualSpend !== undefined) updateData.actualSpend = updates.actualSpend;
      if (updates.targetGmv !== undefined) updateData.targetGmv = updates.targetGmv;
      if (updates.targetRoi !== undefined) updateData.targetRoi = String(updates.targetRoi);
      if (updates.actualGmv !== undefined) updateData.actualGmv = updates.actualGmv;
      if (updates.actualRoi !== undefined) updateData.actualRoi = String(updates.actualRoi);
      if (updates.impressions !== undefined) updateData.impressions = updates.impressions;
      if (updates.clicks !== undefined) updateData.clicks = updates.clicks;
      if (updates.conversions !== undefined) updateData.conversions = updates.conversions;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.adType !== undefined) updateData.adType = updates.adType;

      // Recalculate spendRate
      if (updates.budget !== undefined || updates.actualSpend !== undefined) {
        const existing = await db.select().from(adMonthlyPlans).where(eq(adMonthlyPlans.id, id));
        if (existing.length > 0) {
          const budget = updates.budget ?? existing[0].budget ?? 0;
          const spend = updates.actualSpend ?? existing[0].actualSpend ?? 0;
          updateData.spendRate = String(budget > 0 ? spend / budget : 0);
        }
      }

      await db.update(adMonthlyPlans).set(updateData).where(eq(adMonthlyPlans.id, id));
      return { success: true };
    }),

  // 月次計画の削除
  deleteMonthlyPlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Also delete related daily records
      await db.delete(adDailyRecords).where(eq(adDailyRecords.monthlyPlanId, input.id));
      await db.delete(adMonthlyPlans).where(eq(adMonthlyPlans.id, input.id));
      return { success: true };
    }),

  // ===== ダッシュボード集計 =====

  // 月次サマリー（KPIカード用）
  getMonthlySummary: protectedProcedure
    .input(z.object({
      month: z.string().optional(), // 指定なしの場合は全期間
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: any[] = [];
      if (input?.month) {
        conditions.push(eq(adMonthlyPlans.month, input.month));
      }

      const plans = await db
        .select()
        .from(adMonthlyPlans)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Aggregate
      let totalBudget = 0;
      let totalSpend = 0;
      let totalTargetGmv = 0;
      let totalActualGmv = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      const uniqueLivers = new Set<string>();
      const uniqueBrands = new Set<string>();

      for (const plan of plans) {
        totalBudget += plan.budget ?? 0;
        totalSpend += plan.actualSpend ?? 0;
        totalTargetGmv += plan.targetGmv ?? 0;
        totalActualGmv += plan.actualGmv ?? 0;
        totalImpressions += plan.impressions ?? 0;
        totalClicks += plan.clicks ?? 0;
        totalConversions += plan.conversions ?? 0;
        if (plan.liverName) uniqueLivers.add(plan.liverName);
        if (plan.brandName) uniqueBrands.add(plan.brandName);
      }

      const overallSpendRate = totalBudget > 0 ? totalSpend / totalBudget : 0;
      const overallRoi = totalSpend > 0 ? totalActualGmv / totalSpend : 0;

      return {
        totalBudget,
        totalSpend,
        overallSpendRate,
        totalTargetGmv,
        totalActualGmv,
        overallRoi,
        totalImpressions,
        totalClicks,
        totalConversions,
        activeLiverCount: uniqueLivers.size,
        activeBrandCount: uniqueBrands.size,
        planCount: plans.length,
      };
    }),

  // マトリクスデータ（店舗×ブランド）
  getMatrixData: protectedProcedure
    .input(z.object({
      month: z.string().optional(),
      adType: z.enum(["short_video", "live", "mixed", "all"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: any[] = [];
      if (input?.month) {
        conditions.push(eq(adMonthlyPlans.month, input.month));
      }
      if (input?.adType && input.adType !== "all") {
        conditions.push(eq(adMonthlyPlans.adType, input.adType));
      }

      const plans = await db
        .select()
        .from(adMonthlyPlans)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(adMonthlyPlans.liverName), asc(adMonthlyPlans.brandName));

      // Build matrix structure
      const liversSet = new Set<string>();
      const brandsSet = new Set<string>();
      const matrix: Record<string, Record<string, typeof plans[0][]>> = {};

      for (const plan of plans) {
        liversSet.add(plan.liverName);
        brandsSet.add(plan.brandName);
        
        if (!matrix[plan.liverName]) matrix[plan.liverName] = {};
        if (!matrix[plan.liverName][plan.brandName]) matrix[plan.liverName][plan.brandName] = [];
        matrix[plan.liverName][plan.brandName].push(plan);
      }

      return {
        livers: Array.from(liversSet).sort(),
        brands: Array.from(brandsSet).sort(),
        matrix,
        rawPlans: plans,
      };
    }),

  // 利用可能な月のリスト
  getAvailableMonths: protectedProcedure
    .query(async () => {
      const db = getDb();
      const result = await db
        .selectDistinct({ month: adMonthlyPlans.month })
        .from(adMonthlyPlans)
        .orderBy(desc(adMonthlyPlans.month));
      return result.map(r => r.month);
    }),

  // ===== 日次実績 =====

  // 日次実績の取得
  getDailyRecords: protectedProcedure
    .input(z.object({
      monthlyPlanId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      return await db
        .select()
        .from(adDailyRecords)
        .where(eq(adDailyRecords.monthlyPlanId, input.monthlyPlanId))
        .orderBy(asc(adDailyRecords.recordDate));
    }),

  // 日次実績の追加
  createDailyRecord: protectedProcedure
    .input(z.object({
      monthlyPlanId: z.number(),
      recordDate: z.string(), // ISO date string
      spend: z.number().default(0),
      gmv: z.number().default(0),
      impressions: z.number().default(0),
      clicks: z.number().default(0),
      conversions: z.number().default(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(adDailyRecords).values({
        monthlyPlanId: input.monthlyPlanId,
        recordDate: new Date(input.recordDate),
        spend: input.spend,
        gmv: input.gmv,
        impressions: input.impressions,
        clicks: input.clicks,
        conversions: input.conversions,
        notes: input.notes || null,
      });
      return { success: true, id: Number(result[0].insertId) };
    }),

  // ===== ドロップダウン用データ =====

  // ブランド一覧（ドロップダウン用）
  getBrandsForDropdown: protectedProcedure
    .query(async () => {
      const db = getDb();
      const result = await db
        .select({ id: brands.id, name: brands.name, nameJa: brands.nameJa })
        .from(brands)
        .where(isNull(brands.deletedAt))
        .orderBy(asc(brands.name));
      return result;
    }),

  // ライバー一覧（ドロップダウン用）
  getLiversForDropdown: protectedProcedure
    .query(async () => {
      const db = getDb();
      const result = await db
        .select({ id: livers.id, name: livers.name })
        .from(livers)
        .where(eq(livers.isActive, true))
        .orderBy(asc(livers.name));
      return result;
    }),

  // ===== 一括インポート（Excel→DB） =====
  bulkImport: protectedProcedure
    .input(z.object({
      plans: z.array(z.object({
        month: z.string(),
        liverName: z.string(),
        brandName: z.string(),
        adType: z.enum(["short_video", "live", "mixed"]).default("mixed"),
        budget: z.number().default(0),
        actualSpend: z.number().default(0),
        targetGmv: z.number().default(0),
        targetRoi: z.number().default(0),
        actualGmv: z.number().default(0),
        actualRoi: z.number().default(0),
        liverId: z.number().nullable().optional(),
        brandId: z.number().nullable().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let imported = 0;
      
      for (const plan of input.plans) {
        const spendRate = plan.budget > 0 ? plan.actualSpend / plan.budget : 0;
        await db.insert(adMonthlyPlans).values({
          month: plan.month,
          liverId: plan.liverId ?? null,
          liverName: plan.liverName,
          brandId: plan.brandId ?? null,
          brandName: plan.brandName,
          adType: plan.adType,
          budget: plan.budget,
          actualSpend: plan.actualSpend,
          spendRate: String(spendRate),
          targetGmv: plan.targetGmv,
          targetRoi: String(plan.targetRoi),
          actualGmv: plan.actualGmv,
          actualRoi: String(plan.actualRoi),
          createdBy: (ctx as any).user?.id || null,
        });
        imported++;
      }

      return { success: true, imported };
    }),
});
