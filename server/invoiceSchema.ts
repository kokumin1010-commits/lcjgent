import { ensureMysqlColumns, ensureMysqlIndexes } from "./mysqlSchemaHelpers";

type MysqlQueryable = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

let invoiceSchemaPromise: Promise<void> | null = null;

export async function ensureInvoiceSchema(connection: MysqlQueryable): Promise<void> {
  if (!invoiceSchemaPromise) {
    invoiceSchemaPromise = (async () => {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS company_invoices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entity ENUM('japan', 'china') NOT NULL DEFAULT 'japan',
          invoiceType ENUM('receivable', 'payable') NOT NULL DEFAULT 'receivable',
          name VARCHAR(500) NOT NULL,
          counterparty VARCHAR(255),
          amount BIGINT NOT NULL DEFAULT 0,
          currency ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY',
          startDate VARCHAR(10),
          endDate VARCHAR(10) NOT NULL,
          status TINYINT NOT NULL DEFAULT 0,
          accountingStatus TINYINT NOT NULL DEFAULT 0,
          managerId INT,
          managerName VARCHAR(100),
          memo TEXT,
          pdfUrl TEXT,
          pdfKey TEXT,
          depositDate VARCHAR(10),
          createdBy INT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deletedAt TIMESTAMP NULL,
          INDEX idx_entity (entity),
          INDEX idx_type (invoiceType),
          INDEX idx_status (status),
          INDEX idx_endDate (endDate),
          INDEX idx_entity_type (entity, invoiceType)
        )
      `);

      await ensureMysqlColumns(connection, "company_invoices", [
        {
          name: "entity",
          definition: "ENUM('japan', 'china') NOT NULL DEFAULT 'japan'",
        },
        {
          name: "invoiceType",
          definition: "ENUM('receivable', 'payable') NOT NULL DEFAULT 'receivable' AFTER `entity`",
        },
        { name: "name", definition: "VARCHAR(500) NOT NULL DEFAULT '未命名請求書'" },
        { name: "counterparty", definition: "VARCHAR(255) DEFAULT NULL" },
        { name: "amount", definition: "BIGINT NOT NULL DEFAULT 0" },
        { name: "currency", definition: "ENUM('JPY', 'CNY') NOT NULL DEFAULT 'JPY'" },
        { name: "startDate", definition: "VARCHAR(10) DEFAULT NULL" },
        { name: "endDate", definition: "VARCHAR(10) DEFAULT NULL" },
        { name: "status", definition: "TINYINT NOT NULL DEFAULT 0" },
        { name: "accountingStatus", definition: "TINYINT NOT NULL DEFAULT 0" },
        { name: "managerId", definition: "INT DEFAULT NULL" },
        { name: "managerName", definition: "VARCHAR(100) DEFAULT NULL" },
        { name: "memo", definition: "TEXT DEFAULT NULL" },
        { name: "pdfUrl", definition: "TEXT DEFAULT NULL" },
        { name: "pdfKey", definition: "TEXT DEFAULT NULL" },
        { name: "depositDate", definition: "VARCHAR(10) DEFAULT NULL" },
        { name: "createdBy", definition: "INT DEFAULT NULL" },
        { name: "createdAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
        { name: "updatedAt", definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
        { name: "deletedAt", definition: "TIMESTAMP NULL DEFAULT NULL" },
      ]);

      await ensureMysqlIndexes(connection, "company_invoices", [
        { name: "idx_entity", columns: ["entity"] },
        { name: "idx_type", columns: ["invoiceType"] },
        { name: "idx_status", columns: ["status"] },
        { name: "idx_endDate", columns: ["endDate"] },
        { name: "idx_entity_type", columns: ["entity", "invoiceType"] },
      ]);
    })().catch((error) => {
      invoiceSchemaPromise = null;
      throw error;
    });
  }

  await invoiceSchemaPromise;
}

export function resetInvoiceSchemaForTests(): void {
  invoiceSchemaPromise = null;
}
