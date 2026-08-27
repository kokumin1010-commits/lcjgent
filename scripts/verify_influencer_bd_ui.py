#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "client/src/pages/InfluencerBd.tsx").read_text(encoding="utf-8")
APP = (ROOT / "client/src/App.tsx").read_text(encoding="utf-8")
LAYOUT = (ROOT / "client/src/components/DashboardLayout.tsx").read_text(encoding="utf-8")

checks = {
    "lazy page is registered": 'lazy(() => import("./pages/InfluencerBd"))' in APP,
    "page is protected by DashboardLayout": '<Route path="/master/influencer-bd">' in APP and '<DashboardLayout>\n            <InfluencerBd />' in APP,
    "sidebar entry exists": 'label: "达人BD管理", path: "/master/influencer-bd"' in LAYOUT,
    "date range filters exist": 'setPeriodStart' in PAGE and 'setPeriodEnd' in PAGE and 'type="date"' in PAGE,
    "admin staff filter exists": "isAdmin && staffFilter" in PAGE,
    "campaign filter exists": "campaignFilter" in PAGE,
    "unique creator KPI is explained": "同一达人多次联络只计算一次" in PAGE,
    "funnel includes all five stages": all(text in PAGE for text in ["已联络达人", "有回复", "积极回复", "样品推进", "合作确定"]),
    "today workspace exists": '<TabsTrigger value="today">' in PAGE,
    "creator database exists": '<TabsTrigger value="creators">' in PAGE,
    "campaign workspace exists": '<TabsTrigger value="campaigns">' in PAGE,
    "AI improvement workspace exists": '<TabsTrigger value="ai">' in PAGE,
    "manager workspace is admin-only": 'isAdmin && <TabsTrigger value="management">' in PAGE and 'isAdmin && <TabsContent value="management"' in PAGE,
    "empty states do not create fake data": "不会自动生成演示数据" in PAGE and "不会填充虚假达人" in PAGE,
    "outreach form captures actual pitch": "实际使用的话术" in PAGE and "pitchText" in PAGE,
    "outreach form captures chat text": "聊天记录文字" in PAGE and "chatText" in PAGE,
    "outreach form captures issues and next action": "遇到的问题" in PAGE and "下一步动作" in PAGE,
    "outreach form captures response outcomes": all(field in PAGE for field in ["replyReceived", "positiveReply", "sampleAdvanced", "cooperationConfirmed"]),
    "screenshots use dedicated authenticated endpoint": 'fetch("/api/influencer-bd/chat-screenshot"' in PAGE and 'credentials: "include"' in PAGE,
    "screenshots restrict accepted file types": 'accept="image/jpeg,image/png,image/webp"' in PAGE,
    "screenshot detail view exists": "BD记录与聊天证据" in PAGE and "attachment.fileUrl" in PAGE,
    "campaign form captures selling points and benefits": "coreSellingPoints" in PAGE and "creatorBenefits" in PAGE,
    "campaign mutation controls are admin-only": "isAdmin && <Button onClick={() => openCampaign()}" in PAGE,
    "AI runs only on explicit click": "onClick={startAnalysis}" in PAGE and "setInterval" not in PAGE,
    "AI input range uses current filters": "periodStart,\n        periodEnd" in PAGE and "campaignId: campaignFilter" in PAGE,
    "AI history and feedback are rendered": "分析历史" in PAGE and "createAnalysisFeedback" in PAGE,
    "AI failure state is rendered": "currentAnalysis?.errorCode" in PAGE and "currentAnalysis?.errorMessage" in PAGE,
    "settings state clarifies auto mode is inactive": "当前不会自动消耗积分" in PAGE,
    "audit view is admin-only": "audit.useQuery" in PAGE and "enabled: isAdmin" in PAGE,
    "legacy TiDB is not referenced": "tidbcloud.com" not in PAGE.lower() and "tidbcloud.com" not in APP.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
if failed:
    raise SystemExit(f"{len(failed)} UI checks failed: {', '.join(failed)}")
print(f"PASS: {len(checks)} influencer BD UI checks")
