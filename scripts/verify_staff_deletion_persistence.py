from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "server/_core/index.ts").read_text(encoding="utf-8")
SCHEMA = (ROOT / "drizzle/schema.ts").read_text(encoding="utf-8")
MIGRATION = (ROOT / "server/migrations/upgradeManualPersistenceProtection.ts").read_text(encoding="utf-8")
PERSISTENCE = (ROOT / "server/manualStaffPersistence.ts").read_text(encoding="utf-8")
ROUTERS = (ROOT / "server/routers.ts").read_text(encoding="utf-8")
DB = (ROOT / "server/db.ts").read_text(encoding="utf-8")
GMV_HR = (ROOT / "server/gmvHrRecovery.ts").read_text(encoding="utf-8")
UI = (ROOT / "client/src/pages/ReportStaffManagement.tsx").read_text(encoding="utf-8")

NON_HR_STARTUP_RECOVERIES = [
    "runGmvHrRecoveryOnce",
    "runSelectionPriceBundleRecovery",
    "runLiverHomeFinanceRecovery",
    "runLiverPayrollRecovery",
    "runLcjBrainDataRecovery",
    "runAccountBrandDataRecovery",
    "runReportsAccountsProductsRecovery",
    "runSelectionProductDeepRecovery",
    "runKgProductRecovery",
    "runMallPointMemberRecovery",
    "runMallBusinessReferenceRecovery",
]

checks: list[tuple[str, bool]] = []
checks.append(("HR36 startup import/call is removed", "runHr36DirectoryRecovery" not in INDEX))
checks.append(("all non-HR startup recoveries remain unchanged", all(symbol in INDEX for symbol in NON_HR_STARTUP_RECOVERIES)))
checks.append(("HR36 freeze comment is explicit", "Historical HR36 restoration is frozen" in INDEX))
checks.append(("GMV/store recovery remains enabled", "await runGmvHrRecoveryOnce();" in INDEX))
checks.append(("GMV recovery no longer invokes staff restoration", "restoreStaff(connection)" not in GMV_HR and "staffRecoveryFrozen: true" in GMV_HR))
checks.append(("GMV recovery still invokes store restoration", "storeResult = await restoreStores(connection);" in GMV_HR))
checks.append(("encrypted backup scheduler remains enabled", "startDatabaseBackupScheduler();" in INDEX))
upgrade_call_index = INDEX.index("await runManualPersistenceProtectionUpgrade();")
production_listen_index = INDEX.index("server.listen(port, async", upgrade_call_index)
checks.append(("normal schema upgrades remain before listen", upgrade_call_index < production_listen_index))

report_schema = SCHEMA[SCHEMA.index('export const reportStaff = mysqlTable("report_staff"'):SCHEMA.index("export type ReportStaff")]
for field in ("archivedAt", "archivedBy", "archiveReason", "manualRevisionAt", "manualRevisionBy"):
    checks.append((f"report_staff schema includes {field}", field in report_schema))

checks.append(("migration version is v2", 'manual-persistence-protection-v2-2026-08-27' in MIGRATION))
checks.append(("migration creates all archive columns", all(f'"{field}"' in MIGRATION for field in ("archivedAt", "archivedBy", "archiveReason"))))
checks.append(("migration requires encrypted pre/post backups", all(token in MIGRATION for token in ("pre-manual-persistence-v2", "post-manual-persistence-v2", "runVerifiedBackup", "status !== \"success\""))))
checks.append(("migration records that old TiDB is unused", "oldTiDBUsed: false" in MIGRATION))

checks.append(("report archive is an exported transactional operation", "export async function archiveReportProfile" in PERSISTENCE and "return await db.transaction" in PERSISTENCE))
checks.append(("report archive writes tombstone and inactive status", all(token in PERSISTENCE for token in ("archivedAt: now", "archivedBy: input.actor.id", 'isActive: "inactive"', "manualRevisionAt: now"))))
checks.append(("report archive records before/after actor audit", all(token in PERSISTENCE for token in ('action: "archive"', "before,", "after,", "actor: input.actor"))))
checks.append(("explicit report restore is audited", "export async function restoreReportProfile" in PERSISTENCE and 'action: "restore"' in PERSISTENCE))
checks.append(("normal updates reject archived report profiles", "if (!includeArchived && rows[0].archivedAt)" in PERSISTENCE))

report_delete_start = ROUTERS.index("    delete: protectedProcedure", ROUTERS.index("reportStaff: router"))
report_delete_end = ROUTERS.index("    // Get current user's reportStaffId", report_delete_start)
report_delete = ROUTERS[report_delete_start:report_delete_end]
checks.append(("production report delete uses archive function", "archiveReportProfile" in report_delete and 'mode: "archive"' in report_delete))
checks.append(("physical delete is test-only", 'process.env.NODE_ENV === "test"' in report_delete and report_delete.index('process.env.NODE_ENV === "test"') < report_delete.index("deleteReportStaff")))
checks.append(("restore endpoint is administrator-only", "restoreArchived" in report_delete and 'ctx.user.role !== "admin"' in report_delete))

checks.append(("report staff list hides report tombstones", "isNull(reportStaff.archivedAt)" in DB[DB.index("export async function getAllReportStaff"):DB.index("export async function getActiveReportStaff")]))
checks.append(("report staff list hides linked HR archives", "isNull(staff.archivedAt)" in DB[DB.index("export async function getAllReportStaff"):DB.index("export async function getActiveReportStaff")]))
checks.append(("active report list hides both archive states", all(token in DB[DB.index("export async function getActiveReportStaff"):DB.index("export async function getReportStaffById")] for token in ("isNull(reportStaff.archivedAt)", "isNull(staff.archivedAt)"))))
checks.append(("HR unified list hides report tombstones", "isNull(reportStaff.archivedAt)" in DB[DB.index("export async function getAllReportStaffWithLinkedStaff"):DB.index("export async function getArchivedReportStaffWithLinkedStaff")]))
checks.append(("automatic linking ignores deleted report staff", "isNull(reportStaff.archivedAt)" in DB[DB.index("export async function autoLinkReportStaffToStaff"):DB.index("export async function createStaffFromReportStaff")]))
checks.append(("staff creation ignores deleted report staff", "isNull(reportStaff.archivedAt)" in DB[DB.index("export async function createStaffFromReportStaff"):DB.index("export async function getReportCountByReportStaffId")]))
checks.append(("self report identity ignores deleted profiles", ROUTERS.count("isNull(reportStaff.archivedAt)") >= 2))
checks.append(("UI confirms persistence and history preservation", "既存の日報は保持され、再起動後も自動復活しません" in UI))
checks.append(("archive code never deletes report history", ".delete(reports)" not in PERSISTENCE and "DELETE FROM reports" not in PERSISTENCE))
checks.append(("startup entry contains no old TiDB URL", "tidbcloud.com" not in INDEX.lower() and "gateway03" not in INDEX.lower()))

failed = [name for name, passed in checks if not passed]
for name, passed in checks:
    print(f"{'PASS' if passed else 'FAIL'}: {name}")
print(f"SUMMARY: {len(checks) - len(failed)}/{len(checks)} passed")
if failed:
    raise SystemExit("Failed checks: " + "; ".join(failed))
