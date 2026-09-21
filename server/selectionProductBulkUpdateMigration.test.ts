import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("selection product bulk update runtime schema", () => {
  it("defines immutable audit storage and soft-archive columns in the idempotent runtime schema", () => {
    const persistence = read("server/selectionProductPersistence.ts");
    expect(persistence).toContain("CREATE TABLE IF NOT EXISTS selection_product_bulk_updates");
    expect(persistence).toContain("requestId VARCHAR(36) NOT NULL");
    expect(persistence).toContain("patchJson JSON NOT NULL");
    expect(persistence).toContain("beforeState JSON NOT NULL");
    expect(persistence).toContain("afterState JSON NOT NULL");
    expect(persistence).toContain("UNIQUE KEY uq_selection_product_bulk_request");
    expect(persistence).toContain("ALTER TABLE selection_price_history ADD COLUMN archivedAt");
    expect(persistence).toContain("ALTER TABLE selection_price_history ADD COLUMN archivedBy");
    expect(persistence).toContain("ALTER TABLE selection_price_history ADD COLUMN archiveReason");
    expect(persistence).toContain("ALTER TABLE selection_price_history ADD INDEX idx_selection_price_active");
    expect(persistence).toContain("schemaEnsurePromise = null");
    expect(persistence).not.toMatch(/DELETE\s+FROM\s+selection_products/i);
  });

  it("waits for runtime schema before bulk writes and does not add a deploy-blocking migration", () => {
    const router = read("server/selectionCenterRouter.ts");
    const runner = read("run-migrations.mjs");
    const journal = read("drizzle/meta/_journal.json");
    const bulkStart = router.indexOf("bulkUpdateProducts: selectionCenterEditProcedure");
    const ensureAt = router.indexOf("await ensureSelectionProductPersistenceSchema(pool);", bulkStart);
    const writeAt = router.indexOf("return bulkUpdateSelectionProducts", bulkStart);
    expect(bulkStart).toBeGreaterThan(0);
    expect(ensureAt).toBeGreaterThan(bulkStart);
    expect(writeAt).toBeGreaterThan(ensureAt);
    expect(runner).not.toContain("0157_selection_product_bulk_updates");
    expect(journal).not.toContain('"tag": "0157_selection_product_bulk_updates"');
  });
});
