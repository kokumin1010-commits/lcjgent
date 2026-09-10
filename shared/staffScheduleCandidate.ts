export type StaffScheduleCandidateLike = {
  id: number;
  name: string;
  country?: string | null;
  department?: string | null;
  email?: string | null;
  emailEvidenceStatus?: string | null;
  isActive?: string | null;
  archivedAt?: unknown;
  mergedIntoStaffId?: number | string | null;
};

export function normalizeStaffScheduleCandidateIdentity(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s\u3000]+/g, "")
    .trim();
}

export function isReportStaffPlaceholderCandidate(row: StaffScheduleCandidateLike): boolean {
  const email = String(row.email || "").trim().toLowerCase();
  return email.endsWith("@lcj.placeholder")
    && String(row.emailEvidenceStatus || "").toLowerCase() === "unverified"
    && !String(row.department || "").trim();
}

function isVerifiedStaffCandidate(row: StaffScheduleCandidateLike): boolean {
  return !String(row.email || "").trim().toLowerCase().endsWith("@lcj.placeholder")
    && String(row.emailEvidenceStatus || "").toLowerCase() === "verified";
}

/**
 * Schedule-only candidate filtering. It never mutates or deletes HR records.
 * When a daily-report placeholder has the same normalized name and country as
 * at least one verified active employee, only the placeholder is hidden.
 */
export function filterStaffScheduleCandidates<T extends StaffScheduleCandidateLike>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${normalizeStaffScheduleCandidateIdentity(row.name)}|${normalizeStaffScheduleCandidateIdentity(row.country)}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  const hiddenIds = new Set<number>();
  for (const group of groups.values()) {
    if (!group.some(isVerifiedStaffCandidate)) continue;
    for (const row of group) {
      if (isReportStaffPlaceholderCandidate(row)) hiddenIds.add(Number(row.id));
    }
  }
  return rows.filter((row) => !hiddenIds.has(Number(row.id)));
}
