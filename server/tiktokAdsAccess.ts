import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";

export const TIKTOK_ADS_PAGE_KEY = "/master/tiktok-ads";
export const EXISTING_ADS_DASHBOARD_PAGE_KEY = "/master/ad-dashboard";

type PermissionRow = {
  pageKey: string;
  canView: boolean | number | string | null;
};

export function hasTikTokAdsPagePermission(input: {
  userRole?: string | null;
  isSuperAdmin?: boolean;
  permissions?: readonly PermissionRow[] | null;
}): boolean {
  if (input.userRole === "admin" || input.isSuperAdmin === true) return true;
  if (!input.permissions) return false;
  return input.permissions.some(permission => {
    const allowed = permission.canView === true || permission.canView === 1 || permission.canView === "1";
    if (!allowed) return false;
    const normalized = permission.pageKey.split(/[?#]/, 1)[0] || "/";
    return normalized === TIKTOK_ADS_PAGE_KEY || normalized === EXISTING_ADS_DASHBOARD_PAGE_KEY;
  });
}

export async function requireTikTokAdsPageAccess(user: {
  id: number;
  role?: string | null;
}): Promise<void> {
  if (user.role === "admin") return;
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "TikTok广告权限を確認できません" });
  }
  const managementAccess = await getUserManagementAccess(db, user.id);
  if (managementAccess.isSuperAdmin) return;

  const result = await db.execute(sql`
    SELECT permission.pageKey, permission.canView
    FROM user_role_assignments assignment
    JOIN role_permissions permission ON permission.roleId = assignment.roleId
    WHERE assignment.userId = ${user.id}
      AND permission.pageKey IN (${TIKTOK_ADS_PAGE_KEY}, ${EXISTING_ADS_DASHBOARD_PAGE_KEY})
    LIMIT 1
  `);
  const rows = ((result as unknown as [PermissionRow[]])[0] ?? []);
  if (!hasTikTokAdsPagePermission({ userRole: user.role, permissions: rows })) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TikTok广告连携の閲覧権限がありません" });
  }
}
