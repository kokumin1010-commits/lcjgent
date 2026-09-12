import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";

const EXPECTED_KEY_HASH = "09f22718e8db8caaa30a2a1598cc819479d709d96a202512d0c559f7c27dc0ad";

function assertKey(value: string) {
  const actual = createHash("sha256").update(value).digest("hex");
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(EXPECTED_KEY_HASH, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("NOT_FOUND");
}

export const cashflowInternalTransferAuditRouter = router({
  preview: publicProcedure
    .input(z.object({ key: z.string().min(32).max(256) }))
    .query(async ({ input }) => {
      assertKey(input.key);
      if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
      const pool = mysql.createPool(process.env.DATABASE_URL);
      try {
        const [internalRows] = await pool.query(`
          SELECT id,entity,type,category,amount,currency,transactionDate,sourceAccount
            FROM company_cashflows
           WHERE deletedAt IS NULL
             AND category IN ('本社送金','口座間振替')
           ORDER BY transactionDate DESC,amount DESC,id DESC
        `) as any;
        const sourceExpenses = (internalRows as any[]).filter(row => row.type === "expense");
        const candidates: Array<Record<string, unknown>> = [];
        for (const source of sourceExpenses) {
          const [rows] = await pool.query(`
            SELECT id,entity,type,category,amount,currency,transactionDate,sourceAccount,
                   ABS(DATEDIFF(transactionDate, ?)) AS dayDistance
              FROM company_cashflows
             WHERE deletedAt IS NULL
               AND type='income'
               AND entity<>?
               AND currency<>?
               AND transactionDate BETWEEN DATE_SUB(?, INTERVAL 21 DAY) AND DATE_ADD(?, INTERVAL 21 DAY)
             ORDER BY dayDistance ASC, amount DESC, id DESC
             LIMIT 20
          `, [source.transactionDate, source.entity, source.currency, source.transactionDate, source.transactionDate]) as any;
          for (const candidate of rows as any[]) {
            const jpy = source.currency === "JPY" ? Number(source.amount || 0) : Number(candidate.amount || 0);
            const cny = source.currency === "CNY" ? Number(source.amount || 0) : Number(candidate.amount || 0);
            const rate = jpy > 0 && cny > 0 ? jpy / cny : null;
            if (rate != null && rate >= 15 && rate <= 30) {
              candidates.push({
                sourceCashflowId: Number(source.id),
                candidateCashflowId: Number(candidate.id),
                sourceDate: String(source.transactionDate || ""),
                candidateDate: String(candidate.transactionDate || ""),
                sourceAmount: Number(source.amount || 0),
                sourceCurrency: String(source.currency || ""),
                candidateAmount: Number(candidate.amount || 0),
                candidateCurrency: String(candidate.currency || ""),
                candidateCategory: String(candidate.category || ""),
                dayDistance: Number(candidate.dayDistance || 0),
                impliedJpyPerCny: Math.round(rate * 100000000) / 100000000,
              });
            }
          }
        }
        const [linkedRows] = await pool.query(`SELECT COUNT(*) AS total FROM cashflow_internal_transfers WHERE status='linked'`) as any;
        return {
          piiReturned: false,
          readOnly: true,
          internalRows: (internalRows as any[]).map(row => ({
            cashflowId: Number(row.id),
            entity: row.entity,
            type: row.type,
            category: row.category,
            amount: Number(row.amount || 0),
            currency: row.currency,
            transactionDate: row.transactionDate,
            sourceAccount: row.sourceAccount || null,
          })),
          candidates,
          linkedTransferCount: Number(linkedRows?.[0]?.total || 0),
        };
      } finally {
        await pool.end();
      }
    }),
});
