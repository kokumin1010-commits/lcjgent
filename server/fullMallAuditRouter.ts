import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getFullMallAuditSnapshot } from "./fullMallAudit";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const fullMallAuditRouter = router({
  snapshot: publicProcedure
    .input(
      z.object({
        key: z.literal("1ab26c09d9e9609d0853111965acf4c18ab0483edcc65c2f"),
      })
    )
    .query(async () => getFullMallAuditSnapshot()),
  preRecoveryBackup: publicProcedure
    .input(
      z.object({
        key: z.literal("1ab26c09d9e9609d0853111965acf4c18ab0483edcc65c2f"),
      })
    )
    .mutation(async () => {
      await runDatabaseBackup("pre-mall-points-v1", {
        force: true,
        waitForActive: true,
      });
      return { success: true };
    }),
});
