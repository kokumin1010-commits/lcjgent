import { describe, expect, it } from "vitest";
import {
  compareLineGroupLifecycleOrder,
  getLineWebhookLifecycleEventId,
  shouldApplyLineGroupLifecycleEvent,
} from "./lineGroupLifecycleOrder";

describe("LINE group lifecycle ordering", () => {
  const current = { eventTimestamp: 1_800_000_000_000, eventId: "event-b" };

  it("accepts a newer timestamp", () => {
    expect(
      shouldApplyLineGroupLifecycleEvent(
        { eventTimestamp: current.eventTimestamp + 1, eventId: "event-a" },
        current
      )
    ).toBe(true);
  });

  it("rejects an older timestamp", () => {
    expect(
      shouldApplyLineGroupLifecycleEvent(
        { eventTimestamp: current.eventTimestamp - 1, eventId: "event-z" },
        current
      )
    ).toBe(false);
  });

  it("rejects a redelivery with the same timestamp and event ID", () => {
    expect(shouldApplyLineGroupLifecycleEvent(current, current)).toBe(false);
  });

  it("uses event ID as a deterministic same-millisecond tie-breaker", () => {
    const earlierId = { ...current, eventId: "event-a" };
    const laterId = { ...current, eventId: "event-c" };

    expect(compareLineGroupLifecycleOrder(earlierId, current)).toBeLessThan(0);
    expect(compareLineGroupLifecycleOrder(laterId, current)).toBeGreaterThan(0);
    expect(shouldApplyLineGroupLifecycleEvent(earlierId, current)).toBe(false);
    expect(shouldApplyLineGroupLifecycleEvent(laterId, current)).toBe(true);
  });

  it("always prioritizes a LINE webhook over a local reconciliation at the same millisecond", () => {
    const localSync = {
      eventTimestamp: current.eventTimestamp,
      eventId: "sync:1800000000000:C-group",
    };

    expect(compareLineGroupLifecycleOrder(current, localSync)).toBeGreaterThan(0);
    expect(compareLineGroupLifecycleOrder(localSync, current)).toBeLessThan(0);
    expect(shouldApplyLineGroupLifecycleEvent(current, localSync)).toBe(true);
    expect(shouldApplyLineGroupLifecycleEvent(localSync, current)).toBe(false);
  });

  it("keeps a webhook without an event ID in the real-webhook priority class", () => {
    const generatedId = getLineWebhookLifecycleEventId({
      eventTimestamp: current.eventTimestamp,
      eventType: "join",
      lineGroupId: "C-group",
    });
    const localSync = {
      eventTimestamp: current.eventTimestamp,
      eventId: "sync:1800000000000:C-group",
    };

    expect(generatedId).toMatch(/^webhook:/);
    expect(
      shouldApplyLineGroupLifecycleEvent(
        { eventTimestamp: current.eventTimestamp, eventId: generatedId },
        localSync
      )
    ).toBe(true);
  });

  it("accepts the first lifecycle event", () => {
    expect(shouldApplyLineGroupLifecycleEvent(current, null)).toBe(true);
  });
});
