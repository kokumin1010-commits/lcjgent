#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "client/src/pages/MorningMeeting.tsx"
ROUTER_PATH = ROOT / "server/morningMeetingRouter.ts"
SCHEMA_PATH = ROOT / "drizzle/schema.ts"
PERSONAL_MIGRATION_PATH = ROOT / "server/migrations/createMorningPrincipleRecitations.ts"
TEAM_MIGRATION_PATH = ROOT / "server/migrations/upgradeMorningMeetingsForDailyTeam.ts"
SERVER_PATH = ROOT / "server/_core/index.ts"
OUTPUT_PATH = ROOT / "morning_meeting_culture_integrity.json"

source = SOURCE_PATH.read_text(encoding="utf-8")
router = ROUTER_PATH.read_text(encoding="utf-8")
schema = SCHEMA_PATH.read_text(encoding="utf-8")
personal_migration = PERSONAL_MIGRATION_PATH.read_text(encoding="utf-8")
team_migration = TEAM_MIGRATION_PATH.read_text(encoding="utf-8")
server = SERVER_PATH.read_text(encoding="utf-8")

ja_start = source.index('  "ja-JP": [')
zh_start = source.index('  "zh-CN": [', ja_start)
principles_end = source.index('\n  ],\n};', zh_start) + len('\n  ],')
ja_block = source[ja_start:zh_start]
zh_block = source[zh_start:principles_end]
save_principles_block = router[router.index("savePersonalRecitation: protectedProcedure"):router.index("getTodayPersonalRecitations: protectedProcedure")]
save_team_block = router[router.index("saveDailyTeamMeeting: protectedProcedure"):router.index("getTodayDailyRecordings: protectedProcedure")]
daily_list_block = router[router.index("getTodayDailyRecordings: protectedProcedure"):router.index("getDailyRecordingAudioUrl: protectedProcedure")]
history_block = router[router.index("getSeparatedHistory: protectedProcedure"):router.index("getHistory: protectedProcedure")]

checks = {
    "japanese_has_exactly_nine_principles": len(re.findall(r'\{ title:', ja_block)) == 9,
    "chinese_has_exactly_nine_principles": len(re.findall(r'\{ title:', zh_block)) == 9,
    "approved_japanese_and_chinese_copy_present": all(token in source for token in ["やると決めたら、100％やり切る。", "做就做100%。做到过，就不许退步。", "すべては、LCJの成功のために。", "一切为了LCJ成功。"]),
    "language_drives_principles_and_copy": "LCJ_CULTURE_PRINCIPLES[speechLang]" in source and "MORNING_MEETING_COPY[speechLang]" in source,
    "step_labels_removed": all(token not in source for token in ["STEP 1", "STEP 2", "第1步", "第2步"]),
    "final_workflow_copy_is_present": all(token in source for token in ["9条朗読録音｜全員必須", "チーム朝会｜1日1回", "9条朗读录音｜全员必做", "团队早会｜每天一次"]),
    "personal_recitation_remains_per_employee": "targetStaffId: selectedTargetStaffId" in source and "savePersonalRecitationMutation" in source,
    "team_meeting_is_not_saved_per_employee": "savePersonalMorningMeetingMutation" not in source and "saveDailyTeamMeetingMutation" in source,
    "team_meeting_sends_selected_participants": "participantStaffIds: selectedParticipantIds" in source,
    "participant_selector_defaults_to_active_staff": "dailyToday.meetingParticipantOptions.map((participant) => participant.staffId)" in source,
    "participant_selector_can_toggle_each_name": "selectedParticipantIds.includes(participant.staffId)" in source and "setSelectedParticipantIds((current)" in source,
    "participant_selector_has_select_all_and_clear": "copy.selectAllParticipants" in source and "copy.clearParticipants" in source,
    "current_staff_is_shown_top_left": 'data-testid="current-morning-staff"' in source and "{copy.currentStaff}" in source and "selectedMember?.name" in source,
    "admin_staff_tap_selection_for_personal_recitation_remains": all(token in source for token in ["dailyToday.canSelectStaff", "setSelectedStaffId(member.staffId", "aria-pressed={selected}"]),
    "principles_always_visible_without_collapse": "culturePrinciples.map((principle, index)" in source and "xl:grid-cols-3" in source,
    "both_recording_controls_are_visible_above_principles": source.count('className="order-2 border-2') >= 2 and 'className="order-3 overflow-hidden' in source,
    "both_recordings_keep_friendly_three_second_guard": source.count("disabled={personalRecordingTime < 3}") == 1 and source.count("disabled={recordingTime < 3}") == 1 and "friendlyRecordingError" in source,
    "raw_zod_json_is_hidden": 'message.trim().startsWith("[{")' in source and "durationSeconds|too_small" in source,
    "personal_audio_identity_and_operator_audit_remain": all(token in schema for token in ["targetKey", "operatorUserId", "operatorUserName", "operatorUserEmail"]),
    "personal_daily_unique_constraint_remains": "unique_morning_daily_recording_date_target_type" in schema and "unique_morning_daily_recording_date_target_type" in personal_migration,
    "team_schema_has_daily_kind_and_participant_snapshot": all(token in schema for token in ["dailyKey", "recordingKind", "participantCount", "participantSnapshot"]),
    "team_daily_key_is_unique": 'dailyKey: varchar("dailyKey", { length: 10 }).unique()' in schema and "unique_morning_meetings_daily_key" in team_migration,
    "legacy_team_rows_are_not_backfilled": "dailyKeyは旧行でNULL" in team_migration and "UPDATE morning_meetings SET dailyKey" not in team_migration,
    "team_migration_is_idempotent": all(token in team_migration for token in ["INFORMATION_SCHEMA.COLUMNS", "INFORMATION_SCHEMA.STATISTICS", "Array.isArray(rows)"]),
    "both_migrations_are_registered": "createMorningPrincipleRecitations" in server and "upgradeMorningMeetingsForDailyTeam" in server,
    "team_api_requires_unique_nonempty_participants": "participantStaffIds: z.array" in save_team_block and ".min(1).max(200)" in save_team_block and "new Set(ids).size === ids.length" in save_team_block,
    "team_api_adds_host_staff": "if (host.staffId) requestedIds.add(host.staffId)" in save_team_block,
    "team_api_rejects_inactive_or_invalid_staff": "participants.length !== requestedIds.size" in save_team_block and "無効または退職済み" in save_team_block,
    "team_api_enforces_one_meeting_per_day": "eq(morningMeetings.dailyKey, date)" in save_team_block and "ER_DUP_ENTRY" in save_team_block,
    "team_api_preserves_host_audit": "createdBy: ctx.user.id" in save_team_block and "createdByName: ctx.user.name || ctx.user.email" in save_team_block,
    "team_audio_is_partitioned_by_date": "morning-team-meetings/${date}/meeting-${meetingId}" in save_team_block,
    "team_audio_is_transcribed_corrected_and_summarized": all(token in save_team_block for token in ["transcribeAudio", "correctTranscription", "generateMeetingSummary", 'status: "completed"']),
    "team_failure_is_recorded_and_retryable": 'status: "failed"' in save_team_block and 'existing?.status === "completed"' in save_team_block,
    "audio_has_size_mime_and_signature_checks": all(token in router for token in ["TEAM_MEETING_AUDIO_MAX_BYTES", "PERSONAL_RECITATION_MAX_BYTES", "ALLOWED_AUDIO_MIME_TYPES", "isWebm", "isOgg", "isMp4"]),
    "today_api_returns_team_and_participant_options": all(token in daily_list_block for token in ["teamMeeting:", "meetingParticipantOptions", "canHostTeamMeeting", "participantSnapshot"]),
    "today_api_marks_attendance_from_snapshot": "participantKeys.has(target.targetKey)" in daily_list_block and "attendedTeamMeeting" in daily_list_block,
    "regular_user_personal_status_is_self_only": 'ctx.user.role === "admin" ? allMembers : [currentStaff]' in daily_list_block,
    "history_api_has_three_explicit_types": 'z.enum(["principles", "team", "legacy"])' in history_block,
    "principles_history_is_owner_or_admin": "resolveRecordingTarget(db, ctx.user)" in history_block and "morningPrincipleRecitations.targetKey" in history_block,
    "team_history_filters_new_kind": 'eq(morningMeetings.recordingKind, "daily_team")' in history_block,
    "legacy_history_preserves_old_shared_and_temporary_personal": 'eq(morningMeetings.recordingKind, "legacy")' in history_block and 'RECORDING_TYPES.morningMeeting' in history_block and "legacy_personal" in history_block and "legacy_team" in history_block,
    "history_supports_date_and_search": all(token in history_block for token in ["dateFrom", "dateTo", "input.search", "LIKE"]),
    "ui_has_three_separate_history_tabs": all(token in source for token in ["historyPrinciples", "historyTeam", "historyLegacy", 'setHistoryType(type)']),
    "history_uses_correct_audio_source": 'record.audioSource === "meeting"' in source and "DailyRecordingAudioButton recordingId={record.id}" in source and "AudioPlayButton meetingId={record.id}" in source,
    "team_history_displays_participants_transcript_and_summary": all(token in source for token in ["record.participantSnapshot", "MeetingSummaryView summary={record.summary", "record.transcript"]),
    "old_get_history_remains_for_backward_compatibility": "getHistory: protectedProcedure" in router and "後方互換" in router,
    "same_origin_microphone_is_allowed": "microphone=(self)" in server and "microphone=()" not in server,
    "other_browser_permissions_remain_restricted": "camera=(self)" in server and "geolocation=()" in server,
    "closing_statement_remains_visible": "{copy.closing}" in source,
}

failed = [name for name, passed in checks.items() if not passed]
report = {
    "checked": len(checks),
    "passed": len(checks) - len(failed),
    "failed": failed,
    "checks": checks,
}
OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if failed else 0)
