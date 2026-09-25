import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";

export const TIKTOK_ADS_PAGE_KEY = "/master/tiktok-ads";
export const EXISTING_ADS_DASHBOARD_PAGE_KEY = "/master/ad-dashboard";

type PermissionRow = {
  pageKey: string;
  canView: boolean | number | string | null;
  canEdit: boolean | number | string | null;
};

function enabled(value: PermissionRow["canView"]): boolean {
  return value === true || value === 1 || value === "1";
}

function isTikTokAdsPermissionKey(pageKey: string): boolean {
  const normalized = pageKey.split(/[?#]/, 1)[0] || "/";
  return normalized === TIKTOK_ADS_PAGE_KEY || normalized === EXISTING_ADS_DASHBOARD_PAGE_KEY;
}

function isDedicatedTikTokAdsPermissionKey(pageKey: string): boolean {
  const normalized = pageKey.split(/[?#]/, 1)[0] || "/";
  return normalized === TIKTOK_ADS_PAGE_KEY;
}

export function resolveTikTokAdsPageAccess(input: {
  userRole?: string | null;
  isSuperAdmin?: boolean;
  permissions?: readonly PermissionRow[] | null;
}) {
  if (input.userRole === "admin" || input.isSuperAdmin === true) {
    return { canView: true, canOperate: true, isAdmin: true };
  }
  const permissions = input.permissions ?? [];
  const canView = permissions.some(permission =>
    isTikTokAdsPermissionKey(permission.pageKey) && enabled(permission.canView)
  );
  const canOperate = permissions.some(permission =>
    isDedicatedTikTokAdsPermissionKey(permission.pageKey) && enabled(permission.canEdit)
  );
  return { canView: canView || canOperate, canOperate, isAdmin: false };
}

export function hasTikTokAdsPagePermission(input: {
  userRole?: string | null;
  isSuperAdmin?: boolean;
  permissions?: readonly PermissionRow[] | null;
}): boolean {
  return resolveTikTokAdsPageAccess(input).canView;
}

export async function getTikTokAdsPageAccess(user: {
  id: number;
  role?: string | null;
}) {
  if (user.role === "admin") {
    return { canView: true, canOperate: true, isAdmin: true };
  }
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "TikTok广告权限を確認できません" });
  }
  const managementAccess = await getUserManagementAccess(db, user.id);
  if (managementAccess.isSuperAdmin) {
    return { canView: true, canOperate: true, isAdmin: true };
  }

  const result = await db.execute(sql`
    SELECT permission.pageKey, permission.canView, permission.canEdit
    FROM user_role_assignments assignment
    JOIN role_permissions permission ON permission.roleId = assignment.roleId
    WHERE assignment.userId = ${user.id}
      AND permission.pageKey IN (${TIKTOK_ADS_PAGE_KEY}, ${EXISTING_ADS_DASHBOARD_PAGE_KEY})
  `);
  const rows = ((result as unknown as [PermissionRow[]])[0] ?? []);
  return resolveTikTokAdsPageAccess({ userRole: user.role, permissions: rows });
}

export async function requireTikTokAdsPageAccess(user: {
  id: number;
  role?: string | null;
}): Promise<void> {
  const access = await getTikTokAdsPageAccess(user);
  if (!access.canView) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TikTok广告司令塔の閲覧権限がありません" });
  }
}

export async function requireTikTokAdsOperateAccess(user: {
  id: number;
  role?: string | null;
}) {
  const access = await getTikTokAdsPageAccess(user);
  if (!access.canOperate) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TikTok广告司令塔の操作権限がありません" });
  }
  return access;
}
