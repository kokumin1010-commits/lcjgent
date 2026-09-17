import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  syncBankCashflowToPayroll,
  type BankPayrollCashflow,
} from "./cashflowPayrollSync";

const salaryRow: BankPayrollCashflow = {
  id: 501,
  entity: "china",
  type: "expense",
  category: "中国人工費",
  amount: 8760.18,
  currency: "CNY",
  transactionDate: "2026-09-15",
  description: "王强8月工资",
  counterparty: "",
  sourceAccount: "世曜元宇(中信銀行)",
  payrollMonth: "2026-08",
  payrollEmployee: "王强",
};

function createConnection(responses: Array<[unknown, unknown]>) {
  const query = vi.fn(async () => responses.shift() || [[], []]);
  return { query } as any;
}

describe("cashflowPayrollSync", () => {
  it("creates one payroll detail linked to the authoritative bank cashflow", async () => {
    const connection = createConnection([
      [[], []],
      [[], []],
      [{ insertId: 41 }, []],
      [[], []],
      [[], []],
      [[{ id: 77 }], []],
      [[], []],
    ]);

    const result = await syncBankCashflowToPayroll(connection, salaryRow, {
      fileName: "china-bank.xlsx",
      importedBy: 9,
      batchIds: new Map(),
    });

    expect(result).toMatchObject({
      status: "created",
      cashflowId: 501,
      payrollRecordId: 77,
      payrollMonth: "2026-08",
      employeeName: "王强",
    });
    const statements = connection.query.mock.calls.map((call: unknown[]) =>
      String(call[0])
    );
    expect(
      statements.some((sql: string) =>
        sql.includes("INSERT INTO payroll_import_records")
      )
    ).toBe(true);
    expect(
      statements.some((sql: string) => sql.includes("payrollRecordKey = ?"))
    ).toBe(true);
  });

  it("skips the same employee-month bank row idempotently without writing again", async () => {
    const connection = createConnection([
      [
        [
          {
            id: 77,
            importBatchId: 41,
            cashflowId: 501,
            entity: "china",
            payrollMonth: "2026-08",
            employeeName: "王强",
            netPay: 8760.18,
            currency: "CNY",
            linkedDeletedAt: null,
            linkedSourceAccount: "世曜元宇(中信銀行)",
            linkedCategorySource: "import",
            linkedPayrollMonth: "2026-08",
            linkedPayrollEmployee: "王强",
            linkedPayrollRecordKey: "china|2026-08|王强",
            linkedAmount: 8760.18,
            linkedCurrency: "CNY",
            linkedLaborExpenseType: "employee_salary",
          },
        ],
        [],
      ],
    ]);

    const result = await syncBankCashflowToPayroll(connection, salaryRow, {
      fileName: "china-bank.xlsx",
      importedBy: 9,
      batchIds: new Map(),
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "already_synced",
    });
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  it("relinks a payroll-generated synthetic expense to the real bank cashflow", async () => {
    const connection = createConnection([
      [
        [
          {
            id: 77,
            importBatchId: 41,
            cashflowId: 400,
            linkedDeletedAt: null,
            linkedSourceAccount: null,
            linkedCategorySource: "payroll",
          },
        ],
        [],
      ],
      [[], []],
      [[], []],
      [[], []],
      [[{ id: 77 }], []],
    ]);

    const result = await syncBankCashflowToPayroll(connection, salaryRow, {
      fileName: "china-bank.xlsx",
      importedBy: 9,
      batchIds: new Map(),
    });

    expect(result).toMatchObject({
      status: "relinked",
      archivedGeneratedCashflowId: 400,
    });
    const archiveCall = connection.query.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes("SET deletedAt = NOW()")
    );
    expect(archiveCall?.[1]).toEqual([400]);
  });

  it("keeps payroll month and employee columns wired from Excel through the import route", async () => {
    const pageSource = await readFile(
      new URL("../client/src/pages/CashflowTab.tsx", import.meta.url),
      "utf8"
    );
    const routerSource = await readFile(
      new URL("./cashflowRouter.ts", import.meta.url),
      "utf8"
    );
    expect(pageSource).toContain("idxPayrollMonth");
    expect(pageSource).toContain("idxPayrollEmployee");
    expect(pageSource).toContain("payrollMonth: idxPayrollMonth");
    expect(pageSource).toContain("payrollEmployee: idxPayrollEmployee");
    expect(routerSource).toContain("payrollMonth: z.string().regex");
    expect(routerSource).toContain("syncImportedPayrollRow");
    expect(routerSource).toContain("backfillBankPayrollDetails(pool)");
  });

  it("never replaces another already linked bank cashflow for the same employee-month", async () => {
    const connection = createConnection([
      [
        [
          {
            id: 77,
            importBatchId: 41,
            cashflowId: 400,
            linkedDeletedAt: null,
            linkedSourceAccount: "世曜元宇(中信銀行)",
            linkedCategorySource: "import",
          },
        ],
        [],
      ],
    ]);

    const result = await syncBankCashflowToPayroll(connection, salaryRow, {
      fileName: "china-bank.xlsx",
      importedBy: 9,
      batchIds: new Map(),
    });

    expect(result).toMatchObject({
      status: "conflict",
      reason: "employee_month_already_linked_to_bank_cashflow",
    });
    expect(connection.query).toHaveBeenCalledTimes(1);
  });
});
