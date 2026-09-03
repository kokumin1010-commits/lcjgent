import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { mergeEmailAndLineMemberAccounts } from "./memberAccountMergeService";
import { recoverMemberPointsAndHeldReceipts } from "./memberPointReceiptRecoveryService";
import {
  getMemberIdentityActionLogs,
  getMemberIdentityById,
  getMemberIdentityDirectory,
  getMemberIdentityStatistics,
} from "./memberIdentityService";
import { getMemberIdentityUpgradeHealth } from "./memberIdentityUpgrade";
import { assertMemberActionAllowed } from "./memberRestrictionService";

export const memberIdentityRouter = router({
  directory: protectedProcedure.query(() => getMemberIdentityDirectory()),
  statistics: protectedProcedure.query(() => getMemberIdentityStatistics()),
  getMember: protectedProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .query(({ input }) => getMemberIdentityById(input.memberId)),
  getMemberAudit: protectedProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .query(async ({ input }) => ({
      memberId: input.memberId,
      logs: await getMemberIdentityActionLogs(input.memberId),
    })),
  health: protectedProcedure.query(() => getMemberIdentityUpgradeHealth()),
  mergeEmailAndLineAccounts: protectedProcedure
    .input(
      z.object({
        targetEmailMemberId: z.number().int().positive(),
        sourceLineMemberId: z.number().int().positive(),
        expectedEmail: z.string().email().max(320),
        expectedLineUserId: z.string().regex(/^U[0-9A-Fa-f]{32}$/),
        expectedTargetBalance: z.number().int().nonnegative(),
        expectedSourceBalance: z.number().int().nonnegative(),
        allowPendingEmailClaim: z.boolean().optional(),
        expectedTargetDisplayName: z.string().trim().min(1).max(255).optional(),
        expectedSourceDisplayName: z.string().trim().min(1).max(255).optional(),
        reason: z.string().trim().min(10).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "管理者権限が必要です",
        });
      }
      await assertMemberActionAllowed(input.targetEmailMemberId, [
        "points",
        "order",
      ]);
      await assertMemberActionAllowed(input.sourceLineMemberId, [
        "points",
        "order",
      ]);
      try {
        return await mergeEmailAndLineMemberAccounts({
          ...input,
          actorId: ctx.user.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isPrecondition =
          /changed|already|must|required|invalid|mismatch|not allowed|differ/i.test(
            message
          );
        throw new TRPCError({
          code: isPrecondition
            ? "PRECONDITION_FAILED"
            : "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
  recoverLegacyPointsAndHeldReceipts: protectedProcedure
    .input(
      z.object({
        memberId: z.number().int().positive(),
        expectedLineUserId: z.string().regex(/^U[0-9A-Fa-f]{32}$/),
        expectedBalance: z.number().int().positive(),
        expectedOpeningTransactionId: z.number().int().positive(),
        expectedOpeningAmount: z.number().int().positive(),
        expectedHeldReceiptIds: z
          .array(z.number().int().positive())
          .min(1)
          .max(200),
        expectedRejectedReceiptCount: z.number().int().nonnegative(),
        confirmation: z.literal(
          "RESTORE_VALID_POINTS_AND_RELEASE_HELD_RECEIPTS"
        ),
        reason: z.string().trim().min(10).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "管理者権限が必要です",
        });
      }
      await assertMemberActionAllowed(input.memberId, ["points", "receipt"]);
      try {
        const { confirmation: _confirmation, ...recoveryInput } = input;
        return await recoverMemberPointsAndHeldReceipts({
          ...recoveryInput,
          actorId: ctx.user.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isPrecondition =
          /changed|already|must|required|invalid|mismatch|not found|missing|stopped|does not match/i.test(
            message
          );
        throw new TRPCError({
          code: isPrecondition
            ? "PRECONDITION_FAILED"
            : "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
