#!/usr/bin/env python3

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "page": ROOT / "client/src/pages/SelectionCenter.tsx",
    "shared": ROOT / "shared/selectionProductPersistence.ts",
    "product_persistence": ROOT / "server/selectionProductPersistence.ts",
    "child_persistence": ROOT / "server/selectionChildSkuPersistence.ts",
    "router": ROOT / "server/selectionCenterRouter.ts",
    "tests": ROOT / "server/selectionChildSkuPersistence.test.ts",
    "spec": ROOT / "docs/child-sku-display-edit-spec.md",
}
text = {name: path.read_text(encoding="utf-8") for name, path in FILES.items()}

checks = [
    ("shared stable variant identity", "variantId?: string" in text["shared"] and "variantId" in text["product_persistence"]),
    ("shared child fields", all(marker in text["shared"] for marker in ["skuCode?: string", "stock?: number", 'status?: "draft" | "online" | "offline"'])),
    ("duplicate SKU code rejected", "编号重复" in text["shared"] and "番号が重複" in text["shared"]),
    ("entity child row lock", "LIMIT 1 FOR UPDATE" in text["child_persistence"] and "expectedParentId" in text["child_persistence"]),
    ("embedded parent row lock", "WHERE id = ? AND deletedAt IS NULL LIMIT 1 FOR UPDATE" in text["child_persistence"]),
    ("affected rows verified", text["child_persistence"].count("affectedRows") >= 3),
    ("transaction rollback", text["child_persistence"].count("rollback") >= 4),
    ("legacy SKU columns synchronized", all(marker in text["child_persistence"] for marker in ["skuName = ?", "skuPrice = ?", "skuLowestPrice = ?", "skuDiscountRate = ?"])),
    ("entity price fields persist on row", all(marker in text["child_persistence"] for marker in ["historicalLowestPrice = ?", "discountRate = ?", "variant.lowestPrice", "variant.discountRate"])),
    ("recovery source key not updated", "SET productName = ?, skuName = ?, barcode = ?" in text["child_persistence"] and "SET productId =" not in text["child_persistence"]),
    ("protected child edit procedures", all(marker in text["router"] for marker in ["updateEntityChildSku: protectedProcedure", "updateEmbeddedChildSku: protectedProcedure", "deleteEmbeddedChildSku: protectedProcedure"])),
    ("safe unlink contract", "expectedParentId" in text["router"] and "removeEntityChildParent" in text["router"]),
    ("child query returns editable fields", all(marker in text["router"] for marker in ["skuName", "barcode", "stock", "status", "promotionType"])),
    ("two child kinds rendered", 'data-child-sku-kind={target.kind}' in text["page"] and 'kind: "entity"' in text["page"] and 'kind: "embedded"' in text["page"]),
    ("child edit dialog fields", all(marker in text["page"] for marker in ["SKU编号 / SKU番号", "条码 / バーコード", "历史最低价 / 最低価", "库存 / 在庫", "促销 / 组合"])),
    ("per-row edit and delete actions", 'title="子SKU编辑"' in text["page"] and "deleteEmbeddedChildSkuMutation" in text["page"] and "removeParentProductMutation" in text["page"]),
    ("no obsolete showProductForm crash", "setShowProductForm" not in text["page"]),
    ("no raw removeParent fetch", 'fetch("/api/trpc/selectionCenter.removeParentProduct"' not in text["page"]),
    ("JSON SKU fields in parent editor", all(marker in text["page"] for marker in ["sku.skuCode", "sku.stock", "sku.status"])),
    ("three consecutive edit regression", "updates the same embedded SKU three times" in text["tests"] and "第3版" in text["tests"]),
    ("stale identity and duplicate code regression", "rejects stale fallback identity" in text["tests"] and "rejects duplicate SKU codes" in text["tests"]),
    ("implementation spec exists", "Railway MySQL" in text["spec"] and "productId" in text["spec"]),
]

failed = [name for name, passed in checks if not passed]
for name, passed in checks:
    print(f"[{'PASS' if passed else 'FAIL'}] {name}")
print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    print("Failed: " + ", ".join(failed), file=sys.stderr)
    raise SystemExit(1)
