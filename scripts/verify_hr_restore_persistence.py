from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
archive = (ROOT / "server/hrStaffArchive.ts").read_text(encoding="utf-8")
router = (ROOT / "server/routers.ts").read_text(encoding="utf-8")
entry = (ROOT / "server/_core/index.ts").read_text(encoding="utf-8")
ui = (ROOT / "client/src/pages/HRManagement.tsx").read_text(encoding="utf-8")
manual = (ROOT / "server/manualStaffPersistence.ts").read_text(encoding="utf-8")

checks: list[tuple[str, bool]] = []

def check(name: str, condition: bool) -> None:
    checks.append((name, condition))

check("hardcoded deactivate migration file removed", not (ROOT / "server/migrations/deactivateStaffAccount.ts").exists())
check("startup no longer imports hardcoded deactivate", "deactivateStaffAccount" not in entry)
check("server source no longer contains target email", "j2914113930@163.com" not in "\n".join([archive, router, entry, manual]))
check("injectable atomic restore exists", "restoreArchivedStaffWithPool" in archive)
check("restore starts transaction", "await connection.beginTransaction()" in archive)
check("restore commits", "await connection.commit()" in archive)
check("restore rolls back", "await connection.rollback()" in archive)
check("staff row locked", "FROM staff WHERE id = ? LIMIT 1 FOR UPDATE" in archive)
check("report row locked", "FROM report_staff WHERE id = ? LIMIT 1 FOR UPDATE" in archive)
check("link mismatch rejected", "スタッフと日報スタッフの紐付けが一致しません" in archive)
check("staff restored active", "UPDATE staff SET isActive = 'active'" in archive)
check("staff resignation cleared", "resignDate = NULL, resignReason = NULL" in archive)
check("staff archive cleared", "archivedAt = NULL, archivedBy = NULL, archiveReason = NULL" in archive)
check("report staff restored active", "UPDATE report_staff SET isActive = 'active'" in archive)
check("report staff archive cleared", "archiveReason = NULL, manualRevisionAt = CURRENT_TIMESTAMP" in archive)
check("report update validates link in where", "WHERE id = ? AND linkedStaffId = ?" in archive)
check("user account restored in same transaction", "UPDATE users SET email = ? WHERE email = CONCAT('resigned_', id, '_', ?)" in archive)
check("staff restore audit written", 'entityType: "staff"' in archive)
check("report restore audit written", 'entityType: "report_staff"' in archive)
check("manual restore audit source ui", "VALUES (?, ?, 'restore', ?, ?, ?, ?, ?, 'ui')" in archive)
check("HR archive event differentiates reinstate", 'eventAction = input.restoreMode === "reinstate" ? "reinstate" : "restore"' in archive)
check("idempotent fully active result", "restored: false, referenceCounts, userAccountRestored: false" in archive)
check("reinstate route uses atomic restore", 'restoreMode: "reinstate"' in router and "restoreArchivedStaff({" in router)
check("archive restore route uses atomic restore", 'restoreMode: "restore"' in router)
check("routes pass actor id", "performedBy: ctx.user.id" in router or "performedBy: actor.id" in router)
check("routes pass actor name", "performedByName" in router)
check("unlinked report-only reinstate preserved", "if (!input.staffId)" in router and "updateReportProfileAndLinkedStaff" in router)
check("UI announces linked state synchronization", "HR主档・報告スタッフ・アカウント状態を同期しました" in ui)
check("UI refreshes staff list after reinstate", "utils.staff.list.invalidate();" in ui)
check("UI archive restore announces reinstatement", "人物目录へ復元し、復職状態も同期しました" in ui)

changed = subprocess.run(
    ["git", "diff", "--name-only", "origin/main"],
    cwd=ROOT,
    check=True,
    text=True,
    capture_output=True,
).stdout.splitlines()
allowed = {
    "WORK_LOG.md",
    "client/src/pages/HRManagement.tsx",
    "hr_restore_persistence_spec.md",
    "hr_restore_target_production_readonly.json",
    "hr_restore_target_production_readonly.py",
    "hr_restore_visual_regression.json",
    "hr_restore_visual_regression.py",
    "hr_restore_visual_review.md",
    "scripts/test_hr_restore_transaction.ts",
    "scripts/verify_hr_restore_persistence.py",
    "server/_core/index.ts",
    "server/hrStaffArchive.ts",
    "server/migrations/deactivateStaffAccount.ts",
    "server/routers.ts",
}
check("all tracked diffs stay within HR scope", all(path in allowed for path in changed))

failed = [name for name, passed in checks if not passed]
for name, passed in checks:
    print(f"{'PASS' if passed else 'FAIL'}: {name}")
if failed:
    print("failed checks: " + "; ".join(failed))
    raise SystemExit(1)
print(f"RESULT: {len(checks)}/{len(checks)} checks passed")
