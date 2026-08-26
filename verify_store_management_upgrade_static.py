#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
page = (ROOT / "client/src/pages/StoreManagement.tsx").read_text(encoding="utf-8")
router = (ROOT / "server/storeManagementRouter.ts").read_text(encoding="utf-8")
index = (ROOT / "server/_core/index.ts").read_text(encoding="utf-8")
upgrade = (ROOT / "server/storeProfileUpgrade.ts").read_text(encoding="utf-8")
rules = (ROOT / "store_profile_month_rules_2026-08-26.md").read_text(encoding="utf-8")

checks = {
    "fallback_code_removed": not any(token in page for token in ["usingLatestRecoveredPeriod", "latestSummaryQuery", "latestDataPeriodQuery"]),
    "summary_uses_selected_period": "const displayedDataYear = summaryYear" in page and "const displayedDataMonth = summaryMonth" in page,
    "empty_month_zero_notice": "当月数据未上传" in page and "不会回退或复制其他月份" in page,
    "edit_dialog_present": "function StoreProfileDialog" in page and "保存修改" in page,
    "visible_edit_button_present": "title=\"店铺资料编辑\"" in page,
    "s3_avatar_upload_client": "/api/store-avatar-upload" in page and "credentials: 'include'" in page,
    "client_avatar_type_limit": "STORE_AVATAR_MIME_TYPES" in page and "STORE_AVATAR_MAX_BYTES" in page,
    "no_base64_avatar_write": "readAsDataURL" not in page and "data:image" not in page,
    "owner_and_contact_fields": all(token in page for token in ["operatorName", "operator2Name", "contactEmail", "contactPhone"]),
    "active_unarchived_staff_only": 'isActive = \"active\" AND archivedAt IS NULL' in router,
    "router_profile_columns": all(token in router for token in ["avatarKey", "contactEmail", "contactPhone"]),
    "router_strict_month_health": "crossMonthFallbackAllowed: false" in router and "augustStrictZeroExpected" in router,
    "server_upload_auth_required": 'app.post("/api/store-avatar-upload"' in index and 'sdk.authenticateRequest(req)' in index and 'res.status(401)' in index,
    "server_upload_safe_types": all(token in index for token in ['"image/jpeg": "jpg"', '"image/png": "png"', '"image/webp": "webp"', "5 * 1024 * 1024"]),
    "server_upload_uses_storage": "store-avatars/${storeId}/${nanoid()}" in index and "storagePut(fileKey, file.buffer, file.mimetype)" in index,
    "upgrade_has_pre_post_backup": all(token in upgrade for token in ["pre-store-profile-v1", "post-store-profile-v1", "runDatabaseBackup"]),
    "upgrade_is_idempotent": "if (before.missing.length === 0)" in upgrade and "INFORMATION_SCHEMA.COLUMNS" in upgrade,
    "upgrade_before_server_listen": index.find("await runStoreProfileUpgradeSetup()") < index.rfind("server.listen(port"),
    "five_store_integrity_health": "storeCount === 5" in router and "julyGmv === 134_334_533" in router,
    "rules_forbid_cross_month_copy": "不得查询或展示2026年7月金额" in rules and "2026年7月仍显示" in rules,
}

result = {
    "healthy": all(checks.values()),
    "checkCount": len(checks),
    "passedCount": sum(1 for value in checks.values() if value),
    "failedChecks": [name for name, value in checks.items() if not value],
    "checks": checks,
}
(ROOT / "store_management_upgrade_static_integrity.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(result, ensure_ascii=False, indent=2))
if not result["healthy"]:
    raise SystemExit(1)
