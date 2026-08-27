#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4178").rstrip("/")
OUTPUT_DIR = ROOT / "staff_schedule_rest_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "staff_schedule_rest_visual_regression.json"

JST = timezone(timedelta(hours=9))
TODAY = datetime.now(JST).date().isoformat()

ADMIN_USER = {
    "id": 1,
    "openId": "staff-schedule-rest-admin",
    "name": "Staff Schedule Admin",
    "email": "staff-schedule-rest@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

STAFF = [
    {
        "id": 101,
        "name": "出勤 太郎",
        "nameEn": "Working Taro",
        "department": "運営部",
        "country": "日本",
        "avatarUrl": None,
        "isActive": "active",
    },
    {
        "id": 102,
        "name": "休息 花子",
        "nameEn": "Resting Hanako",
        "department": "ライバー部",
        "country": "日本",
        "avatarUrl": None,
        "isActive": "active",
    },
    {
        "id": 103,
        "name": "请假 小王",
        "nameEn": "Leave Wang",
        "department": "商务部",
        "country": "中国",
        "avatarUrl": None,
        "isActive": "active",
    },
    {
        "id": 104,
        "name": "未設定 アキラ",
        "nameEn": "Unset Akira",
        "department": "",
        "country": None,
        "avatarUrl": None,
        "isActive": "active",
    },
]

SCHEDULES = [
    {
        "id": 9001,
        "staffId": 101,
        "date": f"{TODAY}T00:00:00.000Z",
        "startTime": "09:00",
        "endTime": "18:00",
        "notes": "[早班]",
        "isLateEntry": 0,
        "color": "#2563EB",
        "staffName": "出勤 太郎",
        "country": "日本",
        "avatarUrl": None,
        "department": "運営部",
    },
    {
        "id": 9002,
        "staffId": 103,
        "date": f"{TODAY}T00:00:00.000Z",
        "startTime": "00:00",
        "endTime": "23:59",
        "notes": "[请假]",
        "isLateEntry": 0,
        "color": "#EF4444",
        "staffName": "请假 小王",
        "country": "中国",
        "avatarUrl": None,
        "department": "商务部",
    },
]


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def mock_value(procedure):
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "staff.listActive":
        return STAFF
    if procedure == "rbac.myPermissions":
        return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure == "liverManagement.list":
        return []
    if procedure == "staffSchedule.getByDateRange":
        return SCHEDULES
    if procedure == "staffSchedule.getAttendanceStats":
        return []
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1400})
    console_errors = []
    page_errors = []
    failed_requests = []
    mocked_procedures = []
    mutation_requests = []

    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def handle_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        joined = parsed.path.split("/api/trpc/", 1)[-1]
        procedures = joined.split(",")
        mocked_procedures.extend(procedures)
        if route.request.method != "GET":
            mutation_requests.append(f"{route.request.method} {joined}")
        payloads = [trpc_result(mock_value(procedure)) for procedure in procedures]
        body = payloads if len(payloads) > 1 else payloads[0]
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(body, ensure_ascii=False),
        )

    page.route("**/api/trpc/**", handle_route)
    response = page.goto(f"{BASE_URL}/staff-schedule", wait_until="domcontentloaded", timeout=45_000)

    try:
        page.get_by_text("本日の在職スタッフ", exact=True).wait_for(state="visible", timeout=20_000)
        for name in ("出勤 太郎", "休息 花子", "请假 小王", "未設定 アキラ"):
            page.get_by_text(name, exact=False).first.wait_for(state="visible", timeout=8_000)
    except Exception as error:
        debug_screenshot = OUTPUT_DIR / "staff_schedule_rest_debug.png"
        page.screenshot(path=str(debug_screenshot), full_page=True)
        debug = {
            "error": str(error),
            "url": page.url,
            "bodyText": page.locator("body").inner_text()[:12000],
            "mockedProcedures": sorted(set(mocked_procedures)),
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
            "screenshot": str(debug_screenshot),
        }
        OUTPUT_JSON.write_text(json.dumps(debug, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(debug, ensure_ascii=False, indent=2))
        browser.close()
        raise SystemExit(2)

    rows = page.locator("div.flex.items-center.px-4.py-3")
    working_row = rows.filter(has_text="出勤 太郎").first
    resting_row = rows.filter(has_text="休息 花子").first
    leave_row = rows.filter(has_text="请假 小王").first
    unset_row = rows.filter(has_text="未設定 アキラ").first

    initial_screenshot = OUTPUT_DIR / "staff_schedule_all_statuses.png"
    page.screenshot(path=str(initial_screenshot), full_page=True)

    initial_checks = {
        "workingVisible": working_row.is_visible(),
        "restingVisible": resting_row.is_visible(),
        "leaveVisible": leave_row.is_visible(),
        "unsetCountryVisible": unset_row.is_visible(),
        "workingTimeVisible": working_row.get_by_text("09:00 - 18:00", exact=True).is_visible(),
        "restBadgeVisible": resting_row.get_by_text("休息", exact=True).is_visible(),
        "restLabelVisible": resting_row.get_by_text("☕ 休息", exact=True).is_visible(),
        "leaveLabelVisible": leave_row.get_by_text("🏖️ 终日请假", exact=True).is_visible(),
        "workingDeleteVisible": working_row.locator("button").count() == 1,
        "leaveDeleteVisible": leave_row.locator("button").count() == 1,
        "restDeleteHidden": resting_row.locator("button").count() == 0,
        "unsetRestDeleteHidden": unset_row.locator("button").count() == 0,
        "restSlateStyle": "bg-slate-50" in (resting_row.get_attribute("class") or ""),
        "leaveRedStyle": "bg-red-50" in (leave_row.get_attribute("class") or ""),
        "otherCountryGroupVisible": page.get_by_text("その他・未設定", exact=True).last.is_visible(),
        "threeStateSummaryVisible": page.get_by_text("0名出勤 / 1名请假 / 0名休息", exact=True).is_visible(),
    }

    # Rest-only filter must keep both synthetic rest rows and hide saved work/leave rows.
    shift_filter = page.get_by_role("combobox").first
    shift_filter.click()
    page.get_by_role("option", name="☕ 休息", exact=True).click()
    page.wait_for_timeout(250)
    rest_filter_checks = {
        "restingVisible": page.get_by_text("休息 花子", exact=False).first.is_visible(),
        "unsetVisible": page.get_by_text("未設定 アキラ", exact=False).first.is_visible(),
        "workingHidden": page.get_by_text("出勤 太郎", exact=False).count() == 0,
        "leaveHidden": page.get_by_text("请假 小王", exact=False).count() == 0,
    }

    shift_filter.click()
    page.get_by_role("option", name="🏖️ 请假", exact=True).click()
    page.wait_for_timeout(250)
    leave_filter_checks = {
        "leaveVisible": page.get_by_text("请假 小王", exact=False).first.is_visible(),
        "workingHidden": page.get_by_text("出勤 太郎", exact=False).count() == 0,
        "restHidden": page.get_by_text("休息 花子", exact=False).count() == 0,
    }

    shift_filter.click()
    page.get_by_role("option", name="全班次", exact=True).click()
    page.wait_for_timeout(250)

    search_input = page.get_by_placeholder("名前/部門検索...", exact=True)
    search_input.fill("休息 花子")
    page.wait_for_timeout(250)
    search_checks = {
        "matchingRestVisible": page.get_by_text("休息 花子", exact=False).first.is_visible(),
        "workingHidden": page.get_by_text("出勤 太郎", exact=False).count() == 0,
        "leaveHidden": page.get_by_text("请假 小王", exact=False).count() == 0,
        "unsetHidden": page.get_by_text("未設定 アキラ", exact=False).count() == 0,
    }
    search_input.fill("")
    page.wait_for_timeout(250)

    # Japan tab must apply to both saved schedules and the active rest roster.
    page.get_by_role("button", name="🇯🇵 日本", exact=True).click()
    page.wait_for_timeout(250)
    country_filter_checks = {
        "workingJapanVisible": page.get_by_text("出勤 太郎", exact=False).first.is_visible(),
        "restingJapanVisible": page.get_by_text("休息 花子", exact=False).first.is_visible(),
        "chinaLeaveHidden": page.get_by_text("请假 小王", exact=False).count() == 0,
        "unsetHidden": page.get_by_text("未設定 アキラ", exact=False).count() == 0,
    }

    page.get_by_role("button", name="全部", exact=True).click()
    page.wait_for_timeout(250)

    # Existing add flow remains available; do not submit any mutation.
    page.get_by_role("button", name="追加", exact=True).click()
    page.get_by_text("スケジュール追加", exact=True).wait_for(state="visible", timeout=5_000)
    add_dialog_checks = {
        "dialogVisible": page.get_by_text("スケジュール追加", exact=True).is_visible(),
        "morningOptionVisible": page.get_by_role("button", name="☀️ 早班", exact=True).is_visible(),
        "eveningOptionVisible": page.get_by_role("button", name="🌙 晚班", exact=True).is_visible(),
        "leaveOptionVisible": page.get_by_role("button", name="🏖️ 请假", exact=True).is_visible(),
    }
    page.get_by_role("button", name="キャンセル", exact=True).click()

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "finalUrl": page.url,
        "fixture": {"activeStaff": len(STAFF), "savedSchedules": len(SCHEDULES), "syntheticRestRowsExpected": 2},
        "initialChecks": initial_checks,
        "restFilterChecks": rest_filter_checks,
        "leaveFilterChecks": leave_filter_checks,
        "searchChecks": search_checks,
        "countryFilterChecks": country_filter_checks,
        "addDialogChecks": add_dialog_checks,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "mutationRequests": mutation_requests,
        "screenshot": str(initial_screenshot),
        "productionWrites": 0,
    }
    report["passed"] = all(initial_checks.values()) and all(rest_filter_checks.values()) and all(leave_filter_checks.values()) and all(search_checks.values()) and all(country_filter_checks.values()) and all(add_dialog_checks.values()) and not console_errors and not page_errors and not failed_requests and not mutation_requests and response is not None and response.ok
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
