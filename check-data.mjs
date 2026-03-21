import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);

const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 4000,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
});

// yaeの3月配信データで整合性チェック
const [rows] = await conn.query(`
  SELECT id, livestreamDate, livestreamEndTime, livestreamStartTime, duration, salesAmount, streamerName
  FROM brand_livestreams 
  WHERE streamerName = 'yae' AND livestreamDate >= '2026-03-01' AND livestreamDate < '2026-03-19'
  AND deletedAt IS NULL
  ORDER BY livestreamDate DESC
`);

console.log("=== 配信データ整合性チェック ===\n");
let issues = 0;
rows.forEach(r => {
  const start = new Date(r.livestreamDate);
  const end = r.livestreamEndTime ? new Date(r.livestreamEndTime) : null;
  const calcMins = end ? Math.round((end - start) / 60000) : null;
  const diff = calcMins !== null ? Math.abs(calcMins - r.duration) : null;
  const hasIssue = diff !== null && diff > 30;
  if (hasIssue) issues++;
  
  const flag = hasIssue ? '⚠️' : '✅';
  console.log(`${flag} ID:${r.id} | ${start.toISOString().slice(0,16)} ~ ${end?.toISOString().slice(0,16)||'N/A'} | CSV: ${r.duration}min | Calc: ${calcMins}min | Diff: ${diff}min`);
});

console.log(`\n合計: ${rows.length}件中 ${issues}件に問題あり`);

await conn.end();
