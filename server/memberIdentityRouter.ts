import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import { getMemberIdentityActionLogs, getMemberIdentityById, getMemberIdentityDirectory, getMemberIdentityStatistics } from './memberIdentityService';
import { getMemberIdentityUpgradeHealth } from './memberIdentityUpgrade';

export const memberIdentityRouter = router({
  directory: protectedProcedure.query(() => getMemberIdentityDirectory()),
  statistics: protectedProcedure.query(() => getMemberIdentityStatistics()),
  getMember: protectedProcedure.input(z.object({ memberId: z.number().int().positive() })).query(({ input }) => getMemberIdentityById(input.memberId)),
  getMemberAudit: protectedProcedure.input(z.object({ memberId: z.number().int().positive() })).query(async ({ input }) => ({
    memberId: input.memberId,
    logs: await getMemberIdentityActionLogs(input.memberId),
  })),
  health: protectedProcedure.query(() => getMemberIdentityUpgradeHealth()),
});
