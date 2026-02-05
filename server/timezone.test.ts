import { describe, it, expect } from "vitest";

describe("Timezone Conversion", () => {
  // Helper function to convert JST datetime-local string to UTC Date
  // This is the same logic used in routers.ts
  const parseJstToUtc = (dateStr: string): Date => {
    // Append JST timezone offset (+09:00) to treat input as JST
    const isoFormat = dateStr + ':00+09:00';
    return new Date(isoFormat);
  };

  describe("parseJstToUtc", () => {
    it("should convert JST 04:00 to UTC 19:00 (previous day)", () => {
      // User enters 04:00 JST on 2025-02-05
      // This should be 19:00 UTC on 2025-02-04
      const jstInput = "2025-02-05T04:00";
      const result = parseJstToUtc(jstInput);
      
      expect(result.toISOString()).toBe("2025-02-04T19:00:00.000Z");
    });

    it("should convert JST 15:00 to UTC 06:00 (same day)", () => {
      // User enters 15:00 JST on 2025-02-05
      // This should be 06:00 UTC on 2025-02-05
      const jstInput = "2025-02-05T15:00";
      const result = parseJstToUtc(jstInput);
      
      expect(result.toISOString()).toBe("2025-02-05T06:00:00.000Z");
    });

    it("should convert JST 09:00 to UTC 00:00 (same day)", () => {
      // User enters 09:00 JST on 2025-02-05
      // This should be 00:00 UTC on 2025-02-05
      const jstInput = "2025-02-05T09:00";
      const result = parseJstToUtc(jstInput);
      
      expect(result.toISOString()).toBe("2025-02-05T00:00:00.000Z");
    });

    it("should convert JST 23:30 to UTC 14:30 (same day)", () => {
      // User enters 23:30 JST on 2025-02-05
      // This should be 14:30 UTC on 2025-02-05
      const jstInput = "2025-02-05T23:30";
      const result = parseJstToUtc(jstInput);
      
      expect(result.toISOString()).toBe("2025-02-05T14:30:00.000Z");
    });
  });

  describe("Display in JST", () => {
    it("should display UTC time correctly in JST", () => {
      // UTC 19:00 on 2025-02-04 should display as 04:00 JST on 2025-02-05
      const utcDate = new Date("2025-02-04T19:00:00.000Z");
      
      // toLocaleTimeString with ja-JP should convert to JST
      const jstTime = utcDate.toLocaleTimeString("ja-JP", { 
        hour: "2-digit", 
        minute: "2-digit",
        timeZone: "Asia/Tokyo"
      });
      
      expect(jstTime).toBe("04:00");
    });

    it("should display UTC 06:00 as JST 15:00", () => {
      const utcDate = new Date("2025-02-05T06:00:00.000Z");
      
      const jstTime = utcDate.toLocaleTimeString("ja-JP", { 
        hour: "2-digit", 
        minute: "2-digit",
        timeZone: "Asia/Tokyo"
      });
      
      expect(jstTime).toBe("15:00");
    });
  });

  describe("Round-trip conversion", () => {
    it("should maintain time after save and display", () => {
      // User enters 04:00 JST
      const userInput = "2025-02-05T04:00";
      
      // Convert to UTC for storage
      const utcForStorage = parseJstToUtc(userInput);
      
      // Simulate retrieving from DB and displaying in JST
      const displayTime = utcForStorage.toLocaleTimeString("ja-JP", { 
        hour: "2-digit", 
        minute: "2-digit",
        timeZone: "Asia/Tokyo"
      });
      
      // Should display the same time user entered
      expect(displayTime).toBe("04:00");
    });

    it("should maintain date after save and display for early morning", () => {
      // User enters 04:00 JST on Feb 5
      const userInput = "2025-02-05T04:00";
      
      // Convert to UTC for storage
      const utcForStorage = parseJstToUtc(userInput);
      
      // Simulate retrieving from DB and displaying in JST
      const displayDate = utcForStorage.toLocaleDateString("ja-JP", { 
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tokyo"
      });
      
      // Should display Feb 5 (same as user entered)
      expect(displayDate).toBe("2025/02/05");
    });
  });
});
