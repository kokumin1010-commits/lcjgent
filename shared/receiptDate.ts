export type ReceiptDateNormalization = {
  date?: Date;
  normalizedIsoDate: string | null;
  valid: boolean;
};

function validDateParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    year < 1970 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day &&
    candidate.getUTCHours() === hour &&
    candidate.getUTCMinutes() === minute &&
    candidate.getUTCSeconds() === second
  );
}

/**
 * Normalize an OCR purchase date without ever creating an Invalid Date.
 *
 * Purchase date is optional evidence. Invalid or ambiguous values are omitted
 * instead of being replaced with the current time, which would corrupt audit
 * history. Japanese/Chinese date text is accepted because receipt screenshots
 * commonly contain values such as `2026年8月29日 11:51`.
 */
export function normalizeReceiptPurchaseDate(value: unknown): ReceiptDateNormalization {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    if (!Number.isFinite(milliseconds)) {
      return { normalizedIsoDate: null, valid: false };
    }
    const date = new Date(milliseconds);
    return {
      date,
      normalizedIsoDate: date.toISOString().slice(0, 10),
      valid: true,
    };
  }

  if (typeof value !== "string" || !value.trim()) {
    return { normalizedIsoDate: null, valid: false };
  }

  const input = value.trim();
  const localized = input.match(
    /^(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*(?:日)?(?:[T\s]+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/
  );
  if (localized) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = localized;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText || 0);
    const minute = Number(minuteText || 0);
    const second = Number(secondText || 0);
    if (!validDateParts(year, month, day, hour, minute, second)) {
      return { normalizedIsoDate: null, valid: false };
    }
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return {
      date,
      normalizedIsoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      valid: true,
    };
  }

  const parsed = new Date(input);
  const milliseconds = parsed.getTime();
  if (!Number.isFinite(milliseconds)) {
    return { normalizedIsoDate: null, valid: false };
  }
  return {
    date: parsed,
    normalizedIsoDate: parsed.toISOString().slice(0, 10),
    valid: true,
  };
}

export function receiptPurchaseDateOrUndefined(value: unknown): Date | undefined {
  return normalizeReceiptPurchaseDate(value).date;
}

export function receiptDateInputValue(value: unknown): string {
  return normalizeReceiptPurchaseDate(value).normalizedIsoDate || "";
}
