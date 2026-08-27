#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AI = (ROOT / "server/influencerBdAi.ts").read_text(encoding="utf-8")
ROUTER = (ROOT / "server/influencerBdRouter.ts").read_text(encoding="utf-8")
UPGRADE = (ROOT / "server/influencerBdUpgrade.ts").read_text(encoding="utf-8")
SCHEMA = (ROOT / "drizzle/schema.ts").read_text(encoding="utf-8")
LLM_HELPER = (ROOT / "server/_core/llm.ts").read_text(encoding="utf-8")

checks = {
    "cost-aware multimodal model is explicit": 'INFLUENCER_BD_AI_MODEL = "gemini-3-flash-preview"' in AI,
    "prompt version is persisted": "INFLUENCER_BD_PROMPT_VERSION" in AI and "promptVersion" in ROUTER,
    "AI is server-side only": 'from "./_core/llm"' in AI and "invokeLLM" in AI,
    "AI uses strict JSON schema": "response_format" in AI and "strict: true" in AI,
    "all JSON objects reject extra properties": AI.count("additionalProperties: false") >= 10,
    "Gemini uses helper max_tokens path": "maxTokens:" not in AI and 'payload.max_tokens = 16384' in LLM_HELPER and 'resolvedModel.startsWith("gpt-")' in LLM_HELPER,
    "screenshots are limited to eight": "imageUrls.slice(0, 8)" in AI and "LIMIT 8" in ROUTER,
    "stored screenshot keys become signed URLs server-side": "storageGet(String(attachment.storageKey))" in ROUTER,
    "AI refuses empty evidence": "BD-AI-NO-EVIDENCE" in ROUTER,
    "ordinary staff cannot run team or campaign analysis": "BD-AI-SCOPE" in ROUTER and 'input.scopeType !== "personal"' in ROUTER,
    "campaign analysis requires campaign": "BD-AI-CAMPAIGN-REQUIRED" in ROUTER,
    "deterministic KPI is computed outside the model": "deterministicMetrics(outreachRows)" in ROUTER,
    "AI input excludes creator display name and handle": "creatorRef:" in ROUTER and "c.displayName" not in ROUTER[ROUTER.index("runAnalysis:"):ROUTER.index("listAnalyses:")],
    "AI input records truncation": "recordLimit: 500" in ROUTER and "truncated:" in ROUTER,
    "facts and assumptions are separated by prompt": "事实与假设必须分开" in AI,
    "fabrication is explicitly prohibited": "不得捏造达人回复" in AI and "证据不足" in AI,
    "analysis starts with durable processing record": "'processing'" in ROUTER and "analysis_started" in ROUTER,
    "analysis success is persisted": "analysis_succeeded" in ROUTER and "status='success'" in ROUTER,
    "analysis failure is persisted without deleting history": "analysis_failed" in ROUTER and "status='failed'" in ROUTER,
    "processing status exists in production upgrade": "ENUM('processing','success','failed')" in UPGRADE,
    "processing status exists in Drizzle schema": '["processing", "success", "failed"]' in SCHEMA,
    "analysis history is protected": "listAnalyses: protectedProcedure" in ROUTER and "analysisScopeSql" in ROUTER,
    "analysis detail is protected": "getAnalysis: protectedProcedure" in ROUTER and "getAnalysisForAccess" in ROUTER,
    "feedback is protected and audited": "createAnalysisFeedback: protectedProcedure" in ROUTER and "analysis_feedback_created" in ROUTER,
    "prior feedback is included as learning context": "priorFeedback:" in ROUTER and "implementedActions" in ROUTER,
    "failed AI does not overwrite old successful rows": "WHERE id=? AND status='processing'" in ROUTER,
    "stable AI error codes are exposed": all(code in ROUTER + AI for code in ["BD-AI-EMPTY", "BD-AI-INVALID-JSON", "BD-AI-FAILED"]),
    "legacy TiDB is not referenced": "tidbcloud.com" not in AI.lower() and "tidbcloud.com" not in ROUTER.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
if failed:
    raise SystemExit(f"{len(failed)} AI checks failed: {', '.join(failed)}")
print(f"PASS: {len(checks)} influencer BD AI checks")
