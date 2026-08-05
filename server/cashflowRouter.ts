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

  // AI自動カテゴリ分類（説明文から判定）
  autoClassify: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("china"),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      // 曖昧なカテゴリ（これらは再分類対象）
      const vagueCategories = ["振込", "世曜元宇資金", "花秘代収代付", "品汇盟代収代付", "その他支出", "その他入金", "仕入"];

      // 分類ルール（説明文のキーワードで判定）- 優先度順
      const rules: { keywords: string[]; category: string }[] = [
        // 人件費・給与
        { keywords: ["工资", "薪水", "工資", "社保", "公积金", "人件", "月工资", "月薪"], category: "給与・人件費" },
        { keywords: ["业务委托", "委托费", "外包", "兼职"], category: "給与・人件費" },
        // 交通費
        { keywords: ["打车", "交通", "机票", "高铁", "出租车", "滴滴", "车费", "地铁", "上下班车", "通勤"], category: "交通費" },
        // 広告・マーケティング
        { keywords: ["广告", "推广", "投放", "kalodata", "营销", "宣传"], category: "広告・マーケティング" },
        // 家賃・オフィス
        { keywords: ["租金", "物业", "房租", "办公室", "办公"], category: "家賃・オフィス" },
        // 通信・光熱費
        { keywords: ["网络", "电费", "通讯费", "宽带", "电话费"], category: "通信・光熱費" },
        // 物流・配送
        { keywords: ["快递", "物流", "运费", "中转", "闪送", "邮寄", "配送", "运输"], category: "物流・配送" },
        // 飲食・接待
        { keywords: ["餐费", "饮食", "点餐", "外卖", "餐", "饭", "加班点餐"], category: "飲食・接待" },
        { keywords: ["住宿", "酒店", "招待"], category: "飲食・接待" },
        // ソフトウェア・ツール
        { keywords: ["软件", "会员", "平台", "充值", "服务器", "录屏", "订阅", "积分", "云雀"], category: "ソフトウェア・ツール" },
        // 本社送金
        { keywords: ["拨付", "往来款", "转账", "日本总部"], category: "本社送金" },
        // ライブ・配信
        { keywords: ["坑位费", "直播", "场地", "坐位费", "直播间", "配信", "跟播"], category: "ライブ・配信" },
        // TikTok・越境EC
        { keywords: ["橱窗", "带货", "TK", "提现", "跨境", "tiktok"], category: "TikTok・越境EC" },
        // 利息・その他収入
        { keywords: ["利息收入", "利息"], category: "利息・その他収入" },
        // 採用費
        { keywords: ["招聘", "人才", "面试"], category: "採用費" },
        // モデル・タレント
        { keywords: ["模特", "服装租赁", "造型"], category: "モデル・タレント" },
        // 設備・備品
        { keywords: ["采购", "物品", "设备", "用品", "花", "装饰"], category: "設備・備品" },
        // 手数料
        { keywords: ["手续费", "服务费", "佣金", "手数料"], category: "手数料" },
        // 商品仕入
        { keywords: ["珠宝", "首饰", "定制", "样品", "商品"], category: "商品仕入" },
      ];

      let entityFilter = "";
      const params: any[] = [];
      if (input.entity !== "all") {
        entityFilter = "AND entity = ?";
        params.push(input.entity);
      }

      const [rows] = await pool.query(
        `SELECT id, description, category, counterparty FROM company_cashflows WHERE deletedAt IS NULL ${entityFilter}`,
        params
      ) as any;

      let updated = 0;
      for (const row of rows as any[]) {
        const desc = (row.description || "").toLowerCase();
        const counterparty = (row.counterparty || "").toLowerCase();
        const searchText = desc + " " + counterparty;
        const isVague = vagueCategories.some(vc => row.category === vc || row.category?.includes(vc));

        let newCategory = "";
        for (const rule of rules) {
          if (rule.keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
            newCategory = rule.category;
            break;
          }
        }

        // 曖昧カテゴリの場合は強制再分類、それ以外は新カテゴリがある場合のみ更新
        if (newCategory && (isVague || newCategory !== row.category)) {
          await pool.query(
            `UPDATE company_cashflows SET category = ? WHERE id = ?`,
            [newCategory, row.id]
          );
          updated++;
        } else if (isVague && !newCategory) {
          // キーワードでマッチしなかった曖昧カテゴリは「その他経費」に
          await pool.query(
            `UPDATE company_cashflows SET category = ? WHERE id = ?`,
            ["その他経費", row.id]
          );
          updated++;
        }
      }
      return { total: (rows as any[]).length, updated, success: true };
    }),

  // カテゴリ別統計（円グラフ用）
  getCategoryBreakdown: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      type: z.enum(["income", "expense", "all"]).default("expense"),
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
          SUM(amount) as totalAmount,
          COUNT(*) as count,
          ROUND(SUM(amount) * 100.0 / (SELECT SUM(amount) FROM company_cashflows ${where}), 1) as percentage
        FROM company_cashflows
        ${where}
        GROUP BY category
        ORDER BY totalAmount DESC
      `, [...params, ...params]) as any;
      return rows as { category: string; totalAmount: number; count: number; percentage: number }[];
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
