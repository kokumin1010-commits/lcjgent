import fs from "node:fs";
import path from "node:path";
import { parseAccountWorkbook, safeAccountWorkbookPreview } from "./server/accountWorkbookImport";

const source = "/home/ubuntu/upload/pasted_file_06GgiQ_LCJ経営管理表_经营用账户.xlsx";
const parsed = parseAccountWorkbook(path.basename(source), fs.readFileSync(source));
const preview = safeAccountWorkbookPreview(parsed);
fs.writeFileSync(
  "/home/ubuntu/lcjgent_restore/account_workbook_parser_preview.json",
  JSON.stringify(preview, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify({
  fileSha256: preview.fileSha256,
  sheetName: preview.sheetName,
  sourceRowCount: preview.sourceRowCount,
  counts: preview.counts,
  accountRows: preview.accounts.map(row => ({ rows: row.sourceRows, platform: row.platform, name: row.accountName, identifierType: row.identifierType, hasPassword: row.hasPassword })),
  contactRows: preview.contacts.map(row => ({ rows: row.sourceRows, category: row.category, name: row.contactName })),
  referenceRows: preview.references.map(row => ({ rows: row.sourceRows, category: row.category, name: row.name })),
  excluded: preview.excluded,
}, null, 2));
