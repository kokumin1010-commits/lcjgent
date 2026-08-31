import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { competitorSheetToRows } from '../shared/tiktokCompetitorWorkbookRows.js';

const MAX_ROWS = 100_000;

export function parseCompetitorWorkbook(buffer: Buffer, extension: 'csv'|'xls'|'xlsx') {
  if (!buffer.length) throw new Error('文件内容为空');
  if (extension === 'xlsx' && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw new Error('文件内容不是有效的XLSX工作簿');
  if (extension === 'xls' && !buffer.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))) throw new Error('文件内容不是有效的XLS工作簿');
  if (extension === 'csv' && buffer.includes(0)) throw new Error('CSV包含无效二进制内容');

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer,{type:'buffer',cellDates:false});
  } catch {
    throw new Error('无法解析文件，请确认它是有效的CSV/XLS/XLSX');
  }
  if (!workbook.SheetNames.length) throw new Error('工作簿没有可读取的工作表');

  const rows: Record<string,unknown>[]=[];
  for (const sheetName of workbook.SheetNames) {
    const sheet=workbook.Sheets[sheetName];
    if (!sheet) continue;
    const sheetRows=competitorSheetToRows(sheet,sheetName);
    for (const row of sheetRows) {
      if (rows.length >= MAX_ROWS) throw new Error(`文件最多支持${MAX_ROWS}行`);
      rows.push(row);
    }
  }
  if (!rows.length) throw new Error('没有识别到可导入的数据行');
  return rows;
}

export function competitorRowsSha256(rows: Record<string,unknown>[]) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
