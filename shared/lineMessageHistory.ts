export type LineMessageHistoryItem = {
  id?: number | string | null;
  lineTimestamp?: number | string | null;
  createdAt: Date | string | number;
};

export function resolveLineMessageEventTime(item: LineMessageHistoryItem): number {
  if (item.lineTimestamp !== null && item.lineTimestamp !== undefined) {
    const lineTimestamp = Number(item.lineTimestamp);
    if (Number.isFinite(lineTimestamp)) return lineTimestamp;
  }
  const createdAt = new Date(item.createdAt).getTime();
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function resolveStableId(item: LineMessageHistoryItem): number {
  const id = Number(item.id);
  return Number.isFinite(id) ? id : 0;
}

/** Returns a new oldest-to-newest array without mutating the tRPC cache. */
export function sortLineMessagesChronologically<T extends LineMessageHistoryItem>(messages: readonly T[]): T[] {
  return [...messages].sort((left, right) => {
    const timeDifference = resolveLineMessageEventTime(left) - resolveLineMessageEventTime(right);
    if (timeDifference !== 0) return timeDifference;

    const createdDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdDifference !== 0) return createdDifference;

    return resolveStableId(left) - resolveStableId(right);
  });
}
