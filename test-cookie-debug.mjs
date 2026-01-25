// Test cookie setting with debug
import https from 'https';

const postData = JSON.stringify({
  "json": {
    "email": "test@gmail.com",
    "password": "as56638498"
  }
});

const options = {
  hostname: 'lcjagent.manus.space',
  port: 443,
  path: '/api/trpc/liver.login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('All Headers:');
  Object.entries(res.headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Check for set-cookie
  const setCookie = res.headers['set-cookie'];
  console.log('\nSet-Cookie Headers:');
  if (setCookie) {
    setCookie.forEach((cookie, i) => {
      console.log(`  [${i}]: ${cookie}`);
    });
  } else {
    console.log('  No Set-Cookie header found!');
  }
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('\nBody:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
