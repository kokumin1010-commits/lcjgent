import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { requireBrandDataMutation, requireBrandDataView } from "./brandDataAccess";
import {
  createManualBrandHistoricalGmv,
  deleteManualBrandHistoricalGmv,
  listBrandHistoricalGmv,
  updateManualBrandHistoricalGmv,
} from "./brandHistoricalGmvService";

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const manualPayload = z.object({
  amount: z.number().finite().positive().max(9_000_000_000_000),
  sourceLabel: z.string().trim().min(1).max(255),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  notes: z.string().max(10000).nullable().optional(),
});

function actor(ctx: any) {
  return { id: Number(ctx.user.id), name: ctx.user.name || ctx.user.email || null };
}

function toTrpcError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  const message = error instanceof Error ? error.message : "historical GMV operation failed";
  throw new TRPCError({
    code: message.includes("not found") ? "NOT_FOUND" : message.includes("cannot be") ? "FORBIDDEN" : "BAD_REQUEST",
    message,
  });
}

export const brandHistoricalGmvRouter = router({
  list: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBrandDataView(ctx);
      try {
        return await listBrandHistoricalGmv(input.brandId);
      } catch (error) {
        toTrpcError(error);
      }
    }),

  create: protectedProcedure
    .input(manualPayload.extend({ brandId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBrandDataMutation(ctx);
      try {
        return await createManualBrandHistoricalGmv(input, actor(ctx));
      } catch (error) {
        toTrpcError(error);
      }
    }),

  update: protectedProcedure
    .input(manualPayload.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBrandDataMutation(ctx);
      try {
        const { id, ...payload } = input;
        return await updateManualBrandHistoricalGmv(id, payload, actor(ctx));
      } catch (error) {
        toTrpcError(error);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBrandDataMutation(ctx);
      try {
        return await deleteManualBrandHistoricalGmv(input.id, actor(ctx));
      } catch (error) {
        toTrpcError(error);
      }
    }),
});
