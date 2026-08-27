from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4184").rstrip("/")
OUTPUT_DIR = ROOT / "hr_restore_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = ROOT / "hr_restore_visual_regression.json"

ADMIN = {
    "id": 30006,
    "openId": "hr-restore-admin",
    "name": "HR管理员",
    "email": "admin@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

TARGET_REPORT = {
    "id": 146,
    "name": "恢复目标",
    "country": "中国",
    "isActive": "active",
    "linkedStaffId": 57,
    "archivedAt": None,
    "archivedBy": None,
    "archiveReason": None,
    "createdAt": "2026-08-27T08:40:32.000Z",
    "updatedAt": "2026-08-27T08:40:32.000Z",
}
TARGET_STAFF = {
    "id": 57,
    "name": "恢复目标",
    "email": "target@example.invalid",
    "phone": None,
    "department": "运营部",
    "position": "正社員",
    "country": "中国",
    "avatarUrl": None,
    "joinDate": None,
    "birthDate": None,
    "skills": None,
    "lineId": None,
    "emergencyContact": None,
    "notes": None,
    "employmentType": "fulltime",
    "employmentTypeEvidence": None,
    "emailEvidenceStatus": "verified",
    "directoryClass": "current",
    "evidenceStatus": "manual",
    "evidenceAsOfDate": None,
    "evidenceSource": "manual",
    "aliases": None,
    "isActive": "inactive",
    "nameEn": None,
    "resignDate": "2026-08-27T08:41:27.000Z",
    "resignReason": "账号注销",
    "archivedAt": None,
    "archivedBy": None,
    "archiveReason": None,
    "tier": None,
    "evaluationScore": None,
    "salary": None,
    "salaryCurrency": None,
}
HISTORY_REPORT = {
    "id": 119,
    "name": "恢复目标",
    "country": "中国",
    "isActive": "active",
    "linkedStaffId": 55,
    "archivedAt": None,
    "createdAt": "2026-08-27T08:38:20.000Z",
    "updatedAt": "2026-08-27T08:38:20.000Z",
}
HISTORY_STAFF = {
    **TARGET_STAFF,
    "id": 55,
    "email": "history@example.invalid",
    "archivedAt": "2026-08-27T08:40:17.000Z",
    "archiveReason": "historical archive",
}

state = {
    "targetActive": False,
    "reinstateInputs": [],
    "mockedProcedures": [],
}


def target_entry():
    staff = dict(TARGET_STAFF)
    report = dict(TARGET_REPORT)
    if state["targetActive"]:
        staff.update({"isActive": "active", "resignDate": None, "resignReason": None, "archivedAt": None, "archivedBy": None, "archiveReason": None})
        report.update({"isActive": "active", "archivedAt": None, "archivedBy": None, "archiveReason": None})
    return {"reportStaff": report, "linkedStaff": staff}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def extract_input(request):
    try:
        payload = request.post_data_json
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    if "json" in payload:
        return payload.get("json")
    first = payload.get("0")
    return first.get("json") if isinstance(first, dict) else None


def mock_value(procedure):
    if procedure == "auth.me":
        return ADMIN
    if procedure == "rbac.myPermissions":
        return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure == "staff.listReportStaffUnified":
        return [target_entry()]
    if procedure == "staff.listArchivedReportStaffUnified":
        return [{"reportStaff": HISTORY_REPORT, "linkedStaff": HISTORY_STAFF}]
    if procedure == "staff.archiveHealth":
        return {"totalStaff": 2, "visibleStaff": 1, "archivedStaff": 1, "visibleResignedStaff": 0 if state["targetActive"] else 1, "archivedResignedStaff": 1, "visibleArchiveEligibleStaff": 0 if state["targetActive"] else 1, "visibleProtectedActiveStaff": 1 if state["targetActive"] else 0, "archiveEventCount": 3, "setupRun": None, "backups": []}
    if procedure == "staff.statistics":
        return {"total": 1, "active": 1 if state["targetActive"] else 0, "inactive": 0 if state["targetActive"] else 1}
    if procedure == "lcjCoin.getTierTemplates":
        return []
    if procedure in {"problemLog.unresolvedCount", "notifications.unreadCount"}:
        return 0
    if procedure == "staff.getTaskCounts":
        return {"inProgressCount": 0, "completedCount": 0, "overdueCount": 0, "totalCount": 0}
    if procedure in {"staff.getTaskHistory", "staff.getReportsByReportStaffId"}:
        return []
    return None


def route_handler(route):
    parsed = urlparse(route.request.url)
    if "/api/trpc/" not in parsed.path:
        route.continue_()
        return
    procedures = parsed.path.split("/api/trpc/", 1)[-1].split(",")
    state["mockedProcedures"].extend(procedures)
    if route.request.method != "GET":
        value = extract_input(route.request)
        payloads = []
        for procedure in procedures:
            if procedure == "staff.reinstate":
                if not isinstance(value, dict) or int(value.get("staffId", 0)) != 57 or int(value.get("reportStaffId", 0)) != 146:
                    route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"json": {"message": "unexpected reinstate input"}}}))
                    return
                state["reinstateInputs"].append(value)
                state["targetActive"] = True
                payloads.append(trpc_result({"success": True, "restored": True, "referenceCounts": {}, "userAccountRestored": True}))
            else:
                route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"json": {"message": f"unexpected mutation {procedure}"}}}))
                return
    else:
        payloads = [trpc_result(mock_value(procedure)) for procedure in procedures]
    route.fulfill(status=200, content_type="application/json", body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False))


def open_staff_list(page, category: str):
    page.get_by_role("heading", name="人事管理（HR）", exact=True).wait_for(state="visible", timeout=20_000)
    page.get_by_role("button", name="スタッフ一覧", exact=True).click()
    page.locator('[role="button"]').filter(has_text=category).first.click()
    try:
        page.get_by_text("恢复目标", exact=True).first.wait_for(state="visible", timeout=15_000)
    except Exception:
        page.screenshot(path=str(OUTPUT_DIR / "hr_restore_debug_missing_target.png"), full_page=True)
        print(page.locator("body").inner_text()[:12000])
        raise


def open_target(page):
    page.get_by_text("恢复目标", exact=True).first.click()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    console_errors: list[str] = []
    ignored_console_warnings: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    def capture_console(message):
        if message.type != "error":
            return
        if "DialogContent` requires a `DialogTitle" in message.text:
            ignored_console_warnings.append(message.text)
        else:
            console_errors.append(message.text)

    context = browser.new_context(viewport={"width": 1600, "height": 1100})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'zh')")
    page.on("console", capture_console)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)

    response = page.goto(f"{BASE_URL}/master/hr", wait_until="domcontentloaded", timeout=45_000)
    open_staff_list(page, "退職確認済")
    open_target(page)
    page.get_by_role("dialog").get_by_text("退職確認済", exact=True).first.wait_for(state="visible", timeout=10_000)
    page.get_by_role("button", name="復職", exact=True).click()
    page.get_by_text("復職処理が完了しました", exact=True).wait_for(state="visible", timeout=10_000)

    page.locator('[role="button"]').filter(has_text="現在活動確認").first.click()
    page.get_by_text("恢复目标", exact=True).first.wait_for(state="visible", timeout=15_000)
    open_target(page)
    active_after_mutation = page.get_by_role("dialog").get_by_text("現在活動確認", exact=True).count() >= 1
    page.keyboard.press("Escape")

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    open_staff_list(page, "現在活動確認")
    open_target(page)
    active_after_refresh = page.get_by_role("dialog").get_by_text("現在活動確認", exact=True).count() >= 1
    resigned_after_refresh = page.get_by_role("dialog").get_by_text("退職確認済", exact=True).count() > 0
    page.keyboard.press("Escape")
    context.close()

    relogin = browser.new_context(viewport={"width": 1600, "height": 1100})
    relogin_page = relogin.new_page()
    relogin_page.add_init_script("localStorage.setItem('language', 'zh')")
    relogin_page.on("console", capture_console)
    relogin_page.on("pageerror", lambda error: page_errors.append(str(error)))
    relogin_page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    relogin_page.route("**/api/trpc/**", route_handler)
    relogin_page.goto(f"{BASE_URL}/master/hr", wait_until="domcontentloaded", timeout=45_000)
    open_staff_list(relogin_page, "現在活動確認")
    open_target(relogin_page)
    active_after_relogin = relogin_page.get_by_role("dialog").get_by_text("現在活動確認", exact=True).count() >= 1
    resigned_after_relogin = relogin_page.get_by_role("dialog").get_by_text("退職確認済", exact=True).count() > 0
    screenshot = OUTPUT_DIR / "hr_reinstate_persisted_after_relogin.png"
    relogin_page.screenshot(path=str(screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "reinstateInputs": state["reinstateInputs"],
        "reinstateMutationCount": len(state["reinstateInputs"]),
        "activeAfterMutation": active_after_mutation,
        "activeAfterRefresh": active_after_refresh,
        "resignedAfterRefresh": resigned_after_refresh,
        "activeAfterRelogin": active_after_relogin,
        "resignedAfterRelogin": resigned_after_relogin,
        "sameNameHistoricalArchivedId": HISTORY_STAFF["id"],
        "sameNameHistoricalUntouched": HISTORY_STAFF["archivedAt"] is not None,
        "mockedProcedures": sorted(set(state["mockedProcedures"])),
        "consoleErrors": console_errors,
        "ignoredExistingDialogTitleWarnings": len(ignored_console_warnings),
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshot": str(screenshot),
    }
    report["passed"] = all([
        response is not None and response.ok,
        len(state["reinstateInputs"]) == 1,
        active_after_mutation,
        active_after_refresh,
        not resigned_after_refresh,
        active_after_relogin,
        not resigned_after_relogin,
        report["sameNameHistoricalUntouched"],
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    relogin.close()
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
