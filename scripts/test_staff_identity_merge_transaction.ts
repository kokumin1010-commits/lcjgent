import assert from "node:assert/strict";
import {
  ensureReportProfileForStaffWithPool,
  mergeStaffIdentityWithPool,
  previewStaffIdentityMergeWithPool,
} from "../server/staffIdentityConsistency";

type StaffRow = Record<string, any> & { id: number };
type ReportRow = Record<string, any> & { id: number; linkedStaffId: number };

function clone<T>(value: T): T {
  return structuredClone(value);
}

class FakeConnection {
  staff = new Map<number, StaffRow>();
  reports = new Map<number, ReportRow>();
  backupIds = new Set<number>([9001]);
  nextReportId = 500;
  failManualAudit = false;
  committed = 0;
  rolledBack = 0;
  private snapshot: { staff: Map<number, StaffRow>; reports: Map<number, ReportRow>; nextReportId: number } | null = null;

  constructor(staffRows: StaffRow[], reportRows: ReportRow[]) {
    for (const row of staffRows) this.staff.set(row.id, clone(row));
    for (const row of reportRows) this.reports.set(row.id, clone(row));
  }

  async beginTransaction() {
    this.snapshot = {
      staff: new Map([...this.staff].map(([id, row]) => [id, clone(row)])),
      reports: new Map([...this.reports].map(([id, row]) => [id, clone(row)])),
      nextReportId: this.nextReportId,
    };
  }

  async commit() {
    this.snapshot = null;
    this.committed += 1;
  }

  async rollback() {
    if (this.snapshot) {
      this.staff = this.snapshot.staff;
      this.reports = this.snapshot.reports;
      this.nextReportId = this.snapshot.nextReportId;
    }
    this.snapshot = null;
    this.rolledBack += 1;
  }

  release() {}

  async query(sql: string, params: any[] = []): Promise<any> {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("information_schema.columns")) return [[{ count: 1 }]];
    if (normalized.includes("FROM staff WHERE id = ?") && normalized.includes("FOR UPDATE")) {
      const row = this.staff.get(Number(params[0]));
      return [[row ? clone(row) : undefined].filter(Boolean)];
    }
    if (normalized.includes("SELECT id FROM staff") && normalized.includes("LOWER(TRIM(email))")) {
      const email = String(params[0]).toLowerCase();
      return [[...this.staff.values()].filter((row) =>
        String(row.email).trim().toLowerCase() === email && !row.mergedIntoStaffId && !row.archivedAt
      ).map((row) => ({ id: row.id }))];
    }
    if (normalized.startsWith("SELECT id FROM report_staff WHERE linkedStaffId=?")) {
      const staffId = Number(params[0]);
      return [[...this.reports.values()].filter((row) => row.linkedStaffId === staffId).map((row) => ({ id: row.id }))];
    }
    if (normalized.includes("SELECT DATE(source.date)") || normalized.includes("SELECT source.date AS dateKey")) return [[]];
    if (normalized.includes("FROM users WHERE staffId IN")) return [[]];
    if (normalized.includes("FROM lcj_coin_holdings WHERE holderType='staff'")) return [[]];
    if (normalized.startsWith("SELECT COUNT(*) AS count FROM")) return [[{ count: 0 }]];
    if (normalized.startsWith("SELECT id,status FROM db_backup_runs")) {
      return [[this.backupIds.has(Number(params[0])) ? { id: Number(params[0]), status: "success" } : undefined].filter(Boolean)];
    }
    if (normalized.includes("FROM report_staff WHERE id=? LIMIT 1")) {
      const row = this.reports.get(Number(params[0]));
      return [[row ? clone(row) : undefined].filter(Boolean)];
    }
    throw new Error(`Unhandled query: ${normalized}`);
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("INSERT INTO staff_identity_merge_events")) return [{ insertId: 700, affectedRows: 1 }];
    if (normalized.startsWith("UPDATE staff SET identityKey=?")) {
      const row = this.staff.get(Number(params[2]));
      assert(row);
      row.identityKey = params[0];
      row.manualRevisionBy = Number(params[1]);
      row.manualRevisionAt = new Date("2026-08-27T10:00:00Z");
      return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith("UPDATE staff SET identityKey=NULL,mergedIntoStaffId=?")) {
      const row = this.staff.get(Number(params[3]));
      assert(row);
      row.identityKey = null;
      row.mergedIntoStaffId = Number(params[0]);
      row.isActive = "inactive";
      row.archivedAt = new Date("2026-08-27T10:00:00Z");
      row.archivedBy = Number(params[1]);
      row.archiveReason = "重複HR主档を正規staffへ統合";
      row.manualRevisionBy = Number(params[2]);
      row.manualRevisionAt = new Date("2026-08-27T10:00:00Z");
      return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith("INSERT INTO manual_data_change_events")) {
      if (this.failManualAudit) throw new Error("synthetic audit failure");
      return [{ insertId: 800, affectedRows: 1 }];
    }
    if (normalized.startsWith("UPDATE staff_identity_merge_events")) return [{ affectedRows: 1 }];
    if (normalized.startsWith("INSERT INTO report_staff")) {
      const id = this.nextReportId++;
      const row: ReportRow = {
        id,
        name: String(params[0]),
        country: String(params[1]),
        linkedStaffId: Number(params[2]),
        isActive: "active",
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        manualRevisionAt: new Date("2026-08-27T10:00:00Z"),
        manualRevisionBy: Number(params[3]),
        createdAt: new Date("2026-08-27T10:00:00Z"),
        updatedAt: new Date("2026-08-27T10:00:00Z"),
      };
      this.reports.set(id, row);
      return [{ insertId: id, affectedRows: 1 }];
    }
    if (normalized.startsWith("DELETE source FROM task_staff") || normalized.startsWith("DELETE source FROM chat_room_members")) {
      return [{ affectedRows: 0 }];
    }
    if (normalized.startsWith("UPDATE task_staff SET") || normalized.startsWith("UPDATE chat_room_members SET")) {
      return [{ affectedRows: 0 }];
    }
    if (normalized.startsWith("UPDATE morning_principle_recitations")) return [{ affectedRows: 0 }];
    if (normalized.startsWith("UPDATE `")) return [{ affectedRows: 0 }];
    throw new Error(`Unhandled execute: ${normalized}`);
  }
}

class FakePool {
  constructor(public connection: FakeConnection) {}
  async getConnection() { return this.connection as any; }
  async end() {}
}

function staffRow(id: number, name: string, email: string): StaffRow {
  return {
    id,
    name,
    email,
    emailEvidenceStatus: "verified",
    country: "中国",
    isActive: "active",
    resignDate: null,
    resignReason: null,
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
    identityKey: null,
    mergedIntoStaffId: null,
    manualRevisionAt: null,
    manualRevisionBy: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
  };
}

async function main() {
  const actor = { id: 1, name: "synthetic-admin" };
  const connection = new FakeConnection(
    [staffRow(10, "同一员工", "same@example.com"), staffRow(20, "同一员工", "SAME@example.com")],
    [{ id: 100, name: "同一员工", country: "中国", linkedStaffId: 10, isActive: "active", archivedAt: null }],
  );
  const pool = new FakePool(connection) as any;
  const preview = await previewStaffIdentityMergeWithPool(pool, 10, 20);
  assert.equal(preview.eligible, true);
  assert.equal(preview.identityKey, "email:same@example.com");

  const merged = await mergeStaffIdentityWithPool(pool, {
    canonicalStaffId: 10,
    duplicateStaffId: 20,
    expectedIdentityKey: preview.identityKey,
    backupId: 9001,
    actor,
  });
  assert.equal(merged.merged, true);
  assert.equal(connection.staff.get(10)?.identityKey, "email:same@example.com");
  assert.equal(connection.staff.get(20)?.mergedIntoStaffId, 10);
  assert.equal(connection.staff.get(20)?.isActive, "inactive");
  assert.ok(connection.staff.get(20)?.archivedAt);

  const repeated = await mergeStaffIdentityWithPool(pool, {
    canonicalStaffId: 10,
    duplicateStaffId: 20,
    expectedIdentityKey: preview.identityKey,
    backupId: 9001,
    actor,
  });
  assert.equal(repeated.merged, false);

  const mismatchConnection = new FakeConnection(
    [staffRow(30, "同名员工", "a@example.com"), staffRow(31, "同名员工", "b@example.com")],
    [{ id: 101, name: "同名员工", country: "中国", linkedStaffId: 30, isActive: "active", archivedAt: null }],
  );
  await assert.rejects(() => previewStaffIdentityMergeWithPool(new FakePool(mismatchConnection) as any, 30, 31), /verified email identity does not match/);

  const rollbackConnection = new FakeConnection(
    [staffRow(40, "回滚员工", "rollback@example.com"), staffRow(41, "回滚员工", "ROLLBACK@example.com")],
    [{ id: 102, name: "回滚员工", country: "中国", linkedStaffId: 40, isActive: "active", archivedAt: null }],
  );
  rollbackConnection.failManualAudit = true;
  await assert.rejects(() => mergeStaffIdentityWithPool(new FakePool(rollbackConnection) as any, {
    canonicalStaffId: 40,
    duplicateStaffId: 41,
    expectedIdentityKey: "email:rollback@example.com",
    backupId: 9001,
    actor,
  }), /synthetic audit failure/);
  assert.equal(rollbackConnection.staff.get(41)?.mergedIntoStaffId, null);
  assert.equal(rollbackConnection.staff.get(41)?.isActive, "active");

  const missingReportConnection = new FakeConnection([staffRow(51, "漏档员工", "missing@example.com")], []);
  const created = await ensureReportProfileForStaffWithPool(new FakePool(missingReportConnection) as any, { staffId: 51, actor });
  assert.equal(created.created, true);
  assert.equal(missingReportConnection.reports.get(created.reportStaffId)?.linkedStaffId, 51);
  const repeatedProfile = await ensureReportProfileForStaffWithPool(new FakePool(missingReportConnection) as any, { staffId: 51, actor });
  assert.equal(repeatedProfile.created, false);
  assert.equal(repeatedProfile.reportStaffId, created.reportStaffId);

  console.log(JSON.stringify({
    passed: true,
    mergeCommitted: true,
    repeatedMergeNoop: true,
    sameNameDifferentEmailRejected: true,
    auditFailureRolledBack: true,
    reportProfileCreatedOnce: true,
    railwayConnections: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
