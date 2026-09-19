import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";

function isBrandDataDepartment(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("商务")
    || normalized.includes("商務")
    || normalized.includes("business")
    || normalized.includes("运营")
    || normalized.includes("運營")
    || normalized.includes("運営")
    || normalized.includes("operation");
}

export async function getBrandDataAccess(ctx: any) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  const access = await getUserManagementAccess(db, Number(ctx.user.id));
  return {
    canView: access.isSuperAdmin || isBrandDataDepartment(access.staffDepartment) || isBrandDataDepartment(access.managedDepartment),
    canMutate: access.isSuperAdmin,
    access,
  };
}

export async function requireBrandDataView(ctx: any) {
  const result = await getBrandDataAccess(ctx);
  if (!result.canView) throw new TRPCError({ code: "FORBIDDEN", message: "品牌资料仅限商务部、运营部和超级管理员" });
  return result.access;
}

export async function requireBrandDataMutation(ctx: any) {
  const result = await getBrandDataAccess(ctx);
  if (!result.canMutate) throw new TRPCError({ code: "FORBIDDEN", message: "品牌同步与恢复仅限超级管理员" });
  return result.access;
}
