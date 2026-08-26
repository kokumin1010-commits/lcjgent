import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { classifyMemberIdentity, classifyReceiptIdentity, identityPresentation, isRealLineUserId } from './memberIdentityService';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const realLineId = `U${'a'.repeat(32)}`;

describe('member identity classification', () => {
  it('accepts only canonical LINE user IDs', () => {
    expect(isRealLineUserId(realLineId)).toBe(true);
    expect(isRealLineUserId('email_990088')).toBe(false);
    expect(isRealLineUserId('LINE復旧会員')).toBe(false);
  });

  it.each([
    [{ id: 1, lineUserId: realLineId, displayName: '田中' }, 'line_profiled'],
    [{ id: 2, lineUserId: realLineId, displayName: 'LINE復旧会員' }, 'line_claimable_recovery'],
    [{ id: 3, email: 'member@example.test', hasPassword: 1 }, 'email_loginable'],
    [{ id: 4, email: 'member@example.test', hasPassword: 0 }, 'email_claimable_reset'],
    [{ id: 5, lineUserId: 'email_990088', displayName: '復旧会員 #990088' }, 'pseudo_email_reference'],
    [{ id: 6, displayName: '復旧会員 #990091' }, 'numeric_reference_only'],
    [{ id: 7, lineUserId: 'legacy-key', displayName: 'LINE復旧会員' }, 'legacy_key_recovery'],
    [{ id: 8, lineUserId: 'legacy-key', displayName: '旧会員' }, 'legacy_key_review'],
  ])('classifies %j as %s', (member, expected) => {
    expect(classifyMemberIdentity(member)).toBe(expected);
  });

  it('groups only verified and claimable identities into the normal member directory', () => {
    expect(identityPresentation('line_profiled').group).toBe('verified');
    expect(identityPresentation('line_claimable_recovery').group).toBe('claimable');
    expect(identityPresentation('email_claimable_reset').group).toBe('claimable');
    expect(identityPresentation('pseudo_email_reference').group).toBe('reference');
    expect(identityPresentation('numeric_reference_only').loginMethod).toBe('none');
  });
});

describe('receipt identity classification', () => {
  it('marks a profiled LINE member as verified by the same LINE ID', () => {
    expect(classifyReceiptIdentity(realLineId, { id: 1, lineUserId: realLineId, displayName: '田中' })).toMatchObject({ identityClass: 'verified_member', linkageBasis: 'same_line_user_id' });
  });

  it('marks a recovered LINE identity as self-claimable without moving data', () => {
    expect(classifyReceiptIdentity(realLineId, { id: 2, lineUserId: realLineId, displayName: 'LINE復旧会員' })).toMatchObject({ identityClass: 'line_claimable_recovery', linkageBasis: 'same_line_user_id' });
  });

  it('marks pseudo email and numeric recovery rows as reference-only', () => {
    expect(classifyReceiptIdentity('email_990088', { id: 1200977, lineUserId: 'email_990088', displayName: '復旧会員 #990088' }).identityClass).toBe('reference_only');
    expect(classifyReceiptIdentity('email_990091', { id: 990091, displayName: '復旧会員 #990091' }).identityClass).toBe('reference_only');
  });

  it('does not guess a member when no identity row matches', () => {
    expect(classifyReceiptIdentity('unknown-key', null).identityClass).toBe('unmatched');
  });
});

describe('implementation safety and authorization', () => {
  it('uses protected procedures for permanent identity directory and logs', () => {
    const source = read('server/memberIdentityRouter.ts');
    expect(source).toContain('directory: protectedProcedure');
    expect(source).toContain('getMemberAudit: protectedProcedure');
    expect(source).not.toContain('publicProcedure');
  });

  it('creates an immutable claim log without deleting recovered members', () => {
    const upgrade = read('server/memberIdentityUpgrade.ts');
    expect(upgrade).toContain('CREATE TABLE IF NOT EXISTS member_identity_action_logs');
    expect(upgrade).toContain("ENUM('line_profile_claimed','email_password_claimed','admin_linked')");
    expect(upgrade).toContain('automaticMemberMergeCount: 0');
    expect(upgrade).toContain('deletedPlaceholderCount: 0');
    expect(upgrade).not.toMatch(/DELETE\s+FROM\s+line_users/i);
  });

  it('records LINE and email claim promotions only after strong identity verification', () => {
    const db = read('server/db.ts');
    const routers = read('server/routers.ts');
    expect(db).toContain('beforeClass === "line_claimable_recovery" && afterClass === "line_profiled"');
    expect(db).toContain('sameLineUserId: true');
    expect(routers).toContain('verificationMethod: "email_reset_token"');
    expect(routers).toContain('validResetToken: true');
  });

  it('does not send password hashes with receipt member data', () => {
    const db = read('server/db.ts');
    const receiptSection = db.slice(db.indexOf('export async function getAllLineReceipts'), db.indexOf('export async function getPendingLineReceiptsCount'));
    expect(receiptSection).toContain('hasPassword: sql<number>');
    expect(receiptSection).not.toContain('lineUser: lineUsers');
  });

  it('uses identity-aware member totals and growth instead of raw COUNT(*)', () => {
    const db = read('server/db.ts');
    const statsSection = db.slice(db.indexOf('export async function getMallDashboardStats'), db.indexOf('export async function getMallSalesChart'));
    expect(statsSection).toContain('memberIdentityStats.usableOrClaimable');
    expect(statsSection).toContain('memberIdentityStats.reference');
    expect(statsSection).toContain('memberIdentityStats.databaseRows');
    const growthSection = db.slice(db.indexOf('export async function getMallMemberGrowthChart'), db.indexOf('// =====================================================', db.indexOf('export async function getMallMemberGrowthChart')));
    expect(growthSection).toContain("REGEXP '^U[0-9A-Fa-f]{32}$'");
    expect(growthSection).toContain('lineUsers.email');
  });

  it('requires verified pre/post encrypted backups around the schema upgrade', () => {
    const upgrade = read('server/memberIdentityUpgrade.ts');
    expect(upgrade).toContain("const PRE_REASON = 'pre-member-identity-v1'");
    expect(upgrade).toContain("const POST_REASON = 'post-member-identity-v1'");
    expect(upgrade).toContain('runDatabaseBackup(reason, { force: true, waitForActive: true })');
    expect(upgrade).toContain("String(row.status) !== 'success'");
  });
});
