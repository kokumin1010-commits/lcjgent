import { TRPCError } from "@trpc/server";
import type mysql from "mysql2/promise";

export const SELECTION_CENTER_PAGE_KEYS = [
  "/master/selection-center",
  "/master/selection-center?tab=products",
] as const;

export type SelectionCenterAccess = { canView: boolean; canEdit: boolean; isAdmin: boolean };

export async function resolveSelectionCenterAccess(
  user: { id: number; role?: string | null },
  pool: mysql.Pool | mysql.PoolConnection,
): Promise<SelectionCenterAccess> {
  if (user.role === "admin") return { canView: true, canEdit: true, isAdmin: true };

  const [rows] = await pool.query(
    `SELECT
       MAX(CASE WHEN r.isSystem = TRUE THEN 1 ELSE 0 END) AS isSystemAdmin,
       MAX(CASE WHEN rp.canView = TRUE OR rp.canEdit = TRUE THEN 1 ELSE 0 END) AS canView,
       MAX(CASE WHEN rp.canEdit = TRUE THEN 1 ELSE 0 END) AS canEdit
     FROM user_role_assignments ura
     INNER JOIN system_roles r ON r.id = ura.roleId
     LEFT JOIN role_permissions rp
       ON rp.roleId = ura.roleId
      AND rp.pageKey IN (?, ?)
     WHERE ura.userId = ?`,
    [...SELECTION_CENTER_PAGE_KEYS, Number(user.id)],
  ) as [Array<{ isSystemAdmin?: number | boolean | null; canView?: number | boolean | null; canEdit?: number | boolean | null }>, unknown];

  const row = rows[0] || {};
  const isAdmin = row.isSystemAdmin === true || Number(row.isSystemAdmin || 0) === 1;
  const canEdit = isAdmin || row.canEdit === true || Number(row.canEdit || 0) === 1;
  const canView = canEdit || row.canView === true || Number(row.canView || 0) === 1;
  return { canView, canEdit, isAdmin };
}

export async function requireSelectionCenterAccess(
  user: { id: number; role?: string | null },
  mode: "view" | "edit",
  pool: mysql.Pool | mysql.PoolConnection,
): Promise<SelectionCenterAccess> {
  const access = await resolveSelectionCenterAccess(user, pool);
  if (mode === "view" ? !access.canView : !access.canEdit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: mode === "edit"
        ? "没有选品中心编辑权限 / 選品センターの編集権限がありません"
        : "没有选品中心查看权限 / 選品センターの閲覧権限がありません",
    });
  }
  return access;
}
