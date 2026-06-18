import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { selectionProducts, selectionCategories, anchorSelections, scSchedules, selectionPerformances, selectionSettlements } from "../drizzle/schema";
import { eq, and, like, sql, desc, asc, isNull } from "drizzle-orm";

export const selectionCenterRouter = router({
  // ========== Dashboard ==========
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [products] = await db.select({ count: sql<number>`count(*)` }).from(selectionProducts).where(isNull(selectionProducts.deletedAt));
    const [online] = await db.select({ count: sql<number>`count(*)` }).from(selectionProducts).where(and(eq(selectionProducts.status, "online"), isNull(selectionProducts.deletedAt)));
    const [selections] = await db.select({ count: sql<number>`count(*)` }).from(anchorSelections);
    const [schedules] = await db.select({ count: sql<number>`count(*)` }).from(scSchedules).where(eq(scSchedules.status, "confirmed"));
    const [gmvResult] = await db.select({ total: sql<string>`COALESCE(SUM(gmv), 0)` }).from(selectionPerformances);
    return {
      totalProducts: products.count,
      onlineProducts: online.count,
      totalSelections: selections.count,
      confirmedSchedules: schedules.count,
      totalGmv: gmvResult.total,
    };
  }),

  // ========== Categories ==========
  getCategories: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    try {
      const result = await db.select().from(selectionCategories).orderBy(asc(selectionCategories.sortOrder));
      return result;
    } catch (e: any) {
      console.error('[getCategories] Error:', e.message, e.code, e.errno, JSON.stringify(e).substring(0, 500));
      throw new Error(`getCategories failed: ${e.message} | code=${e.code} | errno=${e.errno}`);
    }
  }),

  createCategory: protectedProcedure.input(z.object({
    name: z.string(),
    parentId: z.number().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [result] = await db.insert(selectionCategories).values(input);
    return { id: result.insertId };
  }),

  // ========== Products ==========
  getProducts: protectedProcedure.input(z.object({
    search: z.string().optional(),
    status: z.enum(["draft", "online", "offline"]).optional(),
    categoryId: z.number().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(50),
  })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions: any[] = [isNull(selectionProducts.deletedAt)];
    if (input.status) conditions.push(eq(selectionProducts.status, input.status));
    if (input.categoryId) conditions.push(eq(selectionProducts.categoryId, input.categoryId));
    if (input.search) {
      conditions.push(sql`(${selectionProducts.productName} LIKE ${`%${input.search}%`} OR ${selectionProducts.brandName} LIKE ${`%${input.search}%`} OR ${selectionProducts.barcode} LIKE ${`%${input.search}%`})`);
    }
    const where = and(...conditions);
    const items = await db.select().from(selectionProducts).where(where).orderBy(desc(selectionProducts.createdAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(selectionProducts).where(where);
    return { items, total: countResult.count };
  }),

  createProduct: protectedProcedure.input(z.object({
    productName: z.string(),
    barcode: z.string().optional(),
    brandName: z.string(),
    brandId: z.number().optional(),
    categoryId: z.number().optional(),
    price: z.string().optional(),
    marketPrice: z.string().optional(),
    costPrice: z.string().optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.string().optional(),
    images: z.any().optional(),
    videos: z.any().optional(),
    productLink: z.string().optional(),
    sellingPoints: z.string().optional(),
    description: z.string().optional(),
    stock: z.number().optional(),
    supplierContact: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = (await getDb())!;
    const [result] = await db.insert(selectionProducts).values({
      ...input,
      createdBy: (ctx.user as any)?.id || 0,
    } as any);
    return { id: result.insertId };
  }),

  updateProduct: protectedProcedure.input(z.object({
    id: z.number(),
    productName: z.string().optional(),
    barcode: z.string().optional(),
    brandName: z.string().optional(),
    brandId: z.number().optional(),
    categoryId: z.number().optional(),
    price: z.string().optional(),
    marketPrice: z.string().optional(),
    costPrice: z.string().optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.string().optional(),
    images: z.any().optional(),
    videos: z.any().optional(),
    productLink: z.string().optional(),
    sellingPoints: z.string().optional(),
    description: z.string().optional(),
    stock: z.number().optional(),
    supplierContact: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const { id, ...data } = input;
    await db.update(selectionProducts).set(data as any).where(eq(selectionProducts.id, id));
    return { success: true };
  }),

  updateProductStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "online", "offline"]),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(selectionProducts).set({ status: input.status }).where(eq(selectionProducts.id, input.id));
    return { success: true };
  }),

  deleteProduct: protectedProcedure.input(z.object({
    id: z.number(),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    // Soft delete
    await db.update(selectionProducts).set({ deletedAt: new Date() } as any).where(eq(selectionProducts.id, input.id));
    return { success: true };
  }),

  // ========== Schedules ==========
  getSchedules: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const schedules = await db.select().from(scSchedules).orderBy(desc(scSchedules.liveDate));
    const productIds = [...new Set(schedules.map(s => s.productId))];
    const products = productIds.length > 0 ? await db.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`) : [];
    return schedules.map(s => ({ ...s, product: products.find(p => p.id === s.productId) }));
  }),

  createSchedule: protectedProcedure.input(z.object({
    productId: z.number(),
    anchorId: z.number(),
    liveDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    durationMinutes: z.number().optional(),
    slotOrder: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = (await getDb())!;
    const [result] = await db.insert(scSchedules).values({
      ...input,
      createdBy: (ctx.user as any)?.id || 0,
    } as any);
    return { id: result.insertId };
  }),

  updateSchedule: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "done", "cancelled"]).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    durationMinutes: z.number().optional(),
    slotOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const { id, ...data } = input;
    await db.update(scSchedules).set(data as any).where(eq(scSchedules.id, id));
    return { success: true };
  }),

  // ========== Performances ==========
  getPerformances: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const perfs = await db.select().from(selectionPerformances).orderBy(desc(selectionPerformances.liveDate));
    const productIds = [...new Set(perfs.map(p => p.productId))];
    const products = productIds.length > 0 ? await db.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`) : [];
    return perfs.map(p => ({ ...p, product: products.find(pr => pr.id === p.productId) }));
  }),

  createPerformance: protectedProcedure.input(z.object({
    productId: z.number(),
    liverId: z.number(),
    scheduleId: z.number().optional(),
    liveDate: z.string(),
    gmv: z.string().optional(),
    salesCount: z.number().optional(),
    avgViewers: z.number().optional(),
    commissionAmount: z.string().optional(),
    remark: z.string().optional(),
    status: z.enum(["draft", "confirmed"]).optional(),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [result] = await db.insert(selectionPerformances).values(input as any);
    return { id: result.insertId };
  }),

  // ========== Settlements ==========
  getSettlements: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    return db.select().from(selectionSettlements).orderBy(desc(selectionSettlements.createdAt));
  }),

  generateSettlement: protectedProcedure.input(z.object({
    liverId: z.number(),
    periodStart: z.string(),
    periodEnd: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const db = (await getDb())!;
    // Get all confirmed performances for this liver in the period
    const perfs = await db.select().from(selectionPerformances).where(
      and(
        eq(selectionPerformances.liverId, input.liverId),
        eq(selectionPerformances.status, "confirmed"),
        sql`${selectionPerformances.liveDate} >= ${input.periodStart}`,
        sql`${selectionPerformances.liveDate} <= ${input.periodEnd}`,
      )
    );
    const totalGmv = perfs.reduce((sum, p) => sum + Number(p.gmv || 0), 0);
    const totalCommission = perfs.reduce((sum, p) => sum + Number(p.commissionAmount || 0), 0);
    const [result] = await db.insert(selectionSettlements).values({
      liverId: input.liverId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalGmv: String(totalGmv),
      totalCommission: String(totalCommission),
      settledPerformanceIds: perfs.map(p => p.id),
      createdBy: (ctx.user as any)?.id || 0,
    } as any);
    return { id: result.insertId, totalGmv: String(totalGmv), totalCommission: String(totalCommission) };
  }),

  updateSettlementStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "paid"]),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const updates: any = { status: input.status };
    if (input.status === "paid") updates.paidAt = new Date();
    await db.update(selectionSettlements).set(updates).where(eq(selectionSettlements.id, input.id));
    return { success: true };
  }),

  // ========== Liver-facing endpoints ==========
  getLiverAvailableProducts: publicProcedure.input(z.object({
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions: any[] = [eq(selectionProducts.status, "online"), isNull(selectionProducts.deletedAt)];
    if (input.search) {
      conditions.push(sql`(${selectionProducts.productName} LIKE ${`%${input.search}%`} OR ${selectionProducts.brandName} LIKE ${`%${input.search}%`} OR ${selectionProducts.barcode} LIKE ${`%${input.search}%`})`);
    }
    return db.select().from(selectionProducts).where(and(...conditions)).orderBy(desc(selectionProducts.createdAt));
  }),

  liverSelectProduct: publicProcedure.input(z.object({
    productId: z.number(),
    liverId: z.number(),
  })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    // Check if already selected
    const existing = await db.select().from(anchorSelections).where(
      and(eq(anchorSelections.productId, input.productId), eq(anchorSelections.liverId, input.liverId))
    );
    if (existing.length > 0) throw new Error("既に選品済みです");
    const [result] = await db.insert(anchorSelections).values(input as any);
    return { id: result.insertId };
  }),

  getLiverMySelections: publicProcedure.input(z.object({
    liverId: z.number(),
  })).query(async ({ input }) => {
    const db = (await getDb())!;
    if (!input.liverId) return [];
    const selections = await db.select().from(anchorSelections).where(eq(anchorSelections.liverId, input.liverId)).orderBy(desc(anchorSelections.createdAt));
    const productIds = selections.map(s => s.productId);
    if (productIds.length === 0) return [];
    const products = await db.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`);
    return selections.map(s => {
      const p = products.find(pr => pr.id === s.productId);
      return { ...s, productName: p?.productName, brandName: p?.brandName, commissionType: p?.commissionType, commissionValue: p?.commissionValue };
    });
  }),

  getLiverMyPerformance: publicProcedure.input(z.object({
    liverId: z.number(),
  })).query(async ({ input }) => {
    const db = (await getDb())!;
    if (!input.liverId) return [];
    const perfs = await db.select().from(selectionPerformances).where(eq(selectionPerformances.liverId, input.liverId)).orderBy(desc(selectionPerformances.liveDate));
    const productIds = [...new Set(perfs.map(p => p.productId))];
    if (productIds.length === 0) return perfs;
    const products = await db.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`);
    return perfs.map(p => ({ ...p, productName: products.find(pr => pr.id === p.productId)?.productName }));
  }),
});
