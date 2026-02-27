const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all brand_livestreams columns
  const [cols] = await conn.query('DESCRIBE brand_livestreams');
  const allColumns = cols.map(c => c.Field);
  const skipCols = ['id', 'createdAt', 'updatedAt', 'createdBy']; // Don't overwrite these
  const updateCols = allColumns.filter(c => !skipCols.includes(c));
  
  // Get ALL brand_livestreams records
  const [allRecords] = await conn.query('SELECT id, brandId FROM brand_livestreams');
  console.log(`Total records to check: ${allRecords.length}`);
  
  let updated = 0;
  let skipped = 0;
  let noLogs = 0;
  
  for (const record of allRecords) {
    // Get the latest newValue from edit_logs for this record
    const [logs] = await conn.query(
      `SELECT newValue FROM brand_edit_logs 
       WHERE entityType = 'livestream' AND entityId = ? AND newValue IS NOT NULL 
       ORDER BY createdAt DESC LIMIT 1`,
      [record.id]
    );
    
    if (logs.length === 0 || !logs[0].newValue) {
      // Try previousValue
      const [prevLogs] = await conn.query(
        `SELECT previousValue FROM brand_edit_logs 
         WHERE entityType = 'livestream' AND entityId = ? AND previousValue IS NOT NULL 
         ORDER BY createdAt DESC LIMIT 1`,
        [record.id]
      );
      
      if (prevLogs.length === 0 || !prevLogs[0].previousValue) {
        noLogs++;
        continue;
      }
      
      // Use previousValue
      try {
        const data = JSON.parse(prevLogs[0].previousValue);
        await updateRecord(conn, record.id, data, updateCols);
        updated++;
      } catch (err) {
        console.error(`Failed to update ID ${record.id} from prevValue: ${err.message}`);
      }
      continue;
    }
    
    try {
      const data = JSON.parse(logs[0].newValue);
      await updateRecord(conn, record.id, data, updateCols);
      updated++;
    } catch (err) {
      console.error(`Failed to update ID ${record.id}: ${err.message}`);
    }
  }
  
  console.log(`\n=== UPDATE SUMMARY ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already complete): ${skipped}`);
  console.log(`No logs available: ${noLogs}`);
  
  // Verify brandId=120001
  const [b120001] = await conn.query(
    `SELECT id, livestreamDate, streamerName, gmv, impressions, productClicks, salesCount, 
            platform, duration, livestreamStartTime, commissionRate, screenshotUrl
     FROM brand_livestreams WHERE brandId = 120001 ORDER BY livestreamDate DESC`
  );
  console.log(`\nbrandId=120001 records (${b120001.length}):`);
  b120001.forEach(r => console.log(JSON.stringify({
    id: r.id, date: r.livestreamDate, name: r.streamerName,
    gmv: r.gmv, imp: r.impressions, clicks: r.productClicks, sales: r.salesCount,
    platform: r.platform, dur: r.duration, start: r.livestreamStartTime
  })));
  
  // Verify brandId=90001
  const [b90001] = await conn.query(
    `SELECT id, livestreamDate, streamerName, gmv, impressions, productClicks, salesCount
     FROM brand_livestreams WHERE brandId = 90001 ORDER BY livestreamDate DESC`
  );
  console.log(`\nbrandId=90001 records (${b90001.length}):`);
  b90001.forEach(r => console.log(JSON.stringify({
    id: r.id, date: r.livestreamDate, name: r.streamerName,
    gmv: r.gmv, imp: r.impressions, clicks: r.productClicks, sales: r.salesCount
  })));
  
  await conn.end();
}

async function updateRecord(conn, id, data, updateCols) {
  const setClauses = [];
  const values = [];
  
  for (const col of updateCols) {
    if (data[col] !== undefined) {
      setClauses.push(`\`${col}\` = ?`);
      if (col === 'aiStructuredAdvice' && typeof data[col] === 'object' && data[col] !== null) {
        values.push(JSON.stringify(data[col]));
      } else {
        values.push(data[col]);
      }
    }
  }
  
  if (setClauses.length === 0) return;
  
  values.push(id);
  const sql = `UPDATE brand_livestreams SET ${setClauses.join(', ')} WHERE id = ?`;
  await conn.query(sql, values);
}

main().catch(console.error);
