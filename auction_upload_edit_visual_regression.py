from __future__ import annotations

import json
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from openpyxl import Workbook
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4189").rstrip("/")
ARTIFACT_DIR = ROOT / "auction_upload_edit_visual_artifacts"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_PATH = ROOT / "auction_upload_edit_visual_regression.json"
VALID_XLSX = Path("/tmp/lcj-auction-valid.xlsx")
INVALID_FILE = Path("/tmp/lcj-auction-invalid.txt")

ADMIN_USER = {
    "id": 9910,
    "openId": "auction-admin-mock",
    "name": "拍卖回归管理员",
    "email": "auction-regression@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

records = [
    {
        "id": 7,
        "productId": "1737000000000000007",
        "productName": "既存拍卖商品",
        "chineseName": "既有拍卖商品",
        "startPrice": 1000,
        "finalPrice": 4000,
        "totalGmv": 8000,
        "totalOrders": 2,
        "auctionCount": 2,
        "liverName": "choco",
        "auctionDate": "2026-08-24T00:00:00.000Z",
        "note": "Excelインポート",
        "roundsJson": json.dumps([
            {"roundNumber": 1, "startPrice": 1000, "salePrice": 3000, "bidderCount": 2, "winner": "A", "skuName": "SKU-A", "skuId": "17001", "startTime": "2026-08-24 10:00", "duration": 30},
            {"roundNumber": 2, "startPrice": 1000, "salePrice": 5000, "bidderCount": 4, "winner": "B", "skuName": "SKU-B", "skuId": "17002", "startTime": "2026-08-24 10:05", "duration": 30},
        ], ensure_ascii=False),
        "createdAt": "2026-08-24T01:00:00.000Z",
    },
    {
        "id": 8,
        "productId": "1737000000000000008",
        "productName": "別主播商品",
        "chineseName": "其他主播商品",
        "startPrice": 2000,
        "finalPrice": 6000,
        "totalGmv": 6000,
        "totalOrders": 1,
        "auctionCount": 1,
        "liverName": "yae",
        "auctionDate": "2026-08-25T00:00:00.000Z",
        "note": "手工",
        "roundsJson": "{broken legacy json",
        "createdAt": "2026-08-25T01:00:00.000Z",
    },
]

history = [{
    "id": 1,
    "sourceFileName": "previous.xlsx",
    "sourceFileSha256": "a" * 64,
    "sourceFileSize": 1024,
    "sourceMimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "originalFileSaved": True,
    "sourceRowCount": 2,
    "groupedRecordCount": 1,
    "importedRecordCount": 1,
    "skippedRowCount": 1,
    "liverName": "choco",
    "status": "success",
    "errorMessage": None,
    "createdBy": 1,
    "createdAt": "2026-08-26T00:00:00.000Z",
    "completedAt": "2026-08-26T00:01:00.000Z",
}]

next_id = 20
mutations: list[dict] = []
mocked_procedures: list[str] = []


def create_files():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "拍卖"
    sheet.append(["商品ID", "商品名", "在庫", "商品の販売数", "GMV", "商品", "PID", "SKU ID", "入札開始価格", "販売価格", "当選者", "入札者", "開始時間", "時間"])
    sheet.append(["1737999999999999999", "上传拍卖商品", 8, 2, "¥9,000", "上传SKU-A", "1737999999999999999", "1799000000000000001", 1000, 4000, "Winner-A", 3, "2026-08-27 12:00", 30])
    sheet.append(["1737999999999999999", "上传拍卖商品", 8, 2, "¥9,000", "上传SKU-B", "1737999999999999999", "1799000000000000002", 1000, 5000, "Winner-B", 4, "2026-08-27 12:05", 30])
    workbook.save(VALID_XLSX)
    INVALID_FILE.write_text("not an auction workbook\n", encoding="utf-8")


def trpc_result(value, procedure: str):
    if procedure == "auction.list":
        payload = deepcopy(value)
        date_meta = {}
        for index, row in enumerate(payload):
            date = row.get("auctionDate")
            if date:
                row["auctionDate"] = date
                date_meta[f"{index}.auctionDate"] = ["Date"]
        data = {"json": payload}
        if date_meta:
            data["meta"] = {"values": date_meta}
        return {"result": {"data": data}}
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


def query_value(procedure: str):
    if procedure == "auth.me": return ADMIN_USER
    if procedure == "rbac.myPermissions": return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure in {"problemLog.unresolvedCount", "notifications.unreadCount"}: return 0
    if procedure == "selectionCenter.getProducts": return {"items": [], "total": 0}
    if procedure == "selectionCenter.getCategories": return []
    if procedure == "selectionCenter.getLivers": return []
    if procedure == "selectionCenter.getPriceProtectionStatus": return []
    if procedure in {"selectionCenter.getProductDeepRecoveryHealth", "selectionCenter.getKgProductRecoveryHealth"}: return None
    if procedure == "reportsAccountsProductsRecovery.overview": return {"historicalProducts": []}
    if procedure == "auction.list": return deepcopy(records)
    if procedure == "auction.importHistory": return deepcopy(history)
    return None


def apply_mutation(procedure: str, value):
    global next_id
    value = deepcopy(value or {})
    if procedure == "auction.update":
        mutations.append({"procedure": procedure, "input": value})
        target = next((row for row in records if int(row["id"]) == int(value["id"])), None)
        if not target: raise AssertionError("unknown auction id")
        for key, item in value.items():
            if key != "id": target[key] = item
        target["auctionDate"] = f"{value['auctionDate']}T00:00:00.000Z"
        return {"success": True}
    if procedure == "auction.create":
        mutations.append({"procedure": procedure, "input": value})
        created = deepcopy(value)
        created.update({"id": next_id, "auctionDate": f"{value['auctionDate']}T00:00:00.000Z", "createdAt": "2026-08-27T00:00:00.000Z"})
        records.append(created)
        next_id += 1
        return {"id": created["id"], "success": True}
    if procedure == "auction.importBatch":
        mutations.append({"procedure": procedure, "input": {key: item for key, item in value.items() if key != "sourceFileBase64"}, "base64Present": bool(value.get("sourceFileBase64"))})
        for imported in value["records"]:
            created = deepcopy(imported)
            created.update({"id": next_id, "liverName": value["liverName"], "note": "Excelインポート", "auctionDate": f"{imported['auctionDate']}T00:00:00.000Z", "createdAt": "2026-08-27T00:00:00.000Z"})
            records.append(created)
            next_id += 1
        history.insert(0, {"id": 2, "sourceFileName": value["sourceFileName"], "sourceFileSha256": value["sourceFileSha256"], "sourceFileSize": value["sourceFileSize"], "sourceMimeType": value["sourceMimeType"], "originalFileSaved": True, "sourceRowCount": value["sourceRowCount"], "groupedRecordCount": len(value["records"]), "importedRecordCount": len(value["records"]), "skippedRowCount": value["skippedRowCount"], "liverName": value["liverName"], "status": "success", "errorMessage": None, "createdBy": ADMIN_USER["id"], "createdAt": "2026-08-27T00:00:00.000Z", "completedAt": "2026-08-27T00:00:01.000Z"})
        return {"success": True, "alreadyImported": False, "batchId": 2, "sourceRowCount": value["sourceRowCount"], "groupedRecordCount": len(value["records"]), "importedRecordCount": len(value["records"]), "skippedRowCount": value["skippedRowCount"], "originalFileSaved": True}
    if procedure == "auction.getImportFile": return {"fileName": "previous.xlsx", "url": "https://example.invalid/previous.xlsx"}
    return {"success": True}


def route_handler(route):
    parsed = urlparse(route.request.url)
    if "/api/trpc/" not in parsed.path:
        route.continue_()
        return
    procedures = parsed.path.split("/api/trpc/", 1)[-1].split(",")
    mocked_procedures.extend(procedures)
    value = extract_input(route.request)
    try:
        if route.request.method == "GET":
            bodies = [trpc_result(query_value(procedure), procedure) for procedure in procedures]
        else:
            bodies = [trpc_result(apply_mutation(procedure, value), procedure) for procedure in procedures]
        route.fulfill(status=200, content_type="application/json", body=json.dumps(bodies if len(bodies) > 1 else bodies[0], ensure_ascii=False))
    except Exception as error:
        route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"json": {"message": str(error), "code": -32600, "data": {"code": "BAD_REQUEST"}}}}, ensure_ascii=False))


def labeled_input(container, label: str):
    node = container.locator("label").filter(has_text=re.compile(rf"^{re.escape(label)}$")).first
    return node.locator("xpath=following-sibling::input[1]")


def install_page(context, console_errors, page_errors, failed_requests):
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'ja'); sessionStorage.setItem('sc_access', 'granted')")
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)
    return page


create_files()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    context = browser.new_context(viewport={"width": 1536, "height": 1100})
    page = install_page(context, console_errors, page_errors, failed_requests)
    response = page.goto(f"{BASE_URL}/master/selection-center?tab=auction", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("既存拍卖商品", exact=True).wait_for(state="visible", timeout=25_000)

    page.get_by_role("button", name="choco (1)", exact=True).click()
    page.get_by_text("別主播商品", exact=True).wait_for(state="hidden", timeout=5_000)
    filter_kept_page_alive = page.get_by_role("button", name="Excel導入", exact=False).is_visible()
    page.get_by_role("button", name="全部 (2)", exact=True).click()

    page.get_by_role("button", name="編集", exact=True).first.click()
    editor = page.locator("div.fixed.inset-0").last
    editor.get_by_text("拍卖记录修改 / 拍卖記録を編集", exact=True).wait_for(state="visible", timeout=10_000)
    date_loaded_from_superjson = labeled_input(editor, "日付 *").input_value() == "2026-08-24"
    labeled_input(editor, "商品名").fill("既存拍卖商品 更新")
    labeled_input(editor, "中文名").fill("既有拍卖商品 已修改")
    labeled_input(editor, "備考").fill("用户可自行修改")
    round_cards = editor.locator("div.rounded-lg.border.border-purple-100.bg-white")
    initial_round_count = round_cards.count()
    round_cards.nth(1).locator("label").filter(has_text=re.compile(r"^成交价$")).locator("xpath=following-sibling::input[1]").fill("7000")
    editor.get_by_role("button", name="+ 轮次追加", exact=True).click()
    round_count_after_add = editor.locator("div.rounded-lg.border.border-purple-100.bg-white").count()
    editor_screenshot = ARTIFACT_DIR / "auction_edit_dialog.png"
    editor.screenshot(path=str(editor_screenshot))
    editor.get_by_text("第 3 轮", exact=True).locator("xpath=..").get_by_role("button", name="删除 / 削除", exact=True).click()
    editor.get_by_role("button", name="更新", exact=True).click()
    page.get_by_text("既存拍卖商品 更新", exact=True).wait_for(state="visible", timeout=15_000)
    update_input = deepcopy(next(item["input"] for item in reversed(mutations) if item["procedure"] == "auction.update"))

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("既存拍卖商品 更新", exact=True).wait_for(state="visible", timeout=20_000)
    page.get_by_role("button", name="Excel導入", exact=False).click()
    page.locator('input[placeholder="主播名を入力..."]').fill("test-liver")
    file_input = page.locator('input[type="file"][accept=".xlsx,.xls,.csv"]')
    file_input.set_input_files(str(VALID_XLSX))
    page.get_by_text(re.compile(r"文件检查完成 / 確認完了：1商品")).wait_for(state="visible", timeout=15_000)
    import_preview_screenshot = ARTIFACT_DIR / "auction_import_preview.png"
    page.locator("div.bg-blue-50.border.border-blue-200").screenshot(path=str(import_preview_screenshot))
    page.get_by_role("button", name="上传并导入 / アップロード", exact=True).click()
    page.get_by_text("上传拍卖商品", exact=True).wait_for(state="visible", timeout=20_000)
    import_entry = deepcopy(next(item for item in reversed(mutations) if item["procedure"] == "auction.importBatch"))

    page.get_by_role("button", name="Excel導入", exact=False).click()
    invalid_count_before = len([item for item in mutations if item["procedure"] == "auction.importBatch"])
    file_input = page.locator('input[type="file"][accept=".xlsx,.xls,.csv"]')
    file_input.set_input_files(str(INVALID_FILE))
    page.get_by_text(re.compile(r"仅支持XLSX|XLSX・XLS・CSV")).first.wait_for(state="visible", timeout=10_000)
    upload_button_disabled_for_invalid = page.get_by_role("button", name="上传并导入 / アップロード", exact=True).is_disabled()
    invalid_count_after = len([item for item in mutations if item["procedure"] == "auction.importBatch"])
    page.get_by_role("button", name="キャンセル", exact=True).click()

    context.close()
    relogin_context = browser.new_context(viewport={"width": 1536, "height": 1100})
    relogin_page = install_page(relogin_context, console_errors, page_errors, failed_requests)
    relogin_page.goto(f"{BASE_URL}/master/selection-center?tab=auction", wait_until="domcontentloaded", timeout=45_000)
    relogin_page.get_by_text("既存拍卖商品 更新", exact=True).wait_for(state="visible", timeout=20_000)
    relogin_page.get_by_text("上传拍卖商品", exact=True).wait_for(state="visible", timeout=20_000)
    screenshot = ARTIFACT_DIR / "auction_after_relogin.png"
    relogin_page.screenshot(path=str(screenshot), full_page=True)

    saved_record = next(row for row in records if row["id"] == 7)
    imported_record = next(row for row in records if row["productName"] == "上传拍卖商品")
    saved_rounds = json.loads(saved_record["roundsJson"])
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "filterKeptPageAlive": filter_kept_page_alive,
        "dateLoadedFromSuperjsonDate": date_loaded_from_superjson,
        "initialRoundCount": initial_round_count,
        "roundCountAfterAdd": round_count_after_add,
        "updateInput": update_input,
        "savedRecord": saved_record,
        "savedRoundCount": len(saved_rounds),
        "importMutation": import_entry,
        "importedRecord": imported_record,
        "uploadButtonDisabledForInvalidFile": upload_button_disabled_for_invalid,
        "invalidImportCountBefore": invalid_count_before,
        "invalidImportCountAfter": invalid_count_after,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshot": str(screenshot),
        "editorScreenshot": str(editor_screenshot),
        "importPreviewScreenshot": str(import_preview_screenshot),
    }
    report["passed"] = all([
        response is not None and response.ok,
        filter_kept_page_alive,
        date_loaded_from_superjson,
        initial_round_count == 2,
        round_count_after_add == 3,
        update_input.get("productName") == "既存拍卖商品 更新",
        update_input.get("chineseName") == "既有拍卖商品 已修改",
        update_input.get("note") == "用户可自行修改",
        len(json.loads(update_input.get("roundsJson", "[]"))) == 2,
        json.loads(update_input["roundsJson"])[1].get("salePrice") == 7000,
        saved_record.get("productName") == "既存拍卖商品 更新",
        len(saved_rounds) == 2,
        import_entry.get("base64Present") is True,
        import_entry.get("input", {}).get("sourceFileName") == VALID_XLSX.name,
        imported_record.get("liverName") == "test-liver",
        upload_button_disabled_for_invalid,
        invalid_count_before == invalid_count_after,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    relogin_context.close()
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
