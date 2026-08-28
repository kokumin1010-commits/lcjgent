import base64
import hashlib
import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4192").rstrip("/")
OUTPUT_DIR = ROOT / "tiktok_competitor_multifile_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "tiktok_competitor_multifile_visual_regression.json"
DATE = "2026-08-28"

ADMIN_USER = {
    "id": 9910, "openId": "competitor-multifile-admin", "name": "竞品多文件回归管理员",
    "email": "competitor-multifile@example.invalid", "role": "admin", "loginMethod": "test",
    "createdAt": "2026-08-28T00:00:00.000Z", "updatedAt": "2026-08-28T00:00:00.000Z", "lastSignedIn": "2026-08-28T00:00:00.000Z",
}

CSV_HEADERS = "店铺ID,店铺名称,店铺排名,销量,销售额,商品ID,商品名称,商品排名,原价,直播成交价,商品销量,商品销售额\n"

def csv_content(prefix, shop_base, unit_base, price_delta):
    rows = []
    for shop_index in range(1, 6):
        rows.append(",".join([
            f"shop-{shop_index}", f"{prefix}店铺{shop_index}", str(shop_index), str(shop_base + shop_index * 10), str((shop_base + shop_index * 10) * 1500),
            f"product-{shop_index}", f"共同商品{shop_index}", "1", "2000", str(1500 + price_delta), str(unit_base + shop_index), str((unit_base + shop_index) * (1500 + price_delta)),
        ]))
    return CSV_HEADERS + "\n".join(rows) + "\n"

FIRST_PATH = OUTPUT_DIR / "kalodata-morning.csv"
SECOND_PATH = OUTPUT_DIR / "kalodata-evening.csv"
FIRST_PATH.write_text("\ufeff" + csv_content("早班", 100, 20, 0), encoding="utf-8")
SECOND_PATH.write_text("\ufeff" + csv_content("晚班", 130, 30, -200), encoding="utf-8")

batches = []
reports = [{
    "id": 9001, "reportDate": DATE, "assignedStaffId": 11, "assignedStaffName": "早班A", "status": "draft",
    "shopCount": 5, "productCount": 15, "completedProductCount": 15,
    "shopNames": [f"原日报店铺{i}" for i in range(1, 6)], "rankingSnapshotId": 500,
}]
mutation_inputs = []
mocked_procedures = []


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def parse_input(request, index=0):
    try:
        if request.method == "GET":
            query = parse_qs(urlparse(request.url).query)
            raw = query.get("input", [None])[0]
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


def parsed_rows(rows):
    shops = []
    for index, row in enumerate(rows[:5], 1):
        shops.append({
            "rankingPosition": int(row.get("店铺排名", index)), "externalShopId": row.get("店铺ID"), "shopName": row.get("店铺名称"),
            "shopUrl": None, "unitsSold": float(row.get("销量", 0)), "gmv": float(row.get("销售额", 0)), "revenueGrowthRate": None,
            "products": [{
                "externalProductId": row.get("商品ID"), "productName": row.get("商品名称"), "productUrl": None,
                "originalPrice": float(row.get("原价", 0)), "livePrice": float(row.get("直播成交价", 0)),
                "unitsSold": float(row.get("商品销量", 0)), "gmv": float(row.get("商品销售额", 0)), "clickRate": None,
                "conversionRate": None, "heatEvidence": None,
            }],
        })
    return {"recognizedRows": len(rows), "excludedRows": 0, "warnings": [], "shops": shops}


def batch_detail(batch):
    return {"id": batch["id"], "snapshotDate": DATE, "sourceFileName": batch["sourceFileName"], "importedAt": batch["importedAt"], "isCurrent": batch["isCurrent"], "shops": deepcopy(batch["shops"])}


def comparison_data(selected):
    ordered = [next(batch for batch in batches if batch["id"] == batch_id) for batch_id in sorted(selected)]
    batch_ids = [str(batch["id"]) for batch in ordered]
    first, last = ordered[0], ordered[-1]
    shops = []
    products = []
    for index in range(5):
        first_shop = first["shops"][index]
        last_shop = last["shops"][index]
        values = {str(batch["id"]): {key: batch["shops"][index][key] for key in ["rankingPosition", "externalShopId", "shopName", "unitsSold", "gmv"]} for batch in ordered}
        shops.append({
            "key": f"id:shop-{index+1}", "shopName": last_shop["shopName"], "values": values,
            "changes": {"rankingPosition": last_shop["rankingPosition"] - first_shop["rankingPosition"], "unitsSold": last_shop["unitsSold"] - first_shop["unitsSold"], "gmv": last_shop["gmv"] - first_shop["gmv"]},
        })
        first_product = first_shop["products"][0]
        last_product = last_shop["products"][0]
        product_values = {}
        for batch in ordered:
            product = batch["shops"][index]["products"][0]
            original_price = product.get("originalPrice")
            live_price = product.get("livePrice")
            discount_rate = None if not original_price or live_price is None else (original_price - live_price) / original_price
            product_values[str(batch["id"])] = {**product, "productRank": 1, "discountRate": discount_rate}
        products.append({
            "key": f"id:product-{index+1}", "shopKey": f"id:shop-{index+1}", "shopName": last_shop["shopName"], "productName": last_product["productName"], "values": product_values,
            "changes": {"productRank": 0, "originalPrice": 0, "livePrice": last_product["livePrice"] - first_product["livePrice"], "unitsSold": last_product["unitsSold"] - first_product["unitsSold"], "gmv": last_product["gmv"] - first_product["gmv"], "clickRate": None, "conversionRate": None},
        })
    return {"snapshotDate": DATE, "batches": [{key: batch[key] for key in ["id", "snapshotDate", "sourceFileName", "importedAt", "isCurrent"]} for batch in ordered], "firstBatchId": int(batch_ids[0]), "lastBatchId": int(batch_ids[-1]), "shops": shops, "products": products}


def mock_query(procedure, value):
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "rbac.myPermissions":
        return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure in {"problemLog.unresolvedCount", "notifications.unreadCount"}:
        return 0
    if procedure == "tiktokCompetitorDaily.connectionStatus":
        return {"apiConfigured": False, "storageConfigured": True, "precisionNotice": "Kalodata数据属于市场情报估算。"}
    if procedure == "tiktokCompetitorDaily.taskStatus":
        current = batches[-1] if batches else None
        return {"date": DATE, "isAdmin": True, "isMorningOperator": True, "canImport": True, "morningOperators": [{"id": 11, "name": "早班A", "startTime": "09:00", "endTime": "18:00"}], "rankingSnapshot": None if not current else {"id": current["id"], "shopCount": 5, "productCount": 5}}
    if procedure in {"tiktokCompetitorDaily.listReports"}:
        return deepcopy(reports)
    if procedure == "tiktokCompetitorDaily.managementOverview":
        return {"summary": {"totalReports": len(reports), "operatorCount": 1, "submittedCount": 0, "approvedCount": 0}, "topShops": [], "topProducts": []}
    if procedure == "tiktokCompetitorDaily.listRankingBatches":
        return [{key: batch[key] for key in ["id", "snapshotDate", "source", "sourceFileName", "sourceFileUrl", "sourceFileKey", "sourceFileSha256", "sourceFileSize", "status", "rowCount", "shopCount", "productCount", "isCurrent", "supersedesId", "importedByName", "importedAt", "linkedReportCount"]} for batch in batches]
    if procedure == "tiktokCompetitorDaily.getRankingBatch":
        requested = int((value or {}).get("snapshotId", batches[-1]["id"] if batches else 0))
        return batch_detail(next(batch for batch in batches if batch["id"] == requested))
    if procedure == "tiktokCompetitorDaily.compareRankingBatches":
        selected = [int(item) for item in (value or {}).get("snapshotIds", [batch["id"] for batch in batches[-2:]])]
        return comparison_data(selected)
    return None


def mock_mutation(procedure, value):
    mutation_inputs.append({"procedure": procedure, "input": deepcopy(value)})
    if procedure == "tiktokCompetitorDaily.previewImport":
        return parsed_rows(value.get("rows", []))
    if procedure == "tiktokCompetitorDaily.uploadRankingFile":
        raw = base64.b64decode(value["dataBase64"])
        sha = hashlib.sha256(raw).hexdigest()
        duplicate = next((batch for batch in batches if batch["sourceFileSha256"] == sha), None)
        if duplicate:
            return {"duplicate": True, "fileSha256": sha, "fileSize": len(raw), "snapshotId": duplicate["id"], "sourceFileName": duplicate["sourceFileName"], "sourceFileUrl": duplicate["sourceFileUrl"], "sourceFileKey": duplicate["sourceFileKey"], "importedAt": duplicate["importedAt"]}
        return {"duplicate": False, "url": f"https://storage.example/{value['fileName']}", "key": f"tiktok/{value['fileName']}", "fileSha256": sha, "fileSize": len(raw), "uploadToken": f"signed-{sha}"}
    if procedure == "tiktokCompetitorDaily.commitImport":
        rows = value.get("rows", [])
        preview = parsed_rows(rows)
        for batch in batches:
            batch["isCurrent"] = False
        batch_id = 100 + len(batches) + 1
        batch = {
            "id": batch_id, "snapshotDate": DATE, "source": "kalodata_export", "sourceFileName": value["fileName"], "sourceFileUrl": value["fileUrl"], "sourceFileKey": value["fileKey"],
            "sourceFileSha256": value["fileSha256"], "sourceFileSize": value["fileSize"], "status": "success", "rowCount": len(rows), "shopCount": len(preview["shops"]),
            "productCount": sum(len(shop["products"]) for shop in preview["shops"]), "isCurrent": True, "supersedesId": batches[-1]["id"] if batches else None,
            "importedByName": ADMIN_USER["name"], "importedAt": f"2026-08-28T0{len(batches)+1}:00:00.000Z", "linkedReportCount": 0, "shops": preview["shops"],
        }
        batches.append(batch)
        return {"duplicate": False, "snapshotId": batch_id, "reportIds": [9001], "createdReportIds": [], "preservedReportIds": [9001], "morningOperatorCount": 1, "top5": [shop["shopName"] for shop in preview["shops"]], "warnings": []}
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
    page = context.new_page()
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)
    return page


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=2", "--js-flags=--max-old-space-size=256"])
    console_errors, page_errors, failed_requests = [], [], []
    context = browser.new_context(viewport={"width": 1720, "height": 1200})
    page = setup_page(context, console_errors, page_errors, failed_requests)
    response = page.goto(f"{BASE_URL}/tiktok-competitor-daily?date={DATE}", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("日本区TikTok竞品商品日报", exact=True).wait_for(state="visible", timeout=20_000)
    file_input = page.locator('input[type="file"][multiple]')
    file_input.set_input_files([str(FIRST_PATH), str(SECOND_PATH)])
    page.get_by_text("kalodata-morning.csv", exact=True).wait_for(state="visible", timeout=15_000)
    page.get_by_text("kalodata-evening.csv", exact=True).wait_for(state="visible", timeout=15_000)
    page.get_by_role("button", name="保存为独立批次").nth(1).wait_for(state="visible", timeout=15_000)
    pending_screenshot = OUTPUT_DIR / "multifile_pending_previews.png"
    page.screenshot(path=str(pending_screenshot), full_page=True)

    page.locator('[data-testid="pending-import-kalodata-morning.csv"]').get_by_role("button", name="保存为独立批次").click()
    page.locator('[data-testid="ranking-batch-101"]').wait_for(state="visible", timeout=15_000)
    page.locator('[data-testid="pending-import-kalodata-evening.csv"]').get_by_role("button", name="保存为独立批次").click()
    page.locator('[data-testid="ranking-batch-102"]').wait_for(state="visible", timeout=15_000)
    try:
        page.locator('[data-testid="batch-comparison"]').wait_for(state="visible", timeout=15_000)
    except Exception:
        (OUTPUT_DIR / "comparison_failure_text.txt").write_text(page.locator("body").inner_text(), encoding="utf-8")
        page.screenshot(path=str(OUTPUT_DIR / "comparison_failure.png"), full_page=True)
        print(json.dumps({"mockedProcedures": mocked_procedures, "mutations": mutation_inputs}, ensure_ascii=False, indent=2))
        raise
    page.get_by_text("kalodata-morning.csv", exact=True).first.wait_for(state="visible")
    page.get_by_text("kalodata-evening.csv", exact=True).first.wait_for(state="visible")
    comparison_screenshot = OUTPUT_DIR / "two_batches_comparison.png"
    page.screenshot(path=str(comparison_screenshot), full_page=True)

    page.locator('[data-testid="ranking-batch-101"]').get_by_role("button", name="查看").click()
    page.locator('[data-testid="batch-detail-101"]').wait_for(state="visible", timeout=15_000)
    detail_screenshot = OUTPUT_DIR / "first_batch_independent_view.png"
    page.screenshot(path=str(detail_screenshot), full_page=True)

    file_input.set_input_files(str(FIRST_PATH))
    page.locator('[data-testid="pending-import-kalodata-morning.csv"]').get_by_role("button", name="保存为独立批次").click()
    page.locator('[data-testid="pending-import-kalodata-morning.csv"]').wait_for(state="detached", timeout=15_000)
    duplicate_kept_count = len(batches)
    report_fingerprint = json.dumps(reports, ensure_ascii=False, sort_keys=True)

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.locator('[data-testid="ranking-batch-101"]').wait_for(state="visible", timeout=20_000)
    page.locator('[data-testid="ranking-batch-102"]').wait_for(state="visible", timeout=20_000)
    page.locator('[data-testid="batch-comparison"]').wait_for(state="visible", timeout=15_000)
    persisted_after_reload = page.get_by_text("kalodata-morning.csv", exact=True).count() > 0 and page.get_by_text("kalodata-evening.csv", exact=True).count() > 0
    context.close()

    relogin_context = browser.new_context(viewport={"width": 1720, "height": 1200})
    relogin_page = setup_page(relogin_context, console_errors, page_errors, failed_requests)
    relogin_page.goto(f"{BASE_URL}/tiktok-competitor-daily?date={DATE}", wait_until="domcontentloaded", timeout=45_000)
    relogin_page.locator('[data-testid="ranking-batch-101"]').wait_for(state="visible", timeout=20_000)
    relogin_page.locator('[data-testid="ranking-batch-102"]').wait_for(state="visible", timeout=20_000)
    relogin_page.locator('[data-testid="batch-comparison"]').wait_for(state="visible", timeout=15_000)
    persisted_after_relogin = relogin_page.get_by_text("kalodata-morning.csv", exact=True).count() > 0 and relogin_page.get_by_text("kalodata-evening.csv", exact=True).count() > 0
    relogin_screenshot = OUTPUT_DIR / "two_batches_after_relogin.png"
    relogin_page.screenshot(path=str(relogin_screenshot), full_page=True)

    commit_inputs = [entry["input"] for entry in mutation_inputs if entry["procedure"] == "tiktokCompetitorDaily.commitImport"]
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(), "baseUrl": BASE_URL, "httpStatus": response.status if response else None,
        "batchCount": len(batches), "batchFileNames": [batch["sourceFileName"] for batch in batches], "duplicateKeptCount": duplicate_kept_count,
        "commitCount": len(commit_inputs), "commitHasSignedReceipt": all(value.get("uploadToken", "").startswith("signed-") for value in commit_inputs),
        "existingReportUnchanged": json.dumps(reports, ensure_ascii=False, sort_keys=True) == report_fingerprint,
        "comparisonVisible": relogin_page.locator('[data-testid="batch-comparison"]').count() == 1,
        "comparisonHasPriceChange": relogin_page.get_by_text("成交价 -200 JPY", exact=False).count() > 0,
        "persistedAfterReload": persisted_after_reload, "persistedAfterRelogin": persisted_after_relogin,
        "mockedProcedures": sorted(set(mocked_procedures)), "consoleErrors": console_errors, "pageErrors": page_errors, "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshots": [str(pending_screenshot), str(comparison_screenshot), str(detail_screenshot), str(relogin_screenshot)],
    }
    report["passed"] = all([
        response is not None and response.ok, len(batches) == 2, report["batchFileNames"] == ["kalodata-morning.csv", "kalodata-evening.csv"],
        duplicate_kept_count == 2, len(commit_inputs) == 2, report["commitHasSignedReceipt"], report["existingReportUnchanged"],
        report["comparisonVisible"], report["comparisonHasPriceChange"], persisted_after_reload, persisted_after_relogin,
        not console_errors, not page_errors, not failed_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    relogin_context.close()
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
