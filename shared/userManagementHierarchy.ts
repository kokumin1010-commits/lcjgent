export const USER_MANAGEMENT_LEVELS = [
  "employee",
  "department_manager",
] as const;

export type UserManagementLevel = (typeof USER_MANAGEMENT_LEVELS)[number];
export type EffectiveUserManagementLevel = UserManagementLevel | "super_admin";

export const USER_MANAGEMENT_LEVEL_LABELS = {
  employee: { zh: "员工", ja: "スタッフ" },
  department_manager: { zh: "部门负责人", ja: "部門責任者" },
  super_admin: { zh: "超级管理员", ja: "スーパー管理者" },
} as const satisfies Record<
  EffectiveUserManagementLevel,
  { zh: string; ja: string }
>;

export function normalizeManagementDepartment(
  value: string | null | undefined
): string {
  return (value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function normalizeManagedAccountEmail(
  value: string | null | undefined
): string {
  return (value || "")
    .replace(/^(?:resigned|disabled)_\d+_/i, "")
    .trim()
    .toLocaleLowerCase();
}

export function resolveEffectiveManagementLevel(options: {
  hasSuperAdminRole: boolean;
  storedLevel?: string | null;
}): EffectiveUserManagementLevel {
  if (options.hasSuperAdminRole) return "super_admin";
  return options.storedLevel === "department_manager"
    ? "department_manager"
    : "employee";
}

export function isDepartmentManagerScopeValid(
  level: EffectiveUserManagementLevel,
  managedDepartment: string | null | undefined
): boolean {
  if (level !== "department_manager") return true;
  return normalizeManagementDepartment(managedDepartment).length > 0;
}

export function canViewManagedAccount(options: {
  actorLevel: EffectiveUserManagementLevel;
  actorDepartment?: string | null;
  targetLevel: EffectiveUserManagementLevel;
  targetDepartment?: string | null;
}): boolean {
  if (options.actorLevel === "super_admin") return true;
  if (options.actorLevel !== "department_manager") return false;
  if (options.targetLevel === "super_admin") return false;

  const actorDepartment = normalizeManagementDepartment(
    options.actorDepartment
  );
  const targetDepartment = normalizeManagementDepartment(
    options.targetDepartment
  );
  return Boolean(
    actorDepartment && targetDepartment && actorDepartment === targetDepartment
  );
}

export function canDepartmentManagerToggleAccount(options: {
  actorUserId: number;
  actorDepartment?: string | null;
  targetUserId: number;
  targetLevel: EffectiveUserManagementLevel;
  targetDepartment?: string | null;
}): boolean {
  if (options.actorUserId === options.targetUserId) return false;
  if (options.targetLevel !== "employee") return false;
  return canViewManagedAccount({
    actorLevel: "department_manager",
    actorDepartment: options.actorDepartment,
    targetLevel: options.targetLevel,
    targetDepartment: options.targetDepartment,
  });
}
