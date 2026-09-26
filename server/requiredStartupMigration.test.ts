import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  REQUIRED_MIGRATION_TAGS,
  mysqlErrorCode,
  readDrizzleLedgerState,
  recordVerifiedRequiredMigrations,
  verifyRequiredSchema,
} from "../run-required-startup-migrations.mjs";

type ExecuteResult = [Array<Record<string, unknown>>, unknown];

function connectionForLedger(options: {
  targetHashes?: string[];
  previousHashes?: string[];
  ledgerExists?: boolean;
}) {
  return {
    execute: async (sql: string, params: unknown[] = []): Promise<ExecuteResult> => {
      if (sql.includes("information_schema.TABLES")) {
        return [[{ count: options.ledgerExists === false ? 0 : 1 }], undefined];
      }
      if (sql.includes("WHERE created_at = ? ORDER BY id")) {
        const timestamp = Number(params[0]);
        const hashes = timestamp === 300
          ? options.targetHashes || []
          : options.previousHashes || [];
        return [[...hashes.map(hash => ({ hash }))], undefined];
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };
}

function requiredIndexRows() {
  const rows: Array<Record<string, unknown>> = [];
  const add = (
    tableName: string,
    indexName: string,
    columns: string[],
    unique: boolean,
  ) => {
    columns.forEach((columnName, index) => rows.push({
      tableName,
      indexName,
      nonUnique: unique ? 0 : 1,
      seqInIndex: index + 1,
      columnName,
    }));
  };
  add("tw_daily_line_report_inbox", "PRIMARY", ["report_id"], true);
  add("tw_daily_line_report_inbox", "tw_daily_line_inbox_event_uq", ["latest_event_id"], true);
  add("tw_daily_line_report_inbox", "tw_daily_line_inbox_staff_date_uq", ["report_date", "staff_name"], true);
  add("tw_daily_line_report_inbox", "tw_daily_line_inbox_date_idx", ["report_date", "staff_name", "report_id"], false);
  add("tw_daily_line_rollouts", "PRIMARY", ["rollout_key"], true);
  add("tw_daily_line_outbox", "PRIMARY", ["id"], true);
  add("tw_daily_line_outbox", "tw_daily_line_outbox_event_uq", ["event_id"], true);
  add("tw_daily_line_outbox", "tw_daily_line_outbox_due_idx", ["status", "next_attempt_at", "id"], false);
  add("reports", "uq_reports_request_id", ["requestId"], true);
  add("entity_revision_audits", "idx_entity_revision_entity", ["entityType", "entityId", "id"], false);
  add("report_attachments", "uq_report_attachments_upload", ["reportId", "uploadId"], true);
  add("report_followup_extraction_runs", "uq_followup_extraction_job", ["jobKey"], true);
  add(
    "report_followup_extraction_runs",
    "idx_followup_runs_report_status",
    ["reportId", "status", "id"],
    false,
  );
  return rows;
}

const descriptor = {
  folderMillis: 300,
  previousFolderMillis: 200,
  previousHash: "previous-hash",
  hash: "target-hash",
};

describe("required startup migration behavior", () => {
  it("runs only the small LINE bridge and reliable report migrations before listen", () => {
    const source = readFileSync("run-required-startup-migrations.mjs", "utf8");
    const mainSource = source.slice(source.indexOf("async function main()"));
    expect(REQUIRED_MIGRATION_TAGS).toEqual([
      "0161_tw_daily_line_bridge",
      "0162_daily_report_reliable_submission",
    ]);
    expect(source).toContain("CREATE TABLE IF NOT EXISTS __drizzle_migrations");
    expect(mainSource.indexOf("await ensureDrizzleLedgerTable(connection)")).toBeLessThan(
      mainSource.indexOf("for (const descriptor of descriptors)"),
    );
    expect(mainSource.indexOf("await verifyRequiredSchema(connection)")).toBeLessThan(
      mainSource.indexOf("await recordVerifiedRequiredMigrations(connection, descriptors)"),
    );
  });

  it("reports fail-closed custom startup errors instead of UNKNOWN", () => {
    expect(mysqlErrorCode(new Error("STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED"))).toBe(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );
    expect(mysqlErrorCode(new Error("DATABASE_URL_REQUIRED"))).toBe("DATABASE_URL_REQUIRED");
  });

  it("reports a behind ledger state before verified baseline repair", async () => {
    const state = await readDrizzleLedgerState(
      connectionForLedger({ previousHashes: [] }) as never,
      descriptor,
    );

    expect(state).toEqual({
      ledgerAvailable: true,
      alreadyRecorded: false,
      canRecordSafely: false,
    });
  });

  it("repairs the required ledger chain only in verified migration order", async () => {
    const ledger = new Map<number, string[]>();
    const inserts: Array<[string, number]> = [];
    const connection = {
      execute: async (sql: string, params: unknown[] = []): Promise<ExecuteResult> => {
        if (sql.includes("information_schema.TABLES")) return [[{ count: 1 }], undefined];
        if (sql.includes("WHERE created_at = ? ORDER BY id")) {
          const hashes = ledger.get(Number(params[0])) || [];
          return [[...hashes.map(hash => ({ hash }))], undefined];
        }
        if (sql.startsWith("INSERT INTO __drizzle_migrations")) {
          const hash = String(params[0]);
          const createdAt = Number(params[1]);
          ledger.set(createdAt, [...(ledger.get(createdAt) || []), hash]);
          inserts.push([hash, createdAt]);
          return [[], undefined];
        }
        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    };
    const descriptors = [
      {
        tag: "0161_tw_daily_line_bridge",
        folderMillis: 200,
        previousFolderMillis: 100,
        previousHash: "legacy-not-required-after-schema-verification",
        hash: "bridge-hash",
      },
      {
        tag: "0162_daily_report_reliable_submission",
        folderMillis: 300,
        previousFolderMillis: 200,
        previousHash: "bridge-hash",
        hash: "report-hash",
      },
    ];

    await recordVerifiedRequiredMigrations(connection as never, descriptors as never);
    expect(inserts).toEqual([
      ["bridge-hash", 200],
      ["report-hash", 300],
    ]);
    await recordVerifiedRequiredMigrations(connection as never, descriptors as never);
    expect(inserts).toHaveLength(2);
  });

  it("does not replace a conflicting historical predecessor with a verified baseline", async () => {
    const connection = connectionForLedger({ previousHashes: ["wrong-previous-hash"] });
    await expect(
      recordVerifiedRequiredMigrations(connection as never, [{
        tag: "0161_tw_daily_line_bridge",
        folderMillis: 300,
        previousFolderMillis: 200,
        previousHash: "previous-hash",
        hash: "target-hash",
      }] as never),
    ).rejects.toThrow("STARTUP_MIGRATION_LEDGER_CHAIN_GAP");
  });

  it("fails closed when 0161 is recorded but its historical predecessor hash conflicts", async () => {
    const connection = connectionForLedger({
      targetHashes: ["target-hash"],
      previousHashes: ["wrong-previous-hash"],
    });
    await expect(
      recordVerifiedRequiredMigrations(connection as never, [{
        tag: "0161_tw_daily_line_bridge",
        folderMillis: 300,
        previousFolderMillis: 200,
        previousHash: "previous-hash",
        hash: "target-hash",
      }] as never),
    ).rejects.toThrow("STARTUP_MIGRATION_LEDGER_CHAIN_GAP");
  });

  it("records the target only when the exact predecessor hash is represented", async () => {
    await expect(
      readDrizzleLedgerState(
        connectionForLedger({ previousHashes: ["previous-hash"] }) as never,
        descriptor,
      ),
    ).resolves.toEqual({
      ledgerAvailable: true,
      alreadyRecorded: false,
      canRecordSafely: true,
    });

    await expect(
      readDrizzleLedgerState(
        connectionForLedger({ previousHashes: ["wrong-previous-hash"] }) as never,
        descriptor,
      ),
    ).resolves.toEqual({
      ledgerAvailable: true,
      alreadyRecorded: false,
      canRecordSafely: false,
    });
  });

  it("does not treat an unrelated later ledger row as proof of the predecessor", async () => {
    const requestedTimestamps: number[] = [];
    const connection = {
      execute: async (sql: string, params: unknown[] = []): Promise<ExecuteResult> => {
        if (sql.includes("information_schema.TABLES")) return [[{ count: 1 }], undefined];
        if (sql.includes("WHERE created_at = ? ORDER BY id")) {
          requestedTimestamps.push(Number(params[0]));
          return [[], undefined];
        }
        if (sql.includes("ORDER BY created_at DESC LIMIT 1")) {
          return [[{ hash: "unrelated", created_at: 999 }], undefined];
        }
        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    };

    const state = await readDrizzleLedgerState(connection as never, descriptor);
    expect(state.canRecordSafely).toBe(false);
    expect(requestedTimestamps).toEqual([300, 200]);
  });

  it("still fails closed when the target migration timestamp has another hash", async () => {
    await expect(
      readDrizzleLedgerState(
        connectionForLedger({
          targetHashes: ["different-hash"],
          previousHashes: ["previous-hash"],
        }) as never,
        descriptor,
      ),
    ).rejects.toThrow("STARTUP_MIGRATION_LEDGER_HASH_MISMATCH");
  });

  it("requires every runtime column and all migration-critical indexes", async () => {
    const readyConnection = {
      execute: async (sql: string): Promise<ExecuteResult> => {
        if (sql.includes("information_schema.STATISTICS")) {
          return [requiredIndexRows(), undefined];
        }
        return [[], undefined];
      },
    };
    await expect(verifyRequiredSchema(readyConnection as never)).resolves.toBeUndefined();

    const missingColumnConnection = {
      execute: async (sql: string): Promise<ExecuteResult> => {
        if (sql.includes("contentHash")) throw new Error("ER_BAD_FIELD_ERROR");
        if (sql.includes("information_schema.STATISTICS")) {
          return [requiredIndexRows(), undefined];
        }
        return [[], undefined];
      },
    };
    await expect(verifyRequiredSchema(missingColumnConnection as never)).rejects.toThrow(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );

    const missingBridgeColumnConnection = {
      execute: async (sql: string): Promise<ExecuteResult> => {
        if (sql.includes("dailyReportEnabled")) throw new Error("ER_BAD_FIELD_ERROR");
        if (sql.includes("information_schema.STATISTICS")) {
          return [requiredIndexRows(), undefined];
        }
        return [[], undefined];
      },
    };
    await expect(verifyRequiredSchema(missingBridgeColumnConnection as never)).rejects.toThrow(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );

    const missingUniqueKeyConnection = {
      execute: async (sql: string): Promise<ExecuteResult> => {
        if (sql.includes("information_schema.STATISTICS")) {
          return [
            requiredIndexRows().filter(
              row => row.indexName !== "uq_report_attachments_upload",
            ),
            undefined,
          ];
        }
        return [[], undefined];
      },
    };
    await expect(verifyRequiredSchema(missingUniqueKeyConnection as never)).rejects.toThrow(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );

    const metadataDeniedConnection = {
      execute: async (sql: string): Promise<ExecuteResult> => {
        if (sql.includes("information_schema.STATISTICS")) {
          throw new Error("ER_TABLEACCESS_DENIED_ERROR");
        }
        return [[], undefined];
      },
    };
    await expect(verifyRequiredSchema(metadataDeniedConnection as never)).rejects.toThrow(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );
  });
});
