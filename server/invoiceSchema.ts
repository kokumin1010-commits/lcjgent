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
          name: "invoiceType",
          definition: "ENUM('receivable', 'payable') NOT NULL DEFAULT 'receivable' AFTER `entity`",
        },
      ]);

      await ensureMysqlIndexes(connection, "company_invoices", [
        { name: "idx_type", columns: ["invoiceType"] },
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
