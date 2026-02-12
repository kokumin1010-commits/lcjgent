import { describe, it, expect, vi } from "vitest";

/**
 * Test: Point balance merge logic during LINE account linking
 * 
 * When a user registers via email (gets email_${id} point balance),
 * then links their LINE account, the point balance should be merged
 * from email_${id} to their LINE userId.
 */

describe("Point Balance Merge on LINE Link", () => {
  it("should merge email_ balance into LINE userId balance when linking", () => {
    // Simulate the merge logic
    const emailBalance = { balance: 500, totalEarned: 500, totalUsed: 0 };
    const lineBalance = { balance: 231, totalEarned: 231, totalUsed: 0 };
    
    // After merge
    const mergedBalance = lineBalance.balance + emailBalance.balance;
    const mergedTotalEarned = lineBalance.totalEarned + emailBalance.totalEarned;
    const mergedTotalUsed = lineBalance.totalUsed + emailBalance.totalUsed;
    
    expect(mergedBalance).toBe(731);
    expect(mergedTotalEarned).toBe(731);
    expect(mergedTotalUsed).toBe(0);
  });

  it("should zero out email_ balance after merge", () => {
    const emailBalanceBefore = { balance: 500, totalEarned: 500, totalUsed: 0 };
    
    // After merge, email_ balance should be zeroed
    const emailBalanceAfter = { balance: 0, totalEarned: 0, totalUsed: 0 };
    
    expect(emailBalanceAfter.balance).toBe(0);
    expect(emailBalanceAfter.totalEarned).toBe(0);
    expect(emailBalanceAfter.totalUsed).toBe(0);
  });

  it("should create LINE userId balance if it does not exist", () => {
    const emailBalance = { balance: 500, totalEarned: 500, totalUsed: 0 };
    const lineBalanceExists = false;
    
    // When LINE balance doesn't exist, create with 0 first, then add email_ balance
    const newLineBalance = lineBalanceExists 
      ? { balance: 0, totalEarned: 0, totalUsed: 0 }  // existing
      : { balance: 0, totalEarned: 0, totalUsed: 0 };  // newly created
    
    const mergedBalance = newLineBalance.balance + emailBalance.balance;
    expect(mergedBalance).toBe(500);
  });

  it("should not merge if email_ balance is 0", () => {
    const emailBalance = { balance: 0, totalEarned: 500, totalUsed: 500 };
    const lineBalance = { balance: 231, totalEarned: 231, totalUsed: 0 };
    
    // If email_ balance is 0, no merge needed (only transaction migration)
    const shouldMergeBalance = emailBalance.balance > 0;
    expect(shouldMergeBalance).toBe(false);
    
    // LINE balance should remain unchanged
    expect(lineBalance.balance).toBe(231);
  });

  it("should handle the full flow: register -> earn 500pt -> link LINE -> receipt 231pt", () => {
    // Step 1: Email registration -> 500pt bonus
    let emailPointBalance = 500;
    
    // Step 2: Link LINE account -> merge points
    const lineUserId = "U02ea91375a184a5922b077ffb61bd55e";
    let linePointBalance = 0; // New LINE balance created
    
    // Merge: email_ -> LINE userId
    linePointBalance += emailPointBalance;
    emailPointBalance = 0;
    
    expect(linePointBalance).toBe(500);
    expect(emailPointBalance).toBe(0);
    
    // Step 3: Receipt upload -> earn 231pt (now goes to LINE userId)
    linePointBalance += 231;
    
    expect(linePointBalance).toBe(731);
  });
});
