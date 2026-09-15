export type ScheduleTimeLike = {
  id?: number;
  startTime: string | Date;
  endTime?: string | Date | null;
  isAllDay?: boolean;
};

export type ScheduleDayState = {
  isEnded: boolean;
  isMultiDay: boolean;
  isStartDay: boolean;
  isEndDay: boolean;
  displayStart: Date;
  displayEnd: Date | null;
  sortTimestamp: number;
};

const JST_TIME_ZONE = "Asia/Tokyo";
const JST_OFFSET = "+09:00";

export function getScheduleJSTDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: JST_TIME_ZONE });
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const parsed =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfJSTDay(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${JST_OFFSET}`);
}

function endOfJSTDay(dateKey: string): Date {
  const nextDay = new Date(
    startOfJSTDay(dateKey).getTime() + 24 * 60 * 60 * 1000
  );
  return new Date(nextDay.getTime() - 1);
}

export function getScheduleDayState(
  schedule: ScheduleTimeLike,
  dateKey: string,
  now: Date = new Date()
): ScheduleDayState {
  const start = parseDate(schedule.startTime);
  const end = parseDate(schedule.endTime);
  const dayStart = startOfJSTDay(dateKey);
  const dayEnd = endOfJSTDay(dateKey);

  if (!start) {
    return {
      isEnded: false,
      isMultiDay: false,
      isStartDay: false,
      isEndDay: false,
      displayStart: dayEnd,
      displayEnd: null,
      sortTimestamp: Number.POSITIVE_INFINITY,
    };
  }

  const effectiveEnd = end ?? start;
  const startKey = getScheduleJSTDateKey(start);
  const endKey = getScheduleJSTDateKey(effectiveEnd);
  const isMultiDay = startKey !== endKey;
  const isStartDay = dateKey === startKey;
  const isEndDay = dateKey === endKey;
  const displayStart = start < dayStart ? dayStart : start;
  const displayEnd = effectiveEnd > dayEnd ? dayEnd : effectiveEnd;

  return {
    isEnded: effectiveEnd.getTime() <= now.getTime(),
    isMultiDay,
    isStartDay,
    isEndDay,
    displayStart,
    displayEnd,
    sortTimestamp: schedule.isAllDay
      ? dayStart.getTime()
      : displayStart.getTime(),
  };
}

export function sortSchedulesForDate<T extends ScheduleTimeLike>(
  schedules: readonly T[],
  dateKey: string
): T[] {
  return [...schedules].sort((left, right) => {
    if (!!left.isAllDay !== !!right.isAllDay) return left.isAllDay ? -1 : 1;

    const leftState = getScheduleDayState(left, dateKey);
    const rightState = getScheduleDayState(right, dateKey);
    const timeDifference = leftState.sortTimestamp - rightState.sortTimestamp;
    if (Number.isFinite(timeDifference) && timeDifference !== 0)
      return timeDifference;

    return (left.id ?? 0) - (right.id ?? 0);
  });
}
