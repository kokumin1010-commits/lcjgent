import mysql from 'mysql2/promise';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool(process.env.DATABASE_URL);

// Parse Excel
const workbook = XLSX.readFile('/home/ubuntu/upload/pasted_file_fakXwH_日本流水(2).xlsx');
const records = [];

// 理索纳
const wsR = workbook.Sheets['理索纳'];
const dataR = XLSX.utils.sheet_to_json(wsR, { header: 1 });
for (let i = 1; i < dataR.length; i++) {
  const row = dataR[i];
  if (!row || !row[2]) continue;
  const rawDate = row[2];
  let dateStr;
  if (typeof rawDate === 'number') {
    const d = XLSX.SSF.parse_date_code(rawDate);
    dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  } else {
    dateStr = String(rawDate).replace(/\//g, '-').slice(0, 10);
  }
  const expense = Number(row[4] || 0);
  const income = Number(row[5] || 0);
  if (!expense && !income) continue;
  const desc = String(row[12] || '').trim();
  records.push(['japan', income > 0 ? 'income' : 'expense', desc.includes('ﾃｽｳﾘﾖｳ') ? '手数料' : '振込', income || expense, 'JPY', dateStr, desc, desc, 'LCJ RESONA']);
}

// 三井
const wsM = workbook.Sheets['三井'];
const dataM = XLSX.utils.sheet_to_json(wsM, { header: 1 });
let lastRec = null;
for (let i = 1; i < dataM.length; i++) {
  const row = dataM[i];
  if (!row) continue;
  const year = row[7], month = row[13], day = row[14];
  const income = Number(row[15] || 0);
  const expense = Number(row[16] || 0);
  const desc = String(row[18] || '').trim();
  if (month && day && year && (income || expense)) {
    const dateStr = `${year}-${String(Number(month)).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`;
    lastRec = ['japan', income > 0 ? 'income' : 'expense', desc.includes('手数料') || desc.includes('ﾃｽｳﾘﾖｳ') ? '手数料' : '振込', income || expense, 'JPY', dateStr, desc, '', 'LCJ MITSUI'];
    records.push(lastRec);
  } else if (!month && !day && desc && lastRec) {
    lastRec[7] = desc; // counterparty
  }
}

console.log(`Total records: ${records.length}`);

// Batch insert (50 at a time)
const batchSize = 50;
let inserted = 0;
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(',');
  const values = batch.flat();
  await pool.query(
    `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, sourceAccount, createdAt, updatedAt) VALUES ${placeholders}`,
    values
  );
  inserted += batch.length;
}
console.log(`Inserted: ${inserted}`);

// Verify
const [result] = await pool.query("SELECT sourceAccount, COUNT(*) as cnt, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as totalIn, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as totalOut FROM company_cashflows WHERE entity='japan' AND sourceAccount IS NOT NULL GROUP BY sourceAccount");
for (const r of result) {
  console.log(`${r.sourceAccount}: ${r.cnt} records | 入金:¥${Number(r.totalIn).toLocaleString()} | 出金:¥${Number(r.totalOut).toLocaleString()}`);
}
await pool.end();
