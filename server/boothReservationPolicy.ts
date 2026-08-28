export const BOOTH_IDS = [
  "T1", "T2", "T3", "T4", "T13", "T14", "T15", "T16",
  "T17", "T18", "T19", "T20", "T21", "T22", "T23", "T24",
] as const;

export const EVENT_DATES = ["2026-09-08", "2026-09-09"] as const;

export const TIME_SLOTS_BY_DATE: Record<(typeof EVENT_DATES)[number], readonly string[]> = {
  "2026-09-08": [
    "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "17:00-18:00",
  ],
  "2026-09-09": [
    "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00",
    "15:00-16:00", "16:00-17:00", "17:00-18:00", "18:00-19:00",
  ],
};

export type BoothId = (typeof BOOTH_IDS)[number];
export type EventDate = (typeof EVENT_DATES)[number];
export type BookingType = "advance" | "same_day";
export type ActiveReservationStatus = "confirmed" | "checked_in";

export const ADVANCE_BOOKING_LIMIT = 2;
export const REQUIRED_START_INTERVAL_MINUTES = 120;
export const SAME_DAY_OPEN_MINUTES_BEFORE_START = 15;
export const NO_SHOW_GRACE_MINUTES = 15;
export const BOOKING_OPEN_DATE_JST = "2026-08-28";
export const BOOKING_OPEN_TIME_JST = "21:00";

const JST_OFFSET_MINUTES = 9 * 60;

export function isEventDate(date: string): date is EventDate {
  return (EVENT_DATES as readonly string[]).includes(date);
}

export function getTimeSlotsForDate(date: string): readonly string[] {
  return isEventDate(date) ? TIME_SLOTS_BY_DATE[date] : [];
}

export function isValidTimeSlot(date: string, timeSlot: string): boolean {
  return getTimeSlotsForDate(date).includes(timeSlot);
}

function parseClock(clock: string): { hour: number; minute: number } {
  const [hourText, minuteText] = clock.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid clock: ${clock}`);
  }
  return { hour, minute };
}

export function jstDateTimeToUtc(date: string, clock: string): Date {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const { hour, minute } = parseClock(clock);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MINUTES * 60_000);
}

export function getSlotBounds(date: string, timeSlot: string): { start: Date; end: Date } {
  if (!isValidTimeSlot(date, timeSlot)) throw new Error(`Invalid event slot: ${date} ${timeSlot}`);
  const [startClock, endClock] = timeSlot.split("-");
  return {
    start: jstDateTimeToUtc(date, startClock),
    end: jstDateTimeToUtc(date, endClock),
  };
}

export function getJstDateKey(now: Date): string {
  const shifted = new Date(now.getTime() + JST_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getBookingOpensAt(): Date {
  return jstDateTimeToUtc(BOOKING_OPEN_DATE_JST, BOOKING_OPEN_TIME_JST);
}

export type BookingWindowDecision =
  | { allowed: true; bookingType: BookingType; checkinDeadlineAt: Date; sameDayOpensAt: Date; slotStart: Date; slotEnd: Date }
  | { allowed: false; reason: "BEFORE_GLOBAL_OPEN" | "PAST_SLOT" | "SAME_DAY_NOT_OPEN" | "INVALID_SLOT"; sameDayOpensAt?: Date; slotStart?: Date; slotEnd?: Date };

export function decideBookingWindow(date: string, timeSlot: string, now = new Date()): BookingWindowDecision {
  if (!isValidTimeSlot(date, timeSlot)) return { allowed: false, reason: "INVALID_SLOT" };

  const { start: slotStart, end: slotEnd } = getSlotBounds(date, timeSlot);
  const sameDayOpensAt = new Date(slotStart.getTime() - SAME_DAY_OPEN_MINUTES_BEFORE_START * 60_000);

  if (now.getTime() < getBookingOpensAt().getTime()) {
    return { allowed: false, reason: "BEFORE_GLOBAL_OPEN", sameDayOpensAt, slotStart, slotEnd };
  }

  if (now.getTime() >= slotEnd.getTime()) {
    return { allowed: false, reason: "PAST_SLOT", sameDayOpensAt, slotStart, slotEnd };
  }

  const todayJst = getJstDateKey(now);
  if (todayJst === date) {
    if (now.getTime() < sameDayOpensAt.getTime()) {
      return { allowed: false, reason: "SAME_DAY_NOT_OPEN", sameDayOpensAt, slotStart, slotEnd };
    }
    const standardDeadline = slotStart.getTime() + NO_SHOW_GRACE_MINUTES * 60_000;
    const createdDeadline = now.getTime() + NO_SHOW_GRACE_MINUTES * 60_000;
    return {
      allowed: true,
      bookingType: "same_day",
      checkinDeadlineAt: new Date(Math.max(standardDeadline, createdDeadline)),
      sameDayOpensAt,
      slotStart,
      slotEnd,
    };
  }

  if (now.getTime() >= jstDateTimeToUtc(date, "00:00").getTime()) {
    return { allowed: false, reason: "PAST_SLOT", sameDayOpensAt, slotStart, slotEnd };
  }

  return {
    allowed: true,
    bookingType: "advance",
    checkinDeadlineAt: new Date(slotStart.getTime() + NO_SHOW_GRACE_MINUTES * 60_000),
    sameDayOpensAt,
    slotStart,
    slotEnd,
  };
}

export function timeSlotStartMinutes(timeSlot: string): number {
  const [startClock] = timeSlot.split("-");
  const { hour, minute } = parseClock(startClock);
  return hour * 60 + minute;
}

export function violatesRequiredInterval(existingDate: string, existingTimeSlot: string, candidateDate: string, candidateTimeSlot: string): boolean {
  if (existingDate !== candidateDate) return false;
  return Math.abs(timeSlotStartMinutes(existingTimeSlot) - timeSlotStartMinutes(candidateTimeSlot)) < REQUIRED_START_INTERVAL_MINUTES;
}

export function canCheckIn(date: string, timeSlot: string, now = new Date()): { allowed: boolean; reason?: "TOO_EARLY" | "ENDED" } {
  const { start, end } = getSlotBounds(date, timeSlot);
  const opensAt = start.getTime() - SAME_DAY_OPEN_MINUTES_BEFORE_START * 60_000;
  if (now.getTime() < opensAt) return { allowed: false, reason: "TOO_EARLY" };
  if (now.getTime() >= end.getTime()) return { allowed: false, reason: "ENDED" };
  return { allowed: true };
}

export function shouldCompleteReservation(date: string, timeSlot: string, now = new Date()): boolean {
  return now.getTime() >= getSlotBounds(date, timeSlot).end.getTime();
}
