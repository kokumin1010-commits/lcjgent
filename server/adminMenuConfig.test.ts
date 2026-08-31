import { describe, expect, it } from "vitest";
import {
  ADMIN_MENU_GROUPS,
  ADMIN_MENU_ITEMS,
  canViewDepartmentMenuItem,
  getActiveAdminMenuItem,
  getAdminMenuGroupId,
  normalizeAdminMenuPath,
} from "../client/src/lib/adminMenuConfig";

describe("department admin menu", () => {
  it("keeps all existing menu entries under the confirmed department structure", () => {
    expect(ADMIN_MENU_GROUPS.map(group => group.labelZh)).toEqual([
      "我的工作",
      "运营部",
      "采购部",
      "商务部",
      "达人部",
      "广告投流部",
      "IT部",
      "设计部",
      "财务部",
      "人事部",
      "短视频运营部",
    ]);
    expect(ADMIN_MENU_ITEMS).toHaveLength(59);
    expect(new Set(ADMIN_MENU_ITEMS.map(item => item.path)).size).toBe(
      ADMIN_MENU_ITEMS.length
    );
  });

  it("places representative business pages in the intended departments", () => {
    const groupForPath = (path: string) =>
      ADMIN_MENU_GROUPS.find(group =>
        group.items.some(item => item.path === path)
      )?.labelZh;

    expect(groupForPath("/master/lcj-brain")).toBe("我的工作");
    expect(groupForPath("/master/issues")).toBe("我的工作");
    expect(groupForPath("/tiktok-competitor-daily")).toBe("运营部");
    expect(groupForPath("/master/selection-center")).toBe("运营部");
    expect(groupForPath("/master/selection-center?tab=products")).toBe("采购部");
    expect(groupForPath("/master/sample-requests")).toBe("采购部");
    expect(groupForPath("/master/selection-center?tab=cost-management")).toBe("采购部");
    expect(groupForPath("/master/product-requests")).toBe("采购部");
    expect(groupForPath("/master/blog")).toBe("商务部");
    expect(groupForPath("/master/referral")).toBe("商务部");
    expect(groupForPath("/master/step-email")).toBe("商务部");
    expect(groupForPath("/master/step-email/logs")).toBe("商务部");
    expect(groupForPath("/master/step-email/analytics")).toBe("商务部");
    expect(groupForPath("/master/livers")).toBe("达人部");
    expect(groupForPath("/master/ad-dashboard")).toBe("广告投流部");
    expect(groupForPath("/master/system-users")).toBe("IT部");
    expect(
      ADMIN_MENU_GROUPS.find(group => group.labelZh === "IT部")?.items.some(
        item => item.path === "/master/issues"
      )
    ).toBe(false);
    expect(groupForPath("/master/set-image-generator")).toBe("设计部");
    expect(groupForPath("/master/finance")).toBe("财务部");
    expect(groupForPath("/master/hr")).toBe("人事部");
    expect(groupForPath("/master/short-video")).toBe("短视频运营部");
  });

  it("matches query strings and the most specific nested route only", () => {
    expect(normalizeAdminMenuPath("/master/selection-center?tab=auction")).toBe(
      "/master/selection-center"
    );
    expect(
      getActiveAdminMenuItem("/master/selection-center?tab=auction")?.path
    ).toBe("/master/selection-center");
    expect(
      getActiveAdminMenuItem("/master/selection-center?tab=products")?.path
    ).toBe("/master/selection-center?tab=products");
    expect(
      getActiveAdminMenuItem("/master/selection-center?tab=cost-management")?.path
    ).toBe("/master/selection-center?tab=cost-management");
    expect(
      getAdminMenuGroupId("/master/selection-center?tab=cost-management")
    ).toBe("procurement");
    expect(getActiveAdminMenuItem("/master/step-email/logs/42")?.path).toBe(
      "/master/step-email/logs"
    );
    expect(getAdminMenuGroupId("/master/mall/member/1200067")).toBe(
      "operations"
    );
  });

  it("shows every menu to admins regardless of custom role permissions", () => {
    for (const item of ADMIN_MENU_ITEMS) {
      expect(
        canViewDepartmentMenuItem({
          path: item.path,
          adminOnly: item.adminOnly,
          userRole: "admin",
          permissionsData: { isAdmin: true, permissions: [] },
          permissionsLoading: false,
        })
      ).toBe(true);
    }
  });

  it("shows non-admin staff only pages granted by their role", () => {
    const permissionsData = {
      isAdmin: false,
      permissions: [{ pageKey: "/master/finance", canView: true }],
    };
    expect(
      canViewDepartmentMenuItem({
        path: "/master/finance",
        userRole: "user",
        permissionsData,
        permissionsLoading: false,
      })
    ).toBe(true);
    expect(
      canViewDepartmentMenuItem({
        path: "/master/hr",
        userRole: "user",
        permissionsData,
        permissionsLoading: false,
      })
    ).toBe(false);
    const selectionPermissions = {
      isAdmin: false,
      permissions: [{ pageKey: "/master/selection-center", canView: true }],
    };
    for (const path of [
      "/master/selection-center?tab=products",
      "/master/selection-center?tab=cost-management",
    ]) {
      expect(
        canViewDepartmentMenuItem({
          path,
          userRole: "user",
          permissionsData: selectionPermissions,
          permissionsLoading: false,
        })
      ).toBe(true);
    }
    const costOnlyPermissions = {
      isAdmin: false,
      permissions: [
        {
          pageKey: "/master/selection-center?tab=cost-management",
          canView: true,
        },
      ],
    };
    expect(
      canViewDepartmentMenuItem({
        path: "/master/selection-center?tab=cost-management",
        userRole: "user",
        permissionsData: costOnlyPermissions,
        permissionsLoading: false,
      })
    ).toBe(true);
    expect(
      canViewDepartmentMenuItem({
        path: "/master/selection-center?tab=products",
        userRole: "user",
        permissionsData: costOnlyPermissions,
        permissionsLoading: false,
      })
    ).toBe(false);
    expect(
      canViewDepartmentMenuItem({
        path: "/master/system-users",
        adminOnly: true,
        userRole: "user",
        permissionsData: {
          isAdmin: false,
          permissions: [{ pageKey: "/master/system-users", canView: true }],
        },
        permissionsLoading: false,
      })
    ).toBe(false);
  });

  it("does not treat dashboard-only access as permission for every master page", () => {
    expect(
      canViewDepartmentMenuItem({
        path: "/master/brands",
        userRole: "user",
        permissionsData: {
          isAdmin: false,
          permissions: [{ pageKey: "/master", canView: true }],
        },
        permissionsLoading: false,
      })
    ).toBe(false);
  });
});
