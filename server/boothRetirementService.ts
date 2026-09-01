/**
 * LCF 2026 T1–T4 retirement workflow.
 * Preserves the existing dark/gold LCF admin system while making a destructive
 * production change recoverable, idempotent and auditable.
 */
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { sendEmail } from "./emailService";
import { ensureBoothReservationSchema, writeBoothAudit } from "./boothReservationService";

export const RETIRED_BOOTH_IDS = ["T1", "T2", "T3", "T4"] as const;
export const BOOTH_RETIREMENT_RUN_KEY = "lcf-2026-t1-t4-retirement-v1";
export const BOOTH_RETIREMENT_REASON = "booth_t1_t4_retired";
export const BOOTH_RETIREMENT_SUBJECT = "【重要】T1～T4ブースの仕様変更に伴う再予約のお願い";

const ACTIVE_STATUS_SQL = "('confirmed', 'checked_in')";
const LOCK_NAME = "lcj:lcf:booth-retirement:t1-t4:v1";

export function isRetiredBooth(value: string): value is (typeof RETIRED_BOOTH_IDS)[number] {
  return (RETIRED_BOOTH_IDS as readonly string[]).includes(value);
}

function getAuditSecret(): string {
  const secret = process.env.DB_BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error("booth retirement encryption secret is not configured");
  return secret;
}

function hashRecipient(email: string): string {
  return crypto.createHmac("sha256", getAuditSecret()).update(email.trim().toLowerCase()).digest("hex");
}

function encryptSnapshot(payload: unknown): { encrypted: Buffer; checksum: string } {
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const key = crypto.scryptSync(getAuditSecret(), "lcj-lcf-booth-retirement-v1", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encrypted = Buffer.concat([Buffer.from("LCFBR1", "ascii"), iv, authTag, ciphertext]);

  const header = encrypted.subarray(0, 6).toString("ascii");
  if (header !== "LCFBR1") throw new Error("booth retirement snapshot header verification failed");
  const verifyIv = encrypted.subarray(6, 18);
  const verifyTag = encrypted.subarray(18, 34);
  const verifyCiphertext = encrypted.subarray(34);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, verifyIv);
  decipher.setAuthTag(verifyTag);
  const roundTrip = Buffer.concat([decipher.update(verifyCiphertext), decipher.final()]);
  if (!crypto.timingSafeEqual(plaintext, roundTrip)) throw new Error("booth retirement snapshot round-trip failed");

  return { encrypted, checksum: crypto.createHash("sha256").update(encrypted).digest("hex") };
}

export function getBoothRetirementEmailContent(): { subject: string; text: string; html: string } {
  const text = `この度、皆様にご利用いただいております「T1～T4」のブースにつきまして、重要なお知らせとお願いがございます。

■ 該当ブースの仕様について
「T1～T4」の各ブースはライブ配信専用の設備ではないため、大変恐れ入りますが、ライブ配信目的でのご利用をいただくことができません。

■ システムの対応状況について
上記に伴い、運営事務局にてシステムの修正を行い、対象ブース（T1～T4）に関するデータの処理（修正・削除）をいたしました。

■ 既に該当ブースをご予約済みの配信者様へ
既に「T1～T4」ブースをご予約いただいていた配信者様におかれましては、システムのデータ削除に伴い、現在予約がキャンセルされた状態となっております。皆様には多大なるご不便とご迷惑をおかけし、誠に申し訳ございません。大変お手数をおかけいたしますが、ライブ配信でご利用の際は、改めて適切なブースへの再予約をお願い申し上げます。今後はより分かりやすいサービス運営に努めてまいります。何卒ご理解とご協力を賜りますよう、よろしくお願い申し上げます。`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;line-height:1.8;color:#1f2937;max-width:680px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#111827;margin:0 0 24px;">${BOOTH_RETIREMENT_SUBJECT}</h1>
    <p>この度、皆様にご利用いただいております「T1～T4」のブースにつきまして、重要なお知らせとお願いがございます。</p>
    <h2 style="font-size:16px;margin:28px 0 8px;">■ 該当ブースの仕様について</h2>
    <p>「T1～T4」の各ブースはライブ配信専用の設備ではないため、大変恐れ入りますが、ライブ配信目的でのご利用をいただくことができません。</p>
    <h2 style="font-size:16px;margin:28px 0 8px;">■ システムの対応状況について</h2>
    <p>上記に伴い、運営事務局にてシステムの修正を行い、対象ブース（T1～T4）に関するデータの処理（修正・削除）をいたしました。</p>
    <h2 style="font-size:16px;margin:28px 0 8px;">■ 既に該当ブースをご予約済みの配信者様へ</h2>
    <p>既に「T1～T4」ブースをご予約いただいていた配信者様におかれましては、システムのデータ削除に伴い、現在予約がキャンセルされた状態となっております。皆様には多大なるご不便とご迷惑をおかけし、誠に申し訳ございません。大変お手数をおかけいたしますが、ライブ配信でご利用の際は、改めて適切なブースへの再予約をお願い申し上げます。今後はより分かりやすいサービス運営に努めてまいります。何卒ご理解とご協力を賜りますよう、よろしくお願い申し上げます。</p>
    <p style="margin-top:32px;color:#6b7280;font-size:13px;">LIVE COMMERCE FESTIVAL 運営事務局</p>
  </div>`;
  return { subject: BOOTH_RETIREMENT_SUBJECT, text, html };
}

async function ensureRetirementSchema(pool: mysql.Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_retirement_runs (
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
    INDEX idx_lcf_booth_retirement_status (status, updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_retirement_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runKey VARCHAR(100) NOT NULL,
    encryptedPayload MEDIUMBLOB NOT NULL,
    checksum CHAR(64) NOT NULL,
    reservationCount INT NOT NULL,
    activeSlotCount INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_lcf_booth_retirement_snapshot_run (runKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_retirement_email_logs (
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
    UNIQUE KEY ux_lcf_booth_retirement_recipient (runKey, recipientHash),
    INDEX idx_lcf_booth_retirement_email_status (runKey, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function readImpact(pool: mysql.Pool) {
  const [summaryRows] = await pool.query<any[]>(
    `SELECT
       SUM(CASE WHEN status IN ${ACTIVE_STATUS_SQL} THEN 1 ELSE 0 END) AS activeReservationCount,
       COUNT(DISTINCT CASE WHEN status IN ${ACTIVE_STATUS_SQL} THEN LOWER(TRIM(email)) END) AS affectedRecipientCount,
       COUNT(*) AS totalHistoryCount
     FROM lcf_booth_reservations
     WHERE boothId IN (?)`,
    [RETIRED_BOOTH_IDS],
  );
  const [slotRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS activeSlotCount FROM lcf_booth_active_slots WHERE boothId IN (?)`,
    [RETIRED_BOOTH_IDS],
  );
  const [emailRows] = await pool.query<any[]>(
    `SELECT status, COUNT(*) AS count FROM lcf_booth_retirement_email_logs
      WHERE runKey = ? GROUP BY status`,
    [BOOTH_RETIREMENT_RUN_KEY],
  );
  const emailCounts = Object.fromEntries(emailRows.map((row) => [String(row.status), Number(row.count || 0)]));
  const summary = summaryRows[0] || {};
  return {
    activeReservationCount: Number(summary.activeReservationCount || 0),
    affectedRecipientCount: Number(summary.affectedRecipientCount || 0),
    totalHistoryCount: Number(summary.totalHistoryCount || 0),
    activeSlotCount: Number(slotRows[0]?.activeSlotCount || 0),
    emailPendingCount: Number(emailCounts.pending || 0),
    emailAcceptedCount: Number(emailCounts.accepted || 0),
    emailFailedCount: Number(emailCounts.failed || 0),
  };
}

export async function getBoothRetirementImpact(pool: mysql.Pool) {
  await ensureBoothReservationSchema(pool);
  await ensureRetirementSchema(pool);
  return readImpact(pool);
}

async function cancelRetiredBooths(pool: mysql.Pool, actorAccountId: string | number): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reservationRows] = await connection.query<any[]>(
      `SELECT * FROM lcf_booth_reservations
        WHERE boothId IN (?) AND status IN ${ACTIVE_STATUS_SQL}
        ORDER BY id FOR UPDATE`,
      [RETIRED_BOOTH_IDS],
    );
    const [slotRows] = await connection.query<any[]>(
      `SELECT * FROM lcf_booth_active_slots WHERE boothId IN (?) ORDER BY boothId, date, timeSlot FOR UPDATE`,
      [RETIRED_BOOTH_IDS],
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
      format: "lcf-booth-retirement-snapshot",
      version: 1,
      runKey: BOOTH_RETIREMENT_RUN_KEY,
      createdAt: new Date().toISOString(),
      reservations: reservationRows,
      activeSlots: slotRows,
    });
    const [snapshotResult] = await connection.query<any>(
      `INSERT INTO lcf_booth_retirement_snapshots
        (runKey, encryptedPayload, checksum, reservationCount, activeSlotCount)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [BOOTH_RETIREMENT_RUN_KEY, snapshot.encrypted, snapshot.checksum, reservationRows.length, slotRows.length],
    );
    const snapshotId = Number(snapshotResult.insertId);

    await connection.query(
      `INSERT INTO lcf_booth_retirement_runs
        (runKey, status, requestedByAccountId, snapshotId)
       VALUES (?, 'running', ?, ?)
       ON DUPLICATE KEY UPDATE requestedByAccountId = VALUES(requestedByAccountId), snapshotId = COALESCE(snapshotId, VALUES(snapshotId))`,
      [BOOTH_RETIREMENT_RUN_KEY, String(actorAccountId), snapshotId],
    );

    const now = new Date();
    for (const row of reservationRows) {
      await connection.query(
        `UPDATE lcf_booth_reservations
            SET status = 'cancelled', cancelledAt = ?, cancellationReason = ?, cancelledByAccountId = ?
          WHERE id = ? AND status IN ${ACTIVE_STATUS_SQL}`,
        [now, BOOTH_RETIREMENT_REASON, String(actorAccountId), row.id],
      );
      await writeBoothAudit(connection, {
        reservationId: String(row.reservationId),
        action: "retire_t1_t4_cancel_reservation",
        previousStatus: String(row.status),
        newStatus: "cancelled",
        actorType: "admin",
        actorAccountId,
        reason: "T1～T4ブース仕様変更による一括キャンセル",
        details: { runKey: BOOTH_RETIREMENT_RUN_KEY, boothId: row.boothId, date: row.date, timeSlot: row.timeSlot },
      });
    }
    const [deleteResult] = await connection.query<any>(
      `DELETE FROM lcf_booth_active_slots WHERE boothId IN (?)`,
      [RETIRED_BOOTH_IDS],
    );

    for (const recipient of recipients.values()) {
      const domain = recipient.email.split("@")[1]?.slice(0, 190) || null;
      await connection.query(
        `INSERT INTO lcf_booth_retirement_email_logs
          (runKey, recipientHash, recipientDomain, reservationCount, status)
         VALUES (?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE reservationCount = VALUES(reservationCount)`,
        [BOOTH_RETIREMENT_RUN_KEY, hashRecipient(recipient.email), domain, recipient.reservationCount],
      );
    }

    await connection.query(
      `UPDATE lcf_booth_retirement_runs
          SET status = 'notifications_pending', cancelledReservationCount = ?, affectedRecipientCount = ?,
              deletedActiveSlotCount = ?, lastError = NULL
        WHERE runKey = ?`,
      [reservationRows.length, recipients.size, Number(deleteResult.affectedRows || 0), BOOTH_RETIREMENT_RUN_KEY],
    );
    await connection.commit();
    console.log(`[LCF Booth Retirement] cancelled=${reservationRows.length} recipients=${recipients.size} slots=${Number(deleteResult.affectedRows || 0)}`);
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
      WHERE boothId IN (?) AND status = 'cancelled' AND cancellationReason = ?
      GROUP BY LOWER(TRIM(email))
      ORDER BY MIN(id)`,
    [RETIRED_BOOTH_IDS, BOOTH_RETIREMENT_REASON],
  );
  const content = getBoothRetirementEmailContent();

  for (const recipient of recipientRows) {
    const email = String(recipient.email || "").trim().toLowerCase();
    if (!email) continue;
    const recipientHash = hashRecipient(email);
    const [logRows] = await pool.query<any[]>(
      `SELECT status FROM lcf_booth_retirement_email_logs WHERE runKey = ? AND recipientHash = ? LIMIT 1`,
      [BOOTH_RETIREMENT_RUN_KEY, recipientHash],
    );
    if (logRows[0]?.status === "accepted") continue;

    let delivery: { success: boolean; provider?: string; messageId?: string; errorCode?: string };
    try {
      delivery = await sendEmail({ to: [email], subject: content.subject, content: content.text, html: content.html });
    } catch (error: any) {
      delivery = { success: false, errorCode: String(error?.code || error?.message || "send_exception").slice(0, 100) };
    }
    await pool.query(
      `UPDATE lcf_booth_retirement_email_logs
          SET status = ?, provider = ?, messageId = ?, errorCode = ?, attemptCount = attemptCount + 1,
              acceptedAt = CASE WHEN ? = 'accepted' THEN CURRENT_TIMESTAMP ELSE acceptedAt END
        WHERE runKey = ? AND recipientHash = ?`,
      [
        delivery.success ? "accepted" : "failed",
        delivery.provider || null,
        delivery.messageId || null,
        delivery.success ? null : (delivery.errorCode || "unknown_error"),
        delivery.success ? "accepted" : "failed",
        BOOTH_RETIREMENT_RUN_KEY,
        recipientHash,
      ],
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export async function retireT1T4Booths(pool: mysql.Pool, actorAccountId: string | number) {
  await ensureBoothReservationSchema(pool);
  await ensureRetirementSchema(pool);
  const [lockRows] = await pool.query<any[]>(`SELECT GET_LOCK(?, 10) AS acquired`, [LOCK_NAME]);
  if (Number(lockRows[0]?.acquired || 0) !== 1) throw new Error("T1～T4対応処理は別の管理者が実行中です");

  try {
    const impact = await readImpact(pool);
    if (impact.activeReservationCount > 0 || impact.activeSlotCount > 0) {
      await cancelRetiredBooths(pool, actorAccountId);
    }
    await sendPendingNotifications(pool);
    const result = await readImpact(pool);
    const finalStatus = result.emailFailedCount > 0 || result.emailPendingCount > 0 ? "notification_partial_failure" : "completed";
    await pool.query(
      `UPDATE lcf_booth_retirement_runs
          SET status = ?, emailAcceptedCount = ?, emailFailedCount = ?, completedAt = CURRENT_TIMESTAMP,
              lastError = CASE WHEN ? > 0 THEN 'notification_delivery_incomplete' ELSE NULL END
        WHERE runKey = ?`,
      [finalStatus, result.emailAcceptedCount, result.emailFailedCount, result.emailFailedCount + result.emailPendingCount, BOOTH_RETIREMENT_RUN_KEY],
    );
    console.log(`[LCF Booth Retirement] status=${finalStatus} accepted=${result.emailAcceptedCount} failed=${result.emailFailedCount} pending=${result.emailPendingCount}`);
    return { ...result, status: finalStatus };
  } finally {
    await pool.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]).catch(() => undefined);
  }
}
