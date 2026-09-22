export type ReportStaffOption = {
  id: number;
  name: string;
  nameCn?: string | null;
  country?: string | null;
  isActive?: "active" | "inactive" | string | null;
  archivedAt?: Date | string | null;
};

type BuildReportStaffOptionsInput<T extends ReportStaffOption> = {
  writableStaff: T[];
  isEditMode: boolean;
  canEditExisting: boolean;
  existingReportStaffId?: number | null;
  existingReportStaff?: T | null;
};

/**
 * An old report may still reference an inactive or historical report_staff row.
 * Keep that exact identity visible while editing so the UI does not show a blank
 * required field. This does not make the historical profile selectable for new
 * reports and does not change the report's stored identity.
 */
export function buildReportStaffOptions<T extends ReportStaffOption>({
  writableStaff,
  isEditMode,
  canEditExisting,
  existingReportStaffId,
  existingReportStaff,
}: BuildReportStaffOptionsInput<T>): T[] {
  const options = new Map<number, T>();
  for (const staff of writableStaff) options.set(staff.id, staff);

  if (
    isEditMode &&
    canEditExisting &&
    existingReportStaffId &&
    existingReportStaff?.id === existingReportStaffId &&
    !options.has(existingReportStaffId)
  ) {
    options.set(existingReportStaffId, existingReportStaff);
  }

  return Array.from(options.values());
}

export function isHistoricalReportStaffIdentity(input: {
  isEditMode: boolean;
  selectedReportStaffId: string;
  writableStaffIds: number[];
}): boolean {
  if (!input.isEditMode || !input.selectedReportStaffId) return false;
  const selectedId = Number(input.selectedReportStaffId);
  return (
    Number.isInteger(selectedId) &&
    !input.writableStaffIds.includes(selectedId)
  );
}

/**
 * Editing must remain possible even while a legacy Select value is being
 * hydrated. New reports still require an active, writable staff identity.
 */
export function resolveReportSubmissionStaffId(input: {
  selectedReportStaffId: string;
  isEditMode: boolean;
  existingReportStaffId?: number | null;
}): number | null {
  const selected = Number(input.selectedReportStaffId);
  if (Number.isInteger(selected) && selected > 0) return selected;
  if (
    input.isEditMode &&
    Number.isInteger(input.existingReportStaffId) &&
    Number(input.existingReportStaffId) > 0
  ) {
    return Number(input.existingReportStaffId);
  }
  return null;
}

export function shouldSendReportStaffIdOnUpdate(input: {
  canViewAllReports: boolean;
  selectedReportStaffId: number;
  existingReportStaffId: number;
}): boolean {
  return (
    input.canViewAllReports &&
    input.selectedReportStaffId !== input.existingReportStaffId
  );
}
