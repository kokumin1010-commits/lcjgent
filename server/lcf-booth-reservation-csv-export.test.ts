import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLcfBoothReservationsCsv,
  escapeLcfCsvCell,
  formatLcfReservationCreatedAt,
  protectLcfCsvFormula,
} from "../client/src/lib/lcfBoothReservationCsv";

describe("LCF booth reservation CSV export", () => {
  it("creates an Excel-compatible current-view CSV without changing row order", () => {
    const rows = [
      {
        reservationId: "LB-SECOND",
        createdAtMs: Date.parse("2026-09-03T15:05:47Z"),
        date: "2026-09-09",
        timeSlot: "12:00-13:00",
        boothId: "T19",
        bookingType: "advance",
        creatorName: "テスト,配信者",
        email: "safe@example.com",
        status: "confirmed",
        statusLabel: "予約確定",
        guidelineConflicts: [],
      },
      {
        reservationId: "LB-FIRST",
        createdAtMs: Date.parse("2026-09-03T14:00:00Z"),
        date: "2026-09-08",
        timeSlot: "13:00-14:00",
        boothId: "T13",
        bookingType: "same_day",
        creatorName: "安全な配信者",
        email: "other@example.com",
        status: "checked_in",
        statusLabel: "チェックイン済み",
        guidelineConflicts: ["確認事項A", "確認事項B"],
      },
    ];

    const result = buildLcfBoothReservationsCsv(rows, {
      filter: "all",
      sort: "schedule",
      now: new Date("2026-09-04T06:30:00Z"),
    });

    expect(result.csv.startsWith("\uFEFF")).toBe(true);
    expect(result.csv).toContain('"予約ID","受付日時","日付","時間","ブース","区分","クリエイター","メール","ステータス","ルール確認"');
    expect(result.csv.indexOf("LB-SECOND")).toBeLessThan(result.csv.indexOf("LB-FIRST"));
    expect(result.csv).toContain('"テスト,配信者"');
    expect(result.csv).toContain('"当日枠"');
    expect(result.csv).toContain('"確認事項A / 確認事項B"');
    expect(result.fileName).toBe("LCF2026_ブース予約_すべて_利用時間順_20260904-1530.csv");
    expect(result.rowCount).toBe(2);
  });

  it("protects every spreadsheet formula trigger including leading whitespace", () => {
    for (const value of ["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "  =HYPERLINK(\"x\")", "\t=1+1"]) {
      expect(protectLcfCsvFormula(value)).toBe(`'${value}`);
    }
    expect(protectLcfCsvFormula("normal@example.com")).toBe("normal@example.com");
  });

  it("escapes quotes and preserves embedded line breaks inside a quoted cell", () => {
    expect(escapeLcfCsvCell('a,"b"\nline')).toBe('"a,""b""\nline"');
  });

  it("formats reception timestamps in Japan time and handles invalid values", () => {
    expect(formatLcfReservationCreatedAt(Date.parse("2026-09-03T15:05:47Z"))).toBe("2026-09-04 00:05:47");
    expect(formatLcfReservationCreatedAt(undefined)).toBe("");
    expect(formatLcfReservationCreatedAt("invalid")).toBe("");
  });

  it("wires a read-only CSV button to the already filtered and sorted reservation array", () => {
    const adminPage = readFileSync(resolve(process.cwd(), "client/src/pages/LcfAdmin.tsx"), "utf8");
    expect(adminPage).toContain("buildLcfBoothReservationsCsv(reservations");
    expect(adminPage).toContain("filter: reservationFilter");
    expect(adminPage).toContain("sort: reservationSort");
    expect(adminPage).toContain("CSV出力（{reservations.length}件）");
    expect(adminPage).toContain('type: "text/csv;charset=utf-8"');
    expect(adminPage).toContain("anchor.download = fileName");
    expect(adminPage).not.toContain("boothReservation.export");
  });
});
