import type mysql from "mysql2/promise";
import { resolveBankPayrollMetadata } from "./cashflowHelpers";

export type BankPayrollCashflow = {
  id: number;
  entity: "japan" | "china";
  type: "income" | "expense";
  category?: string | null;
  amount: number;
  currency: "JPY" | "CNY";
  transactionDate: string;
  description?: string | null;
  counterparty?: string | null;
  sourceAccount?: string | null;
  payrollMonth?: string | null;
  payrollEmployee?: string | null;
};

type Queryable =
  | Pick<mysql.Pool, "query">
  | Pick<mysql.PoolConnection, "query">;

type PayrollSyncContext = {
  fileName: string;
  importedBy?: number | null;
  batchIds?: Map<string, number>;
};

export type BankPayrollSyncResult = {
  status: "created" | "updated" | "relinked" | "skipped" | "conflict";
  cashflowId: number;
  payrollRecordId?: number;
  payrollMonth?: string;
  employeeName?: string;
  archivedGeneratedCashflowId?: number;
  reason?: string;
};

async function getOrCreateBankPayrollBatch(
  connection: Queryable,
  metadata: NonNullable<ReturnType<typeof resolveBankPayrollMetadata>>,
  context: PayrollSyncContext
): Promise<number> {
  const batchKey = `${metadata.entity}|${metadata.payrollMonth}|${metadata.currency}`;
  const cached = context.batchIds?.get(batchKey);
  if (cached) return cached;

  const fileName = context.fileName.slice(0, 255);
  const [existingRows] = (await connection.query(
    `SELECT id FROM payroll_import_batches
      WHERE entity = ? AND payrollMonth = ? AND fileName = ? AND sheetName = 'bank_statement' AND currency = ?
      ORDER BY id DESC LIMIT 1`,
    [metadata.entity, metadata.payrollMonth, fileName, metadata.currency]
  )) as any;
  if (existingRows[0]?.id) {
    const batchId = Number(existingRows[0].id);
    context.batchIds?.set(batchKey, batchId);
    return batchId;
  }

  const [result] = (await connection.query(
    `INSERT INTO payroll_import_batches
      (entity, payrollMonth, fileName, sheetName, currency, sourceCount, sourceTotal, importedCount, skippedCount, warningCount, importedBy)
     VALUES (?, ?, ?, 'bank_statement', ?, 0, 0, 0, 0, 0, ?)`,
    [
      metadata.entity,
      metadata.payrollMonth,
      fileName,
      metadata.currency,
      context.importedBy || null,
    ]
  )) as any;
  const batchId = Number(result.insertId);
  context.batchIds?.set(batchKey, batchId);
  return batchId;
}

export async function syncBankCashflowToPayroll(
  connection: Queryable,
  cashflow: BankPayrollCashflow,
  context: PayrollSyncContext
): Promise<BankPayrollSyncResult> {
  const metadata = resolveBankPayrollMetadata(cashflow);
  if (!metadata) {
    return {
      status: "skipped",
      cashflowId: cashflow.id,
      reason: "not_an_identifiable_employee_salary",
    };
  }

  const note = `银行流水自动同步（${metadata.source}）`;
  const [recordRows] = (await connection.query(
    `SELECT pir.id, pir.importBatchId, pir.cashflowId, pir.entity, pir.payrollMonth, pir.employeeName,
            pir.netPay, pir.currency, cf.deletedAt AS linkedDeletedAt,
            cf.sourceAccount AS linkedSourceAccount, cf.categorySource AS linkedCategorySource,
            cf.payrollMonth AS linkedPayrollMonth, cf.payrollEmployee AS linkedPayrollEmployee,
            cf.payrollRecordKey AS linkedPayrollRecordKey, cf.amount AS linkedAmount,
            cf.currency AS linkedCurrency, cf.laborExpenseType AS linkedLaborExpenseType
       FROM payroll_import_records pir
       LEFT JOIN company_cashflows cf ON cf.id = pir.cashflowId
      WHERE pir.recordKey = ?
      LIMIT 1`,
    [metadata.recordKey]
  )) as any;
  const existing = recordRows[0];

  let status: BankPayrollSyncResult["status"] = existing
    ? "updated"
    : "created";
  let archivedGeneratedCashflowId: number | undefined;

  const alreadySynced =
    existing &&
    Number(existing.cashflowId) === cashflow.id &&
    !existing.linkedDeletedAt &&
    existing.entity === metadata.entity &&
    existing.payrollMonth === metadata.payrollMonth &&
    existing.employeeName === metadata.employeeName &&
    Math.abs(Number(existing.netPay || 0) - cashflow.amount) <= 0.005 &&
    existing.currency === metadata.currency &&
    existing.linkedPayrollMonth === metadata.payrollMonth &&
    existing.linkedPayrollEmployee === metadata.employeeName &&
    existing.linkedPayrollRecordKey === metadata.recordKey &&
    Math.abs(Number(existing.linkedAmount || 0) - cashflow.amount) <= 0.005 &&
    existing.linkedCurrency === metadata.currency &&
    existing.linkedLaborExpenseType === "employee_salary";
  if (alreadySynced) {
    return {
      status: "skipped",
      cashflowId: cashflow.id,
      payrollRecordId: Number(existing.id),
      payrollMonth: metadata.payrollMonth,
      employeeName: metadata.employeeName,
      reason: "already_synced",
    };
  }

  if (
    existing?.cashflowId &&
    Number(existing.cashflowId) !== cashflow.id &&
    !existing.linkedDeletedAt
  ) {
    const linkedWasGeneratedFromPayroll =
      existing.linkedCategorySource === "payroll" &&
      !String(existing.linkedSourceAccount || "").trim();
    if (!linkedWasGeneratedFromPayroll) {
      return {
        status: "conflict",
        cashflowId: cashflow.id,
        payrollRecordId: Number(existing.id),
        payrollMonth: metadata.payrollMonth,
        employeeName: metadata.employeeName,
        reason: "employee_month_already_linked_to_bank_cashflow",
      };
    }
    archivedGeneratedCashflowId = Number(existing.cashflowId);
    await connection.query(
      `UPDATE company_cashflows
          SET deletedAt = NOW(), updatedAt = NOW()
        WHERE id = ? AND deletedAt IS NULL AND (sourceAccount IS NULL OR sourceAccount = '')`,
      [archivedGeneratedCashflowId]
    );
    status = "relinked";
  } else if (
    existing?.cashflowId &&
    Number(existing.cashflowId) === cashflow.id
  ) {
    status = "updated";
  } else if (existing) {
    status = "relinked";
  }

  const batchId = existing?.importBatchId
    ? Number(existing.importBatchId)
    : await getOrCreateBankPayrollBatch(connection, metadata, context);

  await connection.query(
    `UPDATE company_cashflows
        SET payrollMonth = ?, payrollEmployee = ?, payrollRecordKey = ?,
            laborExpenseType = 'employee_salary',
            laborExpenseNote = CASE WHEN laborExpenseNote IS NULL OR TRIM(laborExpenseNote) = '' THEN ? ELSE laborExpenseNote END,
            updatedAt = NOW()
      WHERE id = ? AND deletedAt IS NULL`,
    [
      metadata.payrollMonth,
      metadata.employeeName,
      metadata.recordKey,
      note,
      cashflow.id,
    ]
  );

  await connection.query(
    `INSERT INTO payroll_import_records
      (importBatchId, cashflowId, recordKey, entity, payrollMonth, employeeName, netPay, currency, roleName, payor, note, sourceRow)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
     ON DUPLICATE KEY UPDATE
       importBatchId = VALUES(importBatchId),
       cashflowId = VALUES(cashflowId),
       entity = VALUES(entity),
       payrollMonth = VALUES(payrollMonth),
       employeeName = VALUES(employeeName),
       netPay = VALUES(netPay),
       currency = VALUES(currency),
       note = VALUES(note),
       updatedAt = NOW()`,
    [
      batchId,
      cashflow.id,
      metadata.recordKey,
      metadata.entity,
      metadata.payrollMonth,
      metadata.employeeName,
      cashflow.amount,
      metadata.currency,
      note,
    ]
  );

  const [savedRows] = (await connection.query(
    `SELECT id FROM payroll_import_records WHERE recordKey = ? LIMIT 1`,
    [metadata.recordKey]
  )) as any;
  if (!existing) {
    await connection.query(
      `UPDATE payroll_import_batches
          SET sourceCount = sourceCount + 1,
              sourceTotal = sourceTotal + ?,
              importedCount = importedCount + 1
        WHERE id = ?`,
      [cashflow.amount, batchId]
    );
  }

  return {
    status,
    cashflowId: cashflow.id,
    payrollRecordId: Number(savedRows[0]?.id || 0) || undefined,
    payrollMonth: metadata.payrollMonth,
    employeeName: metadata.employeeName,
    archivedGeneratedCashflowId,
  };
}

export async function backfillBankPayrollDetails(pool: mysql.Pool): Promise<{
  scanned: number;
  created: number;
  updated: number;
  relinked: number;
  conflicts: number;
  errors: number;
}> {
  const connection = await pool.getConnection();
  const result = {
    scanned: 0,
    created: 0,
    updated: 0,
    relinked: 0,
    conflicts: 0,
    errors: 0,
  };
  let lockAcquired = false;
  try {
    const [lockRows] = (await connection.query(
      `SELECT GET_LOCK('cashflow_bank_payroll_details_v1', 30) AS acquired`
    )) as any;
    lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!lockAcquired) return result;

    const [rows] = (await connection.query(
      `SELECT cf.id, cf.entity, cf.type, cf.category, cf.amount, cf.currency,
              cf.transactionDate, cf.description, cf.counterparty, cf.sourceAccount,
              cf.payrollMonth, cf.payrollEmployee
         FROM company_cashflows cf
        WHERE cf.deletedAt IS NULL
          AND cf.type = 'expense'
          AND cf.category IN ('給与・人件費','中国人工費','日本人工費')
        ORDER BY cf.id ASC
        LIMIT 5000`
    )) as any;
    const context: PayrollSyncContext = {
      fileName: "银行工资流水历史回填",
      batchIds: new Map(),
    };
    for (const row of rows as any[]) {
      result.scanned += 1;
      try {
        const synced = await syncBankCashflowToPayroll(
          connection,
          {
            id: Number(row.id),
            entity: row.entity,
            type: row.type,
            category: row.category,
            amount: Number(row.amount || 0),
            currency: row.currency,
            transactionDate: String(row.transactionDate || ""),
            description: row.description,
            counterparty: row.counterparty,
            sourceAccount: row.sourceAccount,
            payrollMonth: row.payrollMonth,
            payrollEmployee: row.payrollEmployee,
          },
          context
        );
        if (synced.status === "created") result.created += 1;
        if (synced.status === "updated") result.updated += 1;
        if (synced.status === "relinked") result.relinked += 1;
        if (synced.status === "conflict") result.conflicts += 1;
      } catch (error) {
        result.errors += 1;
        console.warn("[CashflowPayrollSync] Backfill row failed", {
          cashflowId: Number(row.id),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  } finally {
    if (lockAcquired) {
      await connection
        .query(`SELECT RELEASE_LOCK('cashflow_bank_payroll_details_v1')`)
        .catch(() => undefined);
    }
    connection.release();
  }
}
