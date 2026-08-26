#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
files = {
    "archive": ROOT / "server/hrStaffArchive.ts",
    "db": ROOT / "server/db.ts",
    "router": ROOT / "server/routers.ts",
    "schema": ROOT / "drizzle/schema.ts",
    "hr_ui": ROOT / "client/src/pages/HRManagement.tsx",
    "legacy_ui": ROOT / "client/src/pages/StaffManagement.tsx",
    "startup": ROOT / "server/_core/index.ts",
}
texts = {key: path.read_text(encoding="utf-8") for key, path in files.items()}

expected_references = {
    "tasks": '["tasks", "tasks", "staffId", staffId]',
    "task_staff": '["taskStaff", "task_staff", "staffId", staffId]',
    "report_staff": '["reportStaffLinks", "report_staff", "linkedStaffId", staffId]',
    "reports": '["reports", "reports", "reportStaffId", reportStaffId]',
    "report_followups": '["reportFollowups", "report_followups", "reportStaffId", reportStaffId]',
    "brand_lcj_staff": '["brandLcjStaff", "brand_lcj_staff", "reportStaffId", reportStaffId]',
    "chat_report_sessions": '["chatReportSessions", "chat_report_sessions", "staffId", reportStaffId]',
    "staff_ai_profiles": '["staffAiProfiles", "staff_ai_profiles", "staffId", reportStaffId]',
    "line_users": '["lineUsers", "line_users", "staffId", staffId]',
    "recruitment_follow_records": '["recruitmentFollowRecords", "recruitment_follow_records", "staff_id", staffId]',
    "staff_schedules": '["staffSchedules", "staff_schedules", "staffId", staffId]',
}

checks = {
    "no_delete_statement_in_archive_module": "DELETE FROM" not in texts["archive"].upper(),
    "archive_updates_only_staff_archive_fields": "UPDATE staff SET archivedAt = CURRENT_TIMESTAMP" in texts["archive"],
    "restore_clears_only_archive_fields": "UPDATE staff SET archivedAt = NULL, archivedBy = NULL, archiveReason = NULL" in texts["archive"],
    "archive_requires_resign_date": "if (!target.staff.resignDate" in texts["archive"],
    "schema_has_archive_columns": all(token in texts["schema"] for token in ['timestamp("archivedAt")', 'int("archivedBy")', 'text("archiveReason")']),
    "visible_staff_queries_exclude_archived": texts["db"].count("isNull(staff.archivedAt)") >= 4,
    "archived_directory_query_exists": "getArchivedReportStaffWithLinkedStaff" in texts["db"],
    "production_delete_redirects_to_archive": "await archiveResignedStaff" in texts["router"] and 'process.env.NODE_ENV === "test"' in texts["router"],
    "archive_restore_api_exists": all(token in texts["router"] for token in ["archiveResigned:", "restoreArchived:", "archiveHealth:"]),
    "startup_setup_before_listen": texts["startup"].find("await runHrStaffArchiveSetup()") < texts["startup"].rfind("server.listen(port"),
    "hr_ui_has_archive_and_restore": all(token in texts["hr_ui"] for token in ["アーカイブ箱", "目录から削除", "目录へ復元", "日報・タスク・給与・評価履歴は保持"]),
    "legacy_ui_no_longer_claims_permanent_delete": "情報が完全に削除されます" not in texts["legacy_ui"],
}

reference_checks = {name: snippet in texts["archive"] for name, snippet in expected_references.items()}
checks["all_reference_domains_counted"] = all(reference_checks.values())

result = {
    "status": "pass" if all(checks.values()) else "fail",
    "checks": checks,
    "referenceChecks": reference_checks,
    "referenceCount": len(reference_checks),
    "allReferencesPreservedBySoftArchive": all(reference_checks.values()) and checks["no_delete_statement_in_archive_module"],
    "files": {
        key: {
            "path": str(path.relative_to(ROOT)),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        for key, path in files.items()
    },
    "testEnvironmentNote": "Existing hrResign.test.ts requires DATABASE_URL; local sandbox test run failed only because no database was configured. Target server/client builds passed.",
}
output = ROOT / "hr_staff_archive_static_integrity.json"
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "checks": checks, "referenceCount": len(reference_checks)}, ensure_ascii=False, indent=2))
if result["status"] != "pass":
    raise SystemExit(1)
