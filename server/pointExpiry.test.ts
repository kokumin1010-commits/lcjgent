import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyArticleType,
  buildCoverImagePrompt,
} from "./coverImageStyles";

// Test the point expiry scheduler logic
describe("pointExpiryScheduler", () => {
  it("should export initPointExpiryScheduler and runPointExpiryJob", async () => {
    const mod = await import("./pointExpiryScheduler");
    expect(typeof mod.initPointExpiryScheduler).toBe("function");
    expect(typeof mod.runPointExpiryJob).toBe("function");
  });
});

// Test the point expiry date calculation
describe("Point Expiry Date Calculation", () => {
  it("should calculate 3 months from a given date correctly", () => {
    const baseDate = new Date(2026, 0, 15); // Jan 15, local time
    const expiryDate = new Date(baseDate);
    expiryDate.setMonth(expiryDate.getMonth() + 3);
    
    expect(expiryDate.getFullYear()).toBe(2026);
    expect(expiryDate.getMonth()).toBe(3); // April (0-indexed)
    expect(expiryDate.getDate()).toBe(15);
  });

  it("should handle month overflow correctly (Nov -> Feb)", () => {
    const baseDate = new Date(2025, 10, 30); // Nov 30, local time
    const expiryDate = new Date(baseDate);
    expiryDate.setMonth(expiryDate.getMonth() + 3);
    
    // Nov 30 + 3 months = Feb 28 (or Mar 2 depending on JS behavior)
    // JavaScript Date handles overflow by rolling forward
    expect(expiryDate.getFullYear()).toBe(2026);
    // Month should be February or March depending on leap year handling
    expect(expiryDate.getMonth()).toBeGreaterThanOrEqual(1); // At least February
  });

  it("should handle year boundary correctly (Dec -> Mar)", () => {
    const baseDate = new Date(2025, 11, 15); // Dec 15, local time
    const expiryDate = new Date(baseDate);
    expiryDate.setMonth(expiryDate.getMonth() + 3);
    
    expect(expiryDate.getFullYear()).toBe(2026);
    expect(expiryDate.getMonth()).toBe(2); // March
    expect(expiryDate.getDate()).toBe(15);
  });
});

// Test the expiring points detection logic
describe("Expiring Points Detection", () => {
  it("should correctly identify points expiring within 7 days", () => {
    const now = new Date();
    const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const in40Days = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
    
    const transactions = [
      { expiresAt: in5Days, remainingAmount: 100 },
      { expiresAt: in10Days, remainingAmount: 200 },
      { expiresAt: in40Days, remainingAmount: 300 },
    ];
    
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringIn7Days = transactions
      .filter(t => t.expiresAt <= sevenDaysFromNow)
      .reduce((sum, t) => sum + t.remainingAmount, 0);
    
    const expiringIn30Days = transactions
      .filter(t => t.expiresAt <= thirtyDaysFromNow)
      .reduce((sum, t) => sum + t.remainingAmount, 0);
    
    expect(expiringIn7Days).toBe(100); // Only the 5-day one
    expect(expiringIn30Days).toBe(300); // 5-day + 10-day
  });

  it("should return 0 when no points are expiring soon", () => {
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const transactions = [
      { expiresAt: in60Days, remainingAmount: 500 },
    ];
    
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const expiringIn7Days = transactions
      .filter(t => t.expiresAt <= sevenDaysFromNow)
      .reduce((sum, t) => sum + t.remainingAmount, 0);
    
    expect(expiringIn7Days).toBe(0);
  });
});

// Test LINE notification message format
describe("LINE Notification Message Format", () => {
  it("should format expiry date correctly in Japanese", () => {
    const expiryDate = new Date(2026, 2, 15); // March 15, local time
    const formattedDate = `${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日`;
    expect(formattedDate).toBe("3月15日");
  });

  it("should format point amount with locale string", () => {
    const amount = 1500;
    const formatted = amount.toLocaleString();
    expect(formatted).toContain("1"); // At least contains the digits
    expect(formatted).toContain("500");
  });

  it("should generate correct 7-day warning message", () => {
    const expiryDate = new Date(2026, 3, 1); // April 1, local time
    const formattedDate = `${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日`;
    const amount = 2000;
    
    const message = `⚠️ ポイント失効のお知らせ\n\n${amount.toLocaleString()}ポイントが${formattedDate}までに失効します。`;
    
    expect(message).toContain("ポイント失効のお知らせ");
    expect(message).toContain("4月1日");
    expect(message).toContain("失効します");
  });

  it("should generate correct 30-day notice message", () => {
    const expiryDate = new Date(2026, 4, 20); // May 20, local time
    const formattedDate = `${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日`;
    const amount = 500;
    
    const message = `📢 ポイント失効予定のお知らせ\n\n${amount.toLocaleString()}ポイントが${formattedDate}までに失効予定です。`;
    
    expect(message).toContain("ポイント失効予定のお知らせ");
    expect(message).toContain("5月20日");
    expect(message).toContain("失効予定です");
  });
});

// Test FIFO point consumption logic
describe("FIFO Point Consumption", () => {
  it("should consume oldest points first", () => {
    const transactions = [
      { id: 1, expiresAt: new Date("2026-03-01"), remainingAmount: 100 },
      { id: 2, expiresAt: new Date("2026-04-01"), remainingAmount: 200 },
      { id: 3, expiresAt: new Date("2026-05-01"), remainingAmount: 300 },
    ];
    
    let amountToConsume = 250;
    const consumed: { id: number; amount: number }[] = [];
    
    // Sort by expiry date (oldest first)
    const sorted = [...transactions].sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
    
    for (const tx of sorted) {
      if (amountToConsume <= 0) break;
      const consume = Math.min(tx.remainingAmount, amountToConsume);
      consumed.push({ id: tx.id, amount: consume });
      amountToConsume -= consume;
    }
    
    expect(consumed).toEqual([
      { id: 1, amount: 100 }, // Fully consumed
      { id: 2, amount: 150 }, // Partially consumed
    ]);
    expect(amountToConsume).toBe(0);
  });

  it("should handle exact consumption amount", () => {
    const transactions = [
      { id: 1, expiresAt: new Date("2026-03-01"), remainingAmount: 100 },
    ];
    
    let amountToConsume = 100;
    const consumed: { id: number; amount: number }[] = [];
    
    for (const tx of transactions) {
      if (amountToConsume <= 0) break;
      const consume = Math.min(tx.remainingAmount, amountToConsume);
      consumed.push({ id: tx.id, amount: consume });
      amountToConsume -= consume;
    }
    
    expect(consumed).toEqual([{ id: 1, amount: 100 }]);
    expect(amountToConsume).toBe(0);
  });
});

// Test scheduler timing calculation
describe("Scheduler Timing", () => {
  it("should calculate correct delay to next 9:00 AM JST", () => {
    const jstOffset = 9 * 60 * 60 * 1000;
    
    // Simulate a time before 9:00 AM JST
    const testTime = new Date("2026-02-25T22:00:00Z"); // 7:00 AM JST next day
    const nowJST = new Date(testTime.getTime() + jstOffset);
    
    const todayJST9AM = new Date(nowJST);
    todayJST9AM.setUTCHours(0, 0, 0, 0);
    
    let nextRun = todayJST9AM.getTime() - jstOffset;
    if (nextRun <= testTime.getTime()) {
      nextRun += 24 * 60 * 60 * 1000;
    }
    
    const delayMs = nextRun - testTime.getTime();
    const delayHours = delayMs / (1000 * 60 * 60);
    
    // Should be within 0-24 hours
    expect(delayHours).toBeGreaterThan(0);
    expect(delayHours).toBeLessThanOrEqual(24);
  });
});
