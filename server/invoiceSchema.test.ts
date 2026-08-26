import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureInvoiceSchema, resetInvoiceSchemaForTests } from "./invoiceSchema";

describe("ensureInvoiceSchema", () => {
  beforeEach(() => resetInvoiceSchemaForTests());

  it("adds invoiceType and its indexes to an existing legacy table", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ Field: "id" }, { Field: "entity" }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ Key_name: "PRIMARY" }, { Key_name: "idx_entity" }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await ensureInvoiceSchema({ query });

    expect(query).toHaveBeenCalledWith("SHOW COLUMNS FROM `company_invoices`");
    expect(query).toHaveBeenCalledWith(
      "ALTER TABLE `company_invoices` ADD COLUMN `invoiceType` ENUM('receivable', 'payable') NOT NULL DEFAULT 'receivable' AFTER `entity`",
    );
    expect(query).toHaveBeenCalledWith(
      "CREATE INDEX `idx_type` ON `company_invoices` (`invoiceType`)",
    );
    expect(query).toHaveBeenCalledWith(
      "CREATE INDEX `idx_entity_type` ON `company_invoices` (`entity`, `invoiceType`)",
    );
  });

  it("is idempotent when the column and indexes already exist", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ Field: "id" }, { Field: "invoiceType" }]])
      .mockResolvedValueOnce([[
        { Key_name: "PRIMARY" },
        { Key_name: "idx_type" },
        { Key_name: "idx_entity_type" },
      ]]);

    await ensureInvoiceSchema({ query });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("ALTER TABLE"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("CREATE INDEX"))).toBe(false);
  });

  it("allows a later request to retry after a migration failure", async () => {
    const failedQuery = vi.fn().mockRejectedValueOnce(new Error("temporary database error"));
    await expect(ensureInvoiceSchema({ query: failedQuery })).rejects.toThrow("temporary database error");

    const retryQuery = vi.fn()
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ Field: "invoiceType" }]])
      .mockResolvedValueOnce([[
        { Key_name: "idx_type" },
        { Key_name: "idx_entity_type" },
      ]]);
    await expect(ensureInvoiceSchema({ query: retryQuery })).resolves.toBeUndefined();
  });
});
