import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  activateRoleDocument,
  currentTokyoMonth,
  getAdminOverview,
  getDocumentDownload,
  getDocumentPreview,
  getDepartmentRoleDocuments,
  getMyOverview,
  getStaffRoleDetail,
  reviewMonthlySubmission,
  saveReviewDraft,
  submitReview,
  updateRoleDocument,
  validateReviewMonth,
  requireHrRoleManagement,
} from "./hrRoleReviewService";
import { ensureHrRoleReviewSchema, getHrRoleReviewPool } from "./hrRoleReviewUpgrade";

const reviewMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const reviewText = z.string().max(20_000);
const reviewPayload = z.object({
  reviewMonth,
  focusGoals: reviewText,
  achievements: reviewText,
  metricsResult: reviewText,
  incompleteItems: reviewText,
  problemsAndRisks: reviewText,
  supportNeeded: reviewText,
  nextMonthPlan: reviewText,
});

export const hrRoleReviewRouter = router({
  health: protectedProcedure.query(async ({ ctx }) => {
    await requireHrRoleManagement(ctx.user);
    await ensureHrRoleReviewSchema();
    const pool = getHrRoleReviewPool();
    const [rows] = await pool.query("SELECT (SELECT COUNT(*) FROM hr_role_documents) AS documents,(SELECT COUNT(*) FROM hr_monthly_role_reviews) AS reviews,(SELECT COUNT(*) FROM hr_role_review_audit_logs) AS audits");
    return { ready: true, ...((rows as any[])[0] || {}) };
  }),

  myOverview: protectedProcedure
    .input(z.object({ reviewMonth: reviewMonth.optional() }).optional())
    .query(({ ctx, input }) => getMyOverview(ctx.user, input?.reviewMonth || currentTokyoMonth())),

  staffDetail: protectedProcedure
    .input(z.object({ staffId: z.number().int().positive(), reviewMonth: reviewMonth.optional() }))
    .query(({ ctx, input }) => getStaffRoleDetail(ctx.user, input.staffId, input.reviewMonth || currentTokyoMonth())),

  adminOverview: protectedProcedure
    .input(z.object({ reviewMonth: reviewMonth.optional() }).optional())
    .query(({ ctx, input }) => getAdminOverview(ctx.user, input?.reviewMonth || currentTokyoMonth())),

  departmentDocuments: protectedProcedure
    .query(({ ctx }) => getDepartmentRoleDocuments(ctx.user)),

  saveDraft: protectedProcedure
    .input(reviewPayload)
    .mutation(({ ctx, input }) => saveReviewDraft(ctx.user, input)),

  submit: protectedProcedure
    .input(reviewPayload)
    .mutation(({ ctx, input }) => submitReview(ctx.user, input)),

  review: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), decision: z.enum(["approve", "request_revision"]), comment: z.string().max(4000).optional() }))
    .mutation(({ ctx, input }) => reviewMonthlySubmission(ctx.user, input)),

  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().max(255).optional(),
      responsibilities: z.string().max(20_000).optional(),
      goalsAndMetrics: z.string().max(20_000).optional(),
      risks: z.string().max(20_000).optional(),
      supportNeeded: z.string().max(20_000).optional(),
      departmentSopContent: z.string().max(20_000).optional(),
    }))
    .mutation(({ ctx, input }) => updateRoleDocument(ctx.user, input)),

  activateDocument: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => activateRoleDocument(ctx.user, input.id)),

  documentPreview: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => getDocumentPreview(ctx.user, input.id)),

  documentDownload: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => getDocumentDownload(ctx.user, input.id)),

  validateMonth: protectedProcedure
    .input(z.object({ value: z.string() }))
    .query(({ input }) => ({ value: validateReviewMonth(input.value) })),
});
