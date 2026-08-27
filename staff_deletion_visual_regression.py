from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4182").rstrip("/")
OUTPUT_DIR = ROOT / "staff_deletion_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "staff_deletion_visual_regression.json"

ADMIN_USER = {
    "id": 9001,
    "openId": "staff-delete-admin",
    "name": "删除持久化管理员",
    "email": "staff-delete@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

REPORT_STAFF = [
    {
        "id": 201,
        "name": "保留员工",
        "country": "中国",
        "linkedStaffId": 301,
        "isActive": "active",
        "createdAt": "2026-08-20T00:00:00.000Z",
        "updatedAt": "2026-08-20T00:00:00.000Z",
        "nameCn": "保留员工",
        "nameEn": None,
    },
    {
        "id": 202,
        "name": "删除对象",
        "country": "日本",
        "linkedStaffId": 302,
        "isActive": "inactive",
        "createdAt": "2026-08-20T00:00:00.000Z",
        "updatedAt": "2026-08-20T00:00:00.000Z",
        "nameCn": "删除对象",
        "nameEn": None,
    },
]

STAFF = [
    {"id": 301, "name": "保留员工", "department": "营业部", "isActive": "active", "archivedAt": None},
    {"id": 302, "name": "删除对象", "department": "历史部门", "isActive": "inactive", "archivedAt": None},
]


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def extract_input(request):
    if request.method == "GET":
        return None
    try:
        payload = request.post_data_json
    except Exception:
        return None
    if isinstance(payload, dict):
        if "json" in payload:
            return payload.get("json")
        first = payload.get("0")
        if isinstance(first, dict):
            return first.get("json")
    return None


archived_ids: set[int] = set()
mutation_inputs: list[dict] = []
mocked_procedures: list[str] = []


def mock_value(procedure):
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "rbac.myPermissions":
        return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure == "reportStaff.list":
        return [row for row in REPORT_STAFF if row["id"] not in archived_ids]
    if procedure == "staff.listActive":
        return STAFF
    if procedure == "staff.getTaskCounts":
        return {"inProgressCount": 0, "completedCount": 0, "overdueCount": 0, "totalCount": 0}
    if procedure in {"problemLog.unresolvedCount", "notifications.unreadCount"}:
        return 0
    return None


def route_handler(route):
    parsed = urlparse(route.request.url)
    if "/api/trpc/" not in parsed.path:
        route.continue_()
        return
    joined = parsed.path.split("/api/trpc/", 1)[-1]
    procedures = joined.split(",")
    mocked_procedures.extend(procedures)
    if route.request.method != "GET":
        value = extract_input(route.request)
        for procedure in procedures:
            if procedure == "reportStaff.delete":
                if not isinstance(value, dict) or int(value.get("id", 0)) != 202:
                    route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"json": {"message": "unexpected delete input"}}}))
                    return
                mutation_inputs.append(value)
                archived_ids.add(202)
        payloads = [trpc_result({"success": True, "mode": "archive", "reportStaffId": 202, "archived": True}) for _ in procedures]
    else:
        payloads = [trpc_result(mock_value(procedure)) for procedure in procedures]
    route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False),
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    context = browser.new_context(viewport={"width": 1500, "height": 1150})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'zh')")
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)

    response = page.goto(f"{BASE_URL}/master/report-staff", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("レポートスタッフ管理", exact=True).wait_for(state="visible", timeout=20_000)
    keep_row = page.get_by_role("row").filter(has_text="保留员工")
    target_row = page.get_by_role("row").filter(has_text="删除对象")
    keep_row.wait_for(state="visible", timeout=10_000)
    target_row.wait_for(state="visible", timeout=10_000)
    initial_count = page.locator("tbody tr").count()

    page.once("dialog", lambda dialog: dialog.accept())
    target_row.locator("button").last.click()
    target_row.wait_for(state="detached", timeout=10_000)
    after_delete_count = page.locator("tbody tr").count()
    keep_visible_after_delete = page.get_by_role("row").filter(has_text="保留员工").is_visible()

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("レポートスタッフ管理", exact=True).wait_for(state="visible", timeout=20_000)
    hidden_after_refresh = page.get_by_role("row").filter(has_text="删除对象").count() == 0
    keep_visible_after_refresh = page.get_by_role("row").filter(has_text="保留员工").is_visible()

    context.close()

    relogin_context = browser.new_context(viewport={"width": 1500, "height": 1150})
    relogin_page = relogin_context.new_page()
    relogin_page.add_init_script("localStorage.setItem('language', 'zh')")
    relogin_page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    relogin_page.on("pageerror", lambda error: page_errors.append(str(error)))
    relogin_page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    relogin_page.route("**/api/trpc/**", route_handler)
    relogin_page.goto(f"{BASE_URL}/master/report-staff", wait_until="domcontentloaded", timeout=45_000)
    relogin_page.get_by_text("レポートスタッフ管理", exact=True).wait_for(state="visible", timeout=20_000)
    hidden_after_relogin = relogin_page.get_by_role("row").filter(has_text="删除对象").count() == 0
    keep_visible_after_relogin = relogin_page.get_by_role("row").filter(has_text="保留员工").is_visible()
    screenshot = OUTPUT_DIR / "report_staff_persisted_after_relogin.png"
    relogin_page.screenshot(path=str(screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "initialRowCount": initial_count,
        "afterDeleteRowCount": after_delete_count,
        "archiveMutationInputs": mutation_inputs,
        "archiveMutationCount": len(mutation_inputs),
        "archivedIds": sorted(archived_ids),
        "keepVisibleAfterDelete": keep_visible_after_delete,
        "hiddenAfterRefresh": hidden_after_refresh,
        "keepVisibleAfterRefresh": keep_visible_after_refresh,
        "hiddenAfterRelogin": hidden_after_relogin,
        "keepVisibleAfterRelogin": keep_visible_after_relogin,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshot": str(screenshot),
    }
    report["passed"] = all([
        response is not None and response.ok,
        initial_count == 2,
        after_delete_count == 1,
        len(mutation_inputs) == 1,
        mutation_inputs[0].get("id") == 202,
        keep_visible_after_delete,
        hidden_after_refresh,
        keep_visible_after_refresh,
        hidden_after_relogin,
        keep_visible_after_relogin,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    relogin_context.close()
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
