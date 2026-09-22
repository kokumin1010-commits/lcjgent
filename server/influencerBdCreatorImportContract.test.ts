import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./influencerBdRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/InfluencerBd.tsx", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("../client/src/components/influencer/CreatorImportPreviewDialog.tsx", import.meta.url), "utf8");
const importSource = readFileSync(new URL("./influencerBdCreatorImport.ts", import.meta.url), "utf8");

describe("influencer creator import contracts", () => {
  it("authenticates and rate-limits before multer allocates the uploaded file", () => {
    const routeStart = indexSource.indexOf('"/api/influencer-bd/creator-import-preview"');
    const nextRoute = indexSource.indexOf('"/api/influencer-bd/chat-screenshot"', routeStart);
    const block = indexSource.slice(routeStart, nextRoute);
    expect(routeStart).toBeGreaterThan(0);
    expect(block.indexOf("sdk.authenticateRequest(req)")).toBeGreaterThan(0);
    expect(block.indexOf("consumeInfluencerCreatorImportQuota")).toBeGreaterThan(0);
    expect(block.indexOf("influencerBdCreatorImportUpload.single")).toBeGreaterThan(block.indexOf("sdk.authenticateRequest(req)"));
    expect(indexSource).toContain("fileSize: 5 * 1024 * 1024");
    expect(routerSource).toContain("influencer_bd_import_rate_limits");
    expect(block).not.toContain("storagePut(");
  });

  it("imports selected rows only through a protected, atomic, duplicate-safe and audited mutation", () => {
    const start = routerSource.indexOf("importCreators: protectedProcedure");
    const end = routerSource.indexOf("archiveCreator: adminProcedure", start);
    const block = routerSource.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(block).toContain("z.array(creatorImportRowInput).min(1).max(500)");
    expect(block).toContain("await connection.beginTransaction()");
    expect(block).toContain("influencer_bd_creator_import_previews");
    expect(block).toContain("expiresAt>CURRENT_TIMESTAMP");
    expect(block).toContain("导入内容与服务端预览不一致");
    expect(block).toContain("SET consumedAt=CURRENT_TIMESTAMP");
    expect(block).toContain("FOR UPDATE");
    expect(block).toContain("action: \"creator_imported\"");
    expect(block).toContain("await connection.commit()");
    expect(block).toContain("await connection.rollback()");
    expect(block).toContain("Number(error?.errno) === 1062");
    expect(block).toContain('ownerStaffName,"potential",null');
    expect(block).not.toContain("row.status");
    expect(block).not.toContain("row.notes");
    expect(block).not.toContain("ON DUPLICATE KEY UPDATE");
  });

  it("requires a user preview and explicit row selection before any spreadsheet write", () => {
    expect(pageSource).toContain("creator-import-preview");
    expect(pageSource).toContain("setCreatorImportSelectedKeys(new Set())");
    expect(pageSource).toContain("filter(row => row.eligible && creatorImportSelectedKeys.has(row.sourceKey))");
    expect(pageSource).toContain("previewToken: creatorImportPreview.previewToken");
    expect(pageSource).not.toContain("applyRecognizedCreator");
    expect(routerSource).not.toContain('if (preview.sourceType === "image")');
    expect(pageSource).toContain("importCreators.mutateAsync");
    expect(pageSource.indexOf("setCreatorImportDialogOpen(true)")).toBeLessThan(pageSource.indexOf("importCreators.mutateAsync"));
    expect(dialogSource).toContain("识别只生成草稿，不会自动写入");
    expect(dialogSource).toContain("系统已存在");
    expect(dialogSource).toContain("请逐行确认并勾选要导入的达人");
    expect(dialogSource).not.toContain("选择全部可导入行");
  });

  it("documents that operational workbook columns are intentionally excluded", () => {
    expect(pageSource).toContain("上传XLSX/XLS/CSV会先显示逐行预览");
    expect(pageSource).toContain("识别只生成草稿，不会自动保存");
    expect(importSource).toContain("不会把整张表发送给AI");
    expect(importSource).toContain("new Worker(workerCode");
    expect(importSource).toContain("preflightXlsxZip(buffer)");
    expect(importSource).not.toContain("行列JSON");
  });
});
