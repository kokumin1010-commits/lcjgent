from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

ROOT = Path('/home/ubuntu/lcjgent_restore')
AUDIT = ROOT / 'auction_liver_recovery_bundles/01_livers.txt'
CURRENT = ROOT / 'selection_product_current_40_baseline.json'

NAME_KEYS = ('productName', 'canonicalName')
SECONDARY_NAME_KEYS = ('name',)
PRODUCT_TABLE_RE = re.compile(r'(product|catalog|selection)', re.I)
SECONDARY_TABLE_RE = re.compile(r'(receipt|review|order|livestream|bundle|set)', re.I)
PLACEHOLDERS = {'', 'NULL', 'null', '商品名', 'product name', 'full product name in Japanese', 'string'}

def norm(value: str) -> str:
    text = unicodedata.normalize('NFKC', value or '').lower()
    text = re.sub(r'[\s\u3000\(\)（）\[\]【】/／・._\-+＋|｜,，:：]+', '', text)
    return text


def clean(value: Any) -> Any:
    if value is None or value == 'NULL':
        return None
    return value


def row_name(row: dict[str, Any], table: str) -> str | None:
    for key in NAME_KEYS:
        value = clean(row.get(key))
        if isinstance(value, str) and value.strip() not in PLACEHOLDERS:
            return value.strip()
    if PRODUCT_TABLE_RE.search(table):
        for key in SECONDARY_NAME_KEYS:
            value = clean(row.get(key))
            if isinstance(value, str) and value.strip() not in PLACEHOLDERS:
                return value.strip()
    return None


def row_id(row: dict[str, Any]) -> str | None:
    for key in ('productId', 'product_id', 'id', 'skuId', 'sku_id'):
        value = clean(row.get(key))
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def as_images(row: dict[str, Any]) -> list[str]:
    values: list[Any] = []
    for key in ('imageUrl', 'productImageUrl', 'mainImageUrl', 'image', 'imageUrls'):
        value = clean(row.get(key))
        if value is not None:
            values.append(value)
    out: list[str] = []
    for value in values:
        if isinstance(value, list):
            out.extend(str(item) for item in value if item)
        elif isinstance(value, str):
            value = value.strip()
            if not value:
                continue
            if value.startswith('['):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        out.extend(str(item) for item in parsed if item)
                        continue
                except Exception:
                    pass
            out.append(value)
    return list(dict.fromkeys(out))


def add_occurrence(out: list[dict[str, Any]], table: str, row: dict[str, Any], source_file: str, source_kind: str, query: str | None = None) -> None:
    name = row_name(row, table)
    if not name:
        return
    out.append({
        'table': table,
        'source_kind': source_kind,
        'source_file': source_file,
        'query': query,
        'source_id': row_id(row),
        'product_name': name,
        'brand_id': clean(row.get('brandId')),
        'brand_name': clean(row.get('brandName')),
        'product_code': clean(row.get('productCode')),
        'barcode': clean(row.get('barcode')),
        'price': clean(row.get('price', row.get('regularPrice', row.get('specialPrice')))),
        'market_price': clean(row.get('marketPrice', row.get('listPrice'))),
        'stock': clean(row.get('stock')),
        'gmv': clean(row.get('gmv', row.get('totalGmv', row.get('total_gmv')))),
        'items_sold': clean(row.get('itemsSold', row.get('totalSold'))),
        'images': as_images(row),
        'status': clean(row.get('status', row.get('isActive'))),
        'raw_row': row,
    })


def record_rows(value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                if isinstance(item.get('row'), dict):
                    rows.append(item['row'])
                elif isinstance(item.get('values'), dict):
                    rows.append(item['values'])
                else:
                    rows.append(item)
        return rows
    if not isinstance(value, dict):
        return rows
    for key in ('records', 'complete', 'missing_complete', 'missing_incomplete', 'required'):
        items = value.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            if isinstance(item.get('row'), dict):
                rows.append(item['row'])
            elif isinstance(item.get('values'), dict):
                rows.append(item['values'])
            else:
                rows.append(item)
    return rows


data = json.loads(AUDIT.read_text(encoding='utf-8'))
occurrences: list[dict[str, Any]] = []

# Snapshot used to build this audit bundle.
for row in data.get('baseline_backup', {}).get('rows', []):
    if isinstance(row, dict):
        add_occurrence(occurrences, data.get('baseline_backup', {}).get('table_name', 'unknown'), row, str(AUDIT.relative_to(ROOT)), 'baseline_backup')

# Historical DB query outputs.
for record in data.get('db_operation_history', []):
    if not isinstance(record, dict):
        continue
    content = record.get('content') if isinstance(record.get('content'), dict) else {}
    query = str(content.get('query') or '')
    tables = re.findall(r'\b(?:FROM|JOIN|UPDATE|INTO)\s+`?([A-Za-z0-9_]+)', query, flags=re.I)
    table = '+'.join(dict.fromkeys(tables)) or 'db_query'
    for row in content.get('rows', []) if isinstance(content.get('rows'), list) else []:
        if isinstance(row, dict):
            add_occurrence(occurrences, table, row, record.get('file', 'unknown'), 'db_query', query)

# Saved recovery extraction artifacts, preserving table boundaries.
for source in data.get('previous_recovery_sources', []):
    if not isinstance(source, dict):
        continue
    content = source.get('content')
    if not isinstance(content, dict):
        continue
    source_file = str(source.get('file') or 'unknown')
    tables = content.get('tables')
    if isinstance(tables, dict):
        for table, table_value in tables.items():
            if not isinstance(table, str):
                continue
            if not (PRODUCT_TABLE_RE.search(table) or SECONDARY_TABLE_RE.search(table)):
                continue
            for row in record_rows(table_value):
                add_occurrence(occurrences, table, row, source_file, 'recovery_extract')
    # Plain production health samples are product rows too.
    for row in content.get('samples', []) if isinstance(content.get('samples'), list) else []:
        if isinstance(row, dict):
            add_occurrence(occurrences, 'selection_products', row, source_file, 'production_sample')

# Add direct selection recovery bundle query rows that may not be copied into the larger audit file.
for path in sorted((ROOT / 'selection_recovery_bundles').glob('*.json')):
    try:
        doc = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        continue
    table = str(doc.get('table') or path.stem)
    for row in doc.get('baseline', {}).get('rows', []) if isinstance(doc.get('baseline'), dict) else []:
        if isinstance(row, dict):
            add_occurrence(occurrences, table, row, str(path.relative_to(ROOT)), 'selection_bundle_baseline')
    for record in doc.get('query_records', []) if isinstance(doc.get('query_records'), list) else []:
        if not isinstance(record, dict):
            continue
        payload = record.get('data') if isinstance(record.get('data'), dict) else {}
        query = str(payload.get('query') or '')
        tables = re.findall(r'\b(?:FROM|JOIN|UPDATE|INTO)\s+`?([A-Za-z0-9_]+)', query, flags=re.I)
        hint = '+'.join(dict.fromkeys(tables)) or table
        for row in payload.get('rows', []) if isinstance(payload.get('rows'), list) else []:
            if isinstance(row, dict):
                add_occurrence(occurrences, hint, row, str(record.get('file') or path.relative_to(ROOT)), 'selection_bundle_query', query)

current = json.loads(CURRENT.read_text(encoding='utf-8'))['products']
current_names = [(int(row['id']), row['productName'], norm(row['productName'])) for row in current]
current_source_rows: dict[str, tuple[int, str]] = {}
source_tsv = ROOT / 'current_40_products_image_inputs.tsv'
if source_tsv.exists():
    for line in source_tsv.read_text(encoding='utf-8').splitlines():
        fields = line.split('\t')
        if len(fields) >= 3:
            source_type, source_id, name = fields[:3]
            current_source_rows[f'{source_type}:{source_id}'] = (len(current_source_rows) + 1, name)

# Consolidate by table + source ID + normalized name while retaining all independent evidence locations.
consolidated: dict[str, dict[str, Any]] = {}
for row in occurrences:
    n = norm(row['product_name'])
    if not n:
        continue
    stable = f"{row['table']}:{row['source_id']}" if row['source_id'] else f"{row['table']}:name:{hashlib.sha256(n.encode()).hexdigest()[:16]}"
    key = f'{stable}:{n}'
    item = consolidated.setdefault(key, {
        'candidate_key': stable,
        'table': row['table'],
        'source_id': row['source_id'],
        'product_name': row['product_name'],
        'brand_id': row['brand_id'],
        'brand_name': row['brand_name'],
        'product_code': row['product_code'],
        'barcode': row['barcode'],
        'price': row['price'],
        'market_price': row['market_price'],
        'stock': row['stock'],
        'gmv': row['gmv'],
        'items_sold': row['items_sold'],
        'images': row['images'],
        'sources': [],
    })
    for field in ('brand_id', 'brand_name', 'product_code', 'barcode', 'price', 'market_price', 'stock', 'gmv', 'items_sold'):
        if item.get(field) is None and row.get(field) is not None:
            item[field] = row[field]
    item['images'] = list(dict.fromkeys([*item.get('images', []), *row.get('images', [])]))
    source_entry = {'source_kind': row['source_kind'], 'source_file': row['source_file'], 'query_sha256': hashlib.sha256((row['query'] or '').encode()).hexdigest()[:16] if row['query'] else None}
    if source_entry not in item['sources']:
        item['sources'].append(source_entry)

# Compare to current rows by source key and normalized/fuzzy name.
for item in consolidated.values():
    expected_key = None
    table_lower = item['table'].lower()
    if item['source_id']:
        if table_lower == 'mall_products':
            expected_key = f"mall:{item['source_id']}"
        elif table_lower == 'brand_products':
            expected_key = f"brand:{item['source_id']}"
    item['current_source_match'] = expected_key if expected_key in current_source_rows else None
    exact = [pid for pid, _, n in current_names if n == norm(item['product_name'])]
    fuzzy = sorted([
        {'id': pid, 'name': name, 'ratio': round(SequenceMatcher(None, norm(item['product_name']), n).ratio(), 4)}
        for pid, name, n in current_names
    ], key=lambda x: x['ratio'], reverse=True)[:3]
    item['current_exact_ids'] = exact
    item['current_fuzzy_top'] = fuzzy
    item['is_truncated'] = '...' in item['product_name'] or '…' in item['product_name']

items = sorted(consolidated.values(), key=lambda x: (x['table'], str(x['source_id'] or ''), x['product_name']))
by_table = Counter(item['table'] for item in items)
summary = {
    'occurrenceCount': len(occurrences),
    'candidateCount': len(items),
    'uniqueNameCount': len({norm(item['product_name']) for item in items}),
    'byTable': dict(sorted(by_table.items())),
    'currentProductCount': len(current),
    'currentSourceKeyCount': len(current_source_rows),
}

(ROOT / 'selection_product_all_structured_candidates.json').write_text(json.dumps({'summary': summary, 'candidates': items}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(ROOT / 'selection_product_all_structured_candidates.tsv').write_text(
    '\n'.join('\t'.join([
        str(item['table']), str(item['source_id'] or ''), item['product_name'], str(item['brand_id'] or ''),
        str(item['price'] or ''), str(item['gmv'] or ''), str(len(item['sources'])), str(item['current_source_match'] or ''),
        ','.join(map(str, item['current_exact_ids'])), str(item['current_fuzzy_top'][0]['ratio'] if item['current_fuzzy_top'] else ''),
        str(item['current_fuzzy_top'][0]['name'] if item['current_fuzzy_top'] else ''), 'truncated' if item['is_truncated'] else 'complete'
    ]) for item in items) + '\n', encoding='utf-8'
)
print(json.dumps(summary, ensure_ascii=False, indent=2))
