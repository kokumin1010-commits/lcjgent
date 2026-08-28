#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
tracked_diff = subprocess.run(
    ["git", "diff", "--unified=0", "--", "WORK_LOG.md", "client/src/pages/LiverSelfRecord.tsx", "server/liverRouter.ts", "server/routers.ts"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout
added_lines = "\n".join(line[1:] for line in tracked_diff.splitlines() if line.startswith("+") and not line.startswith("+++"))
new_files = [
    "client/src/components/LiverAdEffectPanel.tsx",
    "docs/liver-ad-effect-audit-findings.md",
    "docs/liver-ad-effect-spec.md",
    "docs/liver-ad-effect-visual-review.md",
    "liver_ad_effect_visual_regression.json",
    "liver_ad_effect_visual_regression.py",
    "scripts/verify_liver_ad_effect.py",
    "server/liverAdEffect.test.ts",
    "server/liverAdEffect.ts",
    "server/liverAdEffectPermission.test.ts",
    "server/liverAdEffectShared.test.ts",
    "shared/liverAdEffect.ts",
    "tsconfig.liver-ad-effect.json",
]
new_text = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in new_files)
payload = added_lines + "\n" + new_text
patterns = {
    "database_url": r"(?:mysql|postgres(?:ql)?|tidb)://[^\s'\"]+",
    "private_key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "jwt_literal": r"JWT_SECRET\s*[:=]\s*['\"][^'\"]+['\"]",
    "password_literal": r"(?:password|passwd)\s*[:=]\s*['\"][^'\"]{6,}['\"]",
    "cookie_header": r"(?:^|\n)Cookie:\s*[^\n]+",
}
failures = []
for name, pattern in patterns.items():
    if re.search(pattern, payload, re.IGNORECASE):
        failures.append(name)
for forbidden in ["gateway03.us-east-1.prod.aws.tidbcloud.com", "yee376"]:
    if forbidden.lower() in payload.lower():
        failures.append(f"forbidden:{forbidden}")
if failures:
    print("FAIL", ", ".join(failures))
    raise SystemExit(1)
print(f"PASS scanned {len(new_files)} new files and tracked added lines; no secrets or TiDB connection references found")
