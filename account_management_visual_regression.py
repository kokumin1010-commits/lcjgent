#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4177").rstrip("/")
SOURCE = Path("/home/ubuntu/upload/pasted_file_06GgiQ_LCJ経営管理表_经营用账户.xlsx")
PREVIEW = json.loads((ROOT / "account_workbook_parser_preview.json").read_text(encoding="utf-8"))
OUTPUT_DIR = ROOT / "account_management_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "account_management_visual_regression.json"

ADMIN_USER = {
    "id": 1,
    "openId": "account-import-admin",
    "name": "Account Import Admin",
    "email": "account-import@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

SAMPLE_ACCOUNTS = [
    {
        "id": 101,
        "platform": "TikTok Shop",
        "accountName": "LABO CELLE TikTok Shop",
        "accountId": "masked@example.invalid",
        "password": "runtime-only-secret",
        "loginUrl": "https://seller-jp.tiktok.com/account/login",
        "email": "masked@example.invalid",
        "phone": None,
        "responsible": None,
        "status": "active",
        "expiresAt": None,
        "tags": ["Excel原本", "LCJ店铺"],
        "notes": "Excel原本行: 23",
        "passwordEncryptedAtRest": True,
        "passwordUnreadable": False,
        "createdAt": "2026-08-27T00:00:00.000Z",
        "updatedAt": "2026-08-27T00:00:00.000Z",
    },
    {
        "id": 102,
        "platform": "Alibaba Mail",
        "accountName": "LABO CELLE Email",
        "accountId": "masked@example.invalid",
        "password": "runtime-only-secret-2",
        "loginUrl": "https://qiye.aliyun.com",
        "email": "masked@example.invalid",
        "phone": None,
        "responsible": None,
        "status": "active",
        "expiresAt": None,
        "tags": ["Excel原本", "LCJ店铺"],
        "notes": "Excel原本行: 24",
        "passwordEncryptedAtRest": True,
        "passwordUnreadable": False,
        "createdAt": "2026-08-27T00:00:00.000Z",
        "updatedAt": "2026-08-27T00:00:00.000Z",
    },
]

REFERENCES = [
    {"id": idx + 1, "category": item["category"], "name": item["name"], "url": item["url"], "notes": None, "updatedAt": "2026-08-27T00:00:00.000Z"}
    for idx, item in enumerate(PREVIEW["references"])
]


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def mock_value(procedure):
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}:
        return {"isAdmin": True, "roleName": "admin", "permissions": None}
    if procedure == "account.listAccounts":
        return SAMPLE_ACCOUNTS
    if procedure == "account.getPlatforms":
        return ["Alibaba Mail", "TikTok Shop"]
    if procedure == "account.listContacts":
        return []
    if procedure == "account.listReferences":
        return REFERENCES
    if procedure == "account.listWorkbookImports":
        return []
    if procedure == "account.previewWorkbook":
        return PREVIEW
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(viewport={"width": 1500, "height": 1100})
    page = context.new_page()
    page.add_init_script("localStorage.setItem('language', 'zh')")
    console_errors, page_errors, failed_requests, procedures = [], [], [], []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def handle_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        path_part = parsed.path.split("/api/trpc/", 1)[-1]
        procedure_list = path_part.split(",")
        procedures.extend(procedure_list)
        if len(procedure_list) > 1:
            body = [trpc_result(mock_value(procedure)) for procedure in procedure_list]
        else:
            body = trpc_result(mock_value(procedure_list[0]))
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

    page.route("**/api/trpc/**", handle_route)
    response = page.goto(f"{BASE_URL}/master/account-management", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("登录凭据与联系人管理", exact=True).wait_for(state="visible", timeout=20_000)
    encrypted_badges = page.get_by_text("数据库已加密", exact=True).count()
    accounts_visible = page.get_by_text("LABO CELLE TikTok Shop", exact=True).is_visible() and page.get_by_text("LABO CELLE Email", exact=True).is_visible()

    page.get_by_role("button", name="导入Excel").click()
    page.locator("#account-workbook-file").set_input_files(str(SOURCE))
    page.get_by_role("button", name="确认内容").click()
    page.get_by_text("登录凭据", exact=True).wait_for(state="visible", timeout=20_000)
    preview_accounts_visible = page.get_by_text("22", exact=True).first.is_visible()
    masked_count = page.locator("text=/\\*\\*\\*/").count()
    preview_text = page.locator("[role='dialog']").inner_text()
    preview_does_not_show_mock_passwords = "runtime-only-secret" not in preview_text
    preview_screenshot = OUTPUT_DIR / "account_import_preview_zh.png"
    page.screenshot(path=str(preview_screenshot), full_page=True)
    page.get_by_role("button", name="取消").click()

    page.get_by_role("tab", name="参考链接").click()
    reference_table = page.get_by_role("table").last
    reference_table.get_by_role("cell", name="LCJ MALL", exact=True).wait_for(state="visible", timeout=10_000)
    references_visible = all(reference_table.get_by_text(name, exact=True).is_visible() for name in ["LCJ MALL", "オンラインMTG調整リンク", "LCJシステムユーザー管理", "Gemini"])
    reference_screenshot = OUTPUT_DIR / "account_references_zh.png"
    page.screenshot(path=str(reference_screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "finalUrl": page.url,
        "accountsVisible": accounts_visible,
        "encryptedBadgeCount": encrypted_badges,
        "previewAccountsCountVisible": preview_accounts_visible,
        "previewMaskedIdentifierCount": masked_count,
        "previewDoesNotShowAccountPasswords": preview_does_not_show_mock_passwords,
        "referencesVisible": references_visible,
        "importMutationCalls": sum(1 for item in procedures if item == "account.importWorkbook"),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "mockedProcedures": sorted(set(procedures)),
        "productionWrites": 0,
        "screenshots": [str(preview_screenshot), str(reference_screenshot)],
    }
    report["passed"] = all([
        response is not None and response.ok,
        accounts_visible,
        encrypted_badges == 2,
        preview_accounts_visible,
        masked_count >= 1,
        preview_does_not_show_mock_passwords,
        references_visible,
        report["importMutationCalls"] == 0,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
