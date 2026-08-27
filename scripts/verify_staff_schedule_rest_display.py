#!/usr/bin/env python3
"""Static regression checks for the /staff-schedule daily roster.

The daily page must display every active employee. Employees without a saved
schedule are represented only in React state as read-only rest-day rows; they
must never be persisted to staff_schedules.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "client/src/pages/StaffSchedule.tsx"
source = PAGE.read_text(encoding="utf-8")

checks: dict[str, bool] = {
    "page has an authentication guard": "const { loading: authLoading, user } = useAuth();" in source,
    "active staff query waits for authentication": "trpc.staff.listActive.useQuery(undefined, { enabled: !!user })" in source,
    "schedule query waits for authentication": "}, { enabled: !!user });" in source,
    "unauthenticated users return to login with redirect": "window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;" in source,
    "active staff roster is fetched": "trpc.staff.listActive.useQuery" in source,
    "saved schedules remain the source of working and leave rows": "trpc.staffSchedule.getByDateRange.useQuery" in source,
    "scheduled staff are deduplicated from rest roster": "const scheduledStaffIds = new Set(saved.map(s => s.staffId));" in source,
    "missing active staff become rest rows": ".filter((staff: any) => !scheduledStaffIds.has(staff.id))" in source,
    "rest rows use non-database negative ids": "id: -staff.id" in source,
    "rest rows are explicitly synthetic": "isRestDay: true" in source,
    "rest rows have no times": 'startTime: ""' in source and 'endTime: ""' in source,
    "rest rows are merged with saved schedules": "applyFilters([...saved, ...resting])" in source,
    "leave rows retain the existing tag": 'includes("[请假]")' in source,
    "rest filter is available": '<SelectItem value="rest">☕ 休息</SelectItem>' in source,
    "rest rows are visually distinct": 'bg-slate-50 text-slate-500' in source and '☕ 休息' in source,
    "rest row delete is disabled": "!isRest && !isPastDate(s.date)" in source,
    "active roster heading is explicit": "本日の在職スタッフ" in source,
    "other and unset countries are not dropped": "const otherSchedules" in source and "その他・未設定" in source,
}

# Guard the critical implementation block against accidental DB mutations.
match = re.search(
    r"const todaySchedules = useMemo\(\(\) => \{(?P<body>.*?)\n  \}, \[schedules, staffList,",
    source,
    re.DOTALL,
)
checks["daily roster implementation block is present"] = match is not None
if match:
    body = match.group("body")
    checks["daily roster performs no mutations"] = not any(
        token in body
        for token in (
            "createMutation",
            "deleteMutation",
            "updateMutation",
            ".mutate(",
            ".mutateAsync(",
        )
    )
else:
    checks["daily roster performs no mutations"] = False

failed = [label for label, passed in checks.items() if not passed]
for label, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'}: {label}")

if failed:
    raise SystemExit(f"{len(failed)} staff-schedule rest-display regression check(s) failed")

print(f"PASS: {len(checks)} staff-schedule rest-display regression checks")
