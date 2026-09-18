export const MAX_LIVESTREAM_DURATION_MINUTES = 7 * 24 * 60;
export const MAX_LIVESTREAM_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export type LivestreamTimingLike = {
  livestreamDate?: Date | string | null;
  livestreamEndTime?: Date | string | null;
  duration?: number | null;
};

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function deriveLivestreamDurationMinutes(
  startValue: Date | string | null | undefined,
  endValue: Date | string | null | undefined,
): number | null {
  const start = toValidDate(startValue);
  const end = toValidDate(endValue);
  if (!start || !end) return null;
  const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60_000);
  if (durationMinutes <= 0 || durationMinutes > MAX_LIVESTREAM_DURATION_MINUTES) {
    return null;
  }
  return durationMinutes;
}

export function resolveLivestreamDurationMinutes(record: LivestreamTimingLike): number {
  const derived = deriveLivestreamDurationMinutes(
    record.livestreamDate,
    record.livestreamEndTime,
  );
  if (derived !== null) return derived;
  const stored = Number(record.duration);
  if (
    Number.isFinite(stored) &&
    stored > 0 &&
    stored <= MAX_LIVESTREAM_DURATION_MINUTES
  ) {
    return Math.floor(stored);
  }
  return 0;
}

export type NormalizedLivestreamTiming = {
  start: Date;
  end: Date | null;
  durationMinutes: number | null;
};

export function normalizeLivestreamTimingForPersistence(input: {
  start: Date | string;
  end?: Date | string | null;
  durationMinutes?: number | null;
  referenceDate?: Date;
}): NormalizedLivestreamTiming {
  const start = toValidDate(input.start);
  if (!start) throw new Error("invalid_livestream_start");

  const referenceDate = input.referenceDate ?? new Date();
  if (start.getTime() > referenceDate.getTime() + MAX_LIVESTREAM_FUTURE_SKEW_MS) {
    throw new Error("future_livestream_start");
  }

  const end = toValidDate(input.end);
  if (input.end && !end) throw new Error("invalid_livestream_end");
  if (end && end.getTime() > referenceDate.getTime() + MAX_LIVESTREAM_FUTURE_SKEW_MS) {
    throw new Error("future_livestream_end");
  }
  if (end && end.getTime() <= start.getTime()) {
    throw new Error("livestream_end_not_after_start");
  }

  const derived = deriveLivestreamDurationMinutes(start, end);
  const supplied = Number(input.durationMinutes);
  const suppliedDuration =
    Number.isFinite(supplied) &&
    supplied > 0 &&
    supplied <= MAX_LIVESTREAM_DURATION_MINUTES
      ? Math.floor(supplied)
      : null;

  return {
    start,
    end,
    durationMinutes: derived ?? suppliedDuration,
  };
}

export function normalizeLiverLookupKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, "");
}
