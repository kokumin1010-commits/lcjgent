import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const pool = mysql.createPool(DATABASE_URL);
  
  // 1. Delete all japan cashflows
  console.log("=== Step 1: Deleting japan cashflows ===");
  const [delResult] = await pool.query("DELETE FROM company_cashflows WHERE entity = 'japan'");
  console.log(`Deleted ${delResult.affectedRows} japan records`);

  // 2. Parse Excel
  console.log("\n=== Step 2: Parsing Excel ===");
  const workbook = XLSX.readFile('/home/ubuntu/upload/pasted_file_fakXwH_日本流水(2).xlsx');
  
  const records = [];

  // Parse 理索纳
  if (workbook.SheetNames.includes('理索纳')) {
    const ws = workbook.Sheets['理索纳'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[2]) continue; // 勘定日
      const rawDate = row[2];
      let dateStr;
      if (typeof rawDate === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(rawDate);
        dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      } else {
        dateStr = String(rawDate).replace(/\//g, '-').slice(0, 10);
      }
      const expense = Number(row[4] || 0);
      const income = Number(row[5] || 0);
      if (!expense && !income) continue;
      const desc = String(row[12] || '').trim();
      const balance = Number(row[7] || 0);
      records.push({
        transactionDate: dateStr,
        type: income > 0 ? 'income' : 'expense',
        amount: income > 0 ? income : expense,
        counterparty: desc,
        description: desc,
        balance,
        sourceAccount: 'LCJ RESONA',
        currency: 'JPY',
        category: desc.includes('ﾃｽｳﾘﾖｳ') || desc.includes('手数料') ? '手数料' : '振込',
      });
      count++;
    }
    console.log(`  理索纳: ${count} records`);
  }

  // Parse 三井
  if (workbook.SheetNames.includes('三井')) {
    const ws = workbook.Sheets['三井'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    let count = 0;
    let lastRecord = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const year = row[7];
      const month = row[13];
      const day = row[14];
      const income = Number(row[15] || 0);
      const expense = Number(row[16] || 0);
      const desc = String(row[18] || '').trim();
      const balance = Number(row[19] || 0);

      if (month && day && year) {
        if (income || expense) {
          const dateStr = `${year}-${String(Number(month)).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`;
          lastRecord = {
            transactionDate: dateStr,
            type: income > 0 ? 'income' : 'expense',
            amount: income > 0 ? income : expense,
            counterparty: '',
            description: desc,
            balance: balance || null,
            sourceAccount: 'LCJ MITSUI',
            currency: 'JPY',
            category: desc.includes('手数料') || desc.includes('ﾃｽｳﾘﾖｳ') ? '手数料' : '振込',
          };
          records.push(lastRecord);
          count++;
        }
      } else if (!month && !day && desc && lastRecord) {
        // Counterparty detail row
        lastRecord.counterparty = desc;
      }
    }
    console.log(`  三井: ${count} records`);
  }

  console.log(`  Total: ${records.length} records`);

  // 3. Insert all records
  console.log("\n=== Step 3: Inserting records ===");
  let inserted = 0;
  for (const rec of records) {
    try {
      await pool.query(
        `INSERT INTO company_cashflows (entity, type, category, amount, currency, transactionDate, description, counterparty, sourceAccount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        ['japan', rec.type, rec.category, rec.amount, rec.currency, rec.transactionDate, rec.description, rec.counterparty, rec.sourceAccount]
      );
      inserted++;
    } catch (err) {
      console.error(`  Error inserting: ${err.message}`);
    }
  }
  console.log(`Inserted ${inserted} records`);

  // 4. Verify
  const [countResult] = await pool.query("SELECT sourceAccount, COUNT(*) as cnt, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as totalIn, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as totalOut FROM company_cashflows WHERE entity='japan' AND sourceAccount IS NOT NULL GROUP BY sourceAccount");
  console.log("\n=== Verification ===");
  for (const row of countResult) {
    console.log(`  ${row.sourceAccount}: ${row.cnt} records | 入金: ¥${Number(row.totalIn).toLocaleString()} | 出金: ¥${Number(row.totalOut).toLocaleString()}`);
  }

  await pool.end();
  console.log("\nDone!");
}

main().catch(err => { console.error(err); process.exit(1); });
