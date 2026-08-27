import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensurePayrollCommandCenterSchema, resetPayrollCommandCenterSchemaForTests } from "./payrollCommandCenterSchema";

const columnsByTable: Record<string, string[]> = {
  payroll_budgets: ["id", "entity", "payrollMonth", "budgetAmount", "currency", "updatedBy", "createdAt", "updatedAt"],
  payroll_fx_rates: ["id", "payrollMonth", "cnyToJpyRate", "sourceNote", "updatedBy", "createdAt", "updatedAt"],
  payroll_anomaly_statuses: ["id", "anomalyKey", "status", "ownerName", "note", "updatedBy", "resolvedAt", "createdAt", "updatedAt"],
  payroll_employee_aliases: ["id", "entity", "employeeName", "wechatName", "note", "department", "updatedBy", "createdAt", "updatedAt"],
};

const indexesByTable: Record<string, string[]> = {
  payroll_budgets: ["PRIMARY", "uq_payroll_budget_entity_month"],
  payroll_fx_rates: ["PRIMARY", "uq_payroll_fx_month"],
  payroll_anomaly_statuses: ["PRIMARY", "uq_payroll_anomaly_key", "idx_payroll_anomaly_status"],
};

function tableFromSql(sql: string): string {
  return sql.match(/`([^`]+)`/)?.[1] || "";
}

function readySchemaQuery() {
  return vi.fn(async (sql: string) => {
    const table = tableFromSql(sql);
    if (sql.startsWith("SHOW COLUMNS")) return [(columnsByTable[table] || []).map((Field) => ({ Field }))];
    if (sql.startsWith("SHOW INDEX")) return [(indexesByTable[table] || []).map((Key_name) => ({ Key_name }))];
    return [{}];
  });
}

describe("ensurePayrollCommandCenterSchema", () => {
  beforeEach(() => resetPayrollCommandCenterSchemaForTests());

  it("adds missing legacy columns and indexes without replacing existing data", async () => {
    const query = vi.fn(async (sql: string) => {
      const table = tableFromSql(sql);
      if (sql.startsWith("SHOW COLUMNS")) {
        if (table === "payroll_employee_aliases") return [[{ Field: "id" }, { Field: "entity" }, { Field: "employeeName" }]];
        return [[{ Field: "id" }]];
      }
      if (sql.startsWith("SHOW INDEX")) return [[{ Key_name: "PRIMARY" }]];
      return [{}];
    });

    await ensurePayrollCommandCenterSchema({ query });

    expect(query).toHaveBeenCalledWith("ALTER TABLE `payroll_employee_aliases` ADD COLUMN `department` VARCHAR(100) DEFAULT NULL");
    expect(query).toHaveBeenCalledWith("ALTER TABLE `payroll_budgets` ADD COLUMN `payrollMonth` VARCHAR(7) NOT NULL");
    expect(query).toHaveBeenCalledWith("CREATE UNIQUE INDEX `uq_payroll_budget_entity_month` ON `payroll_budgets` (`entity`, `payrollMonth`)");
    expect(query).toHaveBeenCalledWith("CREATE UNIQUE INDEX `uq_payroll_anomaly_key` ON `payroll_anomaly_statuses` (`anomalyKey`)");
    expect(query).toHaveBeenCalledWith("CREATE INDEX `idx_payroll_anomaly_status` ON `payroll_anomaly_statuses` (`status`)");
  });

  it("is idempotent when all required columns and indexes already exist", async () => {
    const query = readySchemaQuery();
    await ensurePayrollCommandCenterSchema({ query });
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("ALTER TABLE"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("CREATE INDEX"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("CREATE UNIQUE INDEX"))).toBe(false);
  });

  it("allows a later request to retry after a migration failure", async () => {
    const failedQuery = vi.fn().mockRejectedValueOnce(new Error("temporary database error"));
    await expect(ensurePayrollCommandCenterSchema({ query: failedQuery })).rejects.toThrow("temporary database error");
    await expect(ensurePayrollCommandCenterSchema({ query: readySchemaQuery() })).resolves.toBeUndefined();
  });
});
