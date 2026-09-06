/**
 * LCF 2026 Day2 LIVE配信ブース 17:00以降の閉鎖ワークフロー。
 * 既存予約を暗号化バックアップしてから一括取消し、重複なく案内します。
 */
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { sendEmail } from "./emailService";
import { ensureBoothReservationSchema, writeBoothAudit } from "./boothReservationService";

export const DAY2_CLOSE_DATE = "2026-09-09";
export const DAY2_CLOSED_TIME_SLOTS = ["17:00-18:00", "18:00-19:00"] as const;
export const DAY2_CLOSE_RUN_KEY = "lcf-2026-day2-after-1700-close-v1";
export const DAY2_CLOSE_REASON = "day2_after_1700_closed";
export const DAY2_CLOSE_SUBJECT = "【重要】9月9日17:00以降のLIVE配信ブース予約取消について";

const ACTIVE_STATUS_SQL = "('confirmed', 'checked_in')";
const LOCK_NAME = "lcj:lcf:booth-day2-close:2026-09-09-after-1700:v1";

function getAuditSecret(): string {
  const secret = process.env.DB_BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error("Day2 booth close encryption secret is not configured");
  return secret;
}

function hashRecipient(email: string): string {
  return crypto.createHmac("sha256", getAuditSecret()).update(email.trim().toLowerCase()).digest("hex");
}

function encryptSnapshot(payload: unknown): { encrypted: Buffer; checksum: string } {
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const key = crypto.scryptSync(getAuditSecret(), "lcj-lcf-booth-day2-close-v1", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encrypted = Buffer.concat([Buffer.from("LCFD21", "ascii"), iv, authTag, ciphertext]);

  const verifyIv = encrypted.subarray(6, 18);
  const verifyTag = encrypted.subarray(18, 34);
  const verifyCiphertext = encrypted.subarray(34);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, verifyIv);
  decipher.setAuthTag(verifyTag);
  const roundTrip = Buffer.concat([decipher.update(verifyCiphertext), decipher.final()]);
  if (!crypto.timingSafeEqual(plaintext, roundTrip)) throw new Error("Day2 booth close snapshot round-trip failed");

  return { encrypted, checksum: crypto.createHash("sha256").update(encrypted).digest("hex") };
}

export function getDay2CloseEmailContent(): { subject: string; text: string; html: string } {
  const text = `LIVE COMMERCE FESTIVAL 2026
LIVE配信ブースをご予約いただいた皆様へ

平素よりLIVE COMMERCE FESTIVAL 2026にご参加いただき、誠にありがとうございます。

9月9日（Day2）は17:00よりLIVE配信ブースエリアの撤収作業を開始するため、ブースをご利用いただける最終時間帯を「16:00～17:00」へ変更いたしました。

■ キャンセル対象
2026年9月9日（水）
・17:00～18:00
・18:00～19:00

上記時間帯のLIVE配信ブース予約は、運営事務局にてキャンセルいたしました。ご予約いただいていた皆様には、ご不便とご迷惑をおかけし、誠に申し訳ございません。

9月9日にLIVE配信ブースのご利用を希望される場合は、空き状況をご確認のうえ、16:00～17:00までの時間帯で改めてご予約ください。9月8日の予約時間帯に変更はありません。

マイページ
https://www.livecommercefestival.com/lcf/mypage

何卒ご理解とご協力を賜りますよう、よろしくお願い申し上げます。

LIVE COMMERCE FESTIVAL 運営事務局`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;line-height:1.8;color:#1f2937;max-width:680px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#111827;margin:0 0 24px;">${DAY2_CLOSE_SUBJECT}</h1>
    <p>LIVE COMMERCE FESTIVAL 2026<br>LIVE配信ブースをご予約いただいた皆様へ</p>
    <p>平素よりLIVE COMMERCE FESTIVAL 2026にご参加いただき、誠にありがとうございます。</p>
    <p><strong>9月9日（Day2）は17:00よりLIVE配信ブースエリアの撤収作業を開始するため、ブースをご利用いただける最終時間帯を「16:00～17:00」へ変更いたしました。</strong></p>
    <h2 style="font-size:16px;margin:28px 0 8px;">■ キャンセル対象</h2>
    <p>2026年9月9日（水）<br>・17:00～18:00<br>・18:00～19:00</p>
    <p>上記時間帯のLIVE配信ブース予約は、運営事務局にてキャンセルいたしました。ご予約いただいていた皆様には、ご不便とご迷惑をおかけし、誠に申し訳ございません。</p>
    <p>9月9日にLIVE配信ブースのご利用を希望される場合は、空き状況をご確認のうえ、16:00～17:00までの時間帯で改めてご予約ください。9月8日の予約時間帯に変更はありません。</p>
    <p style="margin:28px 0;"><a href="https://www.livecommercefestival.com/lcf/mypage" style="display:inline-block;background:#c9a96e;color:#111827;text-decoration:none;padding:12px 20px;font-weight:700;">マイページで空き状況を確認</a></p>
    <p>何卒ご理解とご協力を賜りますよう、よろしくお願い申し上げます。</p>
    <p style="margin-top:32px;color:#6b7280;font-size:13px;">LIVE COMMERCE FESTIVAL 運営事務局</p>
  </div>`;
  return { subject: DAY2_CLOSE_SUBJECT, text, html };
}

async function ensureDay2CloseSchema(pool: mysql.Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_day2_close_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runKey VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(40) NOT NULL,
    requestedByAccountId VARCHAR(100) NULL,
    snapshotId BIGINT NULL,
    cancelledReservationCount INT NOT NULL DEFAULT 0,
    affectedRecipientCount INT NOT NULL DEFAULT 0,
    deletedActiveSlotCount INT NOT NULL DEFAULT 0,
    emailAcceptedCount INT NOT NULL DEFAULT 0,
    emailFailedCount INT NOT NULL DEFAULT 0,
    lastError TEXT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lcf_booth_day2_close_status (status, updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_day2_close_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runKey VARCHAR(100) NOT NULL,
    encryptedPayload MEDIUMBLOB NOT NULL,
    checksum CHAR(64) NOT NULL,
    reservationCount INT NOT NULL,
    activeSlotCount INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_lcf_booth_day2_close_snapshot_run (runKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_day2_close_email_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runKey VARCHAR(100) NOT NULL,
    recipientHash CHAR(64) NOT NULL,
    recipientDomain VARCHAR(190) NULL,
    reservationCount INT NOT NULL DEFAULT 0,
    status ENUM('pending','accepted','failed') NOT NULL DEFAULT 'pending',
    provider VARCHAR(32) NULL,
    messageId VARCHAR(255) NULL,
    errorCode VARCHAR(100) NULL,
    attemptCount INT NOT NULL DEFAULT 0,
    acceptedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_lcf_booth_day2_close_recipient (runKey, recipientHash),
    INDEX idx_lcf_booth_day2_close_email_status (runKey, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function readImpact(pool: mysql.Pool) {
  const [summaryRows] = await pool.query<any[]>(
    `SELECT
       SUM(CASE WHEN status IN ${ACTIVE_STATUS_SQL} THEN 1 ELSE 0 END) AS activeReservationCount,
       COUNT(DISTINCT CASE WHEN status IN ${ACTIVE_STATUS_SQL} THEN LOWER(TRIM(email)) END) AS affectedRecipientCount,
       COUNT(*) AS totalHistoryCount
     FROM lcf_booth_reservations
     WHERE date = ? AND timeSlot IN (?)`,
    [DAY2_CLOSE_DATE, DAY2_CLOSED_TIME_SLOTS],
  );
  const [slotRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS activeSlotCount
       FROM lcf_booth_active_slots
      WHERE date = ? AND timeSlot IN (?)`,
    [DAY2_CLOSE_DATE, DAY2_CLOSED_TIME_SLOTS],
  );
  const [emailRows] = await pool.query<any[]>(
    `SELECT status, COUNT(*) AS count
       FROM lcf_booth_day2_close_email_logs
      WHERE runKey = ?
      GROUP BY status`,
    [DAY2_CLOSE_RUN_KEY],
  );
  const [runRows] = await pool.query<any[]>(
    `SELECT status, cancelledReservationCount, affectedRecipientCount, deletedActiveSlotCount
       FROM lcf_booth_day2_close_runs
      WHERE runKey = ?
      LIMIT 1`,
    [DAY2_CLOSE_RUN_KEY],
  );
  const emailCounts = Object.fromEntries(emailRows.map((row) => [String(row.status), Number(row.count || 0)]));
  const summary = summaryRows[0] || {};
  const run = runRows[0] || {};
  return {
    activeReservationCount: Number(summary.activeReservationCount || 0),
    affectedRecipientCount: Number(summary.affectedRecipientCount || 0),
    totalHistoryCount: Number(summary.totalHistoryCount || 0),
    activeSlotCount: Number(slotRows[0]?.activeSlotCount || 0),
    emailPendingCount: Number(emailCounts.pending || 0),
    emailAcceptedCount: Number(emailCounts.accepted || 0),
    emailFailedCount: Number(emailCounts.failed || 0),
    runStatus: run.status ? String(run.status) : null,
    cancelledReservationCount: Number(run.cancelledReservationCount || 0),
    processedRecipientCount: Number(run.affectedRecipientCount || 0),
    deletedActiveSlotCount: Number(run.deletedActiveSlotCount || 0),
  };
}

export async function getDay2CloseImpact(pool: mysql.Pool) {
  await ensureBoothReservationSchema(pool);
  await ensureDay2CloseSchema(pool);
  return readImpact(pool);
}

async function cancelDay2LateReservations(pool: mysql.Pool, actorAccountId: string | number): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reservationRows] = await connection.query<any[]>(
      `SELECT * FROM lcf_booth_reservations
        WHERE date = ? AND timeSlot IN (?) AND status IN ${ACTIVE_STATUS_SQL}
        ORDER BY id FOR UPDATE`,
      [DAY2_CLOSE_DATE, DAY2_CLOSED_TIME_SLOTS],
    );
    const [slotRows] = await connection.query<any[]>(
      `SELECT * FROM lcf_booth_active_slots
        WHERE date = ? AND timeSlot IN (?)
        ORDER BY boothId, timeSlot FOR UPDATE`,
      [DAY2_CLOSE_DATE, DAY2_CLOSED_TIME_SLOTS],
    );

    const recipients = new Map<string, { email: string; reservationCount: number }>();
    for (const row of reservationRows) {
      const email = String(row.email || "").trim().toLowerCase();
      if (!email) continue;
      const current = recipients.get(email) || { email, reservationCount: 0 };
      current.reservationCount += 1;
      recipients.set(email, current);
    }

    const snapshot = encryptSnapshot({
      format: "lcf-booth-day2-close-snapshot",
      version: 1,
      runKey: DAY2_CLOSE_RUN_KEY,
      createdAt: new Date().toISOString(),
      reservations: reservationRows,
      activeSlots: slotRows,
    });
    const [snapshotResult] = await connection.query<any>(
      `INSERT INTO lcf_booth_day2_close_snapshots
        (runKey, encryptedPayload, checksum, reservationCount, activeSlotCount)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [DAY2_CLOSE_RUN_KEY, snapshot.encrypted, snapshot.checksum, reservationRows.length, slotRows.length],
    );
    const snapshotId = Number(snapshotResult.insertId);

    await connection.query(
      `INSERT INTO lcf_booth_day2_close_runs
        (runKey, status, requestedByAccountId, snapshotId)
       VALUES (?, 'running', ?, ?)
       ON DUPLICATE KEY UPDATE requestedByAccountId = VALUES(requestedByAccountId), snapshotId = COALESCE(snapshotId, VALUES(snapshotId))`,
      [DAY2_CLOSE_RUN_KEY, String(actorAccountId), snapshotId],
    );

    const now = new Date();
    for (const row of reservationRows) {
      await connection.query(
        `UPDATE lcf_booth_reservations
            SET status = 'cancelled', cancelledAt = ?, cancellationReason = ?, cancelledByAccountId = ?
          WHERE id = ? AND status IN ${ACTIVE_STATUS_SQL}`,
        [now, DAY2_CLOSE_REASON, String(actorAccountId), row.id],
      );
      await writeBoothAudit(connection, {
        reservationId: String(row.reservationId),
        action: "day2_after_1700_cancel_reservation",
        previousStatus: String(row.status),
        newStatus: "cancelled",
        actorType: "admin",
        actorAccountId,
        reason: "9月9日17:00以降のLIVE配信ブース撤収対応",
        details: { runKey: DAY2_CLOSE_RUN_KEY, boothId: row.boothId, date: row.date, timeSlot: row.timeSlot },
      });
    }

    const [deleteResult] = await connection.query<any>(
      `DELETE FROM lcf_booth_active_slots WHERE date = ? AND timeSlot IN (?)`,
      [DAY2_CLOSE_DATE, DAY2_CLOSED_TIME_SLOTS],
    );

    for (const recipient of recipients.values()) {
      const domain = recipient.email.split("@")[1]?.slice(0, 190) || null;
      await connection.query(
        `INSERT INTO lcf_booth_day2_close_email_logs
          (runKey, recipientHash, recipientDomain, reservationCount, status)
         VALUES (?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE reservationCount = VALUES(reservationCount)`,
        [DAY2_CLOSE_RUN_KEY, hashRecipient(recipient.email), domain, recipient.reservationCount],
      );
    }

    await connection.query(
      `UPDATE lcf_booth_day2_close_runs
          SET status = 'notifications_pending', cancelledReservationCount = ?, affectedRecipientCount = ?,
              deletedActiveSlotCount = ?, lastError = NULL
        WHERE runKey = ?`,
      [reservationRows.length, recipients.size, Number(deleteResult.affectedRows || 0), DAY2_CLOSE_RUN_KEY],
    );
    await connection.commit();
    console.log(`[LCF Day2 Booth Close] cancelled=${reservationRows.length} recipients=${recipients.size} slots=${Number(deleteResult.affectedRows || 0)}`);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

async function sendPendingNotifications(pool: mysql.Pool): Promise<void> {
  const [recipientRows] = await pool.query<any[]>(
    `SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS reservationCount
       FROM lcf_booth_reservations
      WHERE date = ? AND timeSlot IN (?) AND status = 'cancelled' AND cancellationReason = ?
      GROUP BY LOWER(TRIM(email))
      ORDER BY MIN(id)`,
    [DAY2_CLOSE_DATE, DAY2_CLOSED_TIME_SLOTS, DAY2_CLOSE_REASON],
  );
  const content = getDay2CloseEmailContent();

  for (const recipient of recipientRows) {
    const email = String(recipient.email || "").trim().toLowerCase();
    if (!email) continue;
    const recipientHash = hashRecipient(email);
    const [logRows] = await pool.query<any[]>(
      `SELECT status FROM lcf_booth_day2_close_email_logs WHERE runKey = ? AND recipientHash = ? LIMIT 1`,
      [DAY2_CLOSE_RUN_KEY, recipientHash],
    );
    if (logRows[0]?.status === "accepted") continue;

    let delivery: { success: boolean; provider?: string; messageId?: string; errorCode?: string };
    try {
      delivery = await sendEmail({ to: [email], subject: content.subject, content: content.text, html: content.html });
    } catch (error: any) {
      delivery = { success: false, errorCode: String(error?.code || error?.message || "send_exception").slice(0, 100) };
    }
    await pool.query(
      `UPDATE lcf_booth_day2_close_email_logs
          SET status = ?, provider = ?, messageId = ?, errorCode = ?, attemptCount = attemptCount + 1,
              acceptedAt = CASE WHEN ? = 'accepted' THEN CURRENT_TIMESTAMP ELSE acceptedAt END
        WHERE runKey = ? AND recipientHash = ?`,
      [
        delivery.success ? "accepted" : "failed",
        delivery.provider || null,
        delivery.messageId || null,
        delivery.success ? null : (delivery.errorCode || "unknown_error"),
        delivery.success ? "accepted" : "failed",
        DAY2_CLOSE_RUN_KEY,
        recipientHash,
      ],
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export async function closeDay2LateBoothSlots(pool: mysql.Pool, actorAccountId: string | number) {
  await ensureBoothReservationSchema(pool);
  await ensureDay2CloseSchema(pool);
  const [lockRows] = await pool.query<any[]>(`SELECT GET_LOCK(?, 10) AS acquired`, [LOCK_NAME]);
  if (Number(lockRows[0]?.acquired || 0) !== 1) throw new Error("Day2撤収対応は別の管理者が実行中です");

  try {
    const impact = await readImpact(pool);
    if (impact.activeReservationCount > 0 || impact.activeSlotCount > 0) {
      await cancelDay2LateReservations(pool, actorAccountId);
    }
    await sendPendingNotifications(pool);
    const result = await readImpact(pool);
    const finalStatus = result.emailFailedCount > 0 || result.emailPendingCount > 0 ? "notification_partial_failure" : "completed";
    await pool.query(
      `UPDATE lcf_booth_day2_close_runs
          SET status = ?, emailAcceptedCount = ?, emailFailedCount = ?, completedAt = CURRENT_TIMESTAMP,
              lastError = CASE WHEN ? > 0 THEN 'notification_delivery_incomplete' ELSE NULL END
        WHERE runKey = ?`,
      [finalStatus, result.emailAcceptedCount, result.emailFailedCount, result.emailFailedCount + result.emailPendingCount, DAY2_CLOSE_RUN_KEY],
    );
    console.log(`[LCF Day2 Booth Close] status=${finalStatus} accepted=${result.emailAcceptedCount} failed=${result.emailFailedCount} pending=${result.emailPendingCount}`);
    return { ...result, status: finalStatus, runStatus: finalStatus };
  } finally {
    await pool.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]).catch(() => undefined);
  }
}
