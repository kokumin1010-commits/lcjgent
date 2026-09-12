import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { buildCashflowMonthlySummary } from "./cashflowMonthlySummary";

const EXPECTED_KEY_SHA256 = "cca31285e6347a086d0b87392ca2d6f9768ff56a7ed34535ed25cbbaf8f6b4ca";
const TARGET_MONTH = "2026-08";

function requireAuditKey(key: string) {
  const expected = Buffer.from(EXPECTED_KEY_SHA256, "hex");
  const actual = createHash("sha256").update(key.trim()).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Audit key invalid" });
  }
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  }
  return mysql.createPool(process.env.DATABASE_URL);
}

function numericRow(row: Record<string, unknown>) {
  const numberFields = new Set(["totalAmount", "recordCount", "duplicateGroupCount", "duplicateRowCount", "linkedTransferCount"]);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, numberFields.has(key) ? Number(value || 0) : value]));
}

export const augustCashflowAuditRouter = router({
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(32) }))
    .query(async ({ input }) => {
      requireAuditKey(input.key);
      const pool = createPool();
      try {
        const [groupRowsRaw] = await pool.query(`
          SELECT
            LEFT(transactionDate, 7) AS month,
            entity,
            currency,
            COALESCE(category, '') AS category,
            type,
            SUM(amount) AS totalAmount,
            COUNT(*) AS recordCount
          FROM company_cashflows
          WHERE deletedAt IS NULL
            AND transactionDate >= '2026-08-01'
            AND transactionDate < '2026-09-01'
          GROUP BY LEFT(transactionDate, 7), entity, currency, COALESCE(category, ''), type
          ORDER BY entity, currency, type, category
        `) as any;
        const groupRows = (groupRowsRaw as any[]).map(numericRow);
        const monthly = buildCashflowMonthlySummary(groupRows as any, 20.5).find((row) => row.month === TARGET_MONTH) || null;

        const [duplicateRowsRaw] = await pool.query(`
          SELECT COUNT(*) AS duplicateGroupCount, COALESCE(SUM(rowCount), 0) AS duplicateRowCount
          FROM (
            SELECT COUNT(*) AS rowCount
            FROM company_cashflows
            WHERE deletedAt IS NULL
              AND transactionDate >= '2026-08-01'
              AND transactionDate < '2026-09-01'
            GROUP BY entity, currency, type, transactionDate, amount, category, COALESCE(counterparty, ''), COALESCE(sourceAccount, '')
            HAVING COUNT(*) > 1
          ) duplicated
        `) as any;

        const [linkedRowsRaw] = await pool.query(`
          SELECT COUNT(*) AS linkedTransferCount
          FROM cashflow_internal_transfers
          WHERE status='linked'
            AND (
              sourceCashflowId IN (
                SELECT id FROM company_cashflows
                WHERE deletedAt IS NULL AND transactionDate >= '2026-08-01' AND transactionDate < '2026-09-01'
              )
              OR destinationCashflowId IN (
                SELECT id FROM company_cashflows
                WHERE deletedAt IS NULL AND transactionDate >= '2026-08-01' AND transactionDate < '2026-09-01'
              )
            )
        `) as any;

        const [pnlRowsRaw] = await pool.query(`
          SELECT month, revenueJpy, grossProfitJpy, operatingProfitJpy, netProfitJpy, status, updatedAt
          FROM finance_monthly_pnl
          WHERE month='2026-08'
          LIMIT 1
        `) as any;
        const pnlRow = (pnlRowsRaw as any[])[0] || null;

        return {
          piiReturned: false,
          readOnly: true,
          targetMonth: TARGET_MONTH,
          referenceRate: { cnyToJpy: 20.5, label: "management_reference_only" },
          groupedRows: groupRows,
          monthly,
          duplicateCheck: numericRow((duplicateRowsRaw as any[])[0] || {}),
          linkedTransferCount: Number((linkedRowsRaw as any[])[0]?.linkedTransferCount || 0),
          formalMonthlyPnl: pnlRow ? {
            month: String(pnlRow.month),
            revenueJpy: Number(pnlRow.revenueJpy || 0),
            grossProfitJpy: Number(pnlRow.grossProfitJpy || 0),
            operatingProfitJpy: Number(pnlRow.operatingProfitJpy || 0),
            netProfitJpy: pnlRow.netProfitJpy == null ? null : Number(pnlRow.netProfitJpy),
            status: String(pnlRow.status),
            updatedAt: pnlRow.updatedAt,
          } : null,
          evidenceBoundary: {
            bankCashflowComplete: Boolean(monthly),
            formalProfitAvailable: Boolean(pnlRow && (pnlRow.status === "closed" || pnlRow.status === "audited")),
            cashflowIsAccountingProfit: false,
          },
        };
      } finally {
        await pool.end();
      }
    }),
});
