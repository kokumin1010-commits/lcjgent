const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const TEST_IMAGES = [
  { path: '/home/ubuntu/upload/search_images/FTSjcgo19Zim.png', desc: 'TikTok Shop Customer Info' },
  { path: '/home/ubuntu/upload/search_images/dZGxP8WiV0OP.png', desc: '日本の領収書 (佐藤鈴木)' },
  { path: '/home/ubuntu/upload/search_images/CiENEQH1RWsY.png', desc: 'Invoice (addresses, emails)' },
  { path: '/home/ubuntu/upload/search_images/Bh30VIaGEcDy.png', desc: '配送先住所設定画面' },
  { path: '/home/ubuntu/upload/search_images/9OKFJ46smr4H.jpeg', desc: 'Proof of Delivery' },
];

async function detectPersonalInfo(base64, mimeType) {
  const apiUrl = FORGE_API_URL.replace(/\/$/, '') + '/v1/chat/completions';
  const dataUrl = 'data:' + mimeType + ';base64,' + base64;
  
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + FORGE_API_KEY },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'You are a personal information detector for receipt/delivery images. You MUST respond with valid JSON only. No markdown, no explanation, no code blocks. Just raw JSON.' },
        { role: 'user', content: [
          { type: 'text', text: 'Detect all personal information (names, phone numbers, addresses, postal codes, email addresses) in this image. Return their bounding box coordinates normalized to 0.0-1.0 (where full image width=1.0, height=1.0). Do NOT include shop names, company names, product names, or amounts. Format: {"regions":[{"type":"name","text":"detected text","bbox":[left_x, top_y, width, height]}],"has_personal_info":true}. If no personal info found: {"regions":[],"has_personal_info":false}' },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]}
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2000
    })
  });
  
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('API Error ' + resp.status + ': ' + errText.substring(0, 200));
  }
  
  const data = await resp.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    // Fallback: try to get from different location
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    throw new Error('No content. Message keys: ' + (msg ? Object.keys(msg).join(',') : 'none') + ' Model: ' + data.model);
  }
  return JSON.parse(content);
}

async function applyBlur(imageBuffer, regions) {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height || !regions || regions.length === 0) return imageBuffer;

  const compositeOps = [];
  for (const region of regions) {
    const bbox = region.bbox;
    if (!bbox || bbox.length < 4) continue;
    const rx = bbox[0], ry = bbox[1], rw = bbox[2], rh = bbox[3];
    const pad = 0.015; // 1.5% padding
    const left = Math.max(0, Math.floor((rx - pad) * width));
    const top = Math.max(0, Math.floor((ry - pad) * height));
    const rWidth = Math.min(width - left, Math.ceil((rw + pad * 2) * width));
    const rHeight = Math.min(height - top, Math.ceil((rh + pad * 2) * height));
    if (rWidth <= 2 || rHeight <= 2) continue;
    try {
      const blurAmount = Math.max(15, Math.min(40, Math.floor(Math.min(rWidth, rHeight) / 4)));
      const blurred = await sharp(imageBuffer)
        .extract({ left: left, top: top, width: rWidth, height: rHeight })
        .blur(blurAmount)
        .toBuffer();
      compositeOps.push({ input: blurred, left: left, top: top });
    } catch(e) {
      console.warn('    skip region:', e.message);
    }
  }
  if (compositeOps.length === 0) return imageBuffer;
  return sharp(imageBuffer).composite(compositeOps).toBuffer();
}

async function main() {
  console.log('=== レシート画像マスキングテスト v2 (gpt-5-mini) ===');
  console.log('API: ' + FORGE_API_URL);
  console.log('');
  
  const outDir = '/home/ubuntu/masking_test_output';
  fs.mkdirSync(outDir, { recursive: true });

  let success = 0;
  let fail = 0;

  for (let i = 0; i < TEST_IMAGES.length; i++) {
    const imgInfo = TEST_IMAGES[i];
    console.log('[' + (i+1) + '/' + TEST_IMAGES.length + '] ' + imgInfo.desc);
    
    try {
      const buf = fs.readFileSync(imgInfo.path);
      const ext = path.extname(imgInfo.path).toLowerCase();
      const mime = (ext === '.png') ? 'image/png' : 'image/jpeg';
      const base64 = buf.toString('base64');
      console.log('  Size: ' + (buf.length / 1024).toFixed(1) + 'KB');
      
      console.log('  AI検出中...');
      const t0 = Date.now();
      const det = await detectPersonalInfo(base64, mime);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log('  検出完了 (' + elapsed + 's) - 個人情報: ' + (det.has_personal_info ? 'あり' : 'なし'));
      
      if (det.regions && det.regions.length > 0) {
        console.log('  検出 ' + det.regions.length + ' 件:');
        for (const r of det.regions) {
          console.log('    [' + r.type + '] "' + r.text + '" @ [' + r.bbox.map(function(v){return v.toFixed(3)}).join(', ') + ']');
        }
        console.log('  ぼかし処理中...');
        const masked = await applyBlur(buf, det.regions);
        const outPath = outDir + '/masked_' + (i+1) + ext;
        fs.writeFileSync(outPath, masked);
        console.log('  => ' + outPath + ' (' + (masked.length / 1024).toFixed(1) + 'KB)');
        success++;
      } else {
        console.log('  マスキング不要');
        fs.writeFileSync(outDir + '/masked_' + (i+1) + ext, buf);
        success++;
      }
      
      fs.writeFileSync(outDir + '/detection_' + (i+1) + '.json', JSON.stringify(det, null, 2));
    } catch(e) {
      console.error('  ERROR: ' + e.message);
      fail++;
    }
    console.log('');
  }

  console.log('=== 結果 ===');
  console.log('成功: ' + success + '/' + TEST_IMAGES.length);
  console.log('失敗: ' + fail + '/' + TEST_IMAGES.length);
  console.log('出力: ' + outDir + '/');
}

main().catch(function(e) { console.error('FATAL:', e); });
