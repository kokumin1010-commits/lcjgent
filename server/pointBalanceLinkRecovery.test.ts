import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mergePointComponents } from './pointBalanceLinkRecovery';

const root=path.resolve(process.cwd());
const recoverySource=fs.readFileSync(path.join(root,'server/pointBalanceLinkRecovery.ts'),'utf8');
const dbSource=fs.readFileSync(path.join(root,'server/db.ts'),'utf8');
const indexSource=fs.readFileSync(path.join(root,'server/_core/index.ts'),'utf8');
const decisionSource=fs.readFileSync(path.join(root,'people_product_point_recovery_decision.md'),'utf8');

describe('evidence-backed linked point recovery',()=>{
  it('merges balance, earned and used without dropping a component',()=>{
    expect(mergePointComponents({balance:12500,earned:13050,used:550},{balance:500,earned:500,used:0}))
      .toEqual({balance:13000,earned:13550,used:550});
  });

  it('preserves the global point totals as a hard postcondition',()=>{
    expect(recoverySource).toContain('beforeTotals.balance!==afterTotals.balance');
    expect(recoverySource).toContain('beforeTotals.earned!==afterTotals.earned');
    expect(recoverySource).toContain('beforeTotals.used!==afterTotals.used');
    expect(recoverySource).toContain('global point totals changed');
  });

  it('zeroes the legacy key and migrates its transactions atomically',()=>{
    expect(recoverySource).toContain('await connection.beginTransaction()');
    expect(recoverySource).toMatch(/SET balance=0,totalEarned=0,totalUsed=0/);
    expect(recoverySource).toMatch(/UPDATE line_point_transactions SET lineUserId=/);
    expect(recoverySource).toContain('await connection.commit()');
    expect(recoverySource).toContain('await connection.rollback()');
  });

  it('requires encrypted backups and permanent member-level audit evidence',()=>{
    expect(recoverySource).toContain("pre-point-link-recovery-v1");
    expect(recoverySource).toContain("post-point-product-recovery-v1");
    expect(recoverySource).toContain('runVerifiedBackup');
    expect(recoverySource).toContain('point_balance_link_recovery_audit');
    expect(recoverySource).toContain('Both keys preserved from 2026-03-13 snapshot');
  });

  it('uses a guarded one-time execution path while automatic retry is paused',()=>{
    const auditSource=fs.readFileSync(path.join(root,'server/peopleProductPointAudit.ts'),'utf8');
    expect(auditSource).toContain('executePointLinkRecovery');
    expect(auditSource).toContain('runPointBalanceLinkRecovery()');
    expect(indexSource).not.toContain('await runPointBalanceLinkRecovery()');
  });

  it('fixes the runtime safety net to preserve totalUsed and ledger rows',()=>{
    const start=dbSource.indexOf('Auto-merging orphaned point components');
    const fragment=dbSource.slice(start,start+1800);
    expect(fragment).toContain('totalUsed: primaryBalance.totalUsed + emailBalance.totalUsed');
    expect(fragment).toContain('primaryBalance.totalUsed += emailBalance.totalUsed');
    expect(fragment).toContain('db.update(linePointTransactions)');
  });

  it('does not invent balances or publish products without stock evidence',()=>{
    expect(decisionSource).toContain('残高なし350会員');
    expect(decisionSource).toContain('新規ポイント付与なし');
    expect(decisionSource).toContain('归档150商品');
    expect(decisionSource).toContain('自動復元なし');
  });
});
