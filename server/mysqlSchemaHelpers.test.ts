import { describe, expect, it, vi } from "vitest";
import { ensureMysqlColumns, ensureMysqlIndexes } from "./mysqlSchemaHelpers";

describe("mysqlSchemaHelpers", () => {
  it("adds only missing columns without relying on ADD COLUMN IF NOT EXISTS", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[{ Field: "id" }, { Field: "payrollMonth" }]])
      .mockResolvedValueOnce([{}]);

    const added = await ensureMysqlColumns({ query }, "company_cashflows", [
      { name: "payrollMonth", definition: "VARCHAR(7) DEFAULT NULL" },
      { name: "payrollEmployee", definition: "VARCHAR(255) DEFAULT NULL" },
    ]);

    expect(added).toEqual(["payrollEmployee"]);
    expect(query).toHaveBeenNthCalledWith(1, "SHOW COLUMNS FROM `company_cashflows`");
    expect(query).toHaveBeenNthCalledWith(
      2,
      "ALTER TABLE `company_cashflows` ADD COLUMN `payrollEmployee` VARCHAR(255) DEFAULT NULL",
    );
  });

  it("adds only missing indexes after reading SHOW INDEX", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[{ Key_name: "PRIMARY" }, { Key_name: "idx_payroll_month" }]])
      .mockResolvedValueOnce([{}]);

    const added = await ensureMysqlIndexes({ query }, "company_cashflows", [
      { name: "idx_payroll_month", columns: ["payrollMonth"] },
      { name: "idx_payroll_employee", columns: ["payrollEmployee"] },
    ]);

    expect(added).toEqual(["idx_payroll_employee"]);
    expect(query).toHaveBeenNthCalledWith(1, "SHOW INDEX FROM `company_cashflows`");
    expect(query).toHaveBeenNthCalledWith(
      2,
      "CREATE INDEX `idx_payroll_employee` ON `company_cashflows` (`payrollEmployee`)",
    );
  });

  it("creates a unique index when requested", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[{ Key_name: "PRIMARY" }]])
      .mockResolvedValueOnce([{}]);

    const added = await ensureMysqlIndexes({ query }, "payroll_budgets", [
      { name: "uq_payroll_budget_entity_month", columns: ["entity", "payrollMonth"], unique: true },
    ]);

    expect(added).toEqual(["uq_payroll_budget_entity_month"]);
    expect(query).toHaveBeenNthCalledWith(
      2,
      "CREATE UNIQUE INDEX `uq_payroll_budget_entity_month` ON `payroll_budgets` (`entity`, `payrollMonth`)",
    );
  });

  it("rejects unsafe identifiers before executing SQL", async () => {
    const query = vi.fn();
    await expect(ensureMysqlColumns({ query }, "company_cashflows; DROP TABLE users", [])).rejects.toThrow("Unsafe MySQL identifier");
    expect(query).not.toHaveBeenCalled();
  });
});
