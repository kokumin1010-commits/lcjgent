import fs from "node:fs";
import * as XLSX from "xlsx";

const path = "/home/ubuntu/upload/pasted_file_06GgiQ_LCJ経営管理表_经营用账户.xlsx";
const workbook = XLSX.read(fs.readFileSync(path), { type: "buffer", cellFormula: true, cellHTML: false });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
const inspected = [6, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 21, 23, 26, 27, 35, 36, 38, 39, 40].map(rowNumber => {
  const cell = sheet[`B${rowNumber}`] as XLSX.CellObject | undefined;
  const purpose = String(rows[rowNumber - 1]?.[0] || "").trim();
  return {
    row: rowNumber,
    purpose,
    value: String(cell?.v || ""),
    formula: String(cell?.f || ""),
    hyperlink: String((cell as any)?.l?.Target || ""),
    formatted: String(cell?.w || ""),
  };
});
console.log(JSON.stringify({ sheetName, rowCount: rows.length, inspected }, null, 2));
