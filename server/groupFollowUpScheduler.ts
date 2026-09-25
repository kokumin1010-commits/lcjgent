/**
 * Group Auto Follow-Up Scheduler
 * 
 * Monitors LINE groups for inactivity and sends automatic follow-up messages
 * when no one has sent a message for a specified number of days.
 */

import {
  cancelPendingLineOutgoingAudit,
  getGroupsNeedingFollowUp,
  getLineOutgoingAuditState,
  reserveLineGroupFollowUpAudit,
  withLineGroupFollowUpClaim,
} from "./db";
import { pushMessage } from "./line";
import { createLineRetryKey } from "./lineRetryKey";
import { LINE_PUBLIC_CONTACT_NAME, stripLinePublicSignature } from "../shared/linePublicIdentity";

// Default follow-up message template. Group defaults are two inactive days.
const DEFAULT_FOLLOW_UP_MESSAGE = `いつもありがとうございます。
その後の配信準備はいかがでしょうか？
日程・商品選び・見せ方など、必要でしたらこちらでサポートします。

困っていることがあれば、いつでもこのグループでご相談ください。`;
const LINE_TEXT_MAX_CHARS = 5_000;
const LINE_RETRY_SAFE_WINDOW_MS = 23 * 60 * 60 * 1000;

function followUpErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return /^LINE_[A-Z0-9_]+$/.test(message) ? message : "LINE_GROUP_FOLLOW_UP_FAILED";
}

export function normalizeGroupFollowUpMessage(text: string): string {
  const withoutSignature = stripLinePublicSignature(text);
  return (withoutSignature || DEFAULT_FOLLOW_UP_MESSAGE).slice(0, LINE_TEXT_MAX_CHARS).trim();
}

// Business hours configuration (JST)
const BUSINESS_HOURS = {
  start: 9,  // 9:00 AM
  end: 18,   // 6:00 PM
};

/**
 * Get current JST date info
 */
function getJSTDateInfo(now = new Date()): { hour: number; dayOfWeek: number } {
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
function isWithinBusinessHours(now = new Date()): boolean {
  const { hour, dayOfWeek } = getJSTDateInfo(now);
  
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
            "[Group Follow-Up] Skipping candidate: current AI suggestion is unavailable",
          );
          continue;
        }
        const expectedConversationRevision = Number(group.conversationRevision || 0);
        const candidateRawMessage = expectedMode === "ai"
          ? aiSuggestion!
          : group.autoFollowUpMessage || DEFAULT_FOLLOW_UP_MESSAGE;
        let message = normalizeGroupFollowUpMessage(candidateRawMessage);
        const senderName = LINE_PUBLIC_CONTACT_NAME;
        const legacyRetryKey = createLineRetryKey([
          "group-auto-followup",
          group.lineGroupId,
          group.followUpActivityAt.toISOString(),
        ].join(":"));
        const currentRetryKey = createLineRetryKey([
          "group-auto-followup",
          group.lineGroupId,
          group.followUpActivityAt.toISOString(),
          String(expectedConversationRevision),
        ].join(":"));
        const legacyAuditMessageId = `auto_followup_${legacyRetryKey}`;
        const legacyAudit = await getLineOutgoingAuditState(legacyAuditMessageId);
        const useLegacyAudit = Boolean(
          legacyAudit &&
          legacyAudit.lineGroupId === group.lineGroupId &&
          (legacyAudit.status === "pending" || legacyAudit.status === "responded"),
        );
        if (
          useLegacyAudit &&
          legacyAudit!.status === "pending" &&
          normalizeGroupFollowUpMessage(legacyAudit!.content || "") !== message
        ) {
          await cancelPendingLineOutgoingAudit(
            legacyAuditMessageId,
            "升级前自动跟进文案与当前设置不一致，已停止自动重放",
          );
          throw new Error("LINE_GROUP_FOLLOW_UP_LEGACY_INTENT_CONFLICT");
        }
        if (useLegacyAudit) {
          message = normalizeGroupFollowUpMessage(legacyAudit!.content || message);
        }
        const retryKey = useLegacyAudit ? legacyRetryKey : currentRetryKey;
        const auditMessageId = useLegacyAudit
          ? legacyAuditMessageId
          : `auto_followup_${currentRetryKey}`;
        const responseSummary = expectedMode === "ai"
          ? "グループ会話分析に基づくAI自動フォロー"
          : "設定済み文面による自動フォロー";
        const reservation = await reserveLineGroupFollowUpAudit({
          messageId: auditMessageId,
          sourceType: "group",
          lineGroupId: group.lineGroupId,
          senderName,
          content: message,
          lineTimestamp: Date.now(),
          pendingSummary: `${responseSummary}（送信準備中）`,
          expectedGroupConversationRevision: expectedConversationRevision,
        });
        if (reservation.status !== "pending" && reservation.status !== "responded") {
          throw new Error(`LINE_OUTBOUND_AUDIT_TERMINAL_${reservation.status.toUpperCase()}`);
        }
        const retryDeadlineAt = !reservation.created && reservation.status === "pending"
          ? reservation.firstAttemptAt
            ? new Date(reservation.firstAttemptAt.getTime() + LINE_RETRY_SAFE_WINDOW_MS)
            : new Date(0)
          : undefined;

        let deliveryAttempted = false;
        let claim;
        try {
          claim = await withLineGroupFollowUpClaim({
            lineGroupId: group.lineGroupId,
            expectedLastActivityAt: group.followUpActivityAt,
            expectedConversationRevision,
            expectedMode,
            currentAuditMessageId: auditMessageId,
            retryDeadlineAt,
          }, async current => {
            if (reservation.status === "responded") {
              return { reconciled: true };
            }
            const lockedRawMessage = current.mode === "ai"
              ? aiSuggestion!
              : current.autoFollowUpMessage || DEFAULT_FOLLOW_UP_MESSAGE;
            if (normalizeGroupFollowUpMessage(lockedRawMessage) !== message) {
              throw new Error("LINE_GROUP_FOLLOW_UP_CONTENT_CHANGED");
            }
            console.log(`[Group Follow-Up] Sending eligible follow-up (inactive for ${current.daysSinceLastMessage} days)`);
            deliveryAttempted = true;
            const success = await pushMessage(current.lineGroupId, [
              { type: "text", text: message },
            ], retryKey);
            if (!success) {
              throw new Error("LINE_GROUP_FOLLOW_UP_DELIVERY_UNCONFIRMED");
            }
            await current.finalizeOutgoingAudit(auditMessageId, responseSummary);
            return { reconciled: false };
          });
        } catch (error) {
          if (!deliveryAttempted && reservation.status === "pending") {
            await cancelPendingLineOutgoingAudit(
              auditMessageId,
              "送信前の会話・設定変更により自動フォローを中止",
            );
          }
          throw error;
        }

        if (!claim.claimed) {
          if (reservation.status === "pending") {
            await cancelPendingLineOutgoingAudit(
              auditMessageId,
              "送信前の会話・設定変更により自動フォローを中止",
            );
          }
          stats.skippedEligibilityChanged++;
          console.log(
            `[Group Follow-Up] Skipped stale candidate: ${claim.reason}`,
          );
          continue;
        }
        stats.sent++;
        console.log(
          claim.result.reconciled
            ? "[Group Follow-Up] Reconciled completed follow-up"
            : "[Group Follow-Up] Successfully sent follow-up",
        );
      } catch (error) {
        stats.errors++;
        console.error("[Group Follow-Up] Error processing candidate", {
          code: followUpErrorCode(error),
        });
      }
    }
  } catch (error) {
    console.error("[Group Follow-Up] Error checking groups", {
      code: followUpErrorCode(error),
    });
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

export const __groupFollowUpSchedulerTestUtils = {
  isWithinBusinessHours,
};
