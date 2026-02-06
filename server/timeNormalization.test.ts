import { describe, it, expect } from "vitest";

// Replicate the parseJstToUtc function from routers.ts for testing
const parseJstToUtc = (dateStr: string): Date => {
  // If already an ISO string with timezone, parse directly
  if (dateStr.includes('+') || dateStr.includes('Z')) {
    return new Date(dateStr);
  }
  // Normalize time parts (e.g. "1:22" -> "01:22")
  let normalized = dateStr;
  const tIdx = normalized.indexOf('T');
  if (tIdx !== -1) {
    const timePart = normalized.substring(tIdx + 1);
    const timeParts = timePart.split(':');
    if (timeParts.length >= 2) {
      const h = timeParts[0].padStart(2, '0');
      const m = timeParts[1].padStart(2, '0');
      const s = timeParts.length >= 3 ? timeParts[2] : '00';
      normalized = normalized.substring(0, tIdx + 1) + `${h}:${m}:${s}`;
    }
  }
  // Ensure seconds are present
  const colonCount = (normalized.match(/:/g) || []).length;
  if (colonCount === 1) {
    normalized += ':00';
  }
  // Append JST timezone offset (+09:00) to treat input as JST
  const isoFormat = normalized + '+09:00';
  const result = new Date(isoFormat);
  if (isNaN(result.getTime())) {
    throw new Error(`Invalid time value: ${dateStr}`);
  }
  return result;
};

// Replicate the normalizeTime function from LiverRecord.tsx
const normalizeTime = (time: string): string => {
  if (!time) return time;
  const parts = time.split(':');
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return time;
};

const safeCreateDate = (date: string, time: string): Date | null => {
  if (!date || !time) return null;
  const normalizedTime = normalizeTime(time);
  const dateStr = `${date}T${normalizedTime}:00`;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

describe("normalizeTime", () => {
  it("should pad single-digit hours", () => {
    expect(normalizeTime("1:22")).toBe("01:22");
  });

  it("should not change already padded times", () => {
    expect(normalizeTime("21:10")).toBe("21:10");
  });

  it("should pad single-digit minutes", () => {
    expect(normalizeTime("9:5")).toBe("09:05");
  });

  it("should handle midnight", () => {
    expect(normalizeTime("0:00")).toBe("00:00");
  });

  it("should handle empty string", () => {
    expect(normalizeTime("")).toBe("");
  });
});

describe("safeCreateDate", () => {
  it("should create valid date for normal time (21:10)", () => {
    const result = safeCreateDate("2026-02-04", "21:10");
    expect(result).not.toBeNull();
    expect(result!.getTime()).not.toBeNaN();
  });

  it("should create valid date for single-digit hour (1:22) - the bug case", () => {
    const result = safeCreateDate("2026-02-05", "1:22");
    expect(result).not.toBeNull();
    expect(result!.getTime()).not.toBeNaN();
  });

  it("should create valid date for padded time (01:22)", () => {
    const result = safeCreateDate("2026-02-05", "01:22");
    expect(result).not.toBeNull();
    expect(result!.getTime()).not.toBeNaN();
  });

  it("should return null for empty date", () => {
    expect(safeCreateDate("", "21:10")).toBeNull();
  });

  it("should return null for empty time", () => {
    expect(safeCreateDate("2026-02-04", "")).toBeNull();
  });

  it("should handle cross-midnight scenario correctly", () => {
    const start = safeCreateDate("2026-02-04", "21:10");
    const end = safeCreateDate("2026-02-05", "1:22");
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    // End should be after start
    const diffMs = end!.getTime() - start!.getTime();
    expect(diffMs).toBeGreaterThan(0);
    // Duration should be about 252 minutes (4h12m)
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    expect(diffMinutes).toBe(252);
  });
});

describe("parseJstToUtc", () => {
  it("should parse normal datetime-local format", () => {
    const result = parseJstToUtc("2026-02-04T21:10");
    expect(result.getTime()).not.toBeNaN();
  });

  it("should parse single-digit hour format (the bug case)", () => {
    const result = parseJstToUtc("2026-02-05T1:22");
    expect(result.getTime()).not.toBeNaN();
  });

  it("should parse already padded format", () => {
    const result = parseJstToUtc("2026-02-05T01:22");
    expect(result.getTime()).not.toBeNaN();
  });

  it("should parse ISO string with timezone", () => {
    const result = parseJstToUtc("2026-02-04T12:10:00+09:00");
    expect(result.getTime()).not.toBeNaN();
  });

  it("should parse ISO string with Z", () => {
    const result = parseJstToUtc("2026-02-04T03:10:00Z");
    expect(result.getTime()).not.toBeNaN();
  });

  it("should handle format with seconds already present", () => {
    const result = parseJstToUtc("2026-02-04T21:10:00");
    expect(result.getTime()).not.toBeNaN();
  });

  it("should correctly convert JST to UTC (9 hours difference)", () => {
    const result = parseJstToUtc("2026-02-04T21:10");
    // JST 21:10 = UTC 12:10
    expect(result.getUTCHours()).toBe(12);
    expect(result.getUTCMinutes()).toBe(10);
  });

  it("should correctly convert cross-midnight JST to UTC", () => {
    const result = parseJstToUtc("2026-02-05T1:22");
    // JST 01:22 on Feb 5 = UTC 16:22 on Feb 4
    expect(result.getUTCDate()).toBe(4);
    expect(result.getUTCHours()).toBe(16);
    expect(result.getUTCMinutes()).toBe(22);
  });

  it("should throw for completely invalid input", () => {
    expect(() => parseJstToUtc("not-a-date")).toThrow("Invalid time value");
  });
});
