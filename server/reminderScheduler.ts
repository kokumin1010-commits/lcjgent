import {
  enqueueDueTaskReminderNotifications,
  processTaskNotificationOutbox,
} from "./taskNotificationService";

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
let enqueueIntervalId: ReturnType<typeof setInterval> | null = null;

export async function checkAndSendReminders() {
  console.log("[Reminder Scheduler] Enqueuing eligible per-assignee reminders...");
  try {
    const queued = await enqueueDueTaskReminderNotifications();
    const delivery = await processTaskNotificationOutbox(100);
    return {
      success: delivery.failed === 0,
      queuedCount: queued.queued,
      successCount: delivery.sent,
      failureCount: delivery.failed,
      cancelledCount: delivery.cancelled,
    };
  } catch (error) {
    console.error("[Reminder Scheduler] Error during reminder check", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: String(error) };
  }
}

export function startTaskNotificationScheduler() {
  if (schedulerIntervalId || enqueueIntervalId) return;
  const drain = () => processTaskNotificationOutbox(50).catch(error => {
    console.error("[TaskNotificationOutbox] drain failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
  });
  const enqueue = () => checkAndSendReminders().catch(() => undefined);
  setTimeout(drain, 10_000);
  setTimeout(enqueue, 30_000);
  schedulerIntervalId = setInterval(drain, 30_000);
  enqueueIntervalId = setInterval(enqueue, 12 * 60 * 60 * 1000);
}

export function stopTaskNotificationScheduler() {
  if (schedulerIntervalId) clearInterval(schedulerIntervalId);
  if (enqueueIntervalId) clearInterval(enqueueIntervalId);
  schedulerIntervalId = null;
  enqueueIntervalId = null;
}
