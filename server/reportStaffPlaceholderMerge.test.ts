import { describe, expect, it, vi } from "vitest";
import { previewReportStaffPlaceholderMergeWithPool } from "./staffIdentityConsistency";

function makePool(options?: {
  placeholderVerified?: boolean;
  canonicalHasReport?: boolean;
  placeholderHasReport?: boolean;
  scheduleConflict?: boolean;
}) {
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
    emailEvidenceStatus: options?.placeholderVerified ? "verified" : "unverified",
    isActive: "active",
    archivedAt: null,
    mergedIntoStaffId: null,
    updatedAt: "2026-09-10T00:00:01.000Z",
  };
  const report = {
    id: 16,
    name: "同一员工",
    country: "中国",
    linkedStaffId: 2,
    isActive: "active",
    archivedAt: null,
    updatedAt: "2026-09-10T00:00:02.000Z",
  };

  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    query: vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      if (sql.includes("FROM staff WHERE id = ?")) {
        return [[Number(params[0]) === 1 ? canonical : placeholder], []];
      }
      if (sql.includes("FROM report_staff WHERE linkedStaffId=?")) {
        const id = Number(params[0]);
        if (id === 1) return [options?.canonicalHasReport ? [{ ...report, id: 15, linkedStaffId: 1 }] : [], []];
        return [id === 2 && options?.placeholderHasReport !== false ? [report] : [], []];
      }
      if (sql.includes("information_schema.columns")) return [[{ count: 1 }], []];
      if (sql.includes("SELECT COUNT(*) AS count FROM")) {
        const id = Number(params[0]);
        if (sql.includes("`staff_schedules`") && id === 2) return [[{ count: 1 }], []];
        if (sql.includes("`report_staff`") && id === 2) return [[{ count: options?.placeholderHasReport === false ? 0 : 1 }], []];
        if (sql.includes("`report_staff`") && id === 1 && options?.canonicalHasReport) return [[{ count: 1 }], []];
        return [[{ count: 0 }], []];
      }
      if (sql.includes("JOIN staff_schedules target")) {
        return [options?.scheduleConflict ? [{ dateKey: "2026-09-10" }] : [], []];
      }
      if (sql.includes("JOIN morning_principle_recitations target")) return [[], []];
      if (sql.includes("FROM users WHERE staffId IN")) return [[], []];
      if (sql.includes("FROM lcj_coin_holdings WHERE")) return [[], []];
      throw new Error(`unexpected query: ${sql}`);
    }),
  };
  return { pool: { getConnection: vi.fn(async () => connection) } as any, connection };
}

describe("report staff placeholder merge preview", () => {
  it("accepts a verified HR plus one unverified no-department placeholder and counts its history references", async () => {
    const { pool, connection } = makePool();
    const preview = await previewReportStaffPlaceholderMergeWithPool(pool, 1, 2);
    expect(preview.eligible).toBe(true);
    expect(preview.alreadyMerged).toBe(false);
    expect(preview.reportStaffId).toBe(16);
    expect(preview.reportProfileMode).toBe("relink_placeholder");
    expect(preview.placeholderHasNoDepartment).toBe(true);
    expect(preview.referenceCounts.placeholder.staffSchedules).toBe(1);
    expect(preview.referenceCounts.placeholder.reportStaffLinks).toBe(1);
    expect(preview.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(preview).not.toHaveProperty("canonicalName");
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it("blocks a placeholder that is not explicitly unverified", async () => {
    const { pool } = makePool({ placeholderVerified: true });
    await expect(previewReportStaffPlaceholderMergeWithPool(pool, 1, 2)).rejects.toThrow(
      "not a verified report placeholder",
    );
  });

  it("keeps the canonical report profile when the placeholder only has historical references", async () => {
    const { pool } = makePool({ canonicalHasReport: true, placeholderHasReport: false });
    const preview = await previewReportStaffPlaceholderMergeWithPool(pool, 1, 2);
    expect(preview.eligible).toBe(true);
    expect(preview.reportStaffId).toBe(15);
    expect(preview.reportProfileMode).toBe("keep_canonical");
    expect(preview.referenceCounts.canonical.reportStaffLinks).toBe(1);
    expect(preview.referenceCounts.placeholder.reportStaffLinks).toBe(0);
    expect(preview.referenceCounts.placeholder.staffSchedules).toBe(1);
  });

  it("blocks a merge when canonical and placeholder both own report profiles", async () => {
    const { pool } = makePool({ canonicalHasReport: true });
    await expect(previewReportStaffPlaceholderMergeWithPool(pool, 1, 2)).rejects.toThrow(
      "exactly one report profile",
    );
  });

  it("returns an ineligible preview when same-day schedule conflicts would overwrite history", async () => {
    const { pool } = makePool({ scheduleConflict: true });
    const preview = await previewReportStaffPlaceholderMergeWithPool(pool, 1, 2);
    expect(preview.eligible).toBe(false);
    expect(preview.conflicts[0]).toContain("staff_schedules");
  });
});
