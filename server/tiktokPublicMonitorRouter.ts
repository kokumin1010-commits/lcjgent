import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { resolveShortVideoDailyAccess } from "./shortVideoDailyRouter";
import { parseTikTokAccountLines } from "../shared/tiktokPublicMonitor";
import {
  getTikTokPublicDashboard,
  registerTikTokPublicAccounts,
  setTikTokPublicMonitoring,
  syncTikTokPublicAccount,
} from "./tiktokPublicMonitorService";
import { ensureTikTokPublicMonitorReady } from "./tiktokPublicMonitorUpgrade";

async function requireMonitorAccess(ctx: any, mode: "view" | "edit") {
  const access = await resolveShortVideoDailyAccess(ctx);
  if (mode === "view" ? !access.canView : !access.canEdit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "没有短视频监控权限 / 短動画モニタリング権限がありません",
    });
  }
  return access;
}

export const tiktokPublicMonitorRouter = router({
  dashboard: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }))
    .query(async ({ input, ctx }) => {
      await ensureTikTokPublicMonitorReady();
      const access = await requireMonitorAccess(ctx, "view");
      return { ...(await getTikTokPublicDashboard(input.month)), access };
    }),

  registerAccounts: protectedProcedure
    .input(z.object({ accounts: z.string().trim().min(1).max(20_000) }))
    .mutation(async ({ input, ctx }) => {
      await ensureTikTokPublicMonitorReady();
      await requireMonitorAccess(ctx, "edit");
      const usernames = parseTikTokAccountLines(input.accounts);
      if (!usernames.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "没有可识别的TikTok账号 / TikTokアカウントを認識できません",
        });
      if (usernames.length > 100)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "一次最多登记100个账号 / 一度に登録できるのは100件までです",
        });
      const result = await registerTikTokPublicAccounts(usernames);
      return { ...result, errors: [] as string[] };
    }),

  syncNow: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await ensureTikTokPublicMonitorReady();
      await requireMonitorAccess(ctx, "edit");
      const result = await syncTikTokPublicAccount(input.accountId, "manual");
      return {
        accountId: result.accountId,
        username: result.username,
        videoCount: result.updatedVideos,
        discovered: result.discoveredVideos,
        snapshotCount: result.updatedVideos + 1,
        nextSyncAt: result.nextSyncAt,
      };
    }),

  setMonitoring: protectedProcedure
    .input(
      z.object({ accountId: z.number().int().positive(), enabled: z.boolean() })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureTikTokPublicMonitorReady();
      await requireMonitorAccess(ctx, "edit");
      await setTikTokPublicMonitoring(input.accountId, input.enabled);
      return { success: true };
    }),
});
