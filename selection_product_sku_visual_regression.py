from __future__ import annotations

import json
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4187").rstrip("/")
OUTPUT_DIR = ROOT / "selection_product_sku_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "selection_product_sku_visual_regression.json"

ADMIN_USER = {
    "id": 9901,
    "openId": "selection-product-sku-admin",
    "name": "商品SKU回归管理员",
    "email": "selection-product-sku@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

products = [
    {
        "id": 7,
        "productName": "既存商品A",
        "productNameCn": "既有商品A",
        "productId": "MOCK-EXISTING-7",
        "barcode": "MOCK0007",
        "brandName": "LCJ",
        "brandId": 1,
        "categoryId": None,
        "price": "17500",
        "marketPrice": None,
        "costPrice": None,
        "commissionType": "percentage",
        "commissionValue": None,
        "images": "[]",
        "detailImages": "[]",
        "videos": "[]",
        "productLink": None,
        "sellingPoints": None,
        "description": None,
        "stock": 5,
        "supplierContact": None,
        "talentExclusive": 0,
        "exclusiveLiverIds": "[]",
        "tags": '["KG品牌款","爆品款"]',
        "status": "draft",
        "selfOperated": 0,
        "skuName": "旧SKU",
        "skuPrice": "17500",
        "skuLowestPrice": "3000",
        "skuDiscountRate": "60",
        "skuVariants": '[{"name":"旧SKU","price":"17500","lowestPrice":"3000","discountRate":"60"}]',
        "parentProductId": None,
        "createdAt": "2026-08-20T00:00:00.000Z",
        "updatedAt": "2026-08-20T00:00:00.000Z",
        "deletedAt": None,
    }
]
mutation_inputs: list[dict] = []
mocked_procedures: list[str] = []
next_id = 20


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


def mock_value(procedure):
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "rbac.myPermissions":
        return {"isSuperAdmin": True, "roleName": "admin", "permissions": None}
    if procedure in {"problemLog.unresolvedCount", "notifications.unreadCount"}:
        return 0
    if procedure == "selectionCenter.getProducts":
        return {"items": deepcopy(products), "total": len(products)}
    if procedure == "selectionCenter.getCategories":
        return []
    if procedure == "selectionCenter.getLivers":
        return []
    if procedure == "selectionCenter.getPriceProtectionStatus":
        return []
    if procedure in {"selectionCenter.getProductDeepRecoveryHealth", "selectionCenter.getKgProductRecoveryHealth"}:
        return None
    if procedure == "brand.list":
        return [{"id": 1, "name": "LCJ", "nameCn": "LCJ", "status": "active"}]
    if procedure == "reportsAccountsProductsRecovery.overview":
        return {"historicalProducts": []}
    return None


def apply_mutation(procedure: str, value):
    global next_id
    if not isinstance(value, dict):
        return {"success": True}
    if procedure == "selectionCenter.updateProduct":
        mutation_inputs.append({"procedure": procedure, "input": deepcopy(value)})
        product_id = int(value.get("id", 0))
        product = next((row for row in products if int(row["id"]) == product_id), None)
        if product is None:
            raise AssertionError(f"unexpected update product id: {product_id}")
        for key, item in value.items():
            if key != "id":
                product[key] = deepcopy(item)
        return {"success": True}
    if procedure == "selectionCenter.createProduct":
        mutation_inputs.append({"procedure": procedure, "input": deepcopy(value)})
        created = deepcopy(value)
        created.update({
            "id": next_id,
            "status": "draft",
            "createdAt": "2026-08-27T00:00:00.000Z",
            "updatedAt": "2026-08-27T00:00:00.000Z",
            "deletedAt": None,
            "parentProductId": value.get("parentProductId"),
        })
        products.append(created)
        next_id += 1
        return {"id": created["id"]}
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
            payloads = [trpc_result(mock_value(procedure)) for procedure in procedures]
        else:
            payloads = [trpc_result(apply_mutation(procedure, value)) for procedure in procedures]
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False),
        )
    except Exception as error:
        route.fulfill(
            status=400,
            content_type="application/json",
            body=json.dumps({"error": {"json": {"message": str(error), "code": -32600, "data": {"code": "BAD_REQUEST"}}}}, ensure_ascii=False),
        )


def labeled_input(dialog, label_text: str):
    label = dialog.locator("label").filter(has_text=re.compile(rf"^{re.escape(label_text)}$")).first
    return label.locator("xpath=following-sibling::input[1]")


def fill_sku(card, *, name: str, price: str, lowest: str = "", discount: str = ""):
    inputs = card.locator("input")
    inputs.nth(0).fill(name)
    inputs.nth(1).fill(price)
    if lowest:
        inputs.nth(2).fill(lowest)
    if discount:
        inputs.nth(3).fill(discount)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    context = browser.new_context(viewport={"width": 1536, "height": 1100})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'ja'); sessionStorage.setItem('sc_access', 'granted')")
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)

    response = page.goto(f"{BASE_URL}/master/selection-center?tab=products", wait_until="domcontentloaded", timeout=45_000)
    page.wait_for_timeout(3_000)
    if page.get_by_text("既存商品A", exact=True).count() == 0:
        debug_screenshot = OUTPUT_DIR / "initial_load_failure.png"
        page.screenshot(path=str(debug_screenshot), full_page=True)
        print(json.dumps({
            "url": page.url,
            "body": page.locator("body").inner_text()[:5_000],
            "mockedProcedures": sorted(set(mocked_procedures)),
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
            "screenshot": str(debug_screenshot),
        }, ensure_ascii=False, indent=2))
        raise SystemExit(2)
    page.get_by_text("既存商品A", exact=True).wait_for(state="visible", timeout=25_000)

    existing_row = page.get_by_role("row").filter(has_text="既存商品A").first
    existing_row.locator("button").first.click()
    edit_dialog = page.get_by_role("dialog")
    edit_dialog.get_by_text("商品編集", exact=True).wait_for(state="visible", timeout=10_000)
    labeled_input(edit_dialog, "商品名 *").fill("既存商品A 更新")
    labeled_input(edit_dialog, "中文商品名").fill("既有商品A 已更新")

    sku_cards = edit_dialog.locator("div.border-teal-100")
    expect_first_count = sku_cards.count()
    fill_sku(sku_cards.nth(0), name="既存SKU更新", price="18000", lowest="3000")
    edit_dialog.get_by_role("button", name="+ SKU追加").click()
    sku_cards = edit_dialog.locator("div.border-teal-100")
    fill_sku(sku_cards.nth(1), name="追加SKU-B", price="24000", lowest="4800")
    edit_dialog.get_by_role("button", name="更新", exact=True).click()
    page.get_by_text("既存商品A 更新", exact=True).wait_for(state="visible", timeout=15_000)

    first_update = deepcopy(mutation_inputs[-1]["input"])
    edit_after_first_save = next(row for row in products if row["id"] == 7)
    saved_two_skus = deepcopy(edit_after_first_save.get("skuVariants"))

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("既存商品A 更新", exact=True).wait_for(state="visible", timeout=20_000)
    page.get_by_text("追加SKU-B", exact=True).wait_for(state="visible", timeout=10_000)

    existing_row = page.get_by_role("row").filter(has_text="既存商品A 更新").first
    existing_row.locator("button").first.click()
    edit_dialog = page.get_by_role("dialog")
    edit_dialog.get_by_label("SKU 1を削除").click()
    edit_dialog.get_by_label("SKU 1を削除").click()
    no_sku_placeholder = edit_dialog.get_by_text("「+ SKU追加」でSKUを登録", exact=True).is_visible()
    edit_dialog.get_by_role("button", name="更新", exact=True).click()
    page.get_by_text("既存商品A 更新", exact=True).wait_for(state="visible", timeout=15_000)
    cleared_update = deepcopy(mutation_inputs[-1]["input"])

    page.get_by_role("button", name="商品追加", exact=True).click()
    create_dialog = page.get_by_role("dialog")
    labeled_input(create_dialog, "商品名 *").fill("新規商品SKUテスト")
    labeled_input(create_dialog, "中文商品名").fill("新上架商品SKU测试")
    create_dialog.get_by_role("button", name="ブランドを選択...").click()
    create_dialog.get_by_role("button", name="LCJ", exact=True).click()
    create_dialog.get_by_role("button", name="+ SKU追加").click()
    create_dialog.get_by_role("button", name="+ SKU追加").click()
    create_cards = create_dialog.locator("div.border-teal-100")
    fill_sku(create_cards.nth(0), name="新規SKU-10個", price="10000", lowest="7000")
    fill_sku(create_cards.nth(1), name="新規SKU-20個", price="18000", lowest="11000")
    create_cards.nth(1).locator("select").select_option("1+1")
    create_dialog.get_by_role("button", name="作成", exact=True).click()
    page.get_by_text("新規商品SKUテスト", exact=True).wait_for(state="visible", timeout=15_000)
    page.get_by_text("新規SKU-20個", exact=True).wait_for(state="visible", timeout=10_000)
    create_input = deepcopy([entry["input"] for entry in mutation_inputs if entry["procedure"] == "selectionCenter.createProduct"][-1])

    page.get_by_role("button", name="商品追加", exact=True).click()
    duplicate_dialog = page.get_by_role("dialog")
    labeled_input(duplicate_dialog, "商品名 *").fill("重复SKU阻断测试")
    duplicate_dialog.get_by_role("button", name="ブランドを選択...").click()
    duplicate_dialog.get_by_role("button", name="LCJ", exact=True).click()
    duplicate_dialog.get_by_role("button", name="+ SKU追加").click()
    duplicate_dialog.get_by_role("button", name="+ SKU追加").click()
    duplicate_cards = duplicate_dialog.locator("div.border-teal-100")
    fill_sku(duplicate_cards.nth(0), name="ＳＫＵ A", price="1000")
    fill_sku(duplicate_cards.nth(1), name="sku   a", price="1200")
    create_count_before_duplicate = len([entry for entry in mutation_inputs if entry["procedure"] == "selectionCenter.createProduct"])
    duplicate_dialog.get_by_role("button", name="作成", exact=True).click()
    page.get_by_text(re.compile("名称.*重複")).wait_for(state="visible", timeout=10_000)
    create_count_after_duplicate = len([entry for entry in mutation_inputs if entry["procedure"] == "selectionCenter.createProduct"])
    duplicate_dialog.get_by_role("button", name="キャンセル", exact=True).click()

    context.close()

    relogin_context = browser.new_context(viewport={"width": 1536, "height": 1100})
    relogin_page = relogin_context.new_page()
    relogin_page.add_init_script("localStorage.setItem('language', 'ja'); sessionStorage.setItem('sc_access', 'granted')")
    relogin_page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    relogin_page.on("pageerror", lambda error: page_errors.append(str(error)))
    relogin_page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    relogin_page.route("**/api/trpc/**", route_handler)
    relogin_page.goto(f"{BASE_URL}/master/selection-center?tab=products", wait_until="domcontentloaded", timeout=45_000)
    relogin_page.get_by_text("既存商品A 更新", exact=True).wait_for(state="visible", timeout=20_000)
    relogin_page.get_by_text("新規商品SKUテスト", exact=True).wait_for(state="visible", timeout=20_000)
    relogin_page.get_by_text("新規SKU-10個", exact=True).wait_for(state="visible", timeout=10_000)
    relogin_page.get_by_text("新規SKU-20個", exact=True).wait_for(state="visible", timeout=10_000)
    screenshot = OUTPUT_DIR / "selection_products_after_relogin.png"
    relogin_page.screenshot(path=str(screenshot), full_page=True)

    existing_final = next(row for row in products if row["id"] == 7)
    created_final = next(row for row in products if row["productName"] == "新規商品SKUテスト")
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "initialExistingSkuRowCount": expect_first_count,
        "firstUpdateInput": first_update,
        "savedTwoSkus": saved_two_skus,
        "noSkuPlaceholderAfterDeletingFinalRow": no_sku_placeholder,
        "clearedUpdateInput": cleared_update,
        "createInput": create_input,
        "existingAfterRelogin": existing_final,
        "createdAfterRelogin": created_final,
        "createCountBeforeDuplicate": create_count_before_duplicate,
        "createCountAfterDuplicate": create_count_after_duplicate,
        "mutationCount": len(mutation_inputs),
        "mockedProcedures": sorted(set(mocked_procedures)),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshot": str(screenshot),
    }
    report["passed"] = all([
        response is not None and response.ok,
        expect_first_count == 1,
        first_update.get("productName") == "既存商品A 更新",
        first_update.get("productNameCn") == "既有商品A 已更新",
        first_update.get("tags") == ["KG品牌款", "爆品款"],
        isinstance(saved_two_skus, list) and len(saved_two_skus) == 2,
        saved_two_skus[0].get("name") == "既存SKU更新",
        saved_two_skus[1].get("name") == "追加SKU-B",
        no_sku_placeholder,
        cleared_update.get("skuVariants") == [],
        cleared_update.get("skuName") is None,
        existing_final.get("skuVariants") == [],
        create_input.get("productNameCn") == "新上架商品SKU测试",
        isinstance(create_input.get("skuVariants"), list) and len(create_input["skuVariants"]) == 2,
        create_input["skuVariants"][1].get("promotionType") == "1+1",
        isinstance(created_final.get("skuVariants"), list) and len(created_final["skuVariants"]) == 2,
        create_count_before_duplicate == create_count_after_duplicate,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    relogin_context.close()
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
