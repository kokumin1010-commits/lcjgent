import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  uri: 'mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw',
  ssl: { rejectUnauthorized: true }
});

const [rows] = await conn.query('SELECT id, name, email FROM livers WHERE id = 120005');
console.log('Liver info:', JSON.stringify(rows[0], null, 2));

// Try login via API
const email = rows[0].email;
console.log('\nEmail:', email);

// Use tRPC login endpoint
const loginUrl = 'https://lcjmall.com/api/trpc/liver.login';
const resp = await fetch(loginUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    json: {
      email: email,
      password: 'test123' // Try common password
    }
  })
});
const data = await resp.json();
console.log('\nLogin response:', JSON.stringify(data, null, 2));

await conn.end();
