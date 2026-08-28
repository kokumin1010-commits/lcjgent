#!/usr/bin/env python3

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "WORK_LOG.md",
    "client/src/pages/SelectionCenter.tsx",
    "shared/selectionProductPersistence.ts",
    "server/selectionCenterRouter.ts",
    "server/selectionProductPersistence.ts",
    "server/selectionProductPersistence.test.ts",
    "server/selectionChildSkuPersistence.ts",
    "server/selectionChildSkuPersistence.test.ts",
    "server/selectionChildSkuPermission.test.ts",
    "selection_product_sku_visual_regression.py",
    "child_sku_visual_regression.py",
    "docs/child-sku-audit-findings.md",
    "docs/child-sku-display-edit-spec.md",
    "docs/child-sku-visual-review.md",
]
PATTERNS = {
    "database URL": re.compile(r"(?:mysql|postgres(?:ql)?):\/\/[^\s)`]+", re.I),
    "TiDB hostname": re.compile(r"[A-Za-z0-9.-]*tidbcloud\.com", re.I),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "bearer token": re.compile(r"Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{16,}", re.I),
    "cookie value": re.compile(r"(?:^|\s)(?:Cookie|Set-Cookie)\s*:\s*[^\n]{12,}", re.I | re.M),
    "literal password": re.compile(r"(?:password|passwd|pwd)\s*[:=]\s*[\"'][^\"']{4,}[\"']", re.I),
}

findings: list[str] = []
for relative in FILES:
    path = ROOT / relative
    if not path.exists():
        findings.append(f"missing file: {relative}")
        continue
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", relative],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0
    if tracked:
        diff = subprocess.run(
            ["git", "diff", "--unified=0", "--", relative],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        content = "\n".join(
            line[1:] for line in diff.splitlines()
            if line.startswith("+") and not line.startswith("+++")
        )
    else:
        content = path.read_text(encoding="utf-8", errors="replace")
    for label, pattern in PATTERNS.items():
        if pattern.search(content):
            findings.append(f"{relative}: {label}")

if findings:
    for finding in findings:
        print(f"[FAIL] {finding}", file=sys.stderr)
    raise SystemExit(1)

print(f"[PASS] scanned {len(FILES)} parent/child SKU files; no credential material found")
