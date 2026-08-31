import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import mysql from "mysql2/promise";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router, t } from "./_core/trpc";
import { verifyFestivalAdminRequest, verifyFestivalUserRequest } from "./festivalAuthRouter";
import {
  ADVANCE_BOOKING_LIMIT,
  BOOTH_IDS,
  canCheckIn,
  decideBookingWindow,
  EVENT_DATES,
  getBookingOpensAt,
  getTimeSlotsForDate,
  isValidTimeSlot,
  violatesRequiredInterval,
} from "./boothReservationPolicy";
import {
  ensureBoothReservationSchema,
  reconcileBoothReservations,
  startBoothReservationScheduler,
  writeBoothAudit,
} from "./boothReservationService";

let pool: mysql.Pool | null = null;
export function getBoothReservationPool(): mysql.Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for booth reservations");
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
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

const boothIdSchema = z.enum(BOOTH_IDS);
const eventDateSchema = z.enum(EVENT_DATES);
const reservationIdSchema = z.string().regex(/^LB-[A-Z0-9_-]{6,20}$/);
const ACTIVE_STATUS_SQL = "('confirmed', 'checked_in')";
const PUBLIC_CHECKIN_BASE_URL = "https://www.livecommercefestival.com/lcf/booth-checkin";

function checkinSecret(): string {
  const localFallback = process.env.NODE_ENV === "production" ? "" : "local-development-booth-checkin-secret-change-me";
  const secret = process.env.LCF_BOOTH_CHECKIN_SECRET || process.env.JWT_SECRET || localFallback;
  if (!secret || secret.length < 32) throw new Error("LCF booth check-in secret is not configured");
  return secret;
}

export function createBoothQrToken(boothId: string): string {
  return createHmac("sha256", checkinSecret()).update(`lcf-booth-checkin:v1:${boothId}`).digest("base64url");
}

export function verifyBoothQrToken(boothId: string, token: string): boolean {
  if (!BOOTH_IDS.includes(boothId as any) || !token || token.length > 200) return false;
  const expected = Buffer.from(createBoothQrToken(boothId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function requireLiver(user: { accountType: string }): void {
  if (user.accountType !== "liver") {
    throw new TRPCError({ code: "FORBIDDEN", message: "LIVE配信ブースはライバー申込者のみ利用できます" });
  }
}

function bookingWindowError(decision: ReturnType<typeof decideBookingWindow>): TRPCError {
  if (decision.allowed) return new TRPCError({ code: "BAD_REQUEST", message: "予約条件を確認できませんでした" });
  if (decision.reason === "BEFORE_GLOBAL_OPEN") {
    return new TRPCError({ code: "BAD_REQUEST", message: "予約受付は日本時間2026年8月28日21:00から開始します" });
  }
  if (decision.reason === "SAME_DAY_NOT_OPEN") {
    return new TRPCError({ code: "BAD_REQUEST", message: "当日枠は各時間帯の開始15分前から、ブース前のQRコードで予約できます" });
  }
  if (decision.reason === "PAST_SLOT") {
    return new TRPCError({ code: "BAD_REQUEST", message: "この時間帯の予約受付は終了しました" });
  }
  return new TRPCError({ code: "BAD_REQUEST", message: "この日付では利用できない時間帯です" });
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "予約確定",
    checked_in: "チェックイン済み",
    completed: "利用完了",
    cancelled: "キャンセル",
    auto_cancelled: "15分未チェックインで自動キャンセル",
    invalidated: "無断キャンセルにより無効",
  };
  return labels[status] || status;
}

async function reconcileBeforeRead(): Promise<void> {
  const reservationPool = getBoothReservationPool();
  await ensureBoothReservationSchema(reservationPool);
  await reconcileBoothReservations(reservationPool);
}

function buildBookingWindows(now: Date) {
  const windows: Record<string, {
    mode: "advance" | "same_day" | "not_open" | "closed";
    sameDayOpensAt: number | null;
    slotStartAt: number | null;
    slotEndAt: number | null;
  }> = {};

  for (const date of EVENT_DATES) {
    for (const timeSlot of getTimeSlotsForDate(date)) {
      const decision = decideBookingWindow(date, timeSlot, now);
      const key = `${date}_${timeSlot}`;
      if (decision.allowed) {
        windows[key] = {
          mode: decision.bookingType,
          sameDayOpensAt: decision.sameDayOpensAt.getTime(),
          slotStartAt: decision.slotStart.getTime(),
          slotEndAt: decision.slotEnd.getTime(),
        };
      } else {
        windows[key] = {
          mode: decision.reason === "SAME_DAY_NOT_OPEN" || decision.reason === "BEFORE_GLOBAL_OPEN" ? "not_open" : "closed",
          sameDayOpensAt: decision.sameDayOpensAt?.getTime() ?? null,
          slotStartAt: decision.slotStart?.getTime() ?? null,
          slotEndAt: decision.slotEnd?.getTime() ?? null,
        };
      }
    }
  }
  return windows;
}

function identifyGuidelineConflicts(rows: any[]): Map<number, string[]> {
  const conflicts = new Map<number, Set<string>>();
  const activeRows = rows.filter((row) => row.status === "confirmed" || row.status === "checked_in");
  const byAccount = new Map<string, any[]>();

  for (const row of activeRows) {
    const accountKey = String(row.accountId ?? "");
    if (!accountKey) continue;
    const list = byAccount.get(accountKey) ?? [];
    list.push(row);
    byAccount.set(accountKey, list);
  }

  const addConflict = (id: number, conflict: string) => {
    const set = conflicts.get(id) ?? new Set<string>();
    set.add(conflict);
    conflicts.set(id, set);
  };

  for (const accountRows of byAccount.values()) {
    const advanceRows = accountRows.filter((row) => row.bookingType === "advance");
    if (advanceRows.length > ADVANCE_BOOKING_LIMIT) {
      for (const row of advanceRows) addConflict(row.id, "既存の事前予約が2枠を超過");
    }
    for (let index = 0; index < accountRows.length; index += 1) {
      for (let compare = index + 1; compare < accountRows.length; compare += 1) {
        const first = accountRows[index];
        const second = accountRows[compare];
        if (violatesRequiredInterval(first.date, first.timeSlot, second.date, second.timeSlot)) {
          addConflict(first.id, "既存予約が連続利用ルールに抵触");
          addConflict(second.id, "既存予約が連続利用ルールに抵触");
        }
      }
    }
  }

  return new Map(Array.from(conflicts.entries()).map(([id, values]) => [id, Array.from(values)]));
}

export const boothReservationRouter = router({
  getAvailability: publicProcedure
    .input(z.object({ date: eventDateSchema }))
    .query(async ({ input }) => {
      await reconcileBeforeRead();
      const reservationPool = getBoothReservationPool();
      const [rows] = await reservationPool.query<any[]>(
        `SELECT boothId, timeSlot, COUNT(*) AS cnt
           FROM lcf_booth_reservations
          WHERE date = ? AND status IN ${ACTIVE_STATUS_SQL}
          GROUP BY boothId, timeSlot`,
        [input.date],
      );
      const reserved: Record<string, boolean> = {};
      for (const row of rows) reserved[`${row.boothId}_${row.timeSlot}`] = true;
      const now = new Date();
      return {
        date: input.date,
        booths: BOOTH_IDS,
        timeSlotsDay1: getTimeSlotsForDate("2026-09-08"),
        timeSlotsDay2: getTimeSlotsForDate("2026-09-09"),
        reserved,
        bookingWindows: buildBookingWindows(now),
        serverNow: now.getTime(),
        bookingOpensAt: getBookingOpensAt().getTime(),
      };
    }),

  getAllAvailability: publicProcedure.query(async () => {
    await reconcileBeforeRead();
    const reservationPool = getBoothReservationPool();
    const [rows] = await reservationPool.query<any[]>(
      `SELECT boothId, date, timeSlot, COUNT(*) AS cnt
         FROM lcf_booth_reservations
        WHERE status IN ${ACTIVE_STATUS_SQL}
        GROUP BY boothId, date, timeSlot`,
    );
    const reserved: Record<string, boolean> = {};
    for (const row of rows) reserved[`${row.date}_${row.boothId}_${row.timeSlot}`] = true;
    const now = new Date();
    return {
      dates: EVENT_DATES,
      booths: BOOTH_IDS,
      timeSlotsDay1: getTimeSlotsForDate("2026-09-08"),
      timeSlotsDay2: getTimeSlotsForDate("2026-09-09"),
      reserved,
      bookingWindows: buildBookingWindows(now),
      serverNow: now.getTime(),
      bookingOpensAt: getBookingOpensAt().getTime(),
    };
  }),

  createReservation: festivalUserProcedure
    .input(z.object({
      boothId: boothIdSchema,
      date: eventDateSchema,
      timeSlot: z.string().max(20),
      tiktokId: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(50).optional(),
      plannedProduct: z.string().trim().max(5000).optional(),
      boothQrToken: z.string().max(200).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = (ctx as any).festivalUser as { accountId: number; email: string; accountType: string };
      requireLiver(user);
      if (!isValidTimeSlot(input.date, input.timeSlot)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この日付では利用できない時間帯です" });
      }

      const now = new Date();
      const decision = decideBookingWindow(input.date, input.timeSlot, now);
      if (!decision.allowed) throw bookingWindowError(decision);
      if (decision.bookingType === "same_day" && !verifyBoothQrToken(input.boothId, input.boothQrToken || "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "当日枠は対象ブース前のQRコードから予約してください" });
      }

      const reservationPool = getBoothReservationPool();
      await ensureBoothReservationSchema(reservationPool);
      await reconcileBoothReservations(reservationPool, now);
      const connection = await reservationPool.getConnection();
      const reservationId = `LB-${nanoid(8).toUpperCase()}`;

      try {
        await connection.beginTransaction();
        const [accountRows] = await connection.query<any[]>(
          `SELECT id, display_name, email, account_type, is_active
             FROM festival_accounts
            WHERE id = ?
            LIMIT 1
            FOR UPDATE`,
          [user.accountId],
        );
        const account = accountRows[0];
        if (!account || !account.is_active || account.account_type !== "liver" || String(account.email).toLowerCase() !== user.email.toLowerCase()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "有効なライバーアカウントを確認できません" });
        }

        const [existingRows] = await connection.query<any[]>(
          `SELECT reservationId, date, timeSlot, bookingType, status
             FROM lcf_booth_reservations
            WHERE accountId = ? AND status IN ${ACTIVE_STATUS_SQL}
            ORDER BY slotStartAt
            FOR UPDATE`,
          [String(user.accountId)],
        );

        if (decision.bookingType === "advance") {
          const advanceCount = existingRows.filter((row) => row.bookingType === "advance").length;
          if (advanceCount >= ADVANCE_BOOKING_LIMIT) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "事前予約は9月8日・9日の合計で、お一人様2枠までです" });
          }
        }

        const intervalConflict = existingRows.find((row) =>
          violatesRequiredInterval(row.date, row.timeSlot, input.date, input.timeSlot),
        );
        if (intervalConflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "連続利用はできません。予約済み枠との間に1枠分（1時間）以上空けてください",
          });
        }

        try {
          await connection.query(
            `INSERT INTO lcf_booth_active_slots (boothId, date, timeSlot, accountId, reservationId)
             VALUES (?, ?, ?, ?, ?)`,
            [input.boothId, input.date, input.timeSlot, Number(user.accountId), reservationId],
          );
        } catch (lockError: any) {
          if (lockError?.code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "このブース・時間帯は予約済み、または同じ時間帯に別の予約があります" });
          }
          throw lockError;
        }

        await connection.query(
          `INSERT INTO lcf_booth_reservations
            (reservationId, boothId, date, timeSlot, creatorName, tiktokId, email, phone, plannedProduct,
             accountId, bookingType, status, slotStartAt, slotEndAt, checkinDeadlineAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
          [
            reservationId,
            input.boothId,
            input.date,
            input.timeSlot,
            account.display_name || user.email,
            input.tiktokId || null,
            user.email.toLowerCase(),
            input.phone || null,
            input.plannedProduct || null,
            String(user.accountId),
            decision.bookingType,
            decision.slotStart.getTime(),
            decision.slotEnd.getTime(),
            decision.checkinDeadlineAt.getTime(),
          ],
        );
        await writeBoothAudit(connection, {
          reservationId,
          action: "create_reservation",
          previousStatus: null,
          newStatus: "confirmed",
          actorType: "creator",
          actorAccountId: user.accountId,
          reason: decision.bookingType === "advance" ? "事前予約" : "当日枠予約",
          details: { boothId: input.boothId, date: input.date, timeSlot: input.timeSlot, bookingType: decision.bookingType },
          req: (ctx as any).req,
        });
        await connection.commit();

        return {
          reservationId,
          boothId: input.boothId,
          date: input.date,
          timeSlot: input.timeSlot,
          creatorName: account.display_name || user.email,
          bookingType: decision.bookingType,
          checkinDeadlineAt: decision.checkinDeadlineAt.getTime(),
        };
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }),

  getReservation: festivalUserProcedure
    .input(z.object({ reservationId: reservationIdSchema }))
    .query(async ({ input, ctx }) => {
      await reconcileBeforeRead();
      const reservationPool = getBoothReservationPool();
      const [rows] = await reservationPool.query<any[]>(
        `SELECT reservationId, boothId, date, timeSlot, creatorName, tiktokId, phone, plannedProduct,
                bookingType, status, slotStartAt, slotEndAt, checkinDeadlineAt, checkedInAt,
                cancelledAt, cancellationReason, createdAt
           FROM lcf_booth_reservations
          WHERE reservationId = ? AND accountId = ?`,
        [input.reservationId, String((ctx as any).festivalUser.accountId)],
      );
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "予約が見つかりません" });
      return { ...rows[0], statusLabel: statusLabel(rows[0].status) };
    }),

  getMyReservations: festivalUserProcedure.query(async ({ ctx }) => {
    await reconcileBeforeRead();
    const reservationPool = getBoothReservationPool();
    const [rows] = await reservationPool.query<any[]>(
      `SELECT reservationId, boothId, date, timeSlot, creatorName, tiktokId, phone, plannedProduct,
              bookingType, status, slotStartAt, slotEndAt, checkinDeadlineAt, checkedInAt,
              cancelledAt, cancellationReason, parentAutoCancelledReservationId, createdAt
         FROM lcf_booth_reservations
        WHERE accountId = ?
        ORDER BY slotStartAt, createdAt`,
      [String((ctx as any).festivalUser.accountId)],
    );
    return rows.map((row) => ({ ...row, statusLabel: statusLabel(row.status) }));
  }),

  cancelReservation: festivalUserProcedure
    .input(z.object({ reservationId: reservationIdSchema }))
    .mutation(async ({ input, ctx }) => {
      const reservationPool = getBoothReservationPool();
      await ensureBoothReservationSchema(reservationPool);
      const connection = await reservationPool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<any[]>(
          `SELECT reservationId, status
             FROM lcf_booth_reservations
            WHERE reservationId = ? AND accountId = ?
            LIMIT 1
            FOR UPDATE`,
          [input.reservationId, String((ctx as any).festivalUser.accountId)],
        );
        const reservation = rows[0];
        if (!reservation) throw new TRPCError({ code: "NOT_FOUND", message: "予約が見つかりません" });
        if (reservation.status !== "confirmed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "この予約はキャンセルできる状態ではありません" });
        }
        const now = new Date();
        await connection.query(
          `UPDATE lcf_booth_reservations
              SET status = 'cancelled', cancelledAt = ?, cancellationReason = 'creator_cancelled', cancelledByAccountId = ?
            WHERE reservationId = ? AND status = 'confirmed'`,
          [now, String((ctx as any).festivalUser.accountId), input.reservationId],
        );
        await connection.query(`DELETE FROM lcf_booth_active_slots WHERE reservationId = ?`, [input.reservationId]);
        await writeBoothAudit(connection, {
          reservationId: input.reservationId,
          action: "creator_cancel_reservation",
          previousStatus: "confirmed",
          newStatus: "cancelled",
          actorType: "creator",
          actorAccountId: (ctx as any).festivalUser.accountId,
          reason: "本人によるキャンセル",
          req: (ctx as any).req,
        });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }),

  getBoothQrContext: festivalUserProcedure
    .input(z.object({ boothId: boothIdSchema, token: z.string().max(200) }))
    .query(async ({ input, ctx }) => {
      const user = (ctx as any).festivalUser as { accountId: number; accountType: string };
      requireLiver(user);
      if (!verifyBoothQrToken(input.boothId, input.token)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "無効なブースQRコードです" });
      }
      await reconcileBeforeRead();
      const reservationPool = getBoothReservationPool();
      const [rows] = await reservationPool.query<any[]>(
        `SELECT reservationId, boothId, date, timeSlot, bookingType, status, slotStartAt, slotEndAt,
                checkinDeadlineAt, checkedInAt
           FROM lcf_booth_reservations
          WHERE accountId = ? AND boothId = ? AND status IN ${ACTIVE_STATUS_SQL}
          ORDER BY slotStartAt`,
        [String(user.accountId), input.boothId],
      );
      const now = new Date();
      const checkinReservation = rows.find((row) => canCheckIn(row.date, row.timeSlot, now).allowed) || null;
      const bookingWindows = buildBookingWindows(now);
      return {
        boothId: input.boothId,
        serverNow: now.getTime(),
        checkinReservation: checkinReservation
          ? { ...checkinReservation, statusLabel: statusLabel(checkinReservation.status) }
          : null,
        bookingWindows,
      };
    }),

  performCheckin: festivalUserProcedure
    .input(z.object({ boothId: boothIdSchema, token: z.string().max(200) }))
    .mutation(async ({ input, ctx }) => {
      const user = (ctx as any).festivalUser as { accountId: number; accountType: string };
      requireLiver(user);
      if (!verifyBoothQrToken(input.boothId, input.token)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "無効なブースQRコードです" });
      }

      const reservationPool = getBoothReservationPool();
      await ensureBoothReservationSchema(reservationPool);
      const now = new Date();
      await reconcileBoothReservations(reservationPool, now);
      const connection = await reservationPool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<any[]>(
          `SELECT id, reservationId, date, timeSlot, status, checkinDeadlineAt, checkedInAt
             FROM lcf_booth_reservations
            WHERE accountId = ? AND boothId = ? AND status IN ${ACTIVE_STATUS_SQL}
            ORDER BY slotStartAt
            FOR UPDATE`,
          [String(user.accountId), input.boothId],
        );
        const reservation = rows.find((row) => canCheckIn(row.date, row.timeSlot, now).allowed);
        if (!reservation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "このブースで現在チェックインできる予約がありません" });
        }
        if (reservation.status === "checked_in") {
          await connection.commit();
          return {
            success: true,
            alreadyCheckedIn: true,
            reservationId: reservation.reservationId,
            date: reservation.date,
            timeSlot: reservation.timeSlot,
            boothId: input.boothId,
            checkedInAt: reservation.checkedInAt,
          };
        }
        if (Number(reservation.checkinDeadlineAt) <= now.getTime()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "チェックイン期限を過ぎたため予約は自動キャンセルされました" });
        }
        await connection.query(
          `UPDATE lcf_booth_reservations SET status = 'checked_in', checkedInAt = ? WHERE id = ? AND status = 'confirmed'`,
          [now, reservation.id],
        );
        await writeBoothAudit(connection, {
          reservationId: reservation.reservationId,
          action: "booth_checkin",
          previousStatus: "confirmed",
          newStatus: "checked_in",
          actorType: "creator",
          actorAccountId: user.accountId,
          reason: "ブースQRコードによるセルフチェックイン",
          details: { boothId: input.boothId, checkedInAt: now.toISOString() },
          req: (ctx as any).req,
        });
        await connection.commit();
        return {
          success: true,
          alreadyCheckedIn: false,
          reservationId: reservation.reservationId,
          date: reservation.date,
          timeSlot: reservation.timeSlot,
          boothId: input.boothId,
          checkedInAt: now,
        };
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }),

  adminCancel: festivalAdminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().trim().max(200).optional() }))
    .mutation(async ({ input, ctx }) => {
      const reservationPool = getBoothReservationPool();
      await ensureBoothReservationSchema(reservationPool);
      const connection = await reservationPool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<any[]>(
          `SELECT reservationId, status FROM lcf_booth_reservations WHERE id = ? LIMIT 1 FOR UPDATE`,
          [input.id],
        );
        const reservation = rows[0];
        if (!reservation || !["confirmed", "checked_in"].includes(reservation.status)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "有効な予約が見つかりません" });
        }
        const now = new Date();
        await connection.query(
          `UPDATE lcf_booth_reservations
              SET status = 'cancelled', cancelledAt = ?, cancellationReason = 'admin_cancelled', cancelledByAccountId = ?
            WHERE id = ? AND status IN ${ACTIVE_STATUS_SQL}`,
          [now, String((ctx as any).lcfAdmin.id), input.id],
        );
        await connection.query(`DELETE FROM lcf_booth_active_slots WHERE reservationId = ?`, [reservation.reservationId]);
        await writeBoothAudit(connection, {
          reservationId: reservation.reservationId,
          action: "admin_cancel_reservation",
          previousStatus: reservation.status,
          newStatus: "cancelled",
          actorType: "admin",
          actorAccountId: (ctx as any).lcfAdmin.id,
          reason: input.reason || "管理者によるキャンセル",
          req: (ctx as any).req,
        });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }),

  listAll: festivalAdminProcedure.query(async () => {
    await reconcileBeforeRead();
    const reservationPool = getBoothReservationPool();
    const [rows] = await reservationPool.query<any[]>(
      `SELECT *, UNIX_TIMESTAMP(createdAt) * 1000 AS createdAtMs
         FROM lcf_booth_reservations
        ORDER BY createdAt DESC, id DESC`,
    );
    const conflicts = identifyGuidelineConflicts(rows);
    return rows.map((row) => ({
      ...row,
      statusLabel: statusLabel(row.status),
      guidelineConflicts: conflicts.get(row.id) || [],
    }));
  }),

  listAuditLogs: festivalAdminProcedure
    .input(z.object({ reservationId: reservationIdSchema.optional(), limit: z.number().int().min(1).max(500).default(200) }).optional())
    .query(async ({ input }) => {
      const reservationPool = getBoothReservationPool();
      await ensureBoothReservationSchema(reservationPool);
      if (input?.reservationId) {
        const [rows] = await reservationPool.query<any[]>(
          `SELECT * FROM lcf_booth_reservation_audit_logs WHERE reservationId = ? ORDER BY id DESC LIMIT ?`,
          [input.reservationId, input.limit],
        );
        return rows;
      }
      const [rows] = await reservationPool.query<any[]>(
        `SELECT * FROM lcf_booth_reservation_audit_logs ORDER BY id DESC LIMIT ?`,
        [input?.limit ?? 200],
      );
      return rows;
    }),

  getCheckinQrCodes: festivalAdminProcedure.query(async () => {
    const codes = await Promise.all(BOOTH_IDS.map(async (boothId) => {
      const token = createBoothQrToken(boothId);
      const url = `${PUBLIC_CHECKIN_BASE_URL}?booth=${encodeURIComponent(boothId)}&token=${encodeURIComponent(token)}`;
      const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 320 });
      return { boothId, url, qrDataUrl };
    }));
    return codes;
  }),
});

if (process.env.DATABASE_URL) {
  startBoothReservationScheduler(getBoothReservationPool());
}
