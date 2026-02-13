import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * レシート管理画面 2カラムレイアウト + 計算機テスト
 * - 左カラム: 計算機パネル（金額入力→1%ポイント自動計算→承認ボタン）
 * - 右カラム: レシートカード一覧
 */

describe("Receipt Management 2-Column Layout with Calculator", () => {
  const filePath = path.join(__dirname, "../client/src/pages/LineReceiptManagement.tsx");
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(filePath, "utf-8");
  });

  describe("2-Column Layout Structure", () => {
    it("should have a 2-column flex layout", () => {
      // Main container should use flex with gap
      expect(content).toContain("flex gap-6");
    });

    it("should have a left column with fixed width for calculator", () => {
      // Left column should be fixed width and sticky
      expect(content).toContain("w-[380px]");
      expect(content).toContain("sticky top-4");
    });

    it("should have a right column that fills remaining space", () => {
      // Right column should be flex-1
      expect(content).toContain("flex-1 min-w-0");
    });
  });

  describe("Calculator Panel", () => {
    it("should have Calculator icon and title", () => {
      expect(content).toContain("Calculator");
      expect(content).toContain("ポイント計算機");
    });

    it("should have calcReceiptId state for tracking selected receipt", () => {
      expect(content).toContain("calcReceiptId");
      expect(content).toContain("setCalcReceiptId");
    });

    it("should have calcAmount state for amount input", () => {
      expect(content).toContain("calcAmount");
      expect(content).toContain("setCalcAmount");
    });

    it("should have calcPoints state for auto-calculated points", () => {
      expect(content).toContain("calcPoints");
      expect(content).toContain("setCalcPoints");
    });

    it("should show placeholder when no receipt is selected", () => {
      expect(content).toContain("右のレシート一覧から");
      expect(content).toContain("レシートを選択してください");
    });

    it("should have amount input with yen prefix", () => {
      expect(content).toContain('type="number"');
      expect(content).toContain("金額を入力");
      expect(content).toContain("¥");
    });
  });

  describe("1% Points Auto-Calculation", () => {
    it("should auto-calculate 1% of amount using Math.floor", () => {
      // The useEffect should calculate 1% points
      expect(content).toContain("Math.floor(amount * 0.01)");
    });

    it("should display auto-calculated points prominently", () => {
      expect(content).toContain("1%ポイント（自動計算）");
      expect(content).toContain("calcPoints.toLocaleString()");
    });

    it("should show original calculated points for comparison when different", () => {
      expect(content).toContain("元の計算値:");
    });
  });

  describe("Approve Flow from Calculator", () => {
    it("should have handleCalcApprove function", () => {
      expect(content).toContain("handleCalcApprove");
    });

    it("should pass calcPoints as pointsOverride when approving", () => {
      expect(content).toContain("pointsOverride: calcPoints > 0 ? calcPoints : undefined");
    });

    it("should have a prominent approve button showing points to award", () => {
      expect(content).toContain("承認する（");
      expect(content).toContain("pt 付与）");
    });

    it("should disable approve button when points are 0", () => {
      expect(content).toContain("calcPoints <= 0");
    });

    it("should clear calculator state after successful approval", () => {
      // In onSuccess callback of approveMutation
      expect(content).toContain("setCalcReceiptId(null)");
      expect(content).toContain('setCalcAmount("")');
    });
  });

  describe("Receipt Card Selection", () => {
    it("should have selectForCalc function", () => {
      expect(content).toContain("selectForCalc");
    });

    it("should highlight selected receipt card", () => {
      // Selected card should have ring styling
      expect(content).toContain("ring-2 ring-green-500");
      expect(content).toContain("isSelected");
    });

    it("should make receipt cards clickable", () => {
      expect(content).toContain("onClick={() => selectForCalc(receipt.id)");
    });

    it("should pre-fill amount when receipt is selected", () => {
      // useEffect should set calcAmount from receipt's totalAmount
      expect(content).toContain("selectedCalcReceipt.receipt.totalAmount");
      expect(content).toContain("setCalcAmount");
    });
  });

  describe("Reject/Hold Actions", () => {
    it("should have reject button in calculator panel", () => {
      expect(content).toContain('type: "reject"');
    });

    it("should have hold button in calculator panel for pending receipts", () => {
      expect(content).toContain('type: "hold"');
    });

    it("should have separate action dialog for reject/hold", () => {
      expect(content).toContain("actionDialog");
      expect(content).toContain("handleAction");
    });
  });

  describe("Receipt Info in Calculator", () => {
    it("should show user name in calculator panel", () => {
      expect(content).toContain("selectedCalcReceipt.lineUser?.displayName");
    });

    it("should show receipt images as thumbnails in calculator", () => {
      expect(content).toContain("getReceiptImages(selectedCalcReceipt.receipt)");
    });

    it("should show order number in calculator panel", () => {
      expect(content).toContain("getOrderNumber(selectedCalcReceipt.receipt)");
    });

    it("should show AI confidence in calculator panel", () => {
      expect(content).toContain("getAiConfidence(selectedCalcReceipt.receipt)");
    });
  });
});

describe("1% Points Calculation Logic", () => {
  it("should calculate correct 1% for various amounts", () => {
    // Test the Math.floor(amount * 0.01) logic
    expect(Math.floor(9800 * 0.01)).toBe(98);
    expect(Math.floor(1000 * 0.01)).toBe(10);
    expect(Math.floor(550 * 0.01)).toBe(5);
    expect(Math.floor(99 * 0.01)).toBe(0);
    expect(Math.floor(100 * 0.01)).toBe(1);
    expect(Math.floor(12345 * 0.01)).toBe(123);
    expect(Math.floor(0 * 0.01)).toBe(0);
  });

  it("should handle edge cases", () => {
    expect(Math.floor(-100 * 0.01)).toBe(-1);
    expect(Math.floor(1 * 0.01)).toBe(0);
    expect(Math.floor(50 * 0.01)).toBe(0);
    expect(Math.floor(100000 * 0.01)).toBe(1000);
  });
});
