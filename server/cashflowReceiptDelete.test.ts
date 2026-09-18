import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");

function deleteReceiptBlock() {
  const start = routerSource.indexOf("deleteReceipt: financeProcedure");
  const end = routerSource.indexOf("\n});", start);
  return routerSource.slice(start, end);
}

describe("cashflow receipt deletion", () => {
  it("locks the active cashflow row and preserves payroll secondary authorization", () => {
    const block = deleteReceiptBlock();
    expect(block).toContain("LIMIT 1 FOR UPDATE");
    expect(block).toContain("deletedAt IS NULL");
    expect(block).toContain("await requirePayrollAccess(ctx)");
    expect(block).toContain("beginTransaction");
    expect(block).toContain("connection.commit()");
    expect(block).toContain("connection.rollback()");
  });

  it("requires an attachment target and removes by index with stable attachment identity verification", () => {
    const block = deleteReceiptBlock();
    expect(block).toContain("Boolean(value.attachmentId)");
    expect(block).toContain("cashflowReceiptAttachmentId(indexedValue) !== input.attachmentId");
    expect(block).toContain("removeCashflowReceiptAt(beforeUrls, targetIndex, expectedStoredValue)");
    expect(block).toContain("alreadyDeleted: true");
    expect(block).not.toContain(".filter((url) => url !== input.url)");
  });

  it("writes a permanent attachment deletion audit without deleting private evidence", () => {
    const block = deleteReceiptBlock();
    expect(routerSource).toContain("CREATE TABLE IF NOT EXISTS cashflow_audit_log");
    expect(block).toContain("INSERT INTO cashflow_audit_log");
    expect(block).toContain('receiptAction: "delete"');
    expect(block).toContain("originalFileRetainedInPrivateStorage: true");
    expect(block).toContain("retainDeletedCashflowReceiptObject");
    expect(block).toContain("storageKey: receiptMetadata?.storageKey");
    expect(block).toContain("fileSha256: receiptMetadata?.sha256");
  });

  it("keeps delete controls visible and explains the payroll password flow", () => {
    expect(clientSource).toContain('grid-rows-[auto_minmax(0,1fr)_auto_auto]');
    expect(clientSource).toContain("删除当前PDF／证凭");
    expect(clientSource).toContain("删除第${index + 1}份PDF／证凭");
    expect(clientSource).toContain('setPayrollUnlockIntent("receiptDelete")');
    expect(clientSource).toContain("验证并删除");
    expect(clientSource).toContain("删除工资PDF／证凭前的二次确认");
  });

  it("updates only the selected preview entry after successful deletion", () => {
    expect(clientSource).toContain("next.splice(target.index, 1)");
    expect(clientSource).toContain("const fallbackIndex = next.indexOf(target.url)");
    expect(clientSource).not.toContain("receiptPreviewUrls.filter(item => item !== url)");
  });
});
