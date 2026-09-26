export const SECOND_EDITION_OMITTED_LIVER_QUESTION_IDS = [
  "agency",
  "accountInfo",
  "phone",
  "lineOrLark",
  "attendanceSchedule",
  "matchingPreference",
  "beginnerSupport",
] as const;

const SECOND_EDITION_OMITTED_LIVER_QUESTION_SET = new Set<string>(
  SECOND_EDITION_OMITTED_LIVER_QUESTION_IDS,
);

export function filterLiverApplicationSteps<T extends { id: string }>(
  edition: number,
  steps: readonly T[],
): T[] {
  if (edition !== 2) return [...steps];
  return steps.filter((step) => !SECOND_EDITION_OMITTED_LIVER_QUESTION_SET.has(step.id));
}
