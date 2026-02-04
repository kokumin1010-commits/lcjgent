/**
 * LINE Reminder Scheduler
 * 
 * Processes pending LINE reminders and sends notifications.
 * Runs every minute to check for reminders that are due.
 */

import { processPendingReminders } from "./lineReminder";

// Check interval: every 1 minute
const CHECK_INTERVAL_MS = 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the LINE reminder scheduler
 */
export function startLineReminderScheduler() {
  if (intervalId) {
    console.log("[LINE Reminder Scheduler] Already running");
    return;
  }

  console.log("[LINE Reminder Scheduler] Starting scheduler (every 1 minute)");

  // Run immediately on start
  processPendingReminders().catch((error) => {
    console.error("[LINE Reminder Scheduler] Error during initial run:", error);
  });

  // Then run every minute
  intervalId = setInterval(() => {
    processPendingReminders().catch((error) => {
      console.error("[LINE Reminder Scheduler] Error during scheduled run:", error);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the LINE reminder scheduler
 */
export function stopLineReminderScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[LINE Reminder Scheduler] Stopped");
  }
}
