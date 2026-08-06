import mysql from 'mysql2/promise';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config();
const pool = mysql.createPool(process.env.DATABASE_URL);

// Step 1: Add balance column
try { await pool.query('ALTER TABLE company_cashflows ADD COLUMN balance DECIMAL(15,2) DEFAULT NULL'); console.log('1. balance column added'); } catch(e) { console.log('1. balance column exists'); }

// Step 2: Delete japan data
const [del] = await pool.query("DELETE FROM company_cashflows WHERE entity = 'japan'");
console.log(`2. Deleted ${del.affectedRows} japan records`);

// Step 3: Parse & import with balance
const workbook = XLSX.readFile('/home/ubuntu/upload/pasted_file_fakXwH_日本流水(2).xlsx');
const records = [];

// 理索纳
const dataR = XLSX.utils.sheet_to_json(workbook.Sheets['理索纳'], { header: 1 });
for (let i = 1; i < dataR.length; i++) {
  const row = dataR[i];
  if (!row || !row[2]) continue;
  const rawDate = row[2];
  let dateStr;
  if (typeof rawDate === 'number') { const d = XLSX.SSF.parse_date_code(rawDate); dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; }
  else { dateStr = String(rawDate).replace(/\//g, '-').slice(0, 10); }
  const expense = Number(row[4] || 0), income = Number(row[5] || 0);
  if (!expense && !income) continue;
  const desc = String(row[12] || '').trim();
  const balance = Number(row[7] || 0);
  records.push(['japan', income > 0 ? 'income' : 'expense', desc.includes('ﾃｽｳﾘﾖｳ') ? '手数料' : '振込', income || expense, 'JPY', dateStr, desc, desc, 'LCJ RESONA', balance]);
}

// 三井
const dataM = XLSX.utils.sheet_to_json(workbook.Sheets['三井'], { header: 1 });
let lastRec = null;
for (let i = 1; i < dataM.length; i++) {
  const row = dataM[i];
  if (!row) continue;
  const year = row[7], month = row[13], day = row[14];
  const income = Number(row[15] || 0), expense = Number(row[16] || 0);
  const desc = String(row[18] || '').trim();
  const balance = Number(row[19] || 0);
  if (month && day && year && (income || expense)) {
    const dateStr = `${year}-${String(Number(month)).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`;
    lastRec = ['japan', income > 0 ? 'income' : 'expense', desc.includes('手数料') || desc.includes('ﾃｽｳﾘﾖｳ') ? '手数料' : '振込', income || expense, 'JPY', dateStr, desc, '', 'LCJ MITSUI', balance];
    records.push(lastRec);
  } else if (!month && !day && desc && lastRec) {
    lastRec[7] = desc;
  }
}
console.log(`3. Parsed ${records.length} records`);

// Batch insert
const batchSize = 50;
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  const ph = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,NOW(),NOW())').join(',');
  await pool.query(`INSERT INTO company_cashflows (entity,type,category,amount,currency,transactionDate,description,counterparty,sourceAccount,balance,createdAt,updatedAt) VALUES ${ph}`, batch.flat());
}
console.log(`4. Inserted ${records.length} records`);

// Verify latest balance
const [latest] = await pool.query(`
  SELECT sourceAccount, balance, transactionDate FROM company_cashflows 
  WHERE entity='japan' AND sourceAccount IS NOT NULL AND balance IS NOT NULL AND balance > 0
  ORDER BY transactionDate DESC, id DESC
`);
const seen = {};
for (const r of latest) {
  if (!seen[r.sourceAccount]) { seen[r.sourceAccount] = r; }
}
console.log('5. Latest balances:');
for (const [k, v] of Object.entries(seen)) {
  console.log(`   ${k}: ¥${Number(v.balance).toLocaleString()} (${v.transactionDate})`);
}
await pool.end();
