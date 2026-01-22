/**
 * Response Reminder Scheduler
 * 要対応メッセージに対して1時間ごとにリマインドを送信するスケジューラー
 */

import { getPendingResponsesByGroup, updateMessageReminderSent } from "./db";
import { pushMessage } from "./line";

// Reminder message template
const REMINDER_MESSAGE = "ご案内内容について、念のためフォローさせていただきました。";

// Maximum number of reminders to send per message
const MAX_REMINDERS = 24; // 24時間分（1時間ごと）

// Minimum time between reminders (in milliseconds)
const MIN_REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check pending responses and send reminders
 */
export async function checkAndSendResponseReminders() {
  console.log("[Response Reminder] Starting reminder check...");
  
  const stats = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };
  
  try {
    const pendingGroups = await getPendingResponsesByGroup();
    stats.checked = pendingGroups.length;
    
    console.log(`[Response Reminder] Found ${pendingGroups.length} groups with pending responses`);
    
    const now = new Date();
    
    for (const group of pendingGroups) {
      try {
        // Get the oldest pending message in this group
        const oldestMessage = group.oldestPending;
        
        // Skip if max reminders reached
        if (oldestMessage.reminderCount >= MAX_REMINDERS) {
          console.log(`[Response Reminder] Group ${group.lineGroupId}: Max reminders reached (${oldestMessage.reminderCount})`);
          stats.skipped++;
          continue;
        }
        
        // Check if enough time has passed since last reminder
        if (oldestMessage.lastReminderAt) {
          const lastReminderTime = new Date(oldestMessage.lastReminderAt).getTime();
          const timeSinceLastReminder = now.getTime() - lastReminderTime;
          
          if (timeSinceLastReminder < MIN_REMINDER_INTERVAL_MS) {
            console.log(`[Response Reminder] Group ${group.lineGroupId}: Too soon since last reminder (${Math.round(timeSinceLastReminder / 60000)} mins ago)`);
            stats.skipped++;
            continue;
          }
        } else {
          // First reminder - check if at least 1 hour has passed since the message was received
          const messageTime = new Date(oldestMessage.createdAt).getTime();
          const timeSinceMessage = now.getTime() - messageTime;
          
          if (timeSinceMessage < MIN_REMINDER_INTERVAL_MS) {
            console.log(`[Response Reminder] Group ${group.lineGroupId}: Message too recent (${Math.round(timeSinceMessage / 60000)} mins ago)`);
            stats.skipped++;
            continue;
          }
        }
        
        // Send reminder to the group
        console.log(`[Response Reminder] Sending reminder to group ${group.lineGroupId}...`);
        
        const success = await pushMessage(group.lineGroupId, [
          { type: "text", text: REMINDER_MESSAGE },
        ]);
        
        if (success) {
          // Update reminder count for the oldest message
          await updateMessageReminderSent(oldestMessage.messageId);
          stats.sent++;
          console.log(`[Response Reminder] Reminder sent to group ${group.lineGroupId} (reminder #${oldestMessage.reminderCount + 1})`);
        } else {
          stats.errors++;
          console.error(`[Response Reminder] Failed to send reminder to group ${group.lineGroupId}`);
        }
        
      } catch (error) {
        stats.errors++;
        console.error(`[Response Reminder] Error processing group ${group.lineGroupId}:`, error);
      }
    }
    
  } catch (error) {
    console.error("[Response Reminder] Error in scheduler:", error);
  }
  
  console.log(`[Response Reminder] Completed. Checked: ${stats.checked}, Sent: ${stats.sent}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
  return stats;
}

// Scheduler interval reference
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the response reminder scheduler
 */
export function startResponseReminderScheduler() {
  if (schedulerInterval) {
    console.log("[Response Reminder Scheduler] Already running");
    return;
  }
  
  console.log("[Response Reminder Scheduler] Starting scheduler (runs every 1 hour)...");
  
  // Run immediately on startup (after a short delay to let other services initialize)
  setTimeout(() => {
    checkAndSendResponseReminders().catch(error => {
      console.error("[Response Reminder Scheduler] Error during initial run:", error);
    });
  }, 10000); // 10 second delay
  
  // Then run every hour
  schedulerInterval = setInterval(() => {
    checkAndSendResponseReminders().catch(error => {
      console.error("[Response Reminder Scheduler] Error during scheduled run:", error);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the response reminder scheduler
 */
export function stopResponseReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Response Reminder Scheduler] Stopped");
  }
}
