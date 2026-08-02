const fs = require('fs');
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const img = fs.readFileSync('/home/ubuntu/upload/search_images/FTSjcgo19Zim.png');
const dataUrl = 'data:image/png;base64,' + img.toString('base64');

async function test() {
  // Test WITHOUT response_format
  console.log('=== Test WITHOUT response_format ===');
  const resp = await fetch(FORGE_API_URL.replace(/\/$/, '') + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + FORGE_API_KEY },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a JSON-only responder. Output valid JSON with no markdown formatting.' },
        { role: 'user', content: [
          { type: 'text', text: 'Detect all personal information in this image. Return coordinates as normalized [x,y,width,height] where full image = 1.0x1.0. Response format: {"regions":[{"type":"name|phone|address|postal_code|email","text":"detected text","bbox":[x,y,w,h]}],"has_personal_info":true}' },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]}
      ],
      max_tokens: 2000
    })
  });
  
  const data = await resp.json();
  console.log('Status:', resp.status);
  console.log('Model:', data.model);
  console.log('Message keys:', Object.keys(data.choices[0].message));
  const content = data.choices[0].message.content;
  console.log('Content exists:', content !== null && content !== undefined);
  if (content) {
    console.log('Content:', content.substring(0, 800));
  } else {
    console.log('Full message:', JSON.stringify(data.choices[0].message).substring(0, 500));
  }
}

test().catch(e => console.error('Error:', e));
