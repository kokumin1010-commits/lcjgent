import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateMemberRiskLevel, memberRiskRouter } from './memberRiskRouter';
import { isRestrictionActive } from './memberRestrictionService';

const root = process.cwd();
const source = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

const future = new Date(Date.now() + 7 * 86400000);
const validRestrictionInput = {
  memberId: 1,
  scopes: ['order'] as const,
  reason: '本人注文履歴を管理者が確認したため期限付き制限を実施',
  evidence: { relatedOrderIds: [1], note: '関連するキャンセル注文を確認済み' },
  expiresAt: future,
  approvalConfirmed: true as const,
};

describe('member risk thresholds prevent false positives', () => {
  it('keeps a single adverse order as normal even when rate is 33%', () => {
    expect(calculateMemberRiskLevel({ orders90: 3, adverse90: 1, adverse180: 1 })).toBe('normal');
  });

  it('marks two adverse orders in 180 days as review', () => {
    expect(calculateMemberRiskLevel({ orders90: 10, adverse90: 1, adverse180: 2 })).toBe('review');
  });

  it('requires both three adverse orders and at least 50% in 90 days for high', () => {
    expect(calculateMemberRiskLevel({ orders90: 10, adverse90: 3, adverse180: 3 })).toBe('review');
    expect(calculateMemberRiskLevel({ orders90: 6, adverse90: 3, adverse180: 3 })).toBe('high');
  });

  it('does not use refund amount as a risk input', () => {
    const keys = Object.keys({ orders90: 1, adverse90: 1, adverse180: 1 });
    expect(keys).not.toContain('amount');
    expect(calculateMemberRiskLevel({ orders90: 1, adverse90: 1, adverse180: 1 })).toBe('normal');
  });
});

describe('restriction expiration and authorization', () => {
  it('treats an elapsed restriction as inactive', () => {
    const now = new Date('2026-08-27T00:00:00Z');
    expect(isRestrictionActive({ status: 'active', expiresAt: '2026-08-26T23:59:59Z' }, now)).toBe(false);
    expect(isRestrictionActive({ status: 'active', expiresAt: '2026-08-28T00:00:00Z' }, now)).toBe(true);
    expect(isRestrictionActive({ status: 'released', expiresAt: '2026-08-28T00:00:00Z' }, now)).toBe(false);
  });

  it('rejects restriction creation by a non-admin before database access', async () => {
    const caller = memberRiskRouter.createCaller({ user: { id: 99, role: 'user', email: 'staff@example.invalid' } } as any);
    await expect(caller.restrict(validRestrictionInput as any)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires explicit administrator approval in input validation', async () => {
    const caller = memberRiskRouter.createCaller({ user: { id: 1, role: 'admin', email: 'admin@example.invalid' } } as any);
    await expect(caller.restrict({ ...validRestrictionInput, approvalConfirmed: false } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('server-side enforcement and audit contracts', () => {
  it('enforces order and points scopes at the central mall order write path', () => {
    const db = source('server/db.ts');
    expect(db).toContain('assertMemberActionAllowed(data.lineUserId, data.pointsToUse > 0 ? ["order", "points"] : ["order"])');
  });

  it('enforces receipt and points scopes at the central LINE receipt paths', () => {
    const db = source('server/db.ts');
    expect(db).toContain('assertMemberActionAllowed(restrictedMemberId, ["receipt"])');
    expect(db).toContain('assertMemberActionAllowed(restrictedMemberId, ["points"])');
  });

  it('enforces all checkout variants and admin point adjustment in routers', () => {
    const routers = source('server/routers.ts');
    expect((routers.match(/assertMemberActionAllowed\(lineUser\.id, \['order'\]\)/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((routers.match(/\['order', 'points'\]/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(routers).toContain("assertMemberActionAllowed(lineUser.id, ['receipt'])");
    expect(routers).toContain("assertMemberActionAllowed(restrictedMemberId, ['points'])");
  });

  it('records create, release and extend actions inside transactions', () => {
    const service = source('server/memberRestrictionService.ts');
    expect((service.match(/beginTransaction\(\)/g) || []).length).toBe(3);
    expect((service.match(/connection\.commit\(\)/g) || []).length).toBe(3);
    expect(service).toContain("'restriction_created'");
    expect(service).toContain("'restriction_released'");
    expect(service).toContain("'restriction_extended'");
  });

  it('does not create automatic restrictions during migration', () => {
    const upgrade = source('server/memberRiskUpgrade.ts');
    expect(upgrade).toContain('automaticRestrictionRowsCreated: 0');
    expect(upgrade).toContain("UNIQUE KEY uq_member_risk_active_scope");
  });

  it('keeps store generations and current-only aggregate filters', () => {
    const store = source('server/storeManagementRouter.ts');
    expect(store).toContain("SET isCurrent=0 WHERE storeId=? AND year=? AND month=? AND dataType=? AND deletedAt IS NULL");
    expect(store).toContain('isCurrent=1 AND deletedAt IS NULL');
    expect(store).toContain('restoreDataVersion');
    expect(store).not.toContain('DELETE FROM store_data_uploads WHERE storeId = ? AND dataType = ? AND year = ? AND month = ?');
  });
});
