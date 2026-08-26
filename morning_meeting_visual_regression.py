#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4175").rstrip("/")
OUTPUT_DIR = ROOT / "morning_meeting_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ADMIN_USER = {
    "id": 1,
    "openId": "visual-regression-admin",
    "name": "Visual Regression Admin",
    "email": "visual@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def mock_value(path):
    procedure = path.split("/api/trpc/", 1)[-1].split("?", 1)[0]
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "morningMeeting.getHistory":
        return {"meetings": [], "total": 0}
    if procedure == "morningMeeting.getTodayMeeting":
        return None
    if procedure == "morningMeeting.getTodayPersonalRecitations":
        return {
            "date": "2026-08-27",
            "completedCount": 1,
            "totalCount": 3,
            "ownRecord": None,
            "members": [
                {"staffId": 101, "userId": 201, "name": "柴芳妮", "position": "库存", "completed": True, "recitation": None},
                {"staffId": 102, "userId": None, "name": "测试成员A", "position": "运营", "completed": False, "recitation": None},
                {"staffId": 103, "userId": None, "name": "测试成员B", "position": "直播", "completed": False, "recitation": None},
            ],
        }
    if procedure == "morningMeeting.getStats":
        return {"totalMeetings": 0, "avgDuration": 0}
    if procedure == "morningMeeting.checkMissingRecording":
        return {"missing": False, "date": "2026-08-26"}
    if procedure in {"rbac.getMyPermissions", "auth.getMyPermissions"}:
        return {"permissions": ["*"]}
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
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
    response = page.goto(f"{BASE_URL}/master/morning-meeting", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("LCJ 9つの行動原則", exact=True).wait_for(state="visible", timeout=20_000)

    principle_list = page.locator("ol").filter(has=page.get_by_text("やると決めたら、100％やり切る。", exact=True))
    japanese_count = principle_list.locator(":scope > li").count()
    personal_button_ja = page.get_by_role("button", name="個人朗読を録音")
    team_button_ja = page.get_by_role("button", name="タップして録音開始")
    principles_title_ja = page.get_by_text("LCJ 9つの行動原則", exact=True)
    personal_box_ja = personal_button_ja.bounding_box()
    team_box_ja = team_button_ja.bounding_box()
    principles_box_ja = principles_title_ja.bounding_box()
    japanese_personal_visible = personal_button_ja.is_visible() and personal_button_ja.is_enabled()
    japanese_team_visible = team_button_ja.is_visible() and team_button_ja.is_enabled()
    recording_buttons_above_principles = bool(
        personal_box_ja and team_box_ja and principles_box_ja
        and personal_box_ja["y"] < principles_box_ja["y"]
        and team_box_ja["y"] < principles_box_ja["y"]
    )
    japanese_button_pressed = page.get_by_role("button", name="🇯🇵 日本語").first.get_attribute("aria-pressed") == "true"
    position_visible = page.get_by_text("库存", exact=True).is_visible()
    no_collapse_control = page.get_by_text("展开9条", exact=True).count() == 0 and page.get_by_text("9条を展開", exact=True).count() == 0
    japanese_screenshot = OUTPUT_DIR / "morning_meeting_ja.png"
    page.screenshot(path=str(japanese_screenshot), full_page=True)

    page.get_by_role("button", name="🇨🇳 中文").first.click()
    page.get_by_text("LCJ 9条铁律", exact=True).wait_for(state="visible", timeout=10_000)
    chinese_list = page.locator("ol").filter(has=page.get_by_text("做就做100%。做到过，就不许退步。", exact=True))
    chinese_count = chinese_list.locator(":scope > li").count()
    chinese_personal_visible = page.get_by_role("button", name="录制个人朗读").is_visible()
    chinese_team_visible = page.get_by_role("button", name="点击开始录音").is_visible()
    chinese_button_pressed = page.get_by_role("button", name="🇨🇳 中文").first.get_attribute("aria-pressed") == "true"
    japanese_principle_hidden = page.get_by_text("やると決めたら、100％やり切る。", exact=True).count() == 0
    chinese_screenshot = OUTPUT_DIR / "morning_meeting_zh.png"
    page.screenshot(path=str(chinese_screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "finalUrl": page.url,
        "japanese": {
            "principleCount": japanese_count,
            "personalRecordingVisibleAndEnabled": japanese_personal_visible,
            "teamRecordingVisibleAndEnabled": japanese_team_visible,
            "recordingButtonsAbovePrinciples": recording_buttons_above_principles,
            "positionVisibleBesideMember": position_visible,
            "noCollapseControl": no_collapse_control,
            "languageButtonPressed": japanese_button_pressed,
            "screenshot": str(japanese_screenshot),
        },
        "chinese": {
            "principleCount": chinese_count,
            "personalRecordingVisible": chinese_personal_visible,
            "teamRecordingVisible": chinese_team_visible,
            "languageButtonPressed": chinese_button_pressed,
            "japanesePrincipleHidden": japanese_principle_hidden,
            "screenshot": str(chinese_screenshot),
        },
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "mockedProcedures": sorted(set(mocked_procedures)),
    }
    report["passed"] = all([
        response is not None and response.ok,
        japanese_count == 9,
        japanese_personal_visible,
        japanese_team_visible,
        recording_buttons_above_principles,
        position_visible,
        no_collapse_control,
        japanese_button_pressed,
        chinese_count == 9,
        chinese_personal_visible,
        chinese_team_visible,
        chinese_button_pressed,
        japanese_principle_hidden,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    (ROOT / "morning_meeting_visual_regression.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
