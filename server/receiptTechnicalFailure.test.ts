import { beforeEach, describe, expect, it, vi } from "vitest";

let currentReceipt: { status: string; pointsAwarded: number } | null;
const updateLineReceiptStatus = vi.fn();

vi.mock("./db", () => ({
  getLineReceiptById: vi.fn(async () => currentReceipt),
  updateLineReceiptStatus,
}));

import {
  holdReceiptAfterTechnicalFailure,
  receiptTechnicalFailureTransition,
  receiptTechnicalHoldNote,
} from "./receiptTechnicalFailure";

describe("receipt technical failure safety", () => {
  beforeEach(() => {
    currentReceipt = { status: "pending", pointsAwarded: 0 };
    updateLineReceiptStatus.mockReset();
  });

  it.each(["pending", "on_hold", "rejected"])(
    "moves an unawarded %s receipt to on_hold rather than rejected",
    async status => {
      currentReceipt = { status, pointsAwarded: 0 };
      const transition = await holdReceiptAfterTechnicalFailure({ receiptId: 101 });
      expect(transition).toBe("hold_for_manual_review");
      expect(updateLineReceiptStatus).toHaveBeenCalledTimes(1);
      expect(updateLineReceiptStatus).toHaveBeenCalledWith(
        101,
        "on_hold",
        0,
        expect.stringContaining("TECHNICAL_HOLD")
      );
      expect(updateLineReceiptStatus.mock.calls[0][3]).not.toContain("Invalid time value");
      expect(updateLineReceiptStatus.mock.calls[0][3]).toContain("未自动拒绝");
      expect(updateLineReceiptStatus.mock.calls[0][3]).toContain("未发积分");
    }
  );

  it("preserves a completed approval without another write", async () => {
    currentReceipt = { status: "approved", pointsAwarded: 59 };
    await expect(holdReceiptAfterTechnicalFailure({ receiptId: 102 }))
      .resolves.toBe("preserve_approved");
    expect(updateLineReceiptStatus).not.toHaveBeenCalled();
  });

  it("repairs an awarded receipt to approved without awarding again", async () => {
    currentReceipt = { status: "pending", pointsAwarded: 59 };
    await expect(holdReceiptAfterTechnicalFailure({ receiptId: 103 }))
      .resolves.toBe("repair_approved");
    expect(updateLineReceiptStatus).toHaveBeenCalledWith(
      103,
      "approved",
      0,
      expect.stringContaining("TECHNICAL_STATE_REPAIR")
    );
  });

  it("uses a stable non-sensitive code in the human-readable note", () => {
    const note = receiptTechnicalHoldNote();
    expect(note).toContain("RECEIPT_TECHNICAL_VALIDATION_ERROR");
    expect(note).toContain("已保留暂挂");
    expect(note).not.toContain("RangeError");
  });

  it("has deterministic pure transitions", () => {
    expect(receiptTechnicalFailureTransition(null)).toBe("hold_for_manual_review");
    expect(receiptTechnicalFailureTransition({ status: "approved", pointsAwarded: 0 })).toBe("preserve_approved");
    expect(receiptTechnicalFailureTransition({ status: "pending", pointsAwarded: 1 })).toBe("repair_approved");
  });
});
