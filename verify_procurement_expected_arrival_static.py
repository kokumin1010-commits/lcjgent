import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
router = (ROOT / "server/selectionCenterRouter.ts").read_text()
ui = (ROOT / "client/src/pages/SelectionCenter.tsx").read_text()
upgrade = (ROOT / "server/procurementSchemaUpgrade.ts").read_text()
startup = (ROOT / "server/_core/index.ts").read_text()
initial = (ROOT / "server/ensureFestivalTables.ts").read_text()
rules = (ROOT / "procurement_expected_arrival_rules_2026-08-26.md").read_text()

required_columns = [
    "liveRoom", "shopName", "productLink", "orderStatus", "pendingPaymentQty",
    "pendingShipQty", "qtyPerOrder", "bundleId", "expectedArrivalDate",
]

checks = {
    "upgrade_declares_all_9_columns": all(f"{column}:" in upgrade for column in required_columns),
    "initial_table_declares_all_9_columns": all(column in initial for column in required_columns),
    "expected_arrival_index_present": "idx_procurement_expected_arrival" in upgrade and "idx_procurement_expected_arrival" in initial,
    "encrypted_pre_post_backup_reasons": "pre-procurement-v1" in upgrade and "post-procurement-v1" in upgrade,
    "upgrade_preserves_order_snapshot": all(key in upgrade for key in ["orderCount", "maxOrderId", "totalQuantity", "totalCost", "dataRowsModified: 0"]),
    "write_compatibility_explain_insert": "EXPLAIN INSERT INTO procurement_orders" in upgrade and "writeCompatibilityReady" in upgrade,
    "upgrade_runs_before_main_listener": startup.index("await runProcurementSchemaUpgradeSetup()") < startup.rindex("server.listen(port, async"),
    "no_procurement_alter_in_user_router": "ALTER TABLE procurement_orders" not in router,
    "normal_create_supports_expected_arrival": "createProcurementOrder: protectedProcedure" in router and "expectedArrivalDate: procurementDateSchema.optional()" in router,
    "batch_create_supports_expected_arrival": "createBatchProcurementOrders: protectedProcedure" in router and router.count("input.expectedArrivalDate || null") >= 3,
    "normal_edit_supports_clear": "updateProcurementOrder: protectedProcedure" in router and "expectedArrivalDate: procurementDateSchema.nullable().optional()" in router,
    "fukubukuro_create_supports_expected_arrival": "createFukubukuroOrder: protectedProcedure" in router and "orderDate, expectedArrivalDate, status" in router,
    "fukubukuro_edit_supports_clear": "updateFukubukuroOrder: protectedProcedure" in router and router.count("expectedArrivalDate: procurementDateSchema.nullable().optional()") >= 2,
    "backend_validates_date_order": "预计到货日期不能早于发注日" in router and router.count("validateExpectedArrivalDate(") >= 6,
    "public_non_pii_health_endpoint": "getProcurementSchemaUpgradeHealth: publicProcedure.query" in router,
    "ui_has_expected_arrival_table_column": '<th className="text-left p-3 font-medium">预计到货</th>' in ui,
    "ui_has_four_expected_arrival_inputs": ui.count("<Label>预计到货</Label>") >= 4,
    "ui_create_states_cover_normal_and_fukubukuro": ui.count("const [expectedArrivalDate, setExpectedArrivalDate]") >= 3,
    "ui_supports_edit_clear": ui.count("expectedArrivalDate: form.expectedArrivalDate || null") == 1 and "expectedArrivalDate: expectedArrivalDate || null" in ui,
    "ui_shows_overdue_without_status_mutation": "isProcurementArrivalOverdue" in ui and "逾期" in ui,
    "ui_shows_schema_health": "采购结构已修复：直播间与预计到货可正常保存" in ui,
    "rules_forbid_old_tidb_and_inference": "旧TiDB不得连接或使用" in rules and "既有订单保持NULL" in rules,
}

failed = [name for name, ok in checks.items() if not ok]
result = {
    "checkCount": len(checks),
    "passedCount": len(checks) - len(failed),
    "failedCount": len(failed),
    "failedChecks": failed,
    "checks": checks,
}
(ROOT / "procurement_expected_arrival_static_integrity.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(result, ensure_ascii=False, indent=2))
if failed:
    raise SystemExit(1)
