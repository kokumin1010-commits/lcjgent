import { readFile } from "node:fs/promises";
import path from "node:path";
import { getBrandDayPool } from "./brandDayPool";

const REQUIRED_TABLES = [
  "brand_day_events",
  "brand_day_entries",
  "brand_day_creator_accounts",
  "brand_day_creator_sessions",
  "brand_day_performances",
  "brand_day_performance_products",
  "brand_day_audit_logs",
  "brand_day_migration_runs",
] as const;

let setupPromise: Promise<void> | null = null;

function assertSchemaOnlyMigration(sql: string) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map(statement => statement.trim())
    .filter(Boolean);
  if (!statements.length || statements.some(statement => !/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(statement))) {
    throw new Error("Brand Day migration must contain CREATE-only schema statements.");
  }
}

async function runSetup() {
  const pool = await getBrandDayPool();
  const placeholders = REQUIRED_TABLES.map(() => "?").join(",");
  const [existingRows] = await pool.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN (${placeholders})`,
    [...REQUIRED_TABLES],
  );
  if ((existingRows as any[]).length === REQUIRED_TABLES.length) {
    console.log(`[BrandDaySchema] ready (${REQUIRED_TABLES.length} tables)`);
    return;
  }

  const migrationPath = path.resolve(process.cwd(), "drizzle", "0139_brand_day_native.sql");
  const sql = await readFile(migrationPath, "utf8");
  assertSchemaOnlyMigration(sql);
  const statements = sql
    .split("--> statement-breakpoint")
    .map(statement => statement.trim())
    .filter(Boolean);
  if (statements.length !== REQUIRED_TABLES.length) {
    throw new Error(`Brand Day migration statement count mismatch: expected ${REQUIRED_TABLES.length}, received ${statements.length}.`);
  }

  const connection = await pool.getConnection();
  try {
    for (const statement of statements) await connection.execute(statement);
  } finally {
    connection.release();
  }

  const [verifiedRows] = await pool.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN (${placeholders})`,
    [...REQUIRED_TABLES],
  );
  if ((verifiedRows as any[]).length !== REQUIRED_TABLES.length) {
    const found = new Set((verifiedRows as any[]).map(row => String(row.tableName)));
    const missing = REQUIRED_TABLES.filter(table => !found.has(table));
    throw new Error(`Brand Day schema setup incomplete: ${missing.join(", ")}`);
  }
  console.log(`[BrandDaySchema] created and verified (${REQUIRED_TABLES.length} tables)`);
}

export function ensureBrandDayNativeTables() {
  setupPromise ||= runSetup().catch(error => {
    setupPromise = null;
    throw error;
  });
  return setupPromise;
}

export { REQUIRED_TABLES, assertSchemaOnlyMigration };
