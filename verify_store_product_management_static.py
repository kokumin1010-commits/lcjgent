#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UPGRADE = (ROOT / "server/storeProductUpgrade.ts").read_text()
ROUTER = (ROOT / "server/storeProductRouter.ts").read_text()
STORE_ROUTER = (ROOT / "server/storeManagementRouter.ts").read_text()
INDEX = (ROOT / "server/_core/index.ts").read_text()
APP_ROUTER = (ROOT / "server/routers.ts").read_text()
PAGE = (ROOT / "client/src/pages/StoreManagement.tsx").read_text()
UI = (ROOT / "client/src/components/StoreProductManagement.tsx").read_text()
RULES = (ROOT / "store_product_management_rules_2026-08-26.md").read_text()

checks = {}
required_tables = [
    "store_products",
    "store_product_skus",
    "store_product_images",
    "store_product_promotions",
    "store_product_audit_logs",
]
checks["five_business_tables_declared"] = all(f'"{table}"' in UPGRADE and f"CREATE TABLE IF NOT EXISTS {table}" in UPGRADE for table in required_tables)
checks["backup_gated_migration"] = all(marker in UPGRADE for marker in ["pre-store-products-v1", "post-store-products-v1", "runVerifiedBackup", "dataRowsModified: 0", "oldTiDBUsed: false"])
checks["five_store_snapshot_guard"] = "activeStoreCount !== 5" in UPGRADE and "active store count changed during upgrade" in UPGRADE
checks["migration_does_not_seed_products"] = not any(f"INSERT INTO {table}" in UPGRADE for table in required_tables)
checks["soft_delete_business_entities"] = all(marker in ROUTER for marker in ["deletedAt=CURRENT_TIMESTAMP", "product_archived", "sku_archived", "image_removed", "promotion_paused"])
checks["no_physical_delete_sql"] = not re.search(r"DELETE\s+FROM\s+store_product_(?:skus|images|promotions|audit_logs)", ROUTER, flags=re.I) and not re.search(r"DELETE\s+FROM\s+store_products", ROUTER, flags=re.I)
checks["sixteen_protected_procedures"] = len(re.findall(r"^  [A-Za-z][A-Za-z0-9]*: protectedProcedure", ROUTER, flags=re.M)) == 16
checks["server_calculates_discount"] = "calculatePromotion" in ROUTER and "Math.round(rawPrice)" in ROUTER and "discountValue > 100" in ROUTER and "discountValue > input.basePrice" in ROUTER
checks["promotion_does_not_overwrite_base_price"] = "basePriceSnapshot" in ROUTER and "promotionPrice" in ROUTER and "UPDATE store_products SET basePrice" not in ROUTER
checks["audit_for_all_write_domains"] = all(marker in ROUTER for marker in ["product_created", "product_updated", "sku_created", "image_added", "promotion_created"])
checks["selection_center_is_optional_link"] = "selectionProductId" in ROUTER and "关联的选品商品不存在" in ROUTER and "UPDATE selection_products" not in ROUTER
checks["image_upload_authenticated"] = "/api/store-product-image-upload" in INDEX and "sdk.authenticateRequest(req)" in INDEX and "store-products/${storeId}/${productId}" in INDEX
checks["image_upload_limits"] = all(marker in INDEX for marker in ['"image/jpeg"', '"image/png"', '"image/webp"', "8 * 1024 * 1024"])
checks["router_mounted"] = 'import { storeProductRouter } from "./storeProductRouter"' in APP_ROUTER and "storeProducts: storeProductRouter" in APP_ROUTER
checks["prelisten_upgrade"] = "await runStoreProductUpgradeSetup();" in INDEX and INDEX.index("await runStoreProductUpgradeSetup();") < INDEX.rindex("server.listen(port")
checks["public_health_no_pii"] = "productManagementHealth: publicProcedure" in STORE_ROUTER and "getStoreProductUpgradeHealth" in STORE_ROUTER
checks["four_store_detail_tabs"] = all(label in PAGE for label in ["业绩概览", "商品管理", "推广活动", "数据上传"]) and "StoreProductManagement" in PAGE
checks["product_form_fields"] = all(label in UI for label in ["平台商品ID", "内部SPU", "正常售价（JPY）", "商品总库存", "商品链接", "关联选品中心商品"])
checks["sku_form_fields"] = all(label in UI for label in ["SKU / 变体", "SKU编码", "平台SKU ID", "条码", "SKU售价"])
checks["promotion_ui_fields"] = all(label in UI for label in ["是否推广", "折扣率（%）", "优惠金额（JPY）", "开始时间", "结束时间", "推广渠道", "推广价预览"])
checks["image_ui_and_s3_boundary"] = all(label in UI for label in ["商品图片（最多8张）", "S3/R2", "/api/store-product-image-upload"])
checks["audit_ui"] = "变更历史" in UI and "actorName" in UI and "createdAt" in UI
checks["strict_month_logic_preserved"] = "selectedPeriodHasData" in PAGE and "displayedSummary = summaryQuery.data" in PAGE and "crossMonthFallbackAllowed: false" in STORE_ROUTER
checks["rules_forbid_old_tidb"] = "旧TiDB不得连接或使用" in RULES

failed = sorted(key for key, ok in checks.items() if not ok)
result = {"checkCount": len(checks), "passed": len(checks) - len(failed), "failed": failed, "checks": checks}
(ROOT / "store_product_management_static_integrity.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(result, ensure_ascii=False, indent=2))
if failed:
    raise SystemExit(1)
