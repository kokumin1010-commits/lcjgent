#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4175").rstrip("/")
OUTPUT_DIR = ROOT / "morning_recording_no_limit_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ADMIN = {
    "id": 1, "openId": "morning-no-limit-admin", "name": "管理员",
    "email": "admin@example.invalid", "role": "admin", "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z", "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

state = {"personal_exists": True, "team_exists": True}
mutations = []


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def member(staff_id, name, country, principles=None, attended=False):
    return {
        "targetKey": f"staff:{staff_id}", "staffId": staff_id, "userId": 1 if staff_id == 101 else None,
        "name": name, "email": f"staff-{staff_id}@example.invalid", "position": "运营",
        "country": country, "teamCode": "china" if country == "中国" else "japan",
        "principles": principles, "principlesCompleted": bool(principles), "principlesInvalidReason": None,
        "attendedTeamMeeting": attended, "allCompleted": bool(principles and attended),
    }


def personal_record():
    if not state["personal_exists"]:
        return None
    return {
        "id": 501, "dailyKey": "2026-08-27:staff:101:principles", "targetKey": "staff:101",
        "userId": 1, "staffId": 101, "staffName": "管理员", "staffPosition": "运营",
        "language": "zh", "durationSeconds": 52, "status": "completed", "canDelete": True,
        "isValid": True, "invalidReason": None, "startedAt": "2026-08-27T01:34:00.000Z",
        "createdAt": "2026-08-27T01:34:52.000Z",
    }


def team_record():
    if not state["team_exists"]:
        return None
    return {
        "id": 1, "date": "2026-08-27", "teamCode": "china", "inferredFromLegacy": True,
        "durationSeconds": 280, "status": "completed", "isValid": True, "invalidReason": None,
        "canDelete": True, "createdBy": 1, "createdByName": "管理员", "participantCount": 2,
        "participantSnapshot": [
            {"targetKey": "staff:101", "staffId": 101, "name": "管理员", "position": "运营"},
            {"targetKey": "staff:102", "staffId": 102, "name": "中国成员", "position": "商务"},
        ],
        "startedAt": "2026-08-27T02:15:22.000Z", "createdAt": "2026-08-27T02:20:02.000Z",
        "summary": {"overview": "早会完成", "participants": [], "actionItems": []},
        "transcript": "团队早会内容",
    }


def history_type(url):
    try:
        raw = parse_qs(urlparse(url).query).get("input", [""])[0]
        return json.loads(unquote(raw)).get("json", {}).get("type", "principles")
    except Exception:
        return "principles"


def query_value(url):
    procedure = urlparse(url).path.split("/api/trpc/", 1)[-1]
    if procedure == "auth.me":
        return ADMIN
    if procedure == "morningMeeting.getTodayDailyRecordings":
        personal = personal_record()
        team = team_record()
        current = member(101, "管理员", "中国", personal, bool(team))
        second = member(102, "中国成员", "中国", None, bool(team))
        return {
            "date": "2026-08-27", "canSelectStaff": True,
            "canHostTeamMeeting": False, "availableTeamCodes": ["china", "japan"],
            "currentTeamCode": "china", "currentStaff": current,
            "teamMeetings": {"china": team, "japan": None},
            "participantOptionsByTeam": {
                "china": [
                    {"staffId": 101, "name": "管理员", "position": "运营", "selected": True},
                    {"staffId": 102, "name": "中国成员", "position": "商务", "selected": True},
                ],
                "japan": [],
            },
            "teamMeeting": team, "meetingParticipantOptions": [],
            "completedBothCount": 1 if personal else 0, "totalCount": 2,
            "members": [current, second],
        }
    if procedure == "morningMeeting.getSeparatedHistory":
        kind = history_type(url)
        if kind == "principles" and state["personal_exists"]:
            return {"type": kind, "records": [{
                "id": 501, "date": "2026-08-27", "name": "管理员", "position": "运营",
                "durationSeconds": 52, "status": "completed", "audioSource": "daily",
                "canDelete": True, "isValid": True, "invalidReason": None,
                "createdAt": "2026-08-27T01:34:52.000Z",
            }], "total": 1}
        if kind == "team" and state["team_exists"]:
            record = dict(team_record())
            record.update({"audioSource": "meeting", "name": "管理员"})
            return {"type": kind, "records": [record], "total": 1}
        return {"type": kind, "records": [], "total": 0}
    if procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}:
        return {"permissions": None, "isAdmin": True, "roleName": "super-admin"}
    return None


def mutation_input(request):
    try:
        payload = request.post_data_json
        if isinstance(payload, dict) and "json" in payload:
            return payload["json"]
        if isinstance(payload, dict) and "0" in payload:
            return payload["0"].get("json", {})
        return payload or {}
    except Exception:
        return {}


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1500, "height": 1100})
    console_errors, page_errors, failed_requests = [], [], []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def route_handler(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        procedure = parsed.path.split("/api/trpc/", 1)[-1]
        if procedure == "morningMeeting.deleteRecording":
            body = mutation_input(route.request)
            mutations.append(body)
            if body.get("source") == "daily" and body.get("id") == 501:
                state["personal_exists"] = False
            if body.get("source") == "meeting" and body.get("id") == 1:
                state["team_exists"] = False
            route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result({"success": True, **body}), ensure_ascii=False))
            return
        route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result(query_value(route.request.url)), ensure_ascii=False))

    page.route("**/api/trpc/**", route_handler)
    response = page.goto(f"{BASE_URL}/master/morning-meeting", wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("本日の個人朗読は完了しました", exact=True).wait_for(state="visible", timeout=20_000)

    short_recording_completed = page.get_by_text("00:52", exact=True).count() >= 1
    legacy_china_completed = page.get_by_text("中国チーム", exact=False).count() >= 1 and page.get_by_text("04:40", exact=False).count() >= 1
    no_limit_text = all(page.get_by_text(text, exact=False).count() == 0 for text in ["最低有効", "時間不足", "60秒以上"])
    delete_buttons = page.get_by_role("button", name="削除して再録音")
    personal_delete = delete_buttons.first
    personal_delete_visible = personal_delete.is_visible()
    team_delete_visible = delete_buttons.count() >= 2

    before_path = OUTPUT_DIR / "morning_no_limit_completed_and_delete.png"
    page.screenshot(path=str(before_path), full_page=True)

    page.once("dialog", lambda dialog: dialog.accept())
    personal_delete.first.click()
    page.get_by_role("button", name="個人朗読を録音").wait_for(state="visible", timeout=10_000)
    deleted_after_refetch = page.get_by_text("本日の個人朗読は完了しました", exact=True).count() == 0
    delete_payload_ok = len(mutations) == 1 and mutations[0].get("source") == "daily" and mutations[0].get("id") == 501

    page.reload(wait_until="domcontentloaded")
    page.get_by_role("button", name="個人朗読を録音").wait_for(state="visible", timeout=10_000)
    deleted_after_reload = page.get_by_text("本日の個人朗読は完了しました", exact=True).count() == 0
    team_still_present = page.get_by_text("04:40", exact=False).count() >= 1

    after_path = OUTPUT_DIR / "morning_personal_deleted_after_reload.png"
    page.screenshot(path=str(after_path), full_page=True)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "short52SecondsCompleted": short_recording_completed,
        "legacyChina280SecondsCompleted": legacy_china_completed,
        "durationLimitTextAbsent": no_limit_text,
        "personalDeleteVisible": personal_delete_visible,
        "teamDeleteVisible": team_delete_visible,
        "deletePayload": mutations,
        "deletedAfterRefetch": deleted_after_refetch,
        "deletedAfterReload": deleted_after_reload,
        "teamRecordUnaffected": team_still_present,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "screenshots": [str(before_path), str(after_path)],
    }
    report["passed"] = all([
        response is not None and response.ok,
        short_recording_completed,
        legacy_china_completed,
        no_limit_text,
        personal_delete_visible,
        team_delete_visible,
        delete_payload_ok,
        deleted_after_refetch,
        deleted_after_reload,
        team_still_present,
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    (ROOT / "morning_recording_no_limit_delete_visual.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
