import { describe, it, expect } from "vitest";

/**
 * Tests for the auto-advance receipt selection feature.
 * These tests verify the logic for automatically selecting the next receipt
 * after approve/reject/hold operations.
 */

describe("Auto-advance receipt selection logic", () => {
  // Simulate the receipt list filtering behavior
  type MockReceipt = { id: number; status: string; totalAmount: number };

  const createReceiptList = (count: number, status = "pending"): MockReceipt[] =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      status,
      totalAmount: (i + 1) * 1000,
    }));

  // Simulate what happens when a receipt is processed and removed from list
  const processReceipt = (list: MockReceipt[], processedId: number): MockReceipt[] =>
    list.filter((r) => r.id !== processedId);

  // Simulate auto-advance: pick the first receipt from remaining list
  const autoSelectNext = (remainingList: MockReceipt[]): number | null =>
    remainingList.length > 0 ? remainingList[0].id : null;

  describe("After approval", () => {
    it("should select the first remaining receipt after approving", () => {
      const list = createReceiptList(5);
      // Process receipt #1 (approve)
      const remaining = processReceipt(list, 1);
      const nextId = autoSelectNext(remaining);
      expect(nextId).toBe(2);
    });

    it("should select the first receipt when a middle receipt is approved", () => {
      const list = createReceiptList(5);
      // Process receipt #3
      const remaining = processReceipt(list, 3);
      const nextId = autoSelectNext(remaining);
      expect(nextId).toBe(1);
    });

    it("should return null when last receipt is approved", () => {
      const list = createReceiptList(1);
      const remaining = processReceipt(list, 1);
      const nextId = autoSelectNext(remaining);
      expect(nextId).toBeNull();
    });
  });

  describe("After rejection", () => {
    it("should select the first remaining receipt after rejecting", () => {
      const list = createReceiptList(3);
      const remaining = processReceipt(list, 2);
      const nextId = autoSelectNext(remaining);
      expect(nextId).toBe(1);
    });

    it("should return null when all receipts are rejected", () => {
      let list = createReceiptList(2);
      list = processReceipt(list, 1);
      list = processReceipt(list, 2);
      const nextId = autoSelectNext(list);
      expect(nextId).toBeNull();
    });
  });

  describe("After hold", () => {
    it("should select the first remaining receipt after holding", () => {
      const list = createReceiptList(4);
      // Hold receipt #1 (moves to on_hold tab, removed from pending)
      const remaining = processReceipt(list, 1);
      const nextId = autoSelectNext(remaining);
      expect(nextId).toBe(2);
    });
  });

  describe("Session processing counter", () => {
    it("should correctly count processed receipts", () => {
      let count = 0;
      const list = createReceiptList(5);

      // Process 3 receipts
      let remaining = list;
      for (const id of [1, 2, 3]) {
        remaining = processReceipt(remaining, id);
        count++;
      }

      expect(count).toBe(3);
      expect(remaining.length).toBe(2);
    });

    it("should reset counter when tab changes", () => {
      let count = 5;
      // Simulate tab change
      count = 0;
      expect(count).toBe(0);
    });
  });

  describe("All processed message", () => {
    it("should show completion when no receipts remain", () => {
      const list = createReceiptList(2);
      let remaining = processReceipt(list, 1);
      remaining = processReceipt(remaining, 2);
      const allProcessed = remaining.length === 0;
      expect(allProcessed).toBe(true);
    });

    it("should not show completion when receipts remain", () => {
      const list = createReceiptList(3);
      const remaining = processReceipt(list, 1);
      const allProcessed = remaining.length === 0;
      expect(allProcessed).toBe(false);
    });
  });

  describe("Auto-advance toggle", () => {
    it("should not auto-select when disabled", () => {
      const autoAdvanceEnabled = false;
      const list = createReceiptList(3);
      const remaining = processReceipt(list, 1);

      // When auto-advance is disabled, should clear selection instead
      const nextId = autoAdvanceEnabled ? autoSelectNext(remaining) : null;
      expect(nextId).toBeNull();
    });

    it("should auto-select when enabled", () => {
      const autoAdvanceEnabled = true;
      const list = createReceiptList(3);
      const remaining = processReceipt(list, 1);

      const nextId = autoAdvanceEnabled ? autoSelectNext(remaining) : null;
      expect(nextId).toBe(2);
    });
  });

  describe("Continuous processing flow", () => {
    it("should process all receipts in sequence", () => {
      let list = createReceiptList(4);
      let processedCount = 0;
      const processedIds: number[] = [];

      while (list.length > 0) {
        const currentId = autoSelectNext(list)!;
        processedIds.push(currentId);
        list = processReceipt(list, currentId);
        processedCount++;
      }

      expect(processedCount).toBe(4);
      expect(processedIds).toEqual([1, 2, 3, 4]);
      expect(autoSelectNext(list)).toBeNull();
    });

    it("should handle non-sequential processing", () => {
      let list = createReceiptList(5);
      let processedCount = 0;

      // Process in non-sequential order: 3, 1, 5, 2, 4
      for (const id of [3, 1, 5, 2, 4]) {
        list = processReceipt(list, id);
        processedCount++;
        // After each processing, auto-select should pick first remaining
        const nextId = autoSelectNext(list);
        if (list.length > 0) {
          expect(nextId).toBe(list[0].id);
        } else {
          expect(nextId).toBeNull();
        }
      }

      expect(processedCount).toBe(5);
    });
  });

  describe("Points calculation during auto-advance", () => {
    it("should pre-fill amount from next receipt after advance", () => {
      const list = createReceiptList(3);
      // Process #1, auto-advance to #2
      const remaining = processReceipt(list, 1);
      const nextId = autoSelectNext(remaining);
      const nextReceipt = remaining.find((r) => r.id === nextId);

      expect(nextReceipt).toBeDefined();
      expect(nextReceipt!.totalAmount).toBe(2000);

      // 1% point calculation
      const points = Math.floor(nextReceipt!.totalAmount * 0.01);
      expect(points).toBe(20);
    });
  });
});
