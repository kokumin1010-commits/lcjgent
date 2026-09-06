import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DAY2_CLOSE_DATE,
  DAY2_CLOSED_TIME_SLOTS,
  DAY2_CLOSE_REASON,
  DAY2_CLOSE_SUBJECT,
  getDay2CloseEmailContent,
} from "./boothDay2CloseService";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF Day2 booth close after 17:00", () => {
  const service = read("server/boothDay2CloseService.ts");
  const router = read("server/boothReservationRouter.ts");

  it("targets only the two Day2 teardown slots", () => {
    expect(DAY2_CLOSE_DATE).toBe("2026-09-09");
    expect(DAY2_CLOSED_TIME_SLOTS).toEqual(["17:00-18:00", "18:00-19:00"]);
    expect(DAY2_CLOSE_REASON).toBe("day2_after_1700_closed");
  });

  it("uses a clear Japanese notice with the correct final slot", () => {
    const content = getDay2CloseEmailContent();
    expect(content.subject).toBe(DAY2_CLOSE_SUBJECT);
    expect(content.text).toContain("17:00よりLIVE配信ブースエリアの撤収作業");
    expect(content.text).toContain("最終時間帯を「16:00～17:00」");
    expect(content.text).toContain("17:00～18:00");
    expect(content.text).toContain("18:00～19:00");
    expect(content.text).toContain("9月8日の予約時間帯に変更はありません");
    expect(content.text).toContain("https://www.livecommercefestival.com/lcf/mypage");
    expect(content.html).toContain("LIVE COMMERCE FESTIVAL 運営事務局");
  });

  it("backs up and cancels active reservations transactionally", () => {
    expect(service).toContain("SELECT GET_LOCK");
    expect(service).toContain("aes-256-gcm");
    expect(service).toContain("snapshot round-trip failed");
    expect(service).toContain("connection.beginTransaction()");
    expect(service).toContain("ORDER BY id FOR UPDATE");
    expect(service).toContain("status = 'cancelled'");
    expect(service).toContain("day2_after_1700_cancel_reservation");
    expect(service).toContain("DELETE FROM lcf_booth_active_slots WHERE date = ? AND timeSlot IN (?)");
    expect(service).toContain("connection.commit()");
    expect(service).toContain("connection.rollback()");
    expect(service).not.toContain("DELETE FROM lcf_booth_reservations");
  });

  it("deduplicates recipients and retries only unaccepted delivery", () => {
    expect(service).toContain("GROUP BY LOWER(TRIM(email))");
    expect(service).toContain('createHmac("sha256"');
    expect(service).toContain("recipientHash CHAR(64)");
    expect(service).not.toMatch(/lcf_booth_day2_close_email_logs[\s\S]{0,500}\bemail\s+VARCHAR/i);
    expect(service).toContain('if (logRows[0]?.status === "accepted") continue');
    expect(service).toContain("attemptCount = attemptCount + 1");
    expect(service).toContain("to: [email]");
  });

  it("exposes an admin-only impact preview and explicit confirmation mutation", () => {
    expect(service).toContain("cancelledReservationCount");
    expect(service).toContain("runStatus");
    expect(router).toContain("getDay2CloseImpact: festivalAdminProcedure");
    expect(router).toContain("closeDay2LateSlotsAndNotify: festivalAdminProcedure");
    expect(router).toContain('z.literal("DAY2-17")');
    expect(router).toContain("closeDay2LateBoothSlots(getBoothReservationPool()");
  });
});
