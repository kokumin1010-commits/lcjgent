import { describe, expect, it } from "vitest";
import {
  canCheckIn,
  decideBookingWindow,
  getBookingOpensAt,
  getJstDateKey,
  getSlotBounds,
  violatesRequiredInterval,
} from "./boothReservationPolicy";

describe("LCF booth booking policy", () => {
  it("opens globally at 2026-08-28 21:00 JST", () => {
    expect(getBookingOpensAt().toISOString()).toBe("2026-08-28T12:00:00.000Z");

    const before = decideBookingWindow(
      "2026-09-08",
      "13:00-14:00",
      new Date("2026-08-28T11:59:59.999Z"),
    );
    expect(before).toMatchObject({ allowed: false, reason: "BEFORE_GLOBAL_OPEN" });

    const atOpening = decideBookingWindow(
      "2026-09-08",
      "13:00-14:00",
      new Date("2026-08-28T12:00:00.000Z"),
    );
    expect(atOpening).toMatchObject({ allowed: true, bookingType: "advance" });
  });

  it("uses JST when determining the event date", () => {
    expect(getJstDateKey(new Date("2026-09-07T14:59:59Z"))).toBe("2026-09-07");
    expect(getJstDateKey(new Date("2026-09-07T15:00:00Z"))).toBe("2026-09-08");
  });

  it("does not allow same-day booking until 15 minutes before the slot", () => {
    const tooEarly = decideBookingWindow(
      "2026-09-08",
      "13:00-14:00",
      new Date("2026-09-08T03:44:59Z"),
    );
    expect(tooEarly).toMatchObject({ allowed: false, reason: "SAME_DAY_NOT_OPEN" });

    const open = decideBookingWindow(
      "2026-09-08",
      "13:00-14:00",
      new Date("2026-09-08T03:45:00Z"),
    );
    expect(open).toMatchObject({ allowed: true, bookingType: "same_day" });
  });

  it("keeps a 15-minute check-in grace period for a late same-day booking", () => {
    const decision = decideBookingWindow(
      "2026-09-08",
      "13:00-14:00",
      new Date("2026-09-08T04:20:00Z"),
    );
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error("expected same-day booking");
    expect(decision.bookingType).toBe("same_day");
    expect(decision.checkinDeadlineAt.toISOString()).toBe("2026-09-08T04:35:00.000Z");
  });

  it("closes booking when the slot ends", () => {
    const closed = decideBookingWindow(
      "2026-09-08",
      "13:00-14:00",
      new Date("2026-09-08T05:00:00Z"),
    );
    expect(closed).toMatchObject({ allowed: false, reason: "PAST_SLOT" });
  });

  it("requires a full empty one-hour slot between reservations", () => {
    expect(violatesRequiredInterval("2026-09-08", "13:00-14:00", "2026-09-08", "14:00-15:00")).toBe(true);
    expect(violatesRequiredInterval("2026-09-08", "13:00-14:00", "2026-09-08", "15:00-16:00")).toBe(false);
    expect(violatesRequiredInterval("2026-09-08", "13:00-14:00", "2026-09-09", "14:00-15:00")).toBe(false);
  });

  it("allows check-in from 15 minutes before start until the slot ends", () => {
    expect(canCheckIn("2026-09-09", "11:00-12:00", new Date("2026-09-09T01:44:59Z"))).toEqual({ allowed: false, reason: "TOO_EARLY" });
    expect(canCheckIn("2026-09-09", "11:00-12:00", new Date("2026-09-09T01:45:00Z"))).toEqual({ allowed: true });
    expect(canCheckIn("2026-09-09", "11:00-12:00", new Date("2026-09-09T03:00:00Z"))).toEqual({ allowed: false, reason: "ENDED" });
  });

  it("converts event slots from JST to UTC", () => {
    const bounds = getSlotBounds("2026-09-09", "18:00-19:00");
    expect(bounds.start.toISOString()).toBe("2026-09-09T09:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-09T10:00:00.000Z");
  });
});
