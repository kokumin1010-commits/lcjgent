import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRecoveryReceiptIds, recoveryReceiptIdsHash } from "./memberPointReceiptRecoveryService";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("legacy member point and receipt recovery shutdown", () => {
  it("keeps evidence normalization deterministic for read-only audits", () => {
    expect(normalizeRecoveryReceiptIds([9, 3, 9, 5])).toEqual([3, 5, 9]);
    expect(recoveryReceiptIdsHash([9, 3, 5])).toBe(recoveryReceiptIdsHash([5, 9, 3]));
  });

  it("fails closed in both the admin route and recovery service", () => {
    const router = read("server/memberIdentityRouter.ts");
    const service = read("server/memberPointReceiptRecoveryService.ts");
    expect(router).toContain("LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE");
    expect(service).toContain('assertLocalPointLedgerWritable("member_point_receipt_recovery")');
  });

  it("retains the old audit and idempotency evidence without exposing an automatic startup path", () => {
    const service = read("server/memberPointReceiptRecoveryService.ts");
    const startup = read("server/_core/index.ts");
    expect(service).toContain("member_point_receipt_recovery_audit");
    expect(service).toContain("uq_member_point_receipt_opening_tx");
    expect(startup).not.toContain("recoverMemberPointsAndHeldReceipts(");
  });
});
