import { describe, expect, it } from 'vitest';
import { tiktokCompetitorDailyRouter } from './tiktokCompetitorDailyRouter';

function context(user:null|{id:number;role:'user'|'admin'}) {
  return {
    user:user?{
      id:user.id,
      openId:`competitor-user-${user.id}`,
      email:`competitor-${user.id}@example.invalid`,
      name:'Competitor User',
      loginMethod:'test',
      role:user.role,
      createdAt:new Date(),
      updatedAt:new Date(),
      lastSignedIn:new Date(),
    }:null,
    req:{headers:{}},
    res:{},
  } as any;
}

const date='2026-08-28';

describe('TikTok competitor multifile procedure permissions',()=>{
  it('rejects unauthenticated batch list, detail and comparison access before database work',async()=>{
    const caller=tiktokCompetitorDailyRouter.createCaller(context(null));
    await expect(caller.listRankingBatches({date})).rejects.toMatchObject({code:'UNAUTHORIZED'});
    await expect(caller.getRankingBatch({snapshotId:1})).rejects.toMatchObject({code:'UNAUTHORIZED'});
    await expect(caller.compareRankingBatches({date,snapshotIds:[1,2]})).rejects.toMatchObject({code:'UNAUTHORIZED'});
  });

  it('rejects unauthenticated file uploads before storage work',async()=>{
    const caller=tiktokCompetitorDailyRouter.createCaller(context(null));
    await expect(caller.uploadRankingFile({date,fileName:'ranking.csv',mimeType:'text/csv',dataBase64:'YQ=='}))
      .rejects.toMatchObject({code:'UNAUTHORIZED'});
  });

  it('rejects unauthenticated batch commits before database work',async()=>{
    const caller=tiktokCompetitorDailyRouter.createCaller(context(null));
    await expect(caller.commitImport({
      date,
      source:'kalodata_export',
      fileName:'ranking.csv',
      fileUrl:'https://storage.example/ranking.csv',
      fileKey:'tiktok/ranking.csv',
      fileSha256:'a'.repeat(64),
      fileSize:1,
      uploadToken:'x'.repeat(43),
      rows:[{'店铺名称':'店铺A','销量':1,'销售额':100}],
    })).rejects.toMatchObject({code:'UNAUTHORIZED'});
  });
});
