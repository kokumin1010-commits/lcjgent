export type LineGroupLifecycleOrder = {
  eventTimestamp: number;
  eventId: string;
};

function isSyntheticLifecycleEvent(eventId: string): boolean {
  return eventId.startsWith("local:") || eventId.startsWith("sync:");
}

export function getLineWebhookLifecycleEventId(input: {
  webhookEventId?: string | null;
  eventTimestamp: number;
  eventType: "join" | "leave";
  lineGroupId: string;
}): string {
  const providedId = input.webhookEventId?.trim();
  if (providedId) return providedId.slice(0, 64);

  return `webhook:${input.eventTimestamp}:${input.eventType}:${input.lineGroupId}`.slice(
    0,
    64
  );
}

/**
 * Compare LINE group lifecycle events deterministically.
 * Timestamp is authoritative. Event ID is the stable tie-breaker when LINE
 * emits two events in the same millisecond; identical IDs are redeliveries.
 */
export function compareLineGroupLifecycleOrder(
  incoming: LineGroupLifecycleOrder,
  current: LineGroupLifecycleOrder
): number {
  if (incoming.eventTimestamp !== current.eventTimestamp) {
    return incoming.eventTimestamp > current.eventTimestamp ? 1 : -1;
  }

  const incomingSynthetic = isSyntheticLifecycleEvent(incoming.eventId);
  const currentSynthetic = isSyntheticLifecycleEvent(current.eventId);
  if (incomingSynthetic !== currentSynthetic) {
    return incomingSynthetic ? -1 : 1;
  }

  if (incoming.eventId === current.eventId) return 0;
  return incoming.eventId > current.eventId ? 1 : -1;
}

export function shouldApplyLineGroupLifecycleEvent(
  incoming: LineGroupLifecycleOrder,
  current: LineGroupLifecycleOrder | null
): boolean {
  if (!current) return true;
  return compareLineGroupLifecycleOrder(incoming, current) > 0;
}
