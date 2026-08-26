import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureInvoiceSchema, resetInvoiceSchemaForTests } from "./invoiceSchema";

const invoiceColumns = [
  "id", "entity", "invoiceType", "name", "counterparty", "amount", "currency",
  "startDate", "endDate", "status", "accountingStatus", "managerId", "managerName",
  "memo", "pdfUrl", "pdfKey", "depositDate", "createdBy", "createdAt", "updatedAt", "deletedAt",
];

const invoiceIndexes = ["PRIMARY", "idx_entity", "idx_type", "idx_status", "idx_endDate", "idx_entity_type"];

function readySchemaQuery() {
  return vi.fn(async (sql: string) => {
    if (sql.startsWith("SHOW COLUMNS")) return [invoiceColumns.map((Field) => ({ Field }))];
    if (sql.startsWith("SHOW INDEX")) return [invoiceIndexes.map((Key_name) => ({ Key_name }))];
    return [{}];
  });
}

describe("ensureInvoiceSchema", () => {
  beforeEach(() => resetInvoiceSchemaForTests());

  it("adds every missing field and index needed by an existing legacy table", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith("SHOW COLUMNS")) {
        return [[{ Field: "id" }, { Field: "entity" }, { Field: "name" }, { Field: "amount" }]];
      }
      if (sql.startsWith("SHOW INDEX")) return [[{ Key_name: "PRIMARY" }]];
      return [{}];
    });

    await ensureInvoiceSchema({ query });

    expect(query).toHaveBeenCalledWith(
      "ALTER TABLE `company_invoices` ADD COLUMN `invoiceType` ENUM('receivable', 'payable') NOT NULL DEFAULT 'receivable' AFTER `entity`",
    );
    expect(query).toHaveBeenCalledWith(
      "ALTER TABLE `company_invoices` ADD COLUMN `startDate` VARCHAR(10) DEFAULT NULL",
    );
    expect(query).toHaveBeenCalledWith(
      "ALTER TABLE `company_invoices` ADD COLUMN `pdfUrl` TEXT DEFAULT NULL",
    );
    expect(query).toHaveBeenCalledWith(
      "ALTER TABLE `company_invoices` ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL",
    );
    expect(query).toHaveBeenCalledWith(
      "CREATE INDEX `idx_entity_type` ON `company_invoices` (`entity`, `invoiceType`)",
    );
  });

  it("is idempotent when all required columns and indexes already exist", async () => {
    const query = readySchemaQuery();

    await ensureInvoiceSchema({ query });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("ALTER TABLE"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("CREATE INDEX"))).toBe(false);
  });

  it("allows a later request to retry after a migration failure", async () => {
    const failedQuery = vi.fn().mockRejectedValueOnce(new Error("temporary database error"));
    await expect(ensureInvoiceSchema({ query: failedQuery })).rejects.toThrow("temporary database error");

    await expect(ensureInvoiceSchema({ query: readySchemaQuery() })).resolves.toBeUndefined();
  });
});
