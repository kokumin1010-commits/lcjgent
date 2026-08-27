#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

schema = read("drizzle/schema.ts")
migration = read("server/migrations/upgradeManualPersistenceProtection.ts")
core = read("server/_core/index.ts")
routers = read("server/routers.ts")
manual_staff = read("server/manualStaffPersistence.ts")
manual_recovery = read("server/manualDataLossRecovery.ts")
backup = read("server/databaseBackupScheduler.ts")
hr36 = read("server/hr36DirectoryRecovery.ts")
store = read("server/storeManagementRouter.ts")
archive = read("server/hrStaffArchive.ts")
db = read("server/db.ts")
gmv = read("server/gmvHrRecovery.ts")

checks = {
    "staff_schema_manual_revision": schema.count('manualRevisionAt: timestamp("manualRevisionAt")') >= 2 and schema.count('manualRevisionBy: int("manualRevisionBy")') >= 2,
    "migration_staff_manual_columns": 'for (const tableName of ["staff", "report_staff", "managed_stores"])' in migration and 'ADD COLUMN \\`manualRevisionAt\\`' in migration,
    "migration_report_staff_manual_columns": 'for (const tableName of ["staff", "report_staff", "managed_stores"])' in migration and 'ADD COLUMN \\`manualRevisionBy\\`' in migration,
    "migration_store_manual_columns": 'addManualRevisionColumns(pool, tableName)' in migration,
    "migration_change_event_table": "CREATE TABLE IF NOT EXISTS manual_data_change_events" in migration,
    "migration_recovery_run_table": "CREATE TABLE IF NOT EXISTS manual_data_loss_recovery_runs" in migration,
    "migration_precedes_hr_recovery": core.index("await runManualPersistenceProtectionUpgrade()") < core.index("await runHr36DirectoryRecovery()"),
    "staff_create_atomic": "createStaffAndReportProfile" in routers and "db.transaction" in manual_staff,
    "staff_update_atomic": "updateStaffAndLinkedReportProfile" in routers and "multiple report_staff rows linked" in manual_staff,
    "report_create_atomic": "createReportProfileWithOptionalStaff" in routers,
    "report_update_atomic": "updateReportProfileAndLinkedStaff" in routers,
    "report_to_staff_atomic": "createStaffFromExistingReportProfile" in routers and "この報告社員は既に人事社員へ紐付いています" in manual_staff,
    "staff_update_missing_row_rejected": "staff not found:" in manual_staff,
    "report_update_missing_row_rejected": "report_staff not found:" in manual_staff,
    "staff_manual_marker_written": "manualRevisionAt: now" in manual_staff and "manualRevisionBy: input.actor.id" in manual_staff,
    "manual_change_events_written": "INSERT INTO manual_data_change_events" in manual_staff,
    "resign_uses_atomic_service": "staffData: {\n              isActive: \"inactive\"" in routers and "CONFLICT" in routers,
    "reinstate_uses_atomic_service": "staffData: { isActive: \"active\", resignDate: null" in routers,
    "avatar_uses_atomic_service": "staffData: { avatarUrl: url }" in routers,
    "tier_uses_atomic_service": "evaluationScore: input.evaluationScore" in routers and "updateStaffAndLinkedReportProfile" in routers,
    "auto_link_marks_manual": "autoLinkReportStaffToStaff(ctx.user.id)" in routers and "manualRevisionBy: performedBy ?? null" in db,
    "archive_marks_manual": "manualRevisionAt = CURRENT_TIMESTAMP" in archive and "manualRevisionBy = ?" in archive,
    "store_create_marks_manual": "manualRevisionAt, manualRevisionBy" in store and "ctx.user.id" in store,
    "store_update_marks_manual": "manualRevisionAt = CURRENT_TIMESTAMP" in store and "店铺保存失败：更新行数不一致" in store,
    "store_existing_audit_preserved": "writeProfileAudit(connection" in store and "profile_updated" in store,
    "hr36_manual_values_authoritative": "Manual HR values are authoritative" in hr36,
    "hr36_manual_staff_business_fields_not_overwritten": "if (existing.manualRevisionAt)" in hr36 and "UPDATE staff SET directoryClass=?" in hr36,
    "hr36_manual_report_business_fields_not_overwritten": "if (reportRows[0].manualRevisionAt)" in hr36 and "linkedStaffId=COALESCE(linkedStaffId, ?)" in hr36,
    "hr36_health_allows_verified_manual_employment": "manualVerifiedEmploymentCount" in hr36 and "employmentTypeUnverifiedCount + counts.manualVerifiedEmploymentCount" in hr36,
    "gmv_recovery_non_destructive_columns": "operatorName = VALUES(operatorName)" not in gmv and "contactEmail = VALUES(contactEmail)" not in gmv,
    "backup_table_reader_exported": "export async function readDatabaseBackupTables" in backup,
    "backup_reader_verifies_success": 'run.status !== "success"' in backup and "backup checksum mismatch" in backup,
    "backup_reader_fallback_keys": "for (const candidateKey of objectKeys)" in backup and "backup object is unavailable" in backup,
    "recovery_admin_only": "manualLossRecoveryPreview" in routers and 'ctx.user.role !== "admin"' in routers,
    "recovery_confirmation_literal": "manualDataLossRecoveryConfirmation" in routers and "RECOVER_MANUAL_HR_REPORT_STORE_2026_08_27" in manual_recovery,
    "recovery_conservative_exact_match": "indexById" in manual_recovery and "inRecoveryWindow" in manual_recovery and "AmbiguousDifference" in manual_recovery,
    "recovery_pre_post_backup": 'runDatabaseBackup("pre-manual-loss-recovery"' in manual_recovery and 'runDatabaseBackup("post-manual-loss-recovery"' in manual_recovery,
    "recovery_transactional": "beginTransaction" in manual_recovery and "rollback" in manual_recovery and "commit" in manual_recovery,
    "recovery_run_audit": "manual_data_loss_recovery_runs" in manual_recovery and "contextJson" in manual_recovery and "resultJson" in manual_recovery,
    "recovery_marks_manual": 'sets.push("`manualRevisionAt` = CURRENT_TIMESTAMP"' in manual_recovery,
}

failed = [name for name, ok in checks.items() if not ok]
result = {"passed": len(checks) - len(failed), "total": len(checks), "failed": failed, "checks": checks}
(ROOT / "hr_report_store_persistence_static.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(1 if failed else 0)
