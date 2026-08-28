import { describe, expect, it } from 'vitest';
import { buildRankingBatchComparison, type SnapshotBatchValue } from './tiktokCompetitorComparison';

function batch(id:number,date:string,shopName:string,shopRank:number,shopUnits:number|null,shopGmv:number|null,product:{id?:string|null;name:string;rank:number;price:number|null;units:number|null;gmv:number|null}):SnapshotBatchValue{
  return{
    id,
    snapshotDate:date,
    sourceFileName:`batch-${id}.xlsx`,
    importedAt:`${date}T0${id}:00:00+09:00`,
    isCurrent:id===3,
    shops:[{
      rankingPosition:shopRank,
      externalShopId:'shop-1',
      shopName,
      unitsSold:shopUnits,
      gmv:shopGmv,
      products:[{
        productRank:product.rank,
        externalProductId:product.id??'product-1',
        productName:product.name,
        originalPrice:2000,
        livePrice:product.price,
        discountRate:product.price===null?null:(2000-product.price)/2000,
        unitsSold:product.units,
        gmv:product.gmv,
        clickRate:0.1,
        conversionRate:0.04,
      }],
    }],
  };
}

describe('TikTok competitor batch comparison',()=>{
  it('compares the first and last of three same-day batches without discarding the middle batch',()=>{
    const result=buildRankingBatchComparison([
      batch(3,'2026-08-28','店铺A',1,130,156000,{name:'商品A',rank:1,price:1200,units:130,gmv:156000}),
      batch(1,'2026-08-28','店铺A旧名',3,100,150000,{name:'商品A旧名',rank:2,price:1500,units:100,gmv:150000}),
      batch(2,'2026-08-28','店铺A',2,110,154000,{name:'商品A',rank:1,price:1400,units:110,gmv:154000}),
    ]);
    expect(result.batches.map(item=>item.id)).toEqual([1,2,3]);
    expect(result.shops).toHaveLength(1);
    expect(result.shops[0].changes).toEqual({rankingPosition:-2,unitsSold:30,gmv:6000});
    expect(result.products).toHaveLength(1);
    expect(result.products[0].changes.livePrice).toBe(-300);
    expect(result.products[0].changes.unitsSold).toBe(30);
    expect(result.products[0].values['2']?.livePrice).toBe(1400);
  });

  it('matches normalized names when IDs are absent',()=>{
    const first=batch(1,'2026-08-28','ＡＢＩ  ＴＯＫＹＯ',1,10,1000,{id:null,name:'商品 Ａ',rank:1,price:1000,units:10,gmv:1000});
    first.shops[0].externalShopId=null;
    first.shops[0].products[0].externalProductId=null;
    const second=batch(2,'2026-08-28','ABI TOKYO',1,12,1200,{id:null,name:'商品 A',rank:1,price:900,units:12,gmv:1200});
    second.shops[0].externalShopId=null;
    second.shops[0].products[0].externalProductId=null;
    const result=buildRankingBatchComparison([first,second]);
    expect(result.shops).toHaveLength(1);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].changes.livePrice).toBe(-100);
  });

  it('keeps missing metrics as null instead of calculating from zero',()=>{
    const result=buildRankingBatchComparison([
      batch(1,'2026-08-28','店铺A',1,null,null,{name:'商品A',rank:1,price:null,units:null,gmv:null}),
      batch(2,'2026-08-28','店铺A',2,20,2000,{name:'商品A',rank:2,price:800,units:20,gmv:2000}),
    ]);
    expect(result.shops[0].changes.unitsSold).toBeNull();
    expect(result.shops[0].changes.gmv).toBeNull();
    expect(result.products[0].changes.livePrice).toBeNull();
  });

  it('requires two to four batches from the same date',()=>{
    expect(()=>buildRankingBatchComparison([batch(1,'2026-08-28','A',1,1,1,{name:'P',rank:1,price:1,units:1,gmv:1})])).toThrow('2至4');
    expect(()=>buildRankingBatchComparison([
      batch(1,'2026-08-28','A',1,1,1,{name:'P',rank:1,price:1,units:1,gmv:1}),
      batch(2,'2026-08-27','A',1,1,1,{name:'P',rank:1,price:1,units:1,gmv:1}),
    ])).toThrow('同一天');
  });
});
