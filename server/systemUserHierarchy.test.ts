import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  canDepartmentManagerToggleAccount,
  canViewManagedAccount,
  isDepartmentManagerScopeValid,
  normalizeManagedAccountEmail,
  normalizeManagementDepartment,
  resolveEffectiveManagementLevel,
} from "../shared/userManagementHierarchy";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("system-user management hierarchy rules", () => {
  it("derives super administrators from the existing system RBAC role", () => {
    expect(
      resolveEffectiveManagementLevel({
        hasSuperAdminRole: true,
        storedLevel: "employee",
      })
    ).toBe("super_admin");
    expect(
      resolveEffectiveManagementLevel({
        hasSuperAdminRole: false,
        storedLevel: "department_manager",
      })
    ).toBe("department_manager");
    expect(
      resolveEffectiveManagementLevel({
        hasSuperAdminRole: false,
        storedLevel: "unexpected",
      })
    ).toBe("employee");
  });

  it("normalizes departments and disabled account email prefixes", () => {
    expect(normalizeManagementDepartment(" 運營部  ")).toBe("運營部");
    expect(normalizeManagementDepartment("ＩＴ部")).toBe("it部");
    expect(normalizeManagedAccountEmail("disabled_27_Staff@Example.COM")).toBe(
      "staff@example.com"
    );
    expect(normalizeManagedAccountEmail("resigned_88_user@example.com")).toBe(
      "user@example.com"
    );
  });

  it("only exposes same-department non-super accounts to department managers", () => {
    expect(
      canViewManagedAccount({
        actorLevel: "department_manager",
        actorDepartment: "运营部",
        targetLevel: "employee",
        targetDepartment: "运营部",
      })
    ).toBe(true);
    expect(
      canViewManagedAccount({
        actorLevel: "department_manager",
        actorDepartment: "运营部",
        targetLevel: "employee",
        targetDepartment: "财务部",
      })
    ).toBe(false);
    expect(
      canViewManagedAccount({
        actorLevel: "department_manager",
        actorDepartment: "运营部",
        targetLevel: "super_admin",
        targetDepartment: "运营部",
      })
    ).toBe(false);
    expect(
      canViewManagedAccount({
        actorLevel: "employee",
        actorDepartment: "运营部",
        targetLevel: "employee",
        targetDepartment: "运营部",
      })
    ).toBe(false);
  });

  it("lets department managers toggle only other ordinary employees in their department", () => {
    const base = {
      actorUserId: 10,
      actorDepartment: "运营部",
      targetUserId: 11,
      targetLevel: "employee" as const,
      targetDepartment: "运营部",
    };
    expect(canDepartmentManagerToggleAccount(base)).toBe(true);
    expect(
      canDepartmentManagerToggleAccount({ ...base, targetUserId: 10 })
    ).toBe(false);
    expect(
      canDepartmentManagerToggleAccount({
        ...base,
        targetLevel: "department_manager",
      })
    ).toBe(false);
    expect(
      canDepartmentManagerToggleAccount({
        ...base,
        targetDepartment: "财务部",
      })
    ).toBe(false);
    expect(isDepartmentManagerScopeValid("department_manager", null)).toBe(
      false
    );
    expect(isDepartmentManagerScopeValid("department_manager", "运营部")).toBe(
      true
    );
  });
});

describe("system-user hierarchy integration contract", () => {
  it("creates and backfills a hierarchy table without changing legacy users.role", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("server/migrations/createRbacTables.ts");
    const auth = read("server/auth.ts");

    expect(schema).toContain(
      'userManagementScopes = mysqlTable("user_management_scopes"'
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS user_management_scopes"
    );
    expect(migration).toContain(
      "INSERT IGNORE INTO user_management_scopes (userId, managementLevel)"
    );
    expect(migration).toContain("SELECT id, 'employee' FROM users");
    expect(auth).toContain('role: "admin"');
    expect(auth).not.toContain("user_management_scopes");
  });

  it("enforces hierarchy and department scope in every account-management mutation", () => {
    const router = read("server/userManagementRouter.ts");

    expect(router).toContain("requireUserManagementAccess(db, ctx.user.id)");
    expect(router).toContain("requireSystemSuperAdmin(db, ctx.user.id)");
    expect(router).toContain("canViewManagedAccount({");
    expect(router).toContain("canDepartmentManagerToggleAccount({");
    expect(router).toContain("updateManagementLevel: protectedProcedure");
    expect(router).toContain("部门负责人只能启用或禁用本部门普通员工账号");
    expect(router).toContain("await requireSystemSuperAdmin(db, ctx.user.id)");
    expect(router).toContain("syncNames: protectedProcedure");
  });

  it("restricts global RBAC administration while exposing hierarchy to the menu", () => {
    const rbac = read("server/rbacRouter.ts");
    const menu = read("client/src/lib/adminMenuConfig.ts");

    expect(rbac).toContain(
      "const systemSuperAdminProcedure = protectedProcedure.use("
    );
    expect(rbac).toContain("listRoles: systemSuperAdminProcedure");
    expect(rbac).toContain("assignUserRole: systemSuperAdminProcedure");
    expect(rbac).toContain("canManageSystemUsers:");
    expect(menu).toContain('normalizedPath === "/master/system-users"');
    expect(menu).toContain(
      "return permissionsData.canManageSystemUsers === true"
    );
  });

  it("shows account levels and keeps global role controls super-admin only", () => {
    const page = read("client/src/pages/SystemUserManagement.tsx");

    expect(page).toContain("账号层级");
    expect(page).toContain("部门负责人");
    expect(page).toContain("access.isSuperAdmin && (");
    expect(page).toContain("updateManagementLevelMutation.mutate({");
    expect(page).toContain("功能访问仍由“功能角色”单独控制");
    expect(page).toContain("仅管理 ${access.managedDepartment} 部门员工账号");
  });
});
