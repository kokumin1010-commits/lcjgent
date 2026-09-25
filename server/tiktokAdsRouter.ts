import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getTikTokAdsDashboard, getTikTokAdsWriteReadiness } from "./tiktokAdsConnector";
import {
  getTikTokAdsPageAccess,
  requireTikTokAdsOperateAccess,
  requireTikTokAdsPageAccess,
} from "./tiktokAdsAccess";
import {
  executeTikTokAdsOperation,
  getTikTokAdsOperationConfirmationText,
  listTikTokAdsOperations,
  previewTikTokAdsOperation,
  TikTokAdsOperationError,
} from "./tiktokAdsOperations";
import { ensureTikTokAdsOperationsReady } from "./tiktokAdsOperationsUpgrade";

const entityType = z.enum(["campaign", "adgroup", "ad"]);
const statusValue = z.enum(["ENABLE", "DISABLE"]);
const operationIntent = z.discriminatedUnion("action", [
  z.object({
    entityType,
    entityId: z.string().regex(/^\d{6,32}$/),
    action: z.literal("status"),
    operationStatus: statusValue,
    reason: z.string().trim().min(8).max(500),
  }),
  z.object({
    entityType: z.enum(["campaign", "adgroup"]),
    entityId: z.string().regex(/^\d{6,32}$/),
    action: z.literal("budget"),
    budget: z.number().finite().min(1000).max(10_000_000),
    reason: z.string().trim().min(8).max(500),
  }),
]);

function safeOperationError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof TikTokAdsOperationError) {
    throw new TRPCError({
      code: error.needsReconciliation ? "CONFLICT" : "PRECONDITION_FAILED",
      message: error.safeCode,
    });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TIKTOK_OPERATION_FAILED" });
}

export const tiktokAdsRouter = router({
  access: protectedProcedure.query(async ({ ctx }) => {
    const access = await getTikTokAdsPageAccess(ctx.user);
    return {
      ...access,
      ...getTikTokAdsWriteReadiness(),
      confirmationText: getTikTokAdsOperationConfirmationText(),
    };
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    await requireTikTokAdsPageAccess(ctx.user);
    return getTikTokAdsDashboard();
  }),

  operationHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      await requireTikTokAdsOperateAccess(ctx.user);
      await ensureTikTokAdsOperationsReady();
      return listTikTokAdsOperations(input?.limit ?? 50);
    }),

  previewOperation: protectedProcedure
    .input(operationIntent)
    .mutation(async ({ ctx, input }) => {
      try {
        await requireTikTokAdsOperateAccess(ctx.user);
        await ensureTikTokAdsOperationsReady();
        return await previewTikTokAdsOperation({
          actorUserId: ctx.user.id,
          actorName: ctx.user.name ?? null,
          intent: input,
        });
      } catch (error) {
        return safeOperationError(error);
      }
    }),

  executeOperation: protectedProcedure
    .input(z.object({
      operationId: z.string().uuid(),
      confirmationToken: z.string().min(32).max(4096),
      confirmationText: z.string().max(32),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await requireTikTokAdsOperateAccess(ctx.user);
        await ensureTikTokAdsOperationsReady();
        return await executeTikTokAdsOperation({
          actorUserId: ctx.user.id,
          ...input,
        });
      } catch (error) {
        return safeOperationError(error);
      }
    }),
});
