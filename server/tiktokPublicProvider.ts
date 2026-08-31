import {
  normalizeTikTokPublicMetrics,
  normalizeTikTokVideoMetrics,
  TIKTOK_PUBLIC_PROFILE_BASE,
} from "../shared/tiktokPublicMonitor";

const RAPIDAPI_HOST = "tiktok-scraper7.p.rapidapi.com";
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;
const RAPIDAPI_MIN_INTERVAL_MS = 1_250;
const RAPIDAPI_MAX_RETRY_AFTER_MS = 20_000;
let rapidApiQueue: Promise<unknown> = Promise.resolve();
let nextRapidApiRequestAt = 0;

function wait(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

export type PublicTikTokAccount = {
  externalUserId: string | null;
  secUid: string | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  verified: boolean;
  privateAccount: boolean;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
};

export type PublicTikTokVideo = {
  externalVideoId: string;
  videoUrl: string;
  title: string | null;
  coverUrl: string | null;
  duration: number;
  publishedAt: Date;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string | null {
  const result = String(value ?? "").trim();
  return result ? result : null;
}
function integer(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}
function flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}
function apiKey(): string {
  const key = process.env.RAPIDAPI_KEY?.trim();
  if (!key) throw new Error("RAPIDAPI_KEY is not configured");
  return key;
}
async function queuedRequest(
  path: string,
  params: Record<string, string | number>
) {
  const operation = rapidApiQueue.then(async () => {
    const delay = Math.max(0, nextRapidApiRequestAt - Date.now());
    if (delay) await wait(delay);

    const url = new URL(path, RAPIDAPI_BASE);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, String(value))
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      nextRapidApiRequestAt = Date.now() + RAPIDAPI_MIN_INTERVAL_MS;
      const response = await fetch(url, {
        headers: {
          "x-rapidapi-key": apiKey(),
          "x-rapidapi-host": RAPIDAPI_HOST,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        const payload = record(await response.json());
        if (Number(payload.code ?? 0) !== 0) {
          throw new Error(
            `TikTok provider error: ${String(payload.msg || payload.message || "unknown")}`
          );
        }
        return record(payload.data);
      }

      const retryAfterSeconds = Number(
        response.headers.get("retry-after") || 0
      );
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? Math.ceil(retryAfterSeconds * 1000)
        : 0;
      if (
        response.status === 429 &&
        attempt === 0 &&
        retryAfterMs > 0 &&
        retryAfterMs <= RAPIDAPI_MAX_RETRY_AFTER_MS
      ) {
        await wait(Math.max(RAPIDAPI_MIN_INTERVAL_MS, retryAfterMs));
        continue;
      }
      const remaining = response.headers.get("x-ratelimit-requests-remaining");
      const suffix =
        response.status === 429 && remaining === "0"
          ? " (request quota exhausted)"
          : response.status === 429
            ? " (rate limited)"
            : "";
      throw new Error(`TikTok provider HTTP ${response.status}${suffix}`);
    }
    throw new Error("TikTok provider retry exhausted");
  });
  rapidApiQueue = operation.catch(() => undefined);
  return operation;
}

async function request(path: string, params: Record<string, string | number>) {
  return queuedRequest(path, params);
}

export function parsePublicAccountPayload(
  data: Record<string, unknown>,
  fallbackUsername: string
): PublicTikTokAccount {
  const user = record(data.user ?? data.author ?? data);
  const stats = record(data.stats ?? data.statistics ?? user.stats);
  const merged = { ...user, ...stats };
  const metrics = normalizeTikTokPublicMetrics(merged);
  const username =
    text(user.uniqueId ?? user.unique_id ?? user.username) || fallbackUsername;
  return {
    externalUserId: text(user.id ?? user.uid ?? user.user_id),
    secUid: text(user.secUid ?? user.sec_uid),
    username,
    displayName: text(user.nickname ?? user.display_name),
    avatarUrl: text(user.avatarLarger ?? user.avatar_medium ?? user.avatar),
    bio: text(user.signature ?? user.bio),
    verified: flag(user.verified),
    privateAccount: flag(user.privateAccount ?? user.private_account),
    ...metrics,
  };
}

export function parsePublicVideoPayload(
  value: unknown,
  username: string
): PublicTikTokVideo | null {
  const item = record(value);
  const author = record(item.author);
  const videoId = text(item.video_id ?? item.id ?? item.aweme_id);
  if (!videoId) return null;
  const metrics = normalizeTikTokVideoMetrics({
    ...record(item.statistics),
    ...item,
  });
  const epoch = integer(item.create_time ?? item.createTime);
  if (epoch <= 0) return null;
  const publishedAt = new Date(epoch * 1000);
  if (Number.isNaN(publishedAt.getTime())) return null;
  return {
    externalVideoId: videoId,
    videoUrl:
      text(item.video_url ?? item.url ?? item.share_url) ||
      `${TIKTOK_PUBLIC_PROFILE_BASE}${text(author.unique_id ?? author.uniqueId) || username}/video/${videoId}`,
    title: text(item.title ?? item.desc),
    coverUrl: text(item.cover ?? item.origin_cover ?? item.dynamic_cover),
    duration: integer(item.duration),
    publishedAt,
    ...metrics,
  };
}

export async function fetchPublicTikTokAccount(username: string) {
  const data = await request("/user/info", { unique_id: username });
  return parsePublicAccountPayload(data, username);
}

export async function fetchPublicTikTokVideos(username: string, count = 35) {
  const data = await request("/user/posts", {
    unique_id: username,
    count,
    cursor: 0,
  });
  const values = Array.isArray(data.videos)
    ? data.videos
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.aweme_list)
        ? data.aweme_list
        : [];
  return values
    .map(value => parsePublicVideoPayload(value, username))
    .filter((value): value is PublicTikTokVideo => value !== null);
}

export const TIKTOK_PUBLIC_API_HOST = RAPIDAPI_HOST;
export const TIKTOK_PUBLIC_MIN_INTERVAL_MS = RAPIDAPI_MIN_INTERVAL_MS;
