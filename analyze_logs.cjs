const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get ALL logs with newValue for livestreams (including update logs)
  const [allLogs] = await conn.query(
    `SELECT entityId, actionType, newValue, previousValue, LENGTH(newValue) as len
     FROM brand_edit_logs 
     WHERE entityType = 'livestream' AND (newValue IS NOT NULL OR previousValue IS NOT NULL)
     ORDER BY entityId, createdAt DESC`
  );
  
  // Group by entityId, take latest with data
  const byEntity = new Map();
  for (const log of allLogs) {
    if (byEntity.has(log.entityId)) continue;
    const val = log.newValue || log.previousValue;
    if (val) byEntity.set(log.entityId, { ...log, bestValue: val });
  }
  
  console.log('Entities with data:', byEntity.size);
  
  // Check if any are truncated (not valid JSON)
  let valid = 0;
  let truncated = 0;
  const truncatedIds = [];
  for (const [id, log] of byEntity) {
    try {
      JSON.parse(log.bestValue);
      valid++;
    } catch (e) {
      truncated++;
      truncatedIds.push(id);
    }
  }
  console.log('Valid JSON:', valid, 'Truncated:', truncated);
  if (truncatedIds.length > 0) {
    console.log('Truncated IDs:', truncatedIds.join(', '));
  }
  
  // Check incomplete records that only have 'create' log (no update)
  const incompleteIds = [];
  const [allRecords] = await conn.query(
    `SELECT id, brandId FROM brand_livestreams WHERE brandId != 1 AND gmv IS NULL AND impressions IS NULL`
  );
  
  for (const rec of allRecords) {
    const entry = byEntity.get(rec.id);
    if (!entry) {
      incompleteIds.push(rec.id);
    }
  }
  console.log('\nIncomplete records with NO data in logs:', incompleteIds.length);
  console.log('IDs:', incompleteIds.join(', '));
  
  // For truncated ones, try to get full data from previousValue or other logs
  for (const id of truncatedIds.slice(0, 5)) {
    const [logs] = await conn.query(
      `SELECT actionType, newValue, previousValue, LENGTH(newValue) as newLen, LENGTH(previousValue) as prevLen
       FROM brand_edit_logs WHERE entityType = 'livestream' AND entityId = ?
       ORDER BY createdAt DESC`,
      [id]
    );
    console.log(`\nID ${id} logs:`);
    logs.forEach(l => console.log(`  ${l.actionType} newLen=${l.newLen} prevLen=${l.prevLen}`));
    
    // Try each value
    for (const l of logs) {
      for (const val of [l.newValue, l.previousValue]) {
        if (!val) continue;
        try {
          JSON.parse(val);
          console.log(`  FOUND valid JSON in ${l.actionType}`);
          break;
        } catch (e) {
          // truncated
        }
      }
    }
  }
  
  await conn.end();
}

main().catch(console.error);
