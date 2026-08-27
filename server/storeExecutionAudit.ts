import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { getStoreExecutionUpgradeHealth } from './storeExecutionUpgrade';

const KEY_SHA256 = 'e04915848dbcb06ff365a6132f27fe8ca11cdd6c60da3759cf6d9dc5e69f24c3';
function verifyKey(value:string) {
  const actual=Buffer.from(createHash('sha256').update(value).digest('hex'));
  const expected=Buffer.from(KEY_SHA256);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export const storeExecutionAuditRouter=router({
  snapshot: publicProcedure.input(z.object({key:z.string().min(32)})).query(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const health=await getStoreExecutionUpgradeHealth();
    return {
      capturedAt:new Date().toISOString(),
      healthy:health.healthy,
      recoveryKey:health.recoveryKey,
      missingTables:health.missingTables,
      sourceAndExecutionCounts:health.snapshot,
      recoveryRun:health.recoveryRun,
      backups:(health.backups as any[]).map(row=>({id:Number(row.id),reason:String(row.reason),status:String(row.status),tableCount:row.tableCount===null?null:Number(row.tableCount),rowCount:row.rowCount===null?null:Number(row.rowCount),completedAt:row.completedAt?new Date(row.completedAt).toISOString():null,errorMessage:row.errorMessage?String(row.errorMessage).slice(0,500):null})),
    };
  }),
});
