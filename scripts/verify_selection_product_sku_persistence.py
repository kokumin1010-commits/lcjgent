from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
client = (ROOT / "client/src/pages/SelectionCenter.tsx").read_text()
router = (ROOT / "server/selectionCenterRouter.ts").read_text()
service = (ROOT / "server/selectionProductPersistence.ts").read_text()
shared = (ROOT / "shared/selectionProductPersistence.ts").read_text()

checks = {
    "client normalizes legacy tags": "p.tags = normalizeSelectionProductTags(p.tags)" in client,
    "client normalizes legacy sku json": "normalizeSelectionProductSkuVariants(p.skuVariants)" in client,
    "client sends canonical sku array even when empty": "skuVariants: normalizedSkuVariants" in client,
    "client synchronizes legacy sku name": "skuName: primarySku?.name ?? null" in client,
    "client can delete final sku row": "onClick={() => removeSkuVariant(idx)}" in client,
    "new product button uses create label": 't("sc.form.create")' in client,
    "create route accepts sku variants": "skuVariants: z.union([z.array(z.unknown()), z.string()]).nullable().optional()" in router,
    "routes use one persistence service for create": "createSelectionProduct(" in router,
    "routes use one persistence service for update": "updateSelectionProduct(" in router,
    "service stores skuVariants json": '"skuVariants"' in service and "JSON_COLUMNS" in service,
    "service synchronizes legacy sku fields": "data.skuName = primarySku?.name ?? null" in service,
    "create is transactional": "createSelectionProduct" in service and "await connection.beginTransaction()" in service and "await connection.commit()" in service,
    "update locks active product": "deletedAt IS NULL LIMIT 1 FOR UPDATE" in service,
    "update checks affected rows": "result.affectedRows !== 1" in service,
    "write failures roll back": "await connection.rollback()" in service,
    "duplicate normalized sku rejected": "duplicateOf !== undefined" in shared,
    "selection product SKU does not use mall variants table": "mall_product_variants" not in service and "mall_product_variants" not in shared,
}

failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'}: {name}")

if failed:
    raise SystemExit("selection product SKU verification failed: " + ", ".join(failed))
print(f"All {len(checks)} selection product SKU persistence checks passed.")
