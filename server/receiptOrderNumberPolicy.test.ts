import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildReceiptOrderNumberLockKeys,
  buildReceiptOrderNumberOneEditVariants,
  decideApproximateReceiptOrderSubmission,
  decideReceiptOrderSubmission,
  normalizeReceiptOrderNumber,
  receiptOrderNumberEditDistance,
  selectBlockingApproximateOrderClaims,
  type ReceiptOrderClaim,
} from "./receiptOrderNumberPolicy";

const owner = new Set(["line:U1", "member:1", "email:user@example.com"]);

function claim(
  status: ReceiptOrderClaim["status"],
  ownerKey = "line:U1",
  id = 1
): ReceiptOrderClaim {
  return { id, source: "line_receipt", ownerKey, status };
}

describe("receipt order number policy", () => {
  it("normalizes valid 16-19 digit order numbers", () => {
    expect(normalizeReceiptOrderNumber("5819-0005 8582 287971")).toBe(
      "581900058582287971"
    );
    expect(normalizeReceiptOrderNumber("1234567890123456")).toBe(
      "1234567890123456"
    );
    expect(normalizeReceiptOrderNumber("12345")).toBeNull();
  });

  it.each(["pending", "approved", "rejected", "on_hold"])(
    "blocks a different account even when its claim is %s",
    status => {
      const decision = decideReceiptOrderSubmission(
        [claim(status, "line:OTHER")],
        owner
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("cross_account_order_number");
    }
  );

  it("allows a corrected resubmission when every same-account claim was rejected", () => {
    const decision = decideReceiptOrderSubmission(
      [
        claim("rejected", "line:U1", 1),
        claim("rejected", "email:user@example.com", 2),
      ],
      owner
    );
    expect(decision).toEqual({
      allowed: true,
      reason: "same_account_rejected_resubmission",
      blockingClaim: null,
    });
  });

  it.each(["pending", "approved", "on_hold"])(
    "blocks a same-account claim that is %s in the default upload flow",
    status => {
      const decision = decideReceiptOrderSubmission([claim(status)], owner);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("same_account_active_order_number");
    }
  );

  it.each(["pending", "on_hold"])(
    "allows an admin to select the current evidence-complete receipt when the other same-account claim is only %s",
    status => {
      const decision = decideReceiptOrderSubmission(
        [claim(status)],
        owner,
        { allowSameAccountUnapproved: true }
      );
      expect(decision).toEqual({
        allowed: true,
        reason: "same_account_unapproved_canonical_selection",
        blockingClaim: null,
      });
    }
  );

  it.each(["approved", "unknown_state"])(
    "still blocks an admin canonical selection when the same-account claim is %s",
    status => {
      const decision = decideReceiptOrderSubmission(
        [claim(status)],
        owner,
        { allowSameAccountUnapproved: true }
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("same_account_active_order_number");
    }
  );

  it.each(["pending", "on_hold"])(
    "still blocks a same-account %s point request in admin canonical-selection mode",
    status => {
      const decision = decideReceiptOrderSubmission(
        [{ ...claim(status), source: "point_request" }],
        owner,
        { allowSameAccountUnapproved: true }
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("same_account_active_order_number");
    }
  );

  it("blocks when rejected same-account history also has a cross-account claim", () => {
    const decision = decideReceiptOrderSubmission(
      [claim("rejected"), claim("rejected", "line:OTHER", 2)],
      owner
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("cross_account_order_number");
  });

  it("recognizes a one-digit OCR insertion as edit distance one", () => {
    const canonical = "123456789012345678";
    const ocrVariant = `${canonical.slice(0, 6)}7${canonical.slice(6)}`;
    expect(receiptOrderNumberEditDistance(canonical, ocrVariant)).toBe(1);
    expect(buildReceiptOrderNumberOneEditVariants(ocrVariant)).toContain(canonical);
    expect(buildReceiptOrderNumberOneEditVariants(canonical)).toContain(ocrVariant);
  });

  it("gives one-edit OCR variants a shared named-lock skeleton", () => {
    const canonical = "123456789012345678";
    const ocrVariant = `${canonical.slice(0, 6)}7${canonical.slice(6)}`;
    const canonicalKeys = new Set(buildReceiptOrderNumberLockKeys(canonical));
    const sharedKeys = buildReceiptOrderNumberLockKeys(ocrVariant)
      .filter(key => canonicalKeys.has(key));
    expect(sharedKeys).toContain(canonical);
  });

  it("routes a cross-account one-edit order claim to manual conflict review", () => {
    const decision = decideApproximateReceiptOrderSubmission(
      [{
        ...claim("approved", "line:OTHER", 9),
        orderNumber: "1234567789012345678",
        totalAmount: 1693,
        matchDistance: 1,
      }],
      owner
    );
    expect(decision?.allowed).toBe(false);
    expect(decision?.reason).toBe("cross_account_similar_order_number");
  });

  it("only treats same-amount active one-edit claims as blocking OCR conflicts", () => {
    const blocking = selectBlockingApproximateOrderClaims([
      { ...claim("approved", "line:OTHER", 1), totalAmount: 1693, matchDistance: 1 },
      { ...claim("approved", "line:OTHER", 2), totalAmount: 988, matchDistance: 1 },
      { ...claim("rejected", "line:OTHER", 3), totalAmount: 1693, matchDistance: 1 },
      { ...claim("approved", "line:OTHER", 4), totalAmount: 1693, matchDistance: 2 },
    ], 1693);
    expect(blocking.map(item => item.id)).toEqual([1]);
  });

  it("allows only an explicit admin verification to override an approximate conflict", () => {
    const decision = decideApproximateReceiptOrderSubmission(
      [{ ...claim("approved", "line:OTHER", 9), matchDistance: 1 }],
      owner,
      { allowApproximateConflict: true }
    );
    expect(decision).toBeNull();
  });
});

describe("order number guard integration contract", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const guardSource = readFileSync(`${here}/receiptOrderNumberGuard.ts`, "utf8");
  const routerSource = readFileSync(`${here}/routers.ts`, "utf8");
  const approvalServiceSource = readFileSync(`${here}/receiptApprovalService.ts`, "utf8");
  const schedulerSource = readFileSync(`${here}/aiAutoApproveScheduler.ts`, "utf8");
  const pass2Source = readFileSync(`${here}/services/aiPass2ManualQueueReview.ts`, "utf8");
  const humanLearningSource = readFileSync(`${here}/receiptHumanLearningReviewService.ts`, "utf8");

  it("serializes the query and claim under a Railway MySQL named lock", () => {
    expect(guardSource).toContain("SELECT GET_LOCK(?, 10)");
    expect(guardSource).toContain("buildReceiptOrderNumberLockKeys(orderNumber)");
    expect(guardSource).toContain("buildReceiptOrderNumberOneEditVariants(orderNumber)");
    expect(guardSource).toContain("decideApproximateReceiptOrderSubmission");
    expect(guardSource).toContain("FOR UPDATE");
    expect(guardSource).toContain("SET orderNumber=?");
    expect(guardSource).toContain("totalAmount=CASE WHEN ? > 0 THEN ? ELSE totalAmount END");
    expect(guardSource).toContain("const claimedAmount = Number(input.totalAmount");
    expect(guardSource).toContain("SELECT RELEASE_LOCK(?)");
  });

  it("does not filter prior line receipt claims by status", () => {
    const claimQuery = guardSource.slice(
      guardSource.indexOf("SELECT id, lineUserId, status"),
      guardSource.indexOf("const claims: ReceiptOrderClaim[]")
    );
    expect(claimQuery).not.toMatch(/status\s*(=|IN)/i);
  });

  it("keeps ordinary upload strict while supporting a lock-held admin canonical-selection callback", () => {
    expect(guardSource).toContain("allowSameAccountUnapproved: input.allowSameAccountUnapproved === true");
    expect(guardSource).toContain("await input.onAllowedWhileLocked(result)");
    expect(routerSource).toContain("claimReceiptOrderNumber({");
    const webStart = routerSource.indexOf("submitWebReceipt:");
    const forceStart = routerSource.indexOf("forceSubmitWebReceipt:", webStart);
    const webSource = routerSource.slice(webStart, forceStart);
    expect(webSource).toContain("claimReceiptOrderNumber({");
    expect(webSource).toContain("totalAmount: ocrData.totalAmount");
    expect(webSource).toContain('storeName: ocrData.shopName || "TikTok Shop"');
    expect(webSource).not.toContain("checkDuplicateOrderNumberGlobal(");
  });

  it("routes every automated approval surface through the order-family guard", () => {
    expect(approvalServiceSource).toContain("claimReceiptOrderNumber({");
    expect(approvalServiceSource).toContain("ReceiptApprovalConflictError");
    expect(schedulerSource).toContain("const approvalClaim = await claimReceiptOrderNumber({");
    expect(schedulerSource).toContain('"on_hold"');
    expect(pass2Source).toContain("onAllowedWhileLocked: async () =>");
    expect(pass2Source).toContain("orderNumberAlreadyClaimed: true");
    expect(humanLearningSource).toContain("cross_account_similar_order_number");
    expect(routerSource).toContain("[AI保留] 订单号疑似OCR错位或重复");
  });

  it("does not retain the old AI-log direct approval bypass", () => {
    const overrideStart = routerSource.indexOf("overrideDecision: protectedProcedure");
    const overrideEnd = routerSource.indexOf("learning:", overrideStart);
    const overrideSource = routerSource.slice(overrideStart, overrideEnd);
    expect(overrideSource).toContain("approveReceiptFromEvidence({");
    expect(overrideSource).not.toContain('await updateLineReceiptStatus(receipt.id, "approved"');
  });
});
