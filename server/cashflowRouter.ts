import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { financeAdminProcedure, financePayrollAdminProcedure, financePayrollProcedure, financeProcedure, router } from "./_core/trpc";
import mysql from "mysql2/promise";
import { createActivityLog } from "./db";
import { storagePut } from "./storage";
import {
  completeFinanceImportDocument,
  createFinanceImportDocument,
  failFinanceImportDocument,
  getFinanceImportDocumentFile,
  getFinanceImportDocumentMetadata,
  listFinanceImportDocuments,
} from "./financeImportEvidence";
import { getFinanceRecoverySnapshots } from "./liverHomeFinanceRecovery";
import {
  ACTIVE_CASHFLOW_ACCOUNTS,
  MAX_CASHFLOW_RECEIPTS,
  RETIRED_CASHFLOW_ACCOUNTS,
  buildPayrollAnalytics,
  buildPayrollRecordKey,
  canAppendCashflowReceipts,
  calculatePayrollDifference,
  classifyPaidLaborExpense,
  isAuthoritativePaidLaborCashflow,
  isSettledPayrollCashflow,
  parseCashflowReceiptUrls,
  payrollBankDescriptionMatches,
  payrollMonthEndDate,
  removeCashflowReceiptAt,
  resolveCashflowIdentity,
} from "./cashflowHelpers";
import { ensureMysqlColumns, ensureMysqlIndexes } from "./mysqlSchemaHelpers";
import { ensurePayrollCommandCenterSchema } from "./payrollCommandCenterSchema";
import {
  assertCashflowCategoryAllowed,
  createCashflowCategory,
  deleteCashflowCategoryDefinition,
  ensureCashflowCategorySchema,
  inferCashflowCategory,
  listCashflowCategories,
  loadCashflowCategoryCorrections,
  recordCashflowCategoryCorrection,
  resolveImportedCashflowCategories,
  updateCashflowCategoryDefinition,
} from "./cashflowCategoryService";
import { buildPayrollCommandCenter } from "./payrollCommandCenter";
import { buildFinanceCommandCenter } from "./financeCommandCenter";
import { buildCashflowReconciliation } from "./cashflowReconciliation";
import {
  PAYROLL_PROTECTED_ROW_SQL,
  hasPayrollAccess,
  isPayrollCategory,
  lockPayrollAccess,
  requirePayrollAccess,
  requirePayrollAccessForCashflowRow,
  verifyAndUnlockPayroll,
} from "./payrollAccess";

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

async function initializeCashflowSchema() {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`
      CREATE TABLE IF NOT EXISTS company_cashflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity ENUM('japan', 'china') NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
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
  await ensureMysqlColumns(pool, "company_cashflows", [
    { name: "sourceAccount", definition: "VARCHAR(100) DEFAULT NULL" },
    { name: "balance", definition: "DECIMAL(15,2) DEFAULT NULL" },
    { name: "payrollMonth", definition: "VARCHAR(7) DEFAULT NULL" },
    { name: "payrollEmployee", definition: "VARCHAR(255) DEFAULT NULL" },
    { name: "payrollRecordKey", definition: "VARCHAR(500) DEFAULT NULL" },
    { name: "currencySource", definition: "VARCHAR(20) DEFAULT NULL" },
    { name: "laborExpenseType", definition: "VARCHAR(32) DEFAULT NULL" },
    { name: "laborExpenseNote", definition: "TEXT DEFAULT NULL" },
  ]);
  // Keep the older amount migration tolerant because the target type may already be active.
  await pool.query(`ALTER TABLE company_cashflows MODIFY COLUMN amount DECIMAL(15,2) NOT NULL`).catch(() => {});
  await ensureMysqlIndexes(pool, "company_cashflows", [
    { name: "idx_payroll_month", columns: ["payrollMonth"] },
    { name: "idx_payroll_employee", columns: ["payrollEmployee"] },
  ]);
  await ensureCashflowCategorySchema(pool);
  // Bank account ownership is authoritative. This repairs legacy rows imported under the wrong selected entity.
  await pool.query(`UPDATE company_cashflows SET entity = 'japan', currency = 'JPY', currencySource = 'account' WHERE sourceAccount IN ('LCJ MITSUI', 'LCJ RESONA')`);
  await pool.query(`UPDATE company_cashflows SET entity = 'china', currency = 'CNY', currencySource = 'account' WHERE sourceAccount = '世曜元宇(中信銀行)'`);
  await pool.query(`UPDATE company_cashflows SET entity = 'japan', currency = 'JPY', currencySource = 'payroll' WHERE payrollRecordKey LIKE 'japan|%' AND (sourceAccount IS NULL OR sourceAccount = '')`);
  await pool.query(`UPDATE company_cashflows SET entity = 'china', currency = 'CNY', currencySource = 'payroll' WHERE payrollRecordKey LIKE 'china|%' AND (sourceAccount IS NULL OR sourceAccount = '')`);
  await pool.query(`UPDATE company_cashflows SET currencySource = 'legacy' WHERE currencySource IS NULL OR currencySource = ''`);
  await pool.query(`UPDATE company_cashflows SET category = '手数料' WHERE category IN ('給与・人件費','中国人工費','日本人工費') AND (description LIKE '%手续费%' OR description LIKE '%手数料%' OR counterparty LIKE '%手续费%' OR counterparty LIKE '%手数料%')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payroll_import_batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity ENUM('japan', 'china') NOT NULL,
      payrollMonth VARCHAR(7),
      fileName VARCHAR(255) NOT NULL,
      sheetName VARCHAR(255) NOT NULL,
      currency ENUM('JPY', 'CNY') NOT NULL,
      sourceCount INT NOT NULL DEFAULT 0,
      sourceTotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      importedCount INT NOT NULL DEFAULT 0,
      skippedCount INT NOT NULL DEFAULT 0,
      warningCount INT NOT NULL DEFAULT 0,
      importedBy INT,
      importedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payroll_batch_entity_month (entity, payrollMonth)
    )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payroll_import_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      importBatchId INT NOT NULL,
      cashflowId INT,
      recordKey VARCHAR(500) NOT NULL,
      entity ENUM('japan', 'china') NOT NULL,
      payrollMonth VARCHAR(7) NOT NULL,
      employeeName VARCHAR(255) NOT NULL,
      netPay DECIMAL(15,2) NOT NULL,
      currency ENUM('JPY', 'CNY') NOT NULL,
      roleName VARCHAR(255),
      payor VARCHAR(255),
      note TEXT,
      sourceRow INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_payroll_record_key (recordKey),
      INDEX idx_payroll_record_entity_month (entity, payrollMonth),
      INDEX idx_payroll_record_employee (employeeName),
      INDEX idx_payroll_record_cashflow (cashflowId)
    )`);
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
  await pool.query(`CREATE TABLE IF NOT EXISTS payroll_employee_aliases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity ENUM('japan', 'china') NOT NULL,
      employeeName VARCHAR(255) NOT NULL,
      wechatName VARCHAR(100) DEFAULT NULL,
      note VARCHAR(500) DEFAULT NULL,
      updatedBy INT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_payroll_employee_alias (entity, employeeName),
      INDEX idx_payroll_employee_alias_name (employeeName)
    )`);
  await ensurePayrollCommandCenterSchema(pool);
  console.log("[Cashflow] Table initialized");
}

let cashflowSchemaPromise: Promise<void> | null = null;
async function ensureCashflowSchema() {
  if (!cashflowSchemaPromise) {
    cashflowSchemaPromise = initializeCashflowSchema().catch((error) => {
      cashflowSchemaPromise = null;
      throw error;
    });
  }
  return cashflowSchemaPromise;
}

async function loadPayrollBalanceSnapshot(pool: mysql.Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS bank_account_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    accountName VARCHAR(100) NOT NULL UNIQUE,
    initialBalance DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY',
    entity ENUM('japan', 'china') NOT NULL DEFAULT 'japan',
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  const [initialRows] = await pool.query(`SELECT accountName, initialBalance FROM bank_account_balances`) as any;
  const [latestRows] = await pool.query(`
    SELECT t1.sourceAccount, t1.balance, t1.transactionDate
    FROM company_cashflows t1
    INNER JOIN (
      SELECT sourceAccount, MAX(id) AS maxId
      FROM company_cashflows
      WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != '' AND balance IS NOT NULL
      GROUP BY sourceAccount
    ) t2 ON t1.id = t2.maxId
    WHERE t1.deletedAt IS NULL
  `) as any;
  const [flowRows] = await pool.query(`
    SELECT sourceAccount,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS netFlow
    FROM company_cashflows
    WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != ''
    GROUP BY sourceAccount
  `) as any;
  const [flowsAfterRows] = await pool.query(`
    SELECT cf.sourceAccount,
      SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE -cf.amount END) AS netFlowAfter
    FROM company_cashflows cf
    INNER JOIN (
      SELECT sourceAccount, MAX(transactionDate) AS lastBalanceDate
      FROM company_cashflows
      WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND balance IS NOT NULL
      GROUP BY sourceAccount
    ) latest ON latest.sourceAccount = cf.sourceAccount AND cf.transactionDate > latest.lastBalanceDate
    WHERE cf.deletedAt IS NULL
    GROUP BY cf.sourceAccount
  `) as any;

  return ACTIVE_CASHFLOW_ACCOUNTS.map((accountName) => {
    const identity = resolveCashflowIdentity({ sourceAccount: accountName });
    const initial = Number(initialRows.find((row: any) => row.accountName === accountName)?.initialBalance || 0);
    const latest = latestRows.find((row: any) => row.sourceAccount === accountName);
    const allFlow = Number(flowRows.find((row: any) => row.sourceAccount === accountName)?.netFlow || 0);
    const flowAfter = Number(flowsAfterRows.find((row: any) => row.sourceAccount === accountName)?.netFlowAfter || 0);
    return {
      accountName,
      entity: identity.entity,
      currency: identity.currency,
      amount: latest ? Number(latest.balance || 0) + flowAfter : initial + allFlow,
      asOf: latest?.transactionDate || null,
    };
  });
}

void ensureCashflowSchema().catch((error) => {
  console.warn("[Cashflow] Table init error:", error);
});

export const cashflowRouter = router({
  getPayrollAccessStatus: financeProcedure.query(async ({ ctx }) => ({
    unlocked: await hasPayrollAccess(ctx),
  })),

  unlockPayrollAccess: financeProcedure
    .input(z.object({ password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => verifyAndUnlockPayroll(ctx, input.password)),

  lockPayrollAccess: financeProcedure.mutation(({ ctx }) => lockPayrollAccess(ctx)),

  recoverySnapshots: financeProcedure.query(async () => {
    return await getFinanceRecoverySnapshots();
  }),

  // CEO／财务司令塔：只读汇总，所有异常均下钻回现有明细核对。
  getFinanceCommandCenter: financeProcedure.query(async ({ ctx }) => {
    await ensureCashflowSchema();
    const pool = getPool();
    const payrollAllowed = await hasPayrollAccess(ctx);
    // 司令塔は給与の個人明細を返さず、集計に必要な金額だけを扱う。
    // 二次給与ロックの有無で会社全体の支出合計が変わると、同じデータでも人によってKPIが変わるため、
    // ここでは給与総額を常に含める。給与ファイル・氏名・明細の閲覧権限は従来どおり別途保護する。
    const [rows] = await pool.query(`
      SELECT id, entity, type, category, amount, currency, transactionDate, sourceAccount,
             CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN NULL ELSE counterparty END AS counterparty,
             CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN NULL ELSE description END AS description,
             CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN NULL ELSE receiptUrl END AS receiptUrl
      FROM company_cashflows
      WHERE deletedAt IS NULL
        AND transactionDate >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 120 DAY), '%Y-%m-%d')
      ORDER BY transactionDate DESC, id DESC
    `) as any;
    const balances = await loadPayrollBalanceSnapshot(pool);
    const modules = (["bank_statement", "payroll", "tiktok_orders", "tiktok_payment", "tap", "cap_creator", "cap_product"] as const)
      .filter((module) => payrollAllowed || module !== "payroll");
    const documents = await listFinanceImportDocuments({ modules: [...modules], limit: 30 });
    return buildFinanceCommandCenter({
      rows: rows.map((row: any) => ({
        id: Number(row.id),
        entity: row.entity,
        type: row.type,
        category: String(row.category || "未分类"),
        amount: Number(row.amount || 0),
        currency: row.currency,
        transactionDate: String(row.transactionDate || ""),
        counterparty: row.counterparty == null ? null : String(row.counterparty),
        description: row.description == null ? null : String(row.description),
        sourceAccount: row.sourceAccount == null ? null : String(row.sourceAccount),
        receiptUrl: row.receiptUrl == null ? null : String(row.receiptUrl),
      })),
      balances,
      importDocuments: documents,
    });
  }),

  // 入出金一覧取得
  getAll: financeProcedure
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
      currency: z.enum(["JPY", "CNY"]).optional(),
      payrollMonth: z.string().optional(),
      payrollEmployee: z.string().optional(),
   }))
    .query(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL";
      const params: any[] = [];
      if (!(await hasPayrollAccess(ctx))) where += ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`;

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
        where += " AND (counterparty LIKE ? OR description LIKE ? OR CAST(amount AS CHAR) LIKE ? OR category LIKE ? OR sourceAccount LIKE ?)";
        params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`);
      }
      if (input.sourceAccount) {
        where += " AND sourceAccount = ?";
        params.push(input.sourceAccount);
      }
      if (input.currency) {
        where += " AND currency = ?";
        params.push(input.currency);
      }
      if (input.payrollMonth) {
        where += " AND payrollMonth = ?";
        params.push(input.payrollMonth);
      }
      if (input.payrollEmployee) {
        where += " AND payrollEmployee = ?";
        params.push(input.payrollEmployee);
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
  getMonthlySummary: financeProcedure
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
  getCategorySummary: financeProcedure
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
  create: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]),
      type: z.enum(["income", "expense"]),
      category: z.string().min(1),
      amount: z.number().min(0.01),
      currency: z.enum(["JPY", "CNY"]),
      transactionDate: z.string(),
      description: z.string().optional(),
      counterparty: z.string().optional(),
      receiptUrl: z.string().optional(),
      sourceAccount: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      if (isPayrollCategory(input.category)) await requirePayrollAccess(ctx);
      await assertCashflowCategoryAllowed(pool, input.category, input.type);
      const identity = resolveCashflowIdentity(input);
      const [result] = await pool.query(
        `INSERT INTO company_cashflows
          (entity,type,category,categorySource,categoryLockedByUser,categoryConfidence,categoryReason,lastClassifiedAt,categoryUpdatedBy,
           amount,currency,currencySource,transactionDate,description,counterparty,receiptUrl,createdBy,sourceAccount)
         VALUES (?,?,?,'manual',1,NULL,'手动创建',NOW(),?,?,?,?,?,?,?,?,?,?)`,
        [identity.entity, input.type, input.category, ctx.user.id, input.amount, identity.currency, identity.currencySource, input.transactionDate, input.description || null, input.counterparty || null, input.receiptUrl || null, ctx.user.id, input.sourceAccount || null]
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
  bulkCreate: financeProcedure
    .input(z.object({
      items: z.array(z.object({
        entity: z.enum(["japan", "china"]),
        type: z.enum(["income", "expense"]),
        category: z.string().min(1),
        amount: z.number().min(0.01),
        currency: z.enum(["JPY", "CNY"]),
        transactionDate: z.string(),
        description: z.string().optional(),
        counterparty: z.string().optional(),
        sourceAccount: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      if (input.items.some((item) => isPayrollCategory(item.category))) await requirePayrollAccess(ctx);
      let inserted = 0;
      for (const item of input.items) {
        await assertCashflowCategoryAllowed(pool, item.category, item.type);
        const identity = resolveCashflowIdentity(item);
        await pool.query(
          `INSERT INTO company_cashflows
            (entity,type,category,categorySource,categoryLockedByUser,categoryReason,lastClassifiedAt,categoryUpdatedBy,
             amount,currency,currencySource,transactionDate,description,counterparty,createdBy,sourceAccount)
           VALUES (?,?,?,'manual',1,'手动批量创建',NOW(),?,?,?,?,?,?,?,?,?)`,
          [identity.entity, item.type, item.category, ctx.user.id, item.amount, identity.currency, identity.currencySource, item.transactionDate, item.description || null, item.counterparty || null, ctx.user.id, item.sourceAccount || null]
        );
        inserted++;
      }
      return { inserted, success: true };
    }),

  // 入出金更新
  update: financeProcedure
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
      await ensureCashflowSchema();
      const pool = getPool();
      const connection = await pool.getConnection();
      let oldData: any = null;
      let fields: Record<string, unknown> = {};
      try {
        await connection.beginTransaction();
        const [oldRows] = await connection.query(`SELECT * FROM company_cashflows WHERE id = ? FOR UPDATE`, [input.id]) as any;
        oldData = oldRows[0];
        if (!oldData || oldData.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "流水不存在" });
        if (isPayrollCategory(input.category) || isPayrollCategory(oldData.category) || oldData.payrollRecordKey || oldData.payrollMonth || oldData.payrollEmployee) {
          await requirePayrollAccess(ctx);
        }
        const nextType = input.type ?? oldData.type;
        if (input.category !== undefined) await assertCashflowCategoryAllowed(connection, input.category, nextType);
        const { id, ...inputFields } = input;
        const identity = resolveCashflowIdentity({
          sourceAccount: input.sourceAccount ?? oldData.sourceAccount,
          payrollRecordKey: oldData.payrollRecordKey,
          entity: input.entity ?? oldData.entity,
          currency: input.currency ?? oldData.currency,
        });
        const categoryChanged = input.category !== undefined && input.category !== oldData.category;
        fields = { ...inputFields, entity: identity.entity, currency: identity.currency, currencySource: identity.currencySource };
        if (categoryChanged) {
          Object.assign(fields, {
            categorySource: "manual",
            categoryLockedByUser: 1,
            categoryConfidence: null,
            categoryReason: "人工修正AI/规则分类",
            lastClassifiedAt: new Date(),
            categoryUpdatedBy: ctx.user.id,
          });
        }
        const updates: string[] = [];
        const params: any[] = [];
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) {
            updates.push(`${key} = ?`);
            params.push(value);
          }
        }
        if (updates.length > 0) {
          params.push(id);
          await connection.query(`UPDATE company_cashflows SET ${updates.join(", ")} WHERE id = ?`, params);
        }
        if (categoryChanged) {
          await recordCashflowCategoryCorrection(connection, {
            cashflowId: id,
            fromCategory: oldData.category || null,
            toCategory: input.category!,
            aiCategory: String(oldData.categorySource || "").startsWith("ai_") ? oldData.category : null,
            counterparty: input.counterparty ?? oldData.counterparty ?? null,
            description: input.description ?? oldData.description ?? null,
            actorId: ctx.user.id,
            actorName: ctx.user.name || ctx.user.email,
          });
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      await logCashflowActivity(ctx, 'update', String(input.id), `入出金更新: ID=${input.id}`, { before: oldData, after: fields });
      return { success: true };
    }),

  // 入出金削除（ソフトデリート）
  delete: financeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      // Get data before delete for logging
      const [oldRows] = await pool.query(`SELECT * FROM company_cashflows WHERE id = ?`, [input.id]) as any;
      const oldData = oldRows[0] || {};
      if (isPayrollCategory(oldData.category) || oldData.payrollRecordKey || oldData.payrollMonth || oldData.payrollEmployee) {
        await requirePayrollAccess(ctx);
      }
      await pool.query(
        `UPDATE company_cashflows SET deletedAt = NOW() WHERE id = ?`,
        [input.id]
      );
      // Activity log
      await logCashflowActivity(ctx, 'delete', String(input.id), `入出金削除: ${oldData.type === 'income' ? '入金' : '出金'} ${oldData.amount} ${oldData.currency} - ${oldData.counterparty || ''}`, oldData);
      return { success: true };
    }),


  // 一括削除（アカウント指定）
  bulkDeleteByAccount: financePayrollProcedure
    .input(z.object({ 
      sourceAccount: z.string(),
      entity: z.enum(["japan", "china", "all"]).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL AND sourceAccount = ?";
      const params: any[] = [input.sourceAccount];
      if (input.entity && input.entity !== "all") {
        where += " AND entity = ?";
        params.push(input.entity);
      }
      // Count first
      const [countRows] = await pool.query(`SELECT COUNT(*) as cnt FROM company_cashflows ${where}`, params) as any;
      const count = countRows[0]?.cnt || 0;
      if (count === 0) return { success: true, deleted: 0 };
      // Soft delete all
      await pool.query(`UPDATE company_cashflows SET deletedAt = NOW() ${where}`, params);
      // Log
      await logCashflowActivity(ctx, 'delete', 'bulk', `一括削除: ${input.sourceAccount} ${count}件`, { sourceAccount: input.sourceAccount, count });
      return { success: true, deleted: count };
    }),
  // AI自动分类：统一使用分类主数据和人工纠正；人工锁定的流水绝不覆盖。
  autoClassify: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("china"),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      let entityFilter = "";
      const params: any[] = [];
      if (input.entity !== "all") {
        entityFilter = "AND entity = ?";
        params.push(input.entity);
      }
      const [rows] = await pool.query(
        `SELECT id,entity,type,description,category,counterparty,categorySource,categoryLockedByUser
           FROM company_cashflows
          WHERE deletedAt IS NULL ${entityFilter}`,
        params,
      ) as any;
      const corrections = await loadCashflowCategoryCorrections(pool);
      const vagueCategories = new Set(["振込", "その他支出", "その他入金", "仕入", "世曜元宇資金", "花秘代付", "品汇盟代付", "花秘代収代付", "品汇盟代収代付"]);
      let updated = 0;
      let lockedSkipped = 0;
      for (const row of rows as any[]) {
        if (Number(row.categoryLockedByUser) === 1) {
          lockedSkipped++;
          continue;
        }
        const result = inferCashflowCategory({
          type: row.type,
          entity: row.entity,
          counterparty: row.counterparty,
          description: row.description,
          corrections,
        });
        if (!result.matched && !vagueCategories.has(row.category)) continue;
        if (result.category === row.category && String(row.categorySource || "").startsWith("ai_")) continue;
        await assertCashflowCategoryAllowed(pool, result.category, row.type);
        await pool.query(
          `UPDATE company_cashflows
              SET category=?,categorySource=?,categoryConfidence=?,categoryReason=?,lastClassifiedAt=NOW(),categoryUpdatedBy=?
            WHERE id=? AND categoryLockedByUser=0`,
          [result.category, result.source, result.confidence, result.reason, ctx.user.id, row.id],
        );
        updated++;
      }
      await logCashflowActivity(ctx, "auto_classify", "bulk", `AI分类完成: ${updated}/${rows.length}`, {
        entity: input.entity,
        total: rows.length,
        updated,
        lockedSkipped,
      });
      return { total: rows.length, updated, lockedSkipped, success: true };
    }),

  // カテゴリ別統計（円グラフ用）
  getCategoryBreakdown: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      type: z.enum(["income", "expense", "all"]).default("expense"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sourceAccount: z.string().optional(),
      payrollMonth: z.string().optional(),
      payrollEmployee: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL";
      const params: any[] = [];
      if (input.payrollEmployee) await requirePayrollAccess(ctx);
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
      if (input.sourceAccount) {
        where += " AND sourceAccount = ?";
        params.push(input.sourceAccount);
      }
      if (input.payrollMonth) {
        where += " AND payrollMonth = ?";
        params.push(input.payrollMonth);
      }
      if (input.payrollEmployee) {
        where += " AND payrollEmployee = ?";
        params.push(input.payrollEmployee);
      }
      const [rows] = await pool.query(`
        SELECT
          category,
          currency,
          SUM(amount) as totalAmount,
          COUNT(*) as count,
          SUM(amount * CASE WHEN currency = 'CNY' THEN 20.5 ELSE 1 END) as normalizedAmountJpy
        FROM company_cashflows
        ${where}
        GROUP BY category, currency
        ORDER BY normalizedAmountJpy DESC
      `, params) as any;
      const totalsByCurrency = (rows as any[]).reduce((totals: Record<string, number>, row: any) => {
        totals[row.currency] = (totals[row.currency] || 0) + Number(row.totalAmount || 0);
        return totals;
      }, {});
      return (rows as any[]).map((row: any) => ({
        category: row.category,
        currency: row.currency as "JPY" | "CNY",
        totalAmount: Number(row.totalAmount || 0),
        normalizedAmountJpy: Number(row.normalizedAmountJpy || 0),
        count: Number(row.count || 0),
        percentage: totalsByCurrency[row.currency]
          ? Math.round(Number(row.totalAmount || 0) * 1000 / totalsByCurrency[row.currency]) / 10
          : 0,
      }));
    }),

  // 分类主数据：普通财务用户读取，管理员维护；历史旧分类只读保留。
  getCategories: financeProcedure.query(async () => {
    await ensureCashflowSchema();
    return listCashflowCategories(getPool(), false, false);
  }),

  getCategoryDefinitions: financeAdminProcedure.query(async () => {
    await ensureCashflowSchema();
    return listCashflowCategories(getPool(), true, false);
  }),

  createCategory: financeAdminProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(100),
      flowType: z.enum(["income", "expense", "both"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      try {
        const id = await createCashflowCategory(getPool(), {
          ...input,
          flowType: "both",
          actorId: ctx.user.id,
        });
        await logCashflowActivity(ctx, "category_create", id, `现金流分类新增: ${input.name}`, input);
        return { success: true, id };
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "分类名称已存在" });
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "分类新增失败" });
      }
    }),

  updateCategoryDefinition: financeAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(100).optional(),
      flowType: z.enum(["income", "expense", "both"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      try {
        await updateCashflowCategoryDefinition(getPool(), {
          ...input,
          actorId: ctx.user.id,
          actorName: ctx.user.name || ctx.user.email,
        });
        await logCashflowActivity(ctx, "category_update", input.id, `现金流分类更新: ID=${input.id}`, input);
        return { success: true };
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "分类名称已存在" });
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "分类更新失败" });
      }
    }),

  deleteCategoryDefinition: financeAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      try {
        const result = await deleteCashflowCategoryDefinition(getPool(), {
          id: input.id,
          actorId: ctx.user.id,
        });
        await logCashflowActivity(
          ctx,
          "category_delete",
          input.id,
          `现金流分类删除: ${result.name || `ID=${input.id}`}`,
          { ...input, deleted: result.deleted }
        );
        return { success: true, ...result };
      } catch (error: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error?.message || "分类删除失败",
        });
      }
    }),

  // 残高推移（累積）
  getBalanceHistory: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      sourceAccount: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let entityFilter = "";
      const params: any[] = [];
      if (input.entity !== "all") {
        entityFilter = "AND entity = ?";
        params.push(input.entity);
      }
      if (input.sourceAccount) {
        entityFilter += " AND sourceAccount = ?";
        params.push(input.sourceAccount);
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
            WHERE deletedAt IS NULL AND balance IS NOT NULL ${entityFilter}
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
  getTotalSummary: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sourceAccount: z.string().optional(),
      payrollMonth: z.string().optional(),
      payrollEmployee: z.string().optional(),
      category: z.string().optional(),
      currency: z.enum(["JPY", "CNY"]).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      const EXCHANGE_RATE = 20.5; // 1 CNY ≈ 20.5 JPY
      if (input.payrollEmployee) await requirePayrollAccess(ctx);
      const payrollUnlocked = await hasPayrollAccess(ctx);
      
      if (input.entity === "all") {
        // 全法人: 中国と日本を別々に集計してJPYに換算して合算
        let dateFilter = "";
        const dateParams: any[] = [];
        if (input.startDate) { dateFilter += " AND transactionDate >= ?"; dateParams.push(input.startDate); }
        if (input.endDate) { dateFilter += " AND transactionDate <= ?"; dateParams.push(input.endDate); }
        if (input.sourceAccount) { dateFilter += " AND sourceAccount = ?"; dateParams.push(input.sourceAccount); }
        if (input.payrollMonth) { dateFilter += " AND payrollMonth = ?"; dateParams.push(input.payrollMonth); }
        if (input.payrollEmployee) { dateFilter += " AND payrollEmployee = ?"; dateParams.push(input.payrollEmployee); }
        if (input.category) { dateFilter += " AND category = ?"; dateParams.push(input.category); }
        if (input.currency) { dateFilter += " AND currency = ?"; dateParams.push(input.currency); }
        if (input.search) {
          dateFilter += " AND (counterparty LIKE ? OR description LIKE ? OR CAST(amount AS CHAR) LIKE ? OR category LIKE ? OR sourceAccount LIKE ?)";
          const term = `%${input.search}%`;
          dateParams.push(term, term, term, term, term);
          if (!payrollUnlocked) dateFilter += ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`;
        }
        
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
          jpIncomeCount: Number(jp.incomeCount || 0),
          jpExpenseCount: Number(jp.expenseCount || 0),
          jpTotalIncome: Number(jp.totalIncome || 0),
          jpTotalExpense: Number(jp.totalExpense || 0),
          cnIncomeCount: Number(cn.incomeCount || 0),
          cnExpenseCount: Number(cn.expenseCount || 0),
          cnTotalIncome: Number(cn.totalIncome || 0),
          cnTotalExpense: Number(cn.totalExpense || 0),
        };
      } else {
        let where = "WHERE deletedAt IS NULL AND entity = ?";
        const params: any[] = [input.entity];
        if (input.startDate) { where += " AND transactionDate >= ?"; params.push(input.startDate); }
        if (input.endDate) { where += " AND transactionDate <= ?"; params.push(input.endDate); }
        if (input.sourceAccount) { where += " AND sourceAccount = ?"; params.push(input.sourceAccount); }
        if (input.payrollMonth) { where += " AND payrollMonth = ?"; params.push(input.payrollMonth); }
        if (input.payrollEmployee) { where += " AND payrollEmployee = ?"; params.push(input.payrollEmployee); }
        if (input.category) { where += " AND category = ?"; params.push(input.category); }
        if (input.currency) { where += " AND currency = ?"; params.push(input.currency); }
        if (input.search) {
          where += " AND (counterparty LIKE ? OR description LIKE ? OR CAST(amount AS CHAR) LIKE ? OR category LIKE ? OR sourceAccount LIKE ?)";
          const term = `%${input.search}%`;
          params.push(term, term, term, term, term);
          if (!payrollUnlocked) where += ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`;
        }
        
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

  // 逐笔累计对账：与筛选合计使用同一数据源；工资未解锁时只返回合计行。
  getReconciliation: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      flowType: z.enum(["income", "expense"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sourceAccount: z.string().optional(),
      payrollMonth: z.string().optional(),
      payrollEmployee: z.string().optional(),
      category: z.string().optional(),
      currency: z.enum(["JPY", "CNY"]).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      if (input.payrollEmployee) await requirePayrollAccess(ctx);
      const payrollUnlocked = await hasPayrollAccess(ctx);
      let where = "WHERE deletedAt IS NULL AND type = ?";
      const params: any[] = [input.flowType];
      if (input.entity !== "all") { where += " AND entity = ?"; params.push(input.entity); }
      if (input.startDate) { where += " AND transactionDate >= ?"; params.push(input.startDate); }
      if (input.endDate) { where += " AND transactionDate <= ?"; params.push(input.endDate); }
      if (input.sourceAccount) { where += " AND sourceAccount = ?"; params.push(input.sourceAccount); }
      if (input.payrollMonth) { where += " AND payrollMonth = ?"; params.push(input.payrollMonth); }
      if (input.payrollEmployee) { where += " AND payrollEmployee = ?"; params.push(input.payrollEmployee); }
      if (input.category) { where += " AND category = ?"; params.push(input.category); }
      if (input.currency) { where += " AND currency = ?"; params.push(input.currency); }
      if (input.search) {
        where += " AND (counterparty LIKE ? OR description LIKE ? OR CAST(amount AS CHAR) LIKE ? OR category LIKE ? OR sourceAccount LIKE ?)";
        const term = `%${input.search}%`;
        params.push(term, term, term, term, term);
        if (!payrollUnlocked) where += ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`;
      }

      const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM company_cashflows ${where}`, params) as any;
      const total = Number(countRows[0]?.total || 0);
      if (total > 5000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "逐笔核对范围超过5000笔，请先选择月份或缩小筛选范围" });
      }
      const [rows] = await pool.query(`
        SELECT id, entity, type, category, amount, currency, transactionDate,
          counterparty, description, sourceAccount,
          CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN 1 ELSE 0 END AS isPayroll
        FROM company_cashflows ${where}
      `, params) as any;

      return buildCashflowReconciliation((rows as any[]).map(row => ({
        ...row,
        amount: Number(row.amount || 0),
        isPayroll: Number(row.isPayroll || 0) === 1,
      })), { payrollUnlocked, exchangeRate: 20.5 });
    }),

  // 銀行流水インポート
  importBankStatement: financeProcedure
    .input(z.object({
      records: z.array(z.object({
        transactionDate: z.string(),
        counterparty: z.string(),
        debitAmount: z.number().optional(),
        creditAmount: z.number().optional(),
        description: z.string(),
        balance: z.number().optional(),
        sourceAccount: z.string().optional(),
        category: z.string().trim().max(100).optional(),
        currency: z.enum(["JPY", "CNY"]).optional(),
        entity: z.enum(["japan", "china"]).optional(),
      })),
      entity: z.enum(["japan", "china"]).default("china"),
      sourceFileName: z.string().min(1).max(500),
      sourceFileBase64: z.string().min(1),
      sourceMimeType: z.string().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      const evidence = await createFinanceImportDocument({
        module: "bank_statement",
        entity: input.entity,
        sourceFileName: input.sourceFileName,
        sourceFileBase64: input.sourceFileBase64,
        sourceMimeType: input.sourceMimeType,
        recordCount: input.records.length,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email,
      });
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      let createdCategoryNames: string[] = [];
      let matchedCategoryNames: string[] = [];
      let categoryUpdated = 0;
      const providedCategoryRows = input.records.filter(record => record.category?.trim()).length;

      try {
      const categoryResolution = await resolveImportedCashflowCategories(
        pool,
        input.records.map(record => record.category),
        ctx.user.id
      );
      createdCategoryNames = categoryResolution.createdNames;
      matchedCategoryNames = categoryResolution.matchedNames;
      const categoryCorrections = await loadCashflowCategoryCorrections(pool);

      for (const rec of input.records) {
        const amount = rec.creditAmount || rec.debitAmount || 0;
        if (amount === 0) { skipped++; continue; }
        const type = rec.creditAmount ? "income" : "expense";
        const identity = resolveCashflowIdentity({
          sourceAccount: rec.sourceAccount,
          entity: rec.entity || input.entity,
          currency: rec.currency,
        });

        const rawCategory = rec.category?.trim() || "";
        const importedCategory = rawCategory
          ? categoryResolution.byRawName.get(rawCategory)
          : undefined;
        const importedCategoryReason = importedCategory
          ? importedCategory === rawCategory
            ? "Excelカテゴリ列"
            : `Excelカテゴリ列（${rawCategory} → ${importedCategory}）`
          : "";

        // 重複チェック: 同日同額同取引先でも、説明が異なれば別取引として扱う
        // 同日同額同取引先同説明の場合は、既存件数とインポートバッチ内の件数を比較
        const descKey = (rec.description || '').substring(0, 100);
        const dedupKey = `${rec.transactionDate}|${amount}|${rec.counterparty || ''}|${rec.sourceAccount || ''}|${descKey}`;
        // Count how many times this exact combo appears in the current import batch up to this point
        const batchCount = input.records.slice(0, input.records.indexOf(rec) + 1).filter(r => {
          const rAmt = r.creditAmount || r.debitAmount || 0;
          const rDesc = (r.description || '').substring(0, 100);
          return `${r.transactionDate}|${rAmt}|${r.counterparty || ''}|${r.sourceAccount || ''}|${rDesc}` === dedupKey;
        }).length;
        // Read matching rows in a stable order so the Nth duplicate in the file
        // reconciles the Nth existing row instead of only increasing a counter.
        const [existingRows] = await pool.query(
          `SELECT id, category, categorySource, categoryLockedByUser
             FROM company_cashflows
            WHERE transactionDate = ? AND amount = ? AND counterparty = ? AND entity = ?
              AND sourceAccount = ? AND description LIKE ? AND deletedAt IS NULL
            ORDER BY id ASC`,
          [rec.transactionDate, amount, rec.counterparty || '', identity.entity, rec.sourceAccount || '', descKey ? descKey + '%' : '%']
        ) as any;
        const existingRow = Array.isArray(existingRows) ? existingRows[batchCount - 1] : undefined;
        if (existingRow) {
          if (importedCategory) {
            try {
              await assertCashflowCategoryAllowed(pool, importedCategory, type);
              if (
                existingRow.category !== importedCategory ||
                existingRow.categorySource !== "import" ||
                Number(existingRow.categoryLockedByUser || 0) !== 1
              ) {
                await pool.query(
                  `UPDATE company_cashflows
                      SET category = ?, categorySource = 'import', categoryLockedByUser = 1,
                          categoryConfidence = 1, categoryReason = ?, lastClassifiedAt = NOW(),
                          categoryUpdatedBy = ?, updatedAt = NOW()
                    WHERE id = ? AND deletedAt IS NULL`,
                  [importedCategory, importedCategoryReason, ctx.user.id, existingRow.id]
                );
                categoryUpdated++;
              }
            } catch (e: any) {
              errors.push(`${rec.transactionDate} ${rec.counterparty}: ${e.message}`);
            }
          }
          skipped++;
          continue;
        }

        const classification = importedCategory
          ? {
              category: importedCategory,
              source: "import" as const,
              confidence: 1,
              reason: importedCategoryReason,
            }
          : inferCashflowCategory({
              type,
              entity: identity.entity,
              counterparty: rec.counterparty,
              description: rec.description,
              corrections: categoryCorrections,
            });
        const categoryLockedByUser = importedCategory ? 1 : 0;

        try {
          await assertCashflowCategoryAllowed(pool, classification.category, type);
          await pool.query(
            `INSERT INTO company_cashflows
              (entity,type,category,categorySource,categoryLockedByUser,categoryConfidence,categoryReason,lastClassifiedAt,categoryUpdatedBy,
               amount,currency,currencySource,transactionDate,description,counterparty,sourceAccount,balance,createdAt,updatedAt)
             VALUES (?,?,?, ?,?,?,?,NOW(),?, ?,?,?,?,?,?,?,?,NOW(),NOW())`,
            [identity.entity, type, classification.category, classification.source, categoryLockedByUser, classification.confidence, classification.reason, ctx.user.id, amount, identity.currency, identity.currencySource, rec.transactionDate, rec.description || '', rec.counterparty || '', rec.sourceAccount || null, rec.balance != null ? rec.balance : null]
          );
          imported++;
        } catch (e: any) {
          errors.push(`${rec.transactionDate} ${rec.counterparty}: ${e.message}`);
        }
      }

      // 履歴保存（旧一覧との互換用）
      let relatedImportId: number | null = null;
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_import_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entity VARCHAR(20),
          importType VARCHAR(50),
          recordCount INT DEFAULT 0,
          importedCount INT DEFAULT 0,
          skippedCount INT DEFAULT 0,
          importedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        const [historyResult] = await pool.query(
          `INSERT INTO cashflow_import_history (entity, importType, recordCount, importedCount, skippedCount, importedAt) VALUES (?, ?, ?, ?, ?, NOW())`,
          [input.entity, "\u94f6\u884c\u6d41\u6c34", input.records.length, imported, skipped]
        ) as any;
        relatedImportId = Number(historyResult?.insertId || 0) || null;
      } catch (historyError) {
        errors.push(`legacy history: ${historyError instanceof Error ? historyError.message : String(historyError)}`);
      }

      await completeFinanceImportDocument(evidence.id, {
        recordCount: input.records.length,
        importedCount: imported,
        skippedCount: skipped,
        errorCount: errors.length,
        relatedImportId,
        details: {
          source: "cashflow",
          originalFileSaved: true,
          providedCategoryRows,
          matchedCategoryNames,
          createdCategoryNames,
          categoryUpdated,
        },
      });
      await logCashflowActivity(ctx, "import", evidence.id, `银行流水导入: ${input.sourceFileName}`, {
        evidenceId: evidence.id,
        entity: input.entity,
        total: input.records.length,
        imported,
        skipped,
        errorCount: errors.length,
        providedCategoryRows,
        matchedCategoryNames,
        createdCategoryNames,
        categoryUpdated,
      });
      return {
        success: true,
        evidenceId: evidence.id,
        originalFileSaved: true,
        imported,
        skipped,
        errors: errors.slice(0, 5),
        total: input.records.length,
        providedCategoryRows,
        matchedCategoryNames,
        createdCategoryNames,
        categoryUpdated,
      };
      } catch (error) {
        await failFinanceImportDocument(evidence.id, error, {
          recordCount: input.records.length,
          importedCount: imported,
          skippedCount: skipped,
          errorCount: errors.length || 1,
        }).catch(() => undefined);
        throw error;
      }
    }),

  // 給与表インポート: 法人別に「中国人工費／日本人工費」へ直接マッピングする
  importPayroll: financePayrollProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]),
      fileName: z.string().min(1).max(255),
      sheetName: z.string().min(1).max(255),
      sourceTotal: z.number().nonnegative(),
      sourceFileBase64: z.string().min(1),
      sourceMimeType: z.string().max(255).optional(),
      warnings: z.array(z.string()).default([]),
      records: z.array(z.object({
        employeeName: z.string().min(1).max(255),
        payrollMonth: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
        netPay: z.number().positive(),
        currency: z.enum(["JPY", "CNY"]),
        role: z.string().optional(),
        payor: z.string().optional(),
        note: z.string().optional(),
        sourceRow: z.number().int().positive(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      let batchId = 0;
      let inserted = 0;
      let updated = 0;
      let linked = 0;
      let skipped = 0;
      let relatedImportId: number | null = null;
      const anomalies = [...input.warnings];
      const distinctMonths = [...new Set(input.records.map(record => record.payrollMonth))];
      const expectedCurrency = input.entity === "japan" ? "JPY" : "CNY";
      const payrollCategory = input.entity === "japan" ? "日本人工費" : "中国人工費";
      const evidence = await createFinanceImportDocument({
        module: "payroll",
        entity: input.entity,
        reportMonth: distinctMonths.length === 1 ? distinctMonths[0] : null,
        sourceFileName: input.fileName,
        sourceFileBase64: input.sourceFileBase64,
        sourceMimeType: input.sourceMimeType,
        recordCount: input.records.length,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email,
        details: { sheetName: input.sheetName },
      });
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();
        const [batchResult] = await connection.query(
          `INSERT INTO payroll_import_batches
           (entity, payrollMonth, fileName, sheetName, currency, sourceCount, sourceTotal, warningCount, importedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.entity, distinctMonths.length === 1 ? distinctMonths[0] : null, input.fileName, input.sheetName, expectedCurrency, input.records.length, input.sourceTotal, anomalies.length, (ctx as any).user?.id || null],
        ) as any;
        batchId = Number(batchResult.insertId);

        for (const record of input.records) {
          if (record.currency !== expectedCurrency) {
            anomalies.push(`${record.employeeName}: 通貨が法人と一致しません`);
            skipped += 1;
            continue;
          }
          const recordKey = buildPayrollRecordKey(input.entity, record.payrollMonth, record.employeeName);
          const transactionDate = payrollMonthEndDate(record.payrollMonth);
          const description = [
            `${record.payrollMonth} 給与表取込`,
            record.role ? `職務: ${record.role}` : "",
            record.payor ? `支給主体: ${record.payor}` : "",
            record.note ? `備考: ${record.note}` : "",
          ].filter(Boolean).join(" / ").slice(0, 4000);

          const [recordRows] = await connection.query(
            `SELECT pir.*, cf.deletedAt AS cashflowDeletedAt
             FROM payroll_import_records pir
             LEFT JOIN company_cashflows cf ON cf.id = pir.cashflowId
             WHERE pir.recordKey = ? LIMIT 1`,
            [recordKey],
          ) as any;
          const existingRecord = recordRows[0];

          if (existingRecord?.cashflowId && !existingRecord.cashflowDeletedAt) {
            const unchanged = Math.abs(Number(existingRecord.netPay) - record.netPay) < 0.005;
            await connection.query(
              `UPDATE company_cashflows SET entity=?,type='expense',category=?,categorySource='payroll',categoryLockedByUser=1,
               categoryConfidence=1,categoryReason='給与表取込',lastClassifiedAt=NOW(),amount=?,currency=?,currencySource='payroll',
               transactionDate=?,counterparty=?,description=?,payrollMonth=?,payrollEmployee=?,payrollRecordKey=?
               WHERE id=? AND deletedAt IS NULL`,
              [input.entity, payrollCategory, record.netPay, record.currency, transactionDate, record.employeeName, description, record.payrollMonth, record.employeeName, recordKey, existingRecord.cashflowId],
            );
            await connection.query(
              `UPDATE payroll_import_records SET importBatchId = ?, netPay = ?, currency = ?, roleName = ?, payor = ?, note = ?, sourceRow = ? WHERE id = ?`,
              [batchId, record.netPay, record.currency, record.role || null, record.payor || null, record.note || null, record.sourceRow, existingRecord.id],
            );
            if (unchanged) skipped += 1;
            else updated += 1;
            continue;
          }

          const [matchingRows] = await connection.query(
            `SELECT id FROM company_cashflows
             WHERE deletedAt IS NULL AND entity = ? AND type = 'expense' AND category IN ('給与・人件費','中国人工費','日本人工費')
               AND transactionDate = ? AND amount = ? AND counterparty = ?
             ORDER BY id DESC LIMIT 2`,
            [input.entity, transactionDate, record.netPay, record.employeeName],
          ) as any;

          let cashflowId: number;
          if (matchingRows.length === 1) {
            cashflowId = Number(matchingRows[0].id);
            await connection.query(
              `UPDATE company_cashflows SET category=?,categorySource='payroll',categoryLockedByUser=1,categoryConfidence=1,
               categoryReason='給与表取込',lastClassifiedAt=NOW(),currency=?,currencySource='payroll',payrollMonth=?,payrollEmployee=?,payrollRecordKey=?,
               description=CASE WHEN description IS NULL OR TRIM(description)='' THEN ? ELSE description END
               WHERE id=?`,
              [payrollCategory, record.currency, record.payrollMonth, record.employeeName, recordKey, description, cashflowId],
            );
            linked += 1;
          } else {
            if (matchingRows.length > 1) anomalies.push(`${record.payrollMonth} ${record.employeeName}: 既存給与支出が複数一致したため新規生成しました`);
            const [cashflowResult] = await connection.query(
              `INSERT INTO company_cashflows
               (entity,type,category,categorySource,categoryLockedByUser,categoryConfidence,categoryReason,lastClassifiedAt,categoryUpdatedBy,
                amount,currency,currencySource,transactionDate,description,counterparty,createdBy,payrollMonth,payrollEmployee,payrollRecordKey)
               VALUES (?,'expense',?,'payroll',1,1,'給与表取込',NOW(),?,?,?,?,?,?,?,?,?,?,?)`,
              [input.entity, payrollCategory, ctx.user.id, record.netPay, record.currency, 'payroll', transactionDate, description, record.employeeName, ctx.user.id, record.payrollMonth, record.employeeName, recordKey],
            ) as any;
            cashflowId = Number(cashflowResult.insertId);
            inserted += 1;
          }

          await connection.query(
            `INSERT INTO payroll_import_records
             (importBatchId, cashflowId, recordKey, entity, payrollMonth, employeeName, netPay, currency, roleName, payor, note, sourceRow)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE importBatchId = VALUES(importBatchId), cashflowId = VALUES(cashflowId), netPay = VALUES(netPay),
               currency = VALUES(currency), roleName = VALUES(roleName), payor = VALUES(payor), note = VALUES(note), sourceRow = VALUES(sourceRow)`,
            [batchId, cashflowId, recordKey, input.entity, record.payrollMonth, record.employeeName, record.netPay, record.currency, record.role || null, record.payor || null, record.note || null, record.sourceRow],
          );
        }

        const processed = inserted + updated + linked;
        await connection.query(
          `UPDATE payroll_import_batches SET importedCount = ?, skippedCount = ?, warningCount = ? WHERE id = ?`,
          [processed, skipped, anomalies.length, batchId],
        );
        await connection.query(`CREATE TABLE IF NOT EXISTS cashflow_import_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entity VARCHAR(20), importType VARCHAR(50), recordCount INT DEFAULT 0,
          importedCount INT DEFAULT 0, skippedCount INT DEFAULT 0, importedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        const [historyResult] = await connection.query(
          `INSERT INTO cashflow_import_history (entity, importType, recordCount, importedCount, skippedCount, importedAt)
           VALUES (?, '給与表', ?, ?, ?, NOW())`,
          [input.entity, input.records.length, processed, skipped],
        ) as any;
        relatedImportId = Number(historyResult?.insertId || 0) || null;
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        await failFinanceImportDocument(evidence.id, error, {
          recordCount: input.records.length,
          importedCount: inserted + updated + linked,
          skippedCount: skipped,
          errorCount: anomalies.length || 1,
        }).catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }

      const generatedTotal = input.records.reduce((sum, record) => sum + record.netPay, 0);
      const difference = calculatePayrollDifference(input.sourceTotal, generatedTotal);
      await completeFinanceImportDocument(evidence.id, {
        recordCount: input.records.length,
        importedCount: inserted + updated + linked,
        skippedCount: skipped,
        errorCount: anomalies.length,
        relatedImportId,
        details: { sheetName: input.sheetName, payrollBatchId: batchId, originalFileSaved: true },
      });
      await logCashflowActivity(ctx, 'create', `payroll-${batchId}`, `給与表取込: ${input.fileName} ${input.records.length}件`, {
        entity: input.entity, batchId, evidenceId: evidence.id, originalFileSaved: true, inserted, updated, linked, skipped, sourceTotal: input.sourceTotal, generatedTotal, difference,
      });
      return { success: true, evidenceId: evidence.id, originalFileSaved: true, batchId, inserted, updated, linked, skipped, importedCount: input.records.length, sourceTotal: input.sourceTotal, generatedTotal, difference, anomalies };
    }),

  // 2026-08 currency/payroll repair. Preview first; apply requires an explicit confirmation token.
  repairCurrencyAndPayrollLinks: financePayrollAdminProcedure
    .input(z.object({
      apply: z.boolean().default(false),
      confirm: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      const connection = await pool.getConnection();
      try {
        const [duplicateRows] = await connection.query(`
          SELECT DISTINCT old.id
          FROM company_cashflows old
          INNER JOIN company_cashflows keep ON keep.id > old.id
            AND keep.sourceAccount = old.sourceAccount
            AND keep.transactionDate = old.transactionDate
            AND keep.type = old.type
            AND keep.amount = old.amount
            AND (keep.counterparty <=> old.counterparty)
            AND (keep.description <=> old.description)
            AND (keep.balance <=> old.balance)
            AND keep.deletedAt IS NULL
          WHERE old.id BETWEEN 1 AND 222
            AND old.sourceAccount = '世曜元宇(中信銀行)'
            AND old.deletedAt IS NULL
        `) as any;
        const duplicateIds = (duplicateRows as any[]).map(row => Number(row.id));

        const [payrollRows] = await connection.query(`
          SELECT pir.id AS payrollImportRecordId, pir.recordKey, pir.entity, pir.payrollMonth,
            pir.employeeName, pir.netPay, pir.currency, pir.cashflowId AS generatedCashflowId,
            cf.sourceAccount AS generatedSourceAccount
          FROM payroll_import_records pir
          INNER JOIN company_cashflows cf ON cf.id = pir.cashflowId
          WHERE cf.deletedAt IS NULL AND (cf.sourceAccount IS NULL OR cf.sourceAccount = '')
        `) as any;

        const links: Array<{
          payrollImportRecordId: number;
          generatedCashflowId: number;
          bankCashflowId: number;
          entity: "japan" | "china";
          currency: "JPY" | "CNY";
          payrollMonth: string;
          employeeName: string;
          netPay: number;
        }> = [];
        const ambiguous: Array<{ payrollMonth: string; employeeName: string; netPay: number; candidateCount: number }> = [];

        for (const payroll of payrollRows as any[]) {
          const monthEnd = new Date(`${payrollMonthEndDate(payroll.payrollMonth)}T00:00:00Z`);
          const rangeStart = new Date(monthEnd);
          rangeStart.setUTCDate(rangeStart.getUTCDate() - 10);
          const rangeEnd = new Date(monthEnd);
          rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 90);
          const sourceSql = payroll.currency === "JPY"
            ? "sourceAccount IN ('LCJ MITSUI', 'LCJ RESONA')"
            : "sourceAccount = '世曜元宇(中信銀行)'";
          const [bankRows] = await connection.query(`
            SELECT id, entity, currency, transactionDate, description, counterparty, sourceAccount
            FROM company_cashflows
            WHERE deletedAt IS NULL AND type = 'expense' AND category IN ('給与・人件費','中国人工費','日本人工費')
              AND payrollRecordKey IS NULL AND amount = ? AND currency = ?
              AND ${sourceSql} AND transactionDate BETWEEN ? AND ?
            ORDER BY transactionDate ASC, id ASC
          `, [
            payroll.netPay,
            payroll.currency,
            rangeStart.toISOString().slice(0, 10),
            rangeEnd.toISOString().slice(0, 10),
          ]) as any;
          const matched = (bankRows as any[]).filter(bank => payrollBankDescriptionMatches(
            payroll.employeeName,
            payroll.payrollMonth,
            `${bank.description || ""} ${bank.counterparty || ""}`,
          ));
          if (matched.length === 1) {
            links.push({
              payrollImportRecordId: Number(payroll.payrollImportRecordId),
              generatedCashflowId: Number(payroll.generatedCashflowId),
              bankCashflowId: Number(matched[0].id),
              entity: payroll.entity,
              currency: payroll.currency,
              payrollMonth: payroll.payrollMonth,
              employeeName: payroll.employeeName,
              netPay: Number(payroll.netPay),
            });
          } else if (matched.length > 1) {
            ambiguous.push({ payrollMonth: payroll.payrollMonth, employeeName: payroll.employeeName, netPay: Number(payroll.netPay), candidateCount: matched.length });
          }
        }

        const totals = links.reduce((result, link) => {
          const key = link.currency === "JPY" ? "linkedJpy" : "linkedCny";
          result[key] += link.netPay;
          return result;
        }, { linkedJpy: 0, linkedCny: 0 });

        if (!input.apply) {
          return { applied: false, duplicateIds, duplicateCount: duplicateIds.length, links, linkCount: links.length, ambiguous, ...totals };
        }
        if (input.confirm !== "repair-2026-08-27") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "修復確認トークンが一致しません" });
        }

        await connection.beginTransaction();
        if (duplicateIds.length > 0) {
          await connection.query(`UPDATE company_cashflows SET deletedAt = NOW() WHERE id IN (${duplicateIds.map(() => "?").join(",")})`, duplicateIds);
        }
        for (const link of links) {
          await connection.query(`
            UPDATE company_cashflows
            SET entity = ?, currency = ?, currencySource = 'account', payrollMonth = ?, payrollEmployee = ?, payrollRecordKey = ?
            WHERE id = ? AND deletedAt IS NULL
          `, [link.entity, link.currency, link.payrollMonth, link.employeeName, buildPayrollRecordKey(link.entity, link.payrollMonth, link.employeeName), link.bankCashflowId]);
          await connection.query(`UPDATE payroll_import_records SET cashflowId = ? WHERE id = ?`, [link.bankCashflowId, link.payrollImportRecordId]);
          await connection.query(`UPDATE company_cashflows SET deletedAt = NOW() WHERE id = ? AND id <> ? AND deletedAt IS NULL`, [link.generatedCashflowId, link.bankCashflowId]);
        }
        await connection.commit();
        await logCashflowActivity(ctx, "update", "currency-payroll-repair", `通貨・給与重複修復: 重複${duplicateIds.length}件、銀行給与リンク${links.length}件`, {
          duplicateIds,
          links: links.map(link => ({ payrollMonth: link.payrollMonth, employeeName: link.employeeName, bankCashflowId: link.bankCashflowId, generatedCashflowId: link.generatedCashflowId })),
          totals,
        });
        return { applied: true, duplicateIds, duplicateCount: duplicateIds.length, links, linkCount: links.length, ambiguous, ...totals };
      } catch (error) {
        if (input.apply) await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }
    }),

  // 給与表と生成済み支出の照合サマリー
  getPayrollReconciliation: financePayrollProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      payrollMonth: z.string().optional(),
      payrollEmployee: z.string().optional(),
    }))
    .query(async ({ input }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      let optionsWhere = "WHERE 1=1";
      const optionsParams: any[] = [];
      if (input.entity !== "all") { optionsWhere += " AND pir.entity = ?"; optionsParams.push(input.entity); }
      let where = optionsWhere;
      const params: any[] = [...optionsParams];
      if (input.payrollMonth) { where += " AND pir.payrollMonth = ?"; params.push(input.payrollMonth); }
      if (input.payrollEmployee) { where += " AND pir.employeeName = ?"; params.push(input.payrollEmployee); }

      try {
        const [summaryRows] = await pool.query(`
          SELECT pir.currency,
            COUNT(*) AS importedCount,
            SUM(pir.netPay) AS payrollTotal,
            SUM(CASE WHEN cf.id IS NOT NULL AND cf.deletedAt IS NULL AND cf.type = 'expense' AND cf.category IN ('給与・人件費','中国人工費','日本人工費') THEN cf.amount ELSE 0 END) AS generatedTotal,
            SUM(CASE WHEN cf.id IS NULL OR cf.deletedAt IS NOT NULL OR cf.type <> 'expense' OR ABS(pir.netPay - cf.amount) > 0.01 OR cf.category NOT IN ('給与・人件費','中国人工費','日本人工費') THEN 1 ELSE 0 END) AS anomalyCount
          FROM payroll_import_records pir
          LEFT JOIN company_cashflows cf ON cf.id = pir.cashflowId
          ${where}
          GROUP BY pir.currency
        `, params) as any;
        const [months] = await pool.query(`SELECT DISTINCT pir.payrollMonth FROM payroll_import_records pir ${optionsWhere} ORDER BY pir.payrollMonth DESC`, optionsParams) as any;
        const [employees] = await pool.query(`SELECT DISTINCT pir.employeeName FROM payroll_import_records pir ${optionsWhere} ORDER BY pir.employeeName ASC`, optionsParams) as any;
        const [employeeAliases] = await pool.query(`
          SELECT entity, employeeName, wechatName, note, updatedBy, updatedAt
          FROM payroll_employee_aliases
          ${input.entity === "all" ? "" : "WHERE entity = ?"}
          ORDER BY entity ASC, employeeName ASC
        `, input.entity === "all" ? [] : [input.entity]) as any;
        const [analyticsRows] = await pool.query(`
          SELECT pir.entity, pir.currency, pir.payrollMonth, pir.employeeName, pir.netPay
          FROM payroll_import_records pir
          ${optionsWhere}
          ORDER BY pir.payrollMonth ASC, pir.employeeName ASC
        `, optionsParams) as any;
        const [anomalyRows] = await pool.query(`
          SELECT pir.id, pir.entity, pir.payrollMonth, pir.employeeName, pir.netPay, pir.currency, pir.cashflowId,
            cf.amount AS cashflowAmount, cf.category, cf.deletedAt
          FROM payroll_import_records pir
          LEFT JOIN company_cashflows cf ON cf.id = pir.cashflowId
          ${where} AND (cf.id IS NULL OR cf.deletedAt IS NOT NULL OR cf.type <> 'expense' OR ABS(pir.netPay - cf.amount) > 0.01 OR cf.category NOT IN ('給与・人件費','中国人工費','日本人工費'))
          ORDER BY pir.payrollMonth DESC, pir.employeeName ASC LIMIT 50
        `, params) as any;
        const [detailRows] = await pool.query(`
          SELECT pir.id, pir.entity, pir.payrollMonth, pir.employeeName, pir.netPay, pir.currency,
            pir.roleName, pir.payor, pir.note,
            cf.id AS cashflowId, cf.amount AS cashflowAmount, cf.transactionDate AS paymentDate,
            cf.sourceAccount, cf.currencySource, cf.type AS cashflowType,
            cf.category AS cashflowCategory, cf.deletedAt AS cashflowDeletedAt
          FROM payroll_import_records pir
          LEFT JOIN company_cashflows cf ON cf.id = pir.cashflowId
          ${where}
          ORDER BY pir.entity ASC, pir.payrollMonth DESC, pir.employeeName ASC
          LIMIT 500
        `, params) as any;
        const accountPlaceholders = ACTIVE_CASHFLOW_ACCOUNTS.map(() => "?").join(",");
        const [paidLaborRows] = await pool.query(`
          SELECT id, entity, transactionDate, amount, currency, description, counterparty,
            payrollMonth, payrollEmployee, sourceAccount, laborExpenseType, laborExpenseNote
          FROM company_cashflows
          WHERE deletedAt IS NULL AND type = 'expense' AND category IN ('給与・人件費','中国人工費','日本人工費')
            AND sourceAccount IN (${accountPlaceholders})
          ORDER BY transactionDate DESC, id DESC
          LIMIT 500
        `, [...ACTIVE_CASHFLOW_ACCOUNTS]) as any;
        const paidLaborDetails = paidLaborRows
          .filter((row: any) => isAuthoritativePaidLaborCashflow({ currency: row.currency, sourceAccount: row.sourceAccount }))
          .map((row: any) => {
            const classification = classifyPaidLaborExpense(row);
            return {
              id: Number(row.id),
              entity: row.entity,
              transactionDate: row.transactionDate,
              amount: Number(row.amount || 0),
              currency: row.currency,
              description: row.description,
              counterparty: row.counterparty,
              payrollMonth: row.payrollMonth,
              payrollEmployee: row.payrollEmployee,
              sourceAccount: row.sourceAccount,
              expenseType: row.laborExpenseType || classification.type,
              expenseTypeLabel: classification.label,
              expenseNote: row.laborExpenseNote || classification.note,
              savedExpenseNote: row.laborExpenseNote,
              originalSummary: classification.originalSummary,
            };
          });
        const analytics = buildPayrollAnalytics(analyticsRows.map((row: any) => ({
          entity: row.entity,
          currency: row.currency,
          payrollMonth: row.payrollMonth,
          employeeName: row.employeeName,
          netPay: Number(row.netPay || 0),
        })), input.payrollMonth);
        const totals = {
          importedCount: 0,
          generatedCount: 0,
          jpyPayrollTotal: 0,
          jpyGeneratedTotal: 0,
          cnyPayrollTotal: 0,
          cnyGeneratedTotal: 0,
          jpyPaidLaborTotal: 0,
          jpyPaidLaborCount: 0,
          cnyPaidLaborTotal: 0,
          cnyPaidLaborCount: 0,
          anomalyCount: 0,
        };
        for (const row of summaryRows) {
          totals.importedCount += Number(row.importedCount || 0);
          totals.generatedCount += Number(row.importedCount || 0) - Number(row.anomalyCount || 0);
          totals.anomalyCount += Number(row.anomalyCount || 0);
          if (row.currency === "JPY") {
            totals.jpyPayrollTotal = Number(row.payrollTotal || 0);
            totals.jpyGeneratedTotal = Number(row.generatedTotal || 0);
          } else {
            totals.cnyPayrollTotal = Number(row.payrollTotal || 0);
            totals.cnyGeneratedTotal = Number(row.generatedTotal || 0);
          }
        }
        for (const row of paidLaborDetails) {
          if (row.currency === "JPY") {
            totals.jpyPaidLaborTotal += row.amount;
            totals.jpyPaidLaborCount += 1;
          } else if (row.currency === "CNY") {
            totals.cnyPaidLaborTotal += row.amount;
            totals.cnyPaidLaborCount += 1;
          }
        }
        const details = detailRows.map((row: any) => ({
          id: Number(row.id),
          entity: row.entity,
          payrollMonth: row.payrollMonth,
          employeeName: row.employeeName,
          netPay: Number(row.netPay || 0),
          currency: row.currency,
          roleName: row.roleName,
          payor: row.payor,
          note: row.note,
          cashflowId: row.cashflowId == null ? null : Number(row.cashflowId),
          cashflowAmount: row.cashflowAmount == null ? null : Number(row.cashflowAmount),
          paymentDate: row.paymentDate,
          sourceAccount: row.sourceAccount,
          paid: isSettledPayrollCashflow({
            cashflowId: row.cashflowId,
            cashflowDeletedAt: row.cashflowDeletedAt,
            cashflowType: row.cashflowType,
            cashflowCategory: row.cashflowCategory,
            cashflowAmount: row.cashflowAmount,
            netPay: row.netPay,
            sourceAccount: row.sourceAccount,
          }),
        }));
        return {
          totals: {
            ...totals,
            jpyDifference: calculatePayrollDifference(totals.jpyPayrollTotal, totals.jpyGeneratedTotal),
            cnyDifference: calculatePayrollDifference(totals.cnyPayrollTotal, totals.cnyGeneratedTotal),
          },
          months: months.map((row: any) => row.payrollMonth),
          employees: employees.map((row: any) => row.employeeName),
          employeeAliases: employeeAliases.map((row: any) => ({
            entity: row.entity,
            employeeName: row.employeeName,
            wechatName: row.wechatName || "",
            note: row.note || "",
            updatedBy: row.updatedBy == null ? null : Number(row.updatedBy),
            updatedAt: row.updatedAt,
          })),
          details,
          paidLaborDetails,
          analytics,
          anomalies: anomalyRows,
        };
      } catch {
        return {
          totals: { importedCount: 0, generatedCount: 0, jpyPayrollTotal: 0, jpyGeneratedTotal: 0, cnyPayrollTotal: 0, cnyGeneratedTotal: 0, jpyPaidLaborTotal: 0, jpyPaidLaborCount: 0, cnyPaidLaborTotal: 0, cnyPaidLaborCount: 0, jpyDifference: 0, cnyDifference: 0, anomalyCount: 0 },
          months: [] as string[], employees: [] as string[], employeeAliases: [] as any[], details: [] as any[], paidLaborDetails: [] as any[], analytics: { monthlyTotals: [] as any[], salaryRanking: { JPY: [] as any[], CNY: [] as any[] }, allEmployees: [] as any[], newEmployees: [] as any[] }, anomalies: [] as any[],
        };
      }
    }),

  getPayrollCommandCenter: financePayrollProcedure.query(async () => {
    await ensureCashflowSchema();
    const pool = getPool();
    const [payrollRows] = await pool.query(`
      SELECT pir.id, pir.entity, pir.currency, pir.payrollMonth, pir.employeeName, pir.netPay,
        cf.id AS cashflowId, cf.amount AS cashflowAmount, cf.type AS cashflowType,
        cf.category AS cashflowCategory, cf.deletedAt AS cashflowDeletedAt,
        cf.transactionDate AS paymentDate, cf.sourceAccount,
        pea.wechatName, pea.department
      FROM payroll_import_records pir
      LEFT JOIN company_cashflows cf ON cf.id = pir.cashflowId
      LEFT JOIN payroll_employee_aliases pea ON pea.entity = pir.entity AND pea.employeeName = pir.employeeName
      ORDER BY pir.payrollMonth ASC, pir.entity ASC, pir.employeeName ASC
    `) as any;
    const [budgetRows] = await pool.query(`SELECT entity, payrollMonth, budgetAmount, currency FROM payroll_budgets ORDER BY payrollMonth ASC`) as any;
    const [fxRows] = await pool.query(`SELECT payrollMonth, cnyToJpyRate, sourceNote FROM payroll_fx_rates ORDER BY payrollMonth ASC`) as any;
    const [statusRows] = await pool.query(`SELECT anomalyKey, status, ownerName, note, updatedAt FROM payroll_anomaly_statuses`) as any;
    const balances = await loadPayrollBalanceSnapshot(pool);
    const [auditRows] = await pool.query(`
      SELECT al.id, al.userId, u.name AS userName, al.actionType, al.actionLabel, al.targetName, al.metadata, al.createdAt
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.userId
      WHERE al.actionLabel LIKE '%給与%' OR al.actionLabel LIKE '%工资%'
      ORDER BY al.createdAt DESC, al.id DESC
      LIMIT 30
    `).catch(() => [[]]) as any;

    const commandCenter = buildPayrollCommandCenter({
      rows: payrollRows.map((row: any) => ({
        id: Number(row.id),
        entity: row.entity,
        currency: row.currency,
        payrollMonth: row.payrollMonth,
        employeeName: row.employeeName,
        netPay: Number(row.netPay || 0),
        cashflowId: row.cashflowId == null ? null : Number(row.cashflowId),
        cashflowAmount: row.cashflowAmount == null ? null : Number(row.cashflowAmount),
        cashflowType: row.cashflowType,
        cashflowCategory: row.cashflowCategory,
        cashflowDeletedAt: row.cashflowDeletedAt,
        paid: isSettledPayrollCashflow({
          cashflowId: row.cashflowId,
          cashflowDeletedAt: row.cashflowDeletedAt,
          cashflowType: row.cashflowType,
          cashflowCategory: row.cashflowCategory,
          cashflowAmount: row.cashflowAmount,
          netPay: row.netPay,
          sourceAccount: row.sourceAccount,
        }),
        paymentDate: row.paymentDate,
        sourceAccount: row.sourceAccount,
        wechatName: row.wechatName,
        department: row.department,
      })),
      budgets: budgetRows.map((row: any) => ({ ...row, budgetAmount: Number(row.budgetAmount || 0) })),
      fxRates: fxRows.map((row: any) => ({ ...row, cnyToJpyRate: Number(row.cnyToJpyRate || 0) })),
      balances,
      anomalyStatuses: statusRows,
    });

    return {
      ...commandCenter,
      auditLogs: (auditRows || []).map((row: any) => ({
        id: Number(row.id),
        userId: Number(row.userId || 0),
        userName: row.userName || null,
        actionType: row.actionType,
        actionLabel: row.actionLabel,
        targetName: row.targetName,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
    };
  }),

  upsertPayrollBudget: financePayrollAdminProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]),
      payrollMonth: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
      budgetAmount: z.number().nonnegative(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      const currency = input.entity === "japan" ? "JPY" : "CNY";
      await pool.query(`
        INSERT INTO payroll_budgets (entity, payrollMonth, budgetAmount, currency, updatedBy)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE budgetAmount = VALUES(budgetAmount), currency = VALUES(currency), updatedBy = VALUES(updatedBy), updatedAt = CURRENT_TIMESTAMP
      `, [input.entity, input.payrollMonth, input.budgetAmount, currency, ctx.user.id]);
      await logCashflowActivity(ctx, "update", `payroll-budget-${input.entity}-${input.payrollMonth}`, `給与预算更新: ${input.entity} ${input.payrollMonth}`, input);
      return { success: true, currency };
    }),

  upsertPayrollFxRate: financePayrollAdminProcedure
    .input(z.object({
      payrollMonth: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
      cnyToJpyRate: z.number().positive().max(1000),
      sourceNote: z.string().trim().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      await pool.query(`
        INSERT INTO payroll_fx_rates (payrollMonth, cnyToJpyRate, sourceNote, updatedBy)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE cnyToJpyRate = VALUES(cnyToJpyRate), sourceNote = VALUES(sourceNote), updatedBy = VALUES(updatedBy), updatedAt = CURRENT_TIMESTAMP
      `, [input.payrollMonth, input.cnyToJpyRate, input.sourceNote || null, ctx.user.id]);
      await logCashflowActivity(ctx, "update", `payroll-fx-${input.payrollMonth}`, `給与实际汇率更新: ${input.payrollMonth}`, input);
      return { success: true };
    }),

  updatePayrollAnomalyStatus: financePayrollAdminProcedure
    .input(z.object({
      anomalyKey: z.string().min(1).max(500),
      status: z.enum(["open", "in_progress", "resolved"]),
      ownerName: z.string().trim().max(100).optional(),
      note: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      await pool.query(`
        INSERT INTO payroll_anomaly_statuses (anomalyKey, status, ownerName, note, updatedBy, resolvedAt)
        VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END)
        ON DUPLICATE KEY UPDATE status = VALUES(status), ownerName = VALUES(ownerName), note = VALUES(note), updatedBy = VALUES(updatedBy),
          resolvedAt = CASE WHEN VALUES(status) = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END, updatedAt = CURRENT_TIMESTAMP
      `, [input.anomalyKey, input.status, input.ownerName || null, input.note || null, ctx.user.id, input.status]);
      await logCashflowActivity(ctx, "update", `payroll-anomaly-${input.anomalyKey}`, `給与异常处理更新: ${input.status}`, input);
      return { success: true };
    }),

  updatePayrollEmployeeDepartment: financePayrollAdminProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]),
      employeeName: z.string().trim().min(1).max(255),
      department: z.string().trim().max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      const [employeeRows] = await pool.query(`SELECT id FROM payroll_import_records WHERE entity = ? AND employeeName = ? LIMIT 1`, [input.entity, input.employeeName]) as any;
      if (!employeeRows.length) throw new TRPCError({ code: "NOT_FOUND", message: "給与表に存在しない従業員です" });
      await pool.query(`
        INSERT INTO payroll_employee_aliases (entity, employeeName, department, updatedBy)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE department = VALUES(department), updatedBy = VALUES(updatedBy), updatedAt = CURRENT_TIMESTAMP
      `, [input.entity, input.employeeName, input.department || null, ctx.user.id]);
      await logCashflowActivity(ctx, "update", `payroll-department-${input.entity}-${input.employeeName}`, `給与员工部门更新: ${input.employeeName}`, input);
      return { success: true };
    }),

  upsertPayrollEmployeeAlias: financePayrollProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]),
      employeeName: z.string().trim().min(1).max(255),
      wechatName: z.string().trim().max(100).optional(),
      note: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      const [employeeRows] = await pool.query(
        `SELECT id FROM payroll_import_records WHERE entity = ? AND employeeName = ? LIMIT 1`,
        [input.entity, input.employeeName]
      ) as any;
      if (!employeeRows.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "給与表に存在しない従業員です" });
      }

      const wechatName = input.wechatName || null;
      const note = input.note || null;
      await pool.query(`
        INSERT INTO payroll_employee_aliases (entity, employeeName, wechatName, note, updatedBy)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          wechatName = VALUES(wechatName), note = VALUES(note), updatedBy = VALUES(updatedBy), updatedAt = CURRENT_TIMESTAMP
      `, [input.entity, input.employeeName, wechatName, note, ctx.user.id]);
      await logCashflowActivity(ctx, "update", `payroll-alias-${input.entity}-${input.employeeName}`, `給与従業員の微信名を更新: ${input.employeeName}`, {
        entity: input.entity,
        employeeName: input.employeeName,
        wechatName,
      });

      return { entity: input.entity, employeeName: input.employeeName, wechatName: wechatName || "", note: note || "" };
    }),

  // 保存済み元ファイル付きの財務インポート履歴
  getImportDocuments: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      limit: z.number().int().min(1).max(100).default(30),
    }))
    .query(async ({ input, ctx }) => {
      const payrollAllowed = await hasPayrollAccess(ctx);
      const modules = (["bank_statement", "payroll", "tiktok_orders", "tiktok_payment", "tap", "cap_creator", "cap_product"] as const)
        .filter((module) => payrollAllowed || module !== "payroll");
      return listFinanceImportDocuments({ modules: [...modules], entity: input.entity, limit: input.limit });
    }),

  getImportDocumentFile: financeProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const metadata = await getFinanceImportDocumentMetadata(input.id);
      if (metadata.module === "payroll") await requirePayrollAccess(ctx);
      const file = await getFinanceImportDocumentFile(input.id);
      await logCashflowActivity(ctx, "download", input.id, `财务导入原文件下载: ${file.fileName}`, {
        evidenceId: input.id,
        module: metadata.module,
      });
      return { fileName: file.fileName, url: file.url };
    }),

  // インポート履歴取得
  getImportHistory: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
    }))
    .query(async ({ input, ctx }) => {
      const pool = getPool();
      try {
        let where = "WHERE 1=1";
        const params: any[] = [];
        if (!(await hasPayrollAccess(ctx))) where += " AND importType <> '給与表'";
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
  exportAll: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china", "all"]).default("all"),
      type: z.enum(["income", "expense", "all"]).default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      counterparty: z.string().optional(),
      sourceAccount: z.string().optional(),
      payrollMonth: z.string().optional(),
      payrollEmployee: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      await ensureCashflowSchema();
      const pool = getPool();
      let where = "WHERE deletedAt IS NULL";
      const params: any[] = [];
      if (!(await hasPayrollAccess(ctx))) where += ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`;

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
      if (input.payrollMonth) {
        where += " AND payrollMonth = ?";
        params.push(input.payrollMonth);
      }
      if (input.payrollEmployee) {
        where += " AND payrollEmployee = ?";
        params.push(input.payrollEmployee);
      }

      const [rows] = await pool.query(
        `SELECT * FROM company_cashflows ${where} ORDER BY transactionDate DESC, id DESC`,
        params
      ) as any;

      return { items: rows, total: rows.length };
    }),

  // 銀行口座残高管理
  getAccountBalances: financeProcedure
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
          initialBalance DECIMAL(15,2) NOT NULL DEFAULT 0,
          currency ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY',
          entity ENUM('japan', 'china') NOT NULL DEFAULT 'japan',
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      } catch (e) { /* table exists */ }
      // Migrate initialBalance from BIGINT to DECIMAL(15,2)
      await pool.query(`ALTER TABLE bank_account_balances MODIFY COLUMN initialBalance DECIMAL(15,2) NOT NULL DEFAULT 0`).catch(() => {});
      await pool.query(
        `DELETE FROM bank_account_balances WHERE accountName IN (${RETIRED_CASHFLOW_ACCOUNTS.map(() => "?").join(",")})`,
        [...RETIRED_CASHFLOW_ACCOUNTS],
      ).catch(() => {});

     // 2. Get all account initial balances
      const [balances] = await pool.query(`SELECT * FROM bank_account_balances`) as any;
      
     // 3. For Japan accounts: get latest balance directly from records
      const [latestBalances] = await pool.query(`
        SELECT t1.sourceAccount, t1.balance, t1.transactionDate
        FROM company_cashflows t1
        INNER JOIN (
          SELECT sourceAccount, MAX(id) as maxId
          FROM company_cashflows
          WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != '' AND balance IS NOT NULL
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

      // 4.5 Get net flow AFTER the last balance record date for each account (for auto-calculation)
      const [flowsAfterBalance] = await pool.query(`
        SELECT cf.sourceAccount,
          SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as incomeAfter,
          SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END) as expenseAfter
        FROM company_cashflows cf
        INNER JOIN (
          SELECT sourceAccount, MAX(transactionDate) as lastBalDate
          FROM company_cashflows
          WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND balance IS NOT NULL
          GROUP BY sourceAccount
        ) lb ON cf.sourceAccount = lb.sourceAccount AND cf.transactionDate > lb.lastBalDate
        WHERE cf.deletedAt IS NULL
        GROUP BY cf.sourceAccount
      `) as any;

      // 5. Combine results
      const accounts = [...ACTIVE_CASHFLOW_ACCOUNTS];
     const japanAccounts = ["LCJ MITSUI", "LCJ RESONA"];
     const result = accounts.map(name => {
       const balanceRow = balances.find((b: any) => b.accountName === name);
       const flowRow = flows.find((f: any) => f.sourceAccount === name);
       const income = Number(flowRow?.totalIncome || 0);
       const expense = Number(flowRow?.totalExpense || 0);
       const isJapan = japanAccounts.includes(name);
       
       // Japan: use latest record balance; China: use initial + income - expense
       const latestRow = latestBalances.find((l: any) => l.sourceAccount === name);
       const initial = Number(balanceRow?.initialBalance || 0);
        // Both Japan and China: use latest balance + net flow after that date
        let currentBalance = 0;
        let lastDate = latestRow ? latestRow.transactionDate : null;
        if (latestRow) {
          // Start from the last known balance, then add net flow after that date
          const afterRow = flowsAfterBalance.find((f: any) => f.sourceAccount === name);
          const incomeAfter = Number(afterRow?.incomeAfter || 0);
          const expenseAfter = Number(afterRow?.expenseAfter || 0);
          currentBalance = Number(latestRow.balance) + incomeAfter - expenseAfter;
        } else {
          // No balance record at all, use initial + total net flow
          currentBalance = initial + income - expense;
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
  setAccountBalance: financeProcedure
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
  getPendingDescriptions: financeProcedure
    .input(z.object({
      entity: z.enum(["japan", "china"]).default("china"),
      month: z.string().optional(), // "2026-07" format
    }))
    .query(async ({ input, ctx }) => {
      const pool = getPool();
      const payrollVisibilitySql = await hasPayrollAccess(ctx) ? "" : ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`;
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
        ${payrollVisibilitySql}
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
        ${payrollVisibilitySql}
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
        ${payrollVisibilitySql}
        AND amount < ? ${monthFilter}
        AND counterparty IS NOT NULL AND counterparty != ''
        GROUP BY counterparty
        HAVING SUM(amount) > ?
        ORDER BY totalAmount DESC
      `, [input.entity, threshold, anomalyThreshold]) as any;
      
      return { items: largeItems, autoFilled, anomalies };
    }),

  // 一括で説明を更新
  bulkUpdateDescriptions: financeProcedure
    .input(z.object({
      updates: z.array(z.object({
        id: z.number(),
        description: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      let updated = 0;
      for (const u of input.updates) {
        await requirePayrollAccessForCashflowRow(pool, ctx, u.id);
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
  getAuditLog: financeProcedure
    .input(z.object({
      cashflowId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const pool = getPool();
      await requirePayrollAccessForCashflowRow(pool, ctx, input.cashflowId);
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

  // 請求書アップロード
  uploadReceipt: financeProcedure
    .input(z.object({
      id: z.number(),
      fileData: z.string(), // base64 encoded file
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      await requirePayrollAccessForCashflowRow(pool, ctx, input.id);
      const buffer = Buffer.from(input.fileData, 'base64');
      const fileKey = `cashflow-receipts/${input.id}/${Date.now()}-${input.fileName}`;
      // Support multiple receipts: append to existing JSON array
      const [existing] = await pool.query(`SELECT receiptUrl FROM company_cashflows WHERE id = ?`, [input.id]) as any;
      const urls = parseCashflowReceiptUrls(existing[0]?.receiptUrl);
      if (!canAppendCashflowReceipts(urls.length)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `添付ファイルは最大${MAX_CASHFLOW_RECEIPTS}件までです`,
        });
      }
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      urls.push(url);
      await pool.query(
        `UPDATE company_cashflows SET receiptUrl = ? WHERE id = ?`,
        [JSON.stringify(urls), input.id]
      );
      return { success: true, url };
    }),

  // 請求書削除: multi-file safe, audited and idempotent.
  deleteReceipt: financeProcedure
    .input(z.object({
      id: z.number().int().positive(),
      index: z.number().int().min(0).optional(),
      url: z.string().min(1).max(8192).optional(),
    }).refine((value) => value.index !== undefined || Boolean(value.url), {
      message: "削除する添付ファイルを指定してください",
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const connection = await pool.getConnection();
      let result: ReturnType<typeof removeCashflowReceiptAt> | null = null;
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
          `SELECT id, receiptUrl, category, payrollRecordKey, payrollMonth, payrollEmployee
             FROM company_cashflows
            WHERE id = ? AND deletedAt IS NULL
            LIMIT 1 FOR UPDATE`,
          [input.id],
        ) as any;
        const row = rows[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "対象の入出金記録が見つかりません" });
        if (isPayrollCategory(row.category) || row.payrollRecordKey || row.payrollMonth || row.payrollEmployee) {
          await requirePayrollAccess(ctx);
        }

        const beforeUrls = parseCashflowReceiptUrls(row.receiptUrl);
        result = removeCashflowReceiptAt(beforeUrls, input.index, input.url);
        if (!result.removedUrl) {
          await connection.commit();
          return { success: true, deleted: false, alreadyDeleted: true, remaining: beforeUrls.length };
        }

        await connection.query(
          `UPDATE company_cashflows SET receiptUrl = ? WHERE id = ? AND deletedAt IS NULL`,
          [result.urls.length > 0 ? JSON.stringify(result.urls) : null, input.id],
        );
        await connection.query(
          `INSERT INTO cashflow_audit_log (cashflowId, action, userId, userName, changes)
           VALUES (?, 'update', ?, ?, ?)`,
          [
            input.id,
            (ctx as any).user?.id || null,
            (ctx as any).user?.name || "不明",
            JSON.stringify({
              receiptAction: "delete",
              removedIndex: result.removedIndex,
              beforeCount: beforeUrls.length,
              afterCount: result.urls.length,
              originalFileRetainedInPrivateStorage: true,
            }),
          ],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      await logCashflowActivity(ctx, "receipt_delete", input.id, `請求書添付削除: ID=${input.id}`, {
        removedIndex: result?.removedIndex,
        remaining: result?.urls.length,
        originalFileRetainedInPrivateStorage: true,
      });
      return { success: true, deleted: true, alreadyDeleted: false, remaining: result?.urls.length || 0 };
    }),
});
