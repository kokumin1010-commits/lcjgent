import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4193").rstrip("/")
OUTPUT_DIR = ROOT / "liver_ad_effect_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "liver_ad_effect_visual_regression.json"

LIVER = {
    "id": 77,
    "name": "广告效果测试主播",
    "email": "liver-ad-effect@example.invalid",
    "language": "zh",
    "isActive": True,
}
BRANDS = [{"id": 10, "name": "KG TEST", "hasTikTokBackend": True}]
records = [
    {"id": 101, "livestreamDate": "2026-08-24T01:00:00.000Z", "brandName": "KG TEST", "adStatus": "paid", "adCost": 1000, "adCostSource": "native", "adCostConflict": False, "linkedAdCost": None, "gmv": 10000, "orderCount": 10, "itemsSold": 12, "viewerCount": 200, "durationMinutes": 60, "viewerConversionRate": 5, "gmvPerHour": 10000, "roas": 10, "adCostPerOrder": 100, "adAdjustedSalesContribution": 9000},
    {"id": 102, "livestreamDate": "2026-08-23T01:00:00.000Z", "brandName": "KG TEST", "adStatus": "none", "adCost": 0, "adCostSource": "native", "adCostConflict": False, "linkedAdCost": None, "gmv": 5000, "orderCount": 5, "itemsSold": 6, "viewerCount": 200, "durationMinutes": 60, "viewerConversionRate": 2.5, "gmvPerHour": 5000, "roas": None, "adCostPerOrder": None, "adAdjustedSalesContribution": 5000},
    {"id": 103, "livestreamDate": "2026-08-22T01:00:00.000Z", "brandName": "KG TEST", "adStatus": "paid", "adCost": 2000, "adCostSource": "linked", "adCostConflict": False, "linkedAdCost": 2000, "gmv": 18000, "orderCount": 15, "itemsSold": 18, "viewerCount": 300, "durationMinutes": 120, "viewerConversionRate": 5, "gmvPerHour": 9000, "roas": 9, "adCostPerOrder": 133.33, "adAdjustedSalesContribution": 16000},
    {"id": 104, "livestreamDate": "2026-08-21T01:00:00.000Z", "brandName": "KG TEST", "adStatus": "none", "adCost": 0, "adCostSource": "native", "adCostConflict": False, "linkedAdCost": None, "gmv": 7000, "orderCount": 7, "itemsSold": 8, "viewerCount": 200, "durationMinutes": 60, "viewerConversionRate": 3.5, "gmvPerHour": 7000, "roas": None, "adCostPerOrder": None, "adAdjustedSalesContribution": 7000},
    {"id": 105, "livestreamDate": "2026-08-20T01:00:00.000Z", "brandName": "KG TEST", "adStatus": "unknown", "adCost": None, "adCostSource": "missing", "adCostConflict": False, "linkedAdCost": None, "gmv": 9000, "orderCount": 9, "itemsSold": 10, "viewerCount": 180, "durationMinutes": 60, "viewerConversionRate": 5, "gmvPerHour": 9000, "roas": None, "adCostPerOrder": None, "adAdjustedSalesContribution": None},
]
mutation_inputs = []
mocked_procedures = []


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def parse_input(request, index=0):
    try:
        if request.method == "GET":
            raw = parse_qs(urlparse(request.url).query).get("input", [None])[0]
            if not raw:
                return None
            payload = json.loads(unquote(raw))
        else:
            payload = request.post_data_json
    except Exception:
        return None
    if isinstance(payload, dict):
        candidate = payload.get(str(index), payload)
        if isinstance(candidate, dict) and "json" in candidate:
            return candidate.get("json")
    return payload


def avg(group, key):
    values = [row[key] for row in group if row.get(key) is not None]
    return {"value": round(sum(values) / len(values), 2) if values else None, "sampleCount": len(values)}


def group_data(status):
    group = [row for row in records if row["adStatus"] == status]
    return {
        "status": status,
        "streamCount": len(group),
        "sampleSufficient": len(group) >= 2,
        "totalAdCost": sum(row.get("adCost") or 0 for row in group),
        "averageGmv": avg(group, "gmv"),
        "averageOrders": avg(group, "orderCount"),
        "averageItemsSold": avg(group, "itemsSold"),
        "averageViewers": avg(group, "viewerCount"),
        "averageViewerConversionRate": avg(group, "viewerConversionRate"),
        "averageGmvPerHour": avg(group, "gmvPerHour"),
        "averageRoas": avg(group, "roas"),
        "averageAdCostPerOrder": avg(group, "adCostPerOrder"),
        "averageAdAdjustedSalesContribution": avg(group, "adAdjustedSalesContribution"),
    }


def difference(paid, none):
    if paid["value"] is None or none["value"] is None:
        return {"paid": paid["value"], "none": none["value"], "absolute": None, "percent": None}
    absolute = round(paid["value"] - none["value"], 2)
    percent = round(absolute / none["value"] * 100, 2) if none["value"] != 0 else None
    return {"paid": paid["value"], "none": none["value"], "absolute": absolute, "percent": percent}


def dashboard_data():
    paid = group_data("paid")
    none = group_data("none")
    return {
        "records": sorted(deepcopy(records), key=lambda row: row["livestreamDate"], reverse=True),
        "paid": paid,
        "none": none,
        "unknownCount": sum(1 for row in records if row["adStatus"] == "unknown"),
        "comparable": paid["streamCount"] > 0 and none["streamCount"] > 0,
        "differences": {
            "averageGmv": difference(paid["averageGmv"], none["averageGmv"]),
            "averageOrders": difference(paid["averageOrders"], none["averageOrders"]),
            "averageItemsSold": difference(paid["averageItemsSold"], none["averageItemsSold"]),
            "averageViewers": difference(paid["averageViewers"], none["averageViewers"]),
            "averageViewerConversionRate": difference(paid["averageViewerConversionRate"], none["averageViewerConversionRate"]),
            "averageGmvPerHour": difference(paid["averageGmvPerHour"], none["averageGmvPerHour"]),
        },
    }


def mock_query(procedure, value):
    if procedure == "auth.me":
        return None
    if procedure == "liver.me":
        return deepcopy(LIVER)
    if procedure == "brand.list":
        return deepcopy(BRANDS)
    if procedure == "liver.adEffectDashboard":
        return dashboard_data()
    if procedure in {"notifications.unreadCount", "problemLog.unresolvedCount"}:
        return 0
    if procedure == "schedule.getById":
        return None
    return None


def mock_mutation(procedure, value):
    mutation_inputs.append({"procedure": procedure, "input": deepcopy(value)})
    if procedure == "liverManagement.createLivestream":
        livestream_id = 200 + len([entry for entry in mutation_inputs if entry["procedure"] == procedure])
        ad_cost = value.get("adCost")
        gmv = value.get("gmv") or value.get("salesAmount")
        orders = value.get("orderCount")
        viewers = value.get("viewerCount")
        duration = value.get("duration")
        records.append({
            "id": livestream_id,
            "livestreamDate": value["livestreamDate"],
            "brandName": "KG TEST",
            "adStatus": "unknown" if ad_cost is None else "paid" if ad_cost > 0 else "none",
            "adCost": ad_cost,
            "adCostSource": "missing" if ad_cost is None else "native",
            "adCostConflict": False,
            "linkedAdCost": None,
            "gmv": gmv,
            "orderCount": orders,
            "itemsSold": None,
            "viewerCount": viewers,
            "durationMinutes": duration,
            "viewerConversionRate": round(orders / viewers * 100, 2) if orders and viewers else None,
            "gmvPerHour": round(gmv / duration * 60, 2) if gmv is not None and duration else None,
            "roas": round(gmv / ad_cost, 2) if gmv is not None and ad_cost else None,
            "adCostPerOrder": round(ad_cost / orders, 2) if ad_cost and orders else None,
            "adAdjustedSalesContribution": gmv - ad_cost if gmv is not None and ad_cost is not None else None,
        })
        return {"id": livestream_id, "lineNotificationSent": False}
    if procedure == "liver.updateLivestreamAdCost":
        row = next(record for record in records if record["id"] == value["livestreamId"])
        status = value["adStatus"]
        cost = value.get("adCost")
        row["adStatus"] = status
        row["adCost"] = None if status == "unknown" else 0 if status == "none" else cost
        row["adCostSource"] = "missing" if row["adCost"] is None else "native"
        row["roas"] = round(row["gmv"] / row["adCost"], 2) if row.get("gmv") is not None and row.get("adCost") else None
        row["adCostPerOrder"] = round(row["adCost"] / row["orderCount"], 2) if row.get("adCost") and row.get("orderCount") else None
        row["adAdjustedSalesContribution"] = row["gmv"] - row["adCost"] if row.get("gmv") is not None and row.get("adCost") is not None else None
        return {"success": True}
    return {"success": True}


def route_handler(route):
    parsed = urlparse(route.request.url)
    if "/api/trpc/" not in parsed.path:
        route.continue_()
        return
    procedures = parsed.path.split("/api/trpc/", 1)[-1].split(",")
    mocked_procedures.extend(procedures)
    try:
        payloads = []
        for index, procedure in enumerate(procedures):
            value = parse_input(route.request, index)
            result = mock_query(procedure, value) if route.request.method == "GET" else mock_mutation(procedure, value)
            payloads.append(trpc_result(result))
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False))
    except Exception as error:
        route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"json": {"message": str(error), "code": -32600, "data": {"code": "BAD_REQUEST"}}}}, ensure_ascii=False))


def setup_page(context, console_errors, page_errors, failed_requests):
    context.add_init_script("""
      localStorage.setItem('language', 'zh');
      localStorage.setItem('liver_session_token', 'mock-liver-token');
    """)
    page = context.new_page()
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)
    return page


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=2", "--js-flags=--max-old-space-size=256"])
    console_errors, page_errors, failed_requests = [], [], []
    context = browser.new_context(viewport={"width": 1440, "height": 1200})
    page = setup_page(context, console_errors, page_errors, failed_requests)
    response = page.goto(f"{BASE_URL}/liver/record", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("直播内容记录", exact=True).wait_for(state="visible", timeout=20_000)
    page.locator('[data-testid="liver-ad-effect-panel"]').wait_for(state="visible", timeout=20_000)

    # New record: explicitly paid, then submit the existing create procedure.
    page.get_by_label("广告状态").click()
    page.get_by_role("option", name="有广告", exact=True).click()
    page.get_by_label("实际广告费（日元）").fill("3200")
    page.locator('button[role="combobox"]').filter(has_text="选择品牌").click()
    page.get_by_text("KG TEST", exact=True).click()
    page.locator('input[type="number"]:visible').last.fill("90")
    page.locator('input[type="date"]').first.fill("2026-08-28")
    page.locator('input[type="time"]').first.fill("10:00")
    entry_screenshot = OUTPUT_DIR / "liver_ad_cost_entry.png"
    page.screenshot(path=str(entry_screenshot), full_page=True)
    page.get_by_role("button", name="保存", exact=True).click()
    page.wait_for_url("**/liver/coach?auto=1", timeout=20_000)
    create_inputs = [entry["input"] for entry in mutation_inputs if entry["procedure"] == "liverManagement.createLivestream"]
    create_ad_cost_persisted = len(create_inputs) == 1 and create_inputs[0].get("adCost") == 3200

    # Existing record: edit the same ad cost twice and refetch the comparison.
    page.goto(f"{BASE_URL}/liver/record", wait_until="domcontentloaded", timeout=45_000)
    record = page.locator('[data-testid="liver-ad-record-101"]')
    record.wait_for(state="visible", timeout=20_000)
    record.get_by_role("button", name="登记", exact=True).click()
    dialog = page.locator('[data-testid="liver-ad-cost-dialog"]')
    dialog.get_by_label("实际广告费（日元）").fill("2500")
    dialog.get_by_role("button", name="保存", exact=True).click()
    record.get_by_text("¥2,500", exact=False).wait_for(state="visible", timeout=15_000)

    record.get_by_role("button", name="登记", exact=True).click()
    dialog.get_by_label("实际广告费（日元）").fill("3000")
    dialog.get_by_role("button", name="保存", exact=True).click()
    record.get_by_text("¥3,000", exact=False).wait_for(state="visible", timeout=15_000)
    comparison_screenshot = OUTPUT_DIR / "liver_ad_effect_comparison.png"
    page.screenshot(path=str(comparison_screenshot), full_page=True)

    update_inputs = [entry["input"] for entry in mutation_inputs if entry["procedure"] == "liver.updateLivestreamAdCost"]
    two_edits_persisted = [entry.get("adCost") for entry in update_inputs] == [2500, 3000]

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.locator('[data-testid="liver-ad-record-101"]').get_by_text("¥3,000", exact=False).wait_for(state="visible", timeout=20_000)
    persisted_after_reload = True
    context.close()

    relogin_context = browser.new_context(viewport={"width": 1440, "height": 1200})
    relogin_page = setup_page(relogin_context, console_errors, page_errors, failed_requests)
    relogin_page.goto(f"{BASE_URL}/liver/record", wait_until="domcontentloaded", timeout=45_000)
    relogin_page.locator('[data-testid="liver-ad-record-101"]').get_by_text("¥3,000", exact=False).wait_for(state="visible", timeout=20_000)
    relogin_screenshot = OUTPUT_DIR / "liver_ad_effect_after_relogin.png"
    relogin_page.screenshot(path=str(relogin_screenshot), full_page=True)
    persisted_after_relogin = True

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "createAdCostPersisted": create_ad_cost_persisted,
        "createAdCost": create_inputs[0].get("adCost") if create_inputs else None,
        "twoHistoricalEditsPersisted": two_edits_persisted,
        "historicalEditValues": [entry.get("adCost") for entry in update_inputs],
        "paidAndNoneComparisonVisible": relogin_page.get_by_text("有广告", exact=True).count() > 0 and relogin_page.get_by_text("无广告", exact=True).count() > 0,
        "roasVisible": relogin_page.get_by_text("平均ROAS", exact=True).count() > 0,
        "unknownExcludedNoticeVisible": relogin_page.get_by_text("不纳入比较", exact=False).count() > 0,
        "persistedAfterReload": persisted_after_reload,
        "persistedAfterRelogin": persisted_after_relogin,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshots": [str(entry_screenshot), str(comparison_screenshot), str(relogin_screenshot)],
    }
    report["passed"] = all([
        response is not None and response.ok,
        create_ad_cost_persisted,
        two_edits_persisted,
        report["paidAndNoneComparisonVisible"],
        report["roasVisible"],
        report["unknownExcludedNoticeVisible"],
        persisted_after_reload,
        persisted_after_relogin,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    relogin_context.close()
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
