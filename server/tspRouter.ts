/**
 * TSP (TikTok Shop Partner) 月額契約管理ルーター
 * 
 * 機能:
 * - 契約CRUD（作成・一覧・更新・削除）
 * - Stripe Customer/Product/Price/Subscription 連携
 * - Stripe Invoice 作成・送信
 * - 請求書一覧・ステータス管理
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { tspContracts, tspInvoices } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import Stripe from "stripe";
import { ENV } from "./_core/env";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2025-01-27.acacia" as any,
});

// LCJ会社情報（請求書に記載）
const LCJ_COMPANY_INFO = {
  name: "株式会社Live Commerce Japan",
  address: "〒150-0001 東京都渋谷区神宮前5丁目46-20 Stonse Court表参道2階",
  tel: "03-6803-8471",
  invoiceRegistrationNumber: "T5011101112942", // 適格請求書登録番号
  bankInfo: "三井住友銀行 トランクNORTH支店 403 普通0292809",
};

export const tspRouter = router({
  // ========================================
  // 契約一覧取得
  // ========================================
  listContracts: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "paused", "cancelled", "all"]).optional().default("all"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const statusFilter = input?.status || "all";
      let contracts;
      if (statusFilter === "all") {
        contracts = await db.select().from(tspContracts).orderBy(desc(tspContracts.createdAt));
      } else {
        contracts = await db.select().from(tspContracts)
          .where(eq(tspContracts.status, statusFilter))
          .orderBy(desc(tspContracts.createdAt));
      }
      return contracts;
    }),

  // ========================================
  // 契約詳細取得
  // ========================================
  getContract: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.select().from(tspContracts).where(eq(tspContracts.id, input.id)).limit(1);
      if (result.length === 0) throw new Error("Contract not found");
      return result[0];
    }),

  // ========================================
  // 契約作成（Stripe Customer + Product + Price 作成）
  // ========================================
  createContract: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      lcjStaffId: z.number().optional(),
      shopName: z.string().min(1),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
      postalCode: z.string().optional(),
      address: z.string().optional(),
      monthlyAmount: z.number().int().min(1),
      taxRate: z.number().int().default(10),
      contractStartDate: z.string(), // ISO date string
      contractEndDate: z.string().optional(),
      billingDay: z.number().int().min(1).max(28).default(1),
      paymentDueDays: z.number().int().min(1).default(30),
      paymentMethod: z.enum(["bank_transfer", "auto_charge"]).default("bank_transfer"),
      description: z.string().optional(),
      tapShopName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Stripe Customer 作成
      let stripeCustomerId: string | undefined;
      let stripeProductId: string | undefined;
      let stripePriceId: string | undefined;

      try {
        const customer = await stripe.customers.create({
          name: input.companyName || input.shopName,
          email: input.contactEmail,
          phone: input.contactPhone || undefined,
          metadata: {
            shopName: input.shopName,
            contactName: input.contactName || "",
            type: "tsp_contract",
          },
          address: input.address ? {
            line1: input.address,
            postal_code: input.postalCode || undefined,
            country: "JP",
          } : undefined,
          // 銀行振込の場合、invoice_settings で支払い方法を設定
          invoice_settings: {
            custom_fields: [
              { name: "適格請求書登録番号", value: LCJ_COMPANY_INFO.invoiceRegistrationNumber },
              { name: "振込先", value: LCJ_COMPANY_INFO.bankInfo },
            ],
          },
        });
        stripeCustomerId = customer.id;
        console.log(`[TSP] Stripe Customer created: ${customer.id} for ${input.shopName}`);

        // 2. Stripe Product 作成
        const product = await stripe.products.create({
          name: `TSP月額契約 - ${input.shopName}`,
          description: input.description || `TikTok Shop Partner 月額契約（${input.shopName}）`,
          metadata: {
            shopName: input.shopName,
            type: "tsp_monthly",
          },
        });
        stripeProductId = product.id;

        // 3. Stripe Price 作成（月額）
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: input.monthlyAmount, // 税抜金額（円）
          currency: "jpy",
          recurring: { interval: "month" },
          metadata: {
            shopName: input.shopName,
            type: "tsp_monthly",
          },
        });
        stripePriceId = price.id;
        console.log(`[TSP] Stripe Product/Price created: ${product.id} / ${price.id}`);

      } catch (stripeErr: any) {
        console.error("[TSP] Stripe setup error:", stripeErr.message);
        // Stripe設定に失敗してもDB登録は続行（後から手動設定可能）
      }

      // 4. DB に契約を保存
      const result = await db.insert(tspContracts).values({
        brandId: input.brandId || null,
        lcjStaffId: input.lcjStaffId || null,
        shopName: input.shopName,
        companyName: input.companyName || null,
        contactName: input.contactName || null,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        postalCode: input.postalCode || null,
        address: input.address || null,
        monthlyAmount: input.monthlyAmount,
        taxRate: input.taxRate,
        contractStartDate: new Date(input.contractStartDate),
        contractEndDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        billingDay: input.billingDay,
        paymentDueDays: input.paymentDueDays,
        paymentMethod: input.paymentMethod,
        description: input.description || null,
        stripeCustomerId: stripeCustomerId || null,
        stripeProductId: stripeProductId || null,
        stripePriceId: stripePriceId || null,
        tapShopName: input.tapShopName || null,
        notes: input.notes || null,
        status: "active",
      });

      const insertId = Number((result as any)[0].insertId);
      console.log(`[TSP] Contract created: id=${insertId}, shop=${input.shopName}`);
      return { id: insertId, stripeCustomerId, stripeProductId, stripePriceId };
    }),

  // ========================================
  // 契約更新
  // ========================================
  updateContract: protectedProcedure
    .input(z.object({
      id: z.number(),
      brandId: z.number().nullable().optional(),
      lcjStaffId: z.number().nullable().optional(),
      shopName: z.string().optional(),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      postalCode: z.string().optional(),
      address: z.string().optional(),
      monthlyAmount: z.number().int().min(1).optional(),
      taxRate: z.number().int().optional(),
      contractEndDate: z.string().nullable().optional(),
      billingDay: z.number().int().min(1).max(28).optional(),
      paymentDueDays: z.number().int().min(1).optional(),
      paymentMethod: z.enum(["bank_transfer", "auto_charge"]).optional(),
      description: z.string().optional(),
      tapShopName: z.string().nullable().optional(),
      status: z.enum(["active", "paused", "cancelled"]).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;
      const setData: Record<string, any> = {};

      // Only include fields that are explicitly provided
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          if (key === "contractEndDate") {
            setData[key] = value ? new Date(value) : null;
          } else {
            setData[key] = value;
          }
        }
      }

      if (Object.keys(setData).length === 0) {
        throw new Error("No fields to update");
      }

      await db.update(tspContracts).set(setData).where(eq(tspContracts.id, id));

      // 金額変更時はStripe Priceも更新（新Price作成）
      if (input.monthlyAmount) {
        const contract = await db.select().from(tspContracts).where(eq(tspContracts.id, id)).limit(1);
        if (contract.length > 0 && contract[0].stripeProductId) {
          try {
            const newPrice = await stripe.prices.create({
              product: contract[0].stripeProductId,
              unit_amount: input.monthlyAmount,
              currency: "jpy",
              recurring: { interval: "month" },
            });
            await db.update(tspContracts).set({ stripePriceId: newPrice.id }).where(eq(tspContracts.id, id));
            console.log(`[TSP] Updated Stripe Price for contract ${id}: ${newPrice.id}`);
          } catch (err: any) {
            console.error(`[TSP] Failed to update Stripe Price: ${err.message}`);
          }
        }
      }

      console.log(`[TSP] Contract updated: id=${id}`);
      return { id, updated: true };
    }),

  // ========================================
  // 請求書一覧取得
  // ========================================
  listInvoices: protectedProcedure
    .input(z.object({
      contractId: z.number().optional(),
      billingMonth: z.string().optional(),
      status: z.enum(["draft", "sent", "paid", "overdue", "cancelled", "void", "all"]).optional().default("all"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let query = db.select({
        invoice: tspInvoices,
        contract: tspContracts,
      }).from(tspInvoices)
        .leftJoin(tspContracts, eq(tspInvoices.contractId, tspContracts.id))
        .orderBy(desc(tspInvoices.createdAt));

      const conditions: any[] = [];
      if (input?.contractId) {
        conditions.push(eq(tspInvoices.contractId, input.contractId));
      }
      if (input?.billingMonth) {
        conditions.push(eq(tspInvoices.billingMonth, input.billingMonth));
      }
      if (input?.status && input.status !== "all") {
        conditions.push(eq(tspInvoices.status, input.status));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      return await query;
    }),

  // ========================================
  // 請求書作成（Stripe Invoice 作成）
  // ========================================
  createInvoice: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      billingMonth: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
      description: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 契約情報を取得
      const contracts = await db.select().from(tspContracts).where(eq(tspContracts.id, input.contractId)).limit(1);
      if (contracts.length === 0) throw new Error("Contract not found");
      const contract = contracts[0];

      if (!contract.stripeCustomerId) {
        throw new Error("Stripe Customer IDが設定されていません。先に契約のStripe連携を完了してください。");
      }

      // 金額計算
      const amount = contract.monthlyAmount;
      const taxAmount = Math.floor(amount * contract.taxRate / 100);
      const totalAmount = amount + taxAmount;

      // 支払期限計算
      const [year, month] = input.billingMonth.split("-").map(Number);
      const dueDate = new Date(year, month - 1, contract.billingDay + contract.paymentDueDays);

      // 請求書番号生成
      const invoiceNumber = `LCJ-TSP-${input.billingMonth.replace("-", "")}-${String(contract.id).padStart(3, "0")}`;

      // Stripe Invoice 作成
      let stripeInvoiceId: string | undefined;
      let stripeInvoiceUrl: string | undefined;
      let stripeInvoicePdf: string | undefined;

      try {
        // Stripe Invoice Item 追加
        const descriptionText = input.description || contract.description || `TikTok Shop Partner 月額契約（${contract.shopName}）${input.billingMonth}分`;

        await stripe.invoiceItems.create({
          customer: contract.stripeCustomerId,
          amount: amount, // 税抜金額
          currency: "jpy",
          description: descriptionText,
        });

        // 消費税を別行として追加
        await stripe.invoiceItems.create({
          customer: contract.stripeCustomerId,
          amount: taxAmount,
          currency: "jpy",
          description: `消費税（${contract.taxRate}%）`,
        });

        // Stripe Invoice 作成
        const stripeInvoice = await stripe.invoices.create({
          customer: contract.stripeCustomerId,
          collection_method: contract.paymentMethod === "auto_charge" ? "charge_automatically" : "send_invoice",
          days_until_due: contract.paymentMethod === "bank_transfer" ? contract.paymentDueDays : undefined,
          metadata: {
            contractId: String(contract.id),
            billingMonth: input.billingMonth,
            invoiceNumber: invoiceNumber,
            shopName: contract.shopName,
          },
          custom_fields: [
            { name: "請求書番号", value: invoiceNumber },
            { name: "適格請求書登録番号", value: LCJ_COMPANY_INFO.invoiceRegistrationNumber },
          ],
          footer: `${LCJ_COMPANY_INFO.name}\n${LCJ_COMPANY_INFO.address}\nTEL: ${LCJ_COMPANY_INFO.tel}\n振込先: ${LCJ_COMPANY_INFO.bankInfo}`,
        });

        stripeInvoiceId = stripeInvoice.id;
        console.log(`[TSP] Stripe Invoice created: ${stripeInvoice.id} for ${contract.shopName} (${input.billingMonth})`);

      } catch (stripeErr: any) {
        console.error("[TSP] Stripe Invoice creation error:", stripeErr.message);
        throw new Error(`Stripe請求書作成に失敗しました: ${stripeErr.message}`);
      }

      // DB に請求書を保存
      const result = await db.insert(tspInvoices).values({
        contractId: contract.id,
        invoiceNumber,
        billingMonth: input.billingMonth,
        amount,
        taxAmount,
        totalAmount,
        description: input.description || contract.description || null,
        dueDate,
        stripeInvoiceId: stripeInvoiceId || null,
        stripeInvoiceUrl: stripeInvoiceUrl || null,
        stripeInvoicePdf: stripeInvoicePdf || null,
        status: "draft",
        notes: input.notes || null,
      });

      const insertId = Number((result as any)[0].insertId);
      console.log(`[TSP] Invoice created: id=${insertId}, number=${invoiceNumber}`);
      return { id: insertId, invoiceNumber, stripeInvoiceId, amount, taxAmount, totalAmount };
    }),

  // ========================================
  // 請求書送信（Stripe Invoice を finalize & send）
  // ========================================
  sendInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const invoices = await db.select().from(tspInvoices).where(eq(tspInvoices.id, input.invoiceId)).limit(1);
      if (invoices.length === 0) throw new Error("Invoice not found");
      const invoice = invoices[0];

      if (!invoice.stripeInvoiceId) {
        throw new Error("Stripe Invoice IDが設定されていません");
      }

      if (invoice.status !== "draft") {
        throw new Error(`この請求書は既に${invoice.status === "sent" ? "送信済み" : invoice.status}です`);
      }

      try {
        // Stripe Invoice を確定 (finalize)
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.stripeInvoiceId);

        // 請求書を送信
        const sentInvoice = await stripe.invoices.sendInvoice(invoice.stripeInvoiceId);

        // DB更新
        await db.update(tspInvoices).set({
          status: "sent",
          sentAt: new Date(),
          stripeInvoiceUrl: sentInvoice.hosted_invoice_url || null,
          stripeInvoicePdf: sentInvoice.invoice_pdf || null,
        }).where(eq(tspInvoices.id, input.invoiceId));

        console.log(`[TSP] Invoice sent: ${invoice.invoiceNumber} (Stripe: ${invoice.stripeInvoiceId})`);
        return {
          success: true,
          invoiceUrl: sentInvoice.hosted_invoice_url,
          invoicePdf: sentInvoice.invoice_pdf,
        };
      } catch (stripeErr: any) {
        console.error("[TSP] Stripe Invoice send error:", stripeErr.message);
        throw new Error(`請求書送信に失敗しました: ${stripeErr.message}`);
      }
    }),

  // ========================================
  // 請求書を無効化（void）
  // ========================================
  voidInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const invoices = await db.select().from(tspInvoices).where(eq(tspInvoices.id, input.invoiceId)).limit(1);
      if (invoices.length === 0) throw new Error("Invoice not found");
      const invoice = invoices[0];

      if (invoice.stripeInvoiceId) {
        try {
          await stripe.invoices.voidInvoice(invoice.stripeInvoiceId);
        } catch (err: any) {
          console.error(`[TSP] Stripe void error: ${err.message}`);
        }
      }

      await db.update(tspInvoices).set({ status: "void" }).where(eq(tspInvoices.id, input.invoiceId));
      console.log(`[TSP] Invoice voided: ${invoice.invoiceNumber}`);
      return { success: true };
    }),

  // ========================================
  // 一括請求書作成（全アクティブ契約に対して指定月の請求書を作成）
  // ========================================
  createBulkInvoices: protectedProcedure
    .input(z.object({
      billingMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // アクティブな契約を全取得
      const activeContracts = await db.select().from(tspContracts)
        .where(eq(tspContracts.status, "active"));

      const results: { contractId: number; shopName: string; success: boolean; error?: string; invoiceId?: number }[] = [];

      for (const contract of activeContracts) {
        try {
          // 既存の請求書チェック（同月重複防止）
          const existing = await db.select().from(tspInvoices)
            .where(and(
              eq(tspInvoices.contractId, contract.id),
              eq(tspInvoices.billingMonth, input.billingMonth),
            )).limit(1);

          if (existing.length > 0) {
            results.push({
              contractId: contract.id,
              shopName: contract.shopName,
              success: false,
              error: "既に請求書が存在します",
            });
            continue;
          }

          if (!contract.stripeCustomerId) {
            results.push({
              contractId: contract.id,
              shopName: contract.shopName,
              success: false,
              error: "Stripe Customer未設定",
            });
            continue;
          }

          // 金額計算
          const amount = contract.monthlyAmount;
          const taxAmount = Math.floor(amount * contract.taxRate / 100);
          const totalAmount = amount + taxAmount;
          const [year, month] = input.billingMonth.split("-").map(Number);
          const dueDate = new Date(year, month - 1, contract.billingDay + contract.paymentDueDays);
          const invoiceNumber = `LCJ-TSP-${input.billingMonth.replace("-", "")}-${String(contract.id).padStart(3, "0")}`;

          // Stripe Invoice 作成
          const descriptionText = contract.description || `TikTok Shop Partner 月額契約（${contract.shopName}）${input.billingMonth}分`;

          await stripe.invoiceItems.create({
            customer: contract.stripeCustomerId,
            amount: amount,
            currency: "jpy",
            description: descriptionText,
          });

          await stripe.invoiceItems.create({
            customer: contract.stripeCustomerId,
            amount: taxAmount,
            currency: "jpy",
            description: `消費税（${contract.taxRate}%）`,
          });

          const stripeInvoice = await stripe.invoices.create({
            customer: contract.stripeCustomerId,
            collection_method: contract.paymentMethod === "auto_charge" ? "charge_automatically" : "send_invoice",
            days_until_due: contract.paymentMethod === "bank_transfer" ? contract.paymentDueDays : undefined,
            metadata: {
              contractId: String(contract.id),
              billingMonth: input.billingMonth,
              invoiceNumber,
              shopName: contract.shopName,
            },
            custom_fields: [
              { name: "請求書番号", value: invoiceNumber },
              { name: "適格請求書登録番号", value: LCJ_COMPANY_INFO.invoiceRegistrationNumber },
            ],
            footer: `${LCJ_COMPANY_INFO.name}\n${LCJ_COMPANY_INFO.address}\nTEL: ${LCJ_COMPANY_INFO.tel}\n振込先: ${LCJ_COMPANY_INFO.bankInfo}`,
          });

          // DB保存
          const dbResult = await db.insert(tspInvoices).values({
            contractId: contract.id,
            invoiceNumber,
            billingMonth: input.billingMonth,
            amount,
            taxAmount,
            totalAmount,
            description: descriptionText,
            dueDate,
            stripeInvoiceId: stripeInvoice.id,
            status: "draft",
          });

          const insertId = Number((dbResult as any)[0].insertId);
          results.push({
            contractId: contract.id,
            shopName: contract.shopName,
            success: true,
            invoiceId: insertId,
          });

        } catch (err: any) {
          console.error(`[TSP] Bulk invoice error for contract ${contract.id}:`, err.message);
          results.push({
            contractId: contract.id,
            shopName: contract.shopName,
            success: false,
            error: err.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      console.log(`[TSP] Bulk invoices created: ${successCount} success, ${failCount} failed for ${input.billingMonth}`);
      return { results, successCount, failCount };
    }),

  // ========================================
  // 一括請求書送信（指定月のdraft請求書を全送信）
  // ========================================
  sendBulkInvoices: protectedProcedure
    .input(z.object({
      billingMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const draftInvoices = await db.select().from(tspInvoices)
        .where(and(
          eq(tspInvoices.billingMonth, input.billingMonth),
          eq(tspInvoices.status, "draft"),
        ));

      const results: { invoiceId: number; invoiceNumber: string | null; success: boolean; error?: string }[] = [];

      for (const invoice of draftInvoices) {
        if (!invoice.stripeInvoiceId) {
          results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, success: false, error: "Stripe Invoice未設定" });
          continue;
        }

        try {
          await stripe.invoices.finalizeInvoice(invoice.stripeInvoiceId);
          const sent = await stripe.invoices.sendInvoice(invoice.stripeInvoiceId);

          await db.update(tspInvoices).set({
            status: "sent",
            sentAt: new Date(),
            stripeInvoiceUrl: sent.hosted_invoice_url || null,
            stripeInvoicePdf: sent.invoice_pdf || null,
          }).where(eq(tspInvoices.id, invoice.id));

          results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, success: true });
        } catch (err: any) {
          console.error(`[TSP] Send invoice error for ${invoice.invoiceNumber}:`, err.message);
          results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[TSP] Bulk send: ${successCount}/${results.length} invoices sent for ${input.billingMonth}`);
      return { results, successCount, failCount: results.length - successCount };
    }),

  // ========================================
  // ダッシュボード集計
  // ========================================
  getDashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // アクティブ契約数
    const activeContracts = await db.select({ count: sql<number>`COUNT(*)` })
      .from(tspContracts)
      .where(eq(tspContracts.status, "active"));

    // 月額合計（アクティブ契約）
    const monthlyTotal = await db.select({ total: sql<number>`COALESCE(SUM(monthlyAmount), 0)` })
      .from(tspContracts)
      .where(eq(tspContracts.status, "active"));

    // 今月の請求書状況
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const invoiceStats = await db.select({
      status: tspInvoices.status,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(totalAmount), 0)`,
    })
      .from(tspInvoices)
      .where(eq(tspInvoices.billingMonth, currentMonth))
      .groupBy(tspInvoices.status);

    return {
      activeContractCount: Number(activeContracts[0]?.count || 0),
      monthlyTotalAmount: Number(monthlyTotal[0]?.total || 0),
      currentMonth,
      invoiceStats: invoiceStats.map(s => ({
        status: s.status,
        count: Number(s.count),
        total: Number(s.total),
      })),
    };
  }),
});
