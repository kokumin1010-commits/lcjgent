from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path('/home/ubuntu/lcjgent_restore')
evidence = json.loads((ROOT / 'server/kgProductRecoveryEvidence.json').read_text(encoding='utf-8'))
module = (ROOT / 'server/kgProductRecovery.ts').read_text(encoding='utf-8')
router = (ROOT / 'server/selectionCenterRouter.ts').read_text(encoding='utf-8')
page = (ROOT / 'client/src/pages/SelectionCenter.tsx').read_text(encoding='utf-8')

main = evidence['mainProducts']
children = evidence['childSkus']
historical = evidence['historicalCatalogAdditions']
main_keys = {row['sourceKey'] for row in main}
current_keys = set()
for line in (ROOT / 'current_40_products_image_inputs.tsv').read_text(encoding='utf-8').splitlines():
    parts = line.split('\t')
    if len(parts) >= 2 and parts[0] and parts[1]:
        current_keys.add(f'{parts[0]}:{parts[1]}')
second = json.loads((ROOT / 'server/selectionProductDeepRecoveryEvidence.json').read_text(encoding='utf-8'))
current_keys.update(row['sourceKey'] for row in second['mainProducts'])

image_rows = [row for row in [*main, *children] if row.get('imageEvidence')]
image_checks = []
for row in image_rows:
    image = row['imageEvidence']
    path = ROOT / image['assetFile']
    raw = path.read_bytes()
    image_checks.append({
        'productName': row['productName'],
        'path': str(path.relative_to(ROOT)),
        'exists': path.exists(),
        'bytesMatch': len(raw) == image['bytes'],
        'shaMatch': hashlib.sha256(raw).hexdigest() == image['sha256'],
        'dimensionsValid': image['width'] >= 600 and image['height'] >= 600,
        'visualReview': image['visualReview'],
    })

checks = {
    'mainProductCountIs3': len(main) == 3,
    'childSkuCountIs10': len(children) == 10,
    'historicalCatalogCountIs40': len(historical) == 40,
    'uniqueEvidenceProductKeys': len({row['sourceKey'] for row in [*main, *children]}) == 13,
    'allChildrenHaveSourceClassification': all(row.get('sourceClass') and row.get('sourceTable') for row in children),
    'allChildParentsExist': all(row['parentSourceKey'] in (main_keys | current_keys) for row in children),
    'fiveSavedHistoricalPrices': sum(1 for row in children if (row.get('historicalLowestPrice') or 0) > 0) == 5,
    'sixVerifiedImages': len(image_rows) == 6 and all(item['shaMatch'] and item['bytesMatch'] and item['dimensionsValid'] for item in image_checks),
    'noCurrentWebPriceWritten': all(row.get('price') is None for row in [*main, *children]),
    'allRecoveryProductsOffline': all(row.get('status') == 'offline' for row in [*main, *children]),
    'moduleUsesPrePostBackups': 'pre-kg-product-v3' in module and 'post-kg-product-v3' in module and 'runVerifiedBackup' in module,
    'modulePreservesManualFields': 'CASE WHEN images IS NULL' in module and 'CASE WHEN barcode IS NULL' in module,
    'moduleWritesChildParentRelation': 'parentProductId = ?' in module and 'resolveParentId' in module,
    'moduleWritesSavedPriceHistory': 'kg_product_v3_saved_livestream' in module and 'selection_price_history' in module,
    'routerPaginatesParentsOnly': "sp.deletedAt IS NULL AND sp.parentProductId IS NULL" in router,
    'routerAppendsRealChildren': 'sp.parentProductId IN' in router and 'items.push(...childRows.map' in router,
    'uiRemovedRepeatedEmptyChildRows': '子SKUなし（商品編集で親SKUを設定してください）' not in page,
    'uiHasExplicitChildExpand': '子SKU ${childProducts.length}件を表示' in page and 'expandedParentIds.has(product.id)' in page,
    'uiShowsKgRecoveryHealth': 'KG／KYOGOKU 優先復元' in page and 'getKgProductRecoveryHealth' in page,
    'oldTidbNotUsed': 'tidbcloud.com' not in module.lower() and 'oldTiDBUsed: false' in module,
}

result = {
    'evidenceSha256': evidence['evidenceSha256'],
    'expected': evidence['expected'],
    'checks': checks,
    'imageChecks': image_checks,
    'healthy': all(checks.values()),
}
(ROOT / 'kg_product_recovery_static_integrity.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)
if not result['healthy']:
    failed = [key for key, value in checks.items() if not value]
    raise SystemExit(f'KG static integrity failed: {failed}')
print(json.dumps(result, ensure_ascii=False, indent=2))
