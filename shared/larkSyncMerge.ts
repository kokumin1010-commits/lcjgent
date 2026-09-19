export type SourceFieldState<T> = {
  present: boolean;
  sourceField: string | null;
  value: T | null;
};

export type NonDestructiveFieldDecision<T> = {
  action: "updated" | "unchanged" | "preserved_blank" | "preserved_absent" | "empty";
  shouldUpdate: boolean;
  value: T | null | unknown;
};

export function hasLarkSyncValue(value: unknown): boolean {
  return value !== null
    && value !== undefined
    && (typeof value !== "string" || value.trim().length > 0);
}

/**
 * Lark synchronization never treats absence or blank as an instruction to erase.
 * Explicit clearing requires a separate, reviewed workflow and is intentionally not
 * represented by this routine.
 */
export function decideNonDestructiveLarkField<T>(
  currentValue: unknown,
  source: SourceFieldState<T>,
): NonDestructiveFieldDecision<T> {
  if (source.present && hasLarkSyncValue(source.value)) {
    if (String(currentValue ?? "") === String(source.value ?? "")) {
      return { action: "unchanged", shouldUpdate: false, value: currentValue };
    }
    return { action: "updated", shouldUpdate: true, value: source.value };
  }
  if (hasLarkSyncValue(currentValue)) {
    return {
      action: source.present ? "preserved_blank" : "preserved_absent",
      shouldUpdate: false,
      value: currentValue,
    };
  }
  return { action: "empty", shouldUpdate: false, value: currentValue };
}
