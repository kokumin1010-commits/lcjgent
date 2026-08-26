#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4175").rstrip("/")
OUTPUT_DIR = ROOT / "morning_meeting_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ADMIN_USER = {
    "id": 1, "openId": "visual-regression-admin", "name": "京極琉",
    "email": "visual@example.invalid", "role": "admin", "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z", "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def member(target_key, staff_id, name, position):
    return {
        "targetKey": target_key, "staffId": staff_id, "userId": None, "name": name,
        "email": f"staff-{staff_id}@example.invalid", "position": position,
        "principles": None, "principlesCompleted": False,
        "attendedTeamMeeting": False, "allCompleted": False,
    }


CURRENT_MEMBER = member("staff:101", 101, "京極琉", "CEO")
MEMBERS = [CURRENT_MEMBER, member("staff:102", 102, "柴芳妮", "库存"), member("staff:103", 103, "测试成员A", "运营")]
PARTICIPANT_OPTIONS = [{"staffId": item["staffId"], "name": item["name"], "position": item["position"], "selected": True} for item in MEMBERS]


def history_type_from_url(url):
    try:
        query = parse_qs(urlparse(url).query)
        raw = query.get("input", [""])[0]
        payload = json.loads(unquote(raw))
        return payload.get("json", {}).get("type", "principles")
    except Exception:
        return "principles"


def mock_value(url):
    parsed = urlparse(url)
    procedure = parsed.path.split("/api/trpc/", 1)[-1]
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "morningMeeting.getSeparatedHistory":
        history_type = history_type_from_url(url)
        if history_type == "principles":
            return {
                "type": "principles",
                "records": [{
                    "id": 501, "date": "2026-08-27", "name": "京極琉", "fallbackName": "京極琉",
                    "position": "CEO", "language": "zh", "durationSeconds": 63, "status": "completed",
                    "operatorUserName": "京極琉", "createdAt": "2026-08-27T08:23:00.000Z", "audioSource": "daily",
                }],
                "total": 1,
            }
        return {"type": history_type, "records": [], "total": 0}
    if procedure == "morningMeeting.getTodayDailyRecordings":
        return {
            "date": "2026-08-27", "canSelectStaff": True, "canHostTeamMeeting": True,
            "currentStaff": CURRENT_MEMBER, "teamMeeting": None,
            "meetingParticipantOptions": PARTICIPANT_OPTIONS,
            "completedBothCount": 0, "totalCount": len(MEMBERS), "members": MEMBERS,
        }
    if procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}:
        return {"permissions": None, "isAdmin": True, "roleName": "super-admin"}
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page(viewport={"width": 1440, "height": 1200})
    console_errors, page_errors, failed_requests, mocked_procedures = [], [], [], []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def handle_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        mocked_procedures.append(parsed.path.split("/api/trpc/", 1)[-1])
        route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result(mock_value(route.request.url)), ensure_ascii=False))

    page.route("**/api/trpc/**", handle_route)
    response = page.goto(f"{BASE_URL}/master/morning-meeting", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("LCJ 9つの行動原則", exact=True).wait_for(state="visible", timeout=20_000)

    current_staff = page.locator('[data-testid="current-morning-staff"]')
    initial_staff_visible = current_staff.get_by_text("京極琉", exact=True).is_visible()
    staff_hint_visible = page.get_by_text("氏名をタップして対象者を選択", exact=True).is_visible()
    step_labels_absent = page.get_by_text("STEP 1", exact=False).count() == 0 and page.get_by_text("STEP 2", exact=False).count() == 0
    final_titles_ja = page.get_by_text("9条朗読録音｜全員必須", exact=True).is_visible() and page.get_by_text("チーム朝会｜1日1回", exact=True).is_visible()

    personal_button = page.get_by_role("button", name="個人朗読を録音")
    meeting_button = page.get_by_role("button", name="タップして録音開始")
    principles_title = page.get_by_text("LCJ 9つの行動原則", exact=True)
    personal_box, meeting_box, principles_box = personal_button.bounding_box(), meeting_button.bounding_box(), principles_title.bounding_box()
    buttons_enabled = personal_button.is_enabled() and meeting_button.is_enabled()
    buttons_above_principles = bool(personal_box and meeting_box and principles_box and personal_box["y"] < principles_box["y"] and meeting_box["y"] < principles_box["y"])

    participant_heading_visible = page.get_by_text("朝会参加者を選択", exact=True).is_visible()
    participant_count_visible = page.get_by_text("参加予定: 3名", exact=True).is_visible()
    participant_buttons = page.get_by_role("button", name="柴芳妮", exact=False)
    participant_buttons_count = participant_buttons.count()
    participant_pressed_before = any(participant_buttons.nth(i).get_attribute("aria-pressed") == "true" for i in range(participant_buttons_count))

    page.get_by_role("button", name="柴芳妮", exact=False).first.click()
    selected_staff_visible = current_staff.get_by_text("柴芳妮", exact=True).is_visible()
    selected_position_visible = current_staff.get_by_text("库存", exact=True).is_visible()

    principles_history_tab = page.get_by_role("tab", name="9条朗読記録")
    team_history_tab = page.get_by_role("tab", name="チーム朝会記録")
    legacy_history_tab = page.get_by_role("tab", name="旧朝会記録")
    three_history_tabs_visible = all(tab.is_visible() for tab in [principles_history_tab, team_history_tab, legacy_history_tab])
    personal_history_visible = page.get_by_text("01:03", exact=True).is_visible() and page.get_by_text("京極琉", exact=True).count() >= 2
    team_history_tab.click()
    team_tab_selected = team_history_tab.get_attribute("aria-selected") == "true"
    empty_team_history_visible = page.get_by_text("まだ記録がありません", exact=True).is_visible()
    principles_history_tab.click()

    principle_list = page.locator("ol").filter(has=page.get_by_text("やると決めたら、100％やり切る。", exact=True))
    japanese_count = principle_list.locator(":scope > li").count()
    no_collapse = page.get_by_text("9条を展開", exact=True).count() == 0 and page.get_by_text("展开9条", exact=True).count() == 0
    ja_screenshot = OUTPUT_DIR / "morning_meeting_ja.png"
    page.screenshot(path=str(ja_screenshot), full_page=True)

    page.get_by_role("button", name="🇨🇳 中文").first.click()
    page.get_by_text("LCJ 9条铁律", exact=True).wait_for(state="visible", timeout=10_000)
    chinese_count = page.locator("ol").filter(has=page.get_by_text("做就做100%。做到过，就不许退步。", exact=True)).locator(":scope > li").count()
    final_titles_zh = page.get_by_text("9条朗读录音｜全员必做", exact=True).is_visible() and page.get_by_text("团队早会｜每天一次", exact=True).is_visible()
    history_tabs_zh = all(page.get_by_role("tab", name=label).is_visible() for label in ["9条朗读记录", "团队早会记录", "旧早会记录"])
    participant_heading_zh = page.get_by_text("选择早会参加者", exact=True).is_visible()
    zh_screenshot = OUTPUT_DIR / "morning_meeting_zh.png"
    page.screenshot(path=str(zh_screenshot), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(), "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None, "finalUrl": page.url,
        "identityAndSelection": {"initialLoggedInStaffVisible": initial_staff_visible, "staffSelectorHintVisible": staff_hint_visible, "selectedStaffVisibleTopLeft": selected_staff_visible, "selectedPositionVisibleTopLeft": selected_position_visible},
        "teamMeeting": {"oneMeetingTitleVisible": final_titles_ja, "participantHeadingVisible": participant_heading_visible, "participantCountVisible": participant_count_visible, "participantNameButtons": participant_buttons_count, "participantsDefaultSelected": participant_pressed_before, "recordingButtonEnabled": buttons_enabled},
        "history": {"threeTabsVisible": three_history_tabs_visible, "personal0103Visible": personal_history_visible, "teamTabSelected": team_tab_selected, "teamHistorySeparatedEmpty": empty_team_history_visible, "chineseTabsVisible": history_tabs_zh},
        "japanese": {"principleCount": japanese_count, "stepLabelsAbsent": step_labels_absent, "recordingButtonsEnabled": buttons_enabled, "recordingButtonsAbovePrinciples": buttons_above_principles, "noCollapseControl": no_collapse, "screenshot": str(ja_screenshot)},
        "chinese": {"principleCount": chinese_count, "finalTitlesVisible": final_titles_zh, "participantHeadingVisible": participant_heading_zh, "screenshot": str(zh_screenshot)},
        "consoleErrors": console_errors, "pageErrors": page_errors, "failedRequests": failed_requests,
        "mockedProcedures": sorted(set(mocked_procedures)),
    }
    report["passed"] = all([
        response is not None and response.ok, initial_staff_visible, staff_hint_visible, selected_staff_visible,
        selected_position_visible, step_labels_absent, final_titles_ja, japanese_count == 9, buttons_enabled,
        buttons_above_principles, no_collapse, participant_heading_visible, participant_count_visible,
        participant_buttons_count >= 2, participant_pressed_before, three_history_tabs_visible, personal_history_visible,
        team_tab_selected, empty_team_history_visible, chinese_count == 9, final_titles_zh, history_tabs_zh,
        participant_heading_zh, not console_errors, not page_errors, not failed_requests,
    ])
    (ROOT / "morning_meeting_visual_regression.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
