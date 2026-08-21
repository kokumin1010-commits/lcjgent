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
import { verifyFestivalToken } from "./festivalAuthRouter";
import { nanoid } from "nanoid";

let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

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
  `).catch(() => {});
  _tableEnsured = true;
}

export const boothReservationRouter = router({
  // Get availability for a specific date
  getAvailability: publicProcedure
    .input(z.object({ date: z.string() }))
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
  createReservation: publicProcedure
    .input(z.object({
      boothId: z.string(),
      date: z.string(),
      timeSlot: z.string(),
      creatorName: z.string().min(1),
      tiktokId: z.string().optional(),
      email: z.string().email(),
      phone: z.string().optional(),
      plannedProduct: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const pool = getPool();

      // Validate booth and time slot
      if (!BOOTHS.includes(input.boothId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なブースIDです" });
      }
      if (!DATES.includes(input.date)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効な日付です" });
      }
      if (!ALL_TIME_SLOTS.includes(input.timeSlot)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効な時間帯です" });
      }

      // Check if already reserved
      const [existing] = await pool.query(
        `SELECT id FROM lcf_booth_reservations
         WHERE boothId = ? AND date = ? AND timeSlot = ? AND status = 'confirmed'`,
        [input.boothId, input.date, input.timeSlot]
      ) as any;

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "このブース・時間帯は既に予約済みです" });
      }

      // Check if same email already has a reservation for the same date/time
      const [emailCheck] = await pool.query(
        `SELECT id FROM lcf_booth_reservations
         WHERE email = ? AND date = ? AND timeSlot = ? AND status = 'confirmed'`,
        [input.email, input.date, input.timeSlot]
      ) as any;

      if (emailCheck.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "同じ時間帯に既に予約があります" });
      }

      const reservationId = `LB-${nanoid(8).toUpperCase()}`;

      await pool.query(
        `INSERT INTO lcf_booth_reservations
         (reservationId, boothId, date, timeSlot, creatorName, tiktokId, email, phone, plannedProduct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reservationId,
          input.boothId,
          input.date,
          input.timeSlot,
          input.creatorName,
          input.tiktokId || null,
          input.email,
          input.phone || null,
          input.plannedProduct || null,
        ]
      );

      return {
        reservationId,
        boothId: input.boothId,
        date: input.date,
        timeSlot: input.timeSlot,
        creatorName: input.creatorName,
      };
    }),

  // Get reservation by ID
  getReservation: publicProcedure
    .input(z.object({ reservationId: z.string() }))
    .query(async ({ input }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT * FROM lcf_booth_reservations WHERE reservationId = ?`,
        [input.reservationId]
      ) as any;

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "予約が見つかりません" });
      }

      return rows[0];
    }),

  // Get reservations by email
  getMyReservations: publicProcedure
    .input(z.object({ email: z.string() }))
    .query(async ({ input }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT * FROM lcf_booth_reservations WHERE email = ? AND status = 'confirmed' ORDER BY date, timeSlot`,
        [input.email]
      ) as any;
      return rows;
    }),

  // Cancel a reservation
  cancelReservation: publicProcedure
    .input(z.object({ reservationId: z.string(), email: z.string() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const pool = getPool();
      const [result] = await pool.query(
        `UPDATE lcf_booth_reservations SET status = 'cancelled' WHERE reservationId = ? AND email = ?`,
        [input.reservationId, input.email]
      ) as any;

      if (result.affectedRows === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "予約が見つかりません" });
      }

      return { success: true };
    }),

  // Admin: cancel a reservation
  adminCancel: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const pool = getPool();
      await pool.query(
        `UPDATE lcf_booth_reservations SET status = 'cancelled' WHERE id = ?`,
        [input.id]
      );
      return { success: true };
    }),

  // Admin: list all reservations
  listAll: publicProcedure
    .query(async ({ ctx }) => {
      await ensureTable();
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT * FROM lcf_booth_reservations ORDER BY date, timeSlot, boothId`
      ) as any;
      return rows;
    }),
});
