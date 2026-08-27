#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "server/_core/index.ts").read_text(encoding="utf-8")
ROUTER = (ROOT / "server/influencerBdRouter.ts").read_text(encoding="utf-8")
SCHEMA = (ROOT / "drizzle/schema.ts").read_text(encoding="utf-8")

checks = {
    "dedicated upload endpoint exists": '"/api/influencer-bd/chat-screenshot"' in INDEX,
    "upload requires authenticated user": "sdk.authenticateRequest(req)" in INDEX and "BD-AUTH-REQUIRED" in INDEX,
    "upload has isolated 10MB hard limit": "fileSize: 10 * 1024 * 1024" in INDEX,
    "oversize has stable 413 error": "LIMIT_FILE_SIZE" in INDEX and "BD-UPLOAD-SIZE" in INDEX and "res.status(413)" in INDEX,
    "missing outreach id is rejected": "BD-OUTREACH-ID" in INDEX,
    "missing file is rejected": "BD-UPLOAD-MISSING" in INDEX,
    "jpeg signature is verified": "buffer[0] === 0xff" in INDEX and 'mimeType: "image/jpeg"' in INDEX,
    "png signature is verified": "0x89,0x50,0x4e,0x47" in INDEX and 'mimeType: "image/png"' in INDEX,
    "webp signature is verified": 'toString("ascii") === "RIFF"' in INDEX and 'toString("ascii") === "WEBP"' in INDEX,
    "unsupported types return 415": "BD-UPLOAD-TYPE" in INDEX and "res.status(415)" in INDEX,
    "file bytes go to object storage": "await storagePut(key, buffer" in INDEX,
    "database stores metadata not file bytes": "storageKey" in SCHEMA and "fileUrl" in SCHEMA and "blob(" not in SCHEMA.lower(),
    "attachment has SHA-256": 'createHash("sha256")' in INDEX and "sha256" in SCHEMA,
    "storage key is scoped by outreach": "`influencer-bd/${outreachId}/${nanoid()}" in INDEX,
    "metadata save re-checks outreach access": "getOutreachForAccess(connection, input.outreachId, scope, true)" in ROUTER,
    "each outreach is capped at ten attachments": ">= 10" in ROUTER and "BD-UPLOAD-LIMIT" in ROUTER,
    "metadata save is transactional": "saveInfluencerBdAttachmentForUser" in ROUTER and "beginTransaction()" in ROUTER,
    "failed metadata save cleans stored object": "storageDelete(storedKey)" in INDEX,
    "attachment list excludes storage keys": "SELECT id,outreachId,creatorId,fileUrl,fileName,mimeType,fileSize,sha256,createdAt" in ROUTER,
    "attachment removal is soft archive": "archiveAttachment: protectedProcedure" in ROUTER and "UPDATE influencer_bd_attachments SET deletedAt=CURRENT_TIMESTAMP" in ROUTER,
    "attachment actions are audited": "attachment_uploaded" in ROUTER and "attachment_archived" in ROUTER,
    "legacy TiDB is not referenced": "tidbcloud.com" not in INDEX.lower() and "tidbcloud.com" not in ROUTER.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
if failed:
    raise SystemExit(f"{len(failed)} upload checks failed: {', '.join(failed)}")
print(f"PASS: {len(checks)} influencer BD upload checks")
