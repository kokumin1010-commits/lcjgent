/**
 * LIVE BOOTH Reservation Router
 * - Creator can reserve live streaming booths at the festival
 * - 16 booths: T1-T4, T13-T24
 * - 2 days: 2026-09-08, 2026-09-09
 * - Time slots: 10:00-11:00, 11:00-12:00, 12:00-13:00, 13:00-14:00, 14:00-15:00, 15:00-16:00, 16:00-17:00, 17:00-18:00
 */
import { router, publicProcedure, t } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mysql from "mysql2/promise";
import { verifyFestivalUserRequest, verifyFestivalAdminRequest } from "./festivalAuthRouter";
import { nanoid } from "nanoid";

let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

const festivalUserProcedure = t.procedure.use(async ({ ctx, next }) => {
  const user = await verifyFestivalUserRequest(ctx.req);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください" });
  return next({ ctx: { ...ctx, festivalUser: user } as any });
});

const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const admin = await verifyFestivalAdminRequest(ctx.req, (ctx as any).user);
  if (!admin) throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
  return next({ ctx: { ...ctx, lcfAdmin: admin } as any });
});

const BOOTHS = ["T1", "T2", "T3", "T4", "T13", "T14", "T15", "T16", "T17", "T18", "T19", "T20", "T21", "T22", "T23", "T24"];
const DATES = ["2026-09-08", "2026-09-09"];
const TIME_SLOTS_DAY1 = [
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
];
const TIME_SLOTS_DAY2 = [
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
];
function getTimeSlotsForDate(date: string) {
  return date === "2026-09-08" ? TIME_SLOTS_DAY1 : TIME_SLOTS_DAY2;
}
const ALL_TIME_SLOTS = [...new Set([...TIME_SLOTS_DAY1, ...TIME_SLOTS_DAY2])];

let _tableEnsured = false;
async function ensureTable() {
  if (_tableEnsured) return;
  const pool = getPool();
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
      status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_date_booth (date, boothId, timeSlot),
      INDEX idx_email (email),
      INDEX idx_reservationId (reservationId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
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
    INSERT IGNORE INTO lcf_booth_active_slots (boothId, date, timeSlot, accountId, reservationId)
    SELECT r.boothId, r.date, r.timeSlot, a.id, r.reservationId
    FROM lcf_booth_reservations r
    JOIN festival_accounts a ON LOWER(a.email) = LOWER(r.email)
    WHERE r.status = 'confirmed' AND a.account_type = 'liver' AND a.is_active = 1
  `);
  _tableEnsured = true;
}

export const boothReservationRouter = router({
  // Get availability for a specific date
  getAvailability: publicProcedure
    .input(z.object({ date: z.enum(["2026-09-08", "2026-09-09"]) }))
    .query(async ({ input }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT boothId, timeSlot, COUNT(*) as cnt FROM lcf_booth_reservations
         WHERE date = ? AND status = 'confirmed'
         GROUP BY boothId, timeSlot`,
        [input.date]
      ) as any;

      // Build availability map: { "T1_10:00-11:00": "reserved" }
      const reserved: Record<string, boolean> = {};
      for (const row of rows) {
        reserved[`${row.boothId}_${row.timeSlot}`] = true;
      }

      return {
        date: input.date,
        booths: BOOTHS,
        timeSlotsDay1: TIME_SLOTS_DAY1,
        timeSlotsDay2: TIME_SLOTS_DAY2,
        reserved,
      };
    }),

  // Get all availability for both days
  getAllAvailability: publicProcedure
    .query(async () => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT boothId, date, timeSlot, COUNT(*) as cnt FROM lcf_booth_reservations
         WHERE status = 'confirmed'
         GROUP BY boothId, date, timeSlot`
      ) as any;

      const reserved: Record<string, boolean> = {};
      for (const row of rows) {
        reserved[`${row.date}_${row.boothId}_${row.timeSlot}`] = true;
      }

      return {
        dates: DATES,
        booths: BOOTHS,
        timeSlotsDay1: TIME_SLOTS_DAY1,
        timeSlotsDay2: TIME_SLOTS_DAY2,
        reserved,
      };
    }),

  // Create a reservation
  createReservation: festivalUserProcedure
    .input(z.object({
      boothId: z.enum(["T1", "T2", "T3", "T4", "T13", "T14", "T15", "T16", "T17", "T18", "T19", "T20", "T21", "T22", "T23", "T24"]),
      date: z.enum(["2026-09-08", "2026-09-09"]),
      timeSlot: z.string().max(20),
      tiktokId: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(50).optional(),
      plannedProduct: z.string().trim().max(5000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureTable();
      const pool = getPool();

      const user = (ctx as any).festivalUser;
      if (user.accountType !== 'liver') {
        throw new TRPCError({ code: "FORBIDDEN", message: "LIVE BOOTHはライバー申込者のみ予約できます" });
      }
      if (!getTimeSlotsForDate(input.date).includes(input.timeSlot)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この日付では利用できない時間帯です" });
      }
      const [accountRows] = await pool.query(
        `SELECT display_name FROM festival_accounts WHERE id = ? AND LOWER(email) = ? LIMIT 1`,
        [user.accountId, user.email.toLowerCase()]
      ) as any;
      const creatorName = accountRows?.[0]?.display_name || user.email;
      const ownerEmail = user.email.toLowerCase();

      const connection = await pool.getConnection();
      const reservationId = `LB-${nanoid(8).toUpperCase()}`;
      try {
        await connection.beginTransaction();
        try {
          await connection.query(
            `INSERT INTO lcf_booth_active_slots (boothId, date, timeSlot, accountId, reservationId) VALUES (?, ?, ?, ?, ?)`,
            [input.boothId, input.date, input.timeSlot, Number(user.accountId), reservationId]
          );
        } catch (lockError: any) {
          if (lockError?.code === 'ER_DUP_ENTRY') {
            throw new TRPCError({ code: "CONFLICT", message: "このブース・時間帯は予約済み、または同じ時間帯に別の予約があります" });
          }
          throw lockError;
        }

        await connection.query(
          `INSERT INTO lcf_booth_reservations
           (reservationId, boothId, date, timeSlot, creatorName, tiktokId, email, phone, plannedProduct, accountId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [reservationId, input.boothId, input.date, input.timeSlot, creatorName, input.tiktokId || null, ownerEmail, input.phone || null, input.plannedProduct || null, String(user.accountId)]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }

      return { reservationId, boothId: input.boothId, date: input.date, timeSlot: input.timeSlot, creatorName };
    }),

  // Get reservation by ID
  getReservation: festivalUserProcedure
    .input(z.object({ reservationId: z.string().regex(/^LB-[A-Z0-9_-]{6,20}$/) }))
    .query(async ({ input, ctx }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT reservationId, boothId, date, timeSlot, creatorName, tiktokId, phone, plannedProduct, status, createdAt
         FROM lcf_booth_reservations WHERE reservationId = ? AND LOWER(email) = ?`,
        [input.reservationId, (ctx as any).festivalUser.email.toLowerCase()]
      ) as any;

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "予約が見つかりません" });
      }

      return rows[0];
    }),

  // Get reservations by email
  getMyReservations: festivalUserProcedure
    .query(async ({ ctx }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT reservationId, boothId, date, timeSlot, creatorName, tiktokId, phone, plannedProduct, status, createdAt
         FROM lcf_booth_reservations WHERE LOWER(email) = ? AND status = 'confirmed' ORDER BY date, timeSlot`,
        [(ctx as any).festivalUser.email.toLowerCase()]
      ) as any;
      return rows;
    }),

  // Cancel a reservation
  cancelReservation: festivalUserProcedure
    .input(z.object({ reservationId: z.string().regex(/^LB-[A-Z0-9_-]{6,20}$/) }))
    .mutation(async ({ input, ctx }) => {
      await ensureTable();
      const pool = getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `UPDATE lcf_booth_reservations SET status = 'cancelled' WHERE reservationId = ? AND LOWER(email) = ? AND status = 'confirmed'`,
          [input.reservationId, (ctx as any).festivalUser.email.toLowerCase()]
        ) as any;
        if (result.affectedRows === 0) throw new TRPCError({ code: "NOT_FOUND", message: "予約が見つかりません" });
        await connection.query('DELETE FROM lcf_booth_active_slots WHERE reservationId = ?', [input.reservationId]);
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }
    }),

  // Admin: cancel a reservation
  adminCancel: festivalAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const pool = getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
          `SELECT reservationId FROM lcf_booth_reservations WHERE id = ? AND status = 'confirmed' FOR UPDATE`,
          [input.id]
        ) as any;
        if (!rows?.length) throw new TRPCError({ code: "NOT_FOUND", message: "有効な予約が見つかりません" });
        await connection.query(`UPDATE lcf_booth_reservations SET status = 'cancelled' WHERE id = ?`, [input.id]);
        await connection.query('DELETE FROM lcf_booth_active_slots WHERE reservationId = ?', [rows[0].reservationId]);
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }
    }),

  // Admin: list all reservations
  listAll: festivalAdminProcedure
    .query(async ({ ctx }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT * FROM lcf_booth_reservations ORDER BY date, timeSlot, boothId`
      ) as any;
      return rows;
    }),
});
