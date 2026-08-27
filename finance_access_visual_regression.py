#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4187").rstrip("/")
OUTPUT_DIR = ROOT / "finance_access_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = ROOT / "finance_access_visual_regression.json"
MOCK_PASSWORD = "visual-test-finance-password"

ADMIN = {
    "id": 41001,
    "openId": "finance-gate-admin",
    "name": "财务管理员",
    "email": "finance-admin@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

state = {
    "unlocked": False,
    "wrongAttempts": 0,
    "unlockCount": 0,
    "lockCount": 0,
    "financeQueriesBeforeUnlock": [],
    "businessMutations": [],
    "procedures": [],
}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def trpc_error(path, message, code="UNAUTHORIZED", status=401):
    return {
        "error": {
            "json": {
                "message": message,
                "code": -32001,
                "data": {"code": code, "httpStatus": status, "path": path},
            }
        }
    }


def extract_inputs(request, count):
    try:
        payload = request.post_data_json
    except Exception:
        payload = None
    if not isinstance(payload, dict):
        return [None] * count
    if "json" in payload:
        return [payload.get("json")]
    values = []
    for index in range(count):
        item = payload.get(str(index))
        values.append(item.get("json") if isinstance(item, dict) else None)
    return values


def query_value(procedure):
    if procedure == "auth.me":
        return ADMIN
    if procedure == "rbac.myPermissions":
        return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure in {"problemLog.unresolvedCount", "notifications.unreadCount"}:
        return 0
    if procedure == "staff.getTaskCounts":
        return {"inProgressCount": 0, "completedCount": 0, "overdueCount": 0, "totalCount": 0}
    if procedure == "financeAccess.status":
        return {"unlocked": state["unlocked"]}
    if procedure == "invoice.list":
        return {"invoices": [], "total": 0}
    if procedure == "invoice.summary":
        return {"totalCount": 0, "pendingCount": 0, "pendingAmount": 0, "overdueCount": 0, "overdueAmount": 0, "paidCount": 0, "paidAmount": 0}
    if procedure in {"invoice.monthlyStats", "invoice.managers"}:
        return []
    if procedure == "tiktokFinance.getSummary":
        return {"totalSales": 0, "totalOrders": 0, "totalCreatorCommission": 0, "totalPlatformFee": 0, "creatorCount": 0, "shopCount": 0, "productCount": 0}
    if procedure == "tiktokFinance.getPaymentSummary":
        return {"totalPayment": 0, "paymentCount": 0}
    if procedure.startswith("tiktokFinance.") or procedure.startswith("cashflow."):
        return []
    return None


def is_finance_data(procedure):
    return procedure.startswith(("invoice.", "cashflow.", "tiktokFinance.", "tsp.", "brandContract."))


def route_handler(route):
    parsed = urlparse(route.request.url)
    if "/api/trpc/" not in parsed.path:
        route.continue_()
        return
    procedures = parsed.path.split("/api/trpc/", 1)[-1].split(",")
    state["procedures"].extend(procedures)
    inputs = extract_inputs(route.request, len(procedures))
    payloads = []

    if route.request.method == "GET":
        for procedure in procedures:
            if is_finance_data(procedure) and not state["unlocked"]:
                state["financeQueriesBeforeUnlock"].append(procedure)
                payloads.append(trpc_error(procedure, "财务管理密码验证后才能访问", "FORBIDDEN", 403))
            else:
                payloads.append(trpc_result(query_value(procedure)))
    else:
        for procedure, input_value in zip(procedures, inputs):
            if procedure == "financeAccess.unlock":
                password = (input_value or {}).get("password") if isinstance(input_value, dict) else None
                if password != MOCK_PASSWORD:
                    state["wrongAttempts"] += 1
                    payloads.append(trpc_error(procedure, "财务管理密码不正确"))
                else:
                    state["unlocked"] = True
                    state["unlockCount"] += 1
                    payloads.append(trpc_result({"unlocked": True, "expiresInSeconds": 28800}))
            elif procedure == "financeAccess.lock":
                state["unlocked"] = False
                state["lockCount"] += 1
                payloads.append(trpc_result({"unlocked": False}))
            else:
                state["businessMutations"].append(procedure)
                payloads.append(trpc_error(procedure, "unexpected business mutation", "BAD_REQUEST", 400))

    status = 200
    route.fulfill(status=status, content_type="application/json", body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'zh')")
    console_errors = []
    expected_console_errors = []
    page_errors = []
    failed_requests = []

    def capture_console(message):
        if message.type != "error":
            return
        if "财务管理密码不正确" in message.text:
            expected_console_errors.append(message.text)
        else:
            console_errors.append(message.text)

    page.on("console", capture_console)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)

    response = page.goto(f"{BASE_URL}/master/finance?tab=invoices", wait_until="domcontentloaded", timeout=45_000)
    try:
        page.get_by_text("财务管理密码验证", exact=True).wait_for(state="visible", timeout=20_000)
    except Exception:
        page.screenshot(path=str(OUTPUT_DIR / "finance_gate_debug.png"), full_page=True)
        print("DEBUG_URL", page.url)
        print("DEBUG_BODY", page.locator("body").inner_text()[:12000])
        print("DEBUG_CONSOLE", console_errors)
        print("DEBUG_PAGE_ERRORS", page_errors)
        raise
    gate_screenshot = OUTPUT_DIR / "finance_password_gate.png"
    page.screenshot(path=str(gate_screenshot), full_page=True)
    zero_queries_before_unlock = len(state["financeQueriesBeforeUnlock"]) == 0

    password_input = page.get_by_label("财务管理密码", exact=True)
    password_input.fill("wrong-password")
    page.get_by_role("button", name="验证并进入", exact=True).click()
    page.get_by_text("财务管理密码不正确", exact=True).wait_for(state="visible", timeout=10_000)

    password_input.fill(MOCK_PASSWORD)
    page.get_by_role("button", name="验证并进入", exact=True).click()
    page.get_by_role("heading", name="ファイナンス管理", exact=True).wait_for(state="visible", timeout=20_000)
    page.get_by_text("請求書管理", exact=True).first.wait_for(state="visible", timeout=10_000)
    page.get_by_role("button", name="重新锁定", exact=True).wait_for(state="visible", timeout=10_000)
    unlocked_screenshot = OUTPUT_DIR / "finance_invoices_unlocked.png"
    page.screenshot(path=str(unlocked_screenshot), full_page=True)

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.get_by_role("heading", name="ファイナンス管理", exact=True).wait_for(state="visible", timeout=20_000)
    refresh_stays_unlocked = page.get_by_role("heading", name="ファイナンス管理", exact=True).is_visible()
    page.get_by_role("button", name="重新锁定", exact=True).click()
    page.get_by_text("财务管理密码验证", exact=True).wait_for(state="visible", timeout=15_000)
    relocked_screenshot = OUTPUT_DIR / "finance_relocked.png"
    page.screenshot(path=str(relocked_screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "httpStatus": response.status if response else None,
        "wrongAttemptRejected": state["wrongAttempts"] == 1,
        "unlockCount": state["unlockCount"],
        "lockCount": state["lockCount"],
        "zeroFinanceQueriesBeforeUnlock": zero_queries_before_unlock,
        "refreshStaysUnlocked": refresh_stays_unlocked,
        "businessMutationCount": len(state["businessMutations"]),
        "businessMutations": state["businessMutations"],
        "consoleErrors": console_errors,
        "expectedConsoleErrorCount": len(expected_console_errors),
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "artifacts": [str(gate_screenshot), str(unlocked_screenshot), str(relocked_screenshot)],
    }
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    browser.close()

assert report["httpStatus"] == 200, report
assert report["wrongAttemptRejected"], report
assert report["unlockCount"] == 1, report
assert report["lockCount"] == 1, report
assert report["zeroFinanceQueriesBeforeUnlock"], report
assert report["refreshStaysUnlocked"], report
assert report["businessMutationCount"] == 0, report
assert not report["consoleErrors"], report
assert not report["pageErrors"], report
assert not report["failedRequests"], report
print(json.dumps(report, ensure_ascii=False, indent=2))
