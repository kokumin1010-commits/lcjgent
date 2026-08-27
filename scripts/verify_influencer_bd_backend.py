#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTER = (ROOT / "server/influencerBdRouter.ts").read_text(encoding="utf-8")
APP = (ROOT / "server/routers.ts").read_text(encoding="utf-8")

checks = {
    "router registered": 'influencerBd: influencerBdRouter' in APP,
    "all feature endpoints require authentication": "publicProcedure" not in ROUTER and ROUTER.count("protectedProcedure") >= 8,
    "admin-only campaign mutation": "saveCampaign: adminProcedure" in ROUTER and "archiveCampaign: adminProcedure" in ROUTER,
    "admin-only destructive operations": "archiveCreator: adminProcedure" in ROUTER and "archiveOutreach: adminProcedure" in ROUTER,
    "admin-only settings and audit": "updateSettings: adminProcedure" in ROUTER and "audit: adminProcedure" in ROUTER,
    "actor derived from authentication context": "ctx?.user?.id" in ROUTER and "ctx?.user?.email" in ROUTER,
    "staff identity resolved by authenticated email": "LOWER(email)=?" in ROUTER and "resolveScope(ctx" in ROUTER,
    "regular creator access follows current assignment": "ownerStaffId=? OR" in ROUTER and "ownerStaffId IS NULL" in ROUTER,
    "regular outreach access follows current assignment": "staffId=? OR" in ROUTER and "staffId IS NULL" in ROUTER,
    "regular creator owner cannot be impersonated": "const ownerStaffId = scope.isAdmin ?" in ROUTER and ": scope.staffId" in ROUTER,
    "regular outreach owner cannot be impersonated": "const staffId = scope.isAdmin ?" in ROUTER and ": scope.staffId" in ROUTER,
    "writes use transactions": ROUTER.count("beginTransaction()") >= 7 and ROUTER.count("rollback()") >= 7,
    "writes record immutable audit events": ROUTER.count("writeAudit(connection") >= 7,
    "archive operations are soft delete": ROUTER.count("deletedAt=CURRENT_TIMESTAMP") >= 3,
    "creator duplicate detection has stable error code": "BD-CREATOR-DUPLICATE" in ROUTER,
    "date range validation has stable error code": "BD-DATE-RANGE" in ROUTER,
    "response consistency has stable error code": "BD-RESPONSE-INCONSISTENT" in ROUTER,
    "KPI contacted creators are deduplicated": "COUNT(DISTINCT o.creatorId) AS contactedCreators" in ROUTER,
    "KPI replied creators are deduplicated": "COUNT(DISTINCT CASE WHEN o.replyReceived=1 THEN o.creatorId END)" in ROUTER,
    "zero denominator returns null": "denominator > 0" in ROUTER and ": null" in ROUTER,
    "audit redacts chat and contact text": '["chatText", "contactInfo"]' in ROUTER,
    "audit redacts stored object references": '["fileUrl", "storageKey"]' in ROUTER,
    "legacy TiDB is not referenced": "tidbcloud.com" not in ROUTER.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
if failed:
    raise SystemExit(f"{len(failed)} backend checks failed: {', '.join(failed)}")
print(f"PASS: {len(checks)} influencer BD backend checks")
