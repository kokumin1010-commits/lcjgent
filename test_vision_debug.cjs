const fs = require('fs');
const url = process.env.BUILT_IN_FORGE_API_URL;
const key = process.env.BUILT_IN_FORGE_API_KEY;

console.log('URL:', url);
console.log('KEY:', key ? key.substring(0, 5) + '...' : 'MISSING');

const img = fs.readFileSync('/home/ubuntu/upload/search_images/FTSjcgo19Zim.png');
const dataUrl = 'data:image/png;base64,' + img.toString('base64');
console.log('Image base64 length:', dataUrl.length);

async function test() {
  // Test 1: gpt-5-mini with vision
  console.log('\n=== Test 1: gpt-5-mini ===');
  try {
    const resp1 = await fetch(url.replace(/\/$/, '') + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'user', content: [
            { type: 'text', text: 'What text do you see in this image? Be brief.' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]}
        ],
        max_completion_tokens: 500
      })
    });
    console.log('Status:', resp1.status);
    const text1 = await resp1.text();
    console.log('Response:', text1.substring(0, 500));
  } catch(e) {
    console.error('Error:', e.message);
  }

  // Test 2: gemini-3-flash-preview with vision (no response_format, use max_tokens)
  console.log('\n=== Test 2: gemini-3-flash-preview ===');
  try {
    const resp2 = await fetch(url.replace(/\/$/, '') + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        messages: [
          { role: 'user', content: [
            { type: 'text', text: 'What text do you see in this image? Be brief.' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]}
        ],
        max_tokens: 500
      })
    });
    console.log('Status:', resp2.status);
    const text2 = await resp2.text();
    console.log('Response:', text2.substring(0, 500));
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
