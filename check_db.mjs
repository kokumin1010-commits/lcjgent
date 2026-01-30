import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST || 'localhost',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'test',
  ssl: { rejectUnauthorized: false }
});

const [rows] = await connection.execute(
  "SELECT id, livestreamDate, livestreamEndTime, streamerName, salesAmount, duration, viewerCount, likes FROM brand_livestreams WHERE livestreamDate >= '2025-08-31' AND livestreamDate < '2025-09-01'"
);

console.log('=== 8/31 Database Records ===');
for (const row of rows) {
  console.log(JSON.stringify(row, null, 2));
}

await connection.end();
