import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { competitorSheetToRows } from '../shared/tiktokCompetitorWorkbookRows';
import { competitorRowsSha256, parseCompetitorWorkbook } from './tiktokCompetitorWorkbook';

function workbookBuffer(bookType:'xlsx'|'xls') {
  const workbook=XLSX.utils.book_new();
  const sheet=XLSX.utils.json_to_sheet([{'店铺名称':'店铺A','销量':10,'销售额':15000}]);
  XLSX.utils.book_append_sheet(workbook,sheet,'排名');
  return Buffer.from(XLSX.write(workbook,{type:'buffer',bookType}));
}

function mergedShopWorkbookBuffer() {
  const workbook=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([
    ['店铺排名','店铺ID','店铺名称','店铺链接','商品排名','商品ID','商品名称'],
    [1,'7496221832789657721','店铺A','https://example.com/shop?id=7496221832789657721',1,'1736154369058309241','商品A1'],
    [null,null,null,null,2,'1737036883683542137','商品A2'],
    [2,'7494369393937056879','店铺B','https://example.com/shop?id=7494369393937056879',1,'1737146817867187311','商品B1'],
  ]);
  sheet['!merges']=['A2:A3','B2:B3','C2:C3','D2:D3'].map(XLSX.utils.decode_range);
  XLSX.utils.book_append_sheet(workbook,sheet,'Kalodata排名');
  return Buffer.from(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}));
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

  it('expands declared merged shop cells and keeps independent rows unchanged',()=>{
    const rows=parseCompetitorWorkbook(mergedShopWorkbookBuffer(),'xlsx');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({'店铺排名':1,'店铺ID':'7496221832789657721','店铺名称':'店铺A','商品排名':2,'商品名称':'商品A2'});
    expect(rows[2]).toMatchObject({'店铺排名':2,'店铺ID':'7494369393937056879','店铺名称':'店铺B','商品名称':'商品B1'});
  });

  it('produces identical browser and server rows for a filled template',()=>{
    const bytes=mergedShopWorkbookBuffer();
    const serverRows=parseCompetitorWorkbook(bytes,'xlsx');
    const workbook=XLSX.read(new Uint8Array(bytes),{type:'array',cellDates:false});
    const browserRows=workbook.SheetNames.flatMap(sheetName=>{
      const sheet=workbook.Sheets[sheetName];
      return sheet?competitorSheetToRows(sheet,sheetName):[];
    });
    expect(browserRows).toEqual(serverRows);
    expect(competitorRowsSha256(browserRows)).toBe(competitorRowsSha256(serverRows));
  });

  it('rejects disguised workbooks, binary CSV and empty sheets',()=>{
    expect(()=>parseCompetitorWorkbook(Buffer.from('not zip'),'xlsx')).toThrow('有效的XLSX');
    expect(()=>parseCompetitorWorkbook(Buffer.from('not ole'),'xls')).toThrow('有效的XLS');
    expect(()=>parseCompetitorWorkbook(Buffer.from([0,1,2]),'csv')).toThrow('二进制');
    expect(()=>parseCompetitorWorkbook(Buffer.from('店铺名称,销量\n'),'csv')).toThrow('没有识别');
  });
});
