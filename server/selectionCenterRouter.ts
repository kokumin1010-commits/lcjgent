import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { selectionProducts, selectionCategories, anchorSelections, selectionSchedules, selectionPerformances, selectionSettlements } from "../drizzle/schema";
import { eq, and, like, sql, desc, asc } from "drizzle-orm";

export const selectionCenterRouter = router({
  // ========== Dashboard ==========
  getDashboard: protectedProcedure.query(async () => {
    const [products] = await (await getDb())!.select({ count: sql<number>`count(*)` }).from(selectionProducts);
    const [online] = await (await getDb())!.select({ count: sql<number>`count(*)` }).from(selectionProducts).where(eq(selectionProducts.status, "online"));
    const [selections] = await (await getDb())!.select({ count: sql<number>`count(*)` }).from(anchorSelections);
    const [schedules] = await (await getDb())!.select({ count: sql<number>`count(*)` }).from(selectionSchedules).where(eq(selectionSchedules.status, "confirmed"));
    const [gmvResult] = await (await getDb())!.select({ total: sql<string>`COALESCE(SUM(gmv), 0)` }).from(selectionPerformances);
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
    return (await getDb())!.select().from(selectionCategories).orderBy(asc(selectionCategories.sortOrder));
  }),

  createCategory: protectedProcedure.input(z.object({
    name: z.string(),
    parentId: z.number().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const [result] = await (await getDb())!.insert(selectionCategories).values(input);
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
    const conditions: any[] = [];
    if (input.status) conditions.push(eq(selectionProducts.status, input.status));
    if (input.categoryId) conditions.push(eq(selectionProducts.categoryId, input.categoryId));
    if (input.search) {
      conditions.push(sql`(${selectionProducts.productName} LIKE ${`%${input.search}%`} OR ${selectionProducts.brandName} LIKE ${`%${input.search}%`} OR ${selectionProducts.barcode} LIKE ${`%${input.search}%`})`);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await (await getDb())!.select().from(selectionProducts).where(where).orderBy(desc(selectionProducts.createdAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize);
    const [countResult] = await (await getDb())!.select({ count: sql<number>`count(*)` }).from(selectionProducts).where(where);
    return { items, total: countResult.count };
  }),

  createProduct: protectedProcedure.input(z.object({
    productName: z.string(),
    barcode: z.string().optional(),
    brandName: z.string(),
    categoryId: z.number().optional(),
    price: z.string().optional(),
    marketPrice: z.string().optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.string().optional(),
    imageUrl: z.string().optional(),
    productLink: z.string().optional(),
    sellingPoints: z.string().optional(),
    stock: z.number().optional(),
    supplierContact: z.string().optional(),
  })).mutation(async ({ input }) => {
    const [result] = await (await getDb())!.insert(selectionProducts).values(input as any);
    return { id: result.insertId };
  }),

  updateProduct: protectedProcedure.input(z.object({
    id: z.number(),
    productName: z.string().optional(),
    barcode: z.string().optional(),
    brandName: z.string().optional(),
    categoryId: z.number().optional(),
    price: z.string().optional(),
    marketPrice: z.string().optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.string().optional(),
    imageUrl: z.string().optional(),
    productLink: z.string().optional(),
    sellingPoints: z.string().optional(),
    stock: z.number().optional(),
    supplierContact: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await (await getDb())!.update(selectionProducts).set(data as any).where(eq(selectionProducts.id, id));
    return { success: true };
  }),

  updateProductStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "online", "offline"]),
  })).mutation(async ({ input }) => {
    await (await getDb())!.update(selectionProducts).set({ status: input.status }).where(eq(selectionProducts.id, input.id));
    return { success: true };
  }),

  // ========== Schedules ==========
  getSchedules: protectedProcedure.query(async () => {
    const schedules = await (await getDb())!.select().from(selectionSchedules).orderBy(desc(selectionSchedules.liveDate));
    const productIds = [...new Set(schedules.map(s => s.productId))];
    const products = productIds.length > 0 ? await (await getDb())!.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`) : [];
    return schedules.map(s => ({ ...s, product: products.find(p => p.id === s.productId) }));
  }),

  createSchedule: protectedProcedure.input(z.object({
    productId: z.number(),
    anchorId: z.number(),
    liveDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    slotOrder: z.number().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const [result] = await (await getDb())!.insert(selectionSchedules).values(input as any);
    return { id: result.insertId };
  }),

  updateSchedule: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "done", "cancelled"]).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    slotOrder: z.number().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await (await getDb())!.update(selectionSchedules).set(data as any).where(eq(selectionSchedules.id, id));
    return { success: true };
  }),

  // ========== Performances ==========
  getPerformances: protectedProcedure.query(async () => {
    const perfs = await (await getDb())!.select().from(selectionPerformances).orderBy(desc(selectionPerformances.liveDate));
    const productIds = [...new Set(perfs.map(p => p.productId))];
    const products = productIds.length > 0 ? await (await getDb())!.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`) : [];
    return perfs.map(p => ({ ...p, product: products.find(pr => pr.id === p.productId) }));
  }),

  createPerformance: protectedProcedure.input(z.object({
    productId: z.number(),
    anchorId: z.number(),
    scheduleId: z.number().optional(),
    liveDate: z.string(),
    gmv: z.string().optional(),
    salesCount: z.number().optional(),
    viewerCount: z.number().optional(),
    clickCount: z.number().optional(),
    conversionRate: z.string().optional(),
    commissionAmount: z.string().optional(),
    status: z.enum(["draft", "confirmed"]).optional(),
  })).mutation(async ({ input }) => {
    const [result] = await (await getDb())!.insert(selectionPerformances).values(input as any);
    return { id: result.insertId };
  }),

  // ========== Settlements ==========
  getSettlements: protectedProcedure.query(async () => {
    return (await getDb())!.select().from(selectionSettlements).orderBy(desc(selectionSettlements.createdAt));
  }),

  generateSettlement: protectedProcedure.input(z.object({
    anchorId: z.number(),
    periodStart: z.string(),
    periodEnd: z.string(),
  })).mutation(async ({ input }) => {
    // Get all confirmed performances for this anchor in the period
    const perfs = await (await getDb())!.select().from(selectionPerformances).where(
      and(
        eq(selectionPerformances.anchorId, input.anchorId),
        eq(selectionPerformances.status, "confirmed"),
        sql`${selectionPerformances.liveDate} >= ${input.periodStart}`,
        sql`${selectionPerformances.liveDate} <= ${input.periodEnd}`,
      )
    );
    const totalGmv = perfs.reduce((sum, p) => sum + Number(p.gmv || 0), 0);
    const totalCommission = perfs.reduce((sum, p) => sum + Number(p.commissionAmount || 0), 0);
    const [result] = await (await getDb())!.insert(selectionSettlements).values({
      anchorId: input.anchorId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalGmv: String(totalGmv),
      totalCommission: String(totalCommission),
      itemCount: perfs.length,
    } as any);
    return { id: result.insertId, totalGmv: String(totalGmv), totalCommission: String(totalCommission) };
  }),

  updateSettlementStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "paid"]),
  })).mutation(async ({ input }) => {
    const updates: any = { status: input.status };
    if (input.status === "paid") updates.paidAt = new Date();
    await (await getDb())!.update(selectionSettlements).set(updates).where(eq(selectionSettlements.id, input.id));
    return { success: true };
  }),

  // ========== Liver-facing endpoints ==========
  getLiverAvailableProducts: publicProcedure.input(z.object({
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const conditions: any[] = [eq(selectionProducts.status, "online")];
    if (input.search) {
      conditions.push(sql`(${selectionProducts.productName} LIKE ${`%${input.search}%`} OR ${selectionProducts.brandName} LIKE ${`%${input.search}%`} OR ${selectionProducts.barcode} LIKE ${`%${input.search}%`})`);
    }
    return (await getDb())!.select().from(selectionProducts).where(and(...conditions)).orderBy(desc(selectionProducts.createdAt));
  }),

  liverSelectProduct: publicProcedure.input(z.object({
    productId: z.number(),
    anchorId: z.number(),
  })).mutation(async ({ input }) => {
    // Check if already selected
    const existing = await (await getDb())!.select().from(anchorSelections).where(
      and(eq(anchorSelections.productId, input.productId), eq(anchorSelections.anchorId, input.anchorId))
    );
    if (existing.length > 0) throw new Error("既に選品済みです");
    const [result] = await (await getDb())!.insert(anchorSelections).values(input as any);
    return { id: result.insertId };
  }),

  getLiverMySelections: publicProcedure.input(z.object({
    anchorId: z.number(),
  })).query(async ({ input }) => {
    if (!input.anchorId) return [];
    const selections = await (await getDb())!.select().from(anchorSelections).where(eq(anchorSelections.anchorId, input.anchorId)).orderBy(desc(anchorSelections.createdAt));
    const productIds = selections.map(s => s.productId);
    if (productIds.length === 0) return [];
    const products = await (await getDb())!.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`);
    return selections.map(s => {
      const p = products.find(pr => pr.id === s.productId);
      return { ...s, productName: p?.productName, brandName: p?.brandName, commissionType: p?.commissionType, commissionValue: p?.commissionValue };
    });
  }),

  getLiverMyPerformance: publicProcedure.input(z.object({
    anchorId: z.number(),
  })).query(async ({ input }) => {
    if (!input.anchorId) return [];
    const perfs = await (await getDb())!.select().from(selectionPerformances).where(eq(selectionPerformances.anchorId, input.anchorId)).orderBy(desc(selectionPerformances.liveDate));
    const productIds = [...new Set(perfs.map(p => p.productId))];
    if (productIds.length === 0) return perfs;
    const products = await (await getDb())!.select().from(selectionProducts).where(sql`${selectionProducts.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`);
    return perfs.map(p => ({ ...p, productName: products.find(pr => pr.id === p.productId)?.productName }));
  }),
});
