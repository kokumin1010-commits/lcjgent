import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.join(__dirname, "drizzle");
const MIGRATION_TAG = "0161_tw_daily_line_bridge";
const LOCK_NAME = "lcjgent-required-0161-tw-daily-line";
const MAX_CONNECT_ATTEMPTS = 5;

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function mysqlErrorCode(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = String(current.code || "");
    if (code) return code;
    current = current.cause;
  }
  return "UNKNOWN";
}

function isDuplicateMysqlColumn(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = String(current.code || "");
    const message = String(current.message || "");
    if (code === "ER_DUP_FIELDNAME" || message.includes("Duplicate column")) return true;
    current = current.cause;
  }
  return false;
}

async function connectWithRetry(connectionString) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      return await mysql.createConnection(connectionString);
    } catch (error) {
      lastError = error;
      console.error("[StartupMigration] Database connection failed", {
        attempt,
        code: mysqlErrorCode(error),
      });
      if (attempt < MAX_CONNECT_ATTEMPTS) await sleep(attempt * 2_000);
    }
  }
  throw lastError;
}

async function readMigrationDescriptor() {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  const journal = JSON.parse(await fs.readFile(journalPath, "utf8"));
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  const targetIndex = entries.findIndex(entry => entry?.tag === MIGRATION_TAG);
  if (targetIndex <= 0) throw new Error("STARTUP_MIGRATION_JOURNAL_ENTRY_MISSING");
  const targetEntry = entries[targetIndex];
  const previousEntry = entries[targetIndex - 1];
  const migrationPath = path.join(MIGRATIONS_FOLDER, `${MIGRATION_TAG}.sql`);
  const migrationSql = await fs.readFile(migrationPath, "utf8");
  return {
    folderMillis: Number(targetEntry.when),
    previousFolderMillis: Number(previousEntry.when),
    hash: createHash("sha256").update(migrationSql).digest("hex"),
    statements: migrationSql
      .split("--> statement-breakpoint")
      .map(statement => statement.trim())
      .filter(Boolean),
  };
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.count || 0) === 1;
}

async function readDrizzleLedgerState(connection, descriptor) {
  if (!(await tableExists(connection, "__drizzle_migrations"))) {
    throw new Error("STARTUP_MIGRATION_LEDGER_MISSING");
  }
  const [latestRows] = await connection.execute(
    "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
  );
  const latest = latestRows?.[0] || null;
  if (!latest || Number(latest.created_at || 0) < descriptor.previousFolderMillis) {
    throw new Error("STARTUP_MIGRATION_PREREQUISITE_MISSING");
  }

  const [sameTimestampRows] = await connection.execute(
    "SELECT hash FROM __drizzle_migrations WHERE created_at = ? ORDER BY id",
    [descriptor.folderMillis],
  );
  const timestampHashes = Array.isArray(sameTimestampRows)
    ? sameTimestampRows.map(row => String(row.hash || ""))
    : [];
  if (timestampHashes.some(hash => hash !== descriptor.hash)) {
    throw new Error("STARTUP_MIGRATION_LEDGER_HASH_MISMATCH");
  }
  return { alreadyRecorded: timestampHashes.includes(descriptor.hash) };
}

async function main() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

  const descriptor = await readMigrationDescriptor();
  const connection = await connectWithRetry(connectionString);
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.execute(
      "SELECT GET_LOCK(?, 120) AS acquired",
      [LOCK_NAME],
    );
    lockAcquired = Number(lockRows?.[0]?.acquired || 0) === 1;
    if (!lockAcquired) throw new Error("STARTUP_MIGRATION_LOCK_TIMEOUT");

    if (!(await tableExists(connection, "line_group_settings"))) {
      throw new Error("STARTUP_MIGRATION_PREREQUISITE_MISSING");
    }
    const ledgerState = await readDrizzleLedgerState(connection, descriptor);

    for (const statement of descriptor.statements) {
      try {
        await connection.execute(statement);
      } catch (error) {
        if (!isDuplicateMysqlColumn(error)) throw error;
      }
    }

    if (!ledgerState.alreadyRecorded) {
      await connection.execute(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        [descriptor.hash, descriptor.folderMillis],
      );
    }

    console.log(
      `[StartupMigration] REQUIRED_MIGRATION_APPLIED 0161 (${descriptor.statements.length} statements)`,
    );
  } finally {
    if (lockAcquired) {
      await connection.execute("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    }
    await connection.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error("[StartupMigration] FAILED", { code: mysqlErrorCode(error) });
  process.exit(1);
});
