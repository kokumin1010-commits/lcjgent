const fs = require('fs');
const url = process.env.BUILT_IN_FORGE_API_URL;
const key = process.env.BUILT_IN_FORGE_API_KEY;

const img = fs.readFileSync('/home/ubuntu/upload/search_images/FTSjcgo19Zim.png');
const dataUrl = 'data:image/png;base64,' + img.toString('base64');

async function test() {
  const resp = await fetch(url.replace(/\/$/, '') + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [
        { role: 'user', content: [
          { type: 'text', text: 'Return JSON: {"found": true, "items": ["name", "address"]}' },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]}
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 500
    })
  });
  
  console.log('Status:', resp.status);
  const raw = await resp.text();
  fs.writeFileSync('/home/ubuntu/masking_test_output/raw_response.json', raw);
  console.log('Raw response saved to raw_response.json');
  console.log('First 800 chars:', raw.substring(0, 800));
}

test().catch(function(e) { console.error(e); });
