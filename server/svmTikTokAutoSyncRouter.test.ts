import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./shortVideoDailyRouter", () => ({
  resolveShortVideoDailyAccess: vi.fn(),
}));
vi.mock("./tiktokPublicMonitorService", () => ({
  syncTikTokPublicAccount: vi.fn(),
}));

import { getDb } from "./db";
import { resolveShortVideoDailyAccess } from "./shortVideoDailyRouter";
import { syncTikTokPublicAccount } from "./tiktokPublicMonitorService";
import { svmRouter } from "./svmRouter";

function createDb(existing: Array<{ id: number }> = []) {
  const values = vi.fn().mockResolvedValue([{ insertId: 71 }]);
  const limit = vi.fn().mockResolvedValue(existing);
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit })),
      })),
    })),
    insert: vi.fn(() => ({ values })),
  };
  return { db, values, limit };
}

function caller() {
  return svmRouter.createCaller({
    user: { id: 1, openId: "test-user", name: "Tester", role: "admin" },
    req: { headers: {} },
    res: {},
  } as never);
}

const input = {
  accountName: "typed-name",
  displayName: "LCJ Test",
  platform: "tiktok" as const,
  category: "beauty",
  assignedTo: "operator",
  followerCount: 0,
  profileUrl: "https://www.tiktok.com/@realSeller?lang=ja",
  avatarUrl: "",
  description: "",
  tags: "",
  status: "active" as const,
  targetPostsPerDay: 1,
};

describe("svm matrix account auto monitoring route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveShortVideoDailyAccess).mockResolvedValue({
      canView: true,
      canEdit: true,
    } as never);
    vi.mocked(syncTikTokPublicAccount).mockResolvedValue({
      accountId: 71,
      username: "realSeller",
      discoveredVideos: 3,
      updatedVideos: 25,
      nextSyncAt: "2026-09-01T12:00:00.000Z",
    } as never);
  });

  it("normalizes the Profile URL, enables monitoring and runs the first sync", async () => {
    const { db, values } = createDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await caller().createAccount(input);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        accountName: "realSeller",
        profileUrl: "https://www.tiktok.com/@realSeller",
        monitorEnabled: true,
        publicProvider: "rapidapi_tikwm",
        publicSyncStatus: "pending",
      })
    );
    expect(syncTikTokPublicAccount).toHaveBeenCalledWith(71, "register");
    expect(result).toMatchObject({
      success: true,
      id: 71,
      autoSync: { status: "success", discoveredVideos: 3, updatedVideos: 25 },
    });
  });

  it("rejects monitoring before insert when the user lacks edit access", async () => {
    const { db, values } = createDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(resolveShortVideoDailyAccess).mockResolvedValue({
      canView: true,
      canEdit: false,
    } as never);

    await expect(caller().createAccount(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(values).not.toHaveBeenCalled();
    expect(syncTikTokPublicAccount).not.toHaveBeenCalled();
  });

  it("keeps the saved account pending when the provider fails", async () => {
    const { db, values } = createDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(syncTikTokPublicAccount).mockRejectedValue(
      new Error("TikTok provider HTTP 500 mysql://secret@host/database")
    );

    const result = await caller().createAccount(input);

    expect(values).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.autoSync).toMatchObject({ status: "pending" });
    expect(result.autoSync?.warning).toContain("账号已保存");
    expect(result.autoSync?.warning).not.toContain("secret");
  });

  it("rejects duplicate active TikTok usernames before insert", async () => {
    const { db, values } = createDb([{ id: 8 }]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(caller().createAccount(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(values).not.toHaveBeenCalled();
    expect(syncTikTokPublicAccount).not.toHaveBeenCalled();
  });
});
