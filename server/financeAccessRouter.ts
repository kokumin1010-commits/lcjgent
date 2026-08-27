import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { createActivityLog } from "./db";
import {
  hasFinanceAccess,
  lockFinanceAccess,
  verifyAndUnlockFinance,
} from "./financeAccess";

async function logFinanceAccess(ctx: any, action: "unlock" | "lock") {
  try {
    await createActivityLog({
      userId: Number(ctx.user.id),
      actionType: `finance_access_${action}`,
      actionLabel: action === "unlock" ? "财务管理密码验证成功" : "财务管理已重新锁定",
      targetType: "finance_access",
      targetId: Number(ctx.user.id),
      targetName: "财务管理",
      metadata: { module: "finance", action },
    });
  } catch {
    // Access must not fail only because the auxiliary activity log is unavailable.
  }
}

export const financeAccessRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => ({
    unlocked: await hasFinanceAccess(ctx),
  })),

  unlock: protectedProcedure
    .input(z.object({ password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const result = await verifyAndUnlockFinance(ctx, input.password);
      await logFinanceAccess(ctx, "unlock");
      return result;
    }),

  lock: protectedProcedure.mutation(async ({ ctx }) => {
    const result = lockFinanceAccess(ctx);
    await logFinanceAccess(ctx, "lock");
    return result;
  }),
});
