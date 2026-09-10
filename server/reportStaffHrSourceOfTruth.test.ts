import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("HR is the only source of daily-report staff", () => {
  it("removes on-the-fly staff creation from the daily report form", () => {
    const source = read("client/src/pages/ReportForm.tsx");
    expect(source).not.toContain("trpc.reportStaff.create.useMutation");
    expect(source).not.toContain("新規スタッフを追加");
    expect(source).not.toContain("isNewStaff");
    expect(source).toContain('setLocation("/master/hr?tab=staff")');
    expect(source).toContain("在職中のHRスタッフが自動表示されます");
  });

  it("redirects the legacy report-staff route and removes its duplicate menu item", () => {
    const app = read("client/src/App.tsx");
    const menu = read("client/src/lib/adminMenuConfig.ts");
    expect(app).toContain('<Redirect to="/master/hr?tab=staff" />');
    expect(app).not.toContain('lazy(() => import("./pages/ReportStaffManagement"))');
    expect(menu).not.toContain('path: "/master/report-staff"');
  });

  it("documents the HR-owned roster on the HR staff tab", () => {
    const source = read("client/src/pages/HRManagement.tsx");
    expect(source).toContain("スタッフ・日報社員");
    expect(source).toContain("所有当前在职的HR员工自动具备日报资格");
    expect(source).toContain('new URLSearchParams(window.location.search).get("tab")');
  });

  it("requires an existing HR id and blocks independent report profile editing in production", () => {
    const routes = read("server/routers.ts");
    const persistence = read("server/manualStaffPersistence.ts");
    expect(routes).toContain('z.object({ linkedStaffId: z.number().int().positive() })');
    expect(routes).toContain("日报员工已统一到人事部，请在人事管理中修改人员资料和状态");
    expect(routes).toContain("日报员工已统一到人事部，请在人事管理中办理离职或归档");
    expect(persistence).toContain("日报员工必须先在人事部登记，并关联现有HR员工");
    expect(persistence).not.toContain('const placeholderEmail =');
  });

  it("creates a missing report profile when an active HR record is updated", () => {
    const source = read("server/manualStaffPersistence.ts");
    expect(source).toContain('String(after.isActive || "") === "active" && !after.archivedAt');
    expect(source).toContain("linkedStaffId: input.staffId");
    expect(source).toContain('action: "create"');
  });

  it("protects placeholder consolidation with preview fingerprint, backup and exact confirmation", () => {
    const router = read("server/staffIdentityRouter.ts");
    const service = read("server/staffIdentityConsistency.ts");
    expect(router).toContain("previewReportPlaceholderMerge");
    expect(router).toContain("mergeReportPlaceholder");
    expect(router).toContain("z.string().regex(/^[a-f0-9]{64}$/)");
    expect(router).toContain("z.literal(STAFF_REPORT_PLACEHOLDER_MERGE_CONFIRMATION)");
    expect(service).toContain('String(backup.reason) !== "pre-staff-identity-merge"');
    expect(service).toContain("placeholder staff still has references");
    expect(service).toContain("日报占位HR主档统一到正式HR");
  });
});
