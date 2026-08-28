import { describe, expect, it, vi } from 'vitest';
import { commitCompetitorRankingBatch } from './tiktokCompetitorBatchPersistence';
import { parseKalodataRows } from './tiktokCompetitorDaily';

function input(){
  return{
    date:'2026-08-28',
    source:'kalodata_export' as const,
    fileName:'second.xlsx',
    fileUrl:'https://storage.example/second.xlsx',
    fileKey:'tiktok/second.xlsx',
    fileSha256:'a'.repeat(64),
    fileSize:2048,
    rowCount:1,
    parsed:parseKalodataRows([{
      '店铺ID':'shop-1','店铺名称':'店铺A','店铺排名':1,'销量':120,'销售额':240000,
      '商品ID':'product-1','商品名称':'商品A','商品排名':1,'原价':2000,'直播成交价':1500,
    }]),
    actor:{id:9,name:'管理员'},
    operators:[{id:11,name:'早班A'}],
  };
}

function fakePool(options:{existingReport?:boolean;duplicate?:boolean;failAt?:RegExp;connectionFailure?:boolean}={}){
  const poolQueries:Array<{sql:string;params?:unknown[]}>=[];
  const connectionQueries:Array<{sql:string;params?:unknown[]}>=[];
  let snapshotInsert=0;
  let reportShopInsert=0;
  const connection={
    beginTransaction:vi.fn(async()=>undefined),
    commit:vi.fn(async()=>undefined),
    rollback:vi.fn(async()=>undefined),
    release:vi.fn(),
    query:vi.fn(async(sql:string,params?:unknown[])=>{
      connectionQueries.push({sql,params});
      if(options.failAt?.test(sql))throw new Error('forced write failure');
      if(sql.includes('FROM tiktok_competitor_ranking_snapshots')&&sql.includes('sourceFileSha256'))return[[],[]];
      if(sql.includes('FROM tiktok_competitor_ranking_snapshots')&&sql.includes('isCurrent=1'))return[[{id:10}],[]];
      if(sql.includes('INSERT INTO tiktok_competitor_ranking_snapshots')){snapshotInsert+=1;return[{insertId:20},[]];}
      if(sql.includes('INSERT INTO tiktok_competitor_shop_rankings'))return[{insertId:30},[]];
      if(sql.includes('SELECT id,status,rankingSnapshotId FROM tiktok_competitor_reports'))return[options.existingReport===false?[]:[{id:40,status:'draft',rankingSnapshotId:10}],[]];
      if(sql.includes('INSERT INTO tiktok_competitor_reports'))return[{insertId:50},[]];
      if(sql.includes('INSERT INTO tiktok_competitor_report_shops')){reportShopInsert+=1;return[{insertId:60+reportShopInsert},[]];}
      if(sql.includes('UPDATE tiktok_competitor_ranking_snapshots SET isCurrent=0'))return[{affectedRows:1},[]];
      if(sql.includes('UPDATE tiktok_competitor_sync_logs'))return[{affectedRows:1},[]];
      return[{affectedRows:1,insertId:70},[]];
    }),
  };
  const pool={
    query:vi.fn(async(sql:string,params?:unknown[])=>{
      poolQueries.push({sql,params});
      if(sql.includes('FROM tiktok_competitor_ranking_snapshots')&&sql.includes('sourceFileSha256')){
        return[options.duplicate?[{id:77,sourceFileName:'first.xlsx',sourceFileUrl:'https://storage.example/first.xlsx',sourceFileKey:'first',sourceFileSize:1024,importedAt:'2026-08-28T01:00:00Z'}]:[],[]];
      }
      if(sql.includes('INSERT INTO tiktok_competitor_sync_logs'))return[{insertId:501},[]];
      return[{affectedRows:1},[]];
    }),
    getConnection:vi.fn(async()=>{
      if(options.connectionFailure)throw new Error('connection unavailable');
      return connection;
    }),
  };
  return{pool:pool as any,connection,poolQueries,connectionQueries,get snapshotInsert(){return snapshotInsert;}};
}

describe('TikTok competitor append-only batch persistence',()=>{
  it('appends a new snapshot but preserves an existing same-day report and its products',async()=>{
    const fake=fakePool({existingReport:true});
    const result=await commitCompetitorRankingBatch(fake.pool,input());
    expect(result.duplicate).toBe(false);
    if(result.duplicate)return;
    expect(result.snapshotId).toBe(20);
    expect(result.preservedReportIds).toEqual([40]);
    expect(result.createdReportIds).toEqual([]);
    const sql=fake.connectionQueries.map(entry=>entry.sql).join('\n');
    expect(sql).not.toContain('DELETE FROM tiktok_competitor_report_products');
    expect(sql).not.toContain('DELETE FROM tiktok_competitor_report_shops');
    expect(sql).not.toMatch(/UPDATE tiktok_competitor_reports/);
    expect(sql).toContain('INSERT INTO tiktok_competitor_snapshot_products');
    expect(fake.connection.commit).toHaveBeenCalledOnce();
  });

  it('creates a report only when the operator has no report for that date',async()=>{
    const fake=fakePool({existingReport:false});
    const result=await commitCompetitorRankingBatch(fake.pool,input());
    expect(result.duplicate).toBe(false);
    if(result.duplicate)return;
    expect(result.createdReportIds).toEqual([50]);
    expect(result.preservedReportIds).toEqual([]);
    const sql=fake.connectionQueries.map(entry=>entry.sql).join('\n');
    expect(sql).toContain('INSERT INTO tiktok_competitor_reports');
    expect(sql.match(/INSERT INTO tiktok_competitor_report_products/g)).toHaveLength(3);
  });

  it('returns the existing batch before starting a sync log or transaction for the same file hash',async()=>{
    const fake=fakePool({duplicate:true});
    const result=await commitCompetitorRankingBatch(fake.pool,input());
    expect(result).toMatchObject({duplicate:true,snapshotId:77,sourceFileName:'first.xlsx'});
    expect(fake.pool.getConnection).not.toHaveBeenCalled();
    expect(fake.poolQueries.some(entry=>entry.sql.includes('INSERT INTO tiktok_competitor_sync_logs'))).toBe(false);
  });

  it('rolls back the entire batch if snapshot product persistence fails',async()=>{
    const fake=fakePool({failAt:/INSERT INTO tiktok_competitor_snapshot_products/});
    await expect(commitCompetitorRankingBatch(fake.pool,input())).rejects.toMatchObject({message:'排名批次保存失败，已回滚，旧文件和日报均未覆盖'});
    expect(fake.connection.rollback).toHaveBeenCalledOnce();
    expect(fake.connection.commit).not.toHaveBeenCalled();
    expect(fake.poolQueries.some(entry=>entry.sql.includes("status='failed'"))).toBe(true);
  });

  it('marks the sync log failed if MySQL connection acquisition fails',async()=>{
    const fake=fakePool({connectionFailure:true});
    await expect(commitCompetitorRankingBatch(fake.pool,input())).rejects.toMatchObject({message:'排名批次保存失败，已回滚，旧文件和日报均未覆盖'});
    expect(fake.poolQueries.some(entry=>entry.sql.includes("status='failed'"))).toBe(true);
  });
});
