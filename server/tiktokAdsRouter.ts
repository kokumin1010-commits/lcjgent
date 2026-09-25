import { router, protectedProcedure } from "./_core/trpc";
import { getTikTokAdsDashboard } from "./tiktokAdsConnector";
import { requireTikTokAdsPageAccess } from "./tiktokAdsAccess";

export const tiktokAdsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    await requireTikTokAdsPageAccess(ctx.user);
    return await getTikTokAdsDashboard();
  }),
});
