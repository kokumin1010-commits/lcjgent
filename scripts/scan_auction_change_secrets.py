from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "WORK_LOG.md",
    "client/src/pages/SelectionCenter.tsx",
    "server/auctionImport.test.ts",
    "server/auctionImportService.ts",
    "server/auctionRouter.ts",
    "auction_upload_edit_visual_regression.json",
    "auction_upload_edit_visual_regression.py",
    "docs/auction-upload-edit-spec.md",
    "docs/auction-visual-review.md",
    "scripts/verify_auction_upload_edit.py",
    "server/auctionImportService.test.ts",
    "server/auctionPermission.test.ts",
    "server/auctionRecordPersistence.test.ts",
    "server/auctionRecordPersistence.ts",
    "shared/auctionRecordPersistence.ts",
    "tsconfig.auction-upload-edit.json",
]

PATTERNS = {
    "mysql_url": re.compile(r"mysql://", re.IGNORECASE),
    "tidbcloud": re.compile(r"tidbcloud", re.IGNORECASE),
    "database_url_assignment": re.compile(r"DATABASE_URL\s*="),
    "bearer_token": re.compile(r"Authorization:\s*Bearer\s+\S+", re.IGNORECASE),
    "private_key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "secret_assignment": re.compile(r"\b(secret|token|api[_-]?key|cookie)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]", re.IGNORECASE),
}

failures: list[str] = []
for relative in FILES:
    path = ROOT / relative
    if not path.exists():
        failures.append(f"missing file listed for scan: {relative}")
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    for index, line in enumerate(text.splitlines(), start=1):
        for name, pattern in PATTERNS.items():
            if pattern.search(line):
                failures.append(f"{relative}:{index}: {name}")

if failures:
    print("secret scan failed")
    for item in failures:
        print(item)
    raise SystemExit(1)

print(f"secret scan passed: {len(FILES)} files")
