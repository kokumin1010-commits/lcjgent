import { describe, it, expect } from "vitest";

/**
 * Helper to extract numeric parts from ja-JP locale strings.
 * ja-JP returns "2月", "5日", "20時", "2025年" etc.
 */
function extractNumber(str: string): number {
  return Number(str.replace(/[^0-9]/g, ""));
}

describe("Timezone Conversion", () => {
  // Helper function to convert JST datetime-local string to UTC Date
  // This is the same logic used in routers.ts
  const parseJstToUtc = (dateStr: string): Date => {
    const isoFormat = dateStr + ":00+09:00";
    return new Date(isoFormat);
  };

  describe("parseJstToUtc", () => {
    it("should convert JST 04:00 to UTC 19:00 (previous day)", () => {
      const jstInput = "2025-02-05T04:00";
      const result = parseJstToUtc(jstInput);
      expect(result.toISOString()).toBe("2025-02-04T19:00:00.000Z");
    });

    it("should convert JST 15:00 to UTC 06:00 (same day)", () => {
      const jstInput = "2025-02-05T15:00";
      const result = parseJstToUtc(jstInput);
      expect(result.toISOString()).toBe("2025-02-05T06:00:00.000Z");
    });

    it("should convert JST 09:00 to UTC 00:00 (same day)", () => {
      const jstInput = "2025-02-05T09:00";
      const result = parseJstToUtc(jstInput);
      expect(result.toISOString()).toBe("2025-02-05T00:00:00.000Z");
    });

    it("should convert JST 23:30 to UTC 14:30 (same day)", () => {
      const jstInput = "2025-02-05T23:30";
      const result = parseJstToUtc(jstInput);
      expect(result.toISOString()).toBe("2025-02-05T14:30:00.000Z");
    });

    it("should convert JST 20:22 to UTC 11:22", () => {
      const jstInput = "2025-02-05T20:22";
      const result = parseJstToUtc(jstInput);
      expect(result.toISOString()).toBe("2025-02-05T11:22:00.000Z");
    });
  });

  describe("Display in JST using Intl API (timeZone: Asia/Tokyo)", () => {
    it("should display UTC midnight as 09:00 JST", () => {
      const utcDate = new Date("2025-02-05T00:00:00Z");
      const jstHour = utcDate.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      expect(jstHour).toBe("09:00");
    });

    it("should display 11:22 UTC as 20:22 JST", () => {
      const utcDate = new Date("2025-02-05T11:22:00Z");
      const jstHour = utcDate.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      expect(jstHour).toBe("20:22");
    });

    it("should display 13:00 UTC as 22:00 JST", () => {
      const utcDate = new Date("2025-02-05T13:00:00Z");
      const jstHour = utcDate.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      expect(jstHour).toBe("22:00");
    });

    it("should display UTC 19:00 as JST 04:00", () => {
      const utcDate = new Date("2025-02-04T19:00:00.000Z");
      const jstTime = utcDate.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      });
      expect(jstTime).toBe("04:00");
    });

    it("should display UTC 06:00 as JST 15:00", () => {
      const utcDate = new Date("2025-02-05T06:00:00.000Z");
      const jstTime = utcDate.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      });
      expect(jstTime).toBe("15:00");
    });

    it("should handle date boundary correctly (23:00 UTC = 08:00 JST next day)", () => {
      const utcDate = new Date("2025-02-05T23:00:00Z");
      const jstDay = extractNumber(
        utcDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", day: "numeric" })
      );
      const jstHour = utcDate.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      expect(jstDay).toBe(6); // Feb 6 in JST
      expect(jstHour).toBe("08:00");
    });

    it("should get correct JST date key using en-CA locale", () => {
      const utcDate = new Date("2025-02-05T20:00:00Z"); // Feb 6 05:00 JST
      const dateKey = utcDate.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
      expect(dateKey).toBe("2025-02-06");
    });

    it("should get correct JST year at year boundary", () => {
      const utcDate = new Date("2025-12-31T20:00:00Z"); // Jan 1 2026 05:00 JST
      const year = extractNumber(
        utcDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric" })
      );
      expect(year).toBe(2026);
    });

    it("should get correct JST weekday", () => {
      const utcDate = new Date("2025-02-05T11:22:00Z"); // Wed Feb 5 20:22 JST
      const weekday = utcDate.toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        weekday: "short",
      });
      expect(weekday).toBe("水");
    });
  });

  describe("formatDate equivalent (no manual +9 offset)", () => {
    it("should format 20:22 JST correctly without double conversion", () => {
      const utcDate = new Date("2025-02-05T11:22:00.000Z");

      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };
      const year = extractNumber(
        utcDate.toLocaleDateString("ja-JP", { ...options, year: "numeric" })
      );
      const month = String(
        extractNumber(utcDate.toLocaleDateString("ja-JP", { ...options, month: "numeric" }))
      ).padStart(2, "0");
      const day = String(
        extractNumber(utcDate.toLocaleDateString("ja-JP", { ...options, day: "numeric" }))
      ).padStart(2, "0");
      const weekdayStr = utcDate.toLocaleDateString("ja-JP", { ...options, weekday: "short" });
      const hours = utcDate.toLocaleTimeString("ja-JP", {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const result = `${year}/${month}/${day}(${weekdayStr})\n${hours}`;
      expect(result).toBe("2025/02/05(水)\n20:22");
    });

    it("should NOT produce 03:22 (the old double-conversion bug)", () => {
      const utcDate = new Date("2025-02-05T11:22:00.000Z");

      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };
      const hours = utcDate.toLocaleTimeString("ja-JP", {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      expect(hours).not.toBe("03:22");
      expect(hours).toBe("20:22");
    });
  });

  describe("formatDateTimeLocal equivalent (for input fields)", () => {
    it("should format UTC date as JST for datetime-local input", () => {
      const utcDate = new Date("2025-02-05T11:22:00.000Z");

      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };
      const year = extractNumber(
        utcDate.toLocaleDateString("ja-JP", { ...options, year: "numeric" })
      );
      const month = String(
        extractNumber(utcDate.toLocaleDateString("ja-JP", { ...options, month: "numeric" }))
      ).padStart(2, "0");
      const day = String(
        extractNumber(utcDate.toLocaleDateString("ja-JP", { ...options, day: "numeric" }))
      ).padStart(2, "0");
      const time = utcDate.toLocaleTimeString("ja-JP", {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const result = `${year}-${month}-${day}T${time}`;
      expect(result).toBe("2025-02-05T20:22");
    });
  });

  describe("getJSTMonthRange - JST-based month filtering", () => {
    // Replicate the helper function from db.ts for testing
    function getJSTMonthRange(month: string): { startDate: Date; endDate: Date } {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = new Date(Date.UTC(year, monthNum - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);
      return { startDate, endDate };
    }

    it("should return correct UTC range for Feb 2026 (JST)", () => {
      const { startDate, endDate } = getJSTMonthRange('2026-02');
      // JST Feb 1 00:00 = UTC Jan 31 15:00
      expect(startDate.toISOString()).toBe('2026-01-31T15:00:00.000Z');
      // JST Feb 28 23:59:59 = UTC Feb 28 14:59:59
      expect(endDate.toISOString()).toBe('2026-02-28T14:59:59.000Z');
    });

    it("should include livestream on JST Feb 1 (UTC Jan 31 20:00)", () => {
      const { startDate, endDate } = getJSTMonthRange('2026-02');
      // yae's livestream: 2026-01-31T20:00:00Z = JST Feb 1 05:00
      const livestreamDate = new Date('2026-01-31T20:00:00Z');
      expect(livestreamDate >= startDate).toBe(true);
      expect(livestreamDate <= endDate).toBe(true);
    });

    it("should NOT include livestream on JST Jan 31 (UTC Jan 31 12:00) in Feb range", () => {
      const { startDate } = getJSTMonthRange('2026-02');
      // UTC Jan 31 12:00 = JST Jan 31 21:00 (still January in JST)
      const livestreamDate = new Date('2026-01-31T12:00:00Z');
      expect(livestreamDate >= startDate).toBe(false);
    });

    it("should return correct UTC range for Jan 2026 (JST)", () => {
      const { startDate, endDate } = getJSTMonthRange('2026-01');
      // JST Jan 1 00:00 = UTC Dec 31 15:00
      expect(startDate.toISOString()).toBe('2025-12-31T15:00:00.000Z');
      // JST Jan 31 23:59:59 = UTC Jan 31 14:59:59
      expect(endDate.toISOString()).toBe('2026-01-31T14:59:59.000Z');
    });

    it("should handle December correctly", () => {
      const { startDate, endDate } = getJSTMonthRange('2025-12');
      // JST Dec 1 00:00 = UTC Nov 30 15:00
      expect(startDate.toISOString()).toBe('2025-11-30T15:00:00.000Z');
      // JST Dec 31 23:59:59 = UTC Dec 31 14:59:59
      expect(endDate.toISOString()).toBe('2025-12-31T14:59:59.000Z');
    });

    it("should handle leap year Feb correctly", () => {
      const { endDate } = getJSTMonthRange('2024-02');
      // 2024 is leap year, Feb has 29 days
      // JST Feb 29 23:59:59 = UTC Feb 29 14:59:59
      expect(endDate.toISOString()).toBe('2024-02-29T14:59:59.000Z');
    });
  });

  describe("Round-trip: save JST → store UTC → display JST", () => {
    it("should maintain time after save and display (20:22)", () => {
      const userInput = "2025-02-05T20:22";
      const utcForStorage = new Date(userInput + ":00+09:00");
      expect(utcForStorage.toISOString()).toBe("2025-02-05T11:22:00.000Z");

      const displayTime = utcForStorage.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      });
      expect(displayTime).toBe("20:22");
    });

    it("should maintain time after save and display (04:00)", () => {
      const userInput = "2025-02-05T04:00";
      const utcForStorage = parseJstToUtc(userInput);

      const displayTime = utcForStorage.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      });
      expect(displayTime).toBe("04:00");
    });

    it("should maintain date after save and display for early morning", () => {
      const userInput = "2025-02-05T04:00";
      const utcForStorage = parseJstToUtc(userInput);

      const displayDate = utcForStorage.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tokyo",
      });
      expect(displayDate).toBe("2025/02/05");
    });

    it("should display correct time range for livestream (20:22-22:00)", () => {
      const startUtc = new Date("2025-02-05T11:22:00.000Z");
      const endUtc = new Date("2025-02-05T13:00:00.000Z");

      const startJst = startUtc.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      const endJst = endUtc.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });

      expect(startJst).toBe("20:22");
      expect(endJst).toBe("22:00");
      expect(`${startJst}-${endJst}`).toBe("20:22-22:00");
    });
  });
});
