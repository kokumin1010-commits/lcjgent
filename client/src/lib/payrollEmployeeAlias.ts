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
  const matchingAliases = aliases
    .filter(alias => alias.employeeName.trim() === employeeName.trim() && (entity === "all" || alias.entity === entity))
    .map(alias => ({ entity: alias.entity, wechatName: alias.wechatName?.trim() }))
    .filter((alias): alias is { entity: PayrollEmployeeEntity; wechatName: string } => !!alias.wechatName && alias.wechatName !== employeeName.trim());
  const uniqueWechatNames = [...new Set(matchingAliases.map(alias => alias.wechatName))];
  if (uniqueWechatNames.length === 0) return employeeName;
  if (uniqueWechatNames.length === 1) return `${employeeName}（${uniqueWechatNames[0]}）`;
  const entityLabels: Record<PayrollEmployeeEntity, string> = { japan: "日本", china: "中国" };
  return `${employeeName}（${matchingAliases.map(alias => `${entityLabels[alias.entity]}：${alias.wechatName}`).join(" / ")}）`;
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
