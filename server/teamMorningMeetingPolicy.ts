export type TeamMeetingCode = "china" | "japan";

export const DEFAULT_TEAM_MEETING_MINIMUM_SECONDS = 60;
export const MIN_CONFIGURABLE_TEAM_MEETING_SECONDS = 30;
export const MAX_CONFIGURABLE_TEAM_MEETING_SECONDS = 30 * 60;

export function normalizeMinimumTeamMeetingSeconds(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_TEAM_MEETING_MINIMUM_SECONDS;
  return Math.min(
    MAX_CONFIGURABLE_TEAM_MEETING_SECONDS,
    Math.max(MIN_CONFIGURABLE_TEAM_MEETING_SECONDS, Math.round(numeric)),
  );
}

export function staffCountryToTeamCode(country: unknown): TeamMeetingCode | null {
  const normalized = String(country || "").trim().toLowerCase();
  if (/中国|china|cn|中国チーム/.test(normalized)) return "china";
  if (/日本|japan|jp|日本チーム/.test(normalized)) return "japan";
  return null;
}

export function teamMeetingDailyKey(date: string, teamCode: TeamMeetingCode): string {
  return `${date}:${teamCode}`;
}

export function personalMorningRecordingDailyKey(date: string, targetKey: string, recordingType: string): string {
  return `${date}:${targetKey}:${recordingType}`;
}

export function canHostTeamMeetingForTeam(userRole: unknown, staffCountry: unknown, teamCode: TeamMeetingCode): boolean {
  return userRole === "admin" || staffCountryToTeamCode(staffCountry) === teamCode;
}

export function isValidCompletedTeamMeeting(
  status: unknown,
  _durationSeconds?: unknown,
  _minimumDurationSeconds?: unknown,
): boolean {
  // 用户明确取消全部时长限制。音频内容仍由上传签名和处理流程验证，
  // 完成与否只以服务端处理状态为准，不再因朗读速度快而失效。
  return status === "completed";
}

const ATTENDANCE_EVIDENCE_STATUSES = new Set([
  "transcribing",
  "summarizing",
  "completed",
  "failed",
]);

export function parseTeamMeetingParticipantSnapshot(value: unknown): Array<{ targetKey?: unknown }> {
  if (Array.isArray(value)) return value as Array<{ targetKey?: unknown }>;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as Array<{ targetKey?: unknown }> : [];
  } catch {
    return [];
  }
}

/**
 * Team attendance is proven independently from transcription by a persisted,
 * fully decoded recording and the immutable participant snapshot captured before
 * background speech-to-text starts. Transcription and summary may fail without
 * removing the already recorded attendance evidence.
 */
export function isRecordedTeamMeetingAttendance(input: {
  status: unknown;
  audioKey: unknown;
  participantSnapshot: unknown;
  mediaValidatedAt: unknown;
  mediaDurationSeconds: unknown;
  mediaSha256: unknown;
  mediaAudioStreamCount: unknown;
  speechValidatedAt?: unknown;
  speechValidationProvider?: unknown;
  supersededAt?: unknown;
  deletedAt?: unknown;
}): boolean {
  if (!ATTENDANCE_EVIDENCE_STATUSES.has(String(input.status || ""))) return false;
  if (typeof input.audioKey !== "string" || !input.audioKey.trim()) return false;
  if (!input.mediaValidatedAt || Number.isNaN(new Date(input.mediaValidatedAt as any).getTime())) return false;
  if (!Number.isFinite(Number(input.mediaDurationSeconds)) || Number(input.mediaDurationSeconds) < 1) return false;
  if (typeof input.mediaSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.mediaSha256)) return false;
  if (!Number.isInteger(Number(input.mediaAudioStreamCount)) || Number(input.mediaAudioStreamCount) < 1) return false;
  if (input.supersededAt) return false;
  if (input.deletedAt) return false;
  return parseTeamMeetingParticipantSnapshot(input.participantSnapshot)
    .some((participant) => typeof participant?.targetKey === "string" && participant.targetKey.trim().length > 0);
}

export function inferLegacyTeamCode(
  participantSnapshot: unknown,
  memberTeamByTargetKey: ReadonlyMap<string, TeamMeetingCode | null>,
): TeamMeetingCode | null {
  const snapshot = parseTeamMeetingParticipantSnapshot(participantSnapshot);
  if (snapshot.length === 0) return null;
  const teams = new Set<TeamMeetingCode>();
  for (const participant of snapshot) {
    const targetKey = participant && typeof participant === "object" && "targetKey" in participant
      ? String((participant as { targetKey?: unknown }).targetKey || "")
      : "";
    const teamCode = targetKey ? memberTeamByTargetKey.get(targetKey) : null;
    if (!teamCode) return null;
    teams.add(teamCode);
    if (teams.size > 1) return null;
  }
  return teams.size === 1 ? [...teams][0] : null;
}

export function resolveTeamMeetingStartedAt(
  clientStartedAt: unknown,
  durationSeconds: number,
  receivedAt = new Date(),
): Date {
  const inferred = new Date(receivedAt.getTime() - Math.max(0, durationSeconds) * 1000);
  const parsed = typeof clientStartedAt === "string" ? new Date(clientStartedAt) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return inferred;
  const driftMilliseconds = Math.abs(parsed.getTime() - inferred.getTime());
  return driftMilliseconds <= 2 * 60 * 1000 ? parsed : inferred;
}

export function jstDateForInstant(value: Date): string {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
