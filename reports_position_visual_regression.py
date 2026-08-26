#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4176").rstrip("/")
OUTPUT_DIR = ROOT / "reports_position_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "reports_position_visual_regression.json"

ADMIN_USER = {
    "id": 1,
    "openId": "reports-position-admin",
    "name": "Reports Position Admin",
    "email": "reports-position@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

REPORT_ENTRY = {
    "report": {
        "id": 8101,
        "reportStaffId": 101,
        "reportDate": "2026-08-26T00:00:00.000Z",
        "workContent": "1.确认每天新增订单数量，确认有无库存，是否需要下单采购\n2.V3产品下单采购入库\n3.展会地毯采购",
        "issues": None,
        "remarks": None,
        "createdBy": 1,
        "createdAt": "2026-08-26T10:10:00.000Z",
        "updatedAt": "2026-08-26T10:12:00.000Z",
    },
    "staff": {
        "id": 101,
        "name": "柴芳妮",
        "country": "中国",
        "linkedStaffId": None,
        "isActive": "active",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z",
    },
    "staffCnName": "柴芳妮",
    "staffPosition": None,
    "staffDepartment": None,
}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def mock_value(path):
    procedure = path.split("/api/trpc/", 1)[-1].split("?", 1)[0]
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "report.list":
        return [REPORT_ENTRY]
    if procedure == "report.staffStatistics":
        return []
    if procedure == "reportStaff.list":
        return [{**REPORT_ENTRY["staff"], "monthlyCount": 1, "totalCount": 1}]
    if procedure == "reportStaff.myId":
        return {"reportStaffId": 101}
    if procedure in {"report.overdueFollowups", "report.completedFollowups"}:
        return []
    if procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}:
        return {"isAdmin": True, "roleName": "admin", "permissions": None}
    if procedure.endswith(".stats"):
        return {}
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1050})
    console_errors = []
    page_errors = []
    failed_requests = []
    mocked_procedures = []

    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def handle_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        procedure = parsed.path.split("/api/trpc/", 1)[-1]
        mocked_procedures.append(procedure)
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(trpc_result(mock_value(parsed.path)), ensure_ascii=False),
        )

    page.route("**/api/trpc/**", handle_route)
    response = page.goto(f"{BASE_URL}/master/reports", wait_until="domcontentloaded", timeout=45_000)
    report_card = page.locator("div.border.rounded-lg.p-4.bg-card").filter(
        has=page.get_by_text("1.确认每天新增订单数量，确认有无库存，是否需要下单采购", exact=False)
    ).first
    name = report_card.locator("p.font-medium > span").first
    try:
        report_card.wait_for(state="visible", timeout=20_000)
        name.wait_for(state="visible", timeout=5_000)
    except Exception as error:
        debug_screenshot = OUTPUT_DIR / "reports_position_debug.png"
        page.screenshot(path=str(debug_screenshot), full_page=True)
        debug = {
            "error": str(error),
            "url": page.url,
            "bodyText": page.locator("body").inner_text()[:8000],
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
    position = report_card.get_by_text("库存", exact=True).first
    position.wait_for(state="visible", timeout=10_000)

    name_box = name.bounding_box()
    position_box = position.bounding_box()
    position_next_to_name = bool(
        name_box and position_box
        and position_box["x"] > name_box["x"]
        and abs(position_box["y"] - name_box["y"]) < 16
    )
    country_visible = report_card.get_by_text("中国", exact=True).is_visible()
    work_content_visible = report_card.get_by_text("1.确认每天新增订单数量，确认有无库存，是否需要下单采购", exact=False).is_visible()
    ai_advice_visible = report_card.get_by_text("AIアドバイスを取得", exact=True).is_visible() or report_card.get_by_text("获取AI建议", exact=True).is_visible()
    icon_action_count = report_card.locator("button.h-8.w-8").count()
    edit_button_visible = icon_action_count >= 1
    delete_button_visible = icon_action_count >= 2

    screenshot = OUTPUT_DIR / "reports_position_inventory.png"
    page.screenshot(path=str(screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "finalUrl": page.url,
        "staffNameVisible": name.is_visible() and "柴芳妮" in name.inner_text(),
        "inventoryPositionVisible": position.is_visible(),
        "positionNextToName": position_next_to_name,
        "countryVisible": country_visible,
        "workContentVisible": work_content_visible,
        "aiAdviceButtonVisible": ai_advice_visible,
        "editButtonVisible": edit_button_visible,
        "deleteButtonVisible": delete_button_visible,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "screenshot": str(screenshot),
        "productionWrites": 0,
    }
    report["passed"] = all([
        response is not None and response.ok,
        report["staffNameVisible"],
        report["inventoryPositionVisible"],
        report["positionNextToName"],
        country_visible,
        work_content_visible,
        ai_advice_visible,
        edit_button_visible,
        delete_button_visible,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
