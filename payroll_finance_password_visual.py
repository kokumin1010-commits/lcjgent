#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4192").rstrip("/")
OUT_DIR = ROOT / "payroll_finance_password_visual_artifacts"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = ROOT / "payroll_finance_password_visual.json"
SHARED_PASSWORD = "visual-test-shared-finance-password"

ADMIN = {
    "id": 42001,
    "openId": "shared-finance-payroll-admin",
    "name": "财务管理员",
    "email": "finance-payroll@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

state = {
    "financeUnlocked": False,
    "payrollUnlocked": False,
    "financeUnlockCount": 0,
    "payrollUnlockCount": 0,
    "payrollWrongAttempts": 0,
    "financeLockCount": 0,
    "financeQueriesBeforeUnlock": [],
    "payrollQueriesBeforeUnlock": [],
    "businessMutations": [],
}


def result(value):
    return {"result": {"data": {"json": value}}}


def error(path, message, code="UNAUTHORIZED", status=401):
    return {"error": {"json": {"message": message, "code": -32001, "data": {"code": code, "httpStatus": status, "path": path}}}}


def inputs(request, count):
    try:
        payload = request.post_data_json
    except Exception:
        payload = None
    if not isinstance(payload, dict):
        return [None] * count
    if "json" in payload:
        return [payload.get("json")]
    return [(payload.get(str(index)) or {}).get("json") for index in range(count)]


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
        return {"unlocked": state["financeUnlocked"], "expiresAt": None}
    if procedure == "cashflow.getPayrollAccessStatus":
        return {"unlocked": state["payrollUnlocked"]}
    if procedure == "cashflow.recoverySnapshots":
        return {"snapshots": [], "cashflowBoundary": {"actualCashflowRowsEligible": 0}}
    if procedure == "cashflow.getAll":
        return {"items": [], "total": 0, "page": 1, "pageSize": 50}
    if procedure == "cashflow.getTotalSummary":
        return {"totalIncome": 0, "totalExpense": 0, "balance": 0}
    if procedure == "cashflow.getPayrollReconciliation":
        return {"months": [], "employees": [], "totals": {"importedCount": 0}, "rows": []}
    if procedure.startswith("cashflow."):
        return []
    if procedure.startswith(("invoice.", "tiktokFinance.", "tsp.", "brandContract.")):
        return []
    return None


def route_handler(route):
    parsed = urlparse(route.request.url)
    if "/api/trpc/" not in parsed.path:
        route.continue_()
        return
    procedures = parsed.path.split("/api/trpc/", 1)[-1].split(",")
    payloads = []
    values = inputs(route.request, len(procedures))
    if route.request.method == "GET":
        for procedure in procedures:
            if procedure.startswith(("cashflow.", "invoice.", "tiktokFinance.", "tsp.", "brandContract.")) and not state["financeUnlocked"]:
                state["financeQueriesBeforeUnlock"].append(procedure)
                payloads.append(error(procedure, "财务管理密码验证后才能访问", "FORBIDDEN", 403))
            elif procedure == "cashflow.getPayrollReconciliation" and not state["payrollUnlocked"]:
                state["payrollQueriesBeforeUnlock"].append(procedure)
                payloads.append(error(procedure, "请使用财务管理密码解锁工资明细", "FORBIDDEN", 403))
            else:
                payloads.append(result(query_value(procedure)))
    else:
        for procedure, value in zip(procedures, values):
            password = (value or {}).get("password") if isinstance(value, dict) else None
            if procedure == "financeAccess.unlock":
                if password != SHARED_PASSWORD:
                    payloads.append(error(procedure, "财务管理密码不正确"))
                else:
                    state["financeUnlocked"] = True
                    state["payrollUnlocked"] = False
                    state["financeUnlockCount"] += 1
                    payloads.append(result({"unlocked": True, "expiresInSeconds": 28800, "expiresAt": None}))
            elif procedure == "cashflow.unlockPayrollAccess":
                if not state["financeUnlocked"]:
                    payloads.append(error(procedure, "财务管理密码验证后才能访问", "FORBIDDEN", 403))
                elif password != SHARED_PASSWORD:
                    state["payrollWrongAttempts"] += 1
                    payloads.append(error(procedure, "财务管理密码不正确"))
                else:
                    state["payrollUnlocked"] = True
                    state["payrollUnlockCount"] += 1
                    payloads.append(result({"unlocked": True, "expiresInSeconds": 28800}))
            elif procedure == "financeAccess.lock":
                state["financeUnlocked"] = False
                state["payrollUnlocked"] = False
                state["financeLockCount"] += 1
                payloads.append(result({"unlocked": False}))
            elif procedure == "cashflow.lockPayrollAccess":
                state["payrollUnlocked"] = False
                payloads.append(result({"unlocked": False}))
            else:
                state["businessMutations"].append(procedure)
                payloads.append(error(procedure, "unexpected business mutation", "BAD_REQUEST", 400))
    route.fulfill(status=200, content_type="application/json", body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language','zh')")
    console_errors = []
    expected_errors = []
    page_errors = []
    failed_requests = []

    def capture_console(message):
        if message.type != "error":
            return
        if "财务管理密码不正确" in message.text:
            expected_errors.append(message.text)
        else:
            console_errors.append(message.text)

    page.on("console", capture_console)
    page.on("pageerror", lambda err: page_errors.append(str(err)))
    page.on("requestfailed", lambda req: failed_requests.append(f"{req.method} {req.url} :: {req.failure}"))
    page.route("**/api/trpc/**", route_handler)

    response = page.goto(f"{BASE_URL}/master/finance?tab=cashflow", wait_until="domcontentloaded", timeout=60_000)
    page.get_by_text("财务管理密码验证", exact=True).wait_for(state="visible", timeout=20_000)
    no_queries_before_finance_unlock = not state["financeQueriesBeforeUnlock"]

    page.get_by_label("财务管理密码", exact=True).fill(SHARED_PASSWORD)
    page.get_by_role("button", name="验证并进入", exact=True).click()
    page.get_by_role("heading", name="ファイナンス管理", exact=True).wait_for(state="visible", timeout=30_000)
    try:
        page.get_by_role("button", name="給与明細", exact=True).wait_for(state="visible", timeout=20_000)
    except Exception:
        page.screenshot(path=str(OUT_DIR / "payroll_button_debug.png"), full_page=True)
        print("DEBUG_URL", page.url)
        print("DEBUG_BODY", page.locator("body").inner_text()[:16000])
        print("DEBUG_CONSOLE", console_errors)
        print("DEBUG_PAGE_ERRORS", page_errors)
        raise

    page.get_by_role("button", name="給与明細", exact=True).click()
    page.get_by_text("工资明细二次确认", exact=True).wait_for(state="visible", timeout=15_000)
    dialog_shot = OUT_DIR / "shared_finance_password_payroll_dialog.png"
    page.screenshot(path=str(dialog_shot), full_page=True)

    payroll_input = page.get_by_label("财务管理密码", exact=True)
    payroll_input.fill("wrong-password")
    page.get_by_role("button", name="解锁并进入", exact=True).click()
    page.get_by_text("财务管理密码不正确", exact=True).wait_for(state="visible", timeout=10_000)

    payroll_input.fill(SHARED_PASSWORD)
    page.get_by_role("button", name="解锁并进入", exact=True).click()
    page.get_by_text("工资明细二次确认", exact=True).wait_for(state="hidden", timeout=20_000)
    page.get_by_role("button", name="給与明細", exact=True).wait_for(state="visible", timeout=20_000)
    unlocked_shot = OUT_DIR / "shared_finance_password_payroll_unlocked.png"
    page.screenshot(path=str(unlocked_shot), full_page=True)

    page.get_by_role("button", name="重新锁定", exact=True).click()
    page.get_by_text("财务管理密码验证", exact=True).wait_for(state="visible", timeout=20_000)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "httpStatus": response.status if response else None,
        "sharedPasswordUsedForFinanceAndPayroll": state["financeUnlockCount"] == 1 and state["payrollUnlockCount"] == 1,
        "wrongPayrollPasswordRejected": state["payrollWrongAttempts"] == 1,
        "noFinanceQueriesBeforeUnlock": no_queries_before_finance_unlock,
        "noPayrollQueriesBeforeUnlock": not state["payrollQueriesBeforeUnlock"],
        "financeLockCount": state["financeLockCount"],
        "businessMutationCount": len(state["businessMutations"]),
        "consoleErrors": console_errors,
        "expectedErrorCount": len(expected_errors),
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "artifacts": [str(dialog_shot), str(unlocked_shot)],
    }
    report["passed"] = all([
        report["httpStatus"] == 200,
        report["sharedPasswordUsedForFinanceAndPayroll"],
        report["wrongPayrollPasswordRejected"],
        report["noFinanceQueriesBeforeUnlock"],
        report["noPayrollQueriesBeforeUnlock"],
        report["financeLockCount"] == 1,
        report["businessMutationCount"] == 0,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
