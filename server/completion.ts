import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { tasks } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";

export const completionRouter = router({
  /**
   * Complete a task using a one-click completion token
   * This endpoint is public and doesn't require authentication
   */
  completeByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "トークンが必要です"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "データベースに接続できません",
        });
      }

      // Find task by completion token
      const taskList = await db
        .select()
        .from(tasks)
        .where(eq(tasks.completionToken, input.token))
        .limit(1);

      if (taskList.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "無効なトークンです",
        });
      }

      const task = taskList[0];

      // Check if already completed
      if (task.status === "completed") {
        return {
          success: true,
          message: "このタスクは既に完了しています",
          alreadyCompleted: true,
        };
      }

      // Update task status to completed
      await db
        .update(tasks)
        .set({
          status: "completed",
          completedAt: Date.now(),
        })
        .where(eq(tasks.id, task.id));

      // Notify owner
      try {
        await notifyOwner({
          title: "タスク完了通知",
          content: `タスク「${task.taskDetail}」が完了しました。\n\nタスクID: ${task.taskId}\n完了日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
        });
      } catch (error) {
        console.error("[Completion] Failed to notify owner:", error);
        // Don't fail the completion if notification fails
      }

      return {
        success: true,
        message: "タスクを完了しました",
        alreadyCompleted: false,
        task: {
          id: task.id,
          taskId: task.taskId,
          taskDetail: task.taskDetail,
        },
      };
    }),
});
