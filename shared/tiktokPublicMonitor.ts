export const TIKTOK_PUBLIC_PROVIDER = "tikwm" as const;
export const TIKTOK_PUBLIC_PROFILE_BASE = "https://www.tiktok.com/@";

export type TikTokPublicMetrics = {
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
};

export type TikTokVideoMetrics = {
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
};

function safeInteger(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.round(parsed));
}

export function normalizeTikTokUsername(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutQuery = trimmed.split(/[?#]/, 1)[0] || "";
  const match = withoutQuery.match(/(?:www\.)?tiktok\.com\/@([^/]+)/i);
  if (
    !match &&
    (/^[a-z][a-z0-9+.-]*:\/\//i.test(withoutQuery) ||
      withoutQuery.includes("/"))
  )
    return "";
  try {
    const username = decodeURIComponent(match?.[1] || withoutQuery)
      .replace(/^@+/, "")
      .trim();
    return username.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 255);
  } catch {
    return "";
  }
}

export function parseTikTokAccountLines(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,，\s]+/)
        .map(normalizeTikTokUsername)
        .filter(Boolean)
    ),
  ];
}

export function normalizeTikTokPublicMetrics(
  value: Record<string, unknown>
): TikTokPublicMetrics {
  return {
    followerCount: safeInteger(value.follower_count ?? value.followerCount),
    followingCount: safeInteger(value.following_count ?? value.followingCount),
    heartCount: safeInteger(value.heart_count ?? value.heartCount),
    videoCount: safeInteger(value.video_count ?? value.videoCount),
  };
}

export function normalizeTikTokVideoMetrics(
  value: Record<string, unknown>
): TikTokVideoMetrics {
  return {
    playCount: safeInteger(value.play_count ?? value.playCount),
    likeCount: safeInteger(
      value.digg_count ?? value.like_count ?? value.likeCount
    ),
    commentCount: safeInteger(value.comment_count ?? value.commentCount),
    shareCount: safeInteger(value.share_count ?? value.shareCount),
    collectCount: safeInteger(value.collect_count ?? value.collectCount),
  };
}

export function nextTikTokSyncDelayHours(
  newestPublishedAt: Date | null,
  now = new Date()
): number {
  if (!newestPublishedAt) return 6;
  const ageHours = Math.max(
    0,
    (now.getTime() - newestPublishedAt.getTime()) / 3_600_000
  );
  if (ageHours <= 72) return 6;
  if (ageHours <= 7 * 24) return 12;
  if (ageHours <= 30 * 24) return 24;
  return 24;
}

export function metricGrowth(
  current: number,
  previous: number | null
): number | null {
  if (previous == null) return null;
  return current - previous;
}
