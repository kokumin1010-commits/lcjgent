import { getInProgressTasks, createReminder } from "./db";
import { sendReminderEmail } from "./emailService";

/**
 * Check all in-progress tasks and send reminder emails
 * This function is called by the scheduler every 12 hours
 */
export async function checkAndSendReminders() {
  console.log("[Reminder Scheduler] Starting reminder check...");

  try {
    const inProgressTasks = await getInProgressTasks();
    console.log(`[Reminder Scheduler] Found ${inProgressTasks.length} in-progress tasks`);

    let successCount = 0;
    let failureCount = 0;

    for (const { task, staff } of inProgressTasks) {
      if (!staff || !staff.email) {
        console.warn(`[Reminder Scheduler] Task ${task.id} has no assigned staff or email`);
        continue;
      }

      // Calculate days elapsed since task creation
      const daysElapsed = Math.floor(
        (Date.now() - task.startDate) / (1000 * 60 * 60 * 24)
      );

      // Check if we should send a reminder (every 12 hours = 0.5 days)
      // For simplicity, we send reminders for all in-progress tasks when this runs
      console.log(
        `[Reminder Scheduler] Sending reminder for task ${task.id} to ${staff.email}`
      );

      const result = await sendReminderEmail(
        staff.email,
        staff.name,
        task.taskDetail,
        task.taskId,
        daysElapsed,
        task.completionToken || undefined,
        task.screenshotUrl || undefined
      );

      if (result.success) {
        // Record reminder in database
        await createReminder({
          taskId: task.id,
          sentAt: Date.now(),
          recipientEmail: staff.email,
          emailSubject: `【リマインド】タスクの進捗確認: ${task.taskDetail.substring(0, 50)}...`,
          status: "sent",
        });
        successCount++;
        console.log(`[Reminder Scheduler] Reminder sent successfully for task ${task.id}`);
      } else {
        await createReminder({
          taskId: task.id,
          sentAt: Date.now(),
          recipientEmail: staff.email,
          emailSubject: `【リマインド】タスクの進捗確認: ${task.taskDetail.substring(0, 50)}...`,
          status: "failed",
        });
        failureCount++;
        console.error(
          `[Reminder Scheduler] Failed to send reminder for task ${task.id}:`,
          result.error
        );
      }
    }

    console.log(
      `[Reminder Scheduler] Completed. Success: ${successCount}, Failed: ${failureCount}`
    );

    return {
      success: true,
      totalTasks: inProgressTasks.length,
      successCount,
      failureCount,
    };
  } catch (error) {
    console.error("[Reminder Scheduler] Error during reminder check:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}
