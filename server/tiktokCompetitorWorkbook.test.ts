import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { competitorRowsSha256, parseCompetitorWorkbook } from './tiktokCompetitorWorkbook';

function workbookBuffer(bookType:'xlsx'|'xls') {
  const workbook=XLSX.utils.book_new();
  const sheet=XLSX.utils.json_to_sheet([{'店铺名称':'店铺A','销量':10,'销售额':15000}]);
  XLSX.utils.book_append_sheet(workbook,sheet,'排名');
  return Buffer.from(XLSX.write(workbook,{type:'buffer',bookType}));
}

describe('TikTok competitor server-side workbook parser',()=>{
  it('parses a UTF-8 CSV and produces a deterministic row digest',()=>{
    const rows=parseCompetitorWorkbook(Buffer.from('\ufeff店铺名称,销量,销售额\n店铺A,10,15000\n'),'csv');
    expect(rows).toEqual([{'店铺名称':'店铺A','销量':10,'销售额':15000,__sheetName:'Sheet1'}]);
    expect(competitorRowsSha256(rows)).toMatch(/^[a-f0-9]{64}$/);
    expect(competitorRowsSha256(rows)).toBe(competitorRowsSha256(structuredClone(rows)));
  });

  it.each(['xlsx','xls'] as const)('parses a real %s workbook',extension=>{
    const rows=parseCompetitorWorkbook(workbookBuffer(extension),extension);
    expect(rows[0]).toMatchObject({'店铺名称':'店铺A','销量':10,'销售额':15000,__sheetName:'排名'});
  });

  it('rejects disguised workbooks, binary CSV and empty sheets',()=>{
    expect(()=>parseCompetitorWorkbook(Buffer.from('not zip'),'xlsx')).toThrow('有效的XLSX');
    expect(()=>parseCompetitorWorkbook(Buffer.from('not ole'),'xls')).toThrow('有效的XLS');
    expect(()=>parseCompetitorWorkbook(Buffer.from([0,1,2]),'csv')).toThrow('二进制');
    expect(()=>parseCompetitorWorkbook(Buffer.from('店铺名称,销量\n'),'csv')).toThrow('没有识别');
  });
});
