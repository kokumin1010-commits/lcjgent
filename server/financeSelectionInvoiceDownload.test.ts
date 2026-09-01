import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const cashflowRouter = fs.readFileSync(
  path.join(root, "server/cashflowRouter.ts"),
  "utf8"
);
const cashflowPage = fs.readFileSync(
  path.join(root, "client/src/pages/CashflowTab.tsx"),
  "utf8"
);
const invoiceRouter = fs.readFileSync(
  path.join(root, "server/invoiceRouter.ts"),
  "utf8"
);
const invoicePage = fs.readFileSync(
  path.join(root, "client/src/pages/InvoiceTab.tsx"),
  "utf8"
);

function block(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("现金流勾选批量删除", () => {
  it("只接受有限ID列表并对当前未删除记录执行一次软删除", () => {
    const source = block(
      cashflowRouter,
      "bulkDeleteByIds:",
      "bulkDeleteByAccount:"
    );
    expect(source).toContain(
      "z.array(z.number().int().positive()).min(1).max(500)"
    );
    expect(source).toContain("Array.from(new Set(input.ids))");
    expect(source).toContain(
      "WHERE id IN (${placeholders}) AND deletedAt IS NULL"
    );
    expect(source).toContain("SET deletedAt = NOW()");
    expect(source).toContain("affectedRows");
    expect(source).not.toContain("sourceAccount = ?");
  });

  it("批量删除保留工资二次权限和活动审计", () => {
    const source = block(
      cashflowRouter,
      "bulkDeleteByIds:",
      "bulkDeleteByAccount:"
    );
    expect(source).toContain("isPayrollCategory(row.category)");
    expect(source).toContain("await requirePayrollAccess(ctx)");
    expect(source).toContain(
      "logCashflowActivity(ctx, 'delete', 'bulk-selected'"
    );
    expect(source).toContain("deletedIds: activeIds");
  });

  it("页面只按勾选ID删除并移除账户必选控件", () => {
    expect(cashflowPage).toContain("trpc.cashflow.bulkDeleteByIds.useMutation");
    expect(cashflowPage).toContain(
      "bulkDeleteByIdsMutation.mutate({ ids: selectedIds })"
    );
    expect(cashflowPage).toContain("删除已选 ${selectedIds.length} 条");
    expect(cashflowPage).toContain('title="本页全选"');
    expect(cashflowPage).not.toContain('id="bulk-delete-account"');
    expect(cashflowPage).not.toContain("Promise.all(selectedIds.map");
  });

  it("切换筛选排序或分页时清空不可见选择", () => {
    expect(cashflowPage).toContain("setSelectedIds([]);");
    expect(cashflowPage).toContain(
      "[entity, type, search, page, limit, sourceAccountFilter"
    );
    expect(cashflowPage).toContain(
      "current.filter((id) => !pageIds.includes(id))"
    );
  });
});

describe("请求书附件下载与补传", () => {
  it("优先按pdfKey生成短期签名URL并兼容旧pdfUrl", () => {
    const source = block(invoiceRouter, "getDownloadUrl:", "updateStatus:");
    expect(source).toContain("storageGet(invoice.pdfKey)");
    expect(source).toContain("if (!invoice.pdfKey && !invoice.pdfUrl)");
    expect(source).toContain("return { url: invoice.pdfUrl");
    expect(source).toContain('code: "PRECONDITION_FAILED"');
    expect(source).not.toContain("console.log(invoice.pdfUrl");
  });

  it("编辑接口允许保存补传或替换后的附件引用", () => {
    const source = block(
      invoiceRouter,
      "update: financeProcedure",
      "getDownloadUrl:"
    );
    expect(source).toContain("pdfUrl: z.string().optional().nullable()");
    expect(source).toContain("pdfKey: z.string().optional().nullable()");
    expect(invoicePage).toContain("pdfUrl: formData.pdfUrl || undefined");
    expect(invoicePage).toContain("pdfKey: formData.pdfKey || undefined");
  });

  it("列表始终提供明确的下载或补充附件入口", () => {
    expect(invoicePage).toContain("trpc.invoice.getDownloadUrl.useMutation");
    expect(invoicePage).toContain("未上传文件，点击补充附件");
    expect(invoicePage).toContain("这条请求书没有原文件，请在编辑窗口补充附件");
    expect(invoicePage).toContain("补充附件");
    expect(invoicePage).toContain("替换附件");
  });
});
