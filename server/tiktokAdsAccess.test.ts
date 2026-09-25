import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, getUserManagementAccessMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getUserManagementAccessMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./userManagementAccess", () => ({ getUserManagementAccess: getUserManagementAccessMock }));

import {
  getTikTokAdsPageAccess,
  hasTikTokAdsPagePermission,
  requireTikTokAdsOperateAccess,
  requireTikTokAdsPageAccess,
} from "./tiktokAdsAccess";

beforeEach(() => {
  vi.clearAllMocks();
  getUserManagementAccessMock.mockResolvedValue({ isSuperAdmin: false });
});

describe("TikTok Ads page access", () => {
  it("allows technical and hierarchy admins without querying role permissions", async () => {
    await expect(requireTikTokAdsPageAccess({ id: 1, role: "admin" })).resolves.toBeUndefined();
    expect(getDbMock).not.toHaveBeenCalled();

    getDbMock.mockResolvedValue({ execute: vi.fn() });
    getUserManagementAccessMock.mockResolvedValue({ isSuperAdmin: true });
    await expect(requireTikTokAdsPageAccess({ id: 2, role: "user" })).resolves.toBeUndefined();
  });

  it("allows only an explicit view grant for the TikTok Ads page", () => {
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/tiktok-ads", canView: true, canEdit: false }] })).toBe(true);
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/ad-dashboard", canView: true, canEdit: false }] })).toBe(true);
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/store-management", canView: true, canEdit: true }] })).toBe(false);
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/tiktok-ads", canView: false, canEdit: false }] })).toBe(false);
    expect(hasTikTokAdsPagePermission({ permissions: null })).toBe(false);
  });

  it("fails closed for authenticated users without the page grant", async () => {
    getDbMock.mockResolvedValue({ execute: vi.fn().mockResolvedValue([[]]) });
    await expect(requireTikTokAdsPageAccess({ id: 3, role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a non-admin with the exact page grant", async () => {
    getDbMock.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ pageKey: "/master/tiktok-ads", canView: 1, canEdit: 0 }]]),
    });
    await expect(requireTikTokAdsPageAccess({ id: 4, role: "user" })).resolves.toBeUndefined();
  });

  it("requires canEdit for live TikTok operations while preserving view-only access", async () => {
    getDbMock.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ pageKey: "/master/tiktok-ads", canView: 1, canEdit: 0 }]]),
    });
    await expect(requireTikTokAdsPageAccess({ id: 5, role: "user" })).resolves.toBeUndefined();
    await expect(requireTikTokAdsOperateAccess({ id: 5, role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    getDbMock.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ pageKey: "/master/ad-dashboard", canView: 1, canEdit: 1 }]]),
    });
    await expect(getTikTokAdsPageAccess({ id: 6, role: "user" })).resolves.toMatchObject({
      canView: true,
      canOperate: false,
      isAdmin: false,
    });

    getDbMock.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ pageKey: "/master/tiktok-ads", canView: 1, canEdit: 1 }]]),
    });
    await expect(requireTikTokAdsOperateAccess({ id: 7, role: "user" })).resolves.toMatchObject({ canOperate: true });
  });
});
