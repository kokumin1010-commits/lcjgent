// Test cookie setting
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/liver.login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const postData = JSON.stringify({
  "0": {
    "json": {
      "email": "test@gmail.com",
      "password": "as56638498"
    }
  }
});

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Body:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
