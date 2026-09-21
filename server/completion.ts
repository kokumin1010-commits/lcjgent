import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { tasks } from "../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const completionRouter = router({
  /**
   * Backward-compatible resolver for legacy email links.
   * A shared task token must never complete a per-assignee task. It only resolves
   * the internal task id so the user can log in and submit their own feedback.
   */
  completeByToken: publicProcedure
    .input(z.object({ token: z.string().min(1, "トークンが必要です") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "データベースに接続できません",
        });
      }

      const taskList = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.completionToken, input.token), isNull(tasks.archivedAt)))
        .limit(1);

      if (taskList.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "無効なトークンです" });
      }

      return {
        success: true,
        requiresLogin: true,
        taskId: taskList[0].id,
      };
    }),
});
