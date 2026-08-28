import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF booth guideline implementation contract", () => {
  const router = read("server/boothReservationRouter.ts");
  const service = read("server/boothReservationService.ts");
  const policy = read("server/boothReservationPolicy.ts");
  const mypage = read("client/src/pages/LcfMypage.tsx");
  const reservationPage = read("client/src/pages/LcfBoothReservation.tsx");
  const checkinPage = read("client/src/pages/LcfBoothCheckin.tsx");
  const adminPage = read("client/src/pages/LcfAdmin.tsx");
  const app = read("client/src/App.tsx");

  it("enforces the global 21:00 JST opening in the shared server policy", () => {
    expect(policy).toContain('BOOKING_OPEN_DATE_JST = "2026-08-28"');
    expect(policy).toContain('BOOKING_OPEN_TIME_JST = "21:00"');
    expect(policy).toContain('reason: "BEFORE_GLOBAL_OPEN"');
    expect(router).toContain("予約受付は日本時間2026年8月28日21:00から開始します");
    expect(router).toContain("bookingOpensAt: getBookingOpensAt().getTime()");
  });

  it("locks the verified account before checking the two-slot and interval rules", () => {
    const createStart = router.indexOf("createReservation: festivalUserProcedure");
    const createEnd = router.indexOf("getReservation: festivalUserProcedure", createStart);
    const create = router.slice(createStart, createEnd);
    expect(create).toContain("FROM festival_accounts");
    expect(create).toContain("FOR UPDATE");
    expect(create).toContain("ADVANCE_BOOKING_LIMIT");
    expect(create).toContain("violatesRequiredInterval");
    expect(create).toContain("lcf_booth_active_slots");
    expect(create).toContain("ER_DUP_ENTRY");
    expect(create).toContain("connection.beginTransaction()");
  });

  it("requires a valid booth QR token for same-day reservations and check-in", () => {
    expect(router).toContain('decision.bookingType === "same_day" && !verifyBoothQrToken');
    expect(router).toContain("当日枠は対象ブース前のQRコードから予約してください");
    expect(router).toContain("performCheckin: festivalUserProcedure");
    expect(router).toContain("getBoothQrContext: festivalUserProcedure");
    expect(router).toContain('update(`lcf-booth-checkin:v1:${boothId}`)');
    expect(router).not.toContain("email=${encodeURIComponent");
    expect(checkinPage).toContain("boothQrToken: token");
  });

  it("auto-cancels no-shows, invalidates later advance bookings and writes audits atomically", () => {
    expect(service).toContain("status = 'auto_cancelled'");
    expect(service).toContain("future_advance_invalidated_after_no_show");
    expect(service).toContain("parentAutoCancelledReservationId");
    expect(service).toContain("DELETE FROM lcf_booth_active_slots");
    expect(service).toContain("writeBoothAudit(connection");
    expect(service).toContain("connection.beginTransaction()");
    expect(service).toContain("connection.commit()");
    expect(service).toContain("connection.rollback()");
    expect(service).toContain("LCF_BOOTH_AUTO_CANCEL_ENABLED");
  });

  it("backs up and clears prelaunch reservations exactly once in a transaction", () => {
    expect(service).toContain('PRELAUNCH_RESET_KEY = "lcf-booth-prelaunch-reset-2026-08-28-v1"');
    expect(service).toContain("CREATE TABLE IF NOT EXISTS lcf_booth_reset_runs");
    expect(service).toContain("lcf_booth_reservations_backup_20260828");
    expect(service).toContain("lcf_booth_active_slots_backup_20260828");
    expect(service).toContain("lcf_booth_reservation_audit_logs_backup_20260828");
    expect(service).toContain("INSERT IGNORE INTO lcf_booth_reset_runs");
    expect(service).toContain("INSERT INTO lcf_booth_reservations_backup_20260828 SELECT * FROM lcf_booth_reservations");
    expect(service).toContain("DELETE FROM lcf_booth_reservation_audit_logs");
    expect(service).toContain("DELETE FROM lcf_booth_active_slots");
    expect(service).toContain("DELETE FROM lcf_booth_reservations");
    expect(service).toContain("connection.beginTransaction()");
    expect(service).toContain("connection.commit()");
    expect(service).toContain("connection.rollback()");
  });

  it("adds durable status, timing and audit fields without deleting existing reservations", () => {
    for (const field of [
      "bookingType",
      "slotStartAt",
      "slotEndAt",
      "checkinDeadlineAt",
      "checkedInAt",
      "cancelledAt",
      "cancellationReason",
      "cancelledByAccountId",
      "parentAutoCancelledReservationId",
    ]) {
      expect(service).toContain(field);
    }
    expect(service).toContain("CREATE TABLE IF NOT EXISTS lcf_booth_reservation_audit_logs");
    expect(service).toContain("bookingType = COALESCE(bookingType, 'advance')");
    expect(service).not.toContain("DROP TABLE lcf_booth");
    expect(service).not.toContain("TRUNCATE TABLE lcf_booth");
  });

  it("does not expose email in creator reservation reads", () => {
    const getReservationStart = router.indexOf("getReservation: festivalUserProcedure");
    const cancelStart = router.indexOf("cancelReservation: festivalUserProcedure", getReservationStart);
    const creatorReads = router.slice(getReservationStart, cancelStart);
    expect(creatorReads).not.toContain("SELECT email");
    expect(creatorReads).not.toContain("phone, email");
    expect(creatorReads).toContain("WHERE reservationId = ? AND accountId = ?");
    expect(creatorReads).toContain("WHERE accountId = ?");
  });

  it("disables both creator booking pages before 21:00 and states the correct guideline", () => {
    for (const page of [mypage, reservationPage]) {
      expect(page).toContain("予約受付は日本時間2026年8月28日21:00から開始します");
      expect(page).toContain("disabled=");
      expect(page).toContain("事前予約");
      expect(page).toContain("2枠");
      expect(page).toContain("連続利用");
    }
    expect(reservationPage).not.toContain("1日あたり最大2枠");
    expect(reservationPage).not.toContain("Wi-Fi、電源、照明を完備");
    expect(reservationPage).not.toContain("前日まで可能");
    expect(mypage).toContain("電源・充電器・照明・三脚・配信機材の用意はありません");
  });

  it("registers the QR route and gives admins QR and audit controls", () => {
    expect(app).toContain('path="/lcf/booth-checkin"');
    expect(app).toContain('import("./pages/LcfBoothCheckin")');
    expect(adminPage).toContain("getCheckinQrCodes");
    expect(adminPage).toContain("listAuditLogs");
    expect(adminPage).toContain("既存ルール抵触");
    expect(adminPage).toContain("自動取消せず要確認");
  });
});
