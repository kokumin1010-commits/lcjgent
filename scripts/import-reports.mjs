import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const csvPath = '/home/ubuntu/upload/livecommerce_report_data.csv';

// Read and parse CSV
const csvContent = readFileSync(csvPath, 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});

console.log(`Found ${records.length} records in CSV`);

// Connect to database
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Get existing report staff
const [existingStaff] = await connection.execute('SELECT id, name, country FROM report_staff');
const staffMap = new Map();
existingStaff.forEach(s => staffMap.set(s.name, s.id));
console.log(`Existing staff: ${existingStaff.length}`);

// Get unique staff names from CSV
const staffNames = [...new Set(records.map(r => r['スタッフ']))];
console.log(`Staff in CSV: ${staffNames.join(', ')}`);

// Create missing staff
for (const name of staffNames) {
  if (!staffMap.has(name)) {
    // Determine country based on name (Japanese names vs Chinese names)
    const isJapanese = /^[ぁ-んァ-ン一-龯々〆〤ー]+$/.test(name) || 
                       ['いっしょう', 'たいせい', '京極琉', 'Hanaco'].includes(name);
    const country = isJapanese ? '日本' : '中国';
    
    const [result] = await connection.execute(
      'INSERT INTO report_staff (name, country, isActive) VALUES (?, ?, ?)',
      [name, country, 'active']
    );
    staffMap.set(name, result.insertId);
    console.log(`Created staff: ${name} (${country}) -> ID: ${result.insertId}`);
  }
}

// Get admin user ID for createdBy
const [users] = await connection.execute('SELECT id FROM users WHERE role = "admin" LIMIT 1');
const createdBy = users.length > 0 ? users[0].id : 1;
console.log(`Using createdBy: ${createdBy}`);

// Insert reports
let inserted = 0;
let skipped = 0;

for (const record of records) {
  const staffName = record['スタッフ'];
  const dateStr = record['日付'];
  const workContent = record['業務内容'];
  const issues = record['気付き・問題・理由'] || null;
  const remarks = record['備考'] || null;
  
  if (!staffName || !dateStr || !workContent) {
    skipped++;
    continue;
  }
  
  const staffId = staffMap.get(staffName);
  if (!staffId) {
    console.log(`Staff not found: ${staffName}`);
    skipped++;
    continue;
  }
  
  // Parse date (format: "2026-01-16 15:02:29")
  const reportDate = new Date(dateStr);
  
  // Check for duplicate (same staff, same date, same content)
  const [existing] = await connection.execute(
    'SELECT id FROM reports WHERE reportStaffId = ? AND DATE(reportDate) = DATE(?) LIMIT 1',
    [staffId, reportDate]
  );
  
  if (existing.length > 0) {
    skipped++;
    continue;
  }
  
  await connection.execute(
    'INSERT INTO reports (reportStaffId, reportDate, workContent, issues, remarks, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
    [staffId, reportDate, workContent, issues, remarks, createdBy]
  );
  inserted++;
}

console.log(`\nImport complete!`);
console.log(`  Inserted: ${inserted}`);
console.log(`  Skipped: ${skipped}`);

await connection.end();
