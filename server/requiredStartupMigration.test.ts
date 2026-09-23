import { describe, expect, it } from "vitest";
import {
  mysqlErrorCode,
  readDrizzleLedgerState,
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
  add(
    "tw_daily_line_report_inbox",
    "tw_daily_line_inbox_staff_date_uq",
    ["report_date", "staff_name"],
    true,
  );
  add(
    "tw_daily_line_report_inbox",
    "tw_daily_line_inbox_date_idx",
    ["report_date", "staff_name", "report_id"],
    false,
  );
  add("tw_daily_line_rollouts", "PRIMARY", ["rollout_key"], true);
  add("tw_daily_line_outbox", "PRIMARY", ["id"], true);
  add("tw_daily_line_outbox", "tw_daily_line_outbox_event_uq", ["event_id"], true);
  add(
    "tw_daily_line_outbox",
    "tw_daily_line_outbox_due_idx",
    ["status", "next_attempt_at", "id"],
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

describe("required startup migration", () => {
  it("reports fail-closed custom startup errors instead of UNKNOWN", () => {
    expect(mysqlErrorCode(new Error("STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED"))).toBe(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );
    expect(mysqlErrorCode(new Error("DATABASE_URL_REQUIRED"))).toBe("DATABASE_URL_REQUIRED");
  });

  it("allows schema repair when the historical Drizzle ledger is behind without fabricating a ledger row", async () => {
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
        if (sql.includes("line_retry_key")) throw new Error("ER_BAD_FIELD_ERROR");
        if (sql.includes("information_schema.STATISTICS")) {
          return [requiredIndexRows(), undefined];
        }
        return [[], undefined];
      },
    };
    await expect(verifyRequiredSchema(missingColumnConnection as never)).rejects.toThrow(
      "STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED",
    );

    const missingUniqueKeyConnection = {
      execute: async (sql: string): Promise<ExecuteResult> => {
        if (sql.includes("information_schema.STATISTICS")) {
          return [
            requiredIndexRows().filter(
              row => row.indexName !== "tw_daily_line_outbox_event_uq",
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
