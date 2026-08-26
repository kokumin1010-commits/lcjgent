#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "https://lcjmall.com").rstrip("/")
OUTPUT_PATH = ROOT / "morning_meeting_microphone_browser_regression.json"

ADMIN_USER = {
    "id": 1,
    "openId": "microphone-regression-admin",
    "name": "京極琉",
    "email": "microphone@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

CURRENT_MEMBER = {
    "targetKey": "staff:101",
    "staffId": 101,
    "userId": 1,
    "name": "京極琉",
    "email": ADMIN_USER["email"],
    "position": "CEO",
    "principles": None,
    "morningMeeting": None,
    "principlesCompleted": False,
    "morningMeetingCompleted": False,
    "allCompleted": False,
}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def mock_value(procedure):
    if procedure == "auth.me":
        return ADMIN_USER
    if procedure == "morningMeeting.getHistory":
        return {"meetings": [], "total": 0}
    if procedure == "morningMeeting.getTodayDailyRecordings":
        return {
            "date": "2026-08-27",
            "canSelectStaff": True,
            "currentStaff": CURRENT_MEMBER,
            "completedBothCount": 0,
            "totalCount": 1,
            "members": [CURRENT_MEMBER],
        }
    if procedure == "morningMeeting.savePersonalRecitation":
        return {"success": True, "id": 9001, "date": "2026-08-27", "targetKey": "staff:101", "userName": "京極琉"}
    if procedure == "morningMeeting.savePersonalMorningMeeting":
        return {"success": True, "id": 9002, "date": "2026-08-27", "targetKey": "staff:101", "userName": "京極琉", "transcript": "", "summary": {}}
    if procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}:
        return {"permissions": None, "isAdmin": True, "roleName": "super-admin"}
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
        ],
    )
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.grant_permissions(["microphone"], origin=BASE_URL)
    page = context.new_page()
    console_errors = []
    page_errors = []
    failed_requests = []
    mocked_mutations = []

    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def handle_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        procedure = parsed.path.split("/api/trpc/", 1)[-1]
        if route.request.method == "POST":
            mocked_mutations.append(procedure)
        route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result(mock_value(procedure)), ensure_ascii=False))

    page.route("**/api/trpc/**", handle_route)
    response = page.goto(f"{BASE_URL}/master/morning-meeting", wait_until="domcontentloaded", timeout=45_000)
    page.wait_for_timeout(5_000)
    if page.get_by_text("9条朗読録音｜全員必須", exact=True).count() == 0:
        diagnostic = {
            "url": page.url,
            "body": page.locator("body").inner_text()[:5000],
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "failedRequests": failed_requests,
            "mockedMutations": mocked_mutations,
        }
        (ROOT / "morning_meeting_microphone_diagnostic.json").write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        page.screenshot(path=str(ROOT / "morning_meeting_microphone_diagnostic.png"), full_page=True)
        print(json.dumps(diagnostic, ensure_ascii=False, indent=2))
    page.get_by_text("9条朗読録音｜全員必須", exact=True).wait_for(state="visible", timeout=20_000)
    page.locator('[data-testid="current-morning-staff"]').get_by_text("京極琉", exact=True).wait_for(state="visible", timeout=20_000)
    page.wait_for_function("""() => {
      const button = document.querySelector('button[aria-label="個人朗読を録音"]');
      return Boolean(button && !button.disabled);
    }""", timeout=20_000)
    header = (response.headers.get("permissions-policy") if response else "") or ""

    microphone_probe = page.evaluate("""async () => {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const trackCount = stream.getAudioTracks().length;
        stream.getTracks().forEach(track => track.stop());
        return { success: true, permission: permission.state, trackCount };
      } catch (error) {
        return { success: false, error: String(error?.name || error) + ': ' + String(error?.message || '') };
      }
    }""")

    page.locator('button[aria-label="個人朗読を録音"]').click()
    personal_stop = page.locator('button').filter(has_text="朗読を終了して登録")
    personal_stop.wait_for(state="visible", timeout=10_000)
    personal_stop_disabled_before_three = personal_stop.is_disabled()
    personal_minimum_hint_visible = page.get_by_text("3秒以上録音してください", exact=True).is_visible()
    page.wait_for_timeout(3_300)
    personal_stop_enabled_after_three = personal_stop.is_enabled()
    personal_stop.click()
    page.wait_for_timeout(1_000)

    page.wait_for_function("""() => {
      const button = document.querySelector('button[aria-label="タップして録音開始"]');
      return Boolean(button && !button.disabled);
    }""", timeout=20_000)
    page.locator('button[aria-label="タップして録音開始"]').click()
    meeting_stop = page.locator('button').filter(has_text="録音停止・処理開始")
    meeting_stop.wait_for(state="visible", timeout=10_000)
    meeting_stop_disabled_before_three = meeting_stop.is_disabled()
    meeting_minimum_hint_visible = page.get_by_text("3秒以上録音してください", exact=True).is_visible()
    page.wait_for_timeout(3_300)
    meeting_stop_enabled_after_three = meeting_stop.is_enabled()
    meeting_stop.click()
    page.wait_for_timeout(1_000)

    body_text = page.locator("body").inner_text()
    raw_zod_json_visible = '"code":"too_small"' in body_text or '"path":["durationSeconds"]' in body_text
    expected_mutations = {
        "morningMeeting.savePersonalRecitation",
        "morningMeeting.savePersonalMorningMeeting",
    }

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "permissionsPolicy": header,
        "microphoneSelfAllowed": "microphone=(self)" in header if BASE_URL.startswith("https://lcjmall.com") else True,
        "browserMicrophoneProbe": microphone_probe,
        "personalRecording": {
            "stopDisabledBeforeThreeSeconds": personal_stop_disabled_before_three,
            "minimumHintVisible": personal_minimum_hint_visible,
            "stopEnabledAfterThreeSeconds": personal_stop_enabled_after_three,
        },
        "meetingRecording": {
            "stopDisabledBeforeThreeSeconds": meeting_stop_disabled_before_three,
            "minimumHintVisible": meeting_minimum_hint_visible,
            "stopEnabledAfterThreeSeconds": meeting_stop_enabled_after_three,
        },
        "rawZodJsonVisible": raw_zod_json_visible,
        "allTrpcRequestsMocked": True,
        "productionWrites": 0,
        "mockedMutations": sorted(set(mocked_mutations)),
        "expectedMutationsObserved": expected_mutations.issubset(set(mocked_mutations)),
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
    }
    report["passed"] = all([
        response is not None and response.ok,
        report["microphoneSelfAllowed"],
        microphone_probe.get("success") is True,
        microphone_probe.get("trackCount", 0) > 0,
        personal_stop_disabled_before_three,
        personal_minimum_hint_visible,
        personal_stop_enabled_after_three,
        meeting_stop_disabled_before_three,
        meeting_minimum_hint_visible,
        meeting_stop_enabled_after_three,
        not raw_zod_json_visible,
        report["expectedMutationsObserved"],
        not console_errors,
        not page_errors,
        not failed_requests,
    ])
    OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
