import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { linkCashflowInternalTransfer } from "./cashflowInternalTransfer";

const EXPECTED_KEY_HASH = "09f22718e8db8caaa30a2a1598cc819479d709d96a202512d0c559f7c27dc0ad";
const CONFIRMATION = "CONFIRM_LINK_VERIFIED_INTERNAL_TRANSFERS";
const VERIFIED_PAIRS = [
  { sourceId: 1551, destinationId: 1552, category: "本社送金", sourceDate: "2026-09-08", destinationDate: "2026-09-09", sourceAmount: 3509500, principal: 3500000, destinationAmount: 152173 },
  { sourceId: 529, destinationId: 235, category: "本社送金", sourceDate: "2026-08-07", destinationDate: "2026-08-10", sourceAmount: 14014000, principal: 14000000, destinationAmount: 591822 },
  { sourceId: 485, destinationId: 411, category: "本社送金", sourceDate: "2026-07-06", destinationDate: "2026-07-10", sourceAmount: 7010500, principal: 7000000, destinationAmount: 292026 },
  { sourceId: 473, destinationId: 329, category: "本社送金", sourceDate: "2026-06-09", destinationDate: "2026-06-10", sourceAmount: 7010500, principal: 7000000, destinationAmount: 294350 },
  { sourceId: 462, destinationId: 269, category: "本社送金", sourceDate: "2026-05-07", destinationDate: "2026-05-09", sourceAmount: 10012000, principal: 10000000, destinationAmount: 431720 },
  { sourceId: 824, destinationId: 446, category: "口座間振替", sourceDate: "2026-03-05", destinationDate: "2026-03-05", sourceAmount: 20000000, principal: 20000000, destinationAmount: 20000000 },
] as const;

function assertKey(value: string) {
  const actual = createHash("sha256").update(value).digest("hex");
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(EXPECTED_KEY_HASH, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("NOT_FOUND");
}

export const cashflowInternalTransferAuditRouter = router({
  linkVerifiedPairs: publicProcedure
    .input(z.object({ key: z.string().min(32).max(256), confirmation: z.literal(CONFIRMATION) }))
    .mutation(async ({ input }) => {
      assertKey(input.key);
      if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
      const pool = mysql.createPool(process.env.DATABASE_URL);
      const linked: number[] = [];
      const skipped: number[] = [];
      const failed: Array<{ sourceId: number; code: string }> = [];
      try {
        for (const pair of VERIFIED_PAIRS) {
          try {
            const [rows] = await pool.query(
              `SELECT id,entity,type,category,amount,currency,transactionDate,sourceAccount,deletedAt
                 FROM company_cashflows WHERE id IN (?,?) ORDER BY id`,
              [pair.sourceId, pair.destinationId],
            ) as any;
            const source = (rows as any[]).find(row => Number(row.id) === pair.sourceId);
            const destination = (rows as any[]).find(row => Number(row.id) === pair.destinationId);
            const valid = source && destination && !source.deletedAt && !destination.deletedAt
              && source.type === "expense" && destination.type === "income"
              && source.category === pair.category && destination.category === pair.category
              && String(source.transactionDate) === pair.sourceDate && String(destination.transactionDate) === pair.destinationDate
              && Number(source.amount) === pair.sourceAmount && Number(destination.amount) === pair.destinationAmount;
            if (!valid) { failed.push({ sourceId: pair.sourceId, code: "EVIDENCE_MISMATCH" }); continue; }
            const [existing] = await pool.query(
              `SELECT id FROM cashflow_internal_transfers
                WHERE status='linked' AND (activeSourceCashflowId=? OR activeDestinationCashflowId=? OR activeSourceCashflowId=? OR activeDestinationCashflowId=?) LIMIT 1`,
              [pair.sourceId, pair.sourceId, pair.destinationId, pair.destinationId],
            ) as any;
            if ((existing as any[]).length > 0) { skipped.push(pair.sourceId); continue; }
            await linkCashflowInternalTransfer(pool, {
              sourceCashflowId: pair.sourceId,
              destinationCashflowId: pair.destinationId,
              sourceTransferAmount: pair.principal,
              note: "历史银行流水双边核对后关联",
            });
            linked.push(pair.sourceId);
          } catch (error: any) {
            failed.push({ sourceId: pair.sourceId, code: String(error?.code || error?.message || "LINK_FAILED").slice(0, 120) });
          }
        }
        const [counts] = await pool.query(`SELECT status,COUNT(*) AS total FROM cashflow_internal_transfers GROUP BY status`) as any;
        return { piiReturned: false, linkedCount: linked.length, skippedCount: skipped.length, failedCount: failed.length, linked, skipped, failed, statusCounts: counts };
      } finally {
        await pool.end();
      }
    }),

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
        const [linkedDetails] = await pool.query(`
          SELECT sourceCashflowId,destinationCashflowId,sourceAmount,sourceTransferAmount,sourceFeeAmount,
                 sourceCurrency,destinationAmount,destinationCurrency,actualJpyPerCny,status
            FROM cashflow_internal_transfers
           WHERE status='linked'
           ORDER BY sourceCashflowId
        `) as any;
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
          linkedDetails: (linkedDetails as any[]).map(row => ({
            sourceCashflowId: Number(row.sourceCashflowId),
            destinationCashflowId: Number(row.destinationCashflowId),
            sourceAmount: Number(row.sourceAmount),
            sourceTransferAmount: Number(row.sourceTransferAmount),
            sourceFeeAmount: Number(row.sourceFeeAmount),
            sourceCurrency: row.sourceCurrency,
            destinationAmount: Number(row.destinationAmount),
            destinationCurrency: row.destinationCurrency,
            actualJpyPerCny: row.actualJpyPerCny == null ? null : Number(row.actualJpyPerCny),
            status: row.status,
          })),
        };
      } finally {
        await pool.end();
      }
    }),
});
