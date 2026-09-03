import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  decideReceiptOrderSubmission,
  normalizeReceiptOrderNumber,
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
    "blocks a same-account claim that is %s",
    status => {
      const decision = decideReceiptOrderSubmission([claim(status)], owner);
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
});

describe("order number guard integration contract", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const guardSource = readFileSync(`${here}/receiptOrderNumberGuard.ts`, "utf8");
  const routerSource = readFileSync(`${here}/routers.ts`, "utf8");

  it("serializes the query and claim under a Railway MySQL named lock", () => {
    expect(guardSource).toContain("SELECT GET_LOCK(?, 10)");
    expect(guardSource).toContain("FOR UPDATE");
    expect(guardSource).toContain("SET orderNumber=?");
    expect(guardSource).toContain("SELECT RELEASE_LOCK(?)");
  });

  it("does not filter prior line receipt claims by status", () => {
    const claimQuery = guardSource.slice(
      guardSource.indexOf("SELECT id, lineUserId, status"),
      guardSource.indexOf("const claims: ReceiptOrderClaim[]")
    );
    expect(claimQuery).not.toMatch(/status\s*(=|IN)/i);
  });

  it("uses the atomic guard in the active web upload path used by direct and LINE-redirected submissions", () => {
    expect(routerSource).toContain("claimReceiptOrderNumber({");
    const webStart = routerSource.indexOf("submitWebReceipt:");
    const forceStart = routerSource.indexOf("forceSubmitWebReceipt:", webStart);
    const webSource = routerSource.slice(webStart, forceStart);
    expect(webSource).toContain("claimReceiptOrderNumber({");
    expect(webSource).not.toContain("checkDuplicateOrderNumberGlobal(");
  });
});
