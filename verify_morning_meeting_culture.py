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

checks = {
    "japanese_has_exactly_nine_principles": len(re.findall(r'\{ title:', ja_block)) == 9,
    "chinese_has_exactly_nine_principles": len(re.findall(r'\{ title:', zh_block)) == 9,
    "japanese_approved_opening_present": "やると決めたら、100％やり切る。" in ja_block,
    "japanese_approved_closing_present": "すべては、LCJの成功のために。" in ja_block,
    "chinese_original_opening_present": "做就做100%。做到过，就不许退步。" in zh_block,
    "chinese_original_closing_present": "一切为了LCJ成功。" in zh_block,
    "selected_language_drives_principles": "LCJ_CULTURE_PRINCIPLES[speechLang]" in source,
    "selected_language_drives_copy": "MORNING_MEETING_COPY[speechLang]" in source,
    "language_buttons_are_accessible": source.count("aria-pressed={speechLang") >= 6,
    "language_switch_updates_recognition": all(token in source for token in ["changeSpeechLanguage", "recognitionRef.current.lang = language", "recognitionRef.current.stop()"]),
    "team_recording_uses_selected_language": "recognition.lang = speechLang" in source and 'const language = speechLang === "zh-CN" ? "zh" : "ja"' in source,
    "personal_record_start_and_stop_connected": all(token in source for token in ["onClick={startPersonalRecitation}", "onClick={stopPersonalRecitation}"]),
    "team_record_start_and_stop_connected": all(token in source for token in ["onClick={startRecording}", "onClick={stopRecording}"]),
    "personal_and_team_recorders_are_separate": all(token in source for token in ["personalMediaRecorderRef", "mediaRecorderRef", "personalChunksRef", "chunksRef"]),
    "recording_cards_render_before_principles": all(token in source for token in ['className="order-2 border-2 border-blue-100', 'className="order-2 border-2 border-dashed', 'className="order-3 overflow-hidden']),
    "principles_always_rendered_without_collapse": "culturePrinciples.map((principle, index)" in source and "xl:grid-cols-3" in source,
    "personal_completion_roster_rendered": all(token in source for token in ["personalToday.completedCount", "personalToday.totalCount", "personalToday.members.map"]),
    "staff_position_rendered_beside_name": "member.position" in source,
    "personal_audio_playback_connected": "getPersonalRecitationAudioUrl.useQuery" in source,
    "personal_audio_saved_by_authenticated_user": all(token in router for token in ["userId: ctx.user.id", "userEmail: ctx.user.email", "userName = ctx.user.name"]),
    "personal_input_has_no_arbitrary_user_id": "savePersonalRecitation: protectedProcedure" in router and "userId: z." not in router[router.index("savePersonalRecitation: protectedProcedure"):router.index("getTodayPersonalRecitations: protectedProcedure")],
    "one_person_one_record_per_day": "unique_morning_principle_date_user" in schema and "unique_morning_principle_date_user" in migration,
    "personal_audio_has_size_mime_and_signature_checks": all(token in router for token in ["PERSONAL_RECITATION_MAX_BYTES", "ALLOWED_AUDIO_MIME_TYPES", "isWebm", "isOgg", "isMp4"]),
    "personal_storage_partitioned_by_date_and_user": "morning-principle-recitations/${date}/user-${ctx.user.id}/" in router,
    "personal_audio_access_is_owner_or_admin": all(token in router for token in ["getPersonalRecitationAudioUrl", 'ctx.user.role !== "admin" && record.userId !== ctx.user.id']),
    "team_meeting_updates_require_owner_or_admin": router.count("requireMeetingOwnerOrAdmin") >= 4,
    "team_audio_is_saved_with_transcript_path": all(token in source for token in ["audioBase64,", "mimeType,", "uploadAndProcessMutation.mutateAsync"]),
    "migration_is_idempotent_and_registered": "CREATE TABLE IF NOT EXISTS morning_principle_recitations" in migration and "createMorningPrincipleRecitations" in server,
    "team_and_personal_tables_remain_separate": 'mysqlTable("morning_meetings"' in schema and 'mysqlTable("morning_principle_recitations"' in schema,
    "same_origin_microphone_is_allowed": "microphone=(self)" in server and "microphone=()" not in server,
    "camera_and_geolocation_policy_remain_restricted": "camera=(self)" in server and "geolocation=()" in server,
    "closing_statement_rendered": "{copy.closing}" in source,
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
