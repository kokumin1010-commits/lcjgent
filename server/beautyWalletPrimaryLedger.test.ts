import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE,
  PRIMARY_POINT_LEDGER,
  assertLocalPointLedgerWritable,
  isLocalPointLedgerReadOnlyError,
} from "./pointLedgerPolicy";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Beauty Wallet primary ledger policy", () => {
  it("defines Beauty Wallet as the sole live point ledger", () => {
    expect(PRIMARY_POINT_LEDGER).toBe("beauty_wallet");
    expect(LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE).toContain("Beauty Wallet");
    expect(() => assertLocalPointLedgerWritable("test")).toThrow(
      LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE
    );
    try {
      assertLocalPointLedgerWritable("test");
    } catch (error) {
      expect(isLocalPointLedgerReadOnlyError(error)).toBe(true);
    }
  });

  it("fails closed before every core LCJ point mutation", () => {
    const db = read("server/db.ts");
    const requiredGuards = [
      'assertLocalPointLedgerWritable("point_transaction")',
      'assertLocalPointLedgerWritable("line_point_transaction")',
      'assertLocalPointLedgerWritable("point_balance_create")',
      'assertLocalPointLedgerWritable("point_balance_update")',
      'assertLocalPointLedgerWritable("line_point_balance_create")',
      'assertLocalPointLedgerWritable("line_point_balance_update")',
      'assertLocalPointLedgerWritable("receipt_approval")',
      'assertLocalPointLedgerWritable("line_receipt_approval")',
      'assertLocalPointLedgerWritable("point_request_approval")',
      'assertLocalPointLedgerWritable("referral_point_award")',
      'assertLocalPointLedgerWritable("pending_referral_point_award")',
      'assertLocalPointLedgerWritable("point_expiry")',
      'assertLocalPointLedgerWritable("line_point_expiry")',
      'assertLocalPointLedgerWritable("point_fifo_use")',
      'assertLocalPointLedgerWritable("line_point_fifo_use")',
      'assertLocalPointLedgerWritable("point_expiry_extension")',
      'assertLocalPointLedgerWritable("line_point_expiry_extension")',
      'assertLocalPointLedgerWritable("mall_order_point_use")',
    ];
    for (const guard of requiredGuards) expect(db).toContain(guard);
  });

  it("does not claim local registration rewards were already credited", () => {
    const router = read("server/routers.ts");
    const database = read("server/db.ts");
    expect(router).toContain("LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE");
    expect(router).not.toContain("500pt awarded to LINE user");
    expect(router).not.toContain("500pt awarded to user");
    expect(database).toContain("newUserPointAwarded: false");
    expect(database).toContain("referrerPointAwarded: false");
  });

  it("keeps legacy merge, recovery, receipt approval, and reward jobs fail-closed", () => {
    expect(read("server/memberAccountMergeService.ts")).toContain(
      'assertLocalPointLedgerWritable("member_account_point_merge")'
    );
    expect(read("server/memberPointReceiptRecoveryService.ts")).toContain(
      'assertLocalPointLedgerWritable("member_point_receipt_recovery")'
    );
    expect(read("server/receiptApprovalService.ts")).toContain(
      'assertLocalPointLedgerWritable("receipt_evidence_approval")'
    );
    expect(read("server/pointBalanceLinkRecovery.ts")).toContain(
      "assertLocalPointLedgerWritable('point_balance_link_recovery')"
    );
    expect(read("server/pointRecoveryLedgerUpgrade.ts")).toContain(
      'assertLocalPointLedgerWritable("point_recovery_ledger_upgrade")'
    );
    expect(read("server/mallPointMemberRecovery.ts")).toContain(
      'assertLocalPointLedgerWritable("mall_point_member_recovery")'
    );
    expect(read("server/services/runOnHoldBatch.mjs")).toContain("process.exit(1)");
    expect(read("migrate-email-points.mjs")).toContain("process.exit(1)");
    const lineAgent = read("server/lineAgent.ts");
    expect(lineAgent).not.toContain("createLineMemberSessionToken");
    expect(lineAgent).not.toContain("/receipt-upload?token=");
    expect(lineAgent).not.toContain("現在のポイント残高:");
    expect(lineAgent).toContain("Beauty Walletが唯一の主台帳です");
    const amountReocr = read("server/aiAutoApproveScheduler.ts").slice(
      read("server/aiAutoApproveScheduler.ts").indexOf("async function runAmountReocr")
    );
    expect(amountReocr).not.toContain("awardPointsForLineReceipt");
    expect(amountReocr).toContain("point_awards=disabled");
  });

  it("removes member reward surfaces and false local point refund promises", () => {
    const app = read("client/src/App.tsx");
    const cart = read("client/src/pages/MallCart.tsx");
    const mypage = read("client/src/pages/LineMypage.tsx");
    expect(app).not.toContain("RandomSpinProvider");
    expect(app).toContain('<Redirect to="/beauty-wallet" />');
    expect(cart).not.toContain("cartCheckoutPoints.useMutation");
    expect(cart).not.toContain('paymentMethod === "points"');
    expect(mypage).not.toContain("返還予定ポイント");
  });

  it("labels admin receipt point figures as legacy audit records and exposes no new AI approval run", () => {
    const receipts = read("client/src/pages/LineReceiptManagement.tsx");
    expect(receipts).toContain("旧LCJ付与記録（監査）");
    expect(receipts).toContain("旧LCJ算出参考（監査）");
    expect(receipts).toContain("旧LCJ監査:");
    expect(receipts).toContain("LCJポイント自動承認（停止中）");
    expect(receipts).toContain("過去LCJ承認（監査）");
    expect(receipts).not.toContain("startPass2Mutation");
    expect(receipts).not.toContain("holdRulesPreview");
    expect(receipts).not.toContain('humanOverride: "approved"');
  });

  it("makes the required member-link migration fatal and verifies owner uniqueness", () => {
    const runner = read("run-migrations.mjs");
    expect(runner).toContain("ensureMysqlUniqueSingleColumnIndex");
    expect(runner).toContain("Required Beauty Wallet member-link migration failed");
    expect(runner).toContain("process.exit(1)");
    expect(runner).not.toContain("Continuing despite error");
  });

  it("uses bounded signed sessions and does not renew a bearer token from me", () => {
    const router = read("server/routers.ts");
    const session = read("server/lineMemberSession.ts");
    const meBlock = router.slice(
      router.indexOf("// Get current LINE user session"),
      router.indexOf("// LIFF callback")
    );
    expect(session).toContain(
      "LINE_MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000"
    );
    expect(session).toContain("LCJ member session cannot exceed 30 days");
    expect(session).toContain("payload.exp! - payload.iat! > LINE_MEMBER_SESSION_TTL_SECONDS");
    expect(router).not.toContain("3650 * 24 * 60 * 60 * 1000");
    expect(meBlock).toContain("getLineUserFromSession(ctx)");
    expect(meBlock).not.toContain("sessionToken");
    expect(meBlock).not.toContain("JSON.parse");
  });
});
