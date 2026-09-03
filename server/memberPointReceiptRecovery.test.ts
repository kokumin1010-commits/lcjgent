import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeRecoveryReceiptIds,
  recoveryReceiptIdsHash,
} from "./memberPointReceiptRecoveryService";

const root = path.resolve(__dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("legacy member point lot recovery", () => {
  it("normalizes receipt evidence deterministically", () => {
    expect(normalizeRecoveryReceiptIds([9, 3, 9, 5])).toEqual([3, 5, 9]);
    expect(recoveryReceiptIdsHash([9, 3, 5])).toBe(
      recoveryReceiptIdsHash([5, 9, 3])
    );
  });

  it("reconstructs a valid earn lot without changing the raw balance", () => {
    const source = read("server/memberPointReceiptRecoveryService.ts");
    expect(source).toContain('transaction.type === "adjustment"');
    expect(source).toContain('referenceType === "system"');
    expect(source).toContain(
      'String(transaction.description || "").includes("系统恢复余额")'
    );
    expect(source).toContain("INSERT INTO line_point_transactions");
    expect(source).toContain("'earn'");
    expect(source).toContain("INTERVAL ${POINT_VALIDITY_MONTHS} MONTH");
    expect(source).toContain("remainingAmount");
    expect(source).toContain(
      "raw point balance changed during valid-lot recovery"
    );
    expect(source).not.toMatch(/UPDATE\s+line_point_balances\s+SET/i);
  });

  it("locks exact identity, balance, opening evidence and absence of valid lots", () => {
    const source = read("server/memberPointReceiptRecoveryService.ts");
    expect(source).toContain("member LINE identity changed after review");
    expect(source).toContain("point balance changed after review");
    expect(source).toContain(
      "opening recovery transaction no longer matches evidence"
    );
    expect(source).toContain(
      "member already has a valid point lot; recovery stopped"
    );
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("beginTransaction");
    expect(source).toContain("rollback");
  });
});

describe("held receipt release", () => {
  it("requires the complete unique receipt set, ownership, on-hold status and images", () => {
    const source = read("server/memberPointReceiptRecoveryService.ts");
    expect(source).toContain("held receipt IDs must be unique");
    expect(source).toContain("held receipt set changed after review");
    expect(source).toContain("held receipt ownership changed after review");
    expect(source).toContain("held receipt status changed after review");
    expect(source).toContain("held receipt is missing image evidence");
  });

  it("moves only held receipts to pending and preserves all rejected receipts", () => {
    const source = read("server/memberPointReceiptRecoveryService.ts");
    expect(source).toMatch(/SET status='pending'/);
    expect(source).toContain("reviewedBy=NULL,reviewedAt=NULL");
    expect(source).toMatch(/status='on_hold'/);
    expect(source).toContain("not all held receipts were released");
    expect(source).toContain("pending receipt invariant failed after recovery");
    expect(source).toContain("rejected receipts changed during recovery");
    expect(source).not.toMatch(/SET status='approved'/);
    expect(source).not.toContain("awardPointsForLineReceipt");
  });
});

describe("member point and receipt recovery operator safety", () => {
  it("requires verified backups, durable audit and idempotent replay", () => {
    const source = read("server/memberPointReceiptRecoveryService.ts");
    expect(source).toContain("pre-point-receipt-recovery-v1");
    expect(source).toContain("post-point-receipt-recovery-v1");
    expect("pre-point-receipt-recovery-v1".length).toBeLessThanOrEqual(32);
    expect("post-point-receipt-recovery-v1".length).toBeLessThanOrEqual(32);
    expect(source).toContain(
      "runDatabaseBackup(reason, { force: true, waitForActive: true })"
    );
    expect(source).toContain("member_point_receipt_recovery_audit");
    expect(source).toContain("uq_member_point_receipt_opening_tx");
    expect(source).toContain("alreadyRecovered: true");
    expect(source).toContain("completed_post_backup_failed");
  });

  it("labels the recovery lot as activation without duplicate balance addition", () => {
    const page = read("client/src/pages/MyPoints.tsx");
    expect(page).toContain("isRecoveryReactivation");
    expect(page).toContain("復旧ポイント有効化");
    expect(page).toContain("残高への重複加算はありません");
  });

  it("exposes only an admin, risk-checked and fixed-confirmation procedure", () => {
    const router = read("server/memberIdentityRouter.ts");
    expect(router).toContain(
      "recoverLegacyPointsAndHeldReceipts: protectedProcedure"
    );
    expect(router).toContain('ctx.user.role !== "admin"');
    expect(router).toContain(
      'assertMemberActionAllowed(input.memberId, ["points", "receipt"])'
    );
    expect(router).toContain(
      '"RESTORE_VALID_POINTS_AND_RELEASE_HELD_RECEIPTS"'
    );
    expect(router).toContain("expectedOpeningTransactionId");
    expect(router).toContain("expectedHeldReceiptIds");
    expect(router).toContain("expectedRejectedReceiptCount");
  });
});
