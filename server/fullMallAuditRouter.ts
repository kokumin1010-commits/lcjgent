import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getFullMallAuditSnapshot } from "./fullMallAudit";

export const fullMallAuditRouter = router({
  snapshot: publicProcedure
    .input(
      z.object({
        key: z.literal("1ab26c09d9e9609d0853111965acf4c18ab0483edcc65c2f"),
      })
    )
    .query(async () => getFullMallAuditSnapshot()),
});
