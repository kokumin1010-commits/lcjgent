#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

BASE = 'https://lcjmall.com'
OUTPUT = Path('/home/ubuntu/lcjgent_restore/account_import_production_http_verification.json')


def error_code(response: requests.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, list):
            payload = payload[0]
        return str(payload.get('error', {}).get('json', {}).get('data', {}).get('code') or payload.get('error', {}).get('json', {}).get('code') or '')
    except Exception:
        return ''


empty_input = quote(json.dumps({'json': {}}, separators=(',', ':')))
queries = {}
for procedure in ['account.listAccounts', 'account.listContacts', 'account.listReferences', 'account.listWorkbookImports']:
    response = requests.get(f'{BASE}/api/trpc/{procedure}?input={empty_input}', timeout=30)
    queries[procedure] = {'httpStatus': response.status_code, 'code': error_code(response)}

mutations = {}
for procedure, payload in [
    ('account.previewWorkbook', {'fileName': 'accounts.xlsx', 'fileBase64': 'UEs='}),
    ('account.importWorkbook', {'fileName': 'accounts.xlsx', 'fileBase64': 'UEs=', 'confirmSha256': '0' * 64}),
]:
    response = requests.post(f'{BASE}/api/trpc/{procedure}', json={'json': payload}, timeout=30)
    mutations[procedure] = {'httpStatus': response.status_code, 'code': error_code(response)}

page = requests.get(f'{BASE}/master/account-management?verify-import-http=1', timeout=30)
missing = requests.get(f'{BASE}/assets/account-import-definitely-missing.js', timeout=30)
permissions_policy = page.headers.get('Permissions-Policy', '')
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'baseUrl': BASE,
    'pageHttpStatus': page.status_code,
    'contentType': page.headers.get('Content-Type'),
    'permissionsPolicy': permissions_policy,
    'unauthenticatedQueries': queries,
    'unauthenticatedMutations': mutations,
    'missingAsset': {
        'httpStatus': missing.status_code,
        'cacheControl': missing.headers.get('Cache-Control'),
        'contentType': missing.headers.get('Content-Type'),
    },
    'productionWrites': 0,
}
all_rejections = list(queries.values()) + list(mutations.values())
report['passed'] = all([
    page.status_code == 200,
    all(item['httpStatus'] == 401 and item['code'] == 'UNAUTHORIZED' for item in all_rejections),
    missing.status_code == 404,
    'no-store' in str(missing.headers.get('Cache-Control', '')).lower(),
    'microphone=(self)' in permissions_policy,
])
OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(0 if report['passed'] else 1)
