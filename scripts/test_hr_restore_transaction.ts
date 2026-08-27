import assert from "node:assert/strict";
import { restoreArchivedStaffWithPool } from "../server/hrStaffArchive";

type Row = Record<string, any>;

type State = {
  staff: Record<number, Row>;
  report: Record<number, Row>;
  userEmails: string[];
  manualEvents: Row[];
  archiveEvents: Row[];
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sqlText(value: unknown): string {
  return String(value).replace(/\s+/g, " ").trim();
}

function makePool(initial: State, options: { failAudit?: boolean } = {}) {
  let state = clone(initial);
  let snapshot: State | null = null;
  let commitCount = 0;
  let rollbackCount = 0;
  const connection = {
    async beginTransaction() {
      snapshot = clone(state);
    },
    async commit() {
      commitCount += 1;
      snapshot = null;
    },
    async rollback() {
      rollbackCount += 1;
      if (snapshot) state = clone(snapshot);
      snapshot = null;
    },
    release() {},
    async query(query: unknown, params: unknown[] = []) {
      const sql = sqlText(query);
      if (sql.includes("information_schema.COLUMNS")) return [[{ count: 0 }]];
      if (sql.includes("FROM staff WHERE id = ?")) {
        const row = state.staff[Number(params[0])];
        return [row ? [clone(row)] : []];
      }
      if (sql.includes("FROM report_staff WHERE id = ?")) {
        const row = state.report[Number(params[0])];
        return [row ? [clone(row)] : []];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    async execute(query: unknown, params: unknown[] = []) {
      const sql = sqlText(query);
      if (sql.startsWith("UPDATE staff SET isActive = 'active'")) {
        const row = state.staff[Number(params[1])];
        if (!row) return [{ affectedRows: 0 }];
        Object.assign(row, {
          isActive: "active",
          resignDate: null,
          resignReason: null,
          archivedAt: null,
          archivedBy: null,
          archiveReason: null,
          manualRevisionAt: new Date("2026-08-27T09:30:00.000Z"),
          manualRevisionBy: Number(params[0]),
        });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE report_staff SET isActive = 'active'")) {
        const row = state.report[Number(params[1])];
        if (!row || Number(row.linkedStaffId) !== Number(params[2])) return [{ affectedRows: 0 }];
        Object.assign(row, {
          isActive: "active",
          archivedAt: null,
          archivedBy: null,
          archiveReason: null,
          manualRevisionAt: new Date("2026-08-27T09:30:00.000Z"),
          manualRevisionBy: Number(params[0]),
        });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE users SET email = ?")) {
        const target = String(params[0]);
        const resigned = state.userEmails.findIndex((email) => /^resigned_\d+_/.test(email) && email.endsWith(`_${target}`));
        if (resigned < 0) return [{ affectedRows: 0 }];
        state.userEmails[resigned] = target;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO manual_data_change_events")) {
        if (options.failAudit) throw new Error("simulated audit failure");
        state.manualEvents.push({
          entityType: params[0],
          entityId: params[1],
          action: "restore",
          changedFields: JSON.parse(String(params[2])),
          actorId: params[5],
          actorName: params[6],
        });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO hr_staff_archive_events")) {
        state.archiveEvents.push({
          staffId: params[0],
          reportStaffId: params[1],
          action: params[2],
          archiveReason: params[3],
          performedBy: params[4],
        });
        return [{ affectedRows: 1 }];
      }
      throw new Error(`unexpected execute: ${sql}`);
    },
  };
  const pool = {
    async execute() { return [{ affectedRows: 0 }]; },
    async getConnection() { return connection; },
  } as any;
  return {
    pool,
    get state() { return clone(state); },
    get commitCount() { return commitCount; },
    get rollbackCount() { return rollbackCount; },
  };
}

const base: State = {
  staff: {
    55: {
      id: 55,
      name: "同名历史档案",
      email: "history@example.invalid",
      isActive: "inactive",
      resignDate: new Date("2026-08-27T08:38:39.000Z"),
      resignReason: "historical",
      evidenceStatus: "manual",
      archivedAt: new Date("2026-08-27T08:40:17.000Z"),
      archivedBy: 30006,
      archiveReason: "historical archive",
      manualRevisionAt: new Date("2026-08-27T08:40:17.000Z"),
      manualRevisionBy: 30006,
    },
    57: {
      id: 57,
      name: "目标当前档案",
      email: "target@example.invalid",
      isActive: "inactive",
      resignDate: new Date("2026-08-27T08:41:27.000Z"),
      resignReason: "账号注销",
      evidenceStatus: "manual",
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      manualRevisionAt: new Date("2026-08-27T08:40:33.000Z"),
      manualRevisionBy: 30006,
    },
  },
  report: {
    119: {
      id: 119,
      name: "同名历史档案",
      email: null,
      linkedStaffId: 55,
      isActive: "active",
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      manualRevisionAt: new Date("2026-08-27T08:38:20.000Z"),
      manualRevisionBy: 30006,
    },
    146: {
      id: 146,
      name: "目标当前档案",
      email: null,
      linkedStaffId: 57,
      isActive: "inactive",
      archivedAt: new Date("2026-08-27T08:41:27.000Z"),
      archivedBy: 30006,
      archiveReason: "account deactivated",
      manualRevisionAt: new Date("2026-08-27T08:41:27.000Z"),
      manualRevisionBy: 30006,
    },
  },
  userEmails: ["resigned_999_target@example.invalid"],
  manualEvents: [],
  archiveEvents: [],
};

const success = makePool(base);
const successResult = await restoreArchivedStaffWithPool(success.pool, {
  staffId: 57,
  reportStaffId: 146,
  performedBy: 30006,
  performedByName: "operator",
  restoreMode: "reinstate",
});
assert.equal(successResult.restored, true);
assert.equal(successResult.userAccountRestored, true);
assert.equal(success.state.staff[57].isActive, "active");
assert.equal(success.state.staff[57].resignDate, null);
assert.equal(success.state.staff[57].resignReason, null);
assert.equal(success.state.staff[57].archivedAt, null);
assert.equal(success.state.report[146].isActive, "active");
assert.equal(success.state.report[146].archivedAt, null);
assert.equal(success.state.userEmails[0], "target@example.invalid");
assert.equal(success.state.manualEvents.length, 2);
assert.deepEqual(success.state.manualEvents.map((event) => event.entityType), ["staff", "report_staff"]);
assert.equal(success.state.archiveEvents[0].action, "reinstate");
assert.equal(success.commitCount, 1);
assert.equal(success.rollbackCount, 0);
assert.deepEqual(success.state.staff[55], base.staff[55], "same-name historical staff must not change");
assert.deepEqual(success.state.report[119], base.report[119], "same-name historical report staff must not change");

const idempotent = makePool(success.state);
const idempotentResult = await restoreArchivedStaffWithPool(idempotent.pool, {
  staffId: 57,
  reportStaffId: 146,
  performedBy: 30006,
  performedByName: "operator",
  restoreMode: "reinstate",
});
assert.equal(idempotentResult.restored, false);
assert.equal(idempotent.commitCount, 1);
assert.equal(idempotent.state.manualEvents.length, 2);
assert.equal(idempotent.state.archiveEvents.length, 1);

const mismatch = makePool(base);
await assert.rejects(
  restoreArchivedStaffWithPool(mismatch.pool, {
    staffId: 57,
    reportStaffId: 119,
    performedBy: 30006,
    performedByName: "operator",
    restoreMode: "restore",
  }),
  /紐付けが一致しません/,
);
assert.equal(mismatch.rollbackCount, 1);
assert.deepEqual(mismatch.state, base);

const auditFailure = makePool(base, { failAudit: true });
await assert.rejects(
  restoreArchivedStaffWithPool(auditFailure.pool, {
    staffId: 57,
    reportStaffId: 146,
    performedBy: 30006,
    performedByName: "operator",
    restoreMode: "restore",
  }),
  /simulated audit failure/,
);
assert.equal(auditFailure.commitCount, 0);
assert.equal(auditFailure.rollbackCount, 1);
assert.deepEqual(auditFailure.state, base);

console.log("PASS HR restore transaction: full restore, idempotent, same-name isolation, mismatch rejection, audit rollback");
