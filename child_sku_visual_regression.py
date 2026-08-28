#!/usr/bin/env python3

import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4191").rstrip("/")
OUTPUT_DIR = ROOT / "child_sku_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "child_sku_visual_regression.json"

ADMIN_USER = {
    "id": 9902,
    "openId": "child-sku-admin",
    "name": "父子SKU回归管理员",
    "email": "child-sku@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-28T00:00:00.000Z",
    "updatedAt": "2026-08-28T00:00:00.000Z",
    "lastSignedIn": "2026-08-28T00:00:00.000Z",
}

products = [
    {
        "id": 1,
        "productName": "KYOGOKU 父商品SKU测试",
        "productNameCn": "KYOGOKU 父商品SKU测试中文",
        "productId": "MOCK-PARENT-1",
        "barcode": "PARENT0001",
        "brandName": "KYOGOKU JAPAN",
        "brandId": 1,
        "categoryId": 11,
        "price": "1463",
        "historicalLowestPrice": "1463",
        "discountRate": "0",
        "commissionType": "percentage",
        "commissionValue": "0",
        "images": "[]",
        "stock": 28,
        "status": "online",
        "promotionType": None,
        "tags": "[]",
        "exclusiveLiverIds": "[]",
        "skuName": "10個セット",
        "skuPrice": "5000",
        "skuLowestPrice": "3500",
        "skuDiscountRate": "30",
        "skuVariants": json.dumps([
            {
                "variantId": "variant-a",
                "name": "10個セット",
                "skuCode": "KG-SET-10",
                "price": "5000",
                "lowestPrice": "3500",
                "discountRate": "30",
                "promotionType": "1+1",
                "stock": 10,
                "status": "online",
            },
            {
                "variantId": "variant-b",
                "name": "20個セット",
                "skuCode": "KG-SET-20",
                "price": "9000",
                "lowestPrice": "6000",
                "discountRate": "33",
                "promotionType": "1+2",
                "stock": 18,
                "status": "draft",
            },
        ], ensure_ascii=False),
        "parentProductId": None,
        "createdAt": "2026-08-20T00:00:00.000Z",
        "updatedAt": "2026-08-20T00:00:00.000Z",
        "deletedAt": None,
    },
    {
        "id": 130,
        "productName": "KYOGOKU ケラチンヘアマスクキャップ 5枚セット",
        "productNameCn": None,
        "productId": "kg-child-sku:f690c0c490bf7ebb",
        "skuName": "KG-KERATIN-MASK-5",
        "barcode": "4580000000130",
        "brandName": "KYOGOKU JAPAN",
        "brandId": 1,
        "categoryId": 11,
        "price": "4200",
        "historicalLowestPrice": "3600",
        "discountRate": "14",
        "commissionType": "percentage",
        "commissionValue": "0",
        "images": "[]",
        "stock": 8,
        "status": "offline",
        "promotionType": None,
        "skuVariants": None,
        "parentProductId": 1,
        "createdAt": "2026-08-20T00:00:00.000Z",
        "updatedAt": "2026-08-20T00:00:00.000Z",
        "deletedAt": None,
    },
]

mutation_inputs = []
mocked_procedures = []


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


def decode_variants(product):
    value = product.get("skuVariants")
    if isinstance(value, str):
        return json.loads(value)
    return deepcopy(value or [])


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
        return [
            {"id": 10, "name": "Hair Care", "nameCn": "头发护理", "parentId": None},
            {"id": 11, "name": "Mask", "nameCn": "发膜", "parentId": 10},
        ]
    if procedure == "selectionCenter.getLivers":
        return []
    if procedure == "selectionCenter.getPriceProtectionStatus":
        return [
            {"productId": 1, "status": "danger", "protectionDaysLeft": 28, "lastChangedAt": "2026-08-20T00:00:00.000Z"},
            {"productId": 130, "status": "safe", "protectionDaysLeft": 0, "lastChangedAt": "2026-08-01T00:00:00.000Z"},
        ]
    if procedure == "selectionCenter.getProductBundleCount":
        return {"count": 0, "bundleNames": []}
    if procedure in {"selectionCenter.getProductDeepRecoveryHealth", "selectionCenter.getKgProductRecoveryHealth"}:
        return None
    if procedure == "brand.list":
        return [{"id": 1, "name": "KYOGOKU JAPAN", "nameCn": "京极", "status": "active"}]
    if procedure == "reportsAccountsProductsRecovery.overview":
        return {"historicalProducts": []}
    return None


def locate_variant(product, value):
    variants = decode_variants(product)
    variant_id = value.get("variantId")
    if variant_id:
        for index, variant in enumerate(variants):
            if variant.get("variantId") == variant_id:
                return variants, index
    index = int(value.get("fallbackIndex", -1))
    if index < 0 or index >= len(variants):
        raise AssertionError("embedded variant target not found")
    return variants, index


def apply_mutation(procedure, value):
    if not isinstance(value, dict):
        return {"success": True}
    mutation_inputs.append({"procedure": procedure, "input": deepcopy(value)})
    if procedure == "selectionCenter.updateEmbeddedChildSku":
        parent = next(row for row in products if int(row["id"]) == int(value["parentId"]))
        variants, index = locate_variant(parent, value)
        current = variants[index]
        updated = {**current, **deepcopy(value["data"])}
        updated["variantId"] = current.get("variantId") or f"variant-{index + 1}"
        variants[index] = updated
        parent["skuVariants"] = deepcopy(variants)
        return {"success": True, "variant": deepcopy(updated)}
    if procedure == "selectionCenter.deleteEmbeddedChildSku":
        parent = next(row for row in products if int(row["id"]) == int(value["parentId"]))
        variants, index = locate_variant(parent, value)
        removed = variants.pop(index)
        parent["skuVariants"] = deepcopy(variants)
        return {"success": True, "removedVariantId": removed.get("variantId")}
    if procedure == "selectionCenter.updateEntityChildSku":
        child = next(row for row in products if int(row["id"]) == int(value["childId"]))
        if int(child["parentProductId"]) != int(value["expectedParentId"]):
            raise AssertionError("parent changed")
        data = value["data"]
        child.update({
            "productName": data.get("name"),
            "skuName": data.get("skuCode"),
            "barcode": data.get("barcode"),
            "price": data.get("price"),
            "historicalLowestPrice": data.get("lowestPrice"),
            "discountRate": data.get("discountRate"),
            "promotionType": data.get("promotionType"),
            "stock": data.get("stock"),
            "status": data.get("status"),
        })
        return {"success": True, "childId": child["id"]}
    if procedure == "selectionCenter.removeParentProduct":
        child = next(row for row in products if int(row["id"]) == int(value["childId"]))
        child["parentProductId"] = None
        return {"success": True, "childId": child["id"]}
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
        payloads = [trpc_result(mock_value(procedure) if route.request.method == "GET" else apply_mutation(procedure, value)) for procedure in procedures]
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payloads if len(payloads) > 1 else payloads[0], ensure_ascii=False))
    except Exception as error:
        route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"json": {"message": str(error), "code": -32600, "data": {"code": "BAD_REQUEST"}}}}, ensure_ascii=False))


def open_children(page):
    button = page.get_by_role("button", name="子SKU 3件を表示")
    if button.count() == 0:
        button = page.get_by_role("button", name="子SKU 2件を表示")
    button.first.click()
    page.locator('tr[data-child-sku-kind="embedded"]').first.wait_for(state="visible", timeout=10_000)


def child_dialog(page):
    dialog = page.get_by_role("dialog")
    dialog.get_by_text("子SKU修改 / 子SKU編集", exact=True).wait_for(state="visible", timeout=10_000)
    return dialog


def input_after_label(dialog, text):
    label = dialog.locator("label").filter(has_text=text).first
    return label.locator("xpath=following-sibling::input[1]")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    console_errors = []
    page_errors = []
    failed_requests = []
    context = browser.new_context(viewport={"width": 1720, "height": 1100})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'ja'); sessionStorage.setItem('sc_access', 'granted')")
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    page.route("**/api/trpc/**", route_handler)

    response = page.goto(f"{BASE_URL}/master/selection-center?tab=products", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("KYOGOKU 父商品SKU测试", exact=True).wait_for(state="visible", timeout=20_000)
    open_children(page)
    embedded_rows = page.locator('tr[data-child-sku-kind="embedded"]')
    entity_rows = page.locator('tr[data-child-sku-kind="entity"]')
    initial_counts = {"embedded": embedded_rows.count(), "entity": entity_rows.count()}
    initial_codes_visible = all(page.get_by_text(code, exact=False).count() > 0 for code in ["KG-SET-10", "KG-SET-20", "KG-KERATIN-MASK-5"])
    expanded_screenshot = OUTPUT_DIR / "child_sku_rows_expanded.png"
    page.screenshot(path=str(expanded_screenshot), full_page=True)

    embedded_rows.filter(has_text="10個セット").first.locator('button[title="子SKU编辑"]').click()
    dialog = child_dialog(page)
    input_after_label(dialog, "SKU名称").fill("10個セット 第1回修改")
    input_after_label(dialog, "SKU编号 / SKU番号").fill("KG-SET-10")
    input_after_label(dialog, "定价 / 定価 (¥)").fill("5100")
    input_after_label(dialog, "历史最低价 / 最低価 (¥)").fill("3400")
    input_after_label(dialog, "库存 / 在庫").fill("12")
    input_after_label(dialog, "促销 / 组合").fill("1+1")
    edit_dialog_screenshot = OUTPUT_DIR / "child_sku_edit_dialog.png"
    page.screenshot(path=str(edit_dialog_screenshot), full_page=True)
    dialog.get_by_role("button", name="保存 / 保存", exact=True).click()
    page.get_by_text("10個セット 第1回修改", exact=True).wait_for(state="visible", timeout=15_000)

    row = page.locator('tr[data-child-sku-kind="embedded"]').filter(has_text="10個セット 第1回修改").first
    row.locator('button[title="子SKU编辑"]').click()
    dialog = child_dialog(page)
    input_after_label(dialog, "SKU名称").fill("10個セット 第2回修改")
    input_after_label(dialog, "库存 / 在庫").fill("20")
    input_after_label(dialog, "促销 / 组合").fill("1+2")
    dialog.get_by_role("button", name="保存 / 保存", exact=True).click()
    page.get_by_text("10個セット 第2回修改", exact=True).wait_for(state="visible", timeout=15_000)

    row = page.locator('tr[data-child-sku-kind="embedded"]').filter(has_text="10個セット 第2回修改").first
    row.locator('button[title="子SKU编辑"]').click()
    dialog = child_dialog(page)
    input_after_label(dialog, "SKU名称").fill("10個セット 第3回修改")
    input_after_label(dialog, "SKU编号 / SKU番号").fill("KG-SET-10-V3")
    input_after_label(dialog, "库存 / 在庫").fill("28")
    input_after_label(dialog, "促销 / 组合").fill("1+4")
    dialog.get_by_role("button", name="保存 / 保存", exact=True).click()
    page.get_by_text("10個セット 第3回修改", exact=True).wait_for(state="visible", timeout=15_000)

    entity_row = page.locator('tr[data-child-sku-kind="entity"]').filter(has_text="5枚セット").first
    entity_row.locator('button[title="子SKU编辑"]').click()
    dialog = child_dialog(page)
    input_after_label(dialog, "SKU名称").fill("KYOGOKU ケラチンヘアマスクキャップ 5枚セット 更新")
    input_after_label(dialog, "SKU编号 / SKU番号").fill("KG-KERATIN-MASK-5-NEW")
    input_after_label(dialog, "条码 / バーコード").fill("4580000000999")
    input_after_label(dialog, "定价 / 定価 (¥)").fill("4300")
    input_after_label(dialog, "历史最低价 / 最低価 (¥)").fill("3500")
    input_after_label(dialog, "库存 / 在庫").fill("28")
    input_after_label(dialog, "促销 / 组合").fill("1+2")
    dialog.get_by_role("button", name="保存 / 保存", exact=True).click()
    page.get_by_text("KYOGOKU ケラチンヘアマスクキャップ 5枚セット 更新", exact=True).wait_for(state="visible", timeout=15_000)

    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("KYOGOKU 父商品SKU测试", exact=True).wait_for(state="visible", timeout=20_000)
    open_children(page)
    persisted_before_relogin = all(page.get_by_text(value, exact=False).count() > 0 for value in ["10個セット 第3回修改", "KG-SET-10-V3", "5枚セット 更新", "KG-KERATIN-MASK-5-NEW"])
    final_screenshot = OUTPUT_DIR / "child_sku_after_three_edits.png"
    page.screenshot(path=str(final_screenshot), full_page=True)
    context.close()

    relogin_context = browser.new_context(viewport={"width": 1720, "height": 1100})
    relogin_page = relogin_context.new_page()
    relogin_page.add_init_script("localStorage.setItem('language', 'ja'); sessionStorage.setItem('sc_access', 'granted')")
    relogin_page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    relogin_page.on("pageerror", lambda error: page_errors.append(str(error)))
    relogin_page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))
    relogin_page.route("**/api/trpc/**", route_handler)
    relogin_page.goto(f"{BASE_URL}/master/selection-center?tab=products", wait_until="domcontentloaded", timeout=45_000)
    relogin_page.get_by_text("KYOGOKU 父商品SKU测试", exact=True).wait_for(state="visible", timeout=20_000)
    open_children(relogin_page)
    persisted_after_relogin = all(relogin_page.get_by_text(value, exact=False).count() > 0 for value in ["10個セット 第3回修改", "KG-SET-10-V3", "5枚セット 更新", "KG-KERATIN-MASK-5-NEW"])
    relogin_screenshot = OUTPUT_DIR / "child_sku_after_relogin.png"
    relogin_page.screenshot(path=str(relogin_screenshot), full_page=True)
    parent_before_actions = next(row for row in products if row["id"] == 1)
    variants_before_actions = decode_variants(parent_before_actions)
    edited_variant_snapshot = deepcopy(variants_before_actions[0])
    untouched_sibling_snapshot = deepcopy(variants_before_actions[1])
    entity_snapshot = deepcopy(next(row for row in products if row["id"] == 130))

    relogin_page.once("dialog", lambda dialog_event: dialog_event.accept())
    relogin_page.locator('tr[data-child-sku-kind="embedded"]').filter(has_text="20個セット").first.locator('button[title="删除SKU"]').click()
    relogin_page.wait_for_function("document.querySelectorAll('tr[data-child-sku-kind=\"embedded\"]').length === 1")
    relogin_page.once("dialog", lambda dialog_event: dialog_event.accept())
    relogin_page.locator('tr[data-child-sku-kind="entity"]').first.locator('button[title="解除父级"]').click()
    relogin_page.wait_for_function("document.querySelectorAll('tr[data-child-sku-kind=\"entity\"]').length === 0")
    post_action_counts = {
        "embedded": relogin_page.locator('tr[data-child-sku-kind="embedded"]').count(),
        "entity": relogin_page.locator('tr[data-child-sku-kind="entity"]').count(),
    }

    embedded_mutations = [entry for entry in mutation_inputs if entry["procedure"] == "selectionCenter.updateEmbeddedChildSku"]
    entity_mutations = [entry for entry in mutation_inputs if entry["procedure"] == "selectionCenter.updateEntityChildSku"]
    delete_mutations = [entry for entry in mutation_inputs if entry["procedure"] == "selectionCenter.deleteEmbeddedChildSku"]
    unlink_mutations = [entry for entry in mutation_inputs if entry["procedure"] == "selectionCenter.removeParentProduct"]
    parent = next(row for row in products if row["id"] == 1)
    child = next(row for row in products if row["id"] == 130)
    variants_after_actions = decode_variants(parent)
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "initialCounts": initial_counts,
        "initialCodesVisible": initial_codes_visible,
        "embeddedUpdateCount": len(embedded_mutations),
        "entityUpdateCount": len(entity_mutations),
        "deleteMutationCount": len(delete_mutations),
        "unlinkMutationCount": len(unlink_mutations),
        "postActionCounts": post_action_counts,
        "embeddedAfterThreeEdits": edited_variant_snapshot,
        "untouchedEmbeddedSibling": untouched_sibling_snapshot,
        "entityAfterEdit": entity_snapshot,
        "variantsAfterDelete": variants_after_actions,
        "entityParentAfterUnlink": child.get("parentProductId"),
        "persistedBeforeRelogin": persisted_before_relogin,
        "persistedAfterRelogin": persisted_after_relogin,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "productionWrites": 0,
        "screenshots": [str(expanded_screenshot), str(edit_dialog_screenshot), str(final_screenshot), str(relogin_screenshot)],
    }
    report["passed"] = all([
        response is not None and response.ok,
        initial_counts == {"embedded": 2, "entity": 1},
        initial_codes_visible,
        len(embedded_mutations) == 3,
        len(entity_mutations) == 1,
        len(delete_mutations) == 1,
        len(unlink_mutations) == 1,
        post_action_counts == {"embedded": 1, "entity": 0},
        edited_variant_snapshot.get("variantId") == "variant-a",
        edited_variant_snapshot.get("name") == "10個セット 第3回修改",
        edited_variant_snapshot.get("skuCode") == "KG-SET-10-V3",
        edited_variant_snapshot.get("price") == "5100",
        edited_variant_snapshot.get("lowestPrice") == "3400",
        edited_variant_snapshot.get("stock") == 28,
        edited_variant_snapshot.get("promotionType") == "1+4",
        untouched_sibling_snapshot.get("name") == "20個セット" and untouched_sibling_snapshot.get("skuCode") == "KG-SET-20",
        len(variants_after_actions) == 1 and variants_after_actions[0].get("variantId") == "variant-a",
        entity_snapshot.get("productId") == "kg-child-sku:f690c0c490bf7ebb",
        entity_snapshot.get("parentProductId") == 1,
        entity_snapshot.get("skuName") == "KG-KERATIN-MASK-5-NEW",
        entity_snapshot.get("barcode") == "4580000000999",
        entity_snapshot.get("stock") == 28,
        child.get("parentProductId") is None,
        persisted_before_relogin,
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
