/**
 * Group Auto Follow-Up Scheduler
 * 
 * Monitors LINE groups for inactivity and sends automatic follow-up messages
 * when no one has sent a message for a specified number of days.
 */

import {
  finalizeLineOutgoingAudit,
  getGroupsNeedingFollowUp,
  reserveLineOutgoingAudit,
  withLineGroupFollowUpClaim,
} from "./db";
import { pushMessage } from "./line";
import { createLineRetryKey } from "./lineRetryKey";

// Default follow-up message template
const DEFAULT_FOLLOW_UP_MESSAGE = `お世話になっております。
LCJエージェントでございます。

本グループの内容につきまして、
お時間のある際にご確認いただけましたら幸いです。

どうぞよろしくお願いいたします。`;

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
  // If JST minutes overflow to next day, adjust the day
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
 * Check all groups and send follow-up messages to inactive ones
 */
export async function checkAndSendGroupFollowUps(): Promise<{
  checked: number;
  sent: number;
  errors: number;
  skippedAwaitingAi: number;
  skippedEligibilityChanged: number;
  skippedOutsideBusinessHours: boolean;
}> {
  console.log("[Group Follow-Up] Starting check for inactive groups...");
  
  // Check if within business hours (Mon-Fri 9:00-18:00 JST)
  if (!isWithinBusinessHours()) {
    const { hour, dayOfWeek } = getJSTDateInfo();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    console.log(`[Group Follow-Up] Outside business hours. Current: ${dayNames[dayOfWeek]}曜日 ${hour}:00 JST. ${isWeekend ? "土日は送信しません。" : "営業時間外(9:00-18:00)です。"} Skipping.`);
    return {
      checked: 0,
      sent: 0,
      errors: 0,
      skippedAwaitingAi: 0,
      skippedEligibilityChanged: 0,
      skippedOutsideBusinessHours: true,
    };
  }
  
  const stats = {
    checked: 0,
    sent: 0,
    errors: 0,
    skippedAwaitingAi: 0,
    skippedEligibilityChanged: 0,
    skippedOutsideBusinessHours: false,
  };
  
  try {
    // Get groups that need follow-up
    const groupsNeedingFollowUp = await getGroupsNeedingFollowUp();
    stats.checked = groupsNeedingFollowUp.length;
    
    console.log(`[Group Follow-Up] Found ${groupsNeedingFollowUp.length} groups needing follow-up`);
    
    for (const group of groupsNeedingFollowUp) {
      try {
        // Determine the message to send
        const {
          getLineGroupAiInsight,
          getLineGroupProactiveSuggestion,
        } = await import("./lineAiManager");
        const aiSettings = await getLineGroupAiInsight(group.lineGroupId);
        const requiresAiSuggestion = Boolean(
          aiSettings?.analysisEnabled && aiSettings?.proactiveAiEnabled,
        );
        const expectedMode = requiresAiSuggestion ? "ai" as const : "fixed" as const;
        const aiSuggestion = requiresAiSuggestion
          ? await getLineGroupProactiveSuggestion(group.lineGroupId)
          : null;
        if (requiresAiSuggestion && !aiSuggestion) {
          stats.skippedAwaitingAi++;
          console.warn(
            `[Group Follow-Up] Skipping ${group.groupName || group.lineGroupId}: current AI suggestion is unavailable`,
          );
          continue;
        }
        const claim = await withLineGroupFollowUpClaim({
          lineGroupId: group.lineGroupId,
          expectedLastActivityAt: group.lastMessageAt || group.createdAt,
          expectedMode,
        }, async current => {
          const message = current.mode === "ai"
            ? aiSuggestion!
            : current.autoFollowUpMessage || DEFAULT_FOLLOW_UP_MESSAGE;
          const senderName = current.mode === "ai"
            ? "LCJ公式・専属AIマネージャー"
            : "LCJ公式LINE（自動フォロー）";
          const retryKey = createLineRetryKey([
            "group-auto-followup",
            current.lineGroupId,
            current.lastActivityAt.toISOString(),
          ].join(":"));
          const auditMessageId = `auto_followup_${retryKey}`;
          const responseSummary = current.mode === "ai"
            ? "グループ会話分析に基づくAI自動フォロー"
            : "設定済み文面による自動フォロー";
          const reservation = await reserveLineOutgoingAudit({
            messageId: auditMessageId,
            sourceType: "group",
            lineGroupId: current.lineGroupId,
            senderName,
            content: message,
            lineTimestamp: Date.now(),
            pendingSummary: `${responseSummary}（送信準備中）`,
          });
          if (reservation.status === "responded") {
            return { reconciled: true };
          }
          if (reservation.status !== "pending") {
            throw new Error(`LINE_OUTBOUND_AUDIT_TERMINAL_${reservation.status.toUpperCase()}`);
          }

          console.log(`[Group Follow-Up] Sending follow-up to group: ${current.groupName || current.lineGroupId} (inactive for ${current.daysSinceLastMessage} days)`);
          const success = await pushMessage(current.lineGroupId, [
            { type: "text", text: message },
          ], retryKey);
          if (!success) {
            throw new Error("LINE_GROUP_FOLLOW_UP_DELIVERY_UNCONFIRMED");
          }
          // Finalize the durable audit before recording the suppression timestamp.
          await finalizeLineOutgoingAudit(auditMessageId, responseSummary);
          return { reconciled: false };
        });

        if (!claim.claimed) {
          stats.skippedEligibilityChanged++;
          console.log(
            `[Group Follow-Up] Skipped stale candidate ${group.groupName || group.lineGroupId}: ${claim.reason}`,
          );
          continue;
        }
        stats.sent++;
        console.log(
          claim.result.reconciled
            ? `[Group Follow-Up] Reconciled completed follow-up: ${group.groupName || group.lineGroupId}`
            : `[Group Follow-Up] Successfully sent follow-up to: ${group.groupName || group.lineGroupId}`,
        );
      } catch (error) {
        stats.errors++;
        console.error(`[Group Follow-Up] Error processing group ${group.lineGroupId}:`, error);
      }
    }
  } catch (error) {
    console.error("[Group Follow-Up] Error checking groups:", error);
  }
  
  console.log(`[Group Follow-Up] Completed. Checked: ${stats.checked}, Sent: ${stats.sent}, Awaiting AI: ${stats.skippedAwaitingAi}, Eligibility changed: ${stats.skippedEligibilityChanged}, Errors: ${stats.errors}`);
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
