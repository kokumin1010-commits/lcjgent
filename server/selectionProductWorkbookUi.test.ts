import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const selectionPage = readFileSync(resolve("client/src/pages/SelectionCenter.tsx"), "utf8");
const importDialog = readFileSync(resolve("client/src/components/SelectionProductWorkbookImportDialog.tsx"), "utf8");
const importService = readFileSync(resolve("server/selectionProductWorkbookImport.ts"), "utf8");
const router = readFileSync(resolve("server/selectionCenterRouter.ts"), "utf8");

describe("selection product workbook UI contract", () => {
  it("keeps the existing AI button and offers image or workbook recognition", () => {
    expect(selectionPage).toContain("<AiRecognitionButton");
    expect(selectionPage).toContain("图片AI识别 / 画像AI認識");
    expect(selectionPage).toContain("表格智能识别 / 商品表を認識");
    expect(selectionPage).toContain("onWorkbook={() => setShowWorkbookImport(true)}");
  });

  it("accepts only CSV/XLSX/XLS and requires preview before commit", () => {
    expect(importDialog).toContain('accept=".csv,.xlsx,.xls"');
    expect(importDialog).toContain("previewProductWorkbook.useMutation");
    expect(importDialog).toContain("commitProductWorkbook.useMutation");
    expect(importDialog).toContain("fileSha256: preview.fileSha256");
    expect(importDialog).toContain("确认导入");
  });

  it("shows evidence gaps and never claims missing SKU, barcode, brand, or stock", () => {
    expect(importDialog).toContain("不会覆盖现有商品，不会从名称猜测品牌、SKU或库存");
    expect(importDialog).toContain("源文件无SKU，不会生成SKU");
    expect(importDialog).toContain("缺少品牌");
    expect(importDialog).toContain("不导入");
  });

  it("uses deterministic parsing without paid LLM calls", () => {
    expect(importDialog).toContain("有料AI不使用");
    expect(importService).not.toContain("invokeLLM");
    expect(importService).not.toContain("OPENAI");
    expect(router).toContain("previewProductWorkbook: protectedProcedure");
    expect(router).toContain("commitProductWorkbook: protectedProcedure");
  });
});
