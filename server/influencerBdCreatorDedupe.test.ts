import { describe, expect, it } from "vitest";
import {
  buildInfluencerCreatorDedupeGroups,
  hasMeaningfulCreatorName,
  mergeInfluencerCreatorGroup,
  normalizeInfluencerCreatorAccountId,
  normalizedInfluencerCreatorRowAccountId,
  selectInfluencerCreatorKeeper,
  type InfluencerCreatorDedupeRow,
} from "./influencerBdCreatorDedupe";

const row = (overrides: Partial<InfluencerCreatorDedupeRow>): InfluencerCreatorDedupeRow => ({
  id: 1,
  displayName: "creator.one",
  platform: "TikTok",
  handle: "creator.one",
  normalizedHandle: null,
  ...overrides,
});

describe("influencer creator account dedupe", () => {
  it("normalizes account IDs before grouping", () => {
    expect(normalizeInfluencerCreatorAccountId("  @@Creator.ONE ")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("＠Creator.ONE")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("creator.one/?lang=ja")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("https://www.tiktok.com/@Creator.ONE?lang=ja", "TikTok")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("https://www.instagram.com/Creator.ONE/", "Instagram")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("https://x.com/Creator.ONE", "X")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("https://page.line.me/Creator.ONE", "LINE")).toBe("creator.one");
    expect(normalizeInfluencerCreatorAccountId("https://example.invalid/Creator.ONE", "Instagram")).toBeNull();
    expect(normalizeInfluencerCreatorAccountId(null)).toBeNull();
    expect(normalizedInfluencerCreatorRowAccountId(row({
      platform: "Instagram",
      handle: "https://example.invalid/bad",
      normalizedHandle: "creator.one",
    }))).toBe("creator.one");
  });

  it("keeps the active row with a real TikTok display name", () => {
    const unnamed = row({ id: 10, displayName: "creator.one", outreachCount: 9, attachmentCount: 4 });
    const named = row({ id: 11, displayName: "真实达人名称", outreachCount: 0, attachmentCount: 0 });
    expect(hasMeaningfulCreatorName(unnamed)).toBe(false);
    expect(hasMeaningfulCreatorName(named)).toBe(true);
    expect(selectInfluencerCreatorKeeper([unnamed, named]).id).toBe(11);
  });

  it("groups case and at-sign variants only within the same platform", () => {
    const groups = buildInfluencerCreatorDedupeGroups([
      row({ id: 1, handle: "@Creator.ONE" }),
      row({ id: 2, handle: "creator.one", displayName: "达人名称" }),
      row({ id: 3, platform: "Instagram", handle: "creator.one" }),
    ]);
    const duplicate = groups.find(group => group.duplicates.length > 0);
    expect(duplicate).toMatchObject({ platform: "TikTok", normalizedHandle: "creator.one" });
    expect(duplicate?.keeper.id).toBe(2);
    expect(duplicate?.duplicates.map(item => item.id)).toEqual([1]);
  });

  it("never groups distinct profile URLs on Instagram, X or LINE as one https account", () => {
    const groups = buildInfluencerCreatorDedupeGroups([
      row({ id: 31, platform: "Instagram", handle: "https://www.instagram.com/alpha/" }),
      row({ id: 32, platform: "Instagram", handle: "https://www.instagram.com/beta/" }),
      row({ id: 33, platform: "X", handle: "https://x.com/alpha" }),
      row({ id: 34, platform: "X", handle: "https://x.com/beta" }),
      row({ id: 35, platform: "LINE", handle: "https://page.line.me/alpha" }),
      row({ id: 36, platform: "LINE", handle: "https://page.line.me/beta" }),
    ]);
    expect(groups).toHaveLength(6);
    expect(groups.every(group => group.duplicates.length === 0)).toBe(true);
    expect(groups.map(group => group.normalizedHandle)).toEqual(["alpha", "beta", "alpha", "beta", "alpha", "beta"]);
  });

  it("merges complementary fields and preserves the newest relationship timestamps", () => {
    const rows = [
      row({
        id: 20,
        displayName: "达人名称",
        handle: "@creator.one",
        profileUrl: null,
        followerCount: 100,
        category: "美妆",
        ownerStaffId: 7,
        ownerStaffName: "负责人",
        status: "contacting",
        notes: "名称已确认",
        lastContactAt: "2026-09-01T00:00:00.000Z",
      }),
      row({
        id: 21,
        displayName: "creator.one",
        profileUrl: "https://www.tiktok.com/@creator.one",
        followerCount: 220,
        country: "日本",
        language: "日本語",
        contactInfo: "contact-one",
        status: "cooperating",
        notes: "合作记录",
        lastContactAt: "2026-09-20T00:00:00.000Z",
        lastReplyAt: "2026-09-21T00:00:00.000Z",
      }),
    ];
    const group = buildInfluencerCreatorDedupeGroups(rows)[0];
    const merged = mergeInfluencerCreatorGroup(group);
    expect(merged).toMatchObject({
      displayName: "达人名称",
      handle: "creator.one",
      normalizedHandle: "creator.one",
      profileUrl: "https://www.tiktok.com/@creator.one",
      followerCount: 220,
      category: "美妆",
      country: "日本",
      language: "日本語",
      ownerStaffId: 7,
      ownerStaffName: "负责人",
      status: "cooperating",
      lastContactAt: "2026-09-20T00:00:00.000Z",
      lastReplyAt: "2026-09-21T00:00:00.000Z",
    });
    expect(merged.notes).toContain("名称已确认");
    expect(merged.notes).toContain("合作记录");
  });
});
