import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [tzRows] = await conn.query("SELECT @@global.time_zone as gtx, @@session.time_zone as stx");
console.log("DB Timezone:", JSON.stringify(tzRows[0]));

const [rows] = await conn.query(`
  SELECT id, streamerName, 
    livestreamDate, livestreamEndTime,
    UNIX_TIMESTAMP(livestreamDate) as unix_start,
    UNIX_TIMESTAMP(livestreamEndTime) as unix_end
  FROM brand_livestreams 
  WHERE streamerName LIKE '%NANA%' 
  ORDER BY livestreamDate DESC LIMIT 3
`);

for (const row of rows) {
  console.log(`\nID: ${row.id}, Streamer: ${row.streamerName}`);
  console.log(`  DB livestreamDate raw:`, row.livestreamDate);
  console.log(`  DB livestreamEndTime raw:`, row.livestreamEndTime);
  console.log(`  Unix start: ${row.unix_start}`);
  console.log(`  Unix end: ${row.unix_end}`);
  if (row.unix_start) {
    console.log(`  JST start: ${new Date(row.unix_start * 1000).toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}`);
  }
  if (row.unix_end) {
    console.log(`  JST end: ${new Date(row.unix_end * 1000).toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}`);
  }
}

await conn.end();
