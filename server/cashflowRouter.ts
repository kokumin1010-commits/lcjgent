import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import mysql from "mysql2/promise";

// Direct mysql2 connection pool
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

// Auto-init: create table on import
(async () => {
  try {
    const pool = getPool();
    if (!pool) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_cashflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity ENUM('japan', 'china') NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount BIGINT NOT NULL,
        currency ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY',
        transactionDate VARCHAR(10) NOT NULL,
        description TEXT,
        counterparty VARCHAR(255),
        receiptUrl TEXT,
        createdBy INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt TIMESTAMP NULL,
        INDEX idx_entity (entity),
        INDEX idx_type (type),
        INDEX idx_date (transactionDate),
        INDEX idx_entity_date (entity, transactionDate)
      )
    `);
    console.log("[Cashflow] Table initialized");
  } catch (e) {
    console.warn("[Cashflow] Table init error:", e);
  }
})();

export const cashflowRouter = router({
  // 入出金一覧取得
  getAll: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      type: z.enum(["income", "expense", "all"]).default("all"),
      category: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
      sortBy: z.enum(["transactionDate", "amount", "category", "counterparty"]).default("transactionDate"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL";
      const params: any[] = [];

      if (input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }
      if (input.type !== "all") {
        where += " AND type = ?";
        params.push(input.type);
      }
      if (input.category) {
        where += " AND category = ?";
        params.push(input.category);
      }
      if (input.search) {
        where += " AND (counterparty LIKE ? OR description LIKE ?)";
        params.push(`%${input.search}%`, `%${input.search}%`);
      }
      if (input.startDate) {
        where += " AND transactionDate >= ?";
        params.push(input.startDate);
      }
      if (input.endDate) {
        where += " AND transactionDate <= ?";
        params.push(input.endDate);
      }

      const allowedSortCols = ["transactionDate", "amount", "category", "counterparty"];
      const sortCol = allowedSortCols.includes(input.sortBy) ? input.sortBy : "transactionDate";
      const sortDir = input.sortOrder === "asc" ? "ASC" : "DESC";
      const orderBy = `ORDER BY ${sortCol} ${sortDir}, id DESC`;

      const offset = (input.page - 1) * input.pageSize;
      const [rows] = await pool.query(
        `SELECT * FROM company_cashflows ${where} ${orderBy} LIMIT ? OFFSET ?`,
        [...params, input.pageSize, offset]
      ) as any;
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM company_cashflows ${where}`,
        params
      ) as any;

      return { items: rows, total: Number(countResult[0]?.total || 0) };
    }),

  // 月別サマリー（経営ダッシュボード用）
  getMonthlySummary: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      months: z.number().default(12),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let entityFilter = "";
      const params: any[] = [];
      if (input.entity !== "all") {
        entityFilter = "AND entity = ?";
        params.push(input.entity);
      }

      const [rows] = await pool.query(`
        SELECT 
          LEFT(transactionDate, 7) as month,
          entity,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as netCashflow,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as incomeCount,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expenseCount
        FROM company_cashflows
        WHERE deletedAt IS NULL ${entityFilter}
        GROUP BY month, entity
        ORDER BY month DESC
        LIMIT ?
      `, [...params, input.months * 2]) as any;

      return rows;
    }),

  // カテゴリ別サマリー
  getCategorySummary: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      type: z.enum(["income", "expense", "all"]).default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL";
      const params: any[] = [];

      if (input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }
      if (input.type !== "all") {
        where += " AND type = ?";
        params.push(input.type);
      }
      if (input.startDate) {
        where += " AND transactionDate >= ?";
        params.push(input.startDate);
      }
      if (input.endDate) {
        where += " AND transactionDate <= ?";
        params.push(input.endDate);
      }

      const [rows] = await pool.query(`
        SELECT 
          category,
          type,
          entity,
          SUM(amount) as totalAmount,
          COUNT(*) as count
        FROM company_cashflows
        ${where}
        GROUP BY category, type, entity
        ORDER BY totalAmount DESC
      `, params) as any;

      return rows;
    }),

  // 入出金登録
  create: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]),
      type: z.enum(["income", "expense"]),
      category: z.string().min(1),
      amount: z.number().min(1),
      currency: z.enum(["JPY", "CNY"]),
      transactionDate: z.string(),
      description: z.string().optional(),
      counterparty: z.string().optional(),
      receiptUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const [result] = await pool.query(
        `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, receiptUrl, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.entity, input.type, input.category, input.amount, input.currency, input.transactionDate, input.description || null, input.counterparty || null, input.receiptUrl || null, (ctx as any).user?.id || null]
      ) as any;
      return { id: result.insertId, success: true };
    }),

  // 一括登録（CSV用）
  bulkCreate: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        entity: z.enum(["japan", "china"]),
        type: z.enum(["income", "expense"]),
        category: z.string().min(1),
        amount: z.number().min(1),
        currency: z.enum(["JPY", "CNY"]),
        transactionDate: z.string(),
        description: z.string().optional(),
        counterparty: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      let inserted = 0;
      for (const item of input.items) {
        await pool.query(
          `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.entity, item.type, item.category, item.amount, item.currency, item.transactionDate, item.description || null, item.counterparty || null, (ctx as any).user?.id || null]
        );
        inserted++;
      }
      return { inserted, success: true };
    }),

  // 入出金更新
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      entity: z.enum(["japan", "china"]).optional(),
      type: z.enum(["income", "expense"]).optional(),
      category: z.string().optional(),
      amount: z.number().optional(),
      currency: z.enum(["JPY", "CNY"]).optional(),
      transactionDate: z.string().optional(),
      description: z.string().optional(),
      counterparty: z.string().optional(),
      receiptUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
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
        `UPDATE company_cashflows SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
      return { success: true };
    }),

  // 入出金削除（ソフトデリート）
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query(
        `UPDATE company_cashflows SET deletedAt = NOW() WHERE id = ?`,
        [input.id]
      );
      return { success: true };
    }),

  // カテゴリ一覧取得（入力補完用）
  getCategories: protectedProcedure
    .query(async () => {
      const pool = getPool();
      const [rows] = await pool.query(`
        SELECT DISTINCT category, type, entity FROM company_cashflows 
        WHERE deletedAt IS NULL 
        ORDER BY category
      `) as any;
      return rows as { category: string; type: string; entity: string }[];
    }),

  // 残高推移（累積）
  getBalanceHistory: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let entityFilter = "";
      const params: any[] = [];
      if (input.entity !== "all") {
        entityFilter = "AND entity = ?";
        params.push(input.entity);
      }

      const [rows] = await pool.query(`
        SELECT 
          LEFT(transactionDate, 7) as month,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as netFlow
        FROM company_cashflows
        WHERE deletedAt IS NULL ${entityFilter}
        GROUP BY month
        ORDER BY month ASC
      `, params) as any;

      let balance = 0;
      return (rows as any[]).map((r: any) => {
        balance += Number(r.netFlow);
        return { month: r.month, netFlow: Number(r.netFlow), balance };
      });
    }),

  // 全体サマリー（ダッシュボードカード用）
  getTotalSummary: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL";
      const params: any[] = [];

      if (input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }
      if (input.startDate) {
        where += " AND transactionDate >= ?";
        params.push(input.startDate);
      }
      if (input.endDate) {
        where += " AND transactionDate <= ?";
        params.push(input.endDate);
      }

      const [rows] = await pool.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as netCashflow,
          COUNT(*) as totalCount,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as incomeCount,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expenseCount
        FROM company_cashflows
        ${where}
      `, params) as any;

      return rows[0] || { totalIncome: 0, totalExpense: 0, netCashflow: 0, totalCount: 0, incomeCount: 0, expenseCount: 0 };
    }),
});
