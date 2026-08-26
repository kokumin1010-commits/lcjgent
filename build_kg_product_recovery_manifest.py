from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any
from PIL import Image

ROOT = Path('/home/ubuntu/lcjgent_restore')
EVIDENCE_OUT = ROOT / 'server/kgProductRecoveryEvidence.json'


def normalize(value: object) -> str:
    text = unicodedata.normalize('NFKC', str(value or '')).casefold()
    return re.sub(r'[^0-9a-z\u3040-\u30ff\u3400-\u9fff]+', '', text)


def source_hash(prefix: str, value: str) -> str:
    return f"{prefix}:{hashlib.sha256(value.encode('utf-8')).hexdigest()[:16]}"


def image_evidence(public_path: str, official_image_url: str, source_page_url: str) -> dict[str, Any]:
    local_path = ROOT / 'client' / 'public' / public_path.lstrip('/')
    raw = local_path.read_bytes()
    with Image.open(local_path) as image:
        width, height = image.size
        content_type = Image.MIME.get(image.format, f'image/{local_path.suffix.lstrip(".")}')
    return {
        'assetFile': str(local_path.relative_to(ROOT)),
        'publicUrl': public_path,
        'officialImageUrl': official_image_url,
        'sourcePageUrl': source_page_url,
        'sha256': hashlib.sha256(raw).hexdigest(),
        'bytes': len(raw),
        'width': width,
        'height': height,
        'contentType': content_type,
        'visualReview': 'approved_exact_product_no_current_price',
    }


def load_current_names() -> tuple[set[str], set[str]]:
    names: set[str] = set()
    keys: set[str] = set()
    tsv = ROOT / 'current_40_products_image_inputs.tsv'
    for index, line in enumerate(tsv.read_text(encoding='utf-8').splitlines()):
        if index == 0 or not line.strip():
            continue
        cells = line.split('\t')
        if len(cells) >= 3:
            keys.add(f'{cells[0]}:{cells[1]}')
            names.add(normalize(cells[2]))
    v2 = json.loads((ROOT / 'server/selectionProductDeepRecoveryEvidence.json').read_text(encoding='utf-8'))
    for row in v2.get('mainProducts', []):
        keys.add(str(row.get('sourceKey') or ''))
        names.add(normalize(row.get('productName')))
    return names, keys


def parse_receipt_group_rows() -> list[dict[str, Any]]:
    text = (ROOT / 'auction_liver_recovery_bundles/04_livestream_set_items.txt').read_text(encoding='utf-8', errors='replace')
    block_re = re.compile(r'"row"\s*:\s*\{(.*?)\}\s*,\s*"source_file"\s*:\s*"([^"]+)"', re.S)
    rows: list[dict[str, Any]] = []
    for block, source_file in block_re.findall(text):
        def find_string(key: str) -> str | None:
            match = re.search(rf'"{re.escape(key)}"\s*:\s*"([^"]*)"', block)
            return match.group(1) if match else None
        name = find_string('productName')
        shop = find_string('shopName')
        if not name or not shop or 'KYOGOKU' not in shop.upper():
            continue
        cnt_raw = find_string('cnt')
        total_raw = find_string('totalAmount')
        rows.append({
            'productName': name,
            'shopName': shop,
            'count': int(cnt_raw) if cnt_raw and cnt_raw.isdigit() else None,
            'totalAmount': int(total_raw) if total_raw and total_raw.isdigit() else None,
            'sourceFile': source_file,
        })
    dedup: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row['productName'], row['shopName'])
        existing = dedup.get(key)
        if not existing or (row.get('totalAmount') is not None and existing.get('totalAmount') is None):
            dedup[key] = row
    return list(dedup.values())


def parse_line_receipt_items() -> list[dict[str, Any]]:
    payload = json.loads((ROOT / 'post_restore_backup/line_receipts.json').read_text(encoding='utf-8'))
    rows: list[dict[str, Any]] = []
    for receipt in payload.get('rows', []):
        raw = receipt.get('ocrRawText')
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except Exception:
            continue
        shop = str(parsed.get('shopName') or receipt.get('storeName') or '')
        if 'KYOGOKU' not in shop.upper():
            continue
        for item in parsed.get('items') or []:
            rows.append({
                'receiptId': receipt.get('id'),
                'productName': item.get('productName'),
                'unitPrice': item.get('unitPrice'),
                'quantity': item.get('quantity'),
                'variant': item.get('variant'),
                'shopName': shop,
                'purchaseDate': receipt.get('purchaseDate'),
                'receiptStatus': receipt.get('status'),
                'ocrConfidence': receipt.get('ocrConfidence'),
                'imageHash': receipt.get('imageHash'),
            })
    return rows


current_names, current_keys = load_current_names()
receipt_groups = parse_receipt_group_rows()
line_items = parse_line_receipt_items()
receipt_by_name = {row['productName']: row for row in receipt_groups}

required_group_names = {
    'KYOGOKU クリスタルスキン ハイドロテックブライトマスク5枚',
    'KYOGOKU ケラチンヘアマスクキャップ5枚',
    'KYOGOKU ケラチンヘアマスクキャップ5個',
    'KYOGOKU ステムセル フェイシャルオイル2本',
    'KYOGOKU ステムセル フェイシャルオイル2本セット',
    'KYOGOKU カラーシャンプー ハイトーン',
    'KYOGOKU MEGAガチャ袋 【KG MEGA ガチャ袋 Aタイプ2980円】',
}
missing_required = sorted(name for name in required_group_names if name not in receipt_by_name)
if missing_required:
    raise RuntimeError(f'missing required receipt group evidence: {missing_required}')

body_wash = next((row for row in line_items if row.get('productName') == 'KYOGOKU ラオイル ボディ ウォッシュ ボディケアタイム'), None)
if not body_wash:
    raise RuntimeError('missing direct line receipt body wash evidence')
mask_alias_rows = [row for row in line_items if row.get('productName') == 'KG KYOGOKU PROFESSIONAL クリスタルスキン ブライトニング マスク 洗い流す美容パック']
if len(mask_alias_rows) < 2:
    raise RuntimeError('expected duplicate direct line receipt mask evidence')

main_specs = [
    ('KYOGOKU クリスタルスキン ハイドロテックブライトマスク5枚', 'receipt_products', receipt_by_name['KYOGOKU クリスタルスキン ハイドロテックブライトマスク5枚']),
    ('KYOGOKU カラーシャンプー ハイトーン', 'receipt_products', receipt_by_name['KYOGOKU カラーシャンプー ハイトーン']),
    ('KYOGOKU ラオイル ボディ ウォッシュ ボディケアタイム', 'line_receipts', body_wash),
]

official_metadata = {
    'KYOGOKU クリスタルスキン ハイドロテックブライトマスク5枚': {
        'officialName': 'KYOGOKU クリスタルスキン ハイドロテックブライトニングマスク',
        'officialProductCode': '1950',
        'officialUrl': 'https://kyogokupro.com/products/detail/1950',
        'officialImageUrl': 'https://item.rakuten.co.jp/kyogokupro/kg1950/',
        'imagePath': '/selection-product-images/kg-v3/kyogoku_hydro_tech_brightening_mask_clean.webp',
    },
    'KYOGOKU カラーシャンプー ハイトーン': {
        'officialName': 'KYOGOKU カラーシャンプー',
        'officialProductCode': 'kg4',
        'barcode': '4580431290554',
        'officialUrl': 'https://store.shopping.yahoo.co.jp/kyogokupro/kg4.html',
        'officialImageUrl': 'https://shopping.c.yimg.jp/lib/kyogokupro/kg04bp.jpg?size=n',
        'imagePath': '/selection-product-images/kg-v3/kyogoku_color_shampoo_blue_purple.jpg',
    },
    'KYOGOKU ラオイル ボディ ウォッシュ ボディケアタイム': {
        'officialName': 'KYOGOKU ラオイル ボディセラムウォッシュ',
        'officialProductCode': 'kg022',
        'barcode': '4580802790898',
        'officialUrl': 'https://store.shopping.yahoo.co.jp/kyogokupro/kg022.html',
        'officialImageUrl': 'https://item.rakuten.co.jp/kyogokupro/kg022/',
        'imagePath': '/selection-product-images/kg-v3/kyogoku_laoil_body_serum_wash_clean.webp',
    },
}

main_products: list[dict[str, Any]] = []
for product_name, source_table, source in main_specs:
    source_key = source_hash('kg-receipt-product', f'{source_table}|{product_name}')
    if normalize(product_name) in current_names:
        continue
    official = official_metadata[product_name]
    main_products.append({
        'sourceClass': 'kg_receipt_direct_product',
        'sourceTable': source_table,
        'sourceId': str(source.get('receiptId') or source.get('sourceFile') or source_key),
        'sourceKey': source_key,
        'productName': product_name,
        'brandId': 91,
        'brandName': 'KYOGOKU JAPAN',
        'status': 'offline',
        'price': None,
        'marketPrice': None,
        'historicalLowestPrice': None,
        'stock': 0,
        'images': [official['imagePath']],
        'officialName': official['officialName'],
        'officialProductCode': official['officialProductCode'],
        'barcode': official.get('barcode'),
        'officialUrl': official['officialUrl'],
        'imageEvidence': image_evidence(official['imagePath'], official['officialImageUrl'], official['officialUrl']),
        'description': '保存済みKG/KYOGOKU購入証拠から復元したオフライン商品。現在価格・在庫は未復元。公式同款画像のみ補完。',
        'historicalEvidence': source,
        'evidenceFiles': [
            'auction_liver_recovery_bundles/04_livestream_set_items.txt' if source_table == 'receipt_products' else 'post_restore_backup/line_receipts.json',
            'auction_liver_recovery_bundles/14_liver_goals.txt' if source_table == 'line_receipts' else 'kg_product_deep_search_bundles/05_receipts_and_variants.md',
        ],
    })

variant_prices = {
    'Aタイプ': 2980,
    'Bタイプ': 4950,
    'Cタイプ': 9900,
    'Dタイプ': 13500,
    'Sタイプ': 1500,
}
child_skus: list[dict[str, Any]] = []
color_parent_source_key = source_hash('kg-receipt-product', 'receipt_products|KYOGOKU カラーシャンプー ハイトーン')
for variant, sku_suffix, image_name, official_image_url in [
    ('ブルーパープル', 'BP', 'kyogoku_color_shampoo_blue_purple.jpg', 'https://shopping.c.yimg.jp/lib/kyogokupro/kg04bp.jpg?size=n'),
    ('ピンクパープル', 'PP', 'kyogoku_color_shampoo_pink_purple.jpg', 'https://shopping.c.yimg.jp/lib/kyogokupro/kg04pp.jpg?size=n'),
    ('ブロンド', 'BL', 'kyogoku_color_shampoo_blonde.jpg', 'https://shopping.c.yimg.jp/lib/kyogokupro/kg04bl.jpg?size=n'),
]:
    child_skus.append({
        'parentSourceKey': color_parent_source_key,
        'sourceKey': source_hash('kg-child-sku', f'{color_parent_source_key}|{variant}'),
        'sourceClass': 'kg_official_catalog_variant',
        'sourceTable': 'kyogoku_official_catalog',
        'productName': f'KYOGOKU カラーシャンプー {variant}',
        'sku': f'KG-COLOR-SHAMPOO-{sku_suffix}',
        'variant': variant,
        'brandId': 91,
        'brandName': 'KYOGOKU JAPAN',
        'price': None,
        'historicalLowestPrice': None,
        'stock': 0,
        'status': 'offline',
        'images': [f'/selection-product-images/kg-v3/{image_name}'],
        'officialProductCode': 'kg4',
        'barcode': '4580431290554',
        'officialUrl': 'https://store.shopping.yahoo.co.jp/kyogokupro/kg4.html',
        'imageEvidence': image_evidence(f'/selection-product-images/kg-v3/{image_name}', official_image_url, 'https://store.shopping.yahoo.co.jp/kyogokupro/kg4.html'),
        'description': f'保存済み父商品とKYOGOKU公式カタログから復元した{variant}子SKU。ウェブ現在価格は未記録。',
        'evidenceFiles': ['auction_liver_recovery_bundles/04_livestream_set_items.txt', 'kg_product_official_verification_2026-08-26.md'],
    })

for variant, historical_price in variant_prices.items():
    child_skus.append({
        'parentSourceKey': 'historical-master:30001',
        'sourceKey': source_hash('kg-child-sku', f'historical-master:30001|{variant}'),
        'sourceClass': 'kg_saved_livestream_variant',
        'sourceTable': 'livestream_products',
        'productName': f'KYOGOKU MEGAガチャ袋 {variant}',
        'sku': f'KG-MEGA-{variant[0]}',
        'variant': variant,
        'brandId': 91,
        'brandName': 'KYOGOKU JAPAN',
        'price': None,
        'historicalLowestPrice': historical_price,
        'stock': 0,
        'status': 'offline',
        'images': [],
        'description': f'保存済み直播商品名から復元した{variant}の履歴価格 ¥{historical_price:,}。現在価格ではありません。',
        'evidenceFiles': ['selection_recovery_bundles/livestream_products.json', 'reports_accounts_products_content_bundles/10_product_db_history_evidence.md'],
    })

child_skus.extend([
    {
        'parentSourceKey': 'mall:90006',
        'sourceKey': source_hash('kg-child-sku', 'mall:90006|5枚セット'),
        'sourceClass': 'kg_saved_receipt_variant',
        'sourceTable': 'receipt_products',
        'productName': 'KYOGOKU ケラチンヘアマスクキャップ 5枚セット',
        'sku': 'KG-KERATIN-MASK-5',
        'variant': '5枚セット',
        'brandId': 91,
        'brandName': 'KYOGOKU JAPAN',
        'price': None,
        'historicalLowestPrice': None,
        'stock': 0,
        'status': 'offline',
        'images': [],
        'description': '保存済みreceipt_productsに5枚/5個表記の購入実績あり。価格は現在値として復元しません。',
        'evidenceFiles': ['auction_liver_recovery_bundles/04_livestream_set_items.txt'],
        'aliases': ['KYOGOKU ケラチンヘアマスクキャップ5枚', 'KYOGOKU ケラチンヘアマスクキャップ5個'],
    },
    {
        'parentSourceKey': 'historical-master:13',
        'sourceKey': source_hash('kg-child-sku', 'historical-master:13|2本セット'),
        'sourceClass': 'kg_saved_receipt_variant',
        'sourceTable': 'receipt_products',
        'productName': 'KYOGOKU ステムセル フェイシャルオイル 2本セット',
        'sku': 'KG-STEMCELL-OIL-2',
        'variant': '2本セット',
        'brandId': 91,
        'brandName': 'KYOGOKU JAPAN',
        'price': None,
        'historicalLowestPrice': None,
        'stock': 0,
        'status': 'offline',
        'images': [],
        'description': '保存済みreceipt_productsに2本/2本セット表記の購入実績あり。価格は現在値として復元しません。',
        'evidenceFiles': ['auction_liver_recovery_bundles/04_livestream_set_items.txt'],
        'aliases': ['KYOGOKU ステムセル フェイシャルオイル2本', 'KYOGOKU ステムセル フェイシャルオイル2本セット'],
    },
])

historical_only: list[dict[str, Any]] = []
for row in receipt_groups:
    name = row['productName']
    if normalize(name) in current_names:
        continue
    if any(normalize(item['productName']) == normalize(name) for item in main_products):
        continue
    if any(normalize(name) == normalize(alias) for child in child_skus for alias in child.get('aliases', [])):
        continue
    classification = 'historical_receipt_name'
    reason = '保存済みreceipt_products集計。商品名が省略・組合せ・予約セット、または独立主商品としての安定識別子が不足するため、主一覧には入れない。'
    historical_only.append({
        'sourceKey': source_hash('kg-receipt-history', f"{row['shopName']}|{name}"),
        'productName': name,
        'brandName': row['shopName'],
        'sourceType': classification,
        'sourceId': row.get('sourceFile'),
        'sourceTable': 'receipt_products',
        'historicalPrice': None,
        'historicalGmv': row.get('totalAmount'),
        'historicalSold': row.get('count'),
        'evidenceFiles': ['auction_liver_recovery_bundles/04_livestream_set_items.txt'],
        'reason': reason,
    })

historical_only.append({
    'sourceKey': source_hash('kg-line-receipt-alias', 'KG KYOGOKU PROFESSIONAL クリスタルスキン ブライトニング マスク 洗い流す美容パック'),
    'productName': 'KG KYOGOKU PROFESSIONAL クリスタルスキン ブライトニング マスク 洗い流す美容パック',
    'brandName': 'KYOGOKU JAPAN',
    'sourceType': 'existing_product_alias',
    'sourceId': ','.join(str(row.get('receiptId')) for row in mask_alias_rows),
    'sourceTable': 'line_receipts',
    'historicalPrice': 5000,
    'historicalGmv': None,
    'historicalSold': len(mask_alias_rows),
    'evidenceFiles': ['post_restore_backup/line_receipts.json', 'auction_liver_recovery_bundles/14_liver_goals.txt'],
    'reason': '既存mall:90013商品の保存済み別表記。重複主商品を作らず只読証拠として保存。',
})

# Keep deterministic uniqueness.
def unique_by(rows: list[dict[str, Any]], key_name: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for row in rows:
        key = str(row[key_name])
        if key in seen:
            continue
        seen.add(key)
        output.append(row)
    return output

main_products = unique_by(main_products, 'sourceKey')
child_skus = unique_by(child_skus, 'sourceKey')
historical_only = unique_by(historical_only, 'sourceKey')

for row in main_products:
    if row['sourceKey'] in current_keys:
        raise RuntimeError(f'new main product collides with current source key: {row["sourceKey"]}')
valid_parent_keys = current_keys | {str(row['sourceKey']) for row in main_products}
for row in child_skus:
    if row['parentSourceKey'] not in valid_parent_keys:
        raise RuntimeError(f'missing current or same-batch parent source key: {row["parentSourceKey"]}')

manifest: dict[str, Any] = {
    'version': 3,
    'recoveryKey': 'kg-product-priority-v3',
    'generatedAt': '2026-08-26T07:20:00+08:00',
    'rules': {
        'oldTiDBUsed': False,
        'onlySavedDirectEvidence': True,
        'doNotOverwriteManualProducts': True,
        'newRowsOffline': True,
        'webCurrentPricesNotWritten': True,
        'truncatedOrComboNamesHistoricalOnly': True,
        'noEmptyChildSkuPlaceholderRows': True,
    },
    'baseline': {
        'productionSelectionProductTotal': 83,
        'knownFirstRecoveryKgRows': 13,
        'knownSecondRecoveryKgRows': 22,
        'knownKgMainRowsBefore': 35,
    },
    'expected': {
        'mainProductsMaximumToInsert': len(main_products),
        'childSkusMaximumToInsert': len(child_skus),
        'historicalCatalogMaximumToInsert': len(historical_only),
        'selectionProductMaximumAfter': 83 + len(main_products) + len(child_skus),
        'kgMainMaximumAfter': 35 + len(main_products) + len(child_skus),
    },
    'mainProducts': main_products,
    'childSkus': child_skus,
    'historicalCatalogAdditions': historical_only,
    'sourceEvidence': {
        'receiptGroupRows': receipt_groups,
        'lineReceiptItems': line_items,
    },
}
canonical = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
manifest['evidenceSha256'] = hashlib.sha256(canonical).hexdigest()
EVIDENCE_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

summary = {
    'mainProducts': len(main_products),
    'childSkus': len(child_skus),
    'historicalCatalogAdditions': len(historical_only),
    'selectionProductMaximumAfter': manifest['expected']['selectionProductMaximumAfter'],
    'kgMainMaximumAfter': manifest['expected']['kgMainMaximumAfter'],
    'evidenceSha256': manifest['evidenceSha256'],
    'mainProductNames': [row['productName'] for row in main_products],
    'childSkuNames': [row['productName'] for row in child_skus],
}
(ROOT / 'kg_product_recovery_manifest_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False, indent=2))
