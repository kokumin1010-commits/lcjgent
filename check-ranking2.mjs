import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url + '&ssl={"rejectUnauthorized":true}');

// 2025-11 ranking with liver names
const [rows1] = await conn.execute(`
  SELECT bl.liverId, l.name as liverName, MAX(bl.streamerName) as sname, 
         COALESCE(SUM(bl.salesAmount), 0) as totalSales,
         COUNT(*) as cnt
  FROM brand_livestreams bl
  LEFT JOIN livers l ON bl.liverId = l.id
  WHERE bl.deletedAt IS NULL 
    AND bl.livestreamDate >= '2025-10-31 15:00:00'
    AND bl.livestreamDate <= '2025-11-30 14:59:59'
    AND bl.liverId IS NOT NULL
  GROUP BY bl.liverId, l.name
  ORDER BY totalSales DESC
  LIMIT 10
`);
console.log('=== 2025-11 ranking with liver names ===');
rows1.forEach(r => console.log(JSON.stringify(r)));

// 2026-03 count
const [rows2] = await conn.execute(`
  SELECT COUNT(*) as cnt, COALESCE(SUM(salesAmount), 0) as totalSales
  FROM brand_livestreams 
  WHERE deletedAt IS NULL 
    AND livestreamDate >= '2026-02-28 15:00:00'
    AND livestreamDate <= '2026-03-31 14:59:59'
`);
console.log('\n=== 2026-03 count ===');
console.log(JSON.stringify(rows2[0]));

// 2026-02 ranking
const [rows3] = await conn.execute(`
  SELECT bl.liverId, l.name as liverName, MAX(bl.streamerName) as sname, 
         COALESCE(SUM(bl.salesAmount), 0) as totalSales,
         COUNT(*) as cnt
  FROM brand_livestreams bl
  LEFT JOIN livers l ON bl.liverId = l.id
  WHERE bl.deletedAt IS NULL 
    AND bl.livestreamDate >= '2026-01-31 15:00:00'
    AND bl.livestreamDate <= '2026-02-28 14:59:59'
    AND bl.liverId IS NOT NULL
  GROUP BY bl.liverId, l.name
  ORDER BY totalSales DESC
  LIMIT 10
`);
console.log('\n=== 2026-02 ranking ===');
rows3.forEach(r => console.log(JSON.stringify(r)));

// Check what the frontend shows - LiverDashboardNew uses listWithStats
const [rows4] = await conn.execute(`
  SELECT id, name, avatarUrl FROM livers WHERE isActive = 1 AND name != 'Test Liver' ORDER BY name
`);
console.log('\n=== Real active livers (not Test) ===');
rows4.forEach(r => console.log(JSON.stringify(r)));

// Check streamerName values for liverId records
const [rows5] = await conn.execute(`
  SELECT DISTINCT bl.liverId, bl.streamerName, l.name as liverName
  FROM brand_livestreams bl
  LEFT JOIN livers l ON bl.liverId = l.id
  WHERE bl.deletedAt IS NULL AND bl.liverId IS NOT NULL
  ORDER BY bl.liverId
  LIMIT 20
`);
console.log('\n=== liverId -> streamerName vs liverName ===');
rows5.forEach(r => console.log(JSON.stringify(r)));

await conn.end();
