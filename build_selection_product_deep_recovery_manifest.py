from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path('/home/ubuntu/lcjgent_restore')
RECOVERY_KEY = 'selection-product-deep-v2'


def norm(value: str) -> str:
    value = unicodedata.normalize('NFKC', value or '').lower()
    return re.sub(r'[\s\u3000\(\)（）\[\]【】/／・._\-+＋|｜,，:：]+', '', value)


def sha(value: str, length: int = 16) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:length]


def nullish(value):
    return None if value in (None, '', 'NULL', 'null') else value


current_rows = []
for line in (ROOT / 'current_40_products_image_inputs.tsv').read_text(encoding='utf-8').splitlines():
    fields = line.split('\t')
    if len(fields) < 3:
        continue
    current_rows.append({'sourceType': fields[0], 'sourceId': fields[1], 'productName': fields[2]})
current_keys = {f"{row['sourceType']}:{row['sourceId']}" for row in current_rows}
current_names = {norm(row['productName']) for row in current_rows}

brand_rows = json.loads((ROOT / 'selection_product_all_direct_brand_rows.json').read_text(encoding='utf-8'))
brand_map = {
    90001: {'brandId': 66, 'brandName': 'Mistine（ミスティーン）', 'evidence': 'saved_brand_directory:66'},
    90003: {'brandId': 28, 'brandName': 'Mooekiss (モーキス)', 'evidence': 'saved_brand_directory:28'},
    90004: {'brandId': 36, 'brandName': 'Oeing (オーイング) 2场提案', 'evidence': 'saved_brand_directory:36'},
    90005: {'brandId': 48, 'brandName': 'F&W', 'evidence': 'saved_brand_directory:48'},
    90006: {'brandId': 71, 'brandName': 'Pink Moments (ピンク・モーメンツ)', 'evidence': 'saved_brand_directory:71'},
    90008: {'brandId': 58, 'brandName': '方里 FUNNY (ファンリー)', 'evidence': 'saved_brand_directory:58'},
    180005: {'brandId': 17, 'brandName': 'MOVA (モバ)', 'evidence': 'saved_brand_directory:17+official_mova_pages'},
    30001: {'brandId': 33, 'brandName': 'DDS RENOVATIO （レノバティオ）', 'evidence': 'saved_brand_directory:33'},
}

main_products = []
source_aliases = []
for row in sorted(brand_rows, key=lambda item: int(item.get('product_id') or item.get('id'))):
    source_id = str(row.get('product_id') or row.get('id'))
    source_key = f'brand:{source_id}'
    if source_key in current_keys:
        continue
    name = str(row.get('productName') or row.get('name') or '').strip()
    old_brand_id = int(row.get('brandId')) if row.get('brandId') not in (None, '', 'NULL') else None
    mapping = brand_map.get(old_brand_id or -1)
    if norm(name) in current_names:
        source_aliases.append({
            'sourceTable': 'brand_products',
            'sourceId': source_id,
            'productName': name,
            'oldBrandId': old_brand_id,
            'brandId': mapping['brandId'] if mapping else None,
            'brandName': mapping['brandName'] if mapping else None,
            'brandMappingEvidence': mapping['evidence'] if mapping else None,
            'duplicateOfNormalizedName': name,
            'action': 'archive_alias_only',
            'evidence': 'selection_recovery_bundles/brand_products.json:db-query-1770538428641.json',
        })
        continue
    if not mapping:
        raise RuntimeError(f'No evidence-backed brand mapping for brand product {source_id} oldBrandId={old_brand_id}')
    main_products.append({
        'sourceClass': 'historical_brand_product',
        'sourceTable': 'brand_products',
        'sourceId': source_id,
        'sourceKey': source_key,
        'productName': name,
        'oldBrandId': old_brand_id,
        'brandId': mapping['brandId'],
        'brandName': mapping['brandName'],
        'brandMappingEvidence': mapping['evidence'],
        'categoryName': None,
        'price': None,
        'marketPrice': None,
        'stock': 0,
        'images': [],
        'status': 'offline',
        'description': '保存済みDB操作履歴のbrand_products行から復元。価格・在庫・画像は直接証拠がないため未設定。',
        'evidenceFiles': ['selection_recovery_bundles/brand_products.json'],
        'evidenceQueryFiles': ['db-query-1770538428641.json'],
    })

master_all = json.loads((ROOT / 'selection_product_historical_product_master_all.json').read_text(encoding='utf-8'))
master_by_id = {str(row['id']): row for row in master_all}
for source_id in ('13', '30001', '30002'):
    row = master_by_id[source_id]
    name = str(row.get('canonicalName') or '').strip()
    source_key = f'historical-master:{source_id}'
    if norm(name) in current_names or any(norm(item['productName']) == norm(name) for item in main_products):
        continue
    image = nullish(row.get('imageUrl'))
    main_products.append({
        'sourceClass': 'historical_product_master',
        'sourceTable': 'product_master',
        'sourceId': source_id,
        'sourceKey': source_key,
        'productName': name,
        'oldBrandId': None,
        'brandId': 91,
        'brandName': 'KYOGOKU JAPAN',
        'brandMappingEvidence': 'saved_brand_directory:91+product_name_prefix',
        'categoryName': None,
        'price': None,
        'marketPrice': None,
        'stock': 0,
        'images': [image] if image else [],
        'status': 'offline',
        'description': '保存済みproduct_master直接行から復元。旧主档由来のためオフライン表示。価格・在庫は未復元。',
        'evidenceFiles': ['auction_liver_recovery_bundles/01_livers.txt', 'selection_product_historical_product_master_all.json'],
        'evidenceQueryFiles': ['db-query-1772075187743.json'],
    })

livestream_bundle = json.loads((ROOT / 'selection_recovery_bundles/livestream_products.json').read_text(encoding='utf-8'))
live_query = None
for record in livestream_bundle.get('query_records', []):
    if str(record.get('file') or '').endswith('db-query-1770542064352.json'):
        live_query = record.get('data')
        break
if not live_query:
    raise RuntimeError('Missing saved livestream product aggregate query')

live_rows = live_query.get('rows', [])
for row in live_rows:
    name = str(row.get('productName') or '').strip()
    if not name:
        continue
    # The detailed MEGA-gacha aggregate is the same product as the complete product_master row.
    if 'MEGAガチャ袋' in name:
        source_aliases.append({
            'sourceTable': 'livestream_products',
            'sourceId': f'name:{sha(norm(name))}',
            'productName': name,
            'duplicateOfSourceKey': 'historical-master:30001',
            'action': 'archive_sales_evidence_only',
            'evidence': 'db-query-1770542064352.json',
            'totalGmv': int(row.get('totalGmv') or 0),
            'totalSold': int(row.get('totalSold') or 0),
        })
        continue
    source_id = f'name:{sha(norm(name))}'
    source_key = f'livestream-history:{sha(norm(name))}'
    if norm(name) in current_names or any(norm(item['productName']) == norm(name) for item in main_products):
        source_aliases.append({
            'sourceTable': 'livestream_products',
            'sourceId': source_id,
            'productName': name,
            'action': 'archive_sales_evidence_only',
            'evidence': 'db-query-1770542064352.json',
            'totalGmv': int(row.get('totalGmv') or 0),
            'totalSold': int(row.get('totalSold') or 0),
        })
        continue
    is_kyogoku = 'KYOGOKU' in name.upper()
    main_products.append({
        'sourceClass': 'historical_livestream_product',
        'sourceTable': 'livestream_products',
        'sourceId': source_id,
        'sourceKey': source_key,
        'productName': name,
        'oldBrandId': None,
        'brandId': 91 if is_kyogoku else None,
        'brandName': 'KYOGOKU JAPAN' if is_kyogoku else 'ブランド名称未復元（旧直播商品）',
        'brandMappingEvidence': 'product_name_prefix:KYOGOKU' if is_kyogoku else 'unknown_preserved_explicitly',
        'categoryName': None,
        'price': None,
        'marketPrice': None,
        'stock': 0,
        'images': [],
        'status': 'offline',
        'description': f"保存済みlivestream_products集計行から復元。旧GMV ¥{int(row.get('totalGmv') or 0):,}、販売数 {int(row.get('totalSold') or 0):,}。現在価格・在庫・画像は未復元。",
        'historicalMetrics': {
            'liverId': int(row.get('liverId')) if row.get('liverId') else None,
            'liverName': nullish(row.get('liverName')),
            'totalGmv': int(row.get('totalGmv') or 0),
            'totalSold': int(row.get('totalSold') or 0),
        },
        'evidenceFiles': ['selection_recovery_bundles/livestream_products.json'],
        'evidenceQueryFiles': ['db-query-1770542064352.json'],
    })

# Historical read-only catalog additions.
historical_additions = []
existing_master_ids = {'5', '7', '8', '9', '10', '13', '14', '15', '30001', '30002'}
for source_id, row in sorted(master_by_id.items(), key=lambda item: int(item[0])):
    if source_id in existing_master_ids:
        continue
    name = str(row.get('canonicalName') or '').strip()
    image = nullish(row.get('imageUrl'))
    historical_additions.append({
        'sourceTable': 'product_master',
        'sourceId': source_id,
        'displayName': name,
        'category': None,
        'description': '保存済みDB操作履歴で確認された旧product_master行。重複IDも旧記録として保持。',
        'brandId': '91' if 'KYOGOKU' in name.upper() else None,
        'regularPrice': None,
        'specialPrice': None,
        'imageUrl': image,
        'imageStatus': nullish(row.get('imageStatus')) or ('confirmed' if image else 'none'),
        'imageSource': 'saved_db_query' if image else None,
        'sourceUrl': nullish(row.get('sourceUrl')),
        'isActive': 0,
        'createdAt': None,
        'updatedAt': None,
        'recoveryStatus': 'historical_read_only',
        'nameCompleteness': 'truncated_or_unknown' if ('...' in name or '…' in name or name in {'トリートメント', '【1箱購入で1箱プレゼント'}) else 'preserved',
        'evidenceFiles': ['auction_liver_recovery_bundles/01_livers.txt'],
        'evidenceQueryFiles': ['db-query-1772075187743.json'],
    })

for row in live_rows:
    name = str(row.get('productName') or '').strip()
    source_id = f'name:{sha(norm(name))}'
    historical_additions.append({
        'sourceTable': 'livestream_products_aggregate',
        'sourceId': source_id,
        'displayName': name,
        'category': None,
        'description': f"保存済み旧ライブ集計: liver={row.get('liverName') or row.get('liverId') or 'unknown'}, GMV=¥{int(row.get('totalGmv') or 0):,}, sold={int(row.get('totalSold') or 0):,}。",
        'brandId': '91' if 'KYOGOKU' in name.upper() else None,
        'regularPrice': None,
        'specialPrice': None,
        'imageUrl': None,
        'imageStatus': 'none',
        'imageSource': None,
        'sourceUrl': None,
        'isActive': 0,
        'createdAt': None,
        'updatedAt': None,
        'recoveryStatus': 'historical_read_only',
        'nameCompleteness': 'preserved',
        'evidenceFiles': ['selection_recovery_bundles/livestream_products.json'],
        'evidenceQueryFiles': ['db-query-1770542064352.json'],
    })

critical = json.loads((ROOT / 'selection_product_critical_history_tables.json').read_text(encoding='utf-8'))
review_rows = []
for record in critical['receiptReviews']['records']:
    row = record.get('row') or {}
    name = row.get('productName')
    if not isinstance(name, str) or not name.strip():
        continue
    # Only rows with actual review fields, not product_master rows cross-copied into the audit artifact.
    if 'rating' not in row:
        continue
    name = name.strip()
    sid = f'name:{sha(norm(name))}'
    if any(item['sourceId'] == sid and item['sourceTable'] == 'receipt_reviews_sample' for item in review_rows):
        continue
    image = nullish(row.get('productImageUrl'))
    review_rows.append({
        'sourceTable': 'receipt_reviews_sample',
        'sourceId': sid,
        'displayName': name,
        'category': None,
        'description': f"保存済みreceipt_reviewsサンプル。rating={row.get('rating')}、visible={row.get('isVisible')}。全2,000レビュー/1,626商品名のうちローカル操作履歴に行内容が残ったサンプルのみ。",
        'brandId': None,
        'regularPrice': None,
        'specialPrice': None,
        'imageUrl': image,
        'imageStatus': 'saved_review_image' if image else 'none',
        'imageSource': 'saved_db_query' if image else None,
        'sourceUrl': None,
        'isActive': 0,
        'createdAt': None,
        'updatedAt': None,
        'recoveryStatus': 'historical_read_only',
        'nameCompleteness': 'truncated_or_unknown' if ('...' in name or '…' in name) else 'preserved',
        'evidenceFiles': ['auction_liver_recovery_bundles/01_livers.txt'],
        'evidenceQueryFiles': ['db-query-1772005697505.json'],
    })
historical_additions.extend(review_rows)

# Attach only images that passed exact-product verification, HTTP/format validation, and visual QA.
image_manifest_path = ROOT / 'selection_product_verified_downloaded_images.json'
verified_images = {}
if image_manifest_path.exists():
    image_manifest = json.loads(image_manifest_path.read_text(encoding='utf-8'))
    verified_images = {
        row['sourceKey']: row
        for row in image_manifest.get('images', [])
        if row.get('downloadStatus') == 'validated' and row.get('publicUrl')
    }
for row in main_products:
    verified = verified_images.get(row['sourceKey'])
    if verified:
        row['images'] = [verified['publicUrl']]
        row['productLink'] = verified.get('officialProductUrl')
        row['imageEvidence'] = {
            'assetFile': verified.get('assetFile'),
            'sha256': verified.get('sha256'),
            'bytes': verified.get('bytes'),
            'width': verified.get('width'),
            'height': verified.get('height'),
            'sourceQuality': verified.get('sourceQuality'),
            'officialProductUrl': verified.get('officialProductUrl'),
            'selectedImageUrl': verified.get('selectedImageUrl'),
            'visualReview': 'approved_exact_product',
        }
    else:
        row.setdefault('productLink', None)
        row['imageEvidence'] = None

# Validate identities and lengths before emitting the deployment dataset.
source_keys = [row['sourceKey'] for row in main_products]
if len(source_keys) != len(set(source_keys)):
    raise RuntimeError('duplicate main sourceKey')
if any(len(key) > 100 for key in source_keys):
    raise RuntimeError('sourceKey exceeds selection_products.productId length')
if any(len(row['productName']) > 500 for row in main_products):
    raise RuntimeError('productName exceeds selection_products length')
archive_keys = [f"{row['sourceTable']}:{row['sourceId']}" for row in historical_additions]
if len(archive_keys) != len(set(archive_keys)):
    raise RuntimeError('duplicate historical catalog key')

payload = {
    'version': '2026-08-26.selection-products-deep-v2',
    'recoveryKey': RECOVERY_KEY,
    'generatedAt': '2026-08-26T05:10:00+08:00',
    'rules': {
        'oldTiDBUsed': False,
        'mainProductStatus': 'offline',
        'doNotInferPriceStockImage': True,
        'brandProductRowsRequireStableSourceId': True,
        'livestreamRowsRequireExactSavedAggregateNameAndMetrics': True,
        'receiptReviewSamplesAreHistoricalReadOnly': True,
        'productMasterDuplicateIdsAreHistoricalReadOnly': True,
        'verifiedOfficialImagesOnly': True,
        'unrecoverableBoundary': 'The saved audit proves 2,000 receipt reviews and 1,626 unique product names, but only ten sampled review rows retain names. Missing names are never fabricated.',
    },
    'baseline': {
        'currentSelectionProducts': len(current_rows),
        'currentSourceKeys': sorted(current_keys),
        'savedReceiptReviewCount': 2000,
        'savedReceiptReviewUniqueProductCount': 1626,
        'savedReceiptReviewNamedSamples': len(review_rows),
    },
    'mainProducts': main_products,
    'historicalCatalogAdditions': historical_additions,
    'sourceAliases': source_aliases,
    'expected': {
        'mainProductsToInsert': len(main_products),
        'selectionProductsAfter': len(current_rows) + len(main_products),
        'historicalCatalogBefore': 10,
        'historicalCatalogAdditions': len(historical_additions),
        'historicalCatalogAfter': 10 + len(historical_additions),
        'brandProductSourceRowsToRestore': sum(1 for row in main_products if row['sourceClass'] == 'historical_brand_product') + sum(1 for row in source_aliases if row['sourceTable'] == 'brand_products'),
        'brandProductsAfter': 20 + sum(1 for row in main_products if row['sourceClass'] == 'historical_brand_product') + sum(1 for row in source_aliases if row['sourceTable'] == 'brand_products'),
        'productMasterRowsArchived': sum(1 for row in historical_additions if row['sourceTable'] == 'product_master'),
        'productMasterTableUnchanged': 10,
        'archiveAliasCount': len(source_aliases),
        'verifiedImageCount': len(verified_images),
    },
    'evidenceFiles': [
        'selection_recovery_bundles/brand_products.json',
        'selection_recovery_bundles/livestream_products.json',
        'auction_liver_recovery_bundles/01_livers.txt',
        'post_restore_backup/product_master.json',
        'current_40_products_image_inputs.tsv',
        'selection_product_external_brand_evidence_2026-08-26.md',
        'verify_38_recovered_products_official_sources.json',
        'selection_product_verified_downloaded_images.json',
    ],
}
canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
payload['evidenceSha256'] = hashlib.sha256(canonical.encode('utf-8')).hexdigest()

out = ROOT / 'server/selectionProductDeepRecoveryEvidence.json'
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
summary = {
    'recoveryKey': RECOVERY_KEY,
    'mainProductsToInsert': len(main_products),
    'mainByClass': {kind: sum(1 for row in main_products if row['sourceClass'] == kind) for kind in sorted({row['sourceClass'] for row in main_products})},
    'historicalCatalogAdditions': len(historical_additions),
    'historicalBySource': {kind: sum(1 for row in historical_additions if row['sourceTable'] == kind) for kind in sorted({row['sourceTable'] for row in historical_additions})},
    'sourceAliases': len(source_aliases),
    'expected': payload['expected'],
    'verifiedImageCount': len(verified_images),
    'maxProductNameLength': max(len(row['productName']) for row in main_products),
    'evidenceSha256': payload['evidenceSha256'],
    'output': str(out),
}
(ROOT / 'selection_product_deep_recovery_manifest_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False, indent=2))
