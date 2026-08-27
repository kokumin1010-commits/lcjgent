import { ensureMysqlColumns, ensureMysqlIndexes } from "./mysqlSchemaHelpers";

type MysqlQueryable = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

let payrollCommandCenterSchemaPromise: Promise<void> | null = null;

export async function ensurePayrollCommandCenterSchema(connection: MysqlQueryable): Promise<void> {
  if (!payrollCommandCenterSchemaPromise) {
    payrollCommandCenterSchemaPromise = (async () => {
      await connection.query(`CREATE TABLE IF NOT EXISTS payroll_budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity ENUM('japan', 'china') NOT NULL,
        payrollMonth VARCHAR(7) NOT NULL,
        budgetAmount DECIMAL(15,2) NOT NULL,
        currency ENUM('JPY', 'CNY') NOT NULL,
        updatedBy INT DEFAULT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_budget_entity_month (entity, payrollMonth)
      )`);
      await ensureMysqlColumns(connection, "payroll_budgets", [
        { name: "entity", definition: "ENUM('japan', 'china') NOT NULL" },
        { name: "payrollMonth", definition: "VARCHAR(7) NOT NULL" },
        { name: "budgetAmount", definition: "DECIMAL(15,2) NOT NULL DEFAULT 0" },
        { name: "currency", definition: "ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY'" },
        { name: "updatedBy", definition: "INT DEFAULT NULL" },
        { name: "createdAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
        { name: "updatedAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
      ]);
      await ensureMysqlIndexes(connection, "payroll_budgets", [
        { name: "uq_payroll_budget_entity_month", columns: ["entity", "payrollMonth"], unique: true },
      ]);

      await connection.query(`CREATE TABLE IF NOT EXISTS payroll_fx_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payrollMonth VARCHAR(7) NOT NULL,
        cnyToJpyRate DECIMAL(12,6) NOT NULL,
        sourceNote VARCHAR(255) DEFAULT NULL,
        updatedBy INT DEFAULT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_fx_month (payrollMonth)
      )`);
      await ensureMysqlColumns(connection, "payroll_fx_rates", [
        { name: "payrollMonth", definition: "VARCHAR(7) NOT NULL" },
        { name: "cnyToJpyRate", definition: "DECIMAL(12,6) NOT NULL DEFAULT 20.5" },
        { name: "sourceNote", definition: "VARCHAR(255) DEFAULT NULL" },
        { name: "updatedBy", definition: "INT DEFAULT NULL" },
        { name: "createdAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
        { name: "updatedAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
      ]);
      await ensureMysqlIndexes(connection, "payroll_fx_rates", [
        { name: "uq_payroll_fx_month", columns: ["payrollMonth"], unique: true },
      ]);

      await connection.query(`CREATE TABLE IF NOT EXISTS payroll_anomaly_statuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        anomalyKey VARCHAR(500) NOT NULL,
        status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
        ownerName VARCHAR(100) DEFAULT NULL,
        note TEXT DEFAULT NULL,
        updatedBy INT DEFAULT NULL,
        resolvedAt TIMESTAMP NULL DEFAULT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_anomaly_key (anomalyKey),
        INDEX idx_payroll_anomaly_status (status)
      )`);
      await ensureMysqlColumns(connection, "payroll_anomaly_statuses", [
        { name: "anomalyKey", definition: "VARCHAR(500) NOT NULL" },
        { name: "status", definition: "ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open'" },
        { name: "ownerName", definition: "VARCHAR(100) DEFAULT NULL" },
        { name: "note", definition: "TEXT DEFAULT NULL" },
        { name: "updatedBy", definition: "INT DEFAULT NULL" },
        { name: "resolvedAt", definition: "TIMESTAMP NULL DEFAULT NULL" },
        { name: "createdAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
        { name: "updatedAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
      ]);
      await ensureMysqlIndexes(connection, "payroll_anomaly_statuses", [
        { name: "uq_payroll_anomaly_key", columns: ["anomalyKey"], unique: true },
        { name: "idx_payroll_anomaly_status", columns: ["status"] },
      ]);

      await ensureMysqlColumns(connection, "payroll_employee_aliases", [
        { name: "department", definition: "VARCHAR(100) DEFAULT NULL" },
      ]);
    })().catch((error) => {
      payrollCommandCenterSchemaPromise = null;
      throw error;
    });
  }

  await payrollCommandCenterSchemaPromise;
}

export function resetPayrollCommandCenterSchemaForTests(): void {
  payrollCommandCenterSchemaPromise = null;
}
