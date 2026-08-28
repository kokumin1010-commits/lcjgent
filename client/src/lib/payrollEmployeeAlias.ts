export type PayrollEmployeeEntity = "japan" | "china";

export type PayrollEmployeeAlias = {
  entity: PayrollEmployeeEntity;
  employeeName: string;
  wechatName?: string | null;
  note?: string | null;
};

export function getPayrollEmployeeAliasKey(entity: PayrollEmployeeEntity, employeeName: string): string {
  return `${entity}|${employeeName.trim()}`;
}

export function buildPayrollEmployeeAliasMap(aliases: PayrollEmployeeAlias[]): Map<string, PayrollEmployeeAlias> {
  return new Map(aliases.map(alias => [getPayrollEmployeeAliasKey(alias.entity, alias.employeeName), alias]));
}

export function formatPayrollEmployeeDisplayName(employeeName: string, wechatName?: string | null): string {
  const normalizedWechatName = wechatName?.trim();
  if (!normalizedWechatName || normalizedWechatName === employeeName.trim()) return employeeName;
  return `${employeeName}（${normalizedWechatName}）`;
}

export function formatPayrollEmployeeFilterDisplayName(
  employeeName: string,
  entity: PayrollEmployeeEntity | "all",
  aliases: PayrollEmployeeAlias[],
): string {
  const wechatNames = [...new Set(
    aliases
      .filter(alias => alias.employeeName.trim() === employeeName.trim() && (entity === "all" || alias.entity === entity))
      .map(alias => alias.wechatName?.trim())
      .filter((name): name is string => !!name && name !== employeeName.trim()),
  )];
  if (wechatNames.length === 0) return employeeName;
  return `${employeeName}（${wechatNames.join(" / ")}）`;
}

export function buildPayrollEmployeeAliasUpdate(
  entity: PayrollEmployeeEntity,
  employeeName: string,
  wechatName: string,
  note: string,
) {
  return {
    entity,
    employeeName: employeeName.trim(),
    wechatName: wechatName.trim(),
    note: note.trim(),
  };
}

export function buildPayrollEmployeeAliasClear(entity: PayrollEmployeeEntity, employeeName: string) {
  return buildPayrollEmployeeAliasUpdate(entity, employeeName, "", "");
}
