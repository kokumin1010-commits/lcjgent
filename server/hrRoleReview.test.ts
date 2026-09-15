import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { decodeHrRoleFileNameBase64, parseHrRoleDocumentFile, HR_ROLE_DOCUMENT_MAX_BYTES, sanitizeHrRoleFileName } from "./hrRoleDocumentParser";
import { canEditMonthlyReview, currentTokyoMonth, missingMonthlyReviewFields, validateReviewMonth } from "./hrRoleReviewService";

const createdDirs: string[] = [];
afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function tempFile(name: string, content: Buffer | string) {
  const directory = await mkdtemp(path.join(tmpdir(), "lcj-hr-role-test-"));
  createdDirs.push(directory);
  const filePath = path.join(directory, name);
  await writeFile(filePath, content);
  return filePath;
}

describe("HR role document parser", () => {
  it("preserves native Unicode names and decodes Latin-1 transported UTF-8 names", () => {
    const unicodeName = "岗位职责・推进计划.docx";
    const mixedUnicodeName = "Role岗位职责理解与工作推进计划.docx";
    const datedMixedUnicodeName = "ABC岗位职责理解与推进计划_20260914.docx";
    const latin1Transport = Buffer.from(unicodeName, "utf-8").toString("latin1");
    expect(sanitizeHrRoleFileName(unicodeName)).toBe(unicodeName);
    expect(sanitizeHrRoleFileName(mixedUnicodeName)).toBe(mixedUnicodeName);
    expect(sanitizeHrRoleFileName(datedMixedUnicodeName)).toBe(datedMixedUnicodeName);
    expect(sanitizeHrRoleFileName(latin1Transport)).toBe(unicodeName);
    const encoded = Buffer.from(mixedUnicodeName, "utf-8").toString("base64");
    expect(decodeHrRoleFileNameBase64(encoded)).toBe(mixedUnicodeName);
    expect(decodeHrRoleFileNameBase64("not base64 !")).toBeNull();
    expect(decodeHrRoleFileNameBase64("A".repeat(2_049))).toBeNull();
  });

  it("extracts safe UTF-8 text documents and preserves the final Unicode file name", async () => {
    const filePath = await tempFile("role-plan.txt", "Monthly goals\nResults\nSupport needed");
    const originalName = "ABC岗位职责理解与推进计划_20260914.txt";
    const result = await parseHrRoleDocumentFile({ filePath, originalName });
    expect(result.kind).toBe("txt");
    expect(result.fileName).toBe(originalName);
    expect(result.extractionStatus).toBe("extracted");
    expect(result.extractedText).toContain("Support needed");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("extracts multiple XLSX sheets within bounded limits", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Name", "Synthetic Staff"], ["Goal", "Improve response rate"]]), "Personal");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["SOP", "Record outreach results"]]), "Department");
    const filePath = await tempFile("role-plan.xlsx", XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    const result = await parseHrRoleDocumentFile({ filePath, originalName: "role-plan.xlsx" });
    expect(result.kind).toBe("xlsx");
    expect(result.extractedText).toContain("[Sheet: Personal]");
    expect(result.extractedText).toContain("[Sheet: Department]");
  });

  it("keeps a valid legacy DOC as stored-only without executing it", async () => {
    const signature = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const filePath = await tempFile("legacy.doc", signature);
    const result = await parseHrRoleDocumentFile({ filePath, originalName: "legacy.doc" });
    expect(result.extractionStatus).toBe("stored_only");
    expect(result.extractedText).toBe("");
  });

  it("rejects extension/signature mismatches and oversized declared files", async () => {
    const fakeXlsx = await tempFile("fake.xlsx", "not a zip");
    await expect(parseHrRoleDocumentFile({ filePath: fakeXlsx, originalName: "fake.xlsx" })).rejects.toThrow("HR_ROLE_DOCUMENT_SIGNATURE_MISMATCH");
    const textFile = await tempFile("role.txt", "hello");
    await expect(parseHrRoleDocumentFile({ filePath: textFile, originalName: "role.txt", declaredSize: HR_ROLE_DOCUMENT_MAX_BYTES + 1 })).rejects.toThrow("HR_ROLE_DOCUMENT_SIZE_MISMATCH");
  });
});

describe("monthly role review rules", () => {
  it("uses Tokyo calendar months and rejects invalid months", () => {
    expect(currentTokyoMonth(new Date("2026-09-30T15:30:00.000Z"))).toBe("2026-10");
    expect(validateReviewMonth("2026-09")).toBe("2026-09");
    expect(() => validateReviewMonth("2026-13")).toThrow("HR-MONTHLY-MONTH");
  });

  it("allows employee edits only before submission or after revision request", () => {
    expect(canEditMonthlyReview(undefined)).toBe(true);
    expect(canEditMonthlyReview("draft")).toBe(true);
    expect(canEditMonthlyReview("revision_requested")).toBe(true);
    expect(canEditMonthlyReview("submitted")).toBe(false);
    expect(canEditMonthlyReview("approved")).toBe(false);
  });

  it("requires every fixed monthly template field before submission", () => {
    const complete = { focusGoals: "goal", achievements: "done", metricsResult: "none", incompleteItems: "none", problemsAndRisks: "none", supportNeeded: "none", nextMonthPlan: "next" };
    expect(missingMonthlyReviewFields(complete)).toEqual([]);
    expect(missingMonthlyReviewFields({ ...complete, supportNeeded: "  " })).toEqual(["supportNeeded"]);
  });
});

describe("HR role review source contracts", () => {
  it("keeps employee identity on active non-archived staff email and exposes only active documents", async () => {
    const source = await readFile(path.join(process.cwd(), "server/hrRoleReviewService.ts"), "utf8");
    expect(source).toContain("LOWER(TRIM(email))=LOWER(TRIM(?))");
    expect(source).toContain("isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL");
    expect(source).toContain("scope='employee' AND staffId=? AND status='active'");
    expect(source).toContain("const member = await resolveOwnActiveStaff(actor, connection)");
  });

  it("locks submitted reviews, requires revision comments and never updates core staff fields", async () => {
    const [source, routerSource] = await Promise.all([
      readFile(path.join(process.cwd(), "server/hrRoleReviewService.ts"), "utf8"),
      readFile(path.join(process.cwd(), "server/hrRoleReviewRouter.ts"), "utf8"),
    ]);
    expect(source).toContain("只有待确认的复盘可以审核");
    expect(source).toContain("退回时必须填写修改说明");
    expect(source).not.toMatch(/UPDATE staff SET/);
    expect(source).not.toMatch(/UPDATE report_staff SET/);
    const reviewPayload = routerSource.slice(routerSource.indexOf("const reviewPayload"), routerSource.indexOf("export const hrRoleReviewRouter"));
    expect(reviewPayload).not.toContain("staffId");
  });

  it("enforces employee and department document uniqueness at the database boundary", async () => {
    const [schema, upgrade, service] = await Promise.all([
      readFile(path.join(process.cwd(), "drizzle/schema.ts"), "utf8"),
      readFile(path.join(process.cwd(), "server/hrRoleReviewUpgrade.ts"), "utf8"),
      readFile(path.join(process.cwd(), "server/hrRoleReviewService.ts"), "utf8"),
    ]);
    expect(schema).toContain('unique_hr_role_document_staff_sha');
    expect(schema).toContain('unique_hr_role_document_department_sha');
    expect(upgrade).toContain('UNIQUE KEY unique_hr_role_document_department_sha (scope, department, sha256)');
    expect(service).toContain('error as { code?: string }');
    expect(service).toContain('[HR-ROLE-DUPLICATE]');
  });

  it("enforces current account hierarchy and department scope for management", async () => {
    const [service, router] = await Promise.all([
      readFile(path.join(process.cwd(), "server/hrRoleReviewService.ts"), "utf8"),
      readFile(path.join(process.cwd(), "server/hrRoleReviewRouter.ts"), "utf8"),
    ]);
    expect(service).toContain('getUserManagementAccess');
    expect(service).toContain('access.level === "department_manager"');
    expect(service).toContain('只能管理本人负责部门的员工');
    expect(service).toContain('只能管理本人负责部门的资料');
    expect(router).not.toContain('adminProcedure');
    expect(router).toContain('requireHrRoleManagement(ctx.user)');
  });

  it("authenticates and authorizes managers before parsing multipart and cleans failed objects", async () => {
    const source = await readFile(path.join(process.cwd(), "server/_core/index.ts"), "utf8");
    const routeStart = source.indexOf('"/api/hr-role/document-upload"');
    const auth = source.indexOf("sdk.authenticateRequest(req)", routeStart);
    const authorize = source.indexOf("requireHrRoleDocumentTarget(user, target)", routeStart);
    const multipart = source.indexOf('hrRoleDocumentUpload.single("file")', routeStart);
    expect(routeStart).toBeGreaterThan(0);
    expect(auth).toBeGreaterThan(routeStart);
    expect(authorize).toBeGreaterThan(auth);
    expect(multipart).toBeGreaterThan(authorize);
    expect(source.slice(routeStart, source.indexOf('app.post("/api/upload-voice"', routeStart))).toContain("storageDelete(storedKey)");
  });

  it("sends the original Unicode file name explicitly for employee and department uploads", async () => {
    const [server, employeeUpload, departmentUpload] = await Promise.all([
      readFile(path.join(process.cwd(), "server/_core/index.ts"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/components/hr/HrStaffRoleReviewTab.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/components/hr/HrMonthlyReviewOverview.tsx"), "utf8"),
    ]);
    expect(server).toContain('limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 2, fieldSize: 1024 }');
    expect(server).toContain('req.body?.originalFileNameBase64');
    expect(server).toContain('decodeHrRoleFileNameBase64');
    expect(employeeUpload).toContain('form.append("originalFileNameBase64"');
    expect(departmentUpload).toContain('form.append("originalFileNameBase64"');
  });

  it("registers employee, admin and navigation entry points", async () => {
    const [app, menu, hr, employeePage] = await Promise.all([
      readFile(path.join(process.cwd(), "client/src/App.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/lib/adminMenuConfig.ts"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/pages/HRManagement.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/pages/MonthlyRoleReview.tsx"), "utf8"),
    ]);
    expect(app).toContain('/master/reports/monthly');
    expect(menu).toContain("月度岗位推进");
    expect(hr).toContain('setPageTab("monthly")');
    expect(hr).toContain("HrStaffRoleReviewTab");
    for (const label of ["本月重点目标", "本月完成事项", "结果・数据", "未完成事项及原因", "问题・风险", "所需支持", "下月计划"]) expect(employeePage).toContain(label);
    expect(employeePage).toContain("不会自动变成绩效扣分");
  });

  it("shows every organization member and opens the existing full staff detail from each name", async () => {
    const hr = await readFile(path.join(process.cwd(), "client/src/pages/HRManagement.tsx"), "utf8");
    expect(hr).toContain("部門別・スタッフ（全員表示）");
    expect(hr).toContain("onClick={() => onOpenStaff(s)}");
    expect(hr).toContain("aria-label={`${getDisplayName(s)}の詳細を開く`}");
    expect(hr).toContain("<OrganizationOverview staffList={unifiedStaffList} onOpenStaff={handleStaffClick} />");
    expect(hr).not.toContain("expandedDepts");
    expect(hr).not.toContain("toggleDept");
    for (const tab of ['value="profile"', 'value="tasks"', 'value="reports"', 'value="monthly"']) {
      expect(hr).toContain(tab);
    }
  });
});
