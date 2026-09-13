export const KGDAY_TIME_ZONE = "Asia/Tokyo";

// 2026-09-08 09:00:00 JST through 2026-09-10 23:59:59.999 JST.
export const KGDAY_EVENT_START_MS = Date.UTC(2026, 8, 8, 0, 0, 0, 0);
export const KGDAY_EVENT_END_EXCLUSIVE_MS = Date.UTC(2026, 8, 10, 15, 0, 0, 0);
export const KGDAY_EVENT_END_MS = KGDAY_EVENT_END_EXCLUSIVE_MS - 1;

const JST_DAY_BOUNDARIES = {
  1: { startMs: KGDAY_EVENT_START_MS, endExclusiveMs: Date.UTC(2026, 8, 8, 15, 0, 0, 0) },
  2: { startMs: Date.UTC(2026, 8, 8, 15, 0, 0, 0), endExclusiveMs: Date.UTC(2026, 8, 9, 15, 0, 0, 0) },
  3: { startMs: Date.UTC(2026, 8, 9, 15, 0, 0, 0), endExclusiveMs: KGDAY_EVENT_END_EXCLUSIVE_MS },
} as const;

export type KgdayDayNumber = keyof typeof JST_DAY_BOUNDARIES;
export type KgdayTimeStatus = "valid" | "partial" | "outside" | "missing" | "invalid";

export type BrandDayTimeStatus = KgdayTimeStatus;
export type BrandDayWindow = {
  eventStartAt: Date;
  eventEndAt: Date;
  timezone?: string;
};

const JST_OFFSET_MS = 9 * 60 * 60_000;

function startOfJstDay(timestamp: number) {
  const local = new Date(timestamp + JST_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - JST_OFFSET_MS;
}

export function getBrandDayDayWindow(event: BrandDayWindow, dayNumber: number) {
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
    throw new Error("INVALID_BRAND_DAY_NUMBER");
  }
  if ((event.timezone || KGDAY_TIME_ZONE) !== KGDAY_TIME_ZONE) {
    throw new Error("UNSUPPORTED_BRAND_DAY_TIMEZONE");
  }
  const eventStartMs = event.eventStartAt.getTime();
  const eventEndExclusiveMs = event.eventEndAt.getTime() + 1;
  if (!Number.isFinite(eventStartMs) || !Number.isFinite(eventEndExclusiveMs) || eventEndExclusiveMs <= eventStartMs) {
    throw new Error("INVALID_BRAND_DAY_WINDOW");
  }
  const calendarStartMs = startOfJstDay(eventStartMs) + (dayNumber - 1) * 24 * 60 * 60_000;
  const calendarEndMs = calendarStartMs + 24 * 60 * 60_000;
  return {
    startMs: Math.max(eventStartMs, calendarStartMs),
    endExclusiveMs: Math.min(eventEndExclusiveMs, calendarEndMs),
  };
}

export function clipBrandDayPerformanceTime(
  event: BrandDayWindow,
  dayNumber: number,
  startedAt: Date | null,
  endedAt: Date | null,
) {
  if (!startedAt || !endedAt || endedAt <= startedAt) return { startedAt, endedAt, streamMinutes: 0 };
  const { startMs, endExclusiveMs } = getBrandDayDayWindow(event, dayNumber);
  const clippedStartMs = Math.max(startedAt.getTime(), startMs);
  const clippedEndMs = Math.min(endedAt.getTime(), endExclusiveMs);
  if (clippedEndMs <= clippedStartMs) {
    const boundary = new Date(Math.min(Math.max(clippedStartMs, startMs), endExclusiveMs));
    return { startedAt: boundary, endedAt: boundary, streamMinutes: 0 };
  }
  return {
    startedAt: new Date(clippedStartMs),
    endedAt: new Date(clippedEndMs),
    streamMinutes: Math.floor((clippedEndMs - clippedStartMs) / 60_000),
  };
}

export function parseBrandDayJstDateTime(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (year < 2000 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const timestamp = Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0);
  const jst = new Date(timestamp + JST_OFFSET_MS);
  if (jst.getUTCFullYear() !== year || jst.getUTCMonth() !== month - 1 || jst.getUTCDate() !== day || jst.getUTCHours() !== hour || jst.getUTCMinutes() !== minute) return null;
  return new Date(timestamp);
}

export function assessBrandDayPerformanceTime(
  event: BrandDayWindow,
  dayNumber: number,
  startedAt: Date | null,
  endedAt: Date | null,
) {
  if (!startedAt || !endedAt) return { status: "missing" as const, rawMinutes: 0, validMinutes: 0, effectiveStartedAt: null, effectiveEndedAt: null };
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) {
    return { status: "invalid" as const, rawMinutes: 0, validMinutes: 0, effectiveStartedAt: null, effectiveEndedAt: null };
  }
  const rawMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000);
  const clipped = clipBrandDayPerformanceTime(event, dayNumber, startedAt, endedAt);
  if (!clipped.startedAt || !clipped.endedAt || clipped.streamMinutes <= 0) {
    return { status: "outside" as const, rawMinutes, validMinutes: 0, effectiveStartedAt: null, effectiveEndedAt: null };
  }
  const { startMs, endExclusiveMs } = getBrandDayDayWindow(event, dayNumber);
  const status: BrandDayTimeStatus = startedAt.getTime() >= startMs && endedAt.getTime() <= endExclusiveMs ? "valid" : "partial";
  return { status, rawMinutes, validMinutes: clipped.streamMinutes, effectiveStartedAt: clipped.startedAt, effectiveEndedAt: clipped.endedAt };
}

export function isWithinBrandDayEvent(event: BrandDayWindow, date: Date) {
  const value = date.getTime();
  return value >= event.eventStartAt.getTime() && value <= event.eventEndAt.getTime();
}

export function getKgdayDayWindow(dayNumber: number) {
  const window = JST_DAY_BOUNDARIES[dayNumber as KgdayDayNumber];
  if (!window) throw new Error("INVALID_KGDAY_DAY_NUMBER");
  return window;
}

export function clipKgdayPerformanceTime(dayNumber: number, startedAt: Date | null, endedAt: Date | null) {
  if (!startedAt || !endedAt || endedAt <= startedAt) return { startedAt, endedAt, streamMinutes: 0 };
  const { startMs, endExclusiveMs } = getKgdayDayWindow(dayNumber);
  const clippedStartMs = Math.max(startedAt.getTime(), startMs);
  const clippedEndMs = Math.min(endedAt.getTime(), endExclusiveMs);
  if (clippedEndMs <= clippedStartMs) {
    const boundary = new Date(Math.min(Math.max(clippedStartMs, startMs), endExclusiveMs));
    return { startedAt: boundary, endedAt: boundary, streamMinutes: 0 };
  }
  return {
    startedAt: new Date(clippedStartMs),
    endedAt: new Date(clippedEndMs),
    streamMinutes: Math.floor((clippedEndMs - clippedStartMs) / 60_000),
  };
}

export function parseJstDateTime(value: string | null | undefined) {
  const parsed = parseBrandDayJstDateTime(value);
  return parsed && parsed.getUTCFullYear() === 2026 ? parsed : null;
}

export function formatJstDateTimeInput(value: Date | null | undefined) {
  if (!value) return null;
  const jst = new Date(value.getTime() + 9 * 60 * 60_000);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

export function assessKgdayPerformanceTime(dayNumber: number, startedAt: Date | null, endedAt: Date | null) {
  if (!startedAt || !endedAt) return { status: "missing" as const, rawMinutes: 0, validMinutes: 0, effectiveStartedAt: null, effectiveEndedAt: null };
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) {
    return { status: "invalid" as const, rawMinutes: 0, validMinutes: 0, effectiveStartedAt: null, effectiveEndedAt: null };
  }
  const rawMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000);
  const clipped = clipKgdayPerformanceTime(dayNumber, startedAt, endedAt);
  if (!clipped.startedAt || !clipped.endedAt || clipped.streamMinutes <= 0) {
    return { status: "outside" as const, rawMinutes, validMinutes: 0, effectiveStartedAt: null, effectiveEndedAt: null };
  }
  const { startMs, endExclusiveMs } = getKgdayDayWindow(dayNumber);
  const status: KgdayTimeStatus = startedAt.getTime() >= startMs && endedAt.getTime() <= endExclusiveMs ? "valid" : "partial";
  return { status, rawMinutes, validMinutes: clipped.streamMinutes, effectiveStartedAt: clipped.startedAt, effectiveEndedAt: clipped.endedAt };
}

export function isWithinKgdayEvent(date: Date) {
  const value = date.getTime();
  return value >= KGDAY_EVENT_START_MS && value < KGDAY_EVENT_END_EXCLUSIVE_MS;
}
