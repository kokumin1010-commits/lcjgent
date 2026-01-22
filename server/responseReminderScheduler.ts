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

/**
 * Check inactive groups and send follow-up messages
 */
export async function checkAndSendInactiveGroupFollowUps() {
  console.log("[Inactive Group Follow-up] Starting check...");
  
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
