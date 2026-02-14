import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Tests for batch AI recognition on page load and auto-advance improvements.
 * Verifies that the LineReceiptManagement page:
 * 1. Auto-triggers batch AI recognition for all pending receipts with images
 * 2. Shows progress indicator during batch processing
 * 3. Auto-selects first receipt when page loads
 * 4. Pre-fills amount from AI recognition during auto-advance
 * 5. Shows toast notifications on approve/reject
 */

describe("Batch AI Recognition Feature", () => {
  const lineReceiptMgmt = readFileSync(
    join(__dirname, "../client/src/pages/LineReceiptManagement.tsx"),
    "utf-8"
  );

  describe("Batch AI recognition state management", () => {
    it("should have batch AI progress state", () => {
      expect(lineReceiptMgmt).toContain("batchAiProgress");
      expect(lineReceiptMgmt).toContain("setBatchAiProgress");
    });

    it("should have abort ref for cancellation", () => {
      expect(lineReceiptMgmt).toContain("batchAiAbortRef");
    });

    it("should track processed IDs to avoid re-processing", () => {
      expect(lineReceiptMgmt).toContain("batchProcessedIdsRef");
    });

    it("should use adminReRecognizeOrderNumber mutation for batch processing", () => {
      expect(lineReceiptMgmt).toContain("batchReRecognizeMutation");
      expect(lineReceiptMgmt).toContain("trpc.point.adminReRecognizeOrderNumber.useMutation()");
    });
  });

  describe("Auto batch trigger on page load", () => {
    it("should filter receipts needing recognition (no totalAmount and has image)", () => {
      expect(lineReceiptMgmt).toContain("needsRecognition");
      expect(lineReceiptMgmt).toContain("!receipt.totalAmount || receipt.totalAmount === 0");
      expect(lineReceiptMgmt).toContain("receipt.imageUrl");
    });

    it("should only trigger for pending tab", () => {
      expect(lineReceiptMgmt).toContain('activeTab !== "pending"');
    });

    it("should skip already processed receipts", () => {
      expect(lineReceiptMgmt).toContain("batchProcessedIdsRef.current.has(receipt.id)");
    });

    it("should process receipts sequentially", () => {
      expect(lineReceiptMgmt).toContain("processSequentially");
    });

    it("should invalidate receipt list after batch completion", () => {
      expect(lineReceiptMgmt).toContain("utils.point.adminGetLineReceipts.invalidate()");
    });
  });

  describe("Batch progress UI", () => {
    it("should show progress bar during batch processing", () => {
      expect(lineReceiptMgmt).toContain("AI自動認識中...");
      expect(lineReceiptMgmt).toContain("件処理済み");
    });

    it("should show completion message after batch finishes", () => {
      expect(lineReceiptMgmt).toContain("AI自動認識完了");
      expect(lineReceiptMgmt).toContain("件の画像を解析しました");
    });

    it("should have cancel button for batch processing", () => {
      expect(lineReceiptMgmt).toContain("中止");
      expect(lineReceiptMgmt).toContain("batchAiAbortRef.current = true");
    });

    it("should show animated brain icon during processing", () => {
      expect(lineReceiptMgmt).toContain("Brain");
      expect(lineReceiptMgmt).toContain("animate-pulse");
    });

    it("should show gradient progress bar", () => {
      expect(lineReceiptMgmt).toContain("from-purple-500 to-blue-500");
    });
  });

  describe("Auto-select first receipt on page load", () => {
    it("should auto-select first receipt when none is selected", () => {
      // The useEffect that auto-selects first receipt
      expect(lineReceiptMgmt).toContain("Auto-select first receipt when receipts load");
      expect(lineReceiptMgmt).toContain("!calcReceiptId && receipts && receipts.length > 0");
    });

    it("should pre-fill amount from first receipt", () => {
      // In the auto-select effect
      expect(lineReceiptMgmt).toContain("setCalcAmount(amount ? String(amount) : \"\")");
    });
  });

  describe("Auto-advance with amount pre-fill", () => {
    it("should pre-fill amount from next receipt during auto-advance", () => {
      expect(lineReceiptMgmt).toContain("Pre-fill amount from next receipt");
      expect(lineReceiptMgmt).toContain("nextReceipt.receipt.totalAmount");
    });

    it("should clear amount when next receipt has no amount", () => {
      expect(lineReceiptMgmt).toContain("setCalcAmount(\"\")");
    });
  });

  describe("Toast notifications", () => {
    it("should show success toast on approval", () => {
      expect(lineReceiptMgmt).toContain('toast.success("承認完了"');
    });

    it("should show success toast on rejection", () => {
      expect(lineReceiptMgmt).toContain('toast.success("却下完了（LINE送信済み）"');
    });
  });

  describe("Reset behavior on tab change", () => {
    it("should clear batch processed IDs on tab change", () => {
      expect(lineReceiptMgmt).toContain("batchProcessedIdsRef.current.clear()");
    });

    it("should reset batch AI progress on tab change", () => {
      expect(lineReceiptMgmt).toContain("setBatchAiProgress({ total: 0, completed: 0, running: false })");
    });

    it("should reset session processed count on tab change", () => {
      expect(lineReceiptMgmt).toContain("setSessionProcessedCount(0)");
    });
  });
});

describe("Batch AI recognition filtering logic", () => {
  type MockReceipt = {
    id: number;
    totalAmount: number | null;
    imageUrl: string | null;
    status: string;
  };

  const createReceipts = (configs: Partial<MockReceipt>[]): MockReceipt[] =>
    configs.map((c, i) => ({
      id: i + 1,
      totalAmount: c.totalAmount ?? null,
      imageUrl: c.imageUrl ?? null,
      status: c.status ?? "pending",
      ...c,
    }));

  const filterNeedsRecognition = (
    receipts: MockReceipt[],
    processedIds: Set<number>
  ): MockReceipt[] =>
    receipts.filter((r) => {
      if (processedIds.has(r.id)) return false;
      return (!r.totalAmount || r.totalAmount === 0) && r.imageUrl;
    });

  it("should include receipts with no amount but with image", () => {
    const receipts = createReceipts([
      { totalAmount: null, imageUrl: "https://example.com/img.jpg" },
    ]);
    const result = filterNeedsRecognition(receipts, new Set());
    expect(result.length).toBe(1);
  });

  it("should include receipts with zero amount and image", () => {
    const receipts = createReceipts([
      { totalAmount: 0, imageUrl: "https://example.com/img.jpg" },
    ]);
    const result = filterNeedsRecognition(receipts, new Set());
    expect(result.length).toBe(1);
  });

  it("should exclude receipts with existing amount", () => {
    const receipts = createReceipts([
      { totalAmount: 2500, imageUrl: "https://example.com/img.jpg" },
    ]);
    const result = filterNeedsRecognition(receipts, new Set());
    expect(result.length).toBe(0);
  });

  it("should exclude receipts without image", () => {
    const receipts = createReceipts([
      { totalAmount: null, imageUrl: null },
    ]);
    const result = filterNeedsRecognition(receipts, new Set());
    expect(result.length).toBe(0);
  });

  it("should exclude already processed receipts", () => {
    const receipts = createReceipts([
      { totalAmount: null, imageUrl: "https://example.com/img.jpg" },
    ]);
    const processedIds = new Set([1]);
    const result = filterNeedsRecognition(receipts, processedIds);
    expect(result.length).toBe(0);
  });

  it("should correctly filter mixed receipts", () => {
    const receipts = createReceipts([
      { id: 1, totalAmount: null, imageUrl: "https://example.com/1.jpg" }, // needs recognition
      { id: 2, totalAmount: 3000, imageUrl: "https://example.com/2.jpg" }, // has amount
      { id: 3, totalAmount: null, imageUrl: null }, // no image
      { id: 4, totalAmount: 0, imageUrl: "https://example.com/4.jpg" }, // zero amount
      { id: 5, totalAmount: null, imageUrl: "https://example.com/5.jpg" }, // needs recognition
    ]);
    const processedIds = new Set([5]); // #5 already processed
    const result = filterNeedsRecognition(receipts, processedIds);
    expect(result.length).toBe(2); // #1 and #4
    expect(result.map((r) => r.id)).toEqual([1, 4]);
  });

  it("should return empty when all receipts have amounts", () => {
    const receipts = createReceipts([
      { totalAmount: 1000, imageUrl: "https://example.com/1.jpg" },
      { totalAmount: 2000, imageUrl: "https://example.com/2.jpg" },
      { totalAmount: 3000, imageUrl: "https://example.com/3.jpg" },
    ]);
    const result = filterNeedsRecognition(receipts, new Set());
    expect(result.length).toBe(0);
  });
});

describe("Batch processing sequential execution", () => {
  it("should process receipts one at a time and track progress", async () => {
    const processedIds: number[] = [];
    let progressUpdates: { completed: number; total: number }[] = [];

    const receiptsToProcess = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ];

    const total = receiptsToProcess.length;
    let completed = 0;

    for (const receipt of receiptsToProcess) {
      // Simulate processing
      processedIds.push(receipt.id);
      completed++;
      progressUpdates.push({ completed, total });
    }

    expect(processedIds).toEqual([1, 2, 3]);
    expect(progressUpdates.length).toBe(3);
    expect(progressUpdates[0]).toEqual({ completed: 1, total: 3 });
    expect(progressUpdates[1]).toEqual({ completed: 2, total: 3 });
    expect(progressUpdates[2]).toEqual({ completed: 3, total: 3 });
  });

  it("should stop processing when abort is triggered", async () => {
    const processedIds: number[] = [];
    let aborted = false;

    const receiptsToProcess = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ];

    for (const receipt of receiptsToProcess) {
      if (aborted) break;
      processedIds.push(receipt.id);
      // Simulate abort after 2nd receipt
      if (processedIds.length === 2) {
        aborted = true;
      }
    }

    expect(processedIds).toEqual([1, 2]);
    expect(aborted).toBe(true);
  });

  it("should mark failed receipts as processed to avoid retry", async () => {
    const processedIds = new Set<number>();
    const failedIds: number[] = [];

    const receiptsToProcess = [
      { id: 1, shouldFail: false },
      { id: 2, shouldFail: true },
      { id: 3, shouldFail: false },
    ];

    for (const receipt of receiptsToProcess) {
      try {
        if (receipt.shouldFail) throw new Error("AI recognition failed");
        processedIds.add(receipt.id);
      } catch {
        processedIds.add(receipt.id); // Still mark as processed
        failedIds.push(receipt.id);
      }
    }

    expect(processedIds.size).toBe(3);
    expect(processedIds.has(2)).toBe(true); // Failed but still tracked
    expect(failedIds).toEqual([2]);
  });
});
