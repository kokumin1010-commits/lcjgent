import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { adFormSubmissions } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const adFormRouter = router({
  // 公開: LP申込フォーム送信
  submit: publicProcedure
    .input(z.object({
      companyName: z.string().min(1),
      contactPerson: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      monthlyBudget: z.string().optional(),
      plan: z.enum(["light", "algorithm", "market_jack"]),
      message: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(adFormSubmissions).values({
        companyName: input.companyName,
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone || null,
        monthlyBudget: input.monthlyBudget || null,
        plan: input.plan,
        message: input.message || null,
        source: input.source || "tiktok_ads_lp",
      });

      // 自動返信メール送信
      try {
        const { sendEmail } = await import("./emailService");
        const planNames: Record<string, string> = {
          light: "ライト検証",
          algorithm: "アルゴリズム攻略",
          market_jack: "市場ジャック",
        };
        await sendEmail({
          to: [input.email],
          subject: "【LCJ】TikTok広告運用 無料相談のお申し込みを受け付けました",
          content: `${input.contactPerson} 様\n\nこの度はLCJのTikTok広告運用サービスにお問い合わせいただき、誠にありがとうございます。\n\n■ お申込内容\nプラン: ${planNames[input.plan]}\n月間広告予算: ${input.monthlyBudget || "未回答"}\n\n担当者より1営業日以内にご連絡いたします。\n\nLive Commerce Japan`,
          html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #ff0050 0%, #7c2ae8 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">お問い合わせを受け付けました</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">TikTok広告運用サービス</p>
  </div>
  <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
    <p>${input.contactPerson} 様</p>
    <p>この度はLCJのTikTok広告運用サービスにお問い合わせいただき、誠にありがとうございます。</p>
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ff0050;">
      <h3 style="margin: 0 0 12px; color: #333;">お申込内容</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #666;">プラン</td><td style="padding: 6px 0; font-weight: bold;">${planNames[input.plan]}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">月間広告予算</td><td style="padding: 6px 0; font-weight: bold;">${input.monthlyBudget || "未回答"}</td></tr>
      </table>
    </div>
    <div style="background: #e8f5e9; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">📞 担当者より<strong>1営業日以内</strong>にご連絡いたします。</p>
    </div>
  </div>
</div>`,
        });
      } catch (e) {
        console.error("[AdForm] Failed to send confirmation email:", e);
      }

      // オーナーに通知
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "🔥 新規TikTok広告申込",
          content: `${input.companyName} / ${input.contactPerson}様 が${input.plan === "light" ? "ライト検証" : input.plan === "algorithm" ? "アルゴリズム攻略" : "市場ジャック"}プランで申込。予算: ${input.monthlyBudget || "未回答"}`,
        });
      } catch (e) {
        console.error("[AdForm] Failed to notify owner:", e);
      }

      return { success: true };
    }),

  // 管理: 申込一覧
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().int().optional(),
      offset: z.number().int().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: any[] = [];
      if (input?.status) {
        conditions.push(eq(adFormSubmissions.status, input.status as any));
      }

      const query = db.select().from(adFormSubmissions);
      const rows = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(adFormSubmissions.createdAt)).limit(input?.limit ?? 50).offset(input?.offset ?? 0)
        : await query.orderBy(desc(adFormSubmissions.createdAt)).limit(input?.limit ?? 50).offset(input?.offset ?? 0);

      return rows;
    }),

  // 管理: 統計
  stats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const all = await db.select({ count: sql<number>`COUNT(*)` }).from(adFormSubmissions);
      const pending = await db.select({ count: sql<number>`COUNT(*)` }).from(adFormSubmissions).where(eq(adFormSubmissions.status, "pending"));
      const contacted = await db.select({ count: sql<number>`COUNT(*)` }).from(adFormSubmissions).where(eq(adFormSubmissions.status, "contacted"));
      const inProgress = await db.select({ count: sql<number>`COUNT(*)` }).from(adFormSubmissions).where(eq(adFormSubmissions.status, "in_progress"));
      const contracted = await db.select({ count: sql<number>`COUNT(*)` }).from(adFormSubmissions).where(eq(adFormSubmissions.status, "contracted"));

      return {
        total: Number(all[0]?.count ?? 0),
        pending: Number(pending[0]?.count ?? 0),
        contacted: Number(contacted[0]?.count ?? 0),
        inProgress: Number(inProgress[0]?.count ?? 0),
        contracted: Number(contracted[0]?.count ?? 0),
      };
    }),

  // 管理: ステータス更新
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "contacted", "in_progress", "contracted", "rejected"]),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(adFormSubmissions)
        .set({
          status: input.status,
          reviewNote: input.reviewNote || null,
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
        })
        .where(eq(adFormSubmissions.id, input.id));

      return { success: true };
    }),

  // 管理: 詳細取得
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.select().from(adFormSubmissions).where(eq(adFormSubmissions.id, input.id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    }),
});
