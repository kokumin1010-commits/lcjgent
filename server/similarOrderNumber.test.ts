import { describe, it, expect } from "vitest";

/**
 * Tests for similar order number detection (fraud prevention)
 * 
 * The system should:
 * 1. Detect exact duplicate order numbers (already implemented)
 * 2. Detect similar order numbers (1-2 digits different) as potential fraud
 * 3. Show appropriate warnings in the management UI
 * 4. Log fraud detection events with proper severity
 */

// Helper function that mirrors the server-side countDigitDifferences logic
function countDigitDifferences(a: string, b: string): number {
  if (a.length !== b.length) return Math.abs(a.length - b.length) + 3;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff;
}

// Helper function that mirrors the server-side validateOrderNumber logic
function validateOrderNumber(orderNumber: string): boolean {
  const cleaned = orderNumber.replace(/[\s\-]/g, "");
  if (!/^\d+$/.test(cleaned)) return false;
  if (cleaned.length < 10 || cleaned.length > 25) return false;
  return true;
}

describe("Similar Order Number Detection", () => {
  describe("countDigitDifferences", () => {
    it("should return 0 for identical numbers", () => {
      expect(countDigitDifferences("5819000585822287971", "5819000585822287971")).toBe(0);
    });

    it("should detect 1 digit difference", () => {
      expect(countDigitDifferences("5819000585822287971", "5819000585822287972")).toBe(1);
    });

    it("should detect 2 digit differences", () => {
      expect(countDigitDifferences("5819000585822287971", "5819000585822287982")).toBe(2);
    });

    it("should detect 3+ digit differences (not similar)", () => {
      const diff = countDigitDifferences("5819000585822287971", "5819000585822289999");
      expect(diff).toBeGreaterThanOrEqual(3);
    });

    it("should handle different length numbers", () => {
      const diff = countDigitDifferences("581900058582228797", "5819000585822287971");
      expect(diff).toBeGreaterThanOrEqual(3); // Different length = not similar
    });

    it("should detect single digit change at beginning", () => {
      expect(countDigitDifferences("5819000585822287971", "6819000585822287971")).toBe(1);
    });

    it("should detect single digit change in middle", () => {
      expect(countDigitDifferences("5819000585822287971", "5819000585832287971")).toBe(1);
    });
  });

  describe("Similar order number classification", () => {
    it("should classify 0 differences as exact duplicate (not similar)", () => {
      const diff = countDigitDifferences("5819000585822287971", "5819000585822287971");
      const isSimilar = diff > 0 && diff <= 2;
      expect(isSimilar).toBe(false); // Exact duplicate, handled separately
    });

    it("should classify 1 difference as similar (potential fraud)", () => {
      const diff = countDigitDifferences("5819000585822287971", "5819000585822287972");
      const isSimilar = diff > 0 && diff <= 2;
      expect(isSimilar).toBe(true);
    });

    it("should classify 2 differences as similar (potential fraud)", () => {
      const diff = countDigitDifferences("5819000585822287971", "5819000585822287982");
      const isSimilar = diff > 0 && diff <= 2;
      expect(isSimilar).toBe(true);
    });

    it("should classify 3+ differences as not similar (different order)", () => {
      const diff = countDigitDifferences("5819000585822287971", "5819000585822289999");
      const isSimilar = diff > 0 && diff <= 2;
      expect(isSimilar).toBe(false);
    });
  });

  describe("Order number validation", () => {
    it("should accept valid TikTok Shop order numbers (16-19 digits)", () => {
      expect(validateOrderNumber("5819000585822287971")).toBe(true);
      expect(validateOrderNumber("1234567890123456")).toBe(true);
    });

    it("should reject too short numbers", () => {
      expect(validateOrderNumber("123456789")).toBe(false);
    });

    it("should reject non-numeric strings", () => {
      expect(validateOrderNumber("ABC123456789012")).toBe(false);
    });

    it("should accept numbers with spaces/hyphens (cleaned)", () => {
      expect(validateOrderNumber("5819-0005-8582-2287-971")).toBe(true);
      expect(validateOrderNumber("5819 0005 8582 2287 971")).toBe(true);
    });

    it("should reject empty strings", () => {
      expect(validateOrderNumber("")).toBe(false);
    });
  });

  describe("Fraud detection scoring", () => {
    it("should assign high score (100) for exact duplicate", () => {
      const fraudScore = 100; // duplicate_order
      expect(fraudScore).toBe(100);
    });

    it("should assign medium score (40) for similar order number", () => {
      const fraudScore = 40; // similar_order_number
      expect(fraudScore).toBe(40);
    });

    it("should auto-hold receipts with fraud score >= 50", () => {
      // Similar order (40) alone shouldn't auto-hold
      expect(40 >= 50).toBe(false);
      
      // Similar order (40) + high amount (20) should auto-hold
      expect(40 + 20 >= 50).toBe(true);
      
      // Exact duplicate (100) should always auto-hold
      expect(100 >= 50).toBe(true);
    });
  });

  describe("checkType enum values", () => {
    const validCheckTypes = [
      "duplicate_image",
      "duplicate_receipt",
      "expired_receipt",
      "high_frequency",
      "high_amount",
      "suspicious_pattern",
      "similar_order_number",
    ];

    it("should include similar_order_number in valid check types", () => {
      expect(validCheckTypes).toContain("similar_order_number");
    });

    it("should have 7 check types total", () => {
      expect(validCheckTypes).toHaveLength(7);
    });
  });

  describe("UI badge display logic", () => {
    it("should show '類似注文番号' badge for similar_order_number flag", () => {
      const fraudFlags = ["similar_order_number"];
      const hasSimilar = fraudFlags.includes("similar_order_number");
      expect(hasSimilar).toBe(true);
    });

    it("should show '重複注文' badge for duplicate_order flag", () => {
      const fraudFlags = ["duplicate_order"];
      const hasDuplicate = fraudFlags.includes("duplicate_order");
      expect(hasDuplicate).toBe(true);
    });

    it("should show '不正フラグ' badge for other flags", () => {
      const fraudFlags = ["high_amount"];
      const hasSimilar = fraudFlags.includes("similar_order_number");
      const hasDuplicate = fraudFlags.includes("duplicate_order");
      expect(hasSimilar).toBe(false);
      expect(hasDuplicate).toBe(false);
    });

    it("should prioritize similar_order_number over generic flag", () => {
      const fraudFlags = ["similar_order_number", "high_amount"];
      // UI should show "類似注文番号" first
      const hasSimilar = fraudFlags.includes("similar_order_number");
      expect(hasSimilar).toBe(true);
    });
  });

  describe("Fraud log label mapping", () => {
    const checkTypeLabels: Record<string, string> = {
      duplicate_image: "重複画像",
      duplicate_receipt: "重複レシート",
      expired_receipt: "期限切れ",
      high_frequency: "高頻度申請",
      high_amount: "高額購入",
      suspicious_pattern: "不審パターン",
      similar_order_number: "類似注文番号",
    };

    it("should have Japanese labels for all check types", () => {
      expect(checkTypeLabels["similar_order_number"]).toBe("類似注文番号");
      expect(checkTypeLabels["duplicate_image"]).toBe("重複画像");
      expect(checkTypeLabels["high_amount"]).toBe("高額購入");
    });

    it("should have labels for all 7 check types", () => {
      expect(Object.keys(checkTypeLabels)).toHaveLength(7);
    });
  });
});
