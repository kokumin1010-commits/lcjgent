#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPGRADE = (ROOT / "server/influencerBdUpgrade.ts").read_text(encoding="utf-8")
INDEX = (ROOT / "server/_core/index.ts").read_text(encoding="utf-8")
SCHEMA = (ROOT / "drizzle/schema.ts").read_text(encoding="utf-8")

TABLES = [
    "influencer_bd_campaigns",
    "influencer_bd_creators",
    "influencer_bd_outreach_logs",
    "influencer_bd_attachments",
    "influencer_bd_ai_analyses",
    "influencer_bd_analysis_feedback",
    "influencer_bd_settings",
    "influencer_bd_audit_logs",
]

upgrade_call_index = INDEX.index("await runInfluencerBdUpgradeSetup()")
production_listen_index = INDEX.index("server.listen(port", upgrade_call_index)
upgrade_failure_index = INDEX.index('[InfluencerBdUpgrade] pre-listen setup failed', upgrade_call_index)

checks = {
    "all required tables declared in upgrade": all(name in UPGRADE for name in TABLES),
    "all required tables declared in Drizzle schema": all(name in SCHEMA for name in TABLES),
    "table creation is idempotent": UPGRADE.count("CREATE TABLE IF NOT EXISTS") >= len(TABLES) + 1,
    "pre-upgrade encrypted backup is required": 'verifiedBackup(pool, PRE_REASON)' in UPGRADE,
    "post-upgrade encrypted backup is required": 'verifiedBackup(pool, POST_REASON)' in UPGRADE,
    "pre-backup precedes business table creation": UPGRADE.index("verifiedBackup(pool, PRE_REASON)") < UPGRADE.index("await createTables(pool)"),
    "post-backup follows source preservation checks": UPGRADE.index("const postBackupId = await verifiedBackup") > UPGRADE.index("changed during schema upgrade"),
    "core source counts are checked": all(key in UPGRADE for key in ["userCount", "staffCount", "brandCount", "brandProductCount", "reportCount", "managedStoreCount"]),
    "upgrade records zero existing business row changes": "existingBusinessRowsModified: 0" in UPGRADE,
    "default settings do not overwrite manual values": "ON DUPLICATE KEY UPDATE id=id" in UPGRADE,
    "automatic AI use defaults off": "autoAnalysisEnabled TINYINT(1) NOT NULL DEFAULT 0" in UPGRADE,
    "upgrade exposes health state": "getInfluencerBdUpgradeHealth" in UPGRADE,
    "upgrade is imported by server": 'runInfluencerBdUpgradeSetup' in INDEX,
    "upgrade completes before listen": upgrade_call_index < production_listen_index,
    "startup fails closed when upgrade fails": "throw error;" in INDEX[upgrade_failure_index:production_listen_index],
    "legacy TiDB is not referenced": "tidbcloud.com" not in UPGRADE.lower() and "tidbcloud.com" not in SCHEMA.lower(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
if failed:
    raise SystemExit(f"{len(failed)} upgrade checks failed: {', '.join(failed)}")
print(f"PASS: {len(checks)} influencer BD upgrade checks")
