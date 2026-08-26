from __future__ import annotations

import hashlib
import html
import io
import json
import re
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path('/home/ubuntu/lcjgent_restore')
INPUT = ROOT / 'verify_38_recovered_products_official_sources.json'
OUT_DIR = ROOT / 'client/public/recovered-product-images-v2'
MANIFEST = ROOT / 'selection_product_verified_downloaded_images.json'
CONTACT = ROOT / 'selection_product_verified_images_contact_sheet.jpg'
OUT_DIR.mkdir(parents=True, exist_ok=True)
for old in OUT_DIR.iterdir():
    if old.is_file():
        old.unlink()

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/139 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
}
# Visual QA identified this URL as a full shopping-page screenshot, not a clean product asset.
MANUAL_IMAGE_REJECT_SOURCE_KEYS = {'livestream-history:e7c769e933b8ddc4'}


def ext_for(fmt: str | None, content_type: str) -> str:
    fmt = (fmt or '').upper()
    if fmt == 'JPEG': return '.jpg'
    if fmt == 'PNG': return '.png'
    if fmt == 'WEBP': return '.webp'
    if fmt == 'GIF': return '.gif'
    if fmt == 'AVIF': return '.avif'
    if 'jpeg' in content_type: return '.jpg'
    if 'png' in content_type: return '.png'
    if 'webp' in content_type: return '.webp'
    return '.img'


def slug(value: str) -> str:
    value = re.sub(r'[^A-Za-z0-9]+', '_', value).strip('_').lower()
    return value[:70] or 'product'


def page_image_candidates(page_url: str) -> tuple[list[str], str | None]:
    if not page_url.startswith('https://'):
        return [], None
    try:
        response = requests.get(page_url, headers={**HEADERS, 'Accept': 'text/html,application/xhtml+xml'}, timeout=(10, 35), allow_redirects=True)
        if response.status_code != 200:
            return [], f'page_http_status={response.status_code}'
        soup = BeautifulSoup(response.text, 'html.parser')
        candidates: list[str] = []
        selectors = [
            ('meta', {'property': 'og:image'}, 'content'),
            ('meta', {'property': 'og:image:secure_url'}, 'content'),
            ('meta', {'name': 'twitter:image'}, 'content'),
            ('link', {'rel': 'image_src'}, 'href'),
        ]
        for tag, attrs, field in selectors:
            node = soup.find(tag, attrs=attrs)
            value = node.get(field) if node else None
            if value:
                candidates.append(urljoin(response.url, html.unescape(str(value))))
        for node in soup.find_all('script', attrs={'type': 'application/ld+json'}):
            try:
                payload = json.loads(node.string or node.get_text() or '{}')
            except Exception:
                continue
            queue = payload if isinstance(payload, list) else [payload]
            for item in queue:
                if not isinstance(item, dict):
                    continue
                image_value = item.get('image')
                if isinstance(image_value, str):
                    candidates.append(urljoin(response.url, image_value))
                elif isinstance(image_value, list):
                    for value in image_value:
                        if isinstance(value, str):
                            candidates.append(urljoin(response.url, value))
                        elif isinstance(value, dict) and isinstance(value.get('url'), str):
                            candidates.append(urljoin(response.url, value['url']))
                elif isinstance(image_value, dict) and isinstance(image_value.get('url'), str):
                    candidates.append(urljoin(response.url, image_value['url']))
        return list(dict.fromkeys(url for url in candidates if url.startswith('https://'))), None
    except Exception as error:
        return [], f'page_fetch_error={error}'


def validate_image_url(url: str, referer: str) -> tuple[bytes, dict]:
    headers = dict(HEADERS)
    if referer.startswith('https://'):
        headers['Referer'] = referer
    response = requests.get(url, headers=headers, timeout=(10, 35), allow_redirects=True)
    content_type = response.headers.get('content-type', '').split(';')[0].lower()
    payload = response.content
    if response.status_code != 200:
        raise ValueError(f'http_status={response.status_code}')
    if len(payload) < 5000:
        raise ValueError(f'image_too_small_bytes={len(payload)}')
    if 'svg' in content_type or payload.lstrip().startswith(b'<svg'):
        raise ValueError('svg_not_used_for_product_photo')
    with Image.open(io.BytesIO(payload)) as image:
        image.load()
        width, height = image.size
        fmt = image.format
    if width < 120 or height < 120:
        raise ValueError(f'image_dimensions_too_small={width}x{height}')
    extension = ext_for(fmt, content_type)
    if extension == '.img':
        raise ValueError(f'unsupported_image_format={fmt}/{content_type}')
    return payload, {
        'finalUrl': response.url,
        'contentType': content_type,
        'imageFormat': fmt,
        'width': width,
        'height': height,
        'extension': extension,
    }


doc = json.loads(INPUT.read_text(encoding='utf-8'))
records = []
seen_sha: dict[str, str] = {}
for item in doc.get('results', []):
    output = item.get('output') or {}
    source_key = str(output.get('source_key') or '')
    product_name = str(output.get('product_name') or '')
    direct_url = str(output.get('official_image_url') or '')
    page_url = str(output.get('official_product_url') or '')
    action = str(output.get('recommended_image_action') or '')
    exact = output.get('exact_match') is True
    base = {
        'sourceKey': source_key,
        'productName': product_name,
        'exactMatch': exact,
        'sourceQuality': output.get('source_quality') or 'none',
        'officialProductUrl': page_url or None,
        'officialImageUrl': direct_url or None,
        'evidenceSummary': output.get('evidence_summary') or None,
        'downloadStatus': 'not_eligible',
        'rejectReason': None,
        'attempts': [],
    }
    if source_key in MANUAL_IMAGE_REJECT_SOURCE_KEYS:
        base['rejectReason'] = 'manual_visual_qa_rejected_full_page_screenshot'
        records.append(base)
        continue
    if not (exact and action == 'use_exact_official_image'):
        base['rejectReason'] = 'no exact official image approved'
        records.append(base)
        continue

    candidates = [direct_url] if direct_url.startswith('https://') else []
    page_candidates, page_error = page_image_candidates(page_url)
    candidates.extend(page_candidates)
    candidates = list(dict.fromkeys(candidates))
    if page_error:
        base['attempts'].append({'url': page_url, 'error': page_error, 'kind': 'product_page'})

    accepted = False
    for candidate_url in candidates:
        try:
            payload, meta = validate_image_url(candidate_url, page_url)
            digest = hashlib.sha256(payload).hexdigest()
            filename = f"{slug(source_key)}_{digest[:16]}{meta['extension']}"
            if digest in seen_sha:
                filename = seen_sha[digest]
            else:
                (OUT_DIR / filename).write_bytes(payload)
                seen_sha[digest] = filename
            base.update({
                'downloadStatus': 'validated',
                'rejectReason': None,
                'selectedImageUrl': candidate_url,
                'finalUrl': meta['finalUrl'],
                'publicUrl': f'/recovered-product-images-v2/{filename}',
                'assetFile': str((OUT_DIR / filename).relative_to(ROOT)),
                'sha256': digest,
                'bytes': len(payload),
                'contentType': meta['contentType'],
                'imageFormat': meta['imageFormat'],
                'width': meta['width'],
                'height': meta['height'],
            })
            accepted = True
            break
        except Exception as error:
            base['attempts'].append({'url': candidate_url, 'error': str(error), 'kind': 'image_candidate'})
    if not accepted:
        base['downloadStatus'] = 'rejected'
        base['rejectReason'] = '; '.join(attempt['error'] for attempt in base['attempts'][-3:]) or 'no_valid_image_candidate'
    records.append(base)

summary = {
    'inputCount': len(records),
    'exactMatchCount': sum(1 for row in records if row['exactMatch']),
    'validatedCount': sum(1 for row in records if row['downloadStatus'] == 'validated'),
    'rejectedCount': sum(1 for row in records if row['downloadStatus'] == 'rejected'),
    'notEligibleCount': sum(1 for row in records if row['downloadStatus'] == 'not_eligible'),
    'uniqueAssetCount': len({row.get('sha256') for row in records if row.get('sha256')}),
}
MANIFEST.write_text(json.dumps({'summary': summary, 'images': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

validated = [row for row in records if row['downloadStatus'] == 'validated']
if validated:
    cell_w, cell_h = 360, 300
    columns = 4
    rows_n = (len(validated) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * cell_w, rows_n * cell_h), 'white')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, row in enumerate(validated):
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        with Image.open(ROOT / row['assetFile']) as image:
            image = image.convert('RGB')
            thumb = ImageOps.contain(image, (cell_w - 20, cell_h - 70))
            sheet.paste(thumb, (x + (cell_w - thumb.width) // 2, y + 5))
        label = f"{row['sourceKey']}\n{row['productName'][:42]}\n{row['width']}x{row['height']} {row['sourceQuality']}"
        draw.multiline_text((x + 8, y + cell_h - 62), label, fill='black', font=font, spacing=2)
        draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline='#b0b0b0', width=1)
    sheet.save(CONTACT, quality=88, optimize=True)

print(json.dumps(summary, ensure_ascii=False, indent=2))
