import type mysql from "mysql2/promise";
import {
  BOOTH_IDS,
  EVENT_DATES,
  getSlotBounds,
  getTimeSlotsForDate,
  shouldCompleteReservation,
} from "./boothReservationPolicy";

export const ACTIVE_BOOTH_STATUSES = ["confirmed", "checked_in"] as const;

let schemaPromise: Promise<void> | null = null;
const PRELAUNCH_RESET_KEY = "lcf-booth-prelaunch-reset-2026-08-28-v1";

async function columnExists(pool: mysql.Pool, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    `SELECT 1 AS present
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function indexExists(pool: mysql.Pool, tableName: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    `SELECT 1 AS present
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
      LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function ensureColumn(pool: mysql.Pool, tableName: string, columnName: string, definition: string): Promise<void> {
  if (await columnExists(pool, tableName, columnName)) return;
  try {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  }
}

async function ensureIndex(pool: mysql.Pool, tableName: string, indexName: string, columns: string): Promise<void> {
  if (await indexExists(pool, tableName, indexName)) return;
  try {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columns})`);
  } catch (error: any) {
    if (error?.code !== "ER_DUP_KEYNAME") throw error;
  }
}

async function backupAndResetPrelaunchReservations(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_booth_reset_runs (
      resetKey VARCHAR(100) PRIMARY KEY,
      reservationCount INT NOT NULL,
      activeSlotCount INT NOT NULL,
      auditCount INT NOT NULL,
      executedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_reservations_backup_20260828 LIKE lcf_booth_reservations`);
  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_active_slots_backup_20260828 LIKE lcf_booth_active_slots`);
  await pool.query(`CREATE TABLE IF NOT EXISTS lcf_booth_reservation_audit_logs_backup_20260828 LIKE lcf_booth_reservation_audit_logs`);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reservationCountRows] = await connection.query<any[]>(`SELECT COUNT(*) AS count FROM lcf_booth_reservations FOR UPDATE`);
    const [activeSlotCountRows] = await connection.query<any[]>(`SELECT COUNT(*) AS count FROM lcf_booth_active_slots FOR UPDATE`);
    const [auditCountRows] = await connection.query<any[]>(`SELECT COUNT(*) AS count FROM lcf_booth_reservation_audit_logs FOR UPDATE`);
    const reservationCount = Number(reservationCountRows[0]?.count || 0);
    const activeSlotCount = Number(activeSlotCountRows[0]?.count || 0);
    const auditCount = Number(auditCountRows[0]?.count || 0);

    const [claimResult] = await connection.query<any>(
      `INSERT IGNORE INTO lcf_booth_reset_runs (resetKey, reservationCount, activeSlotCount, auditCount)
       VALUES (?, ?, ?, ?)`,
      [PRELAUNCH_RESET_KEY, reservationCount, activeSlotCount, auditCount],
    );
    if (!claimResult.affectedRows) {
      await connection.rollback();
      return;
    }

    await connection.query(`INSERT INTO lcf_booth_reservations_backup_20260828 SELECT * FROM lcf_booth_reservations`);
    await connection.query(`INSERT INTO lcf_booth_active_slots_backup_20260828 SELECT * FROM lcf_booth_active_slots`);
    await connection.query(`INSERT INTO lcf_booth_reservation_audit_logs_backup_20260828 SELECT * FROM lcf_booth_reservation_audit_logs`);
    await connection.query(`DELETE FROM lcf_booth_reservation_audit_logs`);
    await connection.query(`DELETE FROM lcf_booth_active_slots`);
    await connection.query(`DELETE FROM lcf_booth_reservations`);
    await connection.commit();
    console.log(`[LCF booth reset] backed up and cleared reservations=${reservationCount}, activeSlots=${activeSlotCount}, audits=${auditCount}`);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

async function performSchemaUpgrade(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_booth_reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reservationId VARCHAR(20) NOT NULL UNIQUE,
      boothId VARCHAR(10) NOT NULL,
      date VARCHAR(10) NOT NULL,
      timeSlot VARCHAR(20) NOT NULL,
      creatorName VARCHAR(200) NOT NULL,
      tiktokId VARCHAR(200),
      email VARCHAR(200) NOT NULL,
      phone VARCHAR(50),
      plannedProduct TEXT,
      accountId VARCHAR(100),
      bookingType ENUM('advance', 'same_day') NOT NULL DEFAULT 'advance',
      status ENUM('confirmed', 'checked_in', 'completed', 'cancelled', 'auto_cancelled', 'invalidated') NOT NULL DEFAULT 'confirmed',
      slotStartAt BIGINT NULL,
      slotEndAt BIGINT NULL,
      checkinDeadlineAt BIGINT NULL,
      checkedInAt TIMESTAMP NULL,
      cancelledAt TIMESTAMP NULL,
      cancellationReason VARCHAR(100) NULL,
      cancelledByAccountId VARCHAR(100) NULL,
      parentAutoCancelledReservationId VARCHAR(20) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_date_booth (date, boothId, timeSlot),
      INDEX idx_email (email),
      INDEX idx_reservationId (reservationId),
      INDEX idx_booth_account_active (accountId, bookingType, status),
      INDEX idx_booth_deadline (status, checkinDeadlineAt),
      INDEX idx_booth_slot_status (date, timeSlot, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await ensureColumn(pool, "lcf_booth_reservations", "bookingType", "ENUM('advance', 'same_day') NOT NULL DEFAULT 'advance' AFTER accountId");
  await pool.query(
    `ALTER TABLE lcf_booth_reservations
       MODIFY COLUMN status ENUM('confirmed', 'checked_in', 'completed', 'cancelled', 'auto_cancelled', 'invalidated')
       NOT NULL DEFAULT 'confirmed'`,
  );
  await ensureColumn(pool, "lcf_booth_reservations", "slotStartAt", "BIGINT NULL AFTER status");
  await ensureColumn(pool, "lcf_booth_reservations", "slotEndAt", "BIGINT NULL AFTER slotStartAt");
  await ensureColumn(pool, "lcf_booth_reservations", "checkinDeadlineAt", "BIGINT NULL AFTER slotEndAt");
  await ensureColumn(pool, "lcf_booth_reservations", "checkedInAt", "TIMESTAMP NULL AFTER checkinDeadlineAt");
  await ensureColumn(pool, "lcf_booth_reservations", "cancelledAt", "TIMESTAMP NULL AFTER checkedInAt");
  await ensureColumn(pool, "lcf_booth_reservations", "cancellationReason", "VARCHAR(100) NULL AFTER cancelledAt");
  await ensureColumn(pool, "lcf_booth_reservations", "cancelledByAccountId", "VARCHAR(100) NULL AFTER cancellationReason");
  await ensureColumn(pool, "lcf_booth_reservations", "parentAutoCancelledReservationId", "VARCHAR(20) NULL AFTER cancelledByAccountId");

  await ensureIndex(pool, "lcf_booth_reservations", "idx_booth_account_active", "accountId, bookingType, status");
  await ensureIndex(pool, "lcf_booth_reservations", "idx_booth_deadline", "status, checkinDeadlineAt");
  await ensureIndex(pool, "lcf_booth_reservations", "idx_booth_slot_status", "date, timeSlot, status");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_booth_active_slots (
      boothId VARCHAR(10) NOT NULL,
      date VARCHAR(10) NOT NULL,
      timeSlot VARCHAR(20) NOT NULL,
      accountId INT NOT NULL,
      reservationId VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (boothId, date, timeSlot),
      UNIQUE KEY ux_booth_owner_time (accountId, date, timeSlot),
      UNIQUE KEY ux_booth_active_reservation (reservationId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_booth_reservation_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      reservationId VARCHAR(20) NOT NULL,
      action VARCHAR(100) NOT NULL,
      previousStatus VARCHAR(30) NULL,
      newStatus VARCHAR(30) NULL,
      actorType ENUM('creator', 'admin', 'system') NOT NULL,
      actorAccountId VARCHAR(100) NULL,
      reason VARCHAR(200) NULL,
      details JSON NULL,
      ipAddress VARCHAR(45) NULL,
      userAgent VARCHAR(500) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_booth_audit_reservation (reservationId, createdAt),
      INDEX idx_booth_audit_action (action, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const date of EVENT_DATES) {
    for (const timeSlot of getTimeSlotsForDate(date)) {
      const { start, end } = getSlotBounds(date, timeSlot);
      await pool.query(
        `UPDATE lcf_booth_reservations
            SET bookingType = COALESCE(bookingType, 'advance'),
                slotStartAt = COALESCE(slotStartAt, ?),
                slotEndAt = COALESCE(slotEndAt, ?),
                checkinDeadlineAt = COALESCE(checkinDeadlineAt, ?)
          WHERE date = ? AND timeSlot = ?`,
        [start.getTime(), end.getTime(), start.getTime() + 15 * 60_000, date, timeSlot],
      );
    }
  }

  await pool.query(`
    DELETE activeSlot
      FROM lcf_booth_active_slots activeSlot
      LEFT JOIN lcf_booth_reservations reservation
        ON reservation.reservationId = activeSlot.reservationId
     WHERE reservation.reservationId IS NULL
        OR reservation.status NOT IN ('confirmed', 'checked_in')
  `);

  await pool.query(`
    INSERT IGNORE INTO lcf_booth_active_slots (boothId, date, timeSlot, accountId, reservationId)
    SELECT reservation.boothId, reservation.date, reservation.timeSlot, account.id, reservation.reservationId
      FROM lcf_booth_reservations reservation
      JOIN festival_accounts account ON account.id = CAST(reservation.accountId AS UNSIGNED)
     WHERE reservation.status IN ('confirmed', 'checked_in')
       AND account.account_type = 'liver'
       AND account.is_active = 1
  `);

  await backupAndResetPrelaunchReservations(pool);
}

export async function ensureBoothReservationSchema(pool: mysql.Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = performSchemaUpgrade(pool).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export type BoothAuditInput = {
  reservationId: string;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  actorType: "creator" | "admin" | "system";
  actorAccountId?: string | number | null;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  req?: any;
};

export async function writeBoothAudit(connection: mysql.Pool | mysql.PoolConnection, input: BoothAuditInput): Promise<void> {
  const ipAddress = input.req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || input.req?.socket?.remoteAddress
    || null;
  const userAgent = input.req?.headers?.["user-agent"]?.slice(0, 500) || null;
  await connection.query(
    `INSERT INTO lcf_booth_reservation_audit_logs
      (reservationId, action, previousStatus, newStatus, actorType, actorAccountId, reason, details, ipAddress, userAgent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.reservationId,
      input.action,
      input.previousStatus ?? null,
      input.newStatus ?? null,
      input.actorType,
      input.actorAccountId == null ? null : String(input.actorAccountId),
      input.reason ?? null,
      input.details ? JSON.stringify(input.details) : null,
      ipAddress,
      userAgent,
    ],
  );
}

function autoCancelEnabled(): boolean {
  return process.env.LCF_BOOTH_AUTO_CANCEL_ENABLED !== "false";
}

export type BoothReconcileResult = {
  autoCancelled: number;
  invalidated: number;
  completed: number;
};

export async function reconcileBoothReservations(pool: mysql.Pool, now = new Date()): Promise<BoothReconcileResult> {
  await ensureBoothReservationSchema(pool);
  const result: BoothReconcileResult = { autoCancelled: 0, invalidated: 0, completed: 0 };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (autoCancelEnabled()) {
      const [expiredRows] = await connection.query<any[]>(
        `SELECT id, reservationId, accountId, date, timeSlot, slotStartAt
           FROM lcf_booth_reservations
          WHERE status = 'confirmed'
            AND checkinDeadlineAt IS NOT NULL
            AND checkinDeadlineAt <= ?
          ORDER BY checkinDeadlineAt
          LIMIT 200
          FOR UPDATE`,
        [now.getTime()],
      );

      for (const expired of expiredRows) {
        const [updateResult] = await connection.query<any>(
          `UPDATE lcf_booth_reservations
              SET status = 'auto_cancelled', cancelledAt = ?, cancellationReason = 'no_checkin_15_minutes'
            WHERE id = ? AND status = 'confirmed'`,
          [now, expired.id],
        );
        if (!updateResult.affectedRows) continue;

        await connection.query(`DELETE FROM lcf_booth_active_slots WHERE reservationId = ?`, [expired.reservationId]);
        await writeBoothAudit(connection, {
          reservationId: expired.reservationId,
          action: "auto_cancel_no_checkin",
          previousStatus: "confirmed",
          newStatus: "auto_cancelled",
          actorType: "system",
          reason: "開始15分後までにチェックインがありませんでした",
          details: { processedAt: now.toISOString() },
        });
        result.autoCancelled += 1;

        const [futureRows] = await connection.query<any[]>(
          `SELECT id, reservationId, slotStartAt
             FROM lcf_booth_reservations
            WHERE accountId = ?
              AND bookingType = 'advance'
              AND status = 'confirmed'
              AND slotStartAt > ?
            ORDER BY slotStartAt
            FOR UPDATE`,
          [String(expired.accountId), Number(expired.slotStartAt || 0)],
        );

        for (const future of futureRows) {
          const [invalidateResult] = await connection.query<any>(
            `UPDATE lcf_booth_reservations
                SET status = 'invalidated', cancelledAt = ?, cancellationReason = 'future_advance_invalidated_after_no_show',
                    parentAutoCancelledReservationId = ?
              WHERE id = ? AND status = 'confirmed'`,
            [now, expired.reservationId, future.id],
          );
          if (!invalidateResult.affectedRows) continue;
          await connection.query(`DELETE FROM lcf_booth_active_slots WHERE reservationId = ?`, [future.reservationId]);
          await writeBoothAudit(connection, {
            reservationId: future.reservationId,
            action: "invalidate_future_advance_after_no_show",
            previousStatus: "confirmed",
            newStatus: "invalidated",
            actorType: "system",
            reason: "無断キャンセルにより後続の事前予約を無効化",
            details: { sourceReservationId: expired.reservationId, processedAt: now.toISOString() },
          });
          result.invalidated += 1;
        }
      }
    }

    const [checkedInRows] = await connection.query<any[]>(
      `SELECT id, reservationId, date, timeSlot
         FROM lcf_booth_reservations
        WHERE status = 'checked_in'
          AND slotEndAt IS NOT NULL
          AND slotEndAt <= ?
        ORDER BY slotEndAt
        LIMIT 200
        FOR UPDATE`,
      [now.getTime()],
    );

    for (const checkedIn of checkedInRows) {
      if (!shouldCompleteReservation(checkedIn.date, checkedIn.timeSlot, now)) continue;
      const [completeResult] = await connection.query<any>(
        `UPDATE lcf_booth_reservations SET status = 'completed' WHERE id = ? AND status = 'checked_in'`,
        [checkedIn.id],
      );
      if (!completeResult.affectedRows) continue;
      await connection.query(`DELETE FROM lcf_booth_active_slots WHERE reservationId = ?`, [checkedIn.reservationId]);
      await writeBoothAudit(connection, {
        reservationId: checkedIn.reservationId,
        action: "complete_after_slot_end",
        previousStatus: "checked_in",
        newStatus: "completed",
        actorType: "system",
        reason: "予約時間が終了しました",
        details: { processedAt: now.toISOString() },
      });
      result.completed += 1;
    }

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

const RECONCILE_INTERVAL_MS = 60_000;
let schedulerStarted = false;
let schedulerTimer: NodeJS.Timeout | null = null;

function isNearEventWindow(now: Date): boolean {
  const firstStart = getSlotBounds(EVENT_DATES[0], getTimeSlotsForDate(EVENT_DATES[0])[0]).start.getTime();
  const finalSlots = getTimeSlotsForDate(EVENT_DATES[EVENT_DATES.length - 1]);
  const finalEnd = getSlotBounds(EVENT_DATES[EVENT_DATES.length - 1], finalSlots[finalSlots.length - 1]).end.getTime();
  return now.getTime() >= firstStart - 24 * 60 * 60_000 && now.getTime() <= finalEnd + 60 * 60_000;
}

export function startBoothReservationScheduler(pool: mysql.Pool): void {
  if (schedulerStarted || process.env.NODE_ENV === "test") return;
  schedulerStarted = true;

  const run = async () => {
    try {
      const now = new Date();
      if (isNearEventWindow(now)) {
        const result = await reconcileBoothReservations(pool, now);
        if (result.autoCancelled || result.invalidated || result.completed) {
          console.log("[LCF Booth] reconciliation", result);
        }
      }
    } catch (error) {
      console.error("[LCF Booth] reconciliation failed", error);
    } finally {
      schedulerTimer = setTimeout(run, RECONCILE_INTERVAL_MS);
      schedulerTimer.unref?.();
    }
  };

  void ensureBoothReservationSchema(pool)
    .then(run)
    .catch((error) => {
      console.error("[LCF Booth] schema initialization failed", error);
      schedulerTimer = setTimeout(run, RECONCILE_INTERVAL_MS);
      schedulerTimer.unref?.();
    });
}

export function resetBoothReservationServiceForTests(): void {
  schemaPromise = null;
  schedulerStarted = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
}

export function getConfiguredBooths(): readonly string[] {
  return BOOTH_IDS;
}
