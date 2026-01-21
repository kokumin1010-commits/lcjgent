/**
 * Group Auto Follow-Up Scheduler
 * 
 * Monitors LINE groups for inactivity and sends automatic follow-up messages
 * when no one has sent a message for a specified number of days.
 */

import { getGroupsNeedingFollowUp, updateGroupLastAutoFollowUp, saveLineMessage } from "./db";
import { pushMessage } from "./line";

// Default follow-up message template
const DEFAULT_FOLLOW_UP_MESSAGE = `お世話になっております。LCJエージェントです。

しばらくご連絡がないようですが、何かお困りのことはございませんか？
ご質問やご相談がございましたら、お気軽にお声がけください。

引き続きよろしくお願いいたします。`;

/**
 * Check all groups and send follow-up messages to inactive ones
 */
export async function checkAndSendGroupFollowUps(): Promise<{
  checked: number;
  sent: number;
  errors: number;
}> {
  console.log("[Group Follow-Up] Starting check for inactive groups...");
  
  const stats = {
    checked: 0,
    sent: 0,
    errors: 0,
  };
  
  try {
    // Get groups that need follow-up
    const groupsNeedingFollowUp = await getGroupsNeedingFollowUp();
    stats.checked = groupsNeedingFollowUp.length;
    
    console.log(`[Group Follow-Up] Found ${groupsNeedingFollowUp.length} groups needing follow-up`);
    
    for (const group of groupsNeedingFollowUp) {
      try {
        // Determine the message to send
        const message = group.autoFollowUpMessage || DEFAULT_FOLLOW_UP_MESSAGE;
        
        console.log(`[Group Follow-Up] Sending follow-up to group: ${group.groupName || group.lineGroupId} (inactive for ${group.daysSinceLastMessage} days)`);
        
        // Send the follow-up message
        const success = await pushMessage(group.lineGroupId, [
          { type: "text", text: message },
        ]);
        
        if (success) {
          // Update the last follow-up timestamp
          await updateGroupLastAutoFollowUp(group.lineGroupId);
          
          // Save the outgoing message to database
          await saveLineMessage({
            messageId: `auto_followup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceType: "group",
            lineGroupId: group.lineGroupId,
            messageType: "text",
            content: message,
            direction: "outgoing",
          });
          
          stats.sent++;
          console.log(`[Group Follow-Up] Successfully sent follow-up to: ${group.groupName || group.lineGroupId}`);
        } else {
          stats.errors++;
          console.error(`[Group Follow-Up] Failed to send follow-up to: ${group.groupName || group.lineGroupId}`);
        }
      } catch (error) {
        stats.errors++;
        console.error(`[Group Follow-Up] Error processing group ${group.lineGroupId}:`, error);
      }
    }
  } catch (error) {
    console.error("[Group Follow-Up] Error checking groups:", error);
  }
  
  console.log(`[Group Follow-Up] Completed. Checked: ${stats.checked}, Sent: ${stats.sent}, Errors: ${stats.errors}`);
  return stats;
}

// Scheduler interval (check every 6 hours)
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the group follow-up scheduler
 */
export function startGroupFollowUpScheduler() {
  if (schedulerInterval) {
    console.log("[Group Follow-Up Scheduler] Already running");
    return;
  }
  
  console.log("[Group Follow-Up Scheduler] Starting scheduler (runs every 6 hours)...");
  
  // Run immediately on startup
  checkAndSendGroupFollowUps();
  
  // Then run every 6 hours
  schedulerInterval = setInterval(() => {
    checkAndSendGroupFollowUps();
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the group follow-up scheduler
 */
export function stopGroupFollowUpScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Group Follow-Up Scheduler] Stopped");
  }
}
