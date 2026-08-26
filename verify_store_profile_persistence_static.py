#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = {
    "gmv": ROOT / "server/gmvHrRecovery.ts",
    "upgrade": ROOT / "server/storeProfileUpgrade.ts",
    "router": ROOT / "server/storeManagementRouter.ts",
    "ui": ROOT / "client/src/pages/StoreManagement.tsx",
    "index": ROOT / "server/_core/index.ts",
}
texts = {name: path.read_text(encoding="utf-8") for name, path in FILES.items()}

checks: dict[str, bool] = {
    "gmv_uses_stable_recovered_ids": "details?.storeResult?.storeIds" in texts["gmv"] and "id IN (${placeholders})" in texts["gmv"],
    "gmv_no_operator_id_null_reset": "operatorId = NULL" not in texts["gmv"] and "operator2Id = NULL" not in texts["gmv"],
    "gmv_no_destructive_upload_delete": "DELETE FROM store_data_uploads" not in texts["gmv"],
    "gmv_existing_profile_only_fills_blanks": "WHEN operatorId IS NULL AND (operatorName IS NULL OR TRIM(operatorName) = '')" in texts["gmv"],
    "gmv_does_not_require_exact_gmv_to_skip": "observedGmv === 134_334_533" not in texts["gmv"],
    "gmv_allows_additional_stores": "existingStores.length <= stores.length" not in texts["gmv"],
    "profile_v2_key": 'store-profile-v2-protect' in texts["upgrade"],
    "profile_v2_backups": 'pre-store-profile-v2' in texts["upgrade"] and 'post-store-profile-v2' in texts["upgrade"],
    "audit_table_migrated": "CREATE TABLE IF NOT EXISTS store_profile_audit_logs" in texts["upgrade"],
    "audit_table_health": "manualProfileProtection" in texts["upgrade"] and "auditCount" in texts["upgrade"],
    "router_audit_table_fallback": "CREATE TABLE IF NOT EXISTS store_profile_audit_logs" in texts["router"],
    "router_normalizes_operator_pair": "normalizeOperatorPair" in texts["router"] and "SELECT name FROM staff WHERE id = ?" in texts["router"],
    "create_transaction_and_audit": "action: 'profile_created'" in texts["router"] and "await connection.beginTransaction()" in texts["router"],
    "update_transaction_and_audit": "action: 'profile_updated'" in texts["router"] and "changedProfileFields(before, after)" in texts["router"],
    "archive_transaction_and_audit": "action: 'profile_archived'" in texts["router"],
    "protected_audit_query": "profileAudit: protectedProcedure" in texts["router"],
    "recovery_health_distinct_store_count": "COUNT(DISTINCT ms.id) AS storeCount" in texts["router"],
    "ui_shows_persistence_notice": "人工资料不会被GMV恢复或部署重启覆盖" in texts["ui"],
    "ui_shows_profile_audit": "资料变更记录" in texts["ui"] and "storeManagement.profileAudit.useQuery" in texts["ui"],
    "profile_upgrade_pre_listen": texts["index"].find("await runStoreProfileUpgradeSetup()") < texts["index"].find("server.listen(port, async"),
}

failed = [name for name, ok in checks.items() if not ok]
result = {
    "checkCount": len(checks),
    "passedCount": len(checks) - len(failed),
    "failedCount": len(failed),
    "failedChecks": failed,
    "checks": checks,
}
(ROOT / "store_profile_persistence_static_integrity.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(result, ensure_ascii=False, indent=2))
if failed:
    raise SystemExit(1)
