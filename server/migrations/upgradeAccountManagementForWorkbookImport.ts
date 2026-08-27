import { sql } from "drizzle-orm";

async function hasColumn(db: any, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await db.execute(sql.raw(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}'`,
  ));
  return Array.isArray(rows) && rows.length > 0;
}

async function hasIndex(db: any, tableName: string, indexName: string): Promise<boolean> {
  const [rows] = await db.execute(sql.raw(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`,
  ));
  return Array.isArray(rows) && rows.length > 0;
}

export async function upgradeAccountManagementForWorkbookImport(db: any) {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS account_reference_links (
    id INT AUTO_INCREMENT NOT NULL,
    category ENUM('system','meeting','ai','workflow','other') NOT NULL DEFAULT 'other',
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    notes TEXT NULL,
    source_key VARCHAR(191) NOT NULL,
    source_file_hash VARCHAR(64) NOT NULL,
    source_rows JSON NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_account_reference_source_key (source_key),
    KEY idx_account_reference_category (category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`));

  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS account_workbook_imports (
    id INT AUTO_INCREMENT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_sha256 VARCHAR(64) NOT NULL,
    sheet_name VARCHAR(255) NOT NULL,
    status ENUM('running','success','failed') NOT NULL DEFAULT 'running',
    counts JSON NULL,
    error_message TEXT NULL,
    imported_by INT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY unique_account_workbook_file_hash (file_sha256),
    KEY idx_account_workbook_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`));

  const columns = [
    { table: "platform_accounts", name: "source_key", ddl: "ADD COLUMN source_key VARCHAR(191) NULL AFTER notes" },
    { table: "platform_accounts", name: "source_file_hash", ddl: "ADD COLUMN source_file_hash VARCHAR(64) NULL AFTER source_key" },
    { table: "platform_accounts", name: "source_rows", ddl: "ADD COLUMN source_rows JSON NULL AFTER source_file_hash" },
    { table: "contact_info", name: "source_key", ddl: "ADD COLUMN source_key VARCHAR(191) NULL AFTER notes" },
    { table: "contact_info", name: "source_file_hash", ddl: "ADD COLUMN source_file_hash VARCHAR(64) NULL AFTER source_key" },
    { table: "contact_info", name: "source_rows", ddl: "ADD COLUMN source_rows JSON NULL AFTER source_file_hash" },
  ];

  for (const column of columns) {
    if (!(await hasColumn(db, column.table, column.name))) {
      try {
        await db.execute(sql.raw(`ALTER TABLE ${column.table} ${column.ddl}`));
        console.log(`[Migration] Added ${column.table}.${column.name}`);
      } catch (error: any) {
        if (error?.code !== "ER_DUP_FIELDNAME") throw error;
      }
    }
  }

  const indexes = [
    { table: "platform_accounts", name: "unique_platform_accounts_source_key", ddl: "ADD UNIQUE INDEX unique_platform_accounts_source_key (source_key)" },
    { table: "platform_accounts", name: "idx_platform_accounts_source_hash", ddl: "ADD INDEX idx_platform_accounts_source_hash (source_file_hash)" },
    { table: "contact_info", name: "unique_contact_info_source_key", ddl: "ADD UNIQUE INDEX unique_contact_info_source_key (source_key)" },
    { table: "contact_info", name: "idx_contact_info_source_hash", ddl: "ADD INDEX idx_contact_info_source_hash (source_file_hash)" },
  ];

  for (const index of indexes) {
    if (!(await hasIndex(db, index.table, index.name))) {
      try {
        await db.execute(sql.raw(`ALTER TABLE ${index.table} ${index.ddl}`));
        console.log(`[Migration] Added ${index.name}`);
      } catch (error: any) {
        if (error?.code !== "ER_DUP_KEYNAME") throw error;
      }
    }
  }

  console.log("[Migration] Account workbook import schema verified");
}
