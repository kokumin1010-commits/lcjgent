#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "client/src/pages/MorningMeeting.tsx"
ROUTER_PATH = ROOT / "server/morningMeetingRouter.ts"
SCHEMA_PATH = ROOT / "drizzle/schema.ts"
MIGRATION_PATH = ROOT / "server/migrations/createMorningPrincipleRecitations.ts"
SERVER_PATH = ROOT / "server/_core/index.ts"
OUTPUT_PATH = ROOT / "morning_meeting_culture_integrity.json"

source = SOURCE_PATH.read_text(encoding="utf-8")
router = ROUTER_PATH.read_text(encoding="utf-8")
schema = SCHEMA_PATH.read_text(encoding="utf-8")
migration = MIGRATION_PATH.read_text(encoding="utf-8")
server = SERVER_PATH.read_text(encoding="utf-8")

ja_start = source.index('  "ja-JP": [')
zh_start = source.index('  "zh-CN": [', ja_start)
principles_end = source.index('\n  ],\n};', zh_start) + len('\n  ],')
ja_block = source[ja_start:zh_start]
zh_block = source[zh_start:principles_end]

save_principles_block = router[router.index("savePersonalRecitation: protectedProcedure"):router.index("getTodayPersonalRecitations: protectedProcedure")]
save_meeting_block = router[router.index("savePersonalMorningMeeting: protectedProcedure"):router.index("getTodayDailyRecordings: protectedProcedure")]
daily_list_block = router[router.index("getTodayDailyRecordings: protectedProcedure"):router.index("getDailyRecordingAudioUrl: protectedProcedure")]

checks = {
    "japanese_has_exactly_nine_principles": len(re.findall(r'\{ title:', ja_block)) == 9,
    "chinese_has_exactly_nine_principles": len(re.findall(r'\{ title:', zh_block)) == 9,
    "approved_japanese_opening_and_closing_present": "やると決めたら、100％やり切る。" in ja_block and "すべては、LCJの成功のために。" in ja_block,
    "original_chinese_opening_and_closing_present": "做就做100%。做到过，就不许退步。" in zh_block and "一切为了LCJ成功。" in zh_block,
    "language_drives_principles_and_copy": "LCJ_CULTURE_PRINCIPLES[speechLang]" in source and "MORNING_MEETING_COPY[speechLang]" in source,
    "step_labels_removed": "STEP 1" not in source and "STEP 2" not in source and "第1步" not in source and "第2步" not in source,
    "both_cards_marked_required": all(token in source for token in ["9条朗読録音｜全員必須", "早会録音｜全員必須", "9条朗读录音｜全员必做", "早会录音｜全员必做"]),
    "both_recording_cards_above_principles": source.count('className="order-2 border-2') >= 2 and 'className="order-3 overflow-hidden' in source,
    "principles_always_visible_without_collapse": "culturePrinciples.map((principle, index)" in source and "xl:grid-cols-3" in source,
    "current_staff_is_shown_top_left": 'data-testid="current-morning-staff"' in source and "{copy.currentStaff}" in source and "selectedMember?.name" in source,
    "admin_staff_names_are_tappable": all(token in source for token in ["dailyToday.canSelectStaff", "setSelectedStaffId(member.staffId", "aria-pressed={selected}"]),
    "staff_selection_locks_during_recording": "disabled={!dailyToday.canSelectStaff || isPersonalRecording || isRecording || personalProcessing || Boolean(processingStep)}" in source,
    "two_statuses_render_beside_each_staff": "member.principlesCompleted" in source and "member.morningMeetingCompleted" in source,
    "both_records_are_target_staff_based": "selectedTargetStaffId" in source and source.count("targetStaffId: selectedTargetStaffId") == 2,
    "principles_start_stop_connected": "onClick={startPersonalRecitation}" in source and "onClick={stopPersonalRecitation}" in source,
    "meeting_start_stop_connected": "onClick={startRecording}" in source and "onClick={stopRecording}" in source,
    "recorders_are_separate": all(token in source for token in ["personalMediaRecorderRef", "mediaRecorderRef", "personalChunksRef", "chunksRef"]),
    "short_recording_buttons_are_disabled": source.count("disabled={personalRecordingTime < 3}") == 1 and source.count("disabled={recordingTime < 3}") == 1,
    "short_recording_has_friendly_copy": all(token in source for token in ["3秒以上録音してください", "请至少录音3秒", "friendlyRecordingError"]),
    "raw_zod_json_is_hidden": "message.trim().startsWith(\"[{\")" in source and "durationSeconds|too_small" in source,
    "principles_api_allows_admin_target_only": "targetStaffId: z.number().int().positive().optional()" in save_principles_block and "resolveRecordingTarget(db, ctx.user, input.targetStaffId)" in save_principles_block,
    "meeting_api_allows_admin_target_only": "targetStaffId: z.number().int().positive().optional()" in save_meeting_block and "resolveRecordingTarget(db, ctx.user, input.targetStaffId)" in save_meeting_block,
    "non_admin_cannot_select_other_staff": 'user.role !== "admin"' in router and "他のスタッフを選択できるのは管理者だけです" in router,
    "operator_audit_is_saved_for_both": save_principles_block.count("operatorUserId: ctx.user.id") == 1 and save_meeting_block.count("operatorUserId: ctx.user.id") == 1,
    "target_identity_is_separate_from_operator": all(token in schema for token in ["targetKey", "operatorUserId", "operatorUserName", "operatorUserEmail"]),
    "two_recording_types_are_explicit": 'principles: "principles"' in router and 'morningMeeting: "morning_meeting"' in router,
    "one_record_per_target_type_day": "unique_morning_daily_recording_date_target_type" in schema and "unique_morning_daily_recording_date_target_type" in migration,
    "legacy_rows_are_preserved_as_principles": "DEFAULT 'principles'" in migration and "CONCAT('user:', userId)" in migration,
    "legacy_unique_index_is_removed": "unique_morning_principle_date_user" in migration and "DROP INDEX" in migration,
    "migration_is_idempotent": all(token in migration for token in ["CREATE TABLE IF NOT EXISTS", "INFORMATION_SCHEMA.COLUMNS", "INFORMATION_SCHEMA.STATISTICS"]),
    "migration_is_registered": "createMorningPrincipleRecitations" in server,
    "daily_list_is_self_only_for_regular_users": 'ctx.user.role !== "admin"' in daily_list_block and "members: [ownMember]" in daily_list_block,
    "daily_list_allows_admin_roster": "canSelectStaff: true" in daily_list_block and "activeStaff.map" in daily_list_block,
    "both_records_have_completion_state": all(token in daily_list_block for token in ["principlesCompleted", "morningMeetingCompleted", "allCompleted"]),
    "meeting_audio_is_transcribed_and_summarized": all(token in save_meeting_block for token in ["transcribeAudio", "correctTranscription", "generateMeetingSummary", 'status: "completed"']),
    "meeting_failure_is_recorded_and_retryable": 'status: "failed"' in save_meeting_block and 'existing?.status === "completed"' in save_meeting_block,
    "audio_has_size_mime_and_signature_checks": all(token in router for token in ["TEAM_MEETING_AUDIO_MAX_BYTES", "PERSONAL_RECITATION_MAX_BYTES", "ALLOWED_AUDIO_MIME_TYPES", "isWebm", "isOgg", "isMp4"]),
    "storage_is_partitioned_by_target_and_type": "morning-daily-recordings/${date}/${target.targetKey.replace" in router and "principles-${nanoid" in router and "morning-meeting-${nanoid" in router,
    "daily_audio_access_is_owner_or_admin": "requireDailyRecordingAccess" in router and "getDailyRecordingAudioUrl" in router,
    "same_origin_microphone_is_allowed": "microphone=(self)" in server and "microphone=()" not in server,
    "other_browser_permissions_remain_restricted": "camera=(self)" in server and "geolocation=()" in server,
    "old_shared_meeting_history_is_preserved": 'mysqlTable("morning_meetings"' in schema and "getHistory: protectedProcedure" in router,
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
