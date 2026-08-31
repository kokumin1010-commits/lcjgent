import { describe,expect,it } from 'vitest';
import {
  buildDeterministicSummary,
  calculateDiscountRate,
  canAccessCompetitorReport,
  canImportCompetitorRanking,
  parseKalodataRows,
  validateReportForSubmission,
} from './tiktokCompetitorDaily';

function completeProduct(index:number){
  return{
    productName:`商品${index}`,
    productUrl:`https://example.com/product/${index}`,
    originalPrice:2000,
    livePrice:1500,
    unitsSold:100+index,
    gmv:150000+index,
    clickRate:0.12,
    conversionRate:0.05,
    heatEvidence:null,
    screenshotUrls:[`https://example.com/screenshot/${index}.png`],
    shopName:`店铺${Math.ceil(index/3)}`,
  };
}

describe('TikTok competitor daily import',()=>{
  it('recognizes Chinese, Japanese and English Kalodata headers and selects top five shops',()=>{
    const rows:any[]=[];
    for(let shop=1;shop<=6;shop+=1){
      for(let product=1;product<=4;product+=1){
        rows.push({
          '店铺排名':shop,
          '店铺名称':`店铺${shop}`,
          '商品排名':product,
          '商品名称':`店铺${shop}商品${product}`,
          '商品链接':`https://example.com/${shop}/${product}`,
          '直播成交价':1000+product,
          '销量':`${shop===1?2:1}.${product}万`,
          '销售额':shop===1?'¥900,000':`¥${700000-shop*1000}`,
          '点击率':'12.5%',
          'Conversion Rate':'4%',
        });
      }
    }
    const result=parseKalodataRows(rows);
    expect(result.recognizedRows).toBe(24);
    expect(result.top5).toHaveLength(5);
    expect(result.top5[0].shopName).toBe('店铺1');
    expect(result.top5.every(shop=>shop.products.length===3)).toBe(true);
    expect(result.top5[0].products[0].clickRate).toBeCloseTo(0.125);
  });

  it('falls back to units sold when explicit shop rank is absent',()=>{
    const result=parseKalodataRows([
      {'Shop Name':'B','Item Sold':100,'Product Name':'B1'},
      {'Shop Name':'A','Item Sold':300,'Product Name':'A1'},
      {'Shop Name':'C','Item Sold':200,'Product Name':'C1'},
    ]);
    expect(result.shops.map(shop=>shop.shopName)).toEqual(['A','C','B']);
    expect(result.warnings.some(warning=>warning.includes('仅识别到3家'))).toBe(true);
  });

  it('excludes rows without a shop name instead of silently inventing a shop',()=>{
    const result=parseKalodataRows([{'商品名称':'没有店铺的商品'},{'店铺名称':'有效店铺','销量':1}]);
    expect(result.excludedRows).toBe(1);
    expect(result.top5).toHaveLength(1);
  });

  it('rejects non-http links from imported files instead of exposing executable URLs',()=>{
    const result=parseKalodataRows([{'店铺名称':'安全店铺','店铺链接':'javascript:alert(1)','商品名称':'商品','商品链接':'file:///tmp/private','销量':1}]);
    expect(result.top5[0].shopUrl).toBeNull();
    expect(result.top5[0].products[0].productUrl).toBeNull();
  });

  it('returns all uploaded fields and restores exact long IDs from Kalodata links',()=>{
    const result=parseKalodataRows([{__sheetName:'Kalodata排名','店铺排名':'达人账号','店铺ID':'7496203284677750000','店铺名称':'店铺A','店铺链接':'https://www.kalodata.com/shop/detail?id=7496203284677757247','商品排名':1,'商品ID':'1734146958572420000','商品名称':'商品A','商品链接':'https://www.kalodata.com/product/detail?id=1734146958572422463','原价':5390,'直播成交价':2159843,'销量':1,'销售额':2188400,'热度表现':'热卖'}]);
    expect(result.recognizedRows).toBe(1);
    expect(result.excludedRows).toBe(0);
    expect(result.rows[0]).toMatchObject({sheetName:'Kalodata排名',sourceShopRank:'达人账号',shopRank:null,externalShopId:'7496203284677757247',shopName:'店铺A',productRank:1,externalProductId:'1734146958572422463',productName:'商品A',originalPrice:5390,livePrice:2159843,unitsSold:1,gmv:2188400,heatEvidence:'热卖'});
    expect(result.top5[0].externalShopId).toBe('7496203284677757247');
    expect(result.top5[0].products[0].externalProductId).toBe('1734146958572422463');
  });
});

describe('TikTok competitor daily calculations',()=>{
  it('calculates and bounds the discount rate',()=>{
    expect(calculateDiscountRate(2000,1500)).toBeCloseTo(0.25);
    expect(calculateDiscountRate(0,100)).toBeNull();
    expect(calculateDiscountRate(1000,1200)).toBe(0);
  });

  it('requires exactly five primary shops and three evidenced products per shop',()=>{
    const shops=Array.from({length:5},(_,shop)=>({isPrimary:true,products:Array.from({length:3},(_,product)=>completeProduct(shop*3+product+1))}));
    expect(validateReportForSubmission(shops).valid).toBe(true);
    const broken=structuredClone(shops);
    broken[0].products[0].screenshotUrls=[];
    broken[1].products[1].livePrice=null as any;
    const result=validateReportForSubmission(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some(error=>error.includes('缺少价格截图'))).toBe(true);
    expect(result.errors.some(error=>error.includes('缺少直播成交价'))).toBe(true);
  });

  it('requires heat evidence when units sold is undefined as well as null',()=>{
    const shops=Array.from({length:5},(_,shop)=>({isPrimary:true,products:Array.from({length:3},(_,product)=>completeProduct(shop*3+product+1))}));
    delete (shops[0].products[0] as any).unitsSold;
    expect(validateReportForSubmission(shops).errors.some(error=>error.includes('缺少销量或热度表现'))).toBe(true);
  });

  it('ignores extra observed shops in the main 15-product validation',()=>{
    const shops=Array.from({length:5},(_,shop)=>({isPrimary:true,products:Array.from({length:3},(_,product)=>completeProduct(shop*3+product+1))}));
    shops.push({isPrimary:false,products:[]});
    expect(validateReportForSubmission(shops).valid).toBe(true);
  });

  it('creates a deterministic management summary with prior-price changes and missing-data risks',()=>{
    const products=Array.from({length:15},(_,index)=>completeProduct(index+1));
    products[0].livePrice=1200;
    (products[0] as any).previous={reportDate:'2026-08-26',livePrice:1500};
    (products[1] as any).previous={reportDate:'2026-08-26',livePrice:1400};
    products[1].livePrice=1600;
    products[2].clickRate=null as any;
    const summary=buildDeterministicSummary(products);
    expect(summary.completionRate).toBe(1);
    expect(summary.priceChanges.decreases).toBe(1);
    expect(summary.priceChanges.increases).toBe(1);
    expect(summary.missingMetrics.clickRate).toBe(1);
    expect(summary.headline).toContain('已完成15/15品');
    expect(summary.actions.some(action=>action.includes('降价商品'))).toBe(true);
    expect(summary.methodology).toBe('deterministic-v2');
  });
});

describe('TikTok competitor daily permissions',()=>{
  it('allows administrators or the scheduled morning operator to import rankings',()=>{
    expect(canImportCompetitorRanking(true,null,[])).toBe(true);
    expect(canImportCompetitorRanking(false,12,[11,12])).toBe(true);
    expect(canImportCompetitorRanking(false,13,[11,12])).toBe(false);
    expect(canImportCompetitorRanking(false,null,[11,12])).toBe(false);
  });

  it('allows administrators or only the assigned operator to access a report',()=>{
    expect(canAccessCompetitorReport(true,null,12)).toBe(true);
    expect(canAccessCompetitorReport(false,12,12)).toBe(true);
    expect(canAccessCompetitorReport(false,11,12)).toBe(false);
    expect(canAccessCompetitorReport(false,null,12)).toBe(false);
  });
});
