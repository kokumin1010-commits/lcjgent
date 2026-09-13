import { TRPCError } from "@trpc/server";
import { getBrandDayPool } from "./brandDayPool";

export const BRAND_DAY_PAGE_KEY = "/master/brand-days";

export async function requireBrandDayPermission(
  ctx: { user: { id: number; role?: string | null } },
  mode: "view" | "edit",
): Promise<void> {
  if (ctx.user.role === "admin") return;
  const pool = await getBrandDayPool();
  const [assignments] = await pool.query(
    `SELECT ura.roleId
       FROM user_role_assignments ura
      WHERE ura.userId = ?
      LIMIT 1`,
    [ctx.user.id],
  );
  const assignment = (assignments as any[])[0];
  if (!assignment?.roleId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "ブランドデー管理権限がありません / 无品牌日管理权限" });
  }
  const [permissions] = await pool.query(
    `SELECT canView, canEdit
       FROM role_permissions
      WHERE roleId = ? AND pageKey = ?
      LIMIT 1`,
    [Number(assignment.roleId), BRAND_DAY_PAGE_KEY],
  );
  const permission = (permissions as any[])[0];
  const allowed = mode === "edit" ? Boolean(permission?.canEdit) : Boolean(permission?.canView || permission?.canEdit);
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "ブランドデー管理権限がありません / 无品牌日管理权限" });
}
