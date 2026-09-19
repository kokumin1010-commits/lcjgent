import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  BRAND_BD_STAGE_VALUES,
  BRAND_DEAL_MODEL_VALUES,
  businessMonthKey,
} from "../shared/brandBusiness";
import { getBrandBusinessUpgradeHealth } from "./brandBusinessUpgrade";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";
import {
  getBrandBusinessOverview,
  saveBrandBusinessDeal,
  saveBrandBusinessMonthlyTarget,
} from "./brandBusinessService";

const optionalMoney = z.number().finite().nonnegative().max(9_000_000_000_000).nullable().optional();
const optionalRate = z.number().finite().nonnegative().max(100).nullable().optional();
const fixedRoi = z.number().finite().refine(value => value === 2, "ROI guarantee must be 1:2").nullable().optional();
const optionalDate = z.string().datetime().nullable().optional();

function actor(ctx: any) {
  return { id: Number(ctx.user.id), name: ctx.user.name || ctx.user.email || null };
}

function isBusinessDepartment(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("商务") || normalized.includes("商務") || normalized.includes("business");
}

async function brandBusinessAccess(ctx: any) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  const access = await getUserManagementAccess(db, Number(ctx.user.id));
  const canAccess = access.isSuperAdmin
    || isBusinessDepartment(access.staffDepartment)
    || isBusinessDepartment(access.managedDepartment);
  return { canAccess, access };
}

async function requireBrandBusinessAccess(ctx: any) {
  const result = await brandBusinessAccess(ctx);
  if (!result.canAccess) {
    throw new TRPCError({ code: "FORBIDDEN", message: "品牌商务数据仅限商务部和超级管理员" });
  }
  return result.access;
}

export const brandBusinessRouter = router({
  access: protectedProcedure.query(async ({ ctx }) => {
    const result = await brandBusinessAccess(ctx);
    return { canAccess: result.canAccess };
  }),

  upgradeHealth: protectedProcedure.query(async ({ ctx }) => {
    await requireBrandBusinessAccess(ctx);
    return getBrandBusinessUpgradeHealth();
  }),

  overview: protectedProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }).optional())
    .query(async ({ ctx, input }) => {
      await requireBrandBusinessAccess(ctx);
      const month = input || businessMonthKey();
      return getBrandBusinessOverview(month.year, month.month);
    }),

  saveDeal: protectedProcedure
    .input(z.object({
      brandId: z.number().int().positive(),
      stage: z.enum(BRAND_BD_STAGE_VALUES),
      dealModel: z.enum(BRAND_DEAL_MODEL_VALUES).nullable().optional(),
      slotFeeAmount: optionalMoney,
      guaranteedRoi: fixedRoi,
      pureCommissionRate: optionalRate,
      lastContactAt: optionalDate,
      nextFollowUpAt: optionalDate,
      nextAction: z.string().max(2000).nullable().optional(),
      negotiationNotes: z.string().max(10000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await requireBrandBusinessAccess(ctx);
        return await saveBrandBusinessDeal(input, actor(ctx));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : "failed to save brand BD";
        throw new TRPCError({ code: message.includes("not found") ? "NOT_FOUND" : "BAD_REQUEST", message });
      }
    }),

  saveMonthlyTarget: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
      newBrandTarget: z.number().int().nonnegative().max(100000),
      contactTarget: z.number().int().nonnegative().max(100000),
      negotiationTarget: z.number().int().nonnegative().max(100000),
      contractTarget: z.number().int().nonnegative().max(100000),
      slotFeeContractTarget: z.number().int().nonnegative().max(100000),
      slotFeeRevenueTarget: z.number().int().nonnegative().max(9_000_000_000_000),
      goalNote: z.string().max(5000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await requireBrandBusinessAccess(ctx);
        return await saveBrandBusinessMonthlyTarget(input, actor(ctx));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "failed to save target" });
      }
    }),
});
