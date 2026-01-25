/**
 * Inactive Group Follow-up Scheduler
 * グループで2日間メッセージがない場合に自動フォローメッセージを送信するスケジューラー
 */

import { getGroupsNeedingFollowUp, updateGroupLastAutoFollowUp } from "./db";
import { pushMessage } from "./line";

// Follow-up message template
const FOLLOW_UP_MESSAGE = "ご案内内容について、念のためフォローさせていただきました。";

// Inactivity threshold (2 days in milliseconds)
const INACTIVITY_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// Minimum time between follow-ups for the same group (7 days)
const MIN_FOLLOW_UP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Business hours configuration (JST)
const BUSINESS_HOURS = {
  start: 9,  // 9:00 AM
  end: 18,   // 6:00 PM
};

/**
 * Get current JST date info
 */
function getJSTDateInfo(): { hour: number; dayOfWeek: number } {
  const now = new Date();
  const jstOffset = 9 * 60; // JST is UTC+9
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const jstMinutes = utcMinutes + jstOffset;
  const jstHour = Math.floor((jstMinutes % (24 * 60)) / 60);
  
  // Calculate JST day of week
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  const dayOfWeek = jstDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
  return { hour: jstHour, dayOfWeek };
}

/**
 * Check if current time is within business hours (JST)
 * Business hours: Monday-Friday 9:00-18:00 JST
 * No messages on weekends (Saturday/Sunday)
 */
function isWithinBusinessHours(): boolean {
  const { hour, dayOfWeek } = getJSTDateInfo();
  
  // Check if weekend (Saturday = 6, Sunday = 0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Check if within business hours (9:00-18:00)
  return hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
}

/**
 * Check inactive groups and send follow-up messages
 * Only sends during business hours: Mon-Fri 9:00-18:00 JST
 */
export async function checkAndSendInactiveGroupFollowUps() {
  console.log("[Inactive Group Follow-up] Starting check...");
  
  // Check if within business hours (Mon-Fri 9:00-18:00 JST)
  if (!isWithinBusinessHours()) {
    const { hour, dayOfWeek } = getJSTDateInfo();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    console.log(`[Inactive Group Follow-up] Outside business hours. Current: ${dayNames[dayOfWeek]}曜日 ${hour}:00 JST. ${isWeekend ? "土日は送信しません。" : "営業時間外(9:00-18:00)です。"} Skipping.`);
    return {
      checked: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      skippedOutsideBusinessHours: true,
    };
  }
  
  const stats = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };
  
  try {
    const inactiveGroups = await getGroupsNeedingFollowUp();
    stats.checked = inactiveGroups.length;
    
    console.log(`[Inactive Group Follow-up] Found ${inactiveGroups.length} inactive groups`);
    
    const now = new Date();
    
    for (const group of inactiveGroups) {
      try {
        // Skip if we already sent a follow-up recently
        if (group.lastAutoFollowUpAt) {
          const lastFollowUpTime = new Date(group.lastAutoFollowUpAt).getTime();
          const timeSinceLastFollowUp = now.getTime() - lastFollowUpTime;
          
          if (timeSinceLastFollowUp < MIN_FOLLOW_UP_INTERVAL_MS) {
            console.log(`[Inactive Group Follow-up] Group ${group.lineGroupId}: Follow-up sent recently (${Math.round(timeSinceLastFollowUp / (24 * 60 * 60 * 1000))} days ago)`);
            stats.skipped++;
            continue;
          }
        }
        
        // Send follow-up to the group
        console.log(`[Inactive Group Follow-up] Sending follow-up to group ${group.lineGroupId} (${group.groupName || 'Unknown'})...`);
        
        const success = await pushMessage(group.lineGroupId, [
          { type: "text", text: FOLLOW_UP_MESSAGE },
        ]);
        
        if (success) {
          // Update last follow-up timestamp
          await updateGroupLastAutoFollowUp(group.lineGroupId);
          stats.sent++;
          console.log(`[Inactive Group Follow-up] Follow-up sent to group ${group.lineGroupId}`);
        } else {
          stats.errors++;
          console.error(`[Inactive Group Follow-up] Failed to send follow-up to group ${group.lineGroupId}`);
        }
        
      } catch (error) {
        stats.errors++;
        console.error(`[Inactive Group Follow-up] Error processing group ${group.lineGroupId}:`, error);
      }
    }
    
  } catch (error) {
    console.error("[Inactive Group Follow-up] Error in scheduler:", error);
  }
  
  console.log(`[Inactive Group Follow-up] Completed. Checked: ${stats.checked}, Sent: ${stats.sent}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
  return stats;
}

// Scheduler interval reference
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the inactive group follow-up scheduler
 */
export function startResponseReminderScheduler() {
  if (schedulerInterval) {
    console.log("[Inactive Group Follow-up Scheduler] Already running");
    return;
  }
  
  console.log("[Inactive Group Follow-up Scheduler] Starting scheduler (runs every 6 hours)...");
  
  // Run immediately on startup (after a short delay to let other services initialize)
  setTimeout(() => {
    checkAndSendInactiveGroupFollowUps().catch(error => {
      console.error("[Inactive Group Follow-up Scheduler] Error during initial run:", error);
    });
  }, 30000); // 30 second delay
  
  // Then run every 6 hours
  schedulerInterval = setInterval(() => {
    checkAndSendInactiveGroupFollowUps().catch(error => {
      console.error("[Inactive Group Follow-up Scheduler] Error during scheduled run:", error);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the inactive group follow-up scheduler
 */
export function stopResponseReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Inactive Group Follow-up Scheduler] Stopped");
  }
}
