const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all brand_livestreams columns
  const [cols] = await conn.query('DESCRIBE brand_livestreams');
  const allColumns = cols.map(c => c.Field);
  const skipCols = ['id', 'createdAt', 'updatedAt', 'createdBy'];
  const updateCols = allColumns.filter(c => !skipCols.includes(c));
  
  // Get ALL edit_logs for livestreams in one query (most recent newValue per entityId)
  console.log('Loading edit_logs...');
  const [allLogs] = await conn.query(
    `SELECT entityId, newValue, previousValue FROM (
       SELECT entityId, newValue, previousValue, 
              ROW_NUMBER() OVER (PARTITION BY entityId ORDER BY createdAt DESC) as rn
       FROM brand_edit_logs 
       WHERE entityType = 'livestream' AND (newValue IS NOT NULL OR previousValue IS NOT NULL)
     ) t WHERE rn = 1`
  );
  
  // Build a map: entityId -> best data
  const dataMap = new Map();
  for (const log of allLogs) {
    const val = log.newValue || log.previousValue;
    if (val) {
      try {
        dataMap.set(log.entityId, JSON.parse(val));
      } catch (e) {
        // skip invalid JSON
      }
    }
  }
  console.log(`Loaded ${dataMap.size} edit_log entries`);
  
  // Get ALL brand_livestreams IDs
  const [allRecords] = await conn.query('SELECT id FROM brand_livestreams');
  console.log(`Total records: ${allRecords.length}`);
  
  let updated = 0;
  let noLogs = 0;
  let errors = 0;
  
  for (const record of allRecords) {
    const data = dataMap.get(record.id);
    if (!data) {
      noLogs++;
      continue;
    }
    
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
    
    if (setClauses.length === 0) continue;
    
    values.push(record.id);
    try {
      await conn.query(`UPDATE brand_livestreams SET ${setClauses.join(', ')} WHERE id = ?`, values);
      updated++;
      if (updated % 100 === 0) console.log(`Updated ${updated}...`);
    } catch (err) {
      errors++;
      console.error(`Failed ID ${record.id}: ${err.message}`);
    }
  }
  
  console.log(`\n=== UPDATE SUMMARY ===`);
  console.log(`Updated: ${updated}`);
  console.log(`No logs: ${noLogs}`);
  console.log(`Errors: ${errors}`);
  
  // Verify brandId=120001
  const [b120001] = await conn.query(
    `SELECT id, livestreamDate, streamerName, gmv, impressions, productClicks, salesCount, 
            platform, duration, livestreamStartTime, commissionRate
     FROM brand_livestreams WHERE brandId = 120001 ORDER BY livestreamDate DESC`
  );
  console.log(`\nbrandId=120001 records (${b120001.length}):`);
  b120001.forEach(r => console.log(JSON.stringify({
    id: r.id, date: r.livestreamDate, name: r.streamerName,
    gmv: r.gmv, imp: r.impressions, clicks: r.productClicks, sales: r.salesCount,
    platform: r.platform, dur: r.duration, start: r.livestreamStartTime, comm: r.commissionRate
  })));
  
  // Check remaining incomplete records
  const [incomplete] = await conn.query(
    `SELECT id, brandId, streamerName FROM brand_livestreams 
     WHERE brandId != 1 AND gmv IS NULL AND impressions IS NULL AND productClicks IS NULL`
  );
  console.log(`\nStill incomplete (non-brand1): ${incomplete.length}`);
  incomplete.forEach(r => console.log(`  ID ${r.id} brand=${r.brandId} name=${r.streamerName}`));
  
  await conn.end();
}

main().catch(console.error);
