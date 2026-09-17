import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { resolvePerformanceAccess } from "./performanceAccess";
import {
  createBusinessSalesAttribution,
  getBusinessSalesConfiguration,
  reverseBusinessSalesAttribution,
} from "./performanceBusinessSalesService";
import {
  generatePerformanceAiAssessment,
  getPerformanceMonthlyAssessment,
  reviewManagerMonthlyReview,
  submitManagerMonthlyReview,
} from "./performanceMonthlyReviewService";
import {
  createManualScoreCandidate,
  createPerformanceAppeal,
  createPerformanceAssignment,
  createPerformanceException,
  getPerformanceAudit,
  getPerformanceConfiguration,
  getPerformanceDashboard,
  getPerformanceReviewQueue,
  getPerformanceTeamDashboard,
  reconcilePerformanceNow,
  resolvePerformanceAppeal,
  reviewScoreCandidate,
  updatePerformanceTemplateStatus,
} from "./performanceService";

function jstDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function context(ctx: { user: { id: number; email?: string | null } }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接失败" });
  const access = await resolvePerformanceAccess(db, {
    id: ctx.user.id,
    email: ctx.user.email || null,
  }, jstDate());
  return { db, access };
}

const requestId = z.string().uuid();
const yearMonth = z.string().regex(/^\d{4}-\d{2}$/).optional();
const requiredYearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const performanceDimension = z.enum(["completion", "timeliness", "quality", "accuracy_closure", "initiative", "manager_evaluation"]);
const monthlyDimensions = z.array(z.object({
  dimension: performanceDimension,
  applicable: z.boolean(),
  score: z.number().min(0).max(30).nullable(),
})).length(6);

export const performanceRouter = router({
  dashboard: protectedProcedure
    .input(z.object({ staffId: z.number().int().positive().optional(), yearMonth }).default({}))
    .query(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return getPerformanceDashboard(resolved.db, resolved.access, input);
    }),

  team: protectedProcedure
    .input(z.object({ yearMonth }).default({}))
    .query(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return getPerformanceTeamDashboard(resolved.db, resolved.access, input.yearMonth);
    }),

  monthlyAssessment: protectedProcedure
    .input(z.object({ staffId: z.number().int().positive().optional(), yearMonth: requiredYearMonth }))
    .query(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return getPerformanceMonthlyAssessment(resolved.db, resolved.access, input);
    }),

  generateAiMonthlyAssessment: protectedProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      yearMonth: requiredYearMonth,
      regenerate: z.boolean().optional().default(false),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return generatePerformanceAiAssessment(resolved.db, resolved.access, input);
    }),

  submitManagerMonthlyReview: protectedProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      yearMonth: requiredYearMonth,
      aiAssessmentId: z.number().int().positive(),
      dimensions: monthlyDimensions,
      overallReason: z.string().trim().min(10).max(10000),
      differenceReason: z.string().trim().max(10000).nullable().optional(),
      appealId: z.number().int().positive().nullable().optional(),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return submitManagerMonthlyReview(resolved.db, resolved.access, input);
    }),

  reviewManagerMonthlyReview: protectedProcedure
    .input(z.object({
      reviewId: z.number().int().positive(),
      decision: z.enum(["approve", "reject"]),
      reason: z.string().trim().min(5).max(10000),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return reviewManagerMonthlyReview(resolved.db, resolved.access, input);
    }),

  businessSales: protectedProcedure
    .input(z.object({ yearMonth: requiredYearMonth }))
    .query(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return getBusinessSalesConfiguration(resolved.db, resolved.access, input.yearMonth);
    }),

  createBusinessSalesAttribution: protectedProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      storeId: z.number().int().positive(),
      sourceType: z.enum(["brand_contract", "manual_confirmed", "order"]),
      sourceId: z.string().trim().min(1).max(128),
      businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      currency: z.string().trim().min(3).max(10).nullable().optional(),
      amount: z.number().finite().positive().nullable().optional(),
      evidenceReference: z.string().trim().max(4000).nullable().optional(),
      note: z.string().trim().max(4000).nullable().optional(),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return createBusinessSalesAttribution(resolved.db, resolved.access, input);
    }),

  reverseBusinessSalesAttribution: protectedProcedure
    .input(z.object({
      attributionId: z.number().int().positive(),
      businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().trim().min(5).max(4000),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return reverseBusinessSalesAttribution(resolved.db, resolved.access, input);
    }),

  configuration: protectedProcedure.query(async ({ ctx }) => {
    const resolved = await context(ctx);
    return getPerformanceConfiguration(resolved.db, resolved.access);
  }),

  reviewQueue: protectedProcedure.query(async ({ ctx }) => {
    const resolved = await context(ctx);
    return getPerformanceReviewQueue(resolved.db, resolved.access);
  }),

  reconcileNow: protectedProcedure.mutation(async ({ ctx }) => {
    const resolved = await context(ctx);
    return reconcilePerformanceNow(resolved.db, resolved.access);
  }),

  updateTemplateStatus: protectedProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      status: z.enum(["draft", "shadow"]),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return updatePerformanceTemplateStatus(resolved.db, resolved.access, input);
    }),

  createAssignment: protectedProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      assignmentType: z.enum(["primary", "responsibility", "project"]),
      roleCode: z.string().trim().min(1).max(100),
      roleName: z.string().trim().min(1).max(255),
      scopeType: z.enum(["company", "department", "project", "brand", "store"]),
      scopeId: z.string().trim().max(128).nullable().optional(),
      scopeLabel: z.string().trim().max(255).nullable().optional(),
      reviewerStaffId: z.number().int().positive().nullable().optional(),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return createPerformanceAssignment(resolved.db, resolved.access, input);
    }),

  createException: protectedProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      templateId: z.number().int().positive().nullable().optional(),
      exceptionType: z.enum(["leave", "system_outage", "cancelled", "responsibility_changed", "not_applicable"]),
      reason: z.string().trim().min(3).max(4000),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return createPerformanceException(resolved.db, resolved.access, input);
    }),

  createManualCandidate: protectedProcedure
    .input(z.object({
      staffId: z.number().int().positive(),
      itemId: z.number().int().positive().nullable().optional(),
      dimension: z.enum(["completion", "timeliness", "quality", "accuracy_closure", "initiative", "manager_evaluation"]),
      recommendedPoints: z.number().min(-20).max(20),
      reason: z.string().trim().min(5).max(4000),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return createManualScoreCandidate(resolved.db, resolved.access, input);
    }),

  reviewCandidate: protectedProcedure
    .input(z.object({
      candidateId: z.number().int().positive(),
      decision: z.enum(["approve", "reject"]),
      finalPoints: z.number().min(-20).max(20).nullable().optional(),
      reason: z.string().trim().min(3).max(4000),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return reviewScoreCandidate(resolved.db, resolved.access, input);
    }),

  submitAppeal: protectedProcedure
    .input(z.object({
      candidateId: z.number().int().positive().nullable().optional(),
      ledgerId: z.number().int().positive().nullable().optional(),
      managerReviewId: z.number().int().positive().nullable().optional(),
      statement: z.string().trim().min(5).max(10000),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return createPerformanceAppeal(resolved.db, resolved.access, input);
    }),

  resolveAppeal: protectedProcedure
    .input(z.object({
      appealId: z.number().int().positive(),
      decision: z.enum(["accept", "reject"]),
      resolution: z.string().trim().min(3).max(10000),
      requestId,
    }))
    .mutation(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return resolvePerformanceAppeal(resolved.db, resolved.access, input);
    }),

  audit: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).default({ limit: 100 }))
    .query(async ({ input, ctx }) => {
      const resolved = await context(ctx);
      return getPerformanceAudit(resolved.db, resolved.access, input.limit);
    }),
});
