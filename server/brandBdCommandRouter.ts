import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  BRAND_BD_AI_ANALYSIS_TYPES,
  BRAND_BD_INTERACTION_TYPES,
} from "../shared/brandBdCommand";
import {
  createBrandBdInteraction,
  createBrandBdMeeting,
  generateBrandBdAiAnalysis,
  getBrandBdCommandBrand,
  getBrandBdCommandOverview,
  requireBrandBdCommandAccess,
  updateBrandBdMeetingStatus,
} from "./brandBdCommandService";
import { saveBrandBusinessDeal } from "./brandBusinessService";
import {
  BRAND_BD_STAGE_VALUES,
  BRAND_DEAL_MODEL_VALUES,
} from "../shared/brandBusiness";

function actor(ctx: any) {
  return {
    id: Number(ctx.user.id),
    email: ctx.user.email || null,
    name: ctx.user.name || ctx.user.email || `user:${ctx.user.id}`,
  };
}

export const brandBdCommandRouter = router({
  overview: protectedProcedure.query(({ ctx }) =>
    getBrandBdCommandOverview(actor(ctx))
  ),

  brand: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      getBrandBdCommandBrand(actor(ctx), input.brandId)
    ),

  createInteraction: protectedProcedure
    .input(
      z.object({
        brandId: z.number().int().positive(),
        interactionType: z.enum(BRAND_BD_INTERACTION_TYPES),
        occurredAt: z.string().min(1).max(64),
        summary: z.string().trim().min(1).max(500),
        details: z.string().max(30_000).nullish(),
        outcome: z.string().max(10_000).nullish(),
        nextAction: z.string().max(10_000).nullish(),
        nextFollowUpAt: z.string().max(64).nullish(),
        contactPerson: z.string().max(255).nullish(),
        ownerStaffId: z.number().int().positive().nullish(),
      })
    )
    .mutation(({ ctx, input }) => createBrandBdInteraction(input, actor(ctx))),

  saveDeal: protectedProcedure
    .input(
      z.object({
        brandId: z.number().int().positive(),
        stage: z.enum(BRAND_BD_STAGE_VALUES),
        dealModel: z.enum(BRAND_DEAL_MODEL_VALUES).nullish(),
        slotFeeAmount: z.number().nonnegative().nullish(),
        guaranteedRoi: z.number().positive().nullish(),
        pureCommissionRate: z.number().min(0).max(100).nullish(),
        nextFollowUpAt: z.string().max(64).nullish(),
        nextAction: z.string().max(10_000).nullish(),
        negotiationNotes: z.string().max(30_000).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireBrandBdCommandAccess(actor(ctx), input.brandId);
      return saveBrandBusinessDeal(
        { ...input, lastContactAt: null },
        actor(ctx)
      );
    }),

  createMeeting: protectedProcedure
    .input(
      z.object({
        brandId: z.number().int().positive(),
        requestId: z.string().uuid(),
        title: z.string().trim().min(1).max(500),
        startsAt: z.string().min(1).max(64),
        endsAt: z.string().max(64).nullish(),
        location: z.string().max(500).nullish(),
        agenda: z.string().max(10_000).nullish(),
        ownerStaffId: z.number().int().positive(),
        attendeeStaffIds: z
          .array(z.number().int().positive())
          .max(100)
          .default([]),
        notifyBosses: z.boolean().default(true),
        reminderMinutesBefore: z.number().int().min(5).max(10_080).default(60),
      })
    )
    .mutation(({ ctx, input }) => createBrandBdMeeting(input, actor(ctx))),

  updateMeetingStatus: protectedProcedure
    .input(
      z.object({
        brandId: z.number().int().positive(),
        meetingId: z.number().int().positive(),
        status: z.enum(["completed", "cancelled"]),
      })
    )
    .mutation(({ ctx, input }) =>
      updateBrandBdMeetingStatus(actor(ctx), input)
    ),

  generateAi: protectedProcedure
    .input(
      z.object({
        brandId: z.number().int().positive().nullish(),
        analysisType: z.enum(BRAND_BD_AI_ANALYSIS_TYPES),
      })
    )
    .mutation(({ ctx, input }) => generateBrandBdAiAnalysis(actor(ctx), input)),
});
