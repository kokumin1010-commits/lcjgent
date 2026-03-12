/**
 * Lessons Learned Router - AI自動進化システム
 *
 * このファイルは独立して管理される。
 * routers.tsの変更で消失しないよう、分離されている。
 *
 * 【重要】このファイルを削除・変更する場合は、
 * Lessons Learnedシステムが壊れるため、十分注意すること。
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  registerLesson,
  getAllActiveLessons,
  getLessonsByFeature,
  getAiContext,
  deactivateLesson,
  getLessonStats,
} from "./lessonsHelper";

export const lessonsRouter = router({
  // AI Context取得（新セッション開始時に呼ぶ）
  aiContext: publicProcedure.query(async () => {
    return getAiContext();
  }),
  // 全アクティブレッスン取得
  getAll: protectedProcedure.query(async () => {
    return getAllActiveLessons();
  }),
  // 機能別レッスン取得
  getByFeature: protectedProcedure
    .input(z.object({ feature: z.string() }))
    .query(async ({ input }) => {
      return getLessonsByFeature(input.feature);
    }),
  // 統計取得
  getStats: protectedProcedure.query(async () => {
    return getLessonStats();
  }),
  // レッスン登録（Manus自動登録用）
  register: publicProcedure
    .input(
      z.object({
        category: z.enum([
          "danger", "lesson", "dependency", "rule", "status",
          "checklist", "preference", "bugfix", "workflow",
        ]),
        severity: z.enum(["critical", "warning", "info"]).optional(),
        title: z.string().min(1),
        content: z.string().min(1),
        compactRule: z.string().optional(),
        checkPattern: z.string().optional(),
        relatedFeature: z.string().optional(),
        relatedFiles: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await registerLesson(input);
      return { success: true, id };
    }),
  // レッスン無効化
  deactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deactivateLesson(input.id);
      return { success: true };
    }),
});
