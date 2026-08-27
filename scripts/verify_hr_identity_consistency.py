#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

schema = text("drizzle/schema.ts")
upgrade = text("server/migrations/upgradeStaffIdentityConsistency.ts")
startup = text("server/_core/index.ts")
identity = text("server/staffIdentityConsistency.ts")
identity_router = text("server/staffIdentityRouter.ts")
identity_query = text("server/staffIdentityQuery.ts")
manual = text("server/manualStaffPersistence.ts")
archive = text("server/hrStaffArchive.ts")
db = text("server/db.ts")
routers = text("server/routers.ts")
morning = text("server/morningMeetingRouter.ts")
influencer = text("server/influencerBdRouter.ts")
recruitment = text("server/recruitmentRouter.ts")
coin = text("server/lcjCoinRouter.ts")
store = text("server/storeManagementRouter.ts")
issue = text("server/issueTrackerRouter.ts")
tiktok = text("server/tiktokCompetitorDailyRouter.ts")
users = text("server/userManagementRouter.ts")
peer_scheduler = text("server/peerBonusResetScheduler.ts")

checks = {
    "schema_identity_key": 'identityKey: varchar("identityKey"' in schema,
    "schema_merge_tombstone": 'mergedIntoStaffId: int("mergedIntoStaffId")' in schema,
    "upgrade_recent_backup_gate": "requireRecentVerifiedBackup" in upgrade and "RECENT_BACKUP_MAX_HOURS = 26" in upgrade,
    "merge_explicit_pre_post_backup": all(value in identity_router for value in ["createBackup", 'z.enum([\"pre\", \"post\"])', "pre-staff-identity-merge", "post-staff-identity-merge"]),
    "upgrade_unique_identity": "staff_identity_key_unique" in upgrade and "ADD UNIQUE KEY staff_identity_key_unique" in upgrade,
    "upgrade_unique_report_link": "report_staff_active_linked_staff_unique" in upgrade and "activeLinkedStaffId" in upgrade,
    "upgrade_no_auto_merge": "UPDATE staff SET mergedIntoStaffId" not in upgrade,
    "startup_upgrade_registered": "runStaffIdentityConsistencyUpgrade" in startup,
    "startup_upgrade_before_listen": startup.find("runStaffIdentityConsistencyUpgrade") < startup.find("server.listen"),
    "verified_email_identity_only": 'emailEvidenceStatus && emailEvidenceStatus !== "verified"' in identity,
    "placeholder_email_excluded": 'normalized.endsWith("@lcj.placeholder")' in identity,
    "same_name_not_identity": "normalizeName(canonical.name) !== normalizeName(duplicate.name)" in identity,
    "email_must_match": "verified email identity does not match" in identity,
    "exact_pair_required": "identity group is not exactly the requested pair" in identity,
    "backup_required_for_merge": all(value in identity for value in ["pre-staff-identity-merge", "2 * 60 * 60 * 1000", "backupAgeMs"]),
    "canonical_report_required": "canonical staff must have exactly one report_staff link" in identity,
    "duplicate_report_forbidden": "duplicate staff unexpectedly has a report_staff link" in identity,
    "schedule_conflict_guard": "staff_schedules:" in identity,
    "morning_conflict_guard": "morning_principle_recitations:" in identity,
    "coin_conflict_guard": "both-identities-have-holdings" in identity,
    "task_assignment_dedup": "mergeTaskStaffAssignments" in identity,
    "chat_member_dedup": "mergeChatRoomMembers" in identity,
    "merge_idempotent": "alreadyMergedIntoCanonical" in identity and "merged: false" in identity,
    "merge_manual_audit": "writeManualMergeAudit" in identity,
    "merge_event_audit": "staff_identity_merge_events" in identity,
    "merge_soft_tombstone": "mergedIntoStaffId=?,isActive='inactive'" in identity,
    "reference_tasks": 'table: "tasks"' in identity and 'table: "task_staff"' in identity,
    "reference_users": 'table: "users"' in identity,
    "reference_brands": 'table: "brands"' in identity and 'table: "brand_livestreams"' in identity,
    "reference_store": 'table: "managed_stores"' in identity and 'table: "store_manager_goal_cycles"' in identity,
    "reference_recruitment": 'table: "recruitment_brands"' in identity and 'table: "recruitment_follow_records"' in identity,
    "reference_schedule": 'table: "staff_schedules"' in identity,
    "reference_morning": 'table: "morning_principle_recitations"' in identity,
    "reference_influencer": 'table: "influencer_bd_creators"' in identity and 'table: "influencer_bd_outreach_logs"' in identity,
    "reference_issue": 'table: "issues"' in identity,
    "reference_chat": 'table: "chat_room_members"' in identity and 'table: "chat_messages"' in identity,
    "reference_tiktok": 'table: "tiktok_competitor_reports"' in identity,
    "reference_coin": all(value in identity for value in ["lcj_coin_holdings", "lcj_coin_transactions", "lcj_coin_peer_bonuses"]),
    "central_current_filter": all(value in identity_query for value in ["isActive", "archivedAt", "mergedIntoStaffId"]),
    "manual_create_identity_guard": "requireAvailableIdentity" in manual and "createStaffAndReportProfile" in manual,
    "manual_update_identity_guard": "excludeStaffId: input.staffId" in manual,
    "manual_create_double_record": "reportStaffId" in manual and "staffId" in manual,
    "old_direct_staff_create_blocked": "Direct staff creation is disabled" in db,
    "core_staff_lists_filtered": "visibleCanonicalStaffCondition()" in db and "currentStaffCondition()" in db,
    "report_lists_follow_hr": "staff.isActive" in db and "staff.mergedIntoStaffId" in db,
    "hr_archive_rejects_merged": archive.count("mergedIntoStaffId") >= 4,
    "morning_follows_hr": morning.count("currentStaffCondition()") >= 4,
    "influencer_follows_hr": "mergedIntoStaffId IS NULL" in influencer,
    "recruitment_follows_hr": "currentStaffCondition()" in recruitment,
    "coin_follows_hr": coin.count("currentStaffCondition()") >= 7,
    "store_follows_hr": "mergedIntoStaffId IS NULL" in store,
    "issue_follows_hr": issue.count("mergedIntoStaffId IS NULL") >= 4,
    "schedule_follows_hr": routers.count("mergedIntoStaffId IS NULL") >= 6,
    "chat_name_fallback_removed": "姓名不是身份键" in routers,
    "tiktok_follows_hr": tiktok.count("mergedIntoStaffId IS NULL") >= 2,
    "account_management_canonical": users.count("isNull(staff.mergedIntoStaffId)") >= 2,
    "peer_bonus_scheduler_canonical": "currentStaffCondition()" in peer_scheduler,
    "admin_preview_and_merge": identity_router.count("adminProcedure") >= 5 and "previewMerge" in identity_router and "merge:" in identity_router,
    "merge_requires_explicit_confirmation": "STAFF_IDENTITY_MERGE_CONFIRMATION" in identity_router,
    "ensure_report_profile_admin_only": "ensureReportProfile" in identity_router and "adminProcedure" in identity_router,
}

failed = [name for name, ok in checks.items() if not ok]
result = {"passed": not failed, "checks": len(checks), "failed": failed, "details": checks}
print(json.dumps(result, ensure_ascii=False, indent=2))
if failed:
    raise SystemExit(1)
