import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildReportVisibilityFilter,
  buildReportWriteFilter,
  canReadReport,
  canReadReportStaff,
  canWriteReport,
  filterVisibleReportStaff,
  getReportVisibilityScope,
  type ReportVisibilityScope,
} from "./reportVisibility";
import { ensureReportProfileForStaff } from "./staffIdentityConsistency";
import { getUserManagementAccess } from "./userManagementAccess";

vi.mock("./staffIdentityConsistency", () => ({
  ensureReportProfileForStaff: vi.fn(),
}));

vi.mock("./userManagementAccess", () => ({
  getUserManagementAccess: vi.fn(),
}));

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const employeeScope: ReportVisibilityScope = {
  userId: 101,
  level: "employee",
  scopeLabel: "self",
  managedDepartment: null,
  ownStaffId: 1,
  ownReportStaffIds: [11],
  visibleReportStaffIds: [11],
  canViewAllReports: false,
};

const managerScope: ReportVisibilityScope = {
  userId: 202,
  level: "department_manager",
  scopeLabel: "department",
  managedDepartment: "运营部",
  ownStaffId: 1,
  ownReportStaffIds: [11],
  visibleReportStaffIds: [11, 12, 13],
  canViewAllReports: false,
};

const superAdminScope: ReportVisibilityScope = {
  userId: 303,
  level: "super_admin",
  scopeLabel: "all",
  managedDepartment: null,
  ownStaffId: null,
  ownReportStaffIds: [],
  visibleReportStaffIds: null,
  canViewAllReports: true,
};

function createVisibilityDb(options: {
  staffRows?: Array<{ id: number }>;
  reportStaffRows?: Array<{
    id: number;
    isActive: "active" | "inactive";
    archivedAt: Date | null;
  }>;
}) {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      const rows =
        selectCall++ === 0
          ? options.staffRows || []
          : options.reportStaffRows || [];
      const whereResult = {
        limit: vi.fn(async () => rows),
        then: (
          resolve: (value: typeof rows) => unknown,
          reject: (reason: unknown) => unknown
        ) => Promise.resolve(rows).then(resolve, reject),
      };
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => whereResult),
        })),
      };
    }),
  };
}

beforeEach(() => {
  vi.mocked(getUserManagementAccess).mockReset();
  vi.mocked(ensureReportProfileForStaff).mockReset();
  vi.mocked(getUserManagementAccess).mockResolvedValue({
    userId: 101,
    level: "employee",
    managedDepartment: null,
    isSuperAdmin: false,
  });
});

describe("report visibility self identity", () => {
  it("creates a missing report profile for the matching active HR employee", async () => {
    vi.mocked(ensureReportProfileForStaff).mockResolvedValue({
      created: true,
      restored: false,
      reportStaffId: 88,
    });
    const db = createVisibilityDb({ staffRows: [{ id: 7 }] });

    const scope = await getReportVisibilityScope(db as any, {
      id: 101,
      email: "  WZ@QQ.COM ",
      name: "Wz",
    });

    expect(ensureReportProfileForStaff).toHaveBeenCalledWith({
      staffId: 7,
      actor: { id: 101, name: "Wz" },
    });
    expect(scope.ownStaffId).toBe(7);
    expect(scope.ownReportStaffIds).toEqual([88]);
    expect(scope.visibleReportStaffIds).toEqual([88]);
  });

  it("reuses an active report profile without creating a duplicate", async () => {
    const db = createVisibilityDb({
      staffRows: [{ id: 7 }],
      reportStaffRows: [{ id: 11, isActive: "active", archivedAt: null }],
    });

    const scope = await getReportVisibilityScope(db as any, {
      id: 101,
      email: "wz@qq.com",
    });

    expect(ensureReportProfileForStaff).not.toHaveBeenCalled();
    expect(scope.ownReportStaffIds).toEqual([11]);
  });

  it("keeps an account without an active HR identity unable to impersonate staff", async () => {
    const db = createVisibilityDb({ staffRows: [] });

    const scope = await getReportVisibilityScope(db as any, {
      id: 101,
      email: "unknown@example.com",
    });

    expect(ensureReportProfileForStaff).not.toHaveBeenCalled();
    expect(scope.ownStaffId).toBeNull();
    expect(scope.ownReportStaffIds).toEqual([]);
    expect(canReadReportStaff(scope, 11)).toBe(false);
  });
});

describe("report visibility hierarchy", () => {
  it("limits employees to their own report identity", () => {
    expect(canReadReportStaff(employeeScope, 11)).toBe(true);
    expect(canReadReportStaff(employeeScope, 12)).toBe(false);
    expect(
      filterVisibleReportStaff(employeeScope, [
        { id: 11, name: "本人" },
        { id: 12, name: "他人" },
      ])
    ).toEqual([{ id: 11, name: "本人" }]);
  });

  it("lets department managers read only their department", () => {
    expect(canReadReportStaff(managerScope, 11)).toBe(true);
    expect(canReadReportStaff(managerScope, 12)).toBe(true);
    expect(canReadReportStaff(managerScope, 99)).toBe(false);
    expect(buildReportVisibilityFilter(managerScope)).toEqual({
      visibleReportStaffIds: [11, 12, 13],
      createdByUserId: 202,
    });
  });

  it("keeps subordinate reports read-only for department managers", () => {
    expect(
      canReadReport(managerScope, { reportStaffId: 12, createdBy: 999 })
    ).toBe(true);
    expect(
      canWriteReport(managerScope, { reportStaffId: 12, createdBy: 999 })
    ).toBe(false);
    expect(
      canWriteReport(managerScope, { reportStaffId: 11, createdBy: 202 })
    ).toBe(true);
    expect(buildReportWriteFilter(managerScope)).toEqual({
      visibleReportStaffIds: [11],
      createdByUserId: 202,
    });
  });

  it("supports the legacy creator fallback without exposing other reports", () => {
    expect(
      canReadReport(employeeScope, { reportStaffId: 99, createdBy: 101 })
    ).toBe(true);
    expect(
      canWriteReport(employeeScope, { reportStaffId: 99, createdBy: 101 })
    ).toBe(true);
    expect(
      canReadReport(employeeScope, { reportStaffId: 99, createdBy: 404 })
    ).toBe(false);
  });

  it("lets super administrators read and write all reports", () => {
    expect(canReadReportStaff(superAdminScope, 999)).toBe(true);
    expect(
      canReadReport(superAdminScope, { reportStaffId: 999, createdBy: 404 })
    ).toBe(true);
    expect(
      canWriteReport(superAdminScope, { reportStaffId: 999, createdBy: 404 })
    ).toBe(true);
    expect(buildReportVisibilityFilter(superAdminScope)).toEqual({
      visibleReportStaffIds: null,
      createdByUserId: undefined,
    });
  });
});

describe("report hierarchy integration contract", () => {
  it("filters list, statistics, analysis and followups at the database layer", () => {
    const db = read("server/db.ts");
    expect(db).toContain("export type ReportVisibilityFilter");
    expect(db).toContain("function buildReportVisibilityCondition");
    expect(db).toContain("filters.visibility");
    expect(db).toContain("visibility?: ReportVisibilityFilter");
    expect(db).toContain("conditions.push(visibilityCondition)");
  });

  it("guards all report detail and mutation paths on the server", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("visibility: protectedProcedure.query");
    expect(router).toContain(
      "assertCanCreateForReportStaff(scope, input.reportStaffId)"
    );
    expect(router).toContain("assertCanReadReport(scope, reportData?.report)");
    expect(router).toContain("assertCanWriteReport(scope, existing?.report)");
    expect(router).toContain("buildReportVisibilityFilter(scope)");
    expect(router).toContain("buildReportWriteFilter(scope)");
    expect(router).toContain("恢复总览仅限超级管理员");
  });

  it("returns scoped staff directories and blocks chat-report impersonation", () => {
    const router = read("server/routers.ts");
    expect(router).toContain(
      "filterVisibleReportStaff(scope, await getAllReportStaff())"
    );
    expect(router).toContain(
      "filterVisibleReportStaff(scope, await getActiveReportStaff())"
    );
    expect(router).toContain(
      "assertCanCreateForReportStaff(scope, session.staffId)"
    );
    expect(router).toContain(
      "assertCanCreateForReportStaff(scope, input.staffId)"
    );
  });

  it("shows hierarchy scope and hides write controls for read-only reports", () => {
    const reportsPage = read("client/src/pages/Reports.tsx");
    const formPage = read("client/src/pages/ReportForm.tsx");
    const analysisPage = read("client/src/pages/ReportAnalysis.tsx");
    const recovery = read("client/src/components/ReportsRecoveryOverview.tsx");

    expect(reportsPage).toContain("查看范围：仅自己的日报");
    expect(reportsPage).toContain("{canEdit && (");
    expect(formPage).toContain("writableReportStaff");
    expect(formPage).toContain("existingReport && !existingReport.canEdit");
    expect(formPage).toContain("本人のスタッフ情報を確認しています");
    expect(formPage).toContain("reportVisibility?.ownStaffId");
    expect(analysisPage).toContain("分析范围：自己及");
    expect(recovery).toContain("enabled: canViewRecovery");
  });

  it("treats database boolean zero as false when deriving super administrators", () => {
    const access = read("server/userManagementAccess.ts");
    expect(access).toContain("Number(row.hasSuperAdminRole) === 1");
    expect(access).not.toContain("Boolean(row.hasSuperAdminRole)");
  });

  it("self-heals report eligibility only from an active canonical HR identity", () => {
    const scope = read("server/reportVisibility.ts");
    expect(scope).toContain("normalizeManagedAccountEmail(user.email)");
    expect(scope).toContain("LOWER(TRIM(${staff.email}))");
    expect(scope).toContain("ensureReportProfileForStaff({");
    expect(scope).toContain('eq(staff.isActive, "active")');
    expect(scope).toContain("isNull(staff.archivedAt)");
    expect(scope).toContain("isNull(staff.mergedIntoStaffId)");
  });
});
