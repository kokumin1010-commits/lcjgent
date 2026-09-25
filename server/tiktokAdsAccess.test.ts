import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, getUserManagementAccessMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getUserManagementAccessMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./userManagementAccess", () => ({ getUserManagementAccess: getUserManagementAccessMock }));

import {
  hasTikTokAdsPagePermission,
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
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/tiktok-ads", canView: true }] })).toBe(true);
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/ad-dashboard", canView: true }] })).toBe(true);
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/store-management", canView: true }] })).toBe(false);
    expect(hasTikTokAdsPagePermission({ permissions: [{ pageKey: "/master/tiktok-ads", canView: false }] })).toBe(false);
    expect(hasTikTokAdsPagePermission({ permissions: null })).toBe(false);
  });

  it("fails closed for authenticated users without the page grant", async () => {
    getDbMock.mockResolvedValue({ execute: vi.fn().mockResolvedValue([[]]) });
    await expect(requireTikTokAdsPageAccess({ id: 3, role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a non-admin with the exact page grant", async () => {
    getDbMock.mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ pageKey: "/master/tiktok-ads", canView: 1 }]]),
    });
    await expect(requireTikTokAdsPageAccess({ id: 4, role: "user" })).resolves.toBeUndefined();
  });
});
