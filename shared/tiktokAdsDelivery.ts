export type TikTokDeliveryState = "delivering" | "parent_paused" | "paused" | "pending" | "limited" | "deleted" | "enabled";

const NON_DELIVERING_MARKERS = [
  "DISABLE",
  "DELETE",
  "ENDED",
  "REJECT",
  "NOT_DELIVER",
  "CAMPAIGN_DISABLE",
  "ADGROUP_DISABLE",
];

export function resolveTikTokDeliveryState(input: {
  operationStatus?: string | null;
  secondaryStatus?: string | null;
  parentDelivering?: boolean;
}): TikTokDeliveryState {
  const operation = String(input.operationStatus ?? "").toUpperCase();
  const secondary = String(input.secondaryStatus ?? "").toUpperCase();
  if (operation.includes("DELETE") || secondary.includes("DELETE")) return "deleted";
  if (operation !== "ENABLE") return "paused";
  if (input.parentDelivering === false || secondary.includes("CAMPAIGN_DISABLE") || secondary.includes("ADGROUP_DISABLE")) {
    return "parent_paused";
  }
  if (secondary.includes("PENDING") || secondary.includes("REVIEW")) return "pending";
  if (secondary.includes("LIMIT") || secondary.includes("PARTIAL")) return "limited";
  if (NON_DELIVERING_MARKERS.some(marker => secondary.includes(marker))) return "paused";
  if (secondary.includes("ENABLE") || secondary.includes("DELIVERING")) return "delivering";
  return "enabled";
}

export function isTikTokEffectivelyDelivering(state: TikTokDeliveryState): boolean {
  return state === "delivering";
}

export function getTikTokDeliveryLabel(state: TikTokDeliveryState): string {
  switch (state) {
    case "delivering": return "投放中";
    case "parent_paused": return "上层已暂停";
    case "paused": return "已暂停";
    case "pending": return "审核中";
    case "limited": return "投放受限";
    case "deleted": return "已删除";
    default: return "已启用";
  }
}
