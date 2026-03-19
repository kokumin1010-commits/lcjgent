/**
 * 招商管理ルーター (Recruitment Management Router)
 * 独立ファイル: server/recruitmentRouter.ts
 * 
 * 機能:
 * - 招商ブランド登記（手動 + AI識別 + バッチインポート）
 * - ステータス管理（registered → email_sent → replied → agreed → cooperating / rejected）
 * - フィルタリング・検索
 * - Excel/CSVエクスポート
 * - ステータス変更履歴
 * - 合作状態時にbrandsテーブルへ自動同期
 * - AI智能識別（テキスト + 画像Vision）
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { recruitmentBrands, recruitmentStatusHistory, staff, brands } from "../drizzle/schema";
import { eq, desc, and, sql, isNull, inArray, between, like, or, asc, count } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ステータス定義
const STATUS_LABELS: Record<string, string> = {
  registered: "已登记",
  email_sent: "已发送邮件",
  replied: "已收到回复",
  agreed: "同意",
  cooperating: "合作",
  rejected: "拒绝",
};

const BRAND_TYPES = [
  "餐饮", "零售", "服务", "娱乐", "美容", "健康", "教育", "科技",
  "时尚", "家居", "食品", "饮料", "母婴", "宠物", "运动", "其他"
];

export const recruitmentRouter = router({
  // ===== 1. ブランド登記 =====
  create: protectedProcedure
    .input(z.object({
      brandName: z.string().min(1, "品牌名称必填"),
      brandType: z.string().default(""),
      personInCharge: z.number().nullable().optional(),
      contactInfo: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [result] = await db.insert(recruitmentBrands).values({
        brandName: input.brandName,
        brandType: input.brandType,
        personInCharge: input.personInCharge ?? null,
        contactInfo: input.contactInfo || null,
        memo: input.memo || null,
        status: "registered",
        createdBy: ctx.user?.id ?? null,
      });
      const insertId = result.insertId;

      // 初回ステータス履歴
      await db.insert(recruitmentStatusHistory).values({
        recruitmentBrandId: insertId,
        oldStatus: null,
        newStatus: "registered",
        changedBy: ctx.user?.id ?? null,
        note: "品牌登记",
      });

      return { success: true, id: insertId };
    }),

  // ===== バッチ登記（Excel/CSVインポート用） =====
  batchCreate: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        brandName: z.string().min(1),
        brandType: z.string().default(""),
        personInCharge: z.number().nullable().optional(),
        contactInfo: z.string().optional(),
        memo: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      let created = 0;
      for (const item of input.items) {
        const [result] = await db.insert(recruitmentBrands).values({
          brandName: item.brandName,
          brandType: item.brandType,
          personInCharge: item.personInCharge ?? null,
          contactInfo: item.contactInfo || null,
          memo: item.memo || null,
          status: "registered",
          createdBy: ctx.user?.id ?? null,
        });
        await db.insert(recruitmentStatusHistory).values({
          recruitmentBrandId: result.insertId,
          oldStatus: null,
          newStatus: "registered",
          changedBy: ctx.user?.id ?? null,
          note: "批量导入",
        });
        created++;
      }
      return { success: true, created };
    }),

  // ===== 2. ブランド更新 =====
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      brandName: z.string().min(1).optional(),
      brandType: z.string().optional(),
      personInCharge: z.number().nullable().optional(),
      contactInfo: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const updateData: Record<string, any> = {};
      if (input.brandName !== undefined) updateData.brandName = input.brandName;
      if (input.brandType !== undefined) updateData.brandType = input.brandType;
      if (input.personInCharge !== undefined) updateData.personInCharge = input.personInCharge;
      if (input.contactInfo !== undefined) updateData.contactInfo = input.contactInfo;
      if (input.memo !== undefined) updateData.memo = input.memo;

      if (Object.keys(updateData).length > 0) {
        await db.update(recruitmentBrands)
          .set(updateData)
          .where(eq(recruitmentBrands.id, input.id));
      }
      return { success: true };
    }),

  // ===== 3. ステータス変更 =====
  changeStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      newStatus: z.enum(["registered", "email_sent", "replied", "agreed", "cooperating", "rejected"]),
      note: z.string().optional(),
      rejectReason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // 現在のステータスを取得
      const [current] = await db.select()
        .from(recruitmentBrands)
        .where(and(eq(recruitmentBrands.id, input.id), isNull(recruitmentBrands.deletedAt)));

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "品牌不存在" });
      }

      // ステータス更新
      const updateData: Record<string, any> = {
        status: input.newStatus,
        lastFollowedAt: new Date(),
      };
      if (input.newStatus === "rejected" && input.rejectReason) {
        updateData.rejectReason = input.rejectReason;
      }

      await db.update(recruitmentBrands)
        .set(updateData)
        .where(eq(recruitmentBrands.id, input.id));

      // ステータス履歴を記録
      await db.insert(recruitmentStatusHistory).values({
        recruitmentBrandId: input.id,
        oldStatus: current.status,
        newStatus: input.newStatus,
        changedBy: ctx.user?.id ?? null,
        note: input.note || `状态变更: ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[input.newStatus]}`,
      });

      // 合作状態の場合、brandsテーブルに自動同期
      if (input.newStatus === "cooperating") {
        try {
          await db.insert(brands).values({
            name: current.brandName,
            nameJa: current.brandName,
            category: current.brandType || null,
            contactPerson: current.contactInfo || null,
            status: "進行中",
            createdBy: ctx.user?.id ?? 1,
          });
        } catch (e) {
          console.error("[Recruitment] Failed to sync to brands table:", e);
        }
      }

      return { success: true };
    }),

  // ===== バッチステータス変更 =====
  batchChangeStatus: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()),
      newStatus: z.enum(["registered", "email_sent", "replied", "agreed", "cooperating", "rejected"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      let changed = 0;

      for (const id of input.ids) {
        const [current] = await db.select()
          .from(recruitmentBrands)
          .where(and(eq(recruitmentBrands.id, id), isNull(recruitmentBrands.deletedAt)));

        if (!current) continue;

        await db.update(recruitmentBrands)
          .set({ status: input.newStatus, lastFollowedAt: new Date() })
          .where(eq(recruitmentBrands.id, id));

        await db.insert(recruitmentStatusHistory).values({
          recruitmentBrandId: id,
          oldStatus: current.status,
          newStatus: input.newStatus,
          changedBy: ctx.user?.id ?? null,
          note: input.note || `批量状态变更`,
        });

        // 合作状態の場合、brandsテーブルに自動同期
        if (input.newStatus === "cooperating") {
          try {
            await db.insert(brands).values({
              name: current.brandName,
              nameJa: current.brandName,
              category: current.brandType || null,
              contactPerson: current.contactInfo || null,
              status: "進行中",
              createdBy: ctx.user?.id ?? 1,
            });
          } catch (e) {
            console.error("[Recruitment] Failed to sync to brands table:", e);
          }
        }

        changed++;
      }
      return { success: true, changed };
    }),

  // ===== 4. ソフトデリート =====
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.update(recruitmentBrands)
        .set({ deletedAt: new Date() })
        .where(eq(recruitmentBrands.id, input.id));
      return { success: true };
    }),

  // ===== バッチ削除 =====
  batchDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      for (const id of input.ids) {
        await db.update(recruitmentBrands)
          .set({ deletedAt: new Date() })
          .where(eq(recruitmentBrands.id, id));
      }
      return { success: true, deleted: input.ids.length };
    }),

  // ===== 5. リスト取得（フィルタ・ページネーション・ソート） =====
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      sortBy: z.string().default("created_at"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      // フィルタ
      search: z.string().optional(),
      statuses: z.array(z.string()).optional(),
      brandTypes: z.array(z.string()).optional(),
      personInChargeIds: z.array(z.number()).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions: any[] = [isNull(recruitmentBrands.deletedAt)];

      // テキスト検索
      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim().toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${recruitmentBrands.brandName}) LIKE ${term}`,
            sql`LOWER(${recruitmentBrands.contactInfo}) LIKE ${term}`,
            sql`LOWER(${recruitmentBrands.memo}) LIKE ${term}`,
          )
        );
      }

      // ステータスフィルタ
      if (input.statuses && input.statuses.length > 0) {
        conditions.push(inArray(recruitmentBrands.status, input.statuses as any));
      }

      // ブランドタイプフィルタ
      if (input.brandTypes && input.brandTypes.length > 0) {
        conditions.push(inArray(recruitmentBrands.brandType, input.brandTypes as any));
      }

      // 担当者フィルタ
      if (input.personInChargeIds && input.personInChargeIds.length > 0) {
        conditions.push(inArray(recruitmentBrands.personInCharge, input.personInChargeIds));
      }

      // 日付フィルタ
      if (input.dateFrom) {
        conditions.push(sql`${recruitmentBrands.createdAt} >= ${input.dateFrom}`);
      }
      if (input.dateTo) {
        conditions.push(sql`${recruitmentBrands.createdAt} <= ${input.dateTo + " 23:59:59"}`);
      }

      // カウント
      const [{ cnt }] = await db.select({ cnt: count() })
        .from(recruitmentBrands)
        .where(and(...conditions));

      // ソート
      const sortCol = input.sortBy === "brand_name" ? recruitmentBrands.brandName
        : input.sortBy === "status" ? recruitmentBrands.status
        : input.sortBy === "last_followed_at" ? recruitmentBrands.lastFollowedAt
        : recruitmentBrands.createdAt;
      const orderFn = input.sortOrder === "asc" ? asc : desc;

      // データ取得
      const rows = await db.select()
        .from(recruitmentBrands)
        .where(and(...conditions))
        .orderBy(orderFn(sortCol))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      // 担当者名を取得
      const staffIds = [...new Set(rows.map(r => r.personInCharge).filter(Boolean))] as number[];
      const staffMap: Record<number, string> = {};
      if (staffIds.length > 0) {
        const staffRows = await db.select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, staffIds));
        for (const s of staffRows) {
          staffMap[s.id] = s.name;
        }
      }

      return {
        items: rows.map(r => ({
          id: r.id,
          brandName: r.brandName,
          brandType: r.brandType,
          personInCharge: r.personInCharge,
          personInChargeName: r.personInCharge ? staffMap[r.personInCharge] || "" : "",
          status: r.status,
          statusLabel: STATUS_LABELS[r.status] || r.status,
          contactInfo: r.contactInfo || "",
          memo: r.memo || "",
          rejectReason: r.rejectReason || "",
          createdAt: r.createdAt,
          lastFollowedAt: r.lastFollowedAt,
        })),
        total: Number(cnt),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ===== 6. 詳細取得（ステータス履歴付き） =====
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [row] = await db.select()
        .from(recruitmentBrands)
        .where(and(eq(recruitmentBrands.id, input.id), isNull(recruitmentBrands.deletedAt)));

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "品牌不存在" });
      }

      // ステータス履歴
      const history = await db.select()
        .from(recruitmentStatusHistory)
        .where(eq(recruitmentStatusHistory.recruitmentBrandId, input.id))
        .orderBy(desc(recruitmentStatusHistory.createdAt));

      // 担当者名
      let personName = "";
      if (row.personInCharge) {
        const [s] = await db.select({ name: staff.name })
          .from(staff)
          .where(eq(staff.id, row.personInCharge));
        personName = s?.name || "";
      }

      // 履歴の担当者名
      const changedByIds = [...new Set(history.map(h => h.changedBy).filter(Boolean))] as number[];
      const changedByMap: Record<number, string> = {};
      if (changedByIds.length > 0) {
        const staffRows = await db.select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, changedByIds));
        for (const s of staffRows) {
          changedByMap[s.id] = s.name;
        }
      }

      return {
        ...row,
        personInChargeName: personName,
        statusLabel: STATUS_LABELS[row.status] || row.status,
        history: history.map(h => ({
          ...h,
          oldStatusLabel: h.oldStatus ? STATUS_LABELS[h.oldStatus] || h.oldStatus : null,
          newStatusLabel: STATUS_LABELS[h.newStatus] || h.newStatus,
          changedByName: h.changedBy ? changedByMap[h.changedBy] || "" : "",
        })),
      };
    }),

  // ===== 7. ステータスサマリー =====
  statusSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.select({
      status: recruitmentBrands.status,
      cnt: count(),
    })
      .from(recruitmentBrands)
      .where(isNull(recruitmentBrands.deletedAt))
      .groupBy(recruitmentBrands.status);

    const summary: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      summary[r.status] = Number(r.cnt);
      total += Number(r.cnt);
    }
    return { ...summary, total };
  }),

  // ===== 8. エクスポート用データ =====
  exportData: protectedProcedure
    .input(z.object({
      statuses: z.array(z.string()).optional(),
      search: z.string().optional(),
      brandTypes: z.array(z.string()).optional(),
      personInChargeIds: z.array(z.number()).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions: any[] = [isNull(recruitmentBrands.deletedAt)];
      if (input.statuses && input.statuses.length > 0) {
        conditions.push(inArray(recruitmentBrands.status, input.statuses as any));
      }
      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim().toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${recruitmentBrands.brandName}) LIKE ${term}`,
            sql`LOWER(${recruitmentBrands.contactInfo}) LIKE ${term}`,
          )
        );
      }
      if (input.brandTypes && input.brandTypes.length > 0) {
        conditions.push(inArray(recruitmentBrands.brandType, input.brandTypes as any));
      }
      if (input.personInChargeIds && input.personInChargeIds.length > 0) {
        conditions.push(inArray(recruitmentBrands.personInCharge, input.personInChargeIds));
      }
      if (input.dateFrom) {
        conditions.push(sql`${recruitmentBrands.createdAt} >= ${input.dateFrom}`);
      }
      if (input.dateTo) {
        conditions.push(sql`${recruitmentBrands.createdAt} <= ${input.dateTo + " 23:59:59"}`);
      }

      const rows = await db.select()
        .from(recruitmentBrands)
        .where(and(...conditions))
        .orderBy(desc(recruitmentBrands.createdAt));

      // 担当者名マップ
      const staffIds = [...new Set(rows.map(r => r.personInCharge).filter(Boolean))] as number[];
      const staffMap: Record<number, string> = {};
      if (staffIds.length > 0) {
        const staffRows = await db.select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, staffIds));
        for (const s of staffRows) {
          staffMap[s.id] = s.name;
        }
      }

      // ステータス履歴も取得
      const allIds = rows.map(r => r.id);
      const historyMap: Record<number, any[]> = {};
      if (allIds.length > 0) {
        const allHistory = await db.select()
          .from(recruitmentStatusHistory)
          .where(inArray(recruitmentStatusHistory.recruitmentBrandId, allIds))
          .orderBy(desc(recruitmentStatusHistory.createdAt));
        for (const h of allHistory) {
          if (!historyMap[h.recruitmentBrandId]) historyMap[h.recruitmentBrandId] = [];
          historyMap[h.recruitmentBrandId].push(h);
        }
      }

      return rows.map(r => ({
        id: r.id,
        brandName: r.brandName,
        brandType: r.brandType,
        personInChargeName: r.personInCharge ? staffMap[r.personInCharge] || "" : "",
        status: r.status,
        statusLabel: STATUS_LABELS[r.status] || r.status,
        contactInfo: r.contactInfo || "",
        memo: r.memo || "",
        rejectReason: r.rejectReason || "",
        createdAt: r.createdAt,
        lastFollowedAt: r.lastFollowedAt,
        historyCount: historyMap[r.id]?.length || 0,
      }));
    }),

  // ===== 9. AI識別（テキスト + 画像Vision対応） =====
  aiRecognize: protectedProcedure
    .input(z.object({
      imageUrls: z.array(z.string()).optional(),  // 複数画像対応
      imageUrl: z.string().optional(),             // 後方互換
      text: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // 画像URLリストを構築
      const allImageUrls: string[] = [];
      if (input.imageUrls && input.imageUrls.length > 0) {
        allImageUrls.push(...input.imageUrls);
      } else if (input.imageUrl) {
        allImageUrls.push(input.imageUrl);
      }

      if (allImageUrls.length === 0 && !input.text) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请提供图片或文本" });
      }

      const systemPrompt = `你是一个品牌信息提取助手。从提供的内容中提取品牌信息，返回JSON数组格式。
每个品牌包含以下字段：
- brandName: 品牌名称（必填）
- brandType: 品牌类型（餐饮/零售/服务/娱乐/美容/健康/教育/科技/时尚/家居/食品/饮料/母婴/宠物/运动/其他）
- contactInfo: 联系方式（联系人+电话/邮箱）
- memo: 备注信息

只返回JSON数组，不要其他文字。如果无法识别任何品牌信息，返回空数组[]。
请仔细分析图片中的所有文字、logo、名片信息等，尽可能多地提取品牌信息。`;

      const messages: any[] = [{ role: "system", content: systemPrompt }];

      if (allImageUrls.length > 0) {
        // 画像Vision対応
        const content: any[] = [
          { type: "text", text: `请从以下${allImageUrls.length}张图片中提取品牌信息：` },
        ];
        for (const url of allImageUrls) {
          content.push({ type: "image_url", image_url: { url } });
        }
        if (input.text) {
          content.push({ type: "text", text: `\n补充文本信息：\n${input.text}` });
        }
        messages.push({ role: "user", content });
      } else if (input.text) {
        messages.push({
          role: "user",
          content: `请从以下文本中提取品牌信息：\n\n${input.text}`,
        });
      }

      try {
        const result = await invokeLLM({ messages });
        const content = result.choices?.[0]?.message?.content || "[]";

        // JSONを抽出
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return { brands: [], raw: content };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return { brands: Array.isArray(parsed) ? parsed : [], raw: content };
      } catch (err: any) {
        console.error("[AI Recognize] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI识别失败: " + (err.message || "未知错误").substring(0, 200),
        });
      }
    }),

  // ===== 10. 担当者リスト（ドロップダウン用） =====
  getStaffList: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.select({ id: staff.id, name: staff.name })
      .from(staff)
      .where(eq(staff.isActive, "active"))
      .orderBy(asc(staff.name));
    return rows;
  }),

  // ===== 11. ブランドタイプリスト =====
  getBrandTypes: protectedProcedure.query(async () => {
    return BRAND_TYPES;
  }),
});
