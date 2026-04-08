import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getAllStreamingLocations,
  getActiveStreamingLocations,
  getStreamingLocationById,
  createStreamingLocation,
  updateStreamingLocation,
  deleteStreamingLocation,
} from "./db";

/**
 * Streaming Location Router
 * 配信場所マスタの管理API
 * 
 * 機能:
 * - 配信場所の一覧取得（アクティブのみ / 全件）
 * - 配信場所の作成・更新・削除
 */
export const locationRouter = router({
  // アクティブな配信場所一覧を取得（フロントエンド用）
  getActive: publicProcedure.query(async () => {
    return await getActiveStreamingLocations();
  }),

  // 全配信場所一覧を取得（管理画面用）
  getAll: publicProcedure.query(async () => {
    return await getAllStreamingLocations();
  }),

  // 配信場所を作成
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "場所名は必須です"),
        address: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await createStreamingLocation({
        name: input.name,
        address: input.address,
        color: input.color || "#3B82F6",
        sortOrder: input.sortOrder || 0,
      });
    }),

  // 配信場所を更新
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await updateStreamingLocation(id, data);
    }),

  // 配信場所を削除（ソフトデリート: isActive=false）
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await updateStreamingLocation(input.id, { isActive: false });
    }),
});
