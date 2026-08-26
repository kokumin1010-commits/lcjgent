#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("BASE_URL", "https://lcjmall.com").rstrip("/")
RUN_NAME = "production" if BASE_URL == "https://lcjmall.com" else "local"
OUTPUT_DIR = ROOT / "liver_mypage_audit" / f"{RUN_NAME}_browser_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

routes = [
    "/liver/mypage",
    "/liver/profile",
    "/liver/record",
    "/liver/schedule",
    "/livers/by-name/security-regression",
]
results = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    for route in routes:
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        console_errors = []
        page_errors = []
        failed_requests = []
        page.on("console", lambda message, target=console_errors: target.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error, target=page_errors: target.append(str(error)))
        page.on(
            "requestfailed",
            lambda request, target=failed_requests: target.append(
                f"{request.method} {request.url} :: {request.failure or 'unknown'}"
            ),
        )

        response = page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=45_000)
        page.wait_for_timeout(4_000)
        final_url = page.url
        title = page.title()
        body_text = page.locator("body").inner_text().strip()
        root_html_length = page.locator("#root").evaluate("element => element.innerHTML.length") if page.locator("#root").count() else 0
        login_visible = any(token.lower() in body_text.lower() for token in ["ログイン", "login", "メールアドレス", "パスワード"])
        redirected_to_login = "/liver/login" in final_url
        screenshot_name = route.lstrip("/").replace("/", "_").replace(":", "_") or "root"
        screenshot_path = OUTPUT_DIR / f"{screenshot_name}.png"
        page.screenshot(path=str(screenshot_path), full_page=True)
        analytics_errors = [
            item for item in [*console_errors, *failed_requests]
            if "%VITE_ANALYTICS" in item or "/umami" in item
        ]
        unexpected_console_errors = console_errors if RUN_NAME == "production" else [
            item for item in console_errors if "Unexpected token '<'" not in item
        ]
        passed = bool(
            response
            and response.ok
            and root_html_length > 0
            and login_visible
            and not analytics_errors
            and not unexpected_console_errors
            and not page_errors
        )
        results.append(
            {
                "route": route,
                "httpStatus": response.status if response else None,
                "finalUrl": final_url,
                "title": title,
                "rootHtmlLength": root_html_length,
                "bodyTextPreview": body_text[:300],
                "loginVisible": login_visible,
                "redirectedToLogin": redirected_to_login,
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "failedRequests": failed_requests,
                "analyticsErrors": analytics_errors,
                "unexpectedConsoleErrors": unexpected_console_errors,
                "screenshotPath": str(screenshot_path),
                "passed": passed,
            }
        )
        page.close()
    browser.close()

failed = [item["route"] for item in results if not item["passed"]]
report = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "baseUrl": BASE_URL,
    "checked": len(results),
    "passed": len(results) - len(failed),
    "failed": failed,
    "results": results,
}
report_path = ROOT / "liver_mypage_audit" / f"{RUN_NAME}_browser_regression.json"
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if failed else 0)
