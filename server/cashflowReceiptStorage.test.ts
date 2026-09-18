import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cashflowReceiptAttachmentId,
  makeCashflowReceiptObjectRef,
  maskCashflowReceiptUrls,
  parseCashflowReceiptObjectId,
} from "./cashflowReceiptStorage";

const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("./cashflowReceiptStorage.ts", import.meta.url), "utf8");

describe("cashflow receipt private storage references", () => {
  it("creates and parses opaque object references without exposing a storage URL", () => {
    const ref = makeCashflowReceiptObjectRef(42);
    expect(ref).toBe("cashflow-receipt-object:42");
    expect(parseCashflowReceiptObjectId(ref)).toBe(42);
    expect(parseCashflowReceiptObjectId("https://files.example/receipt.pdf")).toBeNull();
  });

  it("masks legacy and private receipt values while retaining only attachment counts", () => {
    const masked = maskCashflowReceiptUrls(JSON.stringify([
      "https://files.example/legacy.pdf",
      "cashflow-receipt-object:8",
    ]));
    expect(JSON.parse(String(masked))).toEqual(["private-receipt:1", "private-receipt:2"]);
    expect(masked).not.toContain("files.example");
    expect(masked).not.toContain("cashflow-receipt-object:8");
    expect(maskCashflowReceiptUrls(null)).toBeNull();
  });

  it("uses stable opaque identities for private and legacy deletion checks", () => {
    expect(cashflowReceiptAttachmentId("cashflow-receipt-object:7")).toBe("cashflow-receipt-object:7");
    const legacyId = cashflowReceiptAttachmentId("https://files.example/legacy.pdf");
    expect(legacyId).toMatch(/^cashflow-legacy-receipt:[a-f0-9]{64}$/);
    expect(legacyId).not.toContain("files.example");
  });

  it("issues preview URLs only through a finance and payroll-authorized endpoint", () => {
    const start = routerSource.indexOf("getReceiptFiles: financeProcedure");
    const end = routerSource.indexOf("// 支払証憑／請求書アップロード", start);
    const block = routerSource.slice(start, end);
    expect(block).toContain("requirePayrollAccessForCashflowRow(pool, ctx, input.id)");
    expect(block).toContain("resolveCashflowReceiptFiles(pool, input.id, row.receiptUrl)");
    expect(routerSource.match(/maskCashflowReceiptUrls\(row\.receiptUrl\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(clientSource).toContain("trpc.cashflow.getReceiptFiles.useMutation()");
    expect(clientSource).toContain("setReceiptPreviewUrls(data.files.map((file) => file.url))");
    expect(clientSource).toContain('setPayrollUnlockIntent("receiptView")');
  });

  it("atomically claims cleanup and keeps the unique storage-key index within utf8mb4 limits", () => {
    expect(storageSource).toContain("storageKey VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL");
    expect(storageSource).toContain("SET status = 'cleanup_claimed'");
    expect(storageSource).toContain("Number(claimResult.affectedRows || 0) !== 1");
    expect(storageSource).toContain("WHERE id = ? AND status = 'cleanup_claimed'");
    expect(storageSource).toContain("status = 'cleanup_claimed' AND updatedAt < DATE_SUB");
    expect(storageSource).toContain("WHERE id = ? AND status IN ('pending_upload', 'cleanup_pending', 'cleanup_failed', 'active')");
    expect(storageSource).not.toContain("SET status = 'active', cashflowId = ?, activatedAt = COALESCE(activatedAt, NOW()), lastError = NULL\n        WHERE id = ?`");
  });
});
