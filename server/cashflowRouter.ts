import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import mysql from "mysql2/promise";
import { createActivityLog } from "./db";

// Activity log helper for cashflow
async function logCashflowActivity(ctx: any, action: string, targetId: string | number, description: string, details?: any) {
  try {
    await createActivityLog({
      userId: ctx?.user?.id || 0,
      actionType: `cashflow_${action}`,
      actionLabel: description,
      targetType: 'cashflow',
      targetId: Number(targetId) || 0,
      targetName: `取引ID: ${targetId}`,
      metadata: details ? { module: 'cashflow', action, details } : { module: 'cashflow', action },
    });
  } catch(e) { /* ignore logging errors */ }
}

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
    // Add sourceAccount column if not exists
    await pool.query(`ALTER TABLE company_cashflows ADD COLUMN IF NOT EXISTS sourceAccount VARCHAR(100) DEFAULT NULL`).catch(() => {});
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
      sourceAccount: z.string().optional(),
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
      if (input.sourceAccount) {
        where += " AND sourceAccount = ?";
        params.push(input.sourceAccount);
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
      sourceAccount: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const [result] = await pool.query(
        `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, receiptUrl, createdBy, sourceAccount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.entity, input.type, input.category, input.amount, input.currency, input.transactionDate, input.description || null, input.counterparty || null, input.receiptUrl || null, (ctx as any).user?.id || null, input.sourceAccount || null]
      ) as any;
      // Audit log: 作成
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          cashflowId INT NOT NULL,
          action ENUM('create','update','delete') NOT NULL,
          userId VARCHAR(100),
          userName VARCHAR(200),
          changes JSON,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cashflow (cashflowId)
        )`);
        await pool.query(
          `INSERT INTO cashflow_audit_log (cashflowId, action, userId, userName, changes) VALUES (?, 'create', ?, ?, ?)`,
          [result.insertId, (ctx as any).user?.id || null, (ctx as any).user?.name || '不明', JSON.stringify(input)]
        );
      } catch(e) { /* ignore */ }
      // Activity log
      await logCashflowActivity(ctx, 'create', String(result.insertId), `入出金作成: ${input.type === 'income' ? '入金' : '出金'} ${input.amount} ${input.currency} - ${input.counterparty || ''}`, input);
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
        sourceAccount: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      let inserted = 0;
      for (const item of input.items) {
        await pool.query(
          `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, createdBy, sourceAccount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.entity, item.type, item.category, item.amount, item.currency, item.transactionDate, item.description || null, item.counterparty || null, (ctx as any).user?.id || null, item.sourceAccount || null]
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
      sourceAccount: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      // Get old values before update
      const [oldRows] = await pool.query(`SELECT * FROM company_cashflows WHERE id = ?`, [input.id]) as any;
      const oldData = oldRows[0] || {};
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
      // Activity log
      await logCashflowActivity(ctx, 'update', String(id), `入出金更新: ID=${id}`, { before: oldData, after: fields });
      return { success: true };
    }),

  // 入出金削除（ソフトデリート）
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      // Get data before delete for logging
      const [oldRows] = await pool.query(`SELECT * FROM company_cashflows WHERE id = ?`, [input.id]) as any;
      const oldData = oldRows[0] || {};
      await pool.query(
        `UPDATE company_cashflows SET deletedAt = NOW() WHERE id = ?`,
        [input.id]
      );
      // Activity log
      await logCashflowActivity(ctx, 'delete', String(input.id), `入出金削除: ${oldData.type === 'income' ? '入金' : '出金'} ${oldData.amount} ${oldData.currency} - ${oldData.counterparty || ''}`, oldData);
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
      const vagueCategories = ["振込", "世曜元宇資金", "花秘代収代付", "品汇盟代収代付", "その他支出", "その他入金", "仕入", "花秘代付", "品汇盟代付", "花秘代収", "品汇盟代収"];

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
       { keywords: ["手续费", "服务费", "佣金", "手数料", "振込手数料", "ﾃｽｳﾘﾖｳ"], category: "手数料" },
        { keywords: ["振込サービス"], category: "外注費" },
        // 給与（日本）- IBで始まる個人名への振込は給与
        { keywords: ["IB "], category: "給与・人件費" },
        // 口座振替（保険・税金等）
        { keywords: ["口座振替"], category: "保険・社会保険" },
        // 通信費
        { keywords: ["ＫＤＤＩリヨウキン", "KDDI", "NTT", "ソフトバンク"], category: "通信・光熱費" },
        // 家賃
        { keywords: ["ヤチン", "家賃", "賃料"], category: "家賃・オフィス" },
        { keywords: ["フオ－シ－ズ", "ＪＣ"], category: "家賃・オフィス" },
        { keywords: ["ガス料", "電気料", "水道料", "デンキリヨウキン"], category: "通信・光熱費" },
        { keywords: ["支払機"], category: "その他経費" },
        { keywords: ["ﾍﾝｻｲ"], category: "本社送金" },
        { keywords: ["EB8"], category: "本社送金" },
        // 税金
        { keywords: ["ゼイリシ", "税理士", "税金", "源泉", "ＺＨゼイリシ"], category: "税金・公租公課" },
        // 振込（一般）
        { keywords: ["振込", "振込み"], category: "振込" },
        // 商品仕入
        { keywords: ["珠宝", "首饰", "定制", "样品"], category: "商品仕入" },
        // 収入系
        { keywords: ["坑位费", "收入", "回款", "提现"], category: "TikTok・越境EC" },
        // 保险
        { keywords: ["保险", "社保"], category: "給与・人件費" },
        // 預充値・企業版
        { keywords: ["预充值", "企业版", "携程"], category: "ソフトウェア・ツール" },
        // 源泉費用
        { keywords: ["溯源", "认证"], category: "その他経費" },
        // 預支款
        { keywords: ["预支", "借款", "报销"], category: "その他経費" },
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
      // Japan: use month-end balance from bank records
      if (input.entity === "japan") {
        const [rows] = await pool.query(`
          SELECT LEFT(transactionDate, 7) as month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as netFlow
          FROM company_cashflows
          WHERE deletedAt IS NULL ${entityFilter}
          GROUP BY LEFT(transactionDate, 7)
          ORDER BY LEFT(transactionDate, 7) ASC
        `, params) as any;
        // Get month-end balances
        const [balRows] = await pool.query(`
          SELECT LEFT(transactionDate, 7) as month, balance
          FROM company_cashflows
          WHERE id IN (
            SELECT MAX(id) FROM company_cashflows
            WHERE deletedAt IS NULL AND balance IS NOT NULL AND balance > 0 ${entityFilter}
            GROUP BY LEFT(transactionDate, 7)
          )
          ORDER BY LEFT(transactionDate, 7) ASC
        `, params) as any;
        const balMap = new Map((balRows as any[]).map((b: any) => [b.month, Number(b.balance)]));
        let cumBal = 0;
        return (rows as any[]).map((r: any) => {
          cumBal += Number(r.netFlow);
          return { month: r.month, netFlow: Number(r.netFlow), balance: balMap.get(r.month) || cumBal };
        });
      }
      const [rows] = await pool.query(`
        SELECT LEFT(transactionDate, 7) as month,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as netFlow
        FROM company_cashflows
        WHERE deletedAt IS NULL ${entityFilter}
        GROUP BY LEFT(transactionDate, 7)
        ORDER BY LEFT(transactionDate, 7) ASC
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
      const EXCHANGE_RATE = 20.5; // 1 CNY ≈ 20.5 JPY
      
      if (input.entity === "all") {
        // 全法人: 中国と日本を別々に集計してJPYに換算して合算
        let dateFilter = "";
        const dateParams: any[] = [];
        if (input.startDate) { dateFilter += " AND transactionDate >= ?"; dateParams.push(input.startDate); }
        if (input.endDate) { dateFilter += " AND transactionDate <= ?"; dateParams.push(input.endDate); }
        
        const [jpRows] = await pool.query(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
            COUNT(CASE WHEN type = 'income' THEN 1 END) as incomeCount,
            COUNT(CASE WHEN type = 'expense' THEN 1 END) as expenseCount
          FROM company_cashflows WHERE deletedAt IS NULL AND entity = 'japan' ${dateFilter}
        `, dateParams) as any;
        
        const [cnRows] = await pool.query(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
            COUNT(CASE WHEN type = 'income' THEN 1 END) as incomeCount,
            COUNT(CASE WHEN type = 'expense' THEN 1 END) as expenseCount
          FROM company_cashflows WHERE deletedAt IS NULL AND entity = 'china' ${dateFilter}
        `, dateParams) as any;
        
        const jp = jpRows[0] || {};
        const cn = cnRows[0] || {};
        const totalIncome = Number(jp.totalIncome || 0) + Math.round(Number(cn.totalIncome || 0) * EXCHANGE_RATE);
        const totalExpense = Number(jp.totalExpense || 0) + Math.round(Number(cn.totalExpense || 0) * EXCHANGE_RATE);
        return {
          totalIncome,
          totalExpense,
          netCashflow: totalIncome - totalExpense,
          totalCount: Number(jp.incomeCount || 0) + Number(jp.expenseCount || 0) + Number(cn.incomeCount || 0) + Number(cn.expenseCount || 0),
          incomeCount: Number(jp.incomeCount || 0) + Number(cn.incomeCount || 0),
          expenseCount: Number(jp.expenseCount || 0) + Number(cn.expenseCount || 0),
          currency: "JPY",
        };
      } else {
        let where = "WHERE deletedAt IS NULL AND entity = ?";
        const params: any[] = [input.entity];
        if (input.startDate) { where += " AND transactionDate >= ?"; params.push(input.startDate); }
        if (input.endDate) { where += " AND transactionDate <= ?"; params.push(input.endDate); }
        
        const [rows] = await pool.query(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
            SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as netCashflow,
            COUNT(*) as totalCount,
            COUNT(CASE WHEN type = 'income' THEN 1 END) as incomeCount,
            COUNT(CASE WHEN type = 'expense' THEN 1 END) as expenseCount
          FROM company_cashflows ${where}
        `, params) as any;
        
        return rows[0] || { totalIncome: 0, totalExpense: 0, netCashflow: 0, totalCount: 0, incomeCount: 0, expenseCount: 0 };
      }
    }),

  // 銀行流水インポート
  importBankStatement: protectedProcedure
    .input(z.object({
      records: z.array(z.object({
        transactionDate: z.string(),
        counterparty: z.string(),
        debitAmount: z.number().optional(),
        creditAmount: z.number().optional(),
        description: z.string(),
        balance: z.number().optional(),
        sourceAccount: z.string().optional(),
      })),
      entity: z.enum(["japan", "china"]).default("china"),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const rec of input.records) {
        const amount = rec.creditAmount || rec.debitAmount || 0;
        if (amount === 0) { skipped++; continue; }
        const type = rec.creditAmount ? "income" : "expense";

        // 重複チェック
       const [existing] = await pool.query(
          `SELECT id FROM company_cashflows WHERE transactionDate = ? AND amount = ? AND counterparty = ? AND entity = ? AND sourceAccount = ? AND deletedAt IS NULL LIMIT 1`,
          [rec.transactionDate, amount, rec.counterparty || '', input.entity, rec.sourceAccount || '']
       ) as any;
        if (existing && existing.length > 0) { skipped++; continue; }

        // AI分類
        const rules = [
          { keywords: ["\u5de5\u8d44", "\u85aa\u6c34", "\u793e\u4fdd", "\u516c\u79ef\u91d1"], category: "\u7d66\u4e0e\u30fb\u4eba\u4ef6\u8cbb" },
          { keywords: ["\u6253\u8f66", "\u4ea4\u901a", "\u673a\u7968", "\u6ef4\u6ef4"], category: "\u4ea4\u901a\u8cbb" },
          { keywords: ["\u5e7f\u544a", "\u63a8\u5e7f", "\u6295\u653e"], category: "\u5e83\u544a\u30fb\u30de\u30fc\u30b1\u30c6\u30a3\u30f3\u30b0" },
          { keywords: ["\u79df\u91d1", "\u7269\u4e1a", "\u623f\u79df", "\u529e\u516c"], category: "\u5bb6\u8cc3\u30fb\u30aa\u30d5\u30a3\u30b9" },
          { keywords: ["\u7535\u4fe1", "\u7f51\u7edc", "\u5bbd\u5e26"], category: "\u901a\u4fe1\u30fb\u5149\u71b1\u8cbb" },
          { keywords: ["\u5feb\u9012", "\u7269\u6d41", "\u51ef\u6b4c"], category: "\u7269\u6d41\u30fb\u914d\u9001" },
          { keywords: ["\u9910", "\u5916\u5356", "\u4f4f\u5bbf", "\u62db\u5f85"], category: "\u98f2\u98df\u30fb\u63a5\u5f85" },
          { keywords: ["\u8f6f\u4ef6", "\u5145\u503c", "\u817e\u8baf", "\u4e91\u96c0", "\u62b9\u97f3"], category: "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2\u30fb\u30c4\u30fc\u30eb" },
          { keywords: ["\u62e8\u4ed8", "\u5f80\u6765\u6b3e"], category: "\u672c\u793e\u9001\u91d1" },
          { keywords: ["\u76f4\u64ad", "\u573a\u5730"], category: "\u30e9\u30a4\u30d6\u30fb\u914d\u4fe1" },
          { keywords: ["\u6296\u97f3", "tiktok", "\u63d0\u73b0", "\u8de8\u5883", "Ping Pong", "\u822a\u5929\u7535\u5b50"], category: "TikTok\u30fb\u8d8a\u5883EC" },
          { keywords: ["\u6a21\u7279", "\u670d\u88c5\u79df\u8d41"], category: "\u30e2\u30c7\u30eb\u30fb\u30bf\u30ec\u30f3\u30c8" },
          { keywords: ["\u624b\u7eed\u8d39", "\u670d\u52a1\u8d39", "\u94f6\u884c\u6536\u8d39"], category: "\u624b\u6570\u6599" },
          { keywords: ["\u82b1\u79d8"], category: "\u82b1\u79d8\u4ee3\u4ed8" },
          { keywords: ["\u54c1\u6c47\u76df"], category: "\u54c1\u6c47\u76df\u4ee3\u4ed8" },
        ];
        const searchText = `${rec.counterparty || ''} ${rec.description || ''}`.toLowerCase();
        let category = "\u305d\u306e\u4ed6\u7d4c\u8cbb";
        for (const rule of rules) {
          if (rule.keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
            category = rule.category;
            break;
          }
        }

        try {
          await pool.query(
            `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, sourceAccount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [input.entity, type, category, amount, input.entity === "japan" ? "JPY" : "CNY", rec.transactionDate, rec.description || '', rec.counterparty || '', rec.sourceAccount || null]
          );
          imported++;
        } catch (e: any) {
          errors.push(`${rec.transactionDate} ${rec.counterparty}: ${e.message}`);
        }
      }

      // 履歴保存
      try {
        await pool.query(
          `INSERT INTO cashflow_import_history (entity, importType, recordCount, importedCount, skippedCount, importedAt) VALUES (?, ?, ?, ?, ?, NOW())`,
          [input.entity, "\u94f6\u884c\u6d41\u6c34", input.records.length, imported, skipped]
        );
      } catch (e) { /* table may not exist yet */ }

      return { success: true, imported, skipped, errors: errors.slice(0, 5), total: input.records.length };
    }),

  // インポート履歴取得
  getImportHistory: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      try {
        let where = "WHERE 1=1";
        const params: any[] = [];
        if (input.entity !== "all") {
          where += " AND entity = ?";
          params.push(input.entity);
        }
        const [rows] = await pool.query(
          `SELECT * FROM cashflow_import_history ${where} ORDER BY importedAt DESC LIMIT 20`,
          params
        ) as any;
        return rows as { id: number; entity: string; importType: string; recordCount: number; importedCount: number; skippedCount: number; importedAt: string }[];
      } catch (e) {
        return [];
      }
    }),

  // CSV Export - no pagination, filter by date range and/or counterparty
  exportAll: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      type: z.enum(["income", "expense", "all"]).default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      counterparty: z.string().optional(),
      sourceAccount: z.string().optional(),
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
      if (input.counterparty) {
        where += " AND counterparty = ?";
        params.push(input.counterparty);
      }
      if (input.sourceAccount) {
        where += " AND sourceAccount = ?";
        params.push(input.sourceAccount);
      }

      const [rows] = await pool.query(
        `SELECT * FROM company_cashflows ${where} ORDER BY transactionDate DESC, id DESC`,
        params
      ) as any;

      return { items: rows, total: rows.length };
    }),

  // 銀行口座残高管理
  getAccountBalances: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      
      // 1. Get initial balances from bank_account_balances table
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS bank_account_balances (
          id INT AUTO_INCREMENT PRIMARY KEY,
          accountName VARCHAR(100) NOT NULL UNIQUE,
          initialBalance BIGINT NOT NULL DEFAULT 0,
          currency ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY',
          entity ENUM('japan', 'china') NOT NULL DEFAULT 'japan',
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      } catch (e) { /* table exists */ }

     // 2. Get all account initial balances
      const [balances] = await pool.query(`SELECT * FROM bank_account_balances`) as any;
      
     // 3. For Japan accounts: get latest balance directly from records
      const [latestBalances] = await pool.query(`
        SELECT t1.sourceAccount, t1.balance, t1.transactionDate
        FROM company_cashflows t1
        INNER JOIN (
          SELECT sourceAccount, MAX(id) as maxId
          FROM company_cashflows
          WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != '' AND balance IS NOT NULL AND balance > 0
          GROUP BY sourceAccount
        ) t2 ON t1.id = t2.maxId
        WHERE t1.deletedAt IS NULL
      `) as any;

      // 4. Calculate net flow per account from cashflows (for China accounts)
      let entityFilter = "";
      const params: any[] = [];
      if (input.entity !== "all") {
        entityFilter = "AND entity = ?";
        params.push(input.entity);
      }
      
      const [flows] = await pool.query(
        `SELECT sourceAccount, 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense
        FROM company_cashflows 
        WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != '' ${entityFilter}
        GROUP BY sourceAccount`,
        params
      ) as any;

      // 5. Combine results
      const accounts = ["世曜元宇(中信銀行)", "花秘", "品汇盟", "LCJ MITSUI", "LCJ RESONA", "日本総部"];
     const japanAccounts = ["LCJ MITSUI", "LCJ RESONA", "日本総部"];
     const result = accounts.map(name => {
       const balanceRow = balances.find((b: any) => b.accountName === name);
       const flowRow = flows.find((f: any) => f.sourceAccount === name);
       const income = Number(flowRow?.totalIncome || 0);
       const expense = Number(flowRow?.totalExpense || 0);
       const isJapan = japanAccounts.includes(name);
       
       // Japan: use latest record balance; China: use initial + income - expense
       const latestRow = latestBalances.find((l: any) => l.sourceAccount === name);
       const initial = Number(balanceRow?.initialBalance || 0);
        // Both Japan and China: if latest balance exists in records, use it directly
        let currentBalance = latestRow ? Number(latestRow.balance) : initial + income - expense;
        let lastDate = latestRow ? latestRow.transactionDate : null;
        
        // 日本総部 = LCJ MITSUI + LCJ RESONA の合計
        if (name === "日本総部") {
          const mitsuiRow = latestBalances.find((l: any) => l.sourceAccount === "LCJ MITSUI");
          const resonaRow = latestBalances.find((l: any) => l.sourceAccount === "LCJ RESONA");
          const mitsuiBal = mitsuiRow ? Number(mitsuiRow.balance) : 0;
          const resonaBal = resonaRow ? Number(resonaRow.balance) : 0;
          currentBalance = mitsuiBal + resonaBal;
          // Use the more recent date of the two
          const mitsuiDate = mitsuiRow?.transactionDate || "";
          const resonaDate = resonaRow?.transactionDate || "";
          lastDate = mitsuiDate > resonaDate ? mitsuiDate : resonaDate;
        }
        
        return {
          accountName: name,
          initialBalance: initial,
          currentBalance,
          totalIncome: income,
          totalExpense: expense,
          currency: balanceRow?.currency || (isJapan ? "JPY" : "CNY"),
          entity: balanceRow?.entity || (isJapan ? "japan" : "china"),
          lastDate,
        };
      });

      return result;
    }),

  // 初期残高を設定・更新
  setAccountBalance: protectedProcedure
    .input(z.object({
      accountName: z.string(),
      initialBalance: z.number(),
      currency: z.enum(["JPY", "CNY"]).default("JPY"),
      entity: z.enum(["japan", "china"]).default("japan"),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query(
        `INSERT INTO bank_account_balances (accountName, initialBalance, currency, entity) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE initialBalance = ?, currency = ?, entity = ?`,
        [input.accountName, input.initialBalance, input.currency, input.entity, input.initialBalance, input.currency, input.entity]
      );
      return { success: true };
    }),

  // 待补充说明の全レコードを取得
  getPendingDescriptions: protectedProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]).default("china"),
      month: z.string().optional(), // "2026-07" format
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      const vagueTerms = [
        '', '转账', '二代支付', '网银转账', '汇款', '支付', '代付', '代收',
        '振込', '振込サービス', '口座振替', '振込手数料',
      ];
      const placeholders = vagueTerms.map(() => '?').join(',');
      
      // 1. Get large pending items (>= 500 CNY or >= 10000 JPY)
      const threshold = input.entity === 'china' ? 500 : 10000;
      let sql = `SELECT id, transactionDate, type, amount, counterparty, description, category, sourceAccount
        FROM company_cashflows
        WHERE entity = ? AND deletedAt IS NULL
        AND (description IS NULL OR TRIM(description) IN (${placeholders}))
        AND amount >= ?
        `;
      const params: any[] = [input.entity, ...vagueTerms, threshold];
      if (input.month) {
        sql += ` AND transactionDate LIKE ?`;
        params.push(`${input.month}%`);
      }
      sql += ` ORDER BY transactionDate DESC, id DESC`;
      const [largeItems] = await pool.query(sql, params) as any;
      
      // 2. Auto-fill small amounts (< threshold) with "日常零星支出 - {counterparty}"
      let autoSql = `SELECT id, counterparty FROM company_cashflows
        WHERE entity = ? AND deletedAt IS NULL
        AND (description IS NULL OR TRIM(description) IN (${placeholders}))
        AND amount < ?`;
      const autoParams: any[] = [input.entity, ...vagueTerms, threshold];
      if (input.month) {
        autoSql += ` AND transactionDate LIKE ?`;
        autoParams.push(`${input.month}%`);
      }
      const [smallItems] = await pool.query(autoSql, autoParams) as any;
      
      // Auto-fill small items
      let autoFilled = 0;
      for (const item of smallItems) {
        const desc = `日常零星支出 - ${item.counterparty || '不明'}`;
        await pool.query(`UPDATE company_cashflows SET description = ? WHERE id = ?`, [desc, item.id]);
        autoFilled++;
      }
      
      // 3. Anomaly detection: find people with monthly total > 2000 CNY or > 40000 JPY in small transactions
      const anomalyThreshold = input.entity === 'china' ? 2000 : 40000;
      const monthFilter = input.month ? `AND transactionDate LIKE '${input.month}%'` : `AND transactionDate >= DATE_FORMAT(NOW(), '%Y-%m-01')`;
      const [anomalies] = await pool.query(`
        SELECT counterparty, COUNT(*) as txCount, SUM(amount) as totalAmount
        FROM company_cashflows
        WHERE entity = ? AND deletedAt IS NULL AND type = 'expense'
        AND amount < ? ${monthFilter}
        AND counterparty IS NOT NULL AND counterparty != ''
        GROUP BY counterparty
        HAVING SUM(amount) > ?
        ORDER BY totalAmount DESC
      `, [input.entity, threshold, anomalyThreshold]) as any;
      
      return { items: largeItems, autoFilled, anomalies };
    }),

  // 一括で説明を更新
  bulkUpdateDescriptions: protectedProcedure
    .input(z.object({
      updates: z.array(z.object({
        id: z.number(),
        description: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      let updated = 0;
      for (const u of input.updates) {
        if (u.description.trim()) {
          await pool.query(
            `UPDATE company_cashflows SET description = ? WHERE id = ? AND deletedAt IS NULL`,
            [u.description.trim(), u.id]
          );
          updated++;
        }
      }
      return { success: true, updated };
    }),

  // 編集履歴を取得
  getAuditLog: protectedProcedure
    .input(z.object({
      cashflowId: z.number(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      try {
        const [rows] = await pool.query(
          `SELECT * FROM cashflow_audit_log WHERE cashflowId = ? ORDER BY createdAt DESC`,
          [input.cashflowId]
        ) as any;
        return rows;
      } catch(e) {
        return [];
      }
    }),
});
