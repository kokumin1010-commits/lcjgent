#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
router = (ROOT / "server/morningMeetingRouter.ts").read_text()
policy = (ROOT / "server/teamMorningMeetingPolicy.ts").read_text()
delete_service = (ROOT / "server/morningRecordingDeletion.ts").read_text()
ui = (ROOT / "client/src/pages/MorningMeeting.tsx").read_text()

checks: list[tuple[str, bool]] = []

def check(name: str, value: bool) -> None:
    checks.append((name, bool(value)))

# No duration limit remains in executable UI/server behavior.
check("policy accepts every completed recording", 'return status === "completed";' in policy)
check("old settings query reports zero", "minimumDurationSeconds: 0" in router and "disabled: true" in router)
check("old settings mutation is no-write compatibility response", 'return { success: true, minimumDurationSeconds: 0, disabled: true };' in router)
check("server duration validator removed", "validateTeamRecordingDuration" not in router)
check("server no minimum normalizer import", "normalizeMinimumTeamMeetingSeconds" not in router)
check("personal save permits zero timer seconds", "durationSeconds: z.number().int().min(0).max(600)" in router)
check("team save permits zero timer seconds", "durationSeconds: z.number().int().min(0).max(8 * 60 * 60)" in router)
check("existing personal completion uses status only", "isValidCompletedTeamMeeting(existing?.status)" in router)
check("today personal completion uses status only", "isValid: isValidCompletedTeamMeeting(record.status)" in router)
check("UI has no duration settings query", "getTeamMeetingSettings.useQuery" not in ui)
check("UI has no duration settings mutation", "updateTeamMeetingSettings.useMutation" not in ui)
check("UI stop buttons not duration-disabled", "personalRecordingTime <" not in ui and "recordingTime <" not in ui)
check("UI removes too-short state", "too_short" not in ui)
check("UI removes minimum-duration warning", all(token not in ui for token in ["时长不足", "時間不足", "最低有效时长", "最低有効時間", "至少录音", "秒以上必要"]))
check("UI describes actual rather than valid duration", "实际录音时长" in ui and "実際の録音時間" in ui)

# Legacy team recording is inferred only from unanimous active-member evidence.
check("legacy inference helper exists", "export function inferLegacyTeamCode" in policy)
check("legacy inference rejects missing participants", "participantSnapshot.length === 0" in policy)
check("legacy inference rejects unknown participant", "if (!teamCode) return null" in policy)
check("legacy inference rejects mixed teams", "if (teams.size > 1) return null" in policy)
check("today view uses legacy inference", 'meeting.teamCode === "legacy"' in router and "inferLegacyTeamCode(meeting.participantSnapshot, memberTeamByTargetKey) === teamCode" in router)
check("save duplicate guard uses legacy inference", "existingCandidates" in router and "inferLegacyTeamCode(meeting.participantSnapshot, memberTeamByTargetKey) === input.teamCode" in router)
check("statistics use effective legacy team", "const effectiveTeamCode" in router and "effectiveTeamCode(meeting) === teamCode" in router)
check("missing reminder uses legacy inference", "inferLegacyTeamCode(record.participantSnapshot, memberTeamByTargetKey)" in router)

# Delete authorization and audit are server-owned and atomic.
check("unified delete procedure exists", "deleteRecording: protectedProcedure" in router)
check("delete source is explicit enum", 'source: z.enum(["daily", "meeting"])' in router)
check("UI uses unified delete mutation", "morningMeeting.deleteRecording.useMutation" in ui)
check("UI confirmation mentions audit", "操作会写入审计记录" in ui and "監査記録に残ります" in ui)
check("today personal card exposes authorized delete", ('handleDelete("daily", selectedMember.principles.id)' in ui or 'handleDelete("daily", selectedMember.principles!.id)' in ui))
check("today team card exposes authorized delete", 'handleDelete("meeting", activeTeamMeeting.id)' in ui)
check("history delete follows audio source", 'record.audioSource === "meeting" ? "meeting" : "daily"' in ui)
check("UI honors server canDelete", "record.canDelete &&" in ui and "activeTeamMeeting.canDelete" in ui)
check("delete is one database transaction", "db.transaction(async" in delete_service)
check("personal ownership checked server-side", "Number(record.userId) === input.actor.id" in delete_service and "record.targetKey === input.ownTargetKey" in delete_service)
check("team creator checked server-side", "Number(record.createdBy) !== input.actor.id" in delete_service)
check("admin override checked server-side", 'input.actor.role !== "admin"' in delete_service)
check("audit event precedes personal delete", delete_service.index('await writeDeleteEvent(tx, input, "morning_principle_recitation"') < delete_service.index("await tx.delete(morningPrincipleRecitations)"))
check("audit event precedes team delete", delete_service.index('await writeDeleteEvent(tx, input, "morning_meeting"') < delete_service.index("await tx.delete(morningMeetings)"))
check("audit avoids media and transcript payloads", all(token not in delete_service.split("function safePersonalSnapshot", 1)[1].split("async function writeDeleteEvent", 1)[0] for token in ["audioUrl", "audioKey", "transcript", "summary"]))
check("delete event uses dedicated source", "'morning-meeting-ui'" in delete_service)
check("legacy delete route also audited", 'source: "meeting"' in router[router.index("delete: protectedProcedure"):router.index("deleteRecording: protectedProcedure")])

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
print(f"RESULT: {len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    raise SystemExit("failed checks: " + "; ".join(failed))
