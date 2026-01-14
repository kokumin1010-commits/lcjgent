import { getInProgressTasks, createReminder, getStaffByTaskId, updateTask } from "./db";
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

    for (const { task } of inProgressTasks) {
      // Check if 12 hours have passed since last reminder
      const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      if (task.lastReminderAt && (Date.now() - task.lastReminderAt) < TWELVE_HOURS) {
        console.log(`[Reminder Scheduler] Skipping task ${task.id} - last reminder was sent less than 12 hours ago`);
        continue;
      }

      // Get all assigned staff members for this task
      const assignedStaff = await getStaffByTaskId(task.id);
      
      if (!assignedStaff || assignedStaff.length === 0) {
        console.warn(`[Reminder Scheduler] Task ${task.id} has no assigned staff`);
        continue;
      }

      // Calculate days elapsed since task creation
      const daysElapsed = Math.floor(
        (Date.now() - task.startDate) / (1000 * 60 * 60 * 24)
      );

      // Send reminder to all assigned staff members
      for (const item of assignedStaff) {
        if (!item.staff || !item.staff.email) {
          console.warn(`[Reminder Scheduler] Task ${task.id} has staff with no email`);
          continue;
        }

        console.log(
          `[Reminder Scheduler] Sending reminder for task ${task.id} to ${item.staff.email}`
        );

        const result = await sendReminderEmail(
          item.staff.email,
          item.staff.name,
          task.taskDetail,
          task.taskId,
          daysElapsed,
          task.completionToken || undefined,
          task.screenshotUrls || (task.screenshotUrl ? [task.screenshotUrl] : undefined),
          task.notes || undefined,
          task.deadline ? task.deadline.getTime() : undefined
        );

        if (result.success) {
          // Record reminder in database
          await createReminder({
            taskId: task.id,
            sentAt: Date.now(),
            recipientEmail: item.staff.email,
            emailSubject: `【リマインド】タスクの進捗確認: ${task.taskDetail.substring(0, 50)}...`,
            status: "sent",
          });
          
          // Update lastReminderAt timestamp
          await updateTask(task.id, { lastReminderAt: Date.now() });
          
          successCount++;
          console.log(`[Reminder Scheduler] Reminder sent successfully for task ${task.id} to ${item.staff.email}`);
        } else {
          await createReminder({
            taskId: task.id,
            sentAt: Date.now(),
            recipientEmail: item.staff.email,
            emailSubject: `【リマインド】タスクの進捗確認: ${task.taskDetail.substring(0, 50)}...`,
            status: "failed",
          });
          failureCount++;
          console.error(
            `[Reminder Scheduler] Failed to send reminder for task ${task.id} to ${item.staff.email}:`,
            result.error
          );
        }
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
