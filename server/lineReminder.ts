/**
 * LINE Reminder Module
 * LINEからのリマインダー設定を解析し、指定時刻に通知を送信する
 */

import { invokeLLM } from "./_core/llm";
import { sendLinePushMessage } from "./_core/lineMessaging";
import { getDb } from "./db";
import { lineReminders, type InsertLineReminder } from "../drizzle/schema";
import { eq, and, desc, asc, lte } from "drizzle-orm";

// Reminder keywords that trigger reminder parsing
const REMINDER_KEYWORDS = [
  "リマインド",
  "リマインダー",
  "通知",
  "教えて",
  "知らせて",
  "remind",
  "reminder",
  "アラーム",
  "起こして",
];

// ============================================
// Local DB helper functions
// ============================================

async function createLineReminderLocal(data: InsertLineReminder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(lineReminders).values(data);
}

async function getPendingLineRemindersLocal(beforeTimestamp: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .select()
    .from(lineReminders)
    .where(
      and(
        eq(lineReminders.status, "pending"),
        lte(lineReminders.scheduledAt, beforeTimestamp)
      )
    )
    .orderBy(asc(lineReminders.scheduledAt));
}

async function updateLineReminderStatusLocal(
  id: number,
  status: "pending" | "sent" | "cancelled" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status };
  if (status === "sent") {
    updateData.sentAt = Date.now();
  }
  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }
  
  return await db
    .update(lineReminders)
    .set(updateData)
    .where(eq(lineReminders.id, id));
}

async function getLineRemindersByUserLocal(lineUserId: string, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .select()
    .from(lineReminders)
    .where(eq(lineReminders.lineUserId, lineUserId))
    .orderBy(desc(lineReminders.createdAt))
    .limit(limit);
}

// ============================================
// Exported functions
// ============================================

/**
 * Check if a message contains reminder keywords
 */
export function containsReminderKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return REMINDER_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Parse reminder request using LLM
 * Returns parsed datetime and message, or null if not a valid reminder request
 */
export async function parseReminderRequest(
  text: string,
  currentTime: Date = new Date()
): Promise<{
  scheduledAt: number; // UTC timestamp in milliseconds
  message: string;
  isValid: boolean;
  errorMessage?: string;
} | null> {
  try {
    // Format current time in JST for context
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
    });
    const currentTimeJST = jstFormatter.format(currentTime);

    const systemPrompt = `あなたはリマインダー設定を解析するアシスタントです。
ユーザーのメッセージからリマインダーの日時とメッセージを抽出してください。

現在の日時（日本時間）: ${currentTimeJST}

以下のJSON形式で回答してください:
{
  "isValid": true/false,
  "year": 年（4桁）,
  "month": 月（1-12）,
  "day": 日（1-31）,
  "hour": 時（0-23）,
  "minute": 分（0-59）,
  "message": "リマインダーメッセージ",
  "errorMessage": "エラーの場合のメッセージ（オプション）"
}

解析ルール:
1. 「今日」「明日」「明後日」は現在の日付から計算
2. 「X時」は24時間形式で解釈（「朝9時」→9、「夜9時」→21）
3. 「X分後」「X時間後」は現在時刻から計算
4. 日付が指定されていない場合は今日または明日（時刻が過ぎている場合）
5. 時刻が指定されていない場合は9:00をデフォルトとする
6. 「2/4」「2月4日」などの形式も解析
7. 過去の日時が指定された場合はisValid: falseとし、errorMessageに理由を記載
8. メッセージが明示されていない場合は「リマインダー」をデフォルトとする

例:
- 「今日の9時にリマインドして」→ 今日の9:00
- 「明日の朝リマインドして」→ 明日の9:00
- 「2/4の9時にリマインドして」→ 2月4日の9:00
- 「30分後に教えて」→ 現在時刻+30分
- 「会議のリマインドを明日10時に」→ 明日の10:00、メッセージ「会議」`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reminder_parse",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isValid: { type: "boolean" },
              year: { type: "integer" },
              month: { type: "integer" },
              day: { type: "integer" },
              hour: { type: "integer" },
              minute: { type: "integer" },
              message: { type: "string" },
              errorMessage: { type: "string" },
            },
            required: ["isValid", "year", "month", "day", "hour", "minute", "message", "errorMessage"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== "string") {
      return null;
    }

    const parsed = JSON.parse(content);

    if (!parsed.isValid) {
      return {
        scheduledAt: 0,
        message: "",
        isValid: false,
        errorMessage: parsed.errorMessage || "リマインダーの日時を解析できませんでした。",
      };
    }

    // Create date in JST timezone
    const scheduledDate = new Date(
      Date.UTC(
        parsed.year,
        parsed.month - 1,
        parsed.day,
        parsed.hour - 9, // Convert JST to UTC
        parsed.minute
      )
    );

    // Validate the date is in the future
    if (scheduledDate.getTime() <= currentTime.getTime()) {
      return {
        scheduledAt: 0,
        message: "",
        isValid: false,
        errorMessage: "指定された日時は既に過ぎています。未来の日時を指定してください。",
      };
    }

    return {
      scheduledAt: scheduledDate.getTime(),
      message: parsed.message || "リマインダー",
      isValid: true,
    };
  } catch (error) {
    console.error("[LINE Reminder] Error parsing reminder request:", error);
    return null;
  }
}

/**
 * Create a reminder from a LINE message
 */
export async function createReminderFromMessage(
  lineUserId: string,
  messageText: string
): Promise<{
  success: boolean;
  message: string;
  scheduledAt?: number;
}> {
  try {
    // Parse the reminder request
    const parsed = await parseReminderRequest(messageText);

    if (!parsed) {
      return {
        success: false,
        message: "リマインダーの設定に失敗しました。もう一度お試しください。",
      };
    }

    if (!parsed.isValid) {
      return {
        success: false,
        message: parsed.errorMessage || "リマインダーの日時を解析できませんでした。",
      };
    }

    // Check pending reminders count (limit to 10 per user)
    const existingReminders = await getLineRemindersByUserLocal(lineUserId, 10);
    const pendingCount = existingReminders.filter((r) => r.status === "pending").length;
    if (pendingCount >= 10) {
      return {
        success: false,
        message: "リマインダーの上限（10件）に達しています。既存のリマインダーをキャンセルしてから設定してください。",
      };
    }

    // Create the reminder
    await createLineReminderLocal({
      lineUserId,
      message: parsed.message,
      originalRequest: messageText,
      scheduledAt: parsed.scheduledAt,
      timezone: "Asia/Tokyo",
      repeatType: "none",
      status: "pending",
    });

    // Format the scheduled time for display
    const scheduledDate = new Date(parsed.scheduledAt);
    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
    });
    const formattedTime = jstFormatter.format(scheduledDate);

    return {
      success: true,
      message: `⏰ リマインダーを設定しました！\n\n📅 ${formattedTime}\n📝 ${parsed.message}\n\nこの時間になったらお知らせします。`,
      scheduledAt: parsed.scheduledAt,
    };
  } catch (error) {
    console.error("[LINE Reminder] Error creating reminder:", error);
    return {
      success: false,
      message: "リマインダーの設定中にエラーが発生しました。",
    };
  }
}

/**
 * Process and send pending reminders
 * This should be called by a cron job every minute
 */
export async function processPendingReminders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const stats = { processed: 0, sent: 0, failed: 0 };

  try {
    const now = Date.now();
    const pendingReminders = await getPendingLineRemindersLocal(now);

    console.log(`[LINE Reminder] Processing ${pendingReminders.length} pending reminders`);

    for (const reminder of pendingReminders) {
      stats.processed++;

      try {
        // Send the reminder message
        await sendLinePushMessage(reminder.lineUserId, [
          {
            type: "text",
            text: `⏰ リマインダー\n\n${reminder.message}`,
          },
        ]);

        // Update status to sent
        await updateLineReminderStatusLocal(reminder.id, "sent");
        stats.sent++;

        console.log(`[LINE Reminder] Sent reminder ${reminder.id} to ${reminder.lineUserId}`);
      } catch (error) {
        // Update status to failed
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await updateLineReminderStatusLocal(reminder.id, "failed", errorMessage);
        stats.failed++;

        console.error(`[LINE Reminder] Failed to send reminder ${reminder.id}:`, error);
      }
    }

    console.log(`[LINE Reminder] Completed. Processed: ${stats.processed}, Sent: ${stats.sent}, Failed: ${stats.failed}`);
  } catch (error) {
    console.error("[LINE Reminder] Error processing pending reminders:", error);
  }

  return stats;
}

/**
 * Get reminder list message for a user
 */
export async function getReminderListMessage(lineUserId: string): Promise<string> {
  try {
    const reminders = await getLineRemindersByUserLocal(lineUserId, 5);
    const pendingReminders = reminders.filter((r) => r.status === "pending");

    if (pendingReminders.length === 0) {
      return "📋 設定中のリマインダーはありません。\n\n「〇〇時にリマインドして」と送信するとリマインダーを設定できます。";
    }

    const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let message = `📋 設定中のリマインダー（${pendingReminders.length}件）\n\n`;

    for (const reminder of pendingReminders) {
      const formattedTime = jstFormatter.format(new Date(reminder.scheduledAt));
      message += `⏰ ${formattedTime}\n   ${reminder.message}\n\n`;
    }

    message += "リマインダーをキャンセルするには「リマインダーキャンセル」と送信してください。";

    return message;
  } catch (error) {
    console.error("[LINE Reminder] Error getting reminder list:", error);
    return "リマインダー一覧の取得中にエラーが発生しました。";
  }
}
