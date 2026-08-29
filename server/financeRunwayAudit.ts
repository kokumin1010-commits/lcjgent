import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { ACTIVE_CASHFLOW_ACCOUNTS } from "./cashflowHelpers";
import { buildFinanceCommandCenter } from "./financeCommandCenter";

const EXPECTED_KEY_SHA256 = "6db0dd3683d3baf0984c062e64c9902b510299db52a899b0a85df8b0225477bc";
const TRANSFER_LIKE_CATEGORIES = ["本社送金", "振込", "世曜元宇資金", "花秘代付", "品汇盟代付"];

function requireAuditKey(key: string) {
  const expected = Buffer.from(EXPECTED_KEY_SHA256, "hex");
  const actual = createHash("sha256").update(key.trim()).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Audit key invalid" });
  }
}

function pool() {
  if (!process.env.DATABASE_URL) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return mysql.createPool(process.env.DATABASE_URL);
}

function numberRows(rows: any[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (["count", "income", "expense", "net", "amount", "totalAmount", "groupCount", "rowCount", "initialBalance", "latestBalance", "netFlow", "netFlowAfter", "currentBalance"].includes(key)) {
      return [key, Number(value || 0)];
    }
    return [key, value];
  })));
}

export const financeRunwayAuditRouter = router({
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(32) }))
    .query(async ({ input }) => {
      requireAuditKey(input.key);
      const db = pool();
      try {
        const [dateRows] = await db.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS serverDate`) as any;
        const [windowRows] = await db.query(`
          SELECT windowDays, entity, currency, type, COUNT(*) AS count, SUM(amount) AS amount
          FROM (
            SELECT 7 AS windowDays, entity, currency, type, amount
            FROM company_cashflows
            WHERE deletedAt IS NULL AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
            UNION ALL
            SELECT 30 AS windowDays, entity, currency, type, amount
            FROM company_cashflows
            WHERE deletedAt IS NULL AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 29 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
            UNION ALL
            SELECT 90 AS windowDays, entity, currency, type, amount
            FROM company_cashflows
            WHERE deletedAt IS NULL AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 89 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
          ) scoped
          GROUP BY windowDays, entity, currency, type
          ORDER BY windowDays, entity, currency, type
        `) as any;
        const [categoryRows] = await db.query(`
          SELECT entity, currency, type, category, COUNT(*) AS count, SUM(amount) AS amount,
                 MIN(transactionDate) AS firstDate, MAX(transactionDate) AS lastDate
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 89 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
          GROUP BY entity, currency, type, category
          ORDER BY currency, type, amount DESC
        `) as any;
        const [category30Rows] = await db.query(`
          SELECT entity, currency, type, category, COUNT(*) AS count, SUM(amount) AS amount,
                 MIN(transactionDate) AS firstDate, MAX(transactionDate) AS lastDate
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 29 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
          GROUP BY entity, currency, type, category
          ORDER BY currency, type, amount DESC
        `) as any;
        const [monthlyRows] = await db.query(`
          SELECT LEFT(transactionDate, 7) AS month, entity, currency, type, COUNT(*) AS count, SUM(amount) AS amount
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 179 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
          GROUP BY LEFT(transactionDate, 7), entity, currency, type
          ORDER BY month, entity, currency, type
        `) as any;
        const transferPlaceholders = TRANSFER_LIKE_CATEGORIES.map(() => "?").join(",");
        const [transferRows] = await db.query(`
          SELECT entity, currency, type, category, COUNT(*) AS count, SUM(amount) AS amount
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 89 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
            AND category IN (${transferPlaceholders})
          GROUP BY entity, currency, type, category
          ORDER BY currency, type, amount DESC
        `, TRANSFER_LIKE_CATEGORIES) as any;
        const [duplicateRows] = await db.query(`
          SELECT entity, currency, type, transactionDate, amount, category, COUNT(*) AS rowCount
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate BETWEEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 89 DAY), '%Y-%m-%d') AND DATE_FORMAT(CURDATE(), '%Y-%m-%d')
          GROUP BY entity, currency, type, transactionDate, amount, category, COALESCE(counterparty, '')
          HAVING COUNT(*) > 1
          ORDER BY rowCount DESC, amount DESC
          LIMIT 100
        `) as any;
        const [commandRows] = await db.query(`
          SELECT id, entity, type, category, amount, currency, transactionDate, sourceAccount
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 120 DAY), '%Y-%m-%d')
          ORDER BY transactionDate DESC, id DESC
        `) as any;
        const [balanceRows] = await db.query(`
          SELECT b.accountName, b.initialBalance, b.currency, b.entity,
                 latest.balance AS latestBalance, latest.transactionDate AS latestBalanceDate,
                 COALESCE(all_flow.netFlow, 0) AS netFlow,
                 COALESCE(after_flow.netFlowAfter, 0) AS netFlowAfter,
                 CASE WHEN latest.balance IS NULL THEN b.initialBalance + COALESCE(all_flow.netFlow, 0)
                      ELSE latest.balance + COALESCE(after_flow.netFlowAfter, 0) END AS currentBalance
          FROM bank_account_balances b
          LEFT JOIN (
            SELECT t1.sourceAccount, t1.balance, t1.transactionDate
            FROM company_cashflows t1
            INNER JOIN (
              SELECT sourceAccount, MAX(id) AS maxId
              FROM company_cashflows
              WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != '' AND balance IS NOT NULL
              GROUP BY sourceAccount
            ) t2 ON t1.id = t2.maxId
            WHERE t1.deletedAt IS NULL
          ) latest ON latest.sourceAccount = b.accountName
          LEFT JOIN (
            SELECT sourceAccount, SUM(CASE WHEN type='income' THEN amount ELSE -amount END) AS netFlow
            FROM company_cashflows WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND sourceAccount != '' GROUP BY sourceAccount
          ) all_flow ON all_flow.sourceAccount = b.accountName
          LEFT JOIN (
            SELECT cf.sourceAccount, SUM(CASE WHEN cf.type='income' THEN cf.amount ELSE -cf.amount END) AS netFlowAfter
            FROM company_cashflows cf
            INNER JOIN (
              SELECT sourceAccount, MAX(transactionDate) AS lastBalanceDate
              FROM company_cashflows
              WHERE deletedAt IS NULL AND sourceAccount IS NOT NULL AND balance IS NOT NULL
              GROUP BY sourceAccount
            ) d ON d.sourceAccount=cf.sourceAccount AND cf.transactionDate>d.lastBalanceDate
            WHERE cf.deletedAt IS NULL GROUP BY cf.sourceAccount
          ) after_flow ON after_flow.sourceAccount = b.accountName
          ORDER BY b.accountName
        `) as any;
        const serverDate = String(dateRows[0]?.serverDate || "");
        const activeBalanceRows = numberRows(balanceRows).filter((row: any) => ACTIVE_CASHFLOW_ACCOUNTS.includes(row.accountName));
        const computed = buildFinanceCommandCenter({
          now: `${serverDate}T00:00:00Z`,
          rows: numberRows(commandRows) as any,
          balances: activeBalanceRows.map((row: any) => ({
            accountName: row.accountName,
            entity: row.entity,
            currency: row.currency,
            amount: row.currentBalance,
            asOf: row.latestBalanceDate || null,
          })),
          importDocuments: [],
        });
        return {
          serverDate,
          windows: numberRows(windowRows),
          categories30d: numberRows(category30Rows),
          categories90d: numberRows(categoryRows),
          months180d: numberRows(monthlyRows),
          transferLike90d: numberRows(transferRows),
          duplicateGroups90d: numberRows(duplicateRows),
          balances: numberRows(balanceRows),
          computed: {
            balances: computed.balances,
            flows: computed.flows,
            runway: computed.runway,
          },
          piiReturned: false,
        };
      } finally {
        await db.end();
      }
    }),
});
