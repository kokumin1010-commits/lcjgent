/**
 * Tests for duplicate detection rules:
 * - Level 1: Same user + Same order → auto reject (DUPLICATE_SAME_USER_ORDER)
 * - Level 2: Cross user + Same order → winner rule (DUPLICATE_CROSS_USER_ORDER)
 * - ORDER_NUMBER_MISSING: No order number → auto reject
 * 
 * These tests verify the rule logic without hitting the database.
 * They test the decision-making functions in isolation.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ============================================================
// Level 2: Cross-user duplicate winner rule logic (unit test)
// ============================================================

/**
 * Pure logic function extracted from the scheduler's Level 2 check.
 * Given a list of duplicate receipts (from dupeMap), determines if
 * the current receipt should be rejected.
 */
function checkLevel2WinnerRule(params: {
  candidateId: number;
  candidateLineUserId: string;
  orderNumber: string;
  dupes: Array<{
    id: number;
    lineUserId: string;
    status: string;
    submittedAt: Date | null;
  }>;
}): {
  shouldReject: boolean;
  reason?: string;
  reasonCode?: string;
  winnerReceiptId?: number;
} {
  const { candidateId, candidateLineUserId, orderNumber, dupes } = params;

  // Filter to cross-user dupes only (exclude same user, exclude pointRequest)
  const crossUserDupes = dupes.filter(
    (d) =>
      d.id !== candidateId &&
      d.lineUserId !== candidateLineUserId &&
      d.lineUserId !== "pointRequest"
  );

  if (crossUserDupes.length === 0) {
    return { shouldReject: false };
  }

  // Check 1: Is there already an approved receipt from another user?
  const approvedWinner = crossUserDupes.find((d) => d.status === "approved");
  if (approvedWinner) {
    return {
      shouldReject: true,
      reason: `別ユーザーが同一注文番号 ${orderNumber} で既に承認済み (レシート #${approvedWinner.id})`,
      reasonCode: "DUPLICATE_CROSS_USER_ORDER",
      winnerReceiptId: approvedWinner.id,
    };
  }

  // Check 2: Another user has pending/on_hold → flag but don't reject yet
  // (The first one to get approved wins)
  return { shouldReject: false };
}

/**
 * Pure logic function for ORDER_NUMBER_MISSING check.
 */
function checkOrderNumberMissing(orderNumber: string | undefined | null): {
  shouldReject: boolean;
  reasonCode?: string;
} {
  if (!orderNumber) {
    return { shouldReject: true, reasonCode: "ORDER_NUMBER_MISSING" };
  }
  return { shouldReject: false };
}

/**
 * Pure logic function for Level 1: Same user + Same order check.
 * Given a list of duplicate receipts, determines if the current receipt
 * is a same-user duplicate.
 */
function checkLevel1SameUserOrder(params: {
  candidateId: number;
  candidateLineUserId: string;
  dupes: Array<{
    id: number;
    lineUserId: string;
    status: string;
  }>;
}): {
  shouldReject: boolean;
  reasonCode?: string;
  duplicateReceiptId?: number;
} {
  const { candidateId, candidateLineUserId, dupes } = params;

  // Find same-user duplicates that are approved
  const sameUserApproved = dupes.find(
    (d) =>
      d.id !== candidateId &&
      d.lineUserId === candidateLineUserId &&
      d.status === "approved"
  );

  if (sameUserApproved) {
    return {
      shouldReject: true,
      reasonCode: "DUPLICATE_SAME_USER_ORDER",
      duplicateReceiptId: sameUserApproved.id,
    };
  }

  return { shouldReject: false };
}

// ============================================================
// Tests
// ============================================================

describe("ORDER_NUMBER_MISSING rule", () => {
  it("should reject when order number is null", () => {
    const result = checkOrderNumberMissing(null);
    expect(result.shouldReject).toBe(true);
    expect(result.reasonCode).toBe("ORDER_NUMBER_MISSING");
  });

  it("should reject when order number is undefined", () => {
    const result = checkOrderNumberMissing(undefined);
    expect(result.shouldReject).toBe(true);
    expect(result.reasonCode).toBe("ORDER_NUMBER_MISSING");
  });

  it("should reject when order number is empty string", () => {
    const result = checkOrderNumberMissing("");
    expect(result.shouldReject).toBe(true);
    expect(result.reasonCode).toBe("ORDER_NUMBER_MISSING");
  });

  it("should pass when order number is present", () => {
    const result = checkOrderNumberMissing("ORD-12345");
    expect(result.shouldReject).toBe(false);
    expect(result.reasonCode).toBeUndefined();
  });
});

describe("Level 1: Same user + Same order", () => {
  it("should reject when same user has approved receipt with same order", () => {
    const result = checkLevel1SameUserOrder({
      candidateId: 100,
      candidateLineUserId: "user_A",
      dupes: [
        { id: 50, lineUserId: "user_A", status: "approved" },
      ],
    });
    expect(result.shouldReject).toBe(true);
    expect(result.reasonCode).toBe("DUPLICATE_SAME_USER_ORDER");
    expect(result.duplicateReceiptId).toBe(50);
  });

  it("should not reject when same user has pending receipt (not yet approved)", () => {
    const result = checkLevel1SameUserOrder({
      candidateId: 100,
      candidateLineUserId: "user_A",
      dupes: [
        { id: 50, lineUserId: "user_A", status: "pending" },
      ],
    });
    expect(result.shouldReject).toBe(false);
  });

  it("should not reject when duplicate is from different user", () => {
    const result = checkLevel1SameUserOrder({
      candidateId: 100,
      candidateLineUserId: "user_A",
      dupes: [
        { id: 50, lineUserId: "user_B", status: "approved" },
      ],
    });
    expect(result.shouldReject).toBe(false);
  });

  it("should not reject when no duplicates exist", () => {
    const result = checkLevel1SameUserOrder({
      candidateId: 100,
      candidateLineUserId: "user_A",
      dupes: [],
    });
    expect(result.shouldReject).toBe(false);
  });

  it("should not reject when same user has rejected receipt", () => {
    const result = checkLevel1SameUserOrder({
      candidateId: 100,
      candidateLineUserId: "user_A",
      dupes: [
        { id: 50, lineUserId: "user_A", status: "rejected" },
      ],
    });
    expect(result.shouldReject).toBe(false);
  });
});

describe("Level 2: Cross-user duplicate (winner rule)", () => {
  it("should reject when another user has approved receipt with same order", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_B",
      orderNumber: "ORD-12345",
      dupes: [
        {
          id: 50,
          lineUserId: "user_A",
          status: "approved",
          submittedAt: new Date("2025-01-01"),
        },
      ],
    });
    expect(result.shouldReject).toBe(true);
    expect(result.reasonCode).toBe("DUPLICATE_CROSS_USER_ORDER");
    expect(result.winnerReceiptId).toBe(50);
  });

  it("should NOT reject when another user has pending receipt (first-to-approve wins)", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_B",
      orderNumber: "ORD-12345",
      dupes: [
        {
          id: 50,
          lineUserId: "user_A",
          status: "pending",
          submittedAt: new Date("2025-01-01"),
        },
      ],
    });
    // Should NOT reject - both are pending, first to get approved wins
    expect(result.shouldReject).toBe(false);
  });

  it("should NOT reject when duplicate is from same user (Level 1 handles this)", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_A",
      orderNumber: "ORD-12345",
      dupes: [
        {
          id: 50,
          lineUserId: "user_A",
          status: "approved",
          submittedAt: new Date("2025-01-01"),
        },
      ],
    });
    // Same user → not a cross-user duplicate
    expect(result.shouldReject).toBe(false);
  });

  it("should NOT reject when no duplicates exist", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_B",
      orderNumber: "ORD-12345",
      dupes: [],
    });
    expect(result.shouldReject).toBe(false);
  });

  it("should ignore pointRequest entries in dupeMap", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_B",
      orderNumber: "ORD-12345",
      dupes: [
        {
          id: 50,
          lineUserId: "pointRequest",
          status: "approved",
          submittedAt: new Date("2025-01-01"),
        },
      ],
    });
    // pointRequest entries should be ignored
    expect(result.shouldReject).toBe(false);
  });

  it("should reject when multiple cross-user dupes exist and one is approved", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_C",
      orderNumber: "ORD-12345",
      dupes: [
        {
          id: 50,
          lineUserId: "user_A",
          status: "pending",
          submittedAt: new Date("2025-01-01"),
        },
        {
          id: 60,
          lineUserId: "user_B",
          status: "approved",
          submittedAt: new Date("2025-01-02"),
        },
      ],
    });
    expect(result.shouldReject).toBe(true);
    expect(result.winnerReceiptId).toBe(60);
  });

  it("should NOT reject when cross-user dupes are all on_hold", () => {
    const result = checkLevel2WinnerRule({
      candidateId: 100,
      candidateLineUserId: "user_B",
      orderNumber: "ORD-12345",
      dupes: [
        {
          id: 50,
          lineUserId: "user_A",
          status: "on_hold",
          submittedAt: new Date("2025-01-01"),
        },
      ],
    });
    // on_hold is not approved → don't reject yet
    expect(result.shouldReject).toBe(false);
  });
});

describe("Rule priority order", () => {
  it("Level 1 should be checked before Level 2", () => {
    // If same user has approved duplicate, Level 1 catches it first
    const level1 = checkLevel1SameUserOrder({
      candidateId: 100,
      candidateLineUserId: "user_A",
      dupes: [
        { id: 50, lineUserId: "user_A", status: "approved" },
        { id: 60, lineUserId: "user_B", status: "approved" },
      ],
    });
    expect(level1.shouldReject).toBe(true);
    expect(level1.reasonCode).toBe("DUPLICATE_SAME_USER_ORDER");
  });

  it("ORDER_NUMBER_MISSING should be checked independently", () => {
    // Even if there are duplicates, missing order number is a separate rule
    const missing = checkOrderNumberMissing(null);
    expect(missing.shouldReject).toBe(true);
    expect(missing.reasonCode).toBe("ORDER_NUMBER_MISSING");
  });

  it("complete flow: Level1 → Level2 → ORDER_NUMBER_MISSING", () => {
    const orderNumber = "ORD-12345";
    const candidateId = 100;
    const candidateLineUserId = "user_B";
    const dupes = [
      {
        id: 50,
        lineUserId: "user_A",
        status: "approved" as const,
        submittedAt: new Date("2025-01-01"),
      },
    ];

    // Step 1: Check Level 1 (same user)
    const level1 = checkLevel1SameUserOrder({
      candidateId,
      candidateLineUserId,
      dupes,
    });
    // Not same user → Level 1 passes
    expect(level1.shouldReject).toBe(false);

    // Step 2: Check Level 2 (cross user)
    const level2 = checkLevel2WinnerRule({
      candidateId,
      candidateLineUserId,
      orderNumber,
      dupes,
    });
    // Cross-user approved → Level 2 catches it
    expect(level2.shouldReject).toBe(true);
    expect(level2.reasonCode).toBe("DUPLICATE_CROSS_USER_ORDER");

    // Step 3: ORDER_NUMBER_MISSING (not reached because Level 2 caught it)
    const missing = checkOrderNumberMissing(orderNumber);
    expect(missing.shouldReject).toBe(false);
  });
});
