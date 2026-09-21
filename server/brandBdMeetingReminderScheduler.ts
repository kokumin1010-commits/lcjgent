import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { escapeHtml, sendEmail } from "./emailService";
import {
  buildBrandBdMeetingNotificationKey,
  getBrandBdCommandPool,
  listBrandBdCoreBossUserIds,
} from "./brandBdCommandService";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function normalizeIds(value: unknown): number[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return [
      ...new Set(
        (Array.isArray(parsed) ? parsed : [])
          .map(Number)
          .filter(id => Number.isInteger(id) && id > 0)
      ),
    ];
  } catch {
    return [];
  }
}

async function enqueueDueReminders() {
  const pool = await getBrandBdCommandPool();
  const [meetings] = await pool.query<RowDataPacket[]>(
    `SELECT id,ownerStaffId,attendeeStaffIds,notifyBosses,reminderMinutesBefore
       FROM brand_bd_meetings
      WHERE status='scheduled'
        AND startsAt>UTC_TIMESTAMP()
        AND startsAt<=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 DAY)
        AND DATE_SUB(startsAt,INTERVAL reminderMinutesBefore MINUTE)<=UTC_TIMESTAMP()
      ORDER BY startsAt ASC
      LIMIT 200`
  );
  const bossUserIds = await listBrandBdCoreBossUserIds();
  for (const meeting of meetings) {
    const meetingId = Number(meeting.id);
    const reminderMinutes = Number(meeting.reminderMinutesBefore || 60);
    const staffIds = [
      ...new Set(
        [
          Number(meeting.ownerStaffId),
          ...normalizeIds(meeting.attendeeStaffIds),
        ].filter(id => Number.isInteger(id) && id > 0)
      ),
    ];
    for (const staffId of staffIds) {
      await pool.query(
        `INSERT IGNORE INTO brand_bd_meeting_reminder_outbox
           (notificationKey,meetingId,recipientType,recipientId,status,nextAttemptAt)
         VALUES (?,?,'staff',?,'pending',UTC_TIMESTAMP())`,
        [
          buildBrandBdMeetingNotificationKey(
            meetingId,
            "staff",
            staffId,
            reminderMinutes
          ),
          meetingId,
          staffId,
        ]
      );
    }
    if (Boolean(Number(meeting.notifyBosses))) {
      for (const userId of bossUserIds) {
        await pool.query(
          `INSERT IGNORE INTO brand_bd_meeting_reminder_outbox
             (notificationKey,meetingId,recipientType,recipientId,status,nextAttemptAt)
           VALUES (?,?,'user',?,'pending',UTC_TIMESTAMP())`,
          [
            buildBrandBdMeetingNotificationKey(
              meetingId,
              "user",
              userId,
              reminderMinutes
            ),
            meetingId,
            userId,
          ]
        );
      }
    }
  }
}

async function recoverExpiredLeases() {
  const pool = await getBrandBdCommandPool();
  await pool.query(
    `UPDATE brand_bd_meeting_reminder_outbox
        SET status='pending',leaseUntil=NULL,leaseToken=NULL,lastError='LEASE_RECOVERED_BEFORE_DELIVERY'
      WHERE status='processing' AND leaseUntil<UTC_TIMESTAMP() AND deliveryStartedAt IS NULL`
  );
  const [uncertainResult] = await pool.query(
    `UPDATE brand_bd_meeting_reminder_outbox
        SET status='manual_review',leaseUntil=NULL,leaseToken=NULL,lastError='DELIVERY_OUTCOME_UNKNOWN'
      WHERE status='processing' AND leaseUntil<UTC_TIMESTAMP() AND deliveryStartedAt IS NOT NULL`
  );
  const uncertainCount = Number((uncertainResult as any)?.affectedRows || 0);
  if (uncertainCount > 0) {
    console.error("[BrandBDMeetingReminder] delivery outcome requires review", {
      count: uncertainCount,
    });
  }
}

async function claimBatch() {
  const pool = await getBrandBdCommandPool();
  const connection = await pool.getConnection();
  const leaseToken = randomUUID();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id
         FROM brand_bd_meeting_reminder_outbox
        WHERE status IN ('pending','failed')
          AND (nextAttemptAt IS NULL OR nextAttemptAt<=UTC_TIMESTAMP())
          AND (leaseUntil IS NULL OR leaseUntil<UTC_TIMESTAMP())
          AND attempts<5
        ORDER BY id ASC
        LIMIT 20
        FOR UPDATE`
    );
    const ids = rows.map(row => Number(row.id));
    if (ids.length === 0) {
      await connection.commit();
      return { leaseToken, ids: [] as number[] };
    }
    await connection.query(
      `UPDATE brand_bd_meeting_reminder_outbox
          SET status='processing',attempts=attempts+1,leaseToken=?,
              leaseUntil=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 3 MINUTE),deliveryStartedAt=NULL
        WHERE id IN (${ids.map(() => "?").join(",")})`,
      [leaseToken, ...ids]
    );
    await connection.commit();
    return { leaseToken, ids };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function loadDelivery(
  connection: PoolConnection,
  id: number,
  leaseToken: string
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT o.*,m.title,m.startsAt,m.location,m.agenda,m.status AS meetingStatus,
            b.id AS brandId,b.name AS brandName
       FROM brand_bd_meeting_reminder_outbox o
       JOIN brand_bd_meetings m ON m.id=o.meetingId
       JOIN brands b ON b.id=m.brandId
      WHERE o.id=? AND o.leaseToken=? AND o.status='processing'
      LIMIT 1`,
    [id, leaseToken]
  );
  return rows[0] || null;
}

async function resolveRecipient(connection: PoolConnection, delivery: any) {
  if (String(delivery.recipientType) === "staff") {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT name,email FROM staff
        WHERE id=? AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
        LIMIT 1`,
      [delivery.recipientId]
    );
    return rows[0]
      ? { name: String(rows[0].name || ""), email: String(rows[0].email || "") }
      : null;
  }
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT name,email FROM users WHERE id=? LIMIT 1",
    [delivery.recipientId]
  );
  return rows[0]
    ? { name: String(rows[0].name || ""), email: String(rows[0].email || "") }
    : null;
}

async function deliverOne(id: number, leaseToken: string) {
  const pool = await getBrandBdCommandPool();
  const connection = await pool.getConnection();
  try {
    const delivery = await loadDelivery(connection, id, leaseToken);
    if (!delivery) return;
    if (
      String(delivery.meetingStatus) !== "scheduled" ||
      new Date(delivery.startsAt).getTime() <= Date.now()
    ) {
      await connection.query(
        `UPDATE brand_bd_meeting_reminder_outbox
            SET status='cancelled',lastError='MEETING_NOT_ACTIVE',leaseToken=NULL,leaseUntil=NULL
          WHERE id=? AND leaseToken=?`,
        [id, leaseToken]
      );
      return;
    }
    const recipient = await resolveRecipient(connection, delivery);
    if (!recipient?.email) {
      await connection.query(
        `UPDATE brand_bd_meeting_reminder_outbox
            SET status='failed',lastError='RECIPIENT_EMAIL_MISSING',nextAttemptAt=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR),leaseToken=NULL,leaseUntil=NULL
          WHERE id=? AND leaseToken=?`,
        [id, leaseToken]
      );
      return;
    }
    const startsAtJst = new Date(delivery.startsAt).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const [deliveryStartResult] = await connection.query(
      `UPDATE brand_bd_meeting_reminder_outbox
          SET deliveryStartedAt=UTC_TIMESTAMP()
        WHERE id=? AND leaseToken=? AND status='processing' AND deliveryStartedAt IS NULL`,
      [id, leaseToken]
    );
    if (Number((deliveryStartResult as any)?.affectedRows || 0) !== 1) return;
    const pagePath =
      String(delivery.recipientType) === "staff"
        ? "/my/performance"
        : `/master/brand-bd-command?brandId=${Number(delivery.brandId)}`;
    const pageUrl = `${process.env.APP_URL || "https://lcjmall.com"}${pagePath}`;
    const pageLabel =
      String(delivery.recipientType) === "staff"
        ? "打开我的今日事项"
        : "打开品牌BD指挥塔";
    let result;
    try {
      result = await sendEmail({
        to: [recipient.email],
        subject: `【品牌BD会议提醒】${String(delivery.brandName)} · ${String(delivery.title)}`,
        content: `${recipient.name}，品牌BD会议即将开始。\n品牌：${String(delivery.brandName)}\n会议：${String(delivery.title)}\n时间：${startsAtJst}\n地点：${String(delivery.location || "未填写")}\n${pageUrl}`,
        html: `<p>${escapeHtml(recipient.name)}，品牌BD会议即将开始。</p><ul><li>品牌：${escapeHtml(String(delivery.brandName))}</li><li>会议：${escapeHtml(String(delivery.title))}</li><li>时间：${escapeHtml(startsAtJst)}</li><li>地点：${escapeHtml(String(delivery.location || "未填写"))}</li></ul><p><a href="${escapeHtml(pageUrl)}">${pageLabel}</a></p>`,
        idempotencyKey: String(delivery.notificationKey),
      });
    } catch (error) {
      await connection.query(
        `UPDATE brand_bd_meeting_reminder_outbox
            SET status='manual_review',lastError=?,leaseToken=NULL,leaseUntil=NULL
          WHERE id=? AND leaseToken=?`,
        [
          `EMAIL_PROVIDER_THROW:${String((error as any)?.code || "UNKNOWN").slice(0, 120)}`,
          id,
          leaseToken,
        ]
      );
      return;
    }
    if (result.success) {
      await connection.query(
        `UPDATE brand_bd_meeting_reminder_outbox
            SET status='sent',provider=?,providerMessageId=?,sentAt=UTC_TIMESTAMP(),
                lastError=NULL,leaseToken=NULL,leaseUntil=NULL
          WHERE id=? AND leaseToken=?`,
        [result.provider || null, result.messageId || null, id, leaseToken]
      );
    } else {
      await connection.query(
        `UPDATE brand_bd_meeting_reminder_outbox
            SET status='failed',lastError=?,nextAttemptAt=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE),
                leaseToken=NULL,leaseUntil=NULL,deliveryStartedAt=NULL
          WHERE id=? AND leaseToken=?`,
        [
          String(result.errorCode || "EMAIL_DELIVERY_FAILED").slice(0, 500),
          id,
          leaseToken,
        ]
      );
    }
  } finally {
    connection.release();
  }
}

export async function runBrandBdMeetingReminderCycle() {
  if (running) return;
  running = true;
  try {
    await recoverExpiredLeases();
    await enqueueDueReminders();
    const claimed = await claimBatch();
    for (const id of claimed.ids) {
      await deliverOne(id, claimed.leaseToken);
    }
  } catch (error) {
    console.error("[BrandBDMeetingReminder] cycle failed", {
      code: String((error as any)?.code || "BRAND_BD_REMINDER_FAILED").slice(
        0,
        100
      ),
    });
  } finally {
    running = false;
  }
}

export function startBrandBdMeetingReminderScheduler() {
  if (timer) return timer;
  void runBrandBdMeetingReminderCycle();
  timer = setInterval(() => void runBrandBdMeetingReminderCycle(), 60_000);
  timer.unref?.();
  return timer;
}
