import { afterEach, describe, expect, it, vi } from "vitest";
import {
  metricGrowth,
  nextTikTokSyncDelayHours,
  normalizeTikTokPublicMetrics,
  normalizeTikTokUsername,
  normalizeTikTokVideoMetrics,
  parseTikTokAccountLines,
} from "../shared/tiktokPublicMonitor";
import {
  fetchPublicTikTokAccount,
  fetchPublicTikTokVideos,
  parsePublicAccountPayload,
  parsePublicVideoPayload,
  TIKTOK_PUBLIC_API_HOST,
} from "./tiktokPublicProvider";

describe("TikTok public monitor rules", () => {
  it("normalizes profile URLs, @handles and deduplicates batch input", () => {
    expect(
      normalizeTikTokUsername(" https://www.tiktok.com/@LCJ.mall?lang=ja ")
    ).toBe("LCJ.mall");
    expect(normalizeTikTokUsername("@@seller_name")).toBe("seller_name");
    expect(normalizeTikTokUsername("https://example.com/@not-tiktok")).toBe("");
    expect(normalizeTikTokUsername("https://www.tiktok.com/@bad%ZZ")).toBe("");
    expect(
      parseTikTokAccountLines(
        "@one, https://www.tiktok.com/@two/video/123\n@one ， three"
      )
    ).toEqual(["one", "two", "three"]);
  });

  it("normalizes account and video metric aliases without sales fields", () => {
    expect(
      normalizeTikTokPublicMetrics({
        followerCount: "1200",
        following_count: 80,
        heart_count: 45_600,
        videoCount: 30,
      })
    ).toEqual({
      followerCount: 1200,
      followingCount: 80,
      heartCount: 45600,
      videoCount: 30,
    });
    const video = normalizeTikTokVideoMetrics({
      play_count: "9000",
      digg_count: 600,
      commentCount: 30,
      share_count: 12,
      collectCount: 18,
      orders: 99,
      gmv: 999999,
    });
    expect(video).toEqual({
      playCount: 9000,
      likeCount: 600,
      commentCount: 30,
      shareCount: 12,
      collectCount: 18,
    });
    expect(video).not.toHaveProperty("orders");
    expect(video).not.toHaveProperty("gmv");
  });

  it("uses 6h, 12h and 24h dynamic intervals and calculates snapshot growth", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");
    expect(nextTikTokSyncDelayHours(null, now)).toBe(6);
    expect(
      nextTikTokSyncDelayHours(new Date("2026-08-29T00:00:00.000Z"), now)
    ).toBe(6);
    expect(
      nextTikTokSyncDelayHours(new Date("2026-08-27T00:00:00.000Z"), now)
    ).toBe(12);
    expect(
      nextTikTokSyncDelayHours(new Date("2026-08-01T00:00:00.000Z"), now)
    ).toBe(24);
    expect(metricGrowth(150, 100)).toBe(50);
    expect(metricGrowth(150, null)).toBeNull();
  });
});

describe("TikTok RapidAPI provider", () => {
  const originalKey = process.env.RAPIDAPI_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.RAPIDAPI_KEY;
    else process.env.RAPIDAPI_KEY = originalKey;
  });

  it("parses TIKWM account fields and boolean values", () => {
    expect(
      parsePublicAccountPayload(
        {
          user: {
            id: "u-1",
            secUid: "sec-1",
            uniqueId: "SellerJP",
            nickname: "Seller Japan",
            avatarLarger: "https://cdn.example/avatar.jpg",
            signature: "official",
            verified: "1",
            privateAccount: "0",
          },
          stats: {
            followerCount: 120,
            followingCount: 30,
            heartCount: 5000,
            videoCount: 12,
          },
        },
        "fallback"
      )
    ).toMatchObject({
      externalUserId: "u-1",
      secUid: "sec-1",
      username: "SellerJP",
      displayName: "Seller Japan",
      verified: true,
      privateAccount: false,
      followerCount: 120,
      heartCount: 5000,
    });
  });

  it("parses public video metrics but rejects missing or invalid publication timestamps", () => {
    const parsed = parsePublicVideoPayload(
      {
        video_id: "v-1",
        create_time: 1788134400,
        desc: "new video",
        duration: 18,
        statistics: {
          play_count: 1000,
          digg_count: 90,
          comment_count: 8,
          share_count: 4,
          collect_count: 6,
        },
      },
      "seller"
    );
    expect(parsed).toMatchObject({
      externalVideoId: "v-1",
      videoUrl: "https://www.tiktok.com/@seller/video/v-1",
      playCount: 1000,
      likeCount: 90,
      collectCount: 6,
    });
    expect(parsePublicVideoPayload({ video_id: "v-2" }, "seller")).toBeNull();
    expect(
      parsePublicVideoPayload({ create_time: 1788134400 }, "seller")
    ).toBeNull();
  });

  it("calls only the configured RapidAPI host and parses list payload", async () => {
    process.env.RAPIDAPI_KEY = "unit-test-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            videos: [
              {
                id: "v-3",
                create_time: 1788134400,
                play_count: 10,
                digg_count: 2,
              },
              { id: "v-no-time" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const videos = await fetchPublicTikTokVideos("seller", 35);
    expect(videos).toHaveLength(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      `https://${TIKTOK_PUBLIC_API_HOST}/user/posts`
    );
    expect(String(url)).toContain("unique_id=seller");
    expect(options.headers["x-rapidapi-key"]).toBe("unit-test-secret");
  });

  it("does not include the RapidAPI key in provider errors", async () => {
    process.env.RAPIDAPI_KEY = "never-print-this-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("denied", { status: 403 }))
    );
    await expect(fetchPublicTikTokAccount("seller")).rejects.toThrow(
      "TikTok provider HTTP 403"
    );
    await expect(fetchPublicTikTokAccount("seller")).rejects.not.toThrow(
      "never-print-this-key"
    );
  });
});
