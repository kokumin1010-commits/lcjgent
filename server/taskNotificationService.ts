import { and, eq, isNull, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { taskNotificationOutbox } from "../drizzle/schema";
import {
  createEmailTracking,
  createReminder,
  getDb,
  getInProgressTasks,
  getPendingStaffContactsByTaskId,
} from "./db";
import { sendEmail, sendReminderEmail } from "./emailService";

let draining = false;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function affectedRows(result: unknown): number {
  return Number((result as any)?.[0]?.affectedRows || 0);
}

function retryAt(attempts: number): Date | null {
  if (attempts >= 8) return null;
  return new Date(Date.now() + Math.min(6 * 60 * 60, 60 * 2 ** Math.max(0, attempts - 1)) * 1000);
}

export async function enqueueDueTaskReminderNotifications(now = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const tasks = await getInProgressTasks();
  const bucket = Math.floor(now / (12 * 60 * 60 * 1000));
  let queued = 0;
  for (const { task } of tasks) {
    const recipients = await getPendingStaffContactsByTaskId(task.id);
    for (const recipient of recipients) {
      if (!recipient.email || (recipient.lastReminderAt && now - recipient.lastReminderAt < 12 * 60 * 60 * 1000)) continue;
      const active = rowsOf<any>(await db.execute(sql`
        SELECT id FROM task_notification_outbox
        WHERE taskId = ${task.id} AND staffId = ${recipient.id}
          AND eventType IN ('assignment','reminder')
          AND status IN ('pending','processing','failed')
        LIMIT 1
      `));
      if (active.length > 0) continue;
      const notificationKey = `reminder:${task.id}:${recipient.id}:${bucket}`;
      await db.insert(taskNotificationOutbox).values({
        notificationKey,
        eventType: "reminder",
        taskId: task.id,
        staffId: recipient.id,
        status: "pending",
      }).onDuplicateKeyUpdate({ set: { notificationKey } });
      queued += 1;
    }
  }
  return { queued };
}

export async function enqueueManualTaskReminderNotifications(taskId: number, requestId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const recipients = await getPendingStaffContactsByTaskId(taskId);
  for (const recipient of recipients) {
    await db.insert(taskNotificationOutbox).values({
      notificationKey: `manual-reminder:${taskId}:${recipient.id}:${requestId}`,
      eventType: "reminder",
      taskId,
      staffId: recipient.id,
      status: "pending",
    }).onDuplicateKeyUpdate({ set: { notificationKey: `manual-reminder:${taskId}:${recipient.id}:${requestId}` } });
  }
  return { queued: recipients.length };
}

async function claimNotifications(limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const uncertainDeliveries = rowsOf<{ id: number; leaseToken: string | null }>(await db.execute(sql`
    SELECT id, leaseToken FROM task_notification_outbox
    WHERE status = 'processing' AND deliveryStartedAt IS NOT NULL
      AND leaseUntil IS NOT NULL AND leaseUntil <= ${now}
  `));
  for (const stale of uncertainDeliveries) {
    if (!stale.leaseToken) continue;
    await db.execute(sql`
      UPDATE task_notification_outbox
      SET status = 'cancelled', leaseUntil = NULL, leaseToken = NULL,
          lastError = 'DELIVERY_OUTCOME_UNKNOWN_AFTER_WORKER_INTERRUPTION'
      WHERE id = ${Number(stale.id)} AND status = 'processing'
        AND leaseToken = ${stale.leaseToken} AND deliveryStartedAt IS NOT NULL
        AND leaseUntil IS NOT NULL AND leaseUntil <= ${now}
    `);
  }
  const candidates = rowsOf<{ id: number }>(await db.execute(sql`
    SELECT id FROM task_notification_outbox
    WHERE (
      status = 'pending'
      OR (status = 'failed' AND nextAttemptAt IS NOT NULL AND nextAttemptAt <= ${now})
      OR (status = 'processing' AND deliveryStartedAt IS NULL AND leaseUntil IS NOT NULL AND leaseUntil <= ${now})
    )
    AND attempts < 8
    ORDER BY id ASC
    LIMIT ${Math.max(1, Math.min(100, limit))}
  `));
  const claimed = [];
  for (const candidate of candidates) {
    const leaseUntil = new Date(Date.now() + 5 * 60 * 1000);
    const leaseToken = randomUUID();
    const claim = await db.execute(sql`
      UPDATE task_notification_outbox
      SET status = 'processing', attempts = attempts + 1, leaseUntil = ${leaseUntil},
          leaseToken = ${leaseToken}, deliveryStartedAt = NULL,
          nextAttemptAt = NULL, lastError = NULL
      WHERE id = ${Number(candidate.id)}
        AND (
          status = 'pending'
          OR (status = 'failed' AND nextAttemptAt IS NOT NULL AND nextAttemptAt <= ${now})
          OR (status = 'processing' AND deliveryStartedAt IS NULL AND leaseUntil IS NOT NULL AND leaseUntil <= ${now})
        )
        AND attempts < 8
    `);
    if (affectedRows(claim) !== 1) continue;
    const row = (await db.select().from(taskNotificationOutbox)
      .where(and(
        eq(taskNotificationOutbox.id, Number(candidate.id)),
        eq(taskNotificationOutbox.leaseToken, leaseToken)
      )).limit(1))[0];
    if (row) claimed.push(row);
  }
  return claimed;
}

async function loadActiveAssignee(taskId: number, staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(sql`
    SELECT t.id, t.taskId, t.taskDetail, t.notes, t.startDate, t.deadline,
      t.screenshotUrl, t.screenshotUrls, s.id AS staffId, s.name, s.email
    FROM tasks t
    INNER JOIN staff s ON s.id = ${staffId}
      AND s.isActive = 'active' AND s.archivedAt IS NULL AND s.mergedIntoStaffId IS NULL
    WHERE t.id = ${taskId} AND t.archivedAt IS NULL AND t.status <> 'cancelled'
      AND (
        EXISTS (SELECT 1 FROM task_staff ts WHERE ts.taskId = t.id AND ts.staffId = s.id)
        OR (NOT EXISTS (SELECT 1 FROM task_staff any_assignment WHERE any_assignment.taskId = t.id) AND t.staffId = s.id)
      )
      AND COALESCE((
        SELECT latest.status FROM task_execution_feedbacks latest
        WHERE latest.taskId = t.id AND latest.staffId = s.id
        ORDER BY latest.id DESC LIMIT 1
      ), 'pending') NOT IN ('completed', 'cancelled')
    LIMIT 1
  `);
  return rowsOf<any>(result)[0] || null;
}

async function beginNotificationDelivery(row: typeof taskNotificationOutbox.$inferSelect) {
  if (!row.leaseToken) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(sql`
    UPDATE task_notification_outbox
    SET deliveryStartedAt = CURRENT_TIMESTAMP,
        leaseUntil = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)
    WHERE id = ${row.id} AND status = 'processing'
      AND leaseToken = ${row.leaseToken} AND deliveryStartedAt IS NULL
  `);
  return affectedRows(result) === 1;
}

async function deliverAssigneeNotification(row: typeof taskNotificationOutbox.$inferSelect) {
  if (!row.staffId) return { cancelled: true as const, reason: "Missing assignee" };
  const recipient = await loadActiveAssignee(row.taskId, row.staffId);
  if (!recipient?.email) return { cancelled: true as const, reason: "Assignee is no longer eligible" };
  const trackingToken = createHash("sha256").update(`track:${row.notificationKey}`).digest("hex").slice(0, 32);
  const startDate = Number(recipient.startDate || Date.now());
  if (!await beginNotificationDelivery(row)) return { fenced: true as const };
  const result = await sendReminderEmail(
    String(recipient.email),
    String(recipient.name || ""),
    String(recipient.taskDetail || ""),
    String(recipient.taskId || ""),
    Math.max(0, Math.floor((Date.now() - startDate) / 86_400_000)),
    undefined,
    Array.isArray(recipient.screenshotUrls) ? recipient.screenshotUrls : recipient.screenshotUrl ? [recipient.screenshotUrl] : undefined,
    recipient.notes || undefined,
    recipient.deadline ? new Date(recipient.deadline).getTime() : undefined,
    trackingToken,
    Number(recipient.id),
    row.notificationKey,
  );
  const reminder = await createReminder({
    taskId: row.taskId,
    sentAt: Date.now(),
    recipientEmail: String(recipient.email),
    emailSubject: `【リマインド】タスクの進捗確認: ${String(recipient.taskDetail || "").slice(0, 50)}...`,
    status: result.success ? "sent" : "failed",
  });
  if (result.success && reminder?.id) {
    await createEmailTracking({
      reminderId: reminder.id,
      taskId: row.taskId,
      trackingToken,
      openedAt: null,
      openCount: 0,
      ipAddress: null,
      userAgent: null,
    });
  }
  return { cancelled: false as const, fenced: false as const, result, reminderId: reminder?.id || null };
}

async function deliverCreatorNotification(row: typeof taskNotificationOutbox.$inferSelect) {
  if (!row.recipientUserId) return { cancelled: true as const, reason: "Missing creator" };
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(sql`
    SELECT u.email, t.taskId
    FROM users u INNER JOIN tasks t ON t.id = ${row.taskId}
    WHERE u.id = ${row.recipientUserId} AND t.archivedAt IS NULL
    LIMIT 1
  `);
  const recipient = rowsOf<any>(result)[0];
  if (!recipient?.email) return { cancelled: true as const, reason: "Creator has no email" };
  if (!await beginNotificationDelivery(row)) return { fenced: true as const };
  const delivery = await sendEmail({
    to: [String(recipient.email)],
    subject: row.feedbackStatus === "completed" ? "【LCJ】タスク完了報告" : "【LCJ】タスク進捗報告",
    content: [
      `タスクID: ${String(recipient.taskId || row.taskId)}`,
      `状態: ${String(row.feedbackStatus || "updated")}`,
      `確認: https://lcjmall.com/master/tasks/${row.taskId}`,
    ].join("\n"),
    idempotencyKey: row.notificationKey,
  });
  return { cancelled: false as const, fenced: false as const, result: delivery, reminderId: null };
}

export async function processTaskNotificationOutbox(limit = 25) {
  if (draining) return { processed: 0, sent: 0, failed: 0, cancelled: 0, skipped: true };
  draining = true;
  try {
    const db = await getDb();
    if (!db) return { processed: 0, sent: 0, failed: 0, cancelled: 0, skipped: true };
    const rows = await claimNotifications(limit);
    let sent = 0;
    let failed = 0;
    let cancelled = 0;
    for (const row of rows) {
      if (!row.leaseToken) continue;
      const ownedWhere = and(
        eq(taskNotificationOutbox.id, row.id),
        eq(taskNotificationOutbox.status, "processing"),
        eq(taskNotificationOutbox.leaseToken, row.leaseToken)
      );
      try {
        const outcome = row.eventType === "feedback_creator"
          ? await deliverCreatorNotification(row)
          : await deliverAssigneeNotification(row);
        if ("fenced" in outcome && outcome.fenced) continue;
        if (outcome.cancelled) {
          const finalized = await db.update(taskNotificationOutbox).set({
            status: "cancelled", leaseUntil: null, leaseToken: null, lastError: outcome.reason,
          }).where(ownedWhere);
          if (affectedRows(finalized) === 1) cancelled += 1;
          continue;
        }
        if (!outcome.result.success) {
          const finalized = await db.update(taskNotificationOutbox).set({
            status: "failed",
            leaseUntil: null,
            leaseToken: null,
            deliveryStartedAt: null,
            nextAttemptAt: retryAt(row.attempts),
            lastError: outcome.result.errorCode || outcome.result.error || "EMAIL_FAILED",
            reminderId: outcome.reminderId,
          }).where(ownedWhere);
          if (affectedRows(finalized) === 1) failed += 1;
          continue;
        }
        const finalized = await db.update(taskNotificationOutbox).set({
          status: "sent",
          sentAt: new Date(),
          leaseUntil: null,
          leaseToken: null,
          nextAttemptAt: null,
          reminderId: outcome.reminderId,
          provider: outcome.result.provider,
          providerMessageId: outcome.result.messageId,
          lastError: null,
        }).where(ownedWhere);
        if (affectedRows(finalized) === 1) sent += 1;
      } catch (error) {
        const ownedRows = await db.select({ deliveryStartedAt: taskNotificationOutbox.deliveryStartedAt })
          .from(taskNotificationOutbox).where(ownedWhere).limit(1);
        const deliveryStarted = Boolean(ownedRows[0]?.deliveryStartedAt);
        const finalized = await db.update(taskNotificationOutbox).set({
          status: deliveryStarted ? "cancelled" : "failed",
          leaseUntil: null,
          leaseToken: null,
          deliveryStartedAt: deliveryStarted ? new Date() : null,
          nextAttemptAt: deliveryStarted ? null : retryAt(row.attempts),
          lastError: deliveryStarted
            ? `DELIVERY_OUTCOME_UNKNOWN: ${error instanceof Error ? error.message.slice(0, 3900) : "NOTIFICATION_ERROR"}`
            : error instanceof Error ? error.message.slice(0, 4000) : "NOTIFICATION_ERROR",
        }).where(ownedWhere);
        if (affectedRows(finalized) === 1) {
          if (deliveryStarted) cancelled += 1;
          else failed += 1;
        }
      }
    }
    return { processed: rows.length, sent, failed, cancelled, skipped: false };
  } finally {
    draining = false;
  }
}
