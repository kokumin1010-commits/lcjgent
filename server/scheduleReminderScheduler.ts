/**
 * Schedule Reminder Scheduler
 * 
 * Sends LINE reminders for upcoming schedules.
 * Runs every 5 minutes to check for schedules that need reminders.
 */

import { getDb } from "./db";
import { schedules } from "../drizzle/schema";
import { and, eq, gte, lte, isNull, not } from "drizzle-orm";
import { pushMessage } from "./line";

// Check interval in milliseconds (5 minutes)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

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

// Get schedules that need reminders
async function getSchedulesNeedingReminders(): Promise<Array<{
  id: number;
  title: string;
  startTime: Date;
  liverName: string | null;
  lineGroupId: string | null;
  createdByLineUserId: string | null;
  reminderMinutesBefore: number | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  // Get schedules where:
  // 1. reminderEnabled is true
  // 2. reminderSentAt is null (not yet sent)
  // 3. startTime is within the reminder window (now + reminderMinutesBefore)
  // 4. status is not cancelled
  
  // We check for schedules starting in the next 35 minutes (to catch 30-minute reminders with buffer)
  const maxReminderWindow = new Date(now.getTime() + 35 * 60 * 1000);
  
  const result = await db
    .select({
      id: schedules.id,
      title: schedules.title,
      startTime: schedules.startTime,
      liverName: schedules.liverName,
      lineGroupId: schedules.lineGroupId,
      createdByLineUserId: schedules.createdByLineUserId,
      reminderMinutesBefore: schedules.reminderMinutesBefore,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.reminderEnabled, true),
        isNull(schedules.reminderSentAt),
        gte(schedules.startTime, now),
        lte(schedules.startTime, maxReminderWindow),
        not(eq(schedules.status, "cancelled"))
      )
    );
  
  // Filter to only include schedules that are within their reminder window
  return result.filter(schedule => {
    const reminderMinutes = schedule.reminderMinutesBefore || 30;
    const reminderTime = new Date(schedule.startTime.getTime() - reminderMinutes * 60 * 1000);
    return now >= reminderTime;
  });
}

// Mark schedule reminder as sent
async function markReminderSent(scheduleId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(schedules)
    .set({ reminderSentAt: new Date() })
    .where(eq(schedules.id, scheduleId));
}

// Send reminder for a schedule
async function sendScheduleReminder(schedule: {
  id: number;
  title: string;
  startTime: Date;
  liverName: string | null;
  lineGroupId: string | null;
  createdByLineUserId: string | null;
  reminderMinutesBefore: number | null;
}): Promise<boolean> {
  // Determine where to send the reminder
  const targetId = schedule.lineGroupId || schedule.createdByLineUserId;
  
  if (!targetId) {
    console.log(`[Schedule Reminder] No target for schedule ${schedule.id} (${schedule.title})`);
    return false;
  }
  
  // Format the reminder message
  const startTimeStr = schedule.startTime.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo"
  });
  
  const dateStr = schedule.startTime.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo"
  });
  
  const reminderMinutes = schedule.reminderMinutesBefore || 30;
  
  let message = `⏰ まもなく予定があります！\n\n`;
  message += `📅 ${dateStr} ${startTimeStr}\n`;
  message += `📝 ${schedule.title}\n`;
  if (schedule.liverName) {
    message += `👤 ${schedule.liverName}\n`;
  }
  message += `\n${reminderMinutes}分前のリマインドです。`;
  
  try {
    await pushMessage(targetId, [{ type: "text", text: message }]);
    console.log(`[Schedule Reminder] Sent reminder for schedule ${schedule.id} to ${targetId}`);
    return true;
  } catch (error) {
    console.error(`[Schedule Reminder] Failed to send reminder for schedule ${schedule.id}:`, error);
    return false;
  }
}

// Main check function
// Only sends during business hours: Mon-Fri 9:00-18:00 JST
async function checkAndSendReminders(): Promise<void> {
  // Check if within business hours (Mon-Fri 9:00-18:00 JST)
  if (!isWithinBusinessHours()) {
    const { hour, dayOfWeek } = getJSTDateInfo();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    // Only log occasionally to avoid spam
    if (Math.random() < 0.1) {
      console.log(`[Schedule Reminder] Outside business hours. Current: ${dayNames[dayOfWeek]}曜日 ${hour}:00 JST. ${isWeekend ? "土日は送信しません。" : "営業時間外(9:00-18:00)です。"} Skipping.`);
    }
    return;
  }
  
  try {
    const schedulesNeedingReminders = await getSchedulesNeedingReminders();
    
    let sent = 0;
    let failed = 0;
    
    for (const schedule of schedulesNeedingReminders) {
      const success = await sendScheduleReminder(schedule);
      if (success) {
        await markReminderSent(schedule.id);
        sent++;
      } else {
        failed++;
      }
    }
    
    if (schedulesNeedingReminders.length > 0) {
      console.log(`[Schedule Reminder] Completed. Sent: ${sent}, Failed: ${failed}`);
    }
  } catch (error) {
    console.error("[Schedule Reminder] Error checking reminders:", error);
  }
}

// Start the scheduler
let intervalId: NodeJS.Timeout | null = null;

export function startScheduleReminderScheduler(): void {
  if (intervalId) {
    console.log("[Schedule Reminder] Scheduler already running");
    return;
  }
  
  console.log("[Schedule Reminder] Starting scheduler (every 5 minutes)");
  
  // Run immediately on start
  checkAndSendReminders();
  
  // Then run every 5 minutes
  intervalId = setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
}

export function stopScheduleReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Schedule Reminder] Scheduler stopped");
  }
}
