import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("selection product bulk update migration", () => {
  it("creates immutable request, actor, payload, and before/after audit storage", () => {
    const migration = read("drizzle/0157_selection_product_bulk_updates.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `selection_product_bulk_updates`");
    expect(migration).toContain("`requestId` varchar(36) NOT NULL");
    expect(migration).toContain("`actorUserId` int NOT NULL");
    expect(migration).toContain("`patchJson` json NOT NULL");
    expect(migration).toContain("`beforeState` json NOT NULL");
    expect(migration).toContain("`afterState` json NOT NULL");
    expect(migration).toContain("UNIQUE(`requestId`)");
    expect(migration).toContain("`archivedAt`");
    expect(migration).toContain("`archivedBy`");
    expect(migration).toContain("`archiveReason`");
    expect(migration).not.toContain("ADD COLUMN IF NOT EXISTS");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+selection_products/i);
  });

  it("registers the migration and keeps a runtime idempotent CREATE fallback", () => {
    const journal = read("drizzle/meta/_journal.json");
    const persistence = read("server/selectionProductPersistence.ts");
    const runner = read("run-migrations.mjs");
    expect(journal).toContain('"tag": "0157_selection_product_bulk_updates"');
    expect(persistence).toContain("CREATE TABLE IF NOT EXISTS selection_product_bulk_updates");
    expect(persistence).toContain("ALTER TABLE selection_price_history ADD COLUMN archivedAt");
    expect(runner).toContain("0157_selection_product_bulk_updates.sql");
    expect(runner).toContain("process.exit(1)");
    expect(runner).toContain("ensureSelectionBulkAuditStorage");
    expect(runner).toContain("ensureMysqlColumns(connection, 'selection_price_history'");
  });
});
