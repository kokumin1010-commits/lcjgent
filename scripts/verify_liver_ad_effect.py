#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
files = {
    "shared": (ROOT / "shared/liverAdEffect.ts").read_text(encoding="utf-8"),
    "service": (ROOT / "server/liverAdEffect.ts").read_text(encoding="utf-8"),
    "liver_router": (ROOT / "server/liverRouter.ts").read_text(encoding="utf-8"),
    "routers": (ROOT / "server/routers.ts").read_text(encoding="utf-8"),
    "page": (ROOT / "client/src/pages/LiverSelfRecord.tsx").read_text(encoding="utf-8"),
    "panel": (ROOT / "client/src/components/LiverAdEffectPanel.tsx").read_text(encoding="utf-8"),
    "test": (ROOT / "server/liverAdEffect.test.ts").read_text(encoding="utf-8"),
    "shared_test": (ROOT / "server/liverAdEffectShared.test.ts").read_text(encoding="utf-8"),
    "permission": (ROOT / "server/liverAdEffectPermission.test.ts").read_text(encoding="utf-8"),
}

checks = {
    "three_state_model": '"unknown" | "none" | "paid"' in files["shared"],
    "missing_not_zero": 'adCost === null ? "unknown"' in files["shared"] and 'adCost > 0 ? "paid" : "none"' in files["shared"],
    "paid_positive_only": 'parsed === null || parsed <= 0' in files["shared"],
    "roas_formula": 'gmv / adCost' in files["shared"],
    "cost_per_order_formula": 'adCost / orderCount' in files["shared"],
    "net_contribution_formula": 'gmv - adCost' in files["shared"],
    "unknown_excluded": 'buildGroup(records, "paid")' in files["shared"] and 'buildGroup(records, "none")' in files["shared"] and 'record.adStatus === status' in files["shared"],
    "sample_counts_kept": 'sampleCount' in files["shared"] and 'sampleSufficient' in files["shared"],
    "explicit_livestream_link": 'WHERE livestreamId IN (${idPlaceholders})' in files["service"] and 'linkedAdsByLivestream.get(Number(row.id))' in files["service"],
    "liver_owned_query": 'WHERE bl.liverId = ?' in files["service"],
    "soft_deleted_excluded": 'bl.deletedAt IS NULL' in files["service"] and 'deletedAt IS NULL' in files["service"],
    "product_sales_real_field": 'WHEN itemsSold IS NOT NULL THEN itemsSold' in files["service"] and 'WHEN quantity IS NOT NULL THEN quantity' in files["service"],
    "transaction_update": 'beginTransaction()' in files["service"] and 'commit()' in files["service"] and 'rollback()' in files["service"],
    "affected_rows_checked": 'affectedRows !== 1' in files["service"],
    "parent_liver_guard": 'liverId = ? AND deletedAt IS NULL' in files["service"],
    "dashboard_protected": 'adEffectDashboard: publicProcedure' in files["liver_router"] and 'const token = getLiverToken(ctx)' in files["liver_router"] and 'verifyLiverToken(token)' in files["liver_router"],
    "update_protected": 'updateLivestreamAdCost: publicProcedure' in files["liver_router"] and 'updateOwnLivestreamAdCost(payload.liverId' in files["liver_router"],
    "create_schema_accepts_ad_cost": 'adCost: z.number().int().nonnegative().nullable().optional()' in files["routers"],
    "create_persists_ad_cost": 'adCost: input.adCost ?? null' in files["routers"],
    "form_three_states": 'adStatus: "unknown" as LiverAdStatus' in files["page"] and 'value="paid"' in files["page"] and 'value="none"' in files["page"],
    "ai_ad_cost_fill": 'analysisResult.rawData?.adCost' in files["page"] and 'updates.adStatus' in files["page"],
    "create_payload_ad_cost": 'adCost: normalizedAdCost' in files["page"],
    "dashboard_panel_mounted": '<LiverAdEffectPanel' in files["page"],
    "panel_comparison": '平均ROAS' in files["panel"] and '每场直播广告费' in files["panel"],
    "history_edit": 'trpc.liver.updateLivestreamAdCost.useMutation' in files["panel"],
    "permission_regression": 'UNAUTHORIZED' in files["permission"] and 'adEffectDashboard' in files["permission"] and 'updateLivestreamAdCost' in files["permission"],
    "repeat_edit_regression": 'supports a second update' in files["test"],
    "rollback_regression": 'rolls back' in files["test"],
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed")
raise SystemExit(1 if failed else 0)
