import { z } from "zod";
import { financeProcedure, router } from "./_core/trpc";
import mysql from "mysql2/promise";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { ensureInvoiceSchema } from "./invoiceSchema";

// Direct mysql2 connection pool
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

async function getReadyPool() {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured");
  await ensureInvoiceSchema(pool);
  return pool;
}

// Warm up the schema on startup. Every database procedure also awaits the same
// idempotent promise so a failed startup migration never becomes a silent error.
(async () => {
  try {
    await getReadyPool();
    console.log("[Invoice] Table schema ready");
  } catch (e) {
    console.warn("[Invoice] Table init error:", e);
  }
})();

export const invoiceRouter = router({
  // 請求書一覧取得
  list: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      invoiceType: z.enum(["receivable", "payable"]).default("receivable"),
      status: z.number().optional(),
      overdue: z.boolean().optional(),
      search: z.string().optional(),
      managerId: z.number().optional(),
      limit: z.number().default(30),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const pool = await getReadyPool();
      let where = "WHERE deletedAt IS NULL AND invoiceType = ?";
      const params: any[] = [input.invoiceType];

      if (input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }
      if (input.status !== undefined && !input.overdue) {
        where += " AND status = ?";
        params.push(input.status);
      }
      if (input.overdue) {
        where += " AND status = 0 AND endDate < CURDATE()";
      }
      if (input.search) {
        where += " AND (name LIKE ? OR counterparty LIKE ? OR memo LIKE ? OR managerName LIKE ?)";
        const s = `%${input.search}%`;
        params.push(s, s, s, s);
      }
      if (input.managerId) {
        where += " AND managerId = ?";
        params.push(input.managerId);
      }

      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM company_invoices ${where}`, params
      ) as any;
      const total = countRows[0]?.total || 0;

      const [rows] = await pool.query(
        `SELECT * FROM company_invoices ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [...params, input.limit, input.offset]
      ) as any;

      return { invoices: rows, total };
    }),

  // サマリー（カード用）
  summary: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      invoiceType: z.enum(["receivable", "payable"]).default("receivable"),
    }))
    .query(async ({ input }) => {
      const pool = await getReadyPool();
      let where = "WHERE deletedAt IS NULL AND invoiceType = ?";
      const params: any[] = [input.invoiceType];

      if (input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }

      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as totalCount,
          SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pendingCount,
          SUM(CASE WHEN status = 0 THEN amount ELSE 0 END) as pendingAmount,
          SUM(CASE WHEN status = 0 AND endDate < CURDATE() THEN 1 ELSE 0 END) as overdueCount,
          SUM(CASE WHEN status = 0 AND endDate < CURDATE() THEN amount ELSE 0 END) as overdueAmount,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as paidCount,
          SUM(CASE WHEN status = 1 THEN amount ELSE 0 END) as paidAmount
        FROM company_invoices ${where}
      `, params) as any;

      return {
        totalCount: Number(rows[0]?.totalCount || 0),
        pendingCount: Number(rows[0]?.pendingCount || 0),
        pendingAmount: Number(rows[0]?.pendingAmount || 0),
        overdueCount: Number(rows[0]?.overdueCount || 0),
        overdueAmount: Number(rows[0]?.overdueAmount || 0),
        paidCount: Number(rows[0]?.paidCount || 0),
        paidAmount: Number(rows[0]?.paidAmount || 0),
      };
    }),

  // 月別統計
  monthlyStats: financeProcedure
    .input(z.object({
      year: z.number(),
      entity: z.enum(["japan", "china", "all"]).default("all"),
      invoiceType: z.enum(["receivable", "payable"]).default("receivable"),
    }))
    .query(async ({ input }) => {
      const pool = await getReadyPool();
      let where = "WHERE deletedAt IS NULL AND invoiceType = ? AND YEAR(STR_TO_DATE(startDate, '%Y-%m-%d')) = ?";
      const params: any[] = [input.invoiceType, input.year];

      if (input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }

      const [rows] = await pool.query(`
        SELECT 
          MONTH(STR_TO_DATE(startDate, '%Y-%m-%d')) as month,
          SUM(amount) as total,
          COUNT(*) as count
        FROM company_invoices ${where}
        GROUP BY month
        ORDER BY month
      `, params) as any;

      return (rows as any[]).map(r => ({
        month: Number(r.month),
        total: Number(r.total),
        count: Number(r.count),
      }));
    }),

  // 担当者一覧
  managers: financeProcedure
    .query(async () => {
      const pool = await getReadyPool();
      const [rows] = await pool.query(`
        SELECT DISTINCT managerId, managerName 
        FROM company_invoices 
        WHERE deletedAt IS NULL AND managerId IS NOT NULL AND managerName IS NOT NULL
        ORDER BY managerName
      `) as any;
      return (rows as any[]).map(r => ({ id: r.managerId, name: r.managerName }));
    }),

  // 請求書作成
  create: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]).default("japan"),
      invoiceType: z.enum(["receivable", "payable"]).default("receivable"),
      name: z.string(),
      counterparty: z.string().optional(),
      amount: z.number(),
      currency: z.enum(["JPY", "CNY"]).default("JPY"),
      startDate: z.string(),
      endDate: z.string(),
      managerId: z.number().optional(),
      managerName: z.string().optional(),
      memo: z.string().optional(),
      pdfUrl: z.string().optional(),
      pdfKey: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getReadyPool();
      const [result] = await pool.query(
        `INSERT INTO company_invoices (entity, invoiceType, name, counterparty, amount, currency, startDate, endDate, managerId, managerName, memo, pdfUrl, pdfKey, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.entity, input.invoiceType, input.name, input.counterparty || null, input.amount, input.currency, input.startDate, input.endDate, input.managerId || null, input.managerName || null, input.memo || null, input.pdfUrl || null, input.pdfKey || null, (ctx as any).user?.id || null]
      ) as any;
      return { id: result.insertId, success: true };
    }),

  // 請求書更新
  update: financeProcedure
    .input(z.object({
      id: z.number(),
      entity: z.enum(["japan", "china"]).optional(),
      invoiceType: z.enum(["receivable", "payable"]).optional(),
      name: z.string().optional(),
      counterparty: z.string().optional(),
      amount: z.number().optional(),
      currency: z.enum(["JPY", "CNY"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.number().optional(),
      managerId: z.number().optional().nullable(),
      managerName: z.string().optional().nullable(),
      memo: z.string().optional().nullable(),
      depositDate: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getReadyPool();
      const { id, ...fields } = input;
      const updates: string[] = [];
      const params: any[] = [];
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (updates.length === 0) return { success: true };
      params.push(id);
      await pool.query(
        `UPDATE company_invoices SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
      return { success: true };
    }),

  // ステータス更新
  updateStatus: financeProcedure
    .input(z.object({
      id: z.number(),
      status: z.number(),
      depositDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getReadyPool();
      if (input.status === 1 && input.depositDate) {
        await pool.query(
          `UPDATE company_invoices SET status = ?, depositDate = ? WHERE id = ?`,
          [input.status, input.depositDate, input.id]
        );
      } else {
        await pool.query(
          `UPDATE company_invoices SET status = ? WHERE id = ?`,
          [input.status, input.id]
        );
      }
      return { success: true };
    }),

  // 計上ステータス更新
  updateAccountingStatus: financeProcedure
    .input(z.object({
      id: z.number(),
      accountingStatus: z.number(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getReadyPool();
      await pool.query(
        `UPDATE company_invoices SET accountingStatus = ? WHERE id = ?`,
        [input.accountingStatus, input.id]
      );
      return { success: true };
    }),

  // メモ更新
  updateMemo: financeProcedure
    .input(z.object({
      id: z.number(),
      memo: z.string(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getReadyPool();
      await pool.query(
        `UPDATE company_invoices SET memo = ? WHERE id = ?`,
        [input.memo, input.id]
      );
      return { success: true };
    }),

  // 請求書削除（ソフトデリート）
  delete: financeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getReadyPool();
      const [result] = await pool.query(
        `UPDATE company_invoices SET deletedAt = NOW(), updatedAt = NOW() WHERE id = ? AND deletedAt IS NULL`,
        [input.id]
      ) as any;
      const deleted = Number(result?.affectedRows || 0) > 0;
      console.info("[Invoice] Soft delete", {
        invoiceId: input.id,
        deleted,
        userId: (ctx as any).user?.id || null,
      });
      return { success: deleted, deleted };
    }),

  // ファイルアップロード
  uploadFile: financeProcedure
    .input(z.object({
      fileName: z.string(),
      fileData: z.string(), // base64
      contentType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const ext = input.fileName.split(".").pop() || "pdf";
      const fileKey = `invoices/${timestamp}_${randomSuffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      return { url, fileKey };
    }),

  // AI解析（PDF/画像から請求書情報を抽出）
  parseWithAi: financeProcedure
    .input(z.object({
      fileUrl: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const isPdf = input.contentType === "application/pdf";
      const isImage = input.contentType.startsWith("image/");

      const content: any[] = [
        {
          type: "text" as const,
          text: `以下の請求書ファイルから情報を抽出してJSONで返してください。
抽出する情報:
- name: 請求書名（会社名 + 期間など）
- amount: 合計金額（数値のみ、円記号不要）
- startDate: 請求期間開始日（YYYY-MM-DD）
- endDate: 支払期日（YYYY-MM-DD）
- counterparty: 請求先/請求元の会社名
- memo: 備考情報（あれば）
- currency: 通貨（JPY or CNY）
注意:
- 日付はYYYY-MM-DD形式で返してください
- 金額は数値のみで返してください
- 不明な場合は空文字列を返してください
- JSONのみ返してください（マークダウンコードブロック不要）`,
        },
      ];

      if (isPdf) {
        content.push({
          type: "file_url" as const,
          file_url: { url: input.fileUrl, mime_type: "application/pdf" as const },
        });
      } else if (isImage) {
        content.push({
          type: "image_url" as const,
          image_url: { url: input.fileUrl, detail: "high" as const },
        });
      }

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "あなたは請求書解析アシスタントです。請求書から情報を正確に抽出してJSONで返してください。JSONのみ返してください。",
          },
          { role: "user", content },
        ],
      });

      const text = (result as any).choices?.[0]?.message?.content || "";
      // JSONを抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return { name: "", amount: 0, startDate: "", endDate: "", counterparty: "", memo: "", currency: "JPY" };
        }
      }
      return { name: "", amount: 0, startDate: "", endDate: "", counterparty: "", memo: "", currency: "JPY" };
    }),

  // 一括インポート
  bulkImport: financeProcedure
    .input(z.object({
      items: z.array(z.object({
        entity: z.enum(["japan", "china"]),
        invoiceType: z.enum(["receivable", "payable"]),
        name: z.string(),
        counterparty: z.string().optional(),
        amount: z.number(),
        currency: z.enum(["JPY", "CNY"]).default("JPY"),
        startDate: z.string(),
        endDate: z.string(),
        status: z.number().default(0),
        managerName: z.string().optional(),
        memo: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getReadyPool();
      let inserted = 0;
      for (const item of input.items) {
        await pool.query(
          `INSERT INTO company_invoices (entity, invoiceType, name, counterparty, amount, currency, startDate, endDate, status, managerName, memo, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.entity, item.invoiceType, item.name, item.counterparty || null, item.amount, item.currency, item.startDate, item.endDate, item.status, item.managerName || null, item.memo || null, (ctx as any).user?.id || null]
        );
        inserted++;
      }
      return { inserted, success: true };
    }),
});
