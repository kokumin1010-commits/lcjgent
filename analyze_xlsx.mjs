import XLSX from 'xlsx';
import fs from 'fs';

const buffer = fs.readFileSync('/home/ubuntu/upload/beau.0101_7648446614452865813_product.xlsx');
const workbook = XLSX.read(buffer, { type: 'buffer' });

console.log("=== Sheet Names ===");
console.log(workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Total rows: ${rows.length}`);
  
  if (rows.length > 0) {
    console.log("\n--- Column Headers ---");
    console.log(Object.keys(rows[0]));
    
    console.log("\n--- First 3 rows ---");
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(JSON.stringify(rows[i], null, 2));
    }
  }
}
