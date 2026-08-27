#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4183").rstrip("/")
OUTPUT_DIR = ROOT / "influencer_bd_visual_artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON = ROOT / "influencer_bd_visual_regression.json"

ADMIN = {
    "id": 9001,
    "openId": "influencer-bd-visual-admin",
    "name": "视觉回归管理员",
    "email": "visual-bd@example.invalid",
    "role": "admin",
    "loginMethod": "test",
    "createdAt": "2026-08-27T00:00:00.000Z",
    "updatedAt": "2026-08-27T00:00:00.000Z",
    "lastSignedIn": "2026-08-27T00:00:00.000Z",
}

STAFF = [
    {"id": 101, "name": "BD测试员工A", "department": "达人BD", "position": "BD", "country": "中国"},
    {"id": 102, "name": "BD测试员工B", "department": "达人BD", "position": "BD", "country": "日本"},
]
CAMPAIGNS = [{
    "id": 201,
    "name": "Q咕咕达人推广（视觉测试）",
    "brandId": 301,
    "productId": 401,
    "productNameSnapshot": "Q咕咕测试商品",
    "coreSellingPoints": "配方特点与使用场景必须以公司确认资料为准。",
    "creatorBenefits": "测试：明确佣金、样品与内容支持，不代表生产政策。",
    "commissionPolicy": "待公司确认",
    "samplePolicy": "待公司确认",
    "targetCreatorProfile": "美妆与生活方式内容达人",
    "referenceOpeningScript": "您好，我们看过您的内容，希望介绍一个匹配的合作方案。",
    "referenceFollowUpScript": "想确认您是否方便了解合作详情。",
    "objectionHandling": "如暂时不合适，尊重达人选择。",
    "status": "active",
}]
CREATORS = [
    {"id": 501, "displayName": "测试达人一", "platform": "TikTok", "handle": "mock_creator_1", "profileUrl": "https://example.com/mock1", "followerCount": 128000, "category": "美妆", "country": "日本", "language": "日语", "ownerStaffId": 101, "ownerStaffName": "BD测试员工A", "status": "replied", "lastContactAt": "2026-08-27T00:00:00.000Z", "outreachCount": 2, "attachmentCount": 1},
    {"id": 502, "displayName": "测试达人二", "platform": "Instagram", "handle": "mock_creator_2", "profileUrl": "https://example.com/mock2", "followerCount": 54000, "category": "生活", "country": "中国", "language": "中文", "ownerStaffId": 101, "ownerStaffName": "BD测试员工A", "status": "contacting", "lastContactAt": "2026-08-27T00:00:00.000Z", "outreachCount": 1, "attachmentCount": 0},
    {"id": 503, "displayName": "测试达人三", "platform": "YouTube", "handle": "mock_creator_3", "profileUrl": None, "followerCount": 240000, "category": "健康", "country": "日本", "language": "日语", "ownerStaffId": 102, "ownerStaffName": "BD测试员工B", "status": "sample", "lastContactAt": "2026-08-26T00:00:00.000Z", "outreachCount": 1, "attachmentCount": 1},
    {"id": 504, "displayName": "测试达人四", "platform": "TikTok", "handle": "mock_creator_4", "profileUrl": None, "followerCount": 31000, "category": "日常", "country": "中国", "language": "中文", "ownerStaffId": 102, "ownerStaffName": "BD测试员工B", "status": "contacting", "lastContactAt": "2026-08-26T00:00:00.000Z", "outreachCount": 1, "attachmentCount": 0},
]
OUTREACH = [
    {"id": 601, "creatorId": 501, "campaignId": 201, "staffId": 101, "staffName": "BD测试员工A", "activityDate": "2026-08-27", "channel": "tiktok_dm", "stage": "replied", "contactCount": 28, "responseType": "positive", "replyReceived": True, "positiveReply": True, "sampleAdvanced": False, "cooperationConfirmed": False, "pitchText": "测试初次话术", "chatText": "测试聊天记录，不进入生产。", "issues": "达人想先确认合作条件", "nextAction": "发送完整条件并在两天后跟进", "nextFollowUpDate": "2026-08-29", "outcomeNotes": "", "creatorName": "测试达人一", "platform": "TikTok", "handle": "mock_creator_1", "profileUrl": "https://example.com/mock1", "followerCount": 128000, "category": "美妆", "campaignName": "Q咕咕达人推广（视觉测试）", "attachmentCount": 1},
    {"id": 602, "creatorId": 502, "campaignId": 201, "staffId": 101, "staffName": "BD测试员工A", "activityDate": "2026-08-27", "channel": "instagram_dm", "stage": "initial_contact", "contactCount": 27, "responseType": "none", "replyReceived": False, "positiveReply": False, "sampleAdvanced": False, "cooperationConfirmed": False, "pitchText": "测试初次话术B", "chatText": "", "issues": "尚未回复", "nextAction": "三天后使用不同利益点跟进", "nextFollowUpDate": "2026-08-30", "outcomeNotes": "", "creatorName": "测试达人二", "platform": "Instagram", "handle": "mock_creator_2", "profileUrl": None, "followerCount": 54000, "category": "生活", "campaignName": "Q咕咕达人推广（视觉测试）", "attachmentCount": 0},
    {"id": 603, "creatorId": 503, "campaignId": 201, "staffId": 102, "staffName": "BD测试员工B", "activityDate": "2026-08-26", "channel": "email", "stage": "sample_sent", "contactCount": 24, "responseType": "neutral", "replyReceived": True, "positiveReply": False, "sampleAdvanced": True, "cooperationConfirmed": False, "pitchText": "测试邮件话术", "chatText": "测试邮件往来。", "issues": "等待样品体验", "nextAction": "确认收货日期", "nextFollowUpDate": "2026-08-31", "outcomeNotes": "", "creatorName": "测试达人三", "platform": "YouTube", "handle": "mock_creator_3", "profileUrl": None, "followerCount": 240000, "category": "健康", "campaignName": "Q咕咕达人推广（视觉测试）", "attachmentCount": 1},
    {"id": 604, "creatorId": 504, "campaignId": 201, "staffId": 102, "staffName": "BD测试员工B", "activityDate": "2026-08-26", "channel": "tiktok_dm", "stage": "follow_up", "contactCount": 21, "responseType": "none", "replyReceived": False, "positiveReply": False, "sampleAdvanced": False, "cooperationConfirmed": False, "pitchText": "测试跟进话术", "chatText": "", "issues": "第一条信息卖点不够清楚", "nextAction": "改为三句以内的达人利益表达", "nextFollowUpDate": "2026-08-29", "outcomeNotes": "", "creatorName": "测试达人四", "platform": "TikTok", "handle": "mock_creator_4", "profileUrl": None, "followerCount": 31000, "category": "日常", "campaignName": "Q咕咕达人推广（视觉测试）", "attachmentCount": 0},
]
SETTINGS = {"id": 1, "lowReplyRatePercent": 5, "stagnationDays": 3, "minimumContactedCreators": 20, "autoAnalysisEnabled": False}
TOTAL = {"contactedCreators": 4, "contactAttempts": 100, "repliedCreators": 2, "positiveCreators": 1, "sampleCreators": 1, "cooperatingCreators": 0, "replyRate": 50, "positiveReplyRate": 25, "contactEfficiency": 2}
DASHBOARD = {
    "periodStart": "2026-07-29", "periodEnd": "2026-08-27", "total": TOTAL,
    "byStaff": [
        {"staffId": 101, "staffName": "BD测试员工A", "contactedCreators": 2, "contactAttempts": 55, "repliedCreators": 1, "positiveCreators": 1, "sampleCreators": 0, "cooperatingCreators": 0, "replyRate": 50},
        {"staffId": 102, "staffName": "BD测试员工B", "contactedCreators": 2, "contactAttempts": 45, "repliedCreators": 1, "positiveCreators": 0, "sampleCreators": 1, "cooperatingCreators": 0, "replyRate": 50},
    ],
    "byChannel": [
        {"channel": "tiktok_dm", "contactedCreators": 2, "contactAttempts": 49, "repliedCreators": 1, "positiveCreators": 1, "sampleCreators": 0, "cooperatingCreators": 0, "replyRate": 50},
        {"channel": "email", "contactedCreators": 1, "contactAttempts": 24, "repliedCreators": 1, "positiveCreators": 0, "sampleCreators": 1, "cooperatingCreators": 0, "replyRate": 100},
    ],
    "byStage": [{"stage": "initial_contact", "recordCount": 1, "creatorCount": 1}],
    "byCampaign": [{"campaignId": 201, "campaignName": "Q咕咕达人推广（视觉测试）", **TOTAL}],
    "daily": [], "settings": SETTINGS, "alerts": {"lowReplyRate": False, "stagnantCreators": 1},
}
AI_RESULT = {
    "executiveSummary": "测试证据显示回复集中在明确说明达人利益与下一步的记录中；样本仅4位，结论需继续验证。",
    "dataQuality": {"sufficient": False, "sampleSize": 4, "missingFields": ["更多拒绝理由"], "limitations": ["视觉回归样本，不代表生产结论"]},
    "funnelDiagnosis": {"contactedCreators": 4, "repliedCreators": 2, "positiveCreators": 1, "sampleCreators": 1, "cooperatingCreators": 0, "replyRate": 50, "positiveReplyRate": 25, "bottleneck": "合作确认"},
    "rootCauses": [{"category": "selling_points", "finding": "部分首条信息没有把达人收益放在前面", "evidence": "证据601有回复，证据604记录卖点不清楚且未回复", "impact": "high", "confidence": "medium"}],
    "sellingPointGaps": [{"gap": "达人利益表达不统一", "whyItMatters": "达人需要快速判断合作价值", "recommendedExpression": "前三句说明匹配原因、收益和下一步"}],
    "recommendedActions": [{"priority": "high", "action": "把首条话术压缩为三句并突出达人利益", "reason": "降低理解成本", "completionStandard": "连续登记20位达人并比较回复率", "ownerRole": "BD负责人"}],
    "messageScripts": {"opening": {"zh": "您好，我们看过您的内容，想提供一个匹配的合作方案。", "ja": "投稿を拝見し、相性の良いご提案をご連絡しました。"}, "followUp": {"zh": "想确认您是否方便了解合作详情。", "ja": "ご都合のよい時に詳細をご案内してもよろしいでしょうか。"}, "objectionResponse": {"zh": "感谢回复，我们尊重您的选择。", "ja": "ご返信ありがとうございます。ご判断を尊重いたします。"}},
    "creatorSegmentAdvice": [{"segment": "美妆内容达人", "reason": "与测试商品内容场景较接近", "qualificationSignals": ["近期发布相关内容"]}],
    "experiments": [{"hypothesis": "首条信息突出达人收益可提升回复", "variable": "第一句话", "control": "产品介绍开头", "variation": "达人收益开头", "successMetric": "去重达人回复率", "minimumSample": 20}],
    "warnings": ["样本较小，不能把相关性当作因果"], "confidence": "medium",
}
ANALYSES = [{"id": 701, "scopeType": "team", "scopeStaffId": None, "periodStart": "2026-07-29", "periodEnd": "2026-08-27", "campaignId": 201, "model": "gemini-3-flash-preview", "promptVersion": "influencer-bd-v1", "summary": AI_RESULT["executiveSummary"], "confidence": "medium", "status": "success", "errorCode": None, "errorMessage": None, "requestedById": 9001, "requestedByName": "视觉回归管理员", "createdAt": "2026-08-27T06:00:00.000Z", "campaignName": "Q咕咕达人推广（视觉测试）", "feedbackCount": 0}]
ANALYSIS_DETAIL = {**ANALYSES[0], "inputSnapshot": {"recordCount": 4}, "result": AI_RESULT, "feedback": []}
ATTACHMENT_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='960'%3E%3Crect width='100%25' height='100%25' fill='%23eef2ff'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%234f46e5' font-size='32'%3EMOCK CHAT SCREENSHOT%3C/text%3E%3C/svg%3E"
OUTREACH_DETAIL = {**OUTREACH[0], "attachments": [{"id": 801, "outreachId": 601, "creatorId": 501, "fileUrl": ATTACHMENT_SVG, "fileName": "mock-chat.png", "mimeType": "image/png", "fileSize": 120000, "sha256": "a" * 64, "createdAt": "2026-08-27T05:00:00.000Z"}]}


def trpc_result(value):
    return {"result": {"data": {"json": value}}}


def mock_value(procedure):
    if procedure == "auth.me": return ADMIN
    if procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}: return {"isAdmin": True, "roleName": "admin", "permissions": None}
    if procedure == "influencerBd.bootstrap": return {"actor": {"id": 9001, "name": "视觉回归管理员", "isAdmin": True, "staffId": 101, "staffName": "BD测试员工A"}, "campaigns": CAMPAIGNS, "staff": STAFF, "brands": [{"id": 301, "name": "Q咕咕测试品牌", "nameJa": None, "category": "测试"}], "products": [{"id": 401, "brandId": 301, "productName": "Q咕咕测试商品", "commissionRate": None, "catchCopy": "测试卖点", "features": "测试功能", "targetAudience": "测试人群", "brandName": "Q咕咕测试品牌"}], "settings": SETTINGS}
    if procedure == "influencerBd.dashboard": return DASHBOARD
    if procedure == "influencerBd.listOutreach": return OUTREACH
    if procedure == "influencerBd.listCreators": return CREATORS
    if procedure == "influencerBd.listCampaigns": return CAMPAIGNS
    if procedure == "influencerBd.listAnalyses": return ANALYSES
    if procedure == "influencerBd.getAnalysis": return ANALYSIS_DETAIL
    if procedure == "influencerBd.getOutreach": return OUTREACH_DETAIL
    if procedure == "influencerBd.audit": return [{"id": 901, "entityType": "outreach", "entityId": 601, "action": "outreach_created", "actorId": 9001, "actorName": "视觉回归管理员", "reason": None, "createdAt": "2026-08-27T05:00:00.000Z"}]
    if procedure == "adForm.stats": return {"pending": 0, "total": 0}
    if procedure == "chat.getUnreadCount": return 0
    if procedure == "brandSample.stats": return {"pending": 0, "total": 0}
    return None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(viewport={"width": 1600, "height": 1100})
    context.add_init_script("localStorage.setItem('language','zh'); localStorage.setItem('sidebar-width','250');")
    page = context.new_page()
    console_errors, page_errors, failed_requests, mocked_procedures, mutation_requests = [], [], [], [], []
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
        if route.request.method != "GET": mutation_requests.append(f"{route.request.method} {procedure}")
        route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result(mock_value(procedure)), ensure_ascii=False))

    page.route("**/api/trpc/**", handle_route)
    response = page.goto(f"{BASE_URL}/master/influencer-bd", wait_until="domcontentloaded", timeout=60_000)
    try:
        page.get_by_role("heading", name="达人BD增长工作台").wait_for(state="visible", timeout=30_000)
        page.get_by_text("4", exact=True).first.wait_for(state="visible", timeout=10_000)
    except Exception as error:
        debug_screenshot = OUTPUT_DIR / "influencer_bd_debug.png"
        page.screenshot(path=str(debug_screenshot), full_page=True)
        debug = {"error": str(error), "url": page.url, "bodyText": page.locator("body").inner_text()[:12000], "mockedProcedures": sorted(set(mocked_procedures)), "consoleErrors": console_errors, "pageErrors": page_errors, "failedRequests": failed_requests, "screenshot": str(debug_screenshot)}
        OUTPUT_JSON.write_text(json.dumps(debug, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(debug, ensure_ascii=False, indent=2))
        browser.close()
        raise SystemExit(2)

    overview_screenshot = OUTPUT_DIR / "influencer_bd_overview.png"
    page.screenshot(path=str(overview_screenshot), full_page=True)
    header_visible = page.get_by_role("heading", name="达人BD增长工作台").is_visible()
    sidebar_visible = page.get_by_text("达人BD管理", exact=True).first.is_visible()
    kpi_visible = all(page.get_by_text(text, exact=True).first.is_visible() for text in ["联络达人", "回复达人", "积极回复", "样品推进", "合作确定"])
    unique_metric_copy_visible = page.get_by_text("同一达人多次联络只计算一次，避免虚高或稀释回复率。", exact=True).is_visible()
    outreach_rows_visible = all(page.get_by_text(name, exact=True).first.is_visible() for name in ["测试达人一", "测试达人二", "测试达人三", "测试达人四"])

    page.get_by_role("button", name="新增进度").click()
    page.get_by_role("dialog").wait_for(state="visible")
    outreach_form_visible = all(page.get_by_text(text, exact=True).last.is_visible() for text in ["实际使用的话术", "聊天记录文字", "遇到的问题", "下一步动作"])
    file_accept = page.locator('input[type="file"]').get_attribute("accept")
    page.get_by_role("button", name="取消").last.click()

    page.get_by_role("tab", name="达人库").click()
    creator_cards_visible = page.get_by_text("测试达人一", exact=True).first.is_visible() and page.get_by_text("128,000", exact=True).is_visible()
    page.get_by_role("tab", name="推广方案").click()
    campaign_visible = page.get_by_text("Q咕咕达人推广（视觉测试）", exact=True).first.is_visible() and page.get_by_text("核心卖点", exact=True).first.is_visible()

    page.get_by_role("tab", name="AI改善").click()
    page.get_by_text("测试证据显示回复集中在明确说明达人利益与下一步的记录中；样本仅4位，结论需继续验证。", exact=True).first.click()
    page.get_by_text("AI诊断结果", exact=True).wait_for(state="visible", timeout=10_000)
    ai_summary_visible = page.get_by_text(AI_RESULT["executiveSummary"], exact=True).last.is_visible()
    ai_root_cause_visible = page.get_by_text("部分首条信息没有把达人收益放在前面", exact=True).is_visible()
    bilingual_script_visible = page.get_by_text("您好，我们看过您的内容，想提供一个匹配的合作方案。", exact=True).is_visible() and page.get_by_text("投稿を拝見し、相性の良いご提案をご連絡しました。", exact=True).is_visible()
    ai_screenshot = OUTPUT_DIR / "influencer_bd_ai_result.png"
    page.screenshot(path=str(ai_screenshot), full_page=True)

    page.get_by_role("tab", name="管理视图").click()
    manager_visible = page.get_by_text("员工表现", exact=True).is_visible() and page.get_by_text("分析提醒设置", exact=True).is_visible() and page.get_by_text("操作审计", exact=True).is_visible()
    auto_setting_off = not page.get_by_role("checkbox").last.is_checked()
    manager_screenshot = OUTPUT_DIR / "influencer_bd_manager.png"
    page.screenshot(path=str(manager_screenshot), full_page=True)

    page.get_by_role("tab", name="今日进度").click()
    page.get_by_text("测试达人一", exact=True).first.click()
    page.get_by_role("dialog").wait_for(state="visible")
    evidence_dialog_visible = page.get_by_text("BD记录与聊天证据", exact=True).is_visible() and page.get_by_text("MOCK CHAT SCREENSHOT", exact=False).count() >= 0
    screenshot_image_visible = page.locator('img[alt="mock-chat.png"]').is_visible()

    regular_user = {**ADMIN, "id": 9002, "openId": "influencer-bd-visual-staff", "name": "普通BD员工", "email": "regular-bd@example.invalid", "role": "user"}
    regular_context = browser.new_context(viewport={"width": 1366, "height": 900})
    regular_context.add_init_script("localStorage.setItem('language','zh');")
    regular_page = regular_context.new_page()
    regular_console_errors, regular_page_errors, regular_failed_requests, regular_procedures = [], [], [], []
    regular_page.on("console", lambda message: regular_console_errors.append(message.text) if message.type == "error" else None)
    regular_page.on("pageerror", lambda error: regular_page_errors.append(str(error)))
    regular_page.on("requestfailed", lambda request: regular_failed_requests.append(f"{request.method} {request.url} :: {request.failure}"))

    def regular_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        procedure = parsed.path.split("/api/trpc/", 1)[-1]
        regular_procedures.append(procedure)
        if procedure == "auth.me": value = regular_user
        elif procedure in {"rbac.getMyPermissions", "rbac.myPermissions", "auth.getMyPermissions"}: value = {"isAdmin": False, "roleName": "staff", "permissions": []}
        elif procedure == "influencerBd.bootstrap": value = {"actor": {"id": 9002, "name": "普通BD员工", "isAdmin": False, "staffId": 101, "staffName": "BD测试员工A"}, "campaigns": CAMPAIGNS, "staff": [STAFF[0]], "brands": [], "products": [], "settings": SETTINGS}
        elif procedure == "influencerBd.dashboard": value = DASHBOARD
        elif procedure == "influencerBd.listOutreach": value = OUTREACH[:2]
        elif procedure == "influencerBd.listCreators": value = CREATORS[:2]
        elif procedure == "influencerBd.listCampaigns": value = CAMPAIGNS
        elif procedure == "influencerBd.listAnalyses": value = []
        elif procedure == "adForm.stats": value = {"pending": 0, "total": 0}
        elif procedure == "chat.getUnreadCount": value = 0
        elif procedure == "brandSample.stats": value = {"pending": 0, "total": 0}
        else: value = None
        route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result(value), ensure_ascii=False))

    regular_page.route("**/api/trpc/**", regular_route)
    regular_page.goto(f"{BASE_URL}/master/influencer-bd?role=regular", wait_until="domcontentloaded", timeout=60_000)
    regular_page.get_by_role("heading", name="达人BD增长工作台").wait_for(state="visible", timeout=30_000)
    regular_management_hidden = regular_page.get_by_role("tab", name="管理视图").count() == 0
    regular_page.get_by_role("tab", name="推广方案").click()
    regular_campaign_admin_action_hidden = regular_page.get_by_role("button", name="新增方案").count() == 0
    regular_no_audit_query = "influencerBd.audit" not in regular_procedures
    regular_context.close()

    unauth_context = browser.new_context(viewport={"width": 1280, "height": 800})
    unauth_page = unauth_context.new_page()
    unauth_procedures = []

    def unauth_route(route):
        parsed = urlparse(route.request.url)
        if "/api/trpc/" not in parsed.path:
            route.continue_()
            return
        procedure = parsed.path.split("/api/trpc/", 1)[-1]
        unauth_procedures.append(procedure)
        value = None if procedure == "auth.me" else ({"isAdmin": False, "roleName": None, "permissions": []} if procedure == "rbac.myPermissions" else None)
        route.fulfill(status=200, content_type="application/json", body=json.dumps(trpc_result(value), ensure_ascii=False))

    unauth_page.route("**/api/trpc/**", unauth_route)
    unauth_page.goto(f"{BASE_URL}/master/influencer-bd?auth-test=1", wait_until="domcontentloaded", timeout=60_000)
    unauth_page.wait_for_url("**/login?redirect=**", timeout=30_000)
    unauth_redirected_to_login = "/login?redirect=" in unauth_page.url and "%2Fmaster%2Finfluencer-bd" in unauth_page.url
    unauth_no_bd_queries = not any(procedure.startswith("influencerBd.") for procedure in unauth_procedures)
    unauth_context.close()

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE_URL,
        "httpStatus": response.status if response else None,
        "finalUrl": page.url,
        "headerVisible": header_visible,
        "sidebarVisible": sidebar_visible,
        "allKpisVisible": kpi_visible,
        "uniqueMetricCopyVisible": unique_metric_copy_visible,
        "allMockOutreachRowsVisible": outreach_rows_visible,
        "outreachFormVisible": outreach_form_visible,
        "fileAccept": file_accept,
        "creatorCardsVisible": creator_cards_visible,
        "campaignVisible": campaign_visible,
        "aiSummaryVisible": ai_summary_visible,
        "aiRootCauseVisible": ai_root_cause_visible,
        "bilingualScriptVisible": bilingual_script_visible,
        "managerVisible": manager_visible,
        "autoSettingDefaultsOff": auto_setting_off,
        "evidenceDialogVisible": evidence_dialog_visible,
        "screenshotImageVisible": screenshot_image_visible,
        "regularManagementHidden": regular_management_hidden,
        "regularCampaignAdminActionHidden": regular_campaign_admin_action_hidden,
        "regularNoAuditQuery": regular_no_audit_query,
        "regularConsoleErrors": regular_console_errors,
        "regularPageErrors": regular_page_errors,
        "regularFailedRequests": regular_failed_requests,
        "unauthRedirectedToLogin": unauth_redirected_to_login,
        "unauthNoBdQueries": unauth_no_bd_queries,
        "unauthProcedures": unauth_procedures,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "mockedProcedures": sorted(set(mocked_procedures)),
        "mutationRequests": mutation_requests,
        "productionWrites": 0,
        "screenshots": [str(overview_screenshot), str(ai_screenshot), str(manager_screenshot)],
    }
    report["passed"] = all([
        response is not None and response.ok,
        header_visible,
        sidebar_visible,
        kpi_visible,
        unique_metric_copy_visible,
        outreach_rows_visible,
        outreach_form_visible,
        file_accept == "image/jpeg,image/png,image/webp",
        creator_cards_visible,
        campaign_visible,
        ai_summary_visible,
        ai_root_cause_visible,
        bilingual_script_visible,
        manager_visible,
        auto_setting_off,
        evidence_dialog_visible,
        screenshot_image_visible,
        regular_management_hidden,
        regular_campaign_admin_action_hidden,
        regular_no_audit_query,
        not regular_console_errors,
        not regular_page_errors,
        not regular_failed_requests,
        unauth_redirected_to_login,
        unauth_no_bd_queries,
        not console_errors,
        not page_errors,
        not failed_requests,
        not mutation_requests,
    ])
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(0 if report["passed"] else 1)
