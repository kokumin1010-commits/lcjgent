import { describe, expect, it, vi } from "vitest";
import { mergeReportStaffPlaceholderWithPool, previewReportStaffPlaceholderMergeWithPool } from "./staffIdentityConsistency";

function makeKeepCanonicalPool() {
  let placeholderArchived = false;
  let referenceMigrationDone = false;
  let reportLinksMigrated = false;
  const canonical = {
    id: 1,
    name: "同一员工",
    email: "verified@example.com",
    country: "中国",
    department: "运营部",
    emailEvidenceStatus: "verified",
    isActive: "active",
    archivedAt: null,
    mergedIntoStaffId: null,
    updatedAt: "2026-09-10T00:00:00.000Z",
  };
  const placeholder = {
    id: 2,
    name: "同一员工",
    email: "same.staff@lcj.placeholder",
    country: "中国",
    department: null,
    emailEvidenceStatus: "unverified",
    isActive: placeholderArchived ? "inactive" : "active",
    archivedAt: placeholderArchived ? "2026-09-10T02:00:00.000Z" : null,
    mergedIntoStaffId: placeholderArchived ? 1 : null,
    updatedAt: "2026-09-10T00:00:01.000Z",
  };
  const report = {
    id: 15,
    name: "同一员工",
    country: "中国",
    linkedStaffId: 1,
    isActive: "active",
    archivedAt: null,
    updatedAt: "2026-09-10T00:00:02.000Z",
  };
  const historicalReport = {
    id: 20,
    name: "同一员工",
    country: "中国",
    linkedStaffId: 2,
    isActive: "inactive",
    archivedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  const reportUpdateStatements: string[] = [];

  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    query: vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      if (sql.includes("FROM staff WHERE id = ?")) {
        return [[Number(params[0]) === 1 ? canonical : { ...placeholder }], []];
      }
      if (sql.includes("FROM report_staff WHERE linkedStaffId=?")) {
        if (Number(params[0]) === 1) return [[report], []];
        if (Number(params[0]) === 2) return [[historicalReport], []];
        return [[], []];
      }
      if (sql.includes("SELECT * FROM report_staff WHERE linkedStaffId IN")) {
        return [[report, { ...historicalReport, linkedStaffId: reportLinksMigrated ? 1 : 2 }], []];
      }
      if (sql.includes("SELECT * FROM report_staff WHERE id IN")) {
        return [[{ ...historicalReport, linkedStaffId: 1 }], []];
      }
      if (sql.includes("FROM db_backup_runs WHERE id=?")) {
        return [[{ id: 99, status: "success", reason: "pre-staff-identity-merge", completedAt: new Date() }], []];
      }
      if (sql.includes("information_schema.columns")) return [[{ count: 1 }], []];
      if (sql.includes("SELECT COUNT(*) AS count FROM")) {
        const id = Number(params[0]);
        if (sql.includes("`staff_schedules`") && id === 2 && !referenceMigrationDone) return [[{ count: 1 }], []];
        if (sql.includes("`report_staff`") && id === 1) return [[{ count: 1 }], []];
        if (sql.includes("`report_staff`") && id === 2 && !reportLinksMigrated) return [[{ count: 1 }], []];
        return [[{ count: 0 }], []];
      }
      if (sql.includes("JOIN staff_schedules target")) return [[], []];
      if (sql.includes("JOIN morning_principle_recitations target")) return [[], []];
      if (sql.includes("FROM users WHERE staffId IN")) return [[], []];
      if (sql.includes("FROM lcj_coin_holdings WHERE")) return [[], []];
      throw new Error(`unexpected query: ${sql}`);
    }),
    execute: vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      if (sql.includes("INSERT INTO staff_identity_merge_events")) return [{ insertId: 500, affectedRows: 1 }, []];
      if (sql.startsWith("UPDATE report_staff")) {
        reportUpdateStatements.push(sql);
        reportLinksMigrated = true;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE `staff_schedules`")) {
        referenceMigrationDone = true;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE staff SET identityKey=NULL,mergedIntoStaffId")) {
        placeholderArchived = true;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith("UPDATE") || sql.startsWith("INSERT") || sql.startsWith("DELETE")) return [{ affectedRows: 0 }, []];
      throw new Error(`unexpected execute: ${sql} ${JSON.stringify(params)}`);
    }),
  };
  return {
    pool: { getConnection: vi.fn(async () => connection) } as any,
    connection,
    reportUpdateStatements,
  };
}

describe("report placeholder merge execution when canonical already owns the report profile", () => {
  it("keeps the current report profile, moves archived report history and schedule, and archives only the placeholder", async () => {
    const { pool, connection, reportUpdateStatements } = makeKeepCanonicalPool();
    const preview = await previewReportStaffPlaceholderMergeWithPool(pool, 1, 2);
    expect(preview.reportProfileMode).toBe("keep_canonical");
    expect(preview.referenceCounts.placeholder.staffSchedules).toBe(1);
    expect(preview.placeholderHistoricalReportProfileCount).toBe(1);
    expect(preview.referenceCounts.placeholder.reportStaffLinks).toBe(1);

    const result = await mergeReportStaffPlaceholderWithPool(pool, {
      canonicalStaffId: 1,
      placeholderStaffId: 2,
      expectedFingerprint: preview.fingerprint,
      backupId: 99,
      actor: { id: 7, name: "QA Admin" },
    });

    expect(result.merged).toBe(true);
    expect(result.preview.reportProfileMode).toBe("keep_canonical");
    expect(result.movedCounts.staffSchedules).toBe(1);
    expect(result.movedCounts.reportStaffLinks).toBe(1);
    expect(reportUpdateStatements).toHaveLength(1);
    expect(reportUpdateStatements[0]).toContain("WHERE linkedStaffId=?");
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(2);
  });
});
