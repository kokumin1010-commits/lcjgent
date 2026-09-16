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
    const access = read("server/userManagementAccess.ts");
    const auth = read("server/auth.ts");

    expect(schema).toContain(
      'userManagementScopes = mysqlTable("user_management_scopes"'
    );
    expect(access).toContain("ensureUserManagementHierarchy");
    expect(access).toContain("INSERT IGNORE INTO user_management_scopes");
    expect(schema).toContain('managementLevel: mysqlEnum("managementLevel"');
    expect(schema).toContain('managedDepartment: varchar("managedDepartment"');
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


describe("visual hierarchy and immutable audit contract", () => {
  it("defines the immutable audit table and unique request id", () => {
    const schema = read("drizzle/schema.ts");
    const service = read("server/systemUserHierarchyService.ts");

    expect(schema).toContain('userManagementAuditLogs = mysqlTable("user_management_audit_logs"');
    expect(schema).toContain('uniqueIndex("uk_user_management_audit_request")');
    expect(service).toContain("CREATE TABLE IF NOT EXISTS user_management_audit_logs");
    expect(service).toContain("beforeState JSON");
    expect(service).toContain("afterState JSON");
    expect(service).toContain("WHERE requestId = ${input.requestId}");
    expect(service).toContain("idempotent: true");
  });

  it("serializes hierarchy writes and protects super administrators", () => {
    const service = read("server/systemUserHierarchyService.ts");

    expect(service).toContain("lockSuperAdminAssignments");
    expect(service).toContain("WHERE role.isSystem = TRUE");
    expect(service).toContain("FOR UPDATE");
    expect(service).toContain("lockedSuperAdminUserIds.length <= 1");
    expect(service).toContain("不能降低自己的超级管理员层级");
    expect(service).toContain("至少需要保留一名超级管理员");
    expect(service).toContain("请先在HR资料中设置该员工的部门");
    expect(service).toContain("AND isSystem = FALSE");
    expect(service).toContain('action: "update_hierarchy_assignment"');
    expect(service).toContain("if (currentLevel === \"super_admin\")");
  });

  it("routes legacy account and role assignment endpoints through the protected hierarchy service", () => {
    const userRouter = read("server/userManagementRouter.ts");
    const rbac = read("server/rbacRouter.ts");

    expect(userRouter).toContain("updateHierarchyAssignment(db, ctx.user.id");
    expect(userRouter).toContain("不能禁用超级管理员账号");
    expect(userRouter).toContain("不能删除超级管理员账号；请先通过权限树安全调整层级");
    expect(userRouter).toContain('action: "update_technical_role"');
    expect(rbac).toContain("assignUserRole: systemSuperAdminProcedure");
    expect(rbac).toContain("removeUserRole: systemSuperAdminProcedure");
    expect(rbac).toContain("return updateHierarchyAssignment(db, ctx.user.id");
    expect(rbac).toContain("请在层级权限树中安全调整超级管理员");
  });

  it("keeps the system role read-only and audits function roles and page permissions", () => {
    const rbac = read("server/rbacRouter.ts");
    const page = read("client/src/pages/SystemUserManagement.tsx");

    expect(rbac).toContain("系统超级管理员角色为只读，不能修改");
    expect(rbac).toContain("系统超级管理员角色拥有固定全权限，不能修改");
    expect(rbac).toContain('action: "create_function_role"');
    expect(rbac).toContain('action: "update_function_role"');
    expect(rbac).toContain('action: "delete_function_role"');
    expect(rbac).toContain('action: "update_role_permissions"');
    expect(page).toContain("isSystemRole");
    expect(page).toContain("系统超级管理员角色固定拥有全部页面的查看与编辑权限");
    expect(page).toContain("disabled={isSystemRole}");
  });

  it("renders the required five-level tree, confirmation diff and audit history by default", () => {
    const page = read("client/src/pages/SystemUserManagement.tsx");
    const tree = read("client/src/components/systemUsers/AccountHierarchyTree.tsx");

    expect(page).toContain('useState("hierarchy")');
    expect(page).toContain('value="hierarchy"');
    expect(page).toContain("onOpenRolePermissions");
    expect(tree).toContain("账号层级・权限树");
    expect(tree).toContain("超级管理员");
    expect(tree).toContain("部门负责人");
    expect(tree).toContain("功能角色");
    expect(tree).toContain("未配置负责人");
    expect(tree).toContain("确认变更前后差异");
    expect(tree).toContain("保存并记录审计");
    expect(tree).toContain("hierarchy-audit-history");
    expect(tree).toContain("最近权限变更（不可变审计）");
  });

  it("shows department managers only once and provides a mobile full-screen detail dialog", () => {
    const tree = read("client/src/components/systemUsers/AccountHierarchyTree.tsx");

    expect(tree).toContain('account.managementLevel !== "department_manager"');
    expect(tree).toContain("h-[100dvh]");
    expect(tree).toContain("w-screen max-w-none");
    expect(tree).toContain("focus-visible:ring-2");
    expect(tree).toContain("crypto.randomUUID()");
  });
});
