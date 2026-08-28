import { describe,expect,it,vi } from 'vitest';
import { getTikTokCompetitorDailyUpgradeHealth } from './tiktokCompetitorDailyUpgrade';

const tables=[
  'tiktok_competitor_ranking_snapshots','tiktok_competitor_shop_rankings','tiktok_competitor_snapshot_products',
  'tiktok_competitor_reports','tiktok_competitor_report_shops','tiktok_competitor_report_products',
  'tiktok_competitor_sync_logs','tiktok_competitor_audit_logs',
];
const columns=[
  ['tiktok_competitor_ranking_snapshots','sourceFileSha256'],['tiktok_competitor_ranking_snapshots','sourceFileSize'],
  ['tiktok_competitor_sync_logs','sourceFileSha256'],['tiktok_competitor_sync_logs','sourceFileSize'],['tiktok_competitor_sync_logs','snapshotId'],
];
const indexes=[
  ['tiktok_competitor_ranking_snapshots','uq_tiktok_competitor_snapshot_file_hash'],
  ['tiktok_competitor_sync_logs','idx_tiktok_competitor_sync_snapshot'],
];

function pool(options:{omitTable?:string;omitColumn?:string;omitIndex?:string}={}) {
  let call=0;
  const query=vi.fn(async()=>{
    call+=1;
    if(call===1)return [tables.filter(name=>name!==options.omitTable).map(tableName=>({tableName}))];
    if(call===2)return [columns.filter(([table,column])=>`${table}.${column}`!==options.omitColumn).map(([tableName,columnName])=>({tableName,columnName}))];
    return [indexes.filter(([table,index])=>`${table}.${index}`!==options.omitIndex).map(([tableName,indexName])=>({tableName,indexName}))];
  });
  return {query,end:vi.fn()} as any;
}

describe('TikTok competitor multifile schema health',()=>{
  it('is healthy only when required tables, columns and indexes all exist',async()=>{
    const fake=pool();
    const result=await getTikTokCompetitorDailyUpgradeHealth(fake);
    expect(result).toMatchObject({healthy:true,missingTables:[],missingColumns:[],missingIndexes:[]});
    expect(fake.end).not.toHaveBeenCalled();
  });

  it('reports each missing schema component without mutating the database',async()=>{
    const fake=pool({
      omitTable:'tiktok_competitor_snapshot_products',
      omitColumn:'tiktok_competitor_sync_logs.snapshotId',
      omitIndex:'tiktok_competitor_ranking_snapshots.uq_tiktok_competitor_snapshot_file_hash',
    });
    const result=await getTikTokCompetitorDailyUpgradeHealth(fake);
    expect(result.healthy).toBe(false);
    expect(result.missingTables).toContain('tiktok_competitor_snapshot_products');
    expect(result.missingColumns).toContain('tiktok_competitor_sync_logs.snapshotId');
    expect(result.missingIndexes).toContain('tiktok_competitor_ranking_snapshots.uq_tiktok_competitor_snapshot_file_hash');
  });
});
