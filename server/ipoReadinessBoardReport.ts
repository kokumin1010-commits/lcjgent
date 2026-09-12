import type { Pool } from "mysql2/promise";
import { CASHFLOW_INTERNAL_TRANSFER_CATEGORIES, CASHFLOW_REFERENCE_CNY_JPY, buildCashflowMonthlySummary } from "./cashflowMonthlySummary";
import { buildIpoReadinessCommandCenter } from "./ipoReadinessCommandCenter";
import { listIpoReadinessMonthlyPnl } from "./ipoReadinessMonthlyPnl";
import { listIpoReadinessOperations } from "./ipoReadinessOperations";
import {
  buildIpoBoardReportSummary,
  buildIpoCashExpenseDrivers,
  buildIpoCloseQuality,
  buildIpoMonthlyTrend,
  buildIpoPerformanceVariance,
  buildIpoProfitBridge,
  buildIpoRiskRegister,
  buildIpoScenarios,
  buildIpoTargetReverse,
  buildIpoTaskReadiness,
} from "./ipoReadinessPlanning";

export async function buildIpoBoardReportDraftFromDatabase(pool: Pool, now = new Date()) {
  const internalCategories = [...CASHFLOW_INTERNAL_TRANSFER_CATEGORIES];
  const [monthlyPnl, operations, cashResult, duplicateResult, linkedTransferResult, expenseResult] = await Promise.all([
    listIpoReadinessMonthlyPnl(pool),
    listIpoReadinessOperations(pool),
    pool.query(`
      SELECT LEFT(transactionDate,7) AS month,entity,currency,category,type,SUM(amount) AS totalAmount,COUNT(*) AS recordCount
      FROM company_cashflows
      WHERE deletedAt IS NULL AND transactionDate >= '2026-08-01'
      GROUP BY month,entity,currency,category,type
      ORDER BY month ASC
    `),
    pool.query(`
      SELECT month,COUNT(*) AS duplicateCandidateGroupCount,COALESCE(SUM(rowCount),0) AS duplicateCandidateRowCount
      FROM (
        SELECT LEFT(transactionDate,7) AS month,COUNT(*) AS rowCount
        FROM company_cashflows
        WHERE deletedAt IS NULL AND transactionDate >= '2026-08-01'
        GROUP BY LEFT(transactionDate,7),entity,currency,type,transactionDate,amount,category,COALESCE(counterparty,''),COALESCE(sourceAccount,'')
        HAVING COUNT(*) > 1
      ) candidates
      GROUP BY month
    `),
    pool.query(`
      SELECT month,COUNT(DISTINCT transferId) AS linkedTransferCount
      FROM (
        SELECT transfer.id AS transferId,LEFT(source.transactionDate,7) AS month
        FROM cashflow_internal_transfers transfer
        INNER JOIN company_cashflows source ON source.id=transfer.sourceCashflowId
        WHERE transfer.status='linked' AND source.deletedAt IS NULL AND source.transactionDate >= '2026-08-01'
        UNION ALL
        SELECT transfer.id AS transferId,LEFT(destination.transactionDate,7) AS month
        FROM cashflow_internal_transfers transfer
        INNER JOIN company_cashflows destination ON destination.id=transfer.destinationCashflowId
        WHERE transfer.status='linked' AND destination.deletedAt IS NULL AND destination.transactionDate >= '2026-08-01'
      ) linked
      GROUP BY month
    `),
    pool.query(`
      SELECT LEFT(transactionDate,7) AS month,category,currency,SUM(amount) AS totalAmount,COUNT(*) AS recordCount
      FROM company_cashflows
      WHERE deletedAt IS NULL AND transactionDate >= '2026-08-01' AND type='expense'
        AND category NOT IN (${internalCategories.map(() => "?").join(",")})
      GROUP BY month,category,currency
    `, internalCategories),
  ]);
  const duplicateRows = duplicateResult[0] as any[];
  const linkedRows = linkedTransferResult[0] as any[];
  const cashMonths = buildCashflowMonthlySummary(cashResult[0] as any[], 48).map((row) => {
    const duplicate = duplicateRows.find((candidate) => String(candidate.month || "") === row.month);
    const linked = linkedRows.find((candidate) => String(candidate.month || "") === row.month);
    return {
      month: row.month,
      operatingIncomeJpy: row.operatingIncome.jpy,
      operatingIncomeCny: row.operatingIncome.cny,
      operatingIncomeReferenceJpy: row.operatingIncome.referenceJpy,
      operatingIncomeCount: row.operatingIncome.count,
      operatingExpenseJpy: row.operatingExpense.jpy,
      operatingExpenseCny: row.operatingExpense.cny,
      operatingExpenseReferenceJpy: row.operatingExpense.referenceJpy,
      operatingExpenseCount: row.operatingExpense.count,
      internalTransferIncomeJpy: row.internalTransferIncome.jpy,
      internalTransferIncomeCny: row.internalTransferIncome.cny,
      internalTransferIncomeReferenceJpy: row.internalTransferIncome.referenceJpy,
      internalTransferIncomeCount: row.internalTransferIncome.count,
      internalTransferExpenseJpy: row.internalTransferExpense.jpy,
      internalTransferExpenseCny: row.internalTransferExpense.cny,
      internalTransferExpenseReferenceJpy: row.internalTransferExpense.referenceJpy,
      internalTransferExpenseCount: row.internalTransferExpense.count,
      operatingNetReferenceJpy: row.operatingNetReferenceJpy,
      bankNetReferenceJpy: row.bankNetReferenceJpy,
      duplicateCandidateGroupCount: Number(duplicate?.duplicateCandidateGroupCount || 0),
      duplicateCandidateRowCount: Number(duplicate?.duplicateCandidateRowCount || 0),
      linkedTransferCount: Number(linked?.linkedTransferCount || 0),
    };
  });
  const core = buildIpoReadinessCommandCenter({ monthlyPnl, cashReferenceMonths: cashMonths, now });
  const trend = buildIpoMonthlyTrend({ core, monthlyPlans: operations.monthlyPlans });
  const targetReverse = buildIpoTargetReverse({ core, settings: operations.settings });
  const performanceVariance = buildIpoPerformanceVariance(trend);
  const scenarios = buildIpoScenarios({ core, settings: operations.settings });
  const profitBridge = buildIpoProfitBridge(core);
  const closeQuality = buildIpoCloseQuality({ core, monthlyCloseDueDay: operations.settings.monthlyCloseDueDay });
  const taskReadiness = buildIpoTaskReadiness({ tasks: operations.tasks, asOf: core.asOf });
  const expenseRows = (expenseResult[0] as any[])
    .filter((row) => String(row.month || "") >= core.currentStage.startDate.slice(0, 7) && String(row.month || "") <= core.currentStage.endDate.slice(0, 7))
    .map((row) => {
      const amount = Number(row.totalAmount || 0);
      const currency = row.currency === "CNY" ? "CNY" as const : "JPY" as const;
      return {
        category: String(row.category || "未分类"),
        currency,
        amount,
        referenceJpy: currency === "CNY" ? amount * CASHFLOW_REFERENCE_CNY_JPY : amount,
        recordCount: Number(row.recordCount || 0),
      };
    });
  const cashExpenseDrivers = buildIpoCashExpenseDrivers(expenseRows);
  const risks = buildIpoRiskRegister({ core, closeQuality, taskReadiness });
  return buildIpoBoardReportSummary({ core, trend, targetReverse, performanceVariance, scenarios, profitBridge, closeQuality, taskReadiness, risks, cashExpenseDrivers });
}
