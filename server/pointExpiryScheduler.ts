/**
 * Point Expiry Scheduler
 * 
 * Runs periodically to:
 * 1. Process expired points (mark as expired, deduct from balances)
 * 2. Send LINE notifications for points expiring soon (1 month, 1 week before)
 * 
 * Schedule: Runs once per day at 9:00 AM JST
 */

import { pushMessage } from "./line";
import {
  processExpiredPoints,
  processExpiredLinePoints,
  getLineUsersWithExpiringPoints,
  getExpiringLinePoints,
} from "./db";

// Track notification state to avoid duplicate sends within same day
const notifiedToday = new Set<string>();

/**
 * Process all expired points and send notifications.
 * Called by the scheduler.
 */
export async function runPointExpiryJob(): Promise<{
  expired: { webUsers: number; webPoints: number; lineUsers: number; linePoints: number };
  notifications: { sent7Days: number; sent30Days: number; failed: number };
}> {
  console.log("[PointExpiry] Starting point expiry job...");
  
  const result = {
    expired: { webUsers: 0, webPoints: 0, lineUsers: 0, linePoints: 0 },
    notifications: { sent7Days: 0, sent30Days: 0, failed: 0 },
  };
  
  // Step 1: Process expired points
  try {
    const webResult = await processExpiredPoints();
    result.expired.webUsers = webResult.usersAffected;
    result.expired.webPoints = webResult.totalExpired;
    console.log(`[PointExpiry] Web: ${webResult.usersAffected} users, ${webResult.totalExpired} points expired`);
  } catch (err) {
    console.error("[PointExpiry] Error processing web expired points:", err);
  }
  
  try {
    const lineResult = await processExpiredLinePoints();
    result.expired.lineUsers = lineResult.usersAffected;
    result.expired.linePoints = lineResult.totalExpired;
    console.log(`[PointExpiry] LINE: ${lineResult.usersAffected} users, ${lineResult.totalExpired} points expired`);
  } catch (err) {
    console.error("[PointExpiry] Error processing LINE expired points:", err);
  }
  
  // Step 2: Send 1-week (7 days) expiry notifications
  try {
    const users7Days = await getLineUsersWithExpiringPoints(7);
    for (const user of users7Days) {
      // Skip users with 0 or negative expiring amount (safety check)
      if (user.expiringAmount <= 0) continue;
      const notifKey = `7d_${user.lineUserId}_${new Date().toISOString().slice(0, 10)}`;
      if (notifiedToday.has(notifKey)) continue;
      
      try {
        const expiryDate = new Date(user.earliestExpiry);
        const formattedDate = `${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日`;
        
        const success = await pushMessage(user.lineUserId, [{
          type: "text",
          text: `⚠️ ポイント失効のお知らせ\n\n${user.expiringAmount.toLocaleString()}ポイントが${formattedDate}までに失効します。\n\nお早めにLCJ MALLでご利用ください！\n\n🛒 LCJ MALLでお買い物\nhttps://lcjmall.com/mall\n\n※ ポイントは付与日から3ヶ月で失効します。`,
        }]);
        
        if (success) {
          notifiedToday.add(notifKey);
          result.notifications.sent7Days++;
        } else {
          result.notifications.failed++;
        }
      } catch (err) {
        console.error(`[PointExpiry] Failed to notify ${user.lineUserId} (7d):`, err);
        result.notifications.failed++;
      }
    }
    console.log(`[PointExpiry] 7-day notifications: ${result.notifications.sent7Days} sent`);
  } catch (err) {
    console.error("[PointExpiry] Error sending 7-day notifications:", err);
  }
  
  // Step 3: Send 1-month (30 days) expiry notifications
  try {
    const users30Days = await getLineUsersWithExpiringPoints(30);
    for (const user of users30Days) {
      // Skip users with 0 or negative expiring amount (safety check)
      if (user.expiringAmount <= 0) continue;
      const notifKey = `30d_${user.lineUserId}_${new Date().toISOString().slice(0, 10)}`;
      // Skip if already notified for 7-day (more urgent) or already sent 30-day today
      const notifKey7d = `7d_${user.lineUserId}_${new Date().toISOString().slice(0, 10)}`;
      if (notifiedToday.has(notifKey) || notifiedToday.has(notifKey7d)) continue;
      
      try {
        const expiryDate = new Date(user.earliestExpiry);
        const formattedDate = `${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日`;
        
        const success = await pushMessage(user.lineUserId, [{
          type: "text",
          text: `📢 ポイント失効予定のお知らせ\n\n${user.expiringAmount.toLocaleString()}ポイントが${formattedDate}までに失効予定です。\n\nLCJ MALLでのお買い物にぜひご利用ください！\n\n🛒 LCJ MALLでお買い物\nhttps://lcjmall.com/mall\n\n※ ポイントは付与日から3ヶ月で失効します。`,
        }]);
        
        if (success) {
          notifiedToday.add(notifKey);
          result.notifications.sent30Days++;
        } else {
          result.notifications.failed++;
        }
      } catch (err) {
        console.error(`[PointExpiry] Failed to notify ${user.lineUserId} (30d):`, err);
        result.notifications.failed++;
      }
    }
    console.log(`[PointExpiry] 30-day notifications: ${result.notifications.sent30Days} sent`);
  } catch (err) {
    console.error("[PointExpiry] Error sending 30-day notifications:", err);
  }
  
  // Clear notification cache at end of day (reset daily)
  // This is handled by the scheduler running once per day
  
  console.log("[PointExpiry] Job complete:", JSON.stringify(result));
  return result;
}

/**
 * Initialize the point expiry scheduler.
 * Runs daily at 9:00 AM JST (0:00 UTC).
 */
export function initPointExpiryScheduler(): void {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  // Calculate time until next 9:00 AM JST
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const nowJST = new Date(now.getTime() + jstOffset);
  const todayJST9AM = new Date(nowJST);
  todayJST9AM.setUTCHours(0, 0, 0, 0); // 9:00 AM JST = 0:00 UTC
  
  let nextRun = todayJST9AM.getTime() - jstOffset;
  if (nextRun <= now.getTime()) {
    nextRun += INTERVAL_MS; // Next day
  }
  
  const delayMs = nextRun - now.getTime();
  const delayHours = (delayMs / (1000 * 60 * 60)).toFixed(1);
  console.log(`[PointExpiry] Scheduler initialized. Next run in ${delayHours} hours`);
  
  // First run after delay
  setTimeout(() => {
    runPointExpiryJob().catch(err => console.error("[PointExpiry] Job error:", err));
    
    // Then run every 24 hours
    setInterval(() => {
      notifiedToday.clear(); // Reset daily notification tracking
      runPointExpiryJob().catch(err => console.error("[PointExpiry] Job error:", err));
    }, INTERVAL_MS);
  }, delayMs);
}
