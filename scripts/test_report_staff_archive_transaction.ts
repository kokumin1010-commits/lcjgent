import assert from "node:assert/strict";
import { archiveReportProfileWithDb } from "../server/manualStaffPersistence";

type Row = Record<string, any>;

function cloneRow(row: Row): Row {
  return { ...row, archivedAt: row.archivedAt ? new Date(row.archivedAt) : null, manualRevisionAt: row.manualRevisionAt ? new Date(row.manualRevisionAt) : null };
}

function createFakeDb(seed: Row, failAudit = false) {
  let row = cloneRow(seed);
  let auditEvents = 0;

  const db = {
    async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      const before = cloneRow(row);
      const beforeEvents = auditEvents;
      const tx = {
        select() {
          return {
            from() {
              return {
                where() {
                  return {
                    async limit() {
                      return [cloneRow(row)];
                    },
                  };
                },
              };
            },
          };
        },
        update() {
          return {
            set(values: Row) {
              return {
                async where() {
                  row = { ...row, ...values };
                  return { affectedRows: 1 };
                },
              };
            },
          };
        },
        async execute() {
          if (failAudit) throw new Error("simulated audit write failure");
          auditEvents += 1;
          return { affectedRows: 1 };
        },
      };
      try {
        return await callback(tx);
      } catch (error) {
        row = before;
        auditEvents = beforeEvents;
        throw error;
      }
    },
  };

  return {
    db,
    getRow: () => cloneRow(row),
    getAuditEvents: () => auditEvents,
  };
}

const seed = {
  id: 202,
  name: "transaction-fixture",
  country: "日本",
  linkedStaffId: 302,
  isActive: "active",
  archivedAt: null,
  archivedBy: null,
  archiveReason: null,
  manualRevisionAt: null,
  manualRevisionBy: null,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
};

const successful = createFakeDb(seed);
const firstResult = await archiveReportProfileWithDb(successful.db, {
  reportStaffId: 202,
  actor: { id: 77, name: "fixture-admin" },
  archiveReason: "fixture archive",
});
assert.deepEqual(firstResult, { reportStaffId: 202, archived: true });
const archived = successful.getRow();
assert.ok(archived.archivedAt instanceof Date);
assert.equal(archived.archivedBy, 77);
assert.equal(archived.archiveReason, "fixture archive");
assert.equal(archived.isActive, "inactive");
assert.ok(archived.manualRevisionAt instanceof Date);
assert.equal(archived.manualRevisionBy, 77);
assert.equal(successful.getAuditEvents(), 1);

const repeatedResult = await archiveReportProfileWithDb(successful.db, {
  reportStaffId: 202,
  actor: { id: 77, name: "fixture-admin" },
});
assert.deepEqual(repeatedResult, { reportStaffId: 202, archived: false });
assert.equal(successful.getAuditEvents(), 1);

const failing = createFakeDb(seed, true);
await assert.rejects(
  archiveReportProfileWithDb(failing.db, {
    reportStaffId: 202,
    actor: { id: 77, name: "fixture-admin" },
  }),
  /simulated audit write failure/,
);
const rolledBack = failing.getRow();
assert.equal(rolledBack.archivedAt, null);
assert.equal(rolledBack.archivedBy, null);
assert.equal(rolledBack.archiveReason, null);
assert.equal(rolledBack.isActive, "active");
assert.equal(rolledBack.manualRevisionAt, null);
assert.equal(rolledBack.manualRevisionBy, null);
assert.equal(failing.getAuditEvents(), 0);

console.log(JSON.stringify({
  passed: true,
  productionDatabaseConnected: false,
  scenarios: ["archive_commit", "repeat_idempotent", "audit_failure_rollback"],
}, null, 2));
