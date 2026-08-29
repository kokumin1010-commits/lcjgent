import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { PAYROLL_PROTECTED_ROW_SQL } from "./payrollAccess";
import { buildCashflowReconciliation } from "./cashflowReconciliation";

const AUDIT_KEY_SHA256 = "46b8ff0f9f3b9c4a83229b9489a35c1bc247546b69cb873be24c082f0a4ca494";

function requireAuditKey(key: string) {
  const actual = Buffer.from(createHash("sha256").update(key.trim()).digest("hex"), "utf8");
  const expected = Buffer.from(AUDIT_KEY_SHA256, "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export const cashflowReconciliationAuditRouter = router({
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(32).max(256) }))
    .mutation(async ({ input }) => {
      requireAuditKey(input.key);
      if (!process.env.DATABASE_URL) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const connection = await mysql.createConnection(process.env.DATABASE_URL);
      try {
        const [monthRows] = await connection.query(`
          SELECT LEFT(transactionDate, 7) AS month, entity, currency, type,
            COUNT(*) AS rowCount, ROUND(SUM(amount), 2) AS totalAmount,
            SUM(CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN 1 ELSE 0 END) AS payrollRowCount,
            ROUND(SUM(CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN amount ELSE 0 END), 2) AS payrollAmount
          FROM company_cashflows
          WHERE deletedAt IS NULL AND transactionDate >= '2026-03-01' AND transactionDate <= '2026-08-31'
          GROUP BY LEFT(transactionDate, 7), entity, currency, type
          ORDER BY month ASC, entity ASC, type ASC
        `) as any;
        const [juneRows] = await connection.query(`
          SELECT id, entity, type, category, amount, currency, transactionDate,
            sourceAccount, CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN 1 ELSE 0 END AS isPayroll
          FROM company_cashflows
          WHERE deletedAt IS NULL AND type = 'expense'
            AND transactionDate >= '2026-06-01' AND transactionDate <= '2026-06-30'
        `) as any;
        const [julyChinaRows] = await connection.query(`
          SELECT id, entity, type, category, amount, currency, transactionDate,
            sourceAccount, CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN 1 ELSE 0 END AS isPayroll
          FROM company_cashflows
          WHERE deletedAt IS NULL AND entity = 'china' AND type = 'expense'
            AND transactionDate >= '2026-07-01' AND transactionDate <= '2026-07-31'
        `) as any;
        const reconciliation = buildCashflowReconciliation((juneRows as any[]).map(row => ({
          id: Number(row.id),
          entity: row.entity,
          type: row.type,
          category: String(row.category || ""),
          amount: Number(row.amount || 0),
          currency: row.currency,
          transactionDate: String(row.transactionDate || ""),
          sourceAccount: row.sourceAccount == null ? null : String(row.sourceAccount),
          isPayroll: Number(row.isPayroll || 0) === 1,
        })), { payrollUnlocked: false, exchangeRate: 20.5 });

        const julyChinaReconciliation = buildCashflowReconciliation((julyChinaRows as any[]).map(row => ({
          id: Number(row.id),
          entity: row.entity,
          type: row.type,
          category: String(row.category || ""),
          amount: Number(row.amount || 0),
          currency: row.currency,
          transactionDate: String(row.transactionDate || ""),
          sourceAccount: row.sourceAccount == null ? null : String(row.sourceAccount),
          isPayroll: Number(row.isPayroll || 0) === 1,
        })), { payrollUnlocked: true, exchangeRate: 20.5 });

        return {
          piiReturned: false,
          readOnly: true,
          period: { start: "2026-06-01", end: "2026-06-30" },
          monthGroups: (monthRows as any[]).map(row => ({
            month: String(row.month),
            entity: String(row.entity),
            currency: String(row.currency),
            type: String(row.type),
            rowCount: Number(row.rowCount || 0),
            totalAmount: Number(row.totalAmount || 0),
            payrollRowCount: Number(row.payrollRowCount || 0),
            payrollAmount: Number(row.payrollAmount || 0),
          })),
          julyChinaExpense: {
            sourceRowCount: julyChinaReconciliation.sourceRowCount,
            totals: julyChinaReconciliation.totals,
            reconstructed: julyChinaReconciliation.reconstructed,
            difference: julyChinaReconciliation.difference,
            items: julyChinaReconciliation.items.map(item => ({
              sequence: item.sequence,
              currency: item.currency,
              amount: item.amount,
              runningCny: item.runningCny,
              payrollProtectedSource: Boolean((julyChinaRows as any[]).find(row => Number(row.id) === Number(item.id) && Number(row.isPayroll || 0) === 1)),
            })),
          },
          juneExpense: {
            sourceRowCount: reconciliation.sourceRowCount,
            displayRowCount: reconciliation.displayRowCount,
            protectedPayrollRowCount: reconciliation.protectedPayrollRowCount,
            totals: reconciliation.totals,
            reconstructed: reconciliation.reconstructed,
            difference: reconciliation.difference,
            items: reconciliation.items.map(item => ({
              sequence: item.sequence,
              currency: item.currency,
              amount: item.amount,
              referenceAmountJpy: item.referenceAmountJpy,
              runningJpy: item.runningJpy,
              runningCny: item.runningCny,
              runningReferenceJpy: item.runningReferenceJpy,
              payrollProtected: item.payrollProtected,
              groupedCount: item.groupedCount,
            })),
          },
        };
      } finally {
        await connection.end();
      }
    }),
});
