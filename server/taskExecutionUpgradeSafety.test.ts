import { describe, expect, it, vi } from "vitest";
import type { Connection } from "mysql2/promise";
import {
  TASK_ACCEPTANCE_MIGRATION,
  backfillLegacyAcceptanceBoundaries,
  captureLegacyAcceptanceBoundaries,
  recordTaskAcceptanceMigration,
  verifyTaskAcceptanceSchema,
} from "./taskExecutionUpgrade";

function mockConnection(handler: (statement: string, params?: unknown[]) => Promise<unknown>) {
  const queryMock = vi.fn(handler);
  return {
    connection: { query: queryMock } as unknown as Connection,
    queryMock,
  };
}

const validColumns = [
  { tableName: "tasks", columnName: "requiresAcceptance", dataType: "tinyint", isNullable: "NO", columnDefault: "1", characterMaximumLength: null },
  { tableName: "report_followups", columnName: "requiresAcceptance", dataType: "tinyint", isNullable: "NO", columnDefault: "1", characterMaximumLength: null },
  { tableName: "report_followups", columnName: "completionRevision", dataType: "int", isNullable: "NO", columnDefault: "0", characterMaximumLength: null },
  { tableName: "report_followups", columnName: "completionRequestId", dataType: "varchar", isNullable: "YES", columnDefault: null, characterMaximumLength: 128 },
  { tableName: "task_execution_upgrade_markers", columnName: "markerKey", dataType: "varchar", isNullable: "NO", columnDefault: null, characterMaximumLength: 80 },
  { tableName: "task_execution_upgrade_markers", columnName: "boundaryId", dataType: "bigint", isNullable: "NO", columnDefault: null, characterMaximumLength: null },
  { tableName: "task_completion_review_events", columnName: "requestId", dataType: "varchar", isNullable: "NO", columnDefault: null, characterMaximumLength: 128 },
  { tableName: "task_completion_review_events", columnName: "sourceType", dataType: "enum", isNullable: "NO", columnDefault: null, characterMaximumLength: 12 },
  { tableName: "task_completion_review_events", columnName: "sourceId", dataType: "int", isNullable: "NO", columnDefault: null, characterMaximumLength: null },
  { tableName: "task_completion_review_events", columnName: "subjectKey", dataType: "varchar", isNullable: "NO", columnDefault: null, characterMaximumLength: 80 },
  { tableName: "task_completion_review_events", columnName: "completionVersion", dataType: "bigint", isNullable: "NO", columnDefault: null, characterMaximumLength: null },
  { tableName: "task_completion_review_events", columnName: "decision", dataType: "enum", isNullable: "NO", columnDefault: null, characterMaximumLength: 8 },
  { tableName: "task_completion_review_events", columnName: "decisionNote", dataType: "text", isNullable: "NO", columnDefault: null, characterMaximumLength: 65535 },
  { tableName: "task_completion_review_events", columnName: "decidedByUserId", dataType: "int", isNullable: "NO", columnDefault: null, characterMaximumLength: null },
];

const validIndexes = [
  { tableName: "report_followups", indexName: "uq_report_followup_completion_request", nonUnique: 0, seqInIndex: 1, columnName: "completionRequestId" },
  { tableName: "task_execution_upgrade_markers", indexName: "PRIMARY", nonUnique: 0, seqInIndex: 1, columnName: "markerKey" },
  { tableName: "task_completion_review_events", indexName: "uq_task_completion_review_request", nonUnique: 0, seqInIndex: 1, columnName: "requestId" },
  { tableName: "task_completion_review_events", indexName: "uq_task_completion_review_version", nonUnique: 0, seqInIndex: 1, columnName: "sourceType" },
  { tableName: "task_completion_review_events", indexName: "uq_task_completion_review_version", nonUnique: 0, seqInIndex: 2, columnName: "sourceId" },
  { tableName: "task_completion_review_events", indexName: "uq_task_completion_review_version", nonUnique: 0, seqInIndex: 3, columnName: "subjectKey" },
  { tableName: "task_completion_review_events", indexName: "uq_task_completion_review_version", nonUnique: 0, seqInIndex: 4, columnName: "completionVersion" },
];

function schemaConnection(options?: { columns?: typeof validColumns; indexes?: typeof validIndexes }) {
  return mockConnection(async (statement: string) => {
    if (statement.includes("information_schema.COLUMNS")) return [[...(options?.columns || validColumns)], []];
    if (statement.includes("FROM task_execution_upgrade_markers")) {
      return [[
        { markerKey: "0163_tasks_legacy_max_id", boundaryId: 25 },
        { markerKey: "0163_followups_legacy_max_id", boundaryId: 30 },
      ], []];
    }
    if (statement.includes("information_schema.STATISTICS")) return [[...(options?.indexes || validIndexes)], []];
    return [[], []];
  });
}

describe("task execution asynchronous upgrade safety", () => {
  it("persists immutable legacy id boundaries before acceptance columns are backfilled", async () => {
    const { connection, queryMock } = mockConnection(async () => [[], []]);
    await captureLegacyAcceptanceBoundaries(connection);
    await backfillLegacyAcceptanceBoundaries(connection);

    const statements = queryMock.mock.calls.map(call => String(call[0]));
    expect(statements).toHaveLength(5);
    expect(statements[1]).toContain("INSERT IGNORE INTO task_execution_upgrade_markers");
    expect(statements[1]).toContain("COALESCE(MAX(id), 0) FROM tasks");
    expect(statements[2]).toContain("COALESCE(MAX(id), 0) FROM report_followups");
    expect(statements[3]).toContain("0163_tasks_legacy_max_id");
    expect(statements[3]).toContain("id <= (");
    expect(statements[4]).toContain("0163_followups_legacy_max_id");
    expect(statements[4]).toContain("id <= (");
  });

  it("verifies exact columns and unique indexes before recording the 0163 hash", async () => {
    await expect(verifyTaskAcceptanceSchema(schemaConnection().connection)).resolves.toBeUndefined();

    const { connection: ledgerConnection, queryMock } = mockConnection(
      async (statement: string, params?: unknown[]) => {
        if (statement.includes("information_schema.TABLES")) return [[{ count: 1 }], []];
        if (statement.includes("SELECT hash") && params?.[0] === TASK_ACCEPTANCE_MIGRATION.createdAt) return [[], []];
        if (statement.includes("SELECT hash") && params?.[0] === TASK_ACCEPTANCE_MIGRATION.previousCreatedAt) {
          return [[{ hash: TASK_ACCEPTANCE_MIGRATION.previousHash }], []];
        }
        return [[], []];
      },
    );
    await expect(recordTaskAcceptanceMigration(ledgerConnection)).resolves.toBeUndefined();
    expect(queryMock).toHaveBeenCalledWith(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [TASK_ACCEPTANCE_MIGRATION.hash, TASK_ACCEPTANCE_MIGRATION.createdAt],
    );
  });

  it("validates the 0162 predecessor even when 0163 is already recorded", async () => {
    const { connection } = mockConnection(async (statement: string, params?: unknown[]) => {
      if (statement.includes("information_schema.TABLES")) return [[{ count: 1 }], []];
      if (statement.includes("SELECT hash") && params?.[0] === TASK_ACCEPTANCE_MIGRATION.createdAt) {
        return [[{ hash: TASK_ACCEPTANCE_MIGRATION.hash }], []];
      }
      return [[], []];
    });
    await expect(recordTaskAcceptanceMigration(connection)).rejects.toThrow(
      "TASK_ACCEPTANCE_MIGRATION_PREDECESSOR_MISMATCH",
    );
  });

  it("fails closed instead of fabricating 0163 when the predecessor hash is missing", async () => {
    const { connection, queryMock } = mockConnection(async (statement: string) => {
      if (statement.includes("information_schema.TABLES")) return [[{ count: 1 }], []];
      return [[], []];
    });
    await expect(recordTaskAcceptanceMigration(connection)).rejects.toThrow(
      "TASK_ACCEPTANCE_MIGRATION_PREDECESSOR_MISMATCH",
    );
    expect(queryMock).not.toHaveBeenCalledWith(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      expect.anything(),
    );
  });

  it("rejects a same-name non-unique or wrong-column index", async () => {
    const brokenIndexes = validIndexes.map(index =>
      index.indexName === "uq_task_completion_review_request"
        ? { ...index, nonUnique: 1, columnName: "sourceId" }
        : index,
    );
    await expect(
      verifyTaskAcceptanceSchema(schemaConnection({ indexes: brokenIndexes }).connection),
    ).rejects.toThrow("TASK_ACCEPTANCE_SCHEMA_VERIFICATION_FAILED");
  });

  it("rejects an acceptance column with the wrong default", async () => {
    const brokenColumns = validColumns.map(column =>
      column.tableName === "tasks" && column.columnName === "requiresAcceptance"
        ? { ...column, columnDefault: "0" }
        : column,
    );
    await expect(
      verifyTaskAcceptanceSchema(schemaConnection({ columns: brokenColumns }).connection),
    ).rejects.toThrow("TASK_ACCEPTANCE_SCHEMA_VERIFICATION_FAILED");
  });
});
