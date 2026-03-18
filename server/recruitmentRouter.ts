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
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { recruitmentBrands, recruitmentStatusHistory, staff, brands } from "../drizzle/schema";
import { eq, desc, and, sql, isNull, inArray, between, like, or, asc, count } from "drizzle-orm";
import { ENV } from "./_core/env";

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
        conditions.push(inArray(recruitmentBrands.brandType, input.brandTypes));
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

      const whereClause = and(...conditions);

      // カウント
      const [countResult] = await db.select({ total: count() })
        .from(recruitmentBrands)
        .where(whereClause);
      const total = countResult?.total ?? 0;

      // ソート
      const sortCol = (() => {
        switch (input.sortBy) {
          case "brand_name": return recruitmentBrands.brandName;
          case "brand_type": return recruitmentBrands.brandType;
          case "status": return recruitmentBrands.status;
          case "last_followed_at": return recruitmentBrands.lastFollowedAt;
          default: return recruitmentBrands.createdAt;
        }
      })();
      const orderFn = input.sortOrder === "asc" ? asc : desc;

      // データ取得
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db.select()
        .from(recruitmentBrands)
        .where(whereClause)
        .orderBy(orderFn(sortCol))
        .limit(input.pageSize)
        .offset(offset);

      // 担当者名を結合
      const personIds = [...new Set(rows.map(r => r.personInCharge).filter(Boolean))] as number[];
      let staffMap: Record<number, string> = {};
      if (personIds.length > 0) {
        const staffRows = await db.select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, personIds));
        staffMap = Object.fromEntries(staffRows.map(s => [s.id, s.name]));
      }

      const items = rows.map(r => ({
        ...r,
        personInChargeName: r.personInCharge ? staffMap[r.personInCharge] || "" : "",
        statusLabel: STATUS_LABELS[r.status] || r.status,
      }));

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),

  // ===== 6. 詳細取得 =====
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [brand] = await db.select()
        .from(recruitmentBrands)
        .where(and(eq(recruitmentBrands.id, input.id), isNull(recruitmentBrands.deletedAt)));

      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "品牌不存在" });
      }

      // 担当者名
      let personName = "";
      if (brand.personInCharge) {
        const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, brand.personInCharge));
        personName = s?.name || "";
      }

      // ステータス履歴
      const history = await db.select()
        .from(recruitmentStatusHistory)
        .where(eq(recruitmentStatusHistory.recruitmentBrandId, input.id))
        .orderBy(desc(recruitmentStatusHistory.createdAt));

      // 履歴に操作者名を結合
      const changerIds = [...new Set(history.map(h => h.changedBy).filter(Boolean))] as number[];
      let changerMap: Record<number, string> = {};
      if (changerIds.length > 0) {
        const changerRows = await db.select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, changerIds));
        changerMap = Object.fromEntries(changerRows.map(s => [s.id, s.name]));
      }

      const historyWithNames = history.map(h => ({
        ...h,
        changedByName: h.changedBy ? changerMap[h.changedBy] || "" : "",
        oldStatusLabel: h.oldStatus ? STATUS_LABELS[h.oldStatus] || h.oldStatus : "",
        newStatusLabel: STATUS_LABELS[h.newStatus] || h.newStatus,
      }));

      return {
        ...brand,
        personInChargeName: personName,
        statusLabel: STATUS_LABELS[brand.status] || brand.status,
        history: historyWithNames,
      };
    }),

  // ===== 7. ステータスサマリー（ダッシュボード用） =====
  statusSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.select({
      status: recruitmentBrands.status,
      cnt: count(),
    })
      .from(recruitmentBrands)
      .where(isNull(recruitmentBrands.deletedAt))
      .groupBy(recruitmentBrands.status);

    const summary: Record<string, number> = {
      registered: 0, email_sent: 0, replied: 0, agreed: 0, cooperating: 0, rejected: 0,
    };
    for (const r of rows) {
      summary[r.status] = r.cnt;
    }
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    return { ...summary, total };
  }),

  // ===== 8. エクスポート用データ取得（全データ or フィルタ済み） =====
  exportData: protectedProcedure
    .input(z.object({
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

      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim().toLowerCase()}%`;
        conditions.push(sql`LOWER(${recruitmentBrands.brandName}) LIKE ${term}`);
      }
      if (input.statuses && input.statuses.length > 0) {
        conditions.push(inArray(recruitmentBrands.status, input.statuses as any));
      }
      if (input.brandTypes && input.brandTypes.length > 0) {
        conditions.push(inArray(recruitmentBrands.brandType, input.brandTypes));
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

      // 担当者名を結合
      const personIds = [...new Set(rows.map(r => r.personInCharge).filter(Boolean))] as number[];
      let staffMap: Record<number, string> = {};
      if (personIds.length > 0) {
        const staffRows = await db.select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, personIds));
        staffMap = Object.fromEntries(staffRows.map(s => [s.id, s.name]));
      }

      // ステータス履歴も取得
      const allIds = rows.map(r => r.id);
      let historyMap: Record<number, any[]> = {};
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

  // ===== 9. AI識別（画像/テキストから品牌情報を抽出） =====
  aiRecognize: protectedProcedure
    .input(z.object({
      imageUrl: z.string().optional(),
      text: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!input.imageUrl && !input.text) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请提供图片URL或文本" });
      }

      const systemPrompt = `你是一个品牌信息提取助手。从提供的内容中提取品牌信息，返回JSON数组格式。
每个品牌包含以下字段：
- brandName: 品牌名称（必填）
- brandType: 品牌类型（餐饮/零售/服务/娱乐/美容/健康/教育/科技/时尚/家居/食品/饮料/母婴/宠物/运动/其他）
- contactInfo: 联系方式（联系人+电话/邮箱）
- memo: 备注信息

只返回JSON数组，不要其他文字。如果无法识别任何品牌信息，返回空数组[]。`;

      const messages: any[] = [{ role: "system", content: systemPrompt }];

      if (input.imageUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: "请从这张图片中提取品牌信息：" },
            { type: "image_url", image_url: { url: input.imageUrl } },
          ],
        });
      } else if (input.text) {
        messages.push({
          role: "user",
          content: `请从以下文本中提取品牌信息：\n\n${input.text}`,
        });
      }

      try {
        const response = await fetch(ENV.BUILT_IN_FORGE_API_URL + "/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ENV.BUILT_IN_FORGE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("[AI Recognize] API error:", response.status, errText);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI识别失败" });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "[]";

        // JSONを抽出
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return { brands: [], raw: content };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return { brands: Array.isArray(parsed) ? parsed : [], raw: content };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        console.error("[AI Recognize] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI识别失败: " + err.message });
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
