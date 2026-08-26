import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from './_core/trpc';
import { getMemberRiskUpgradeHealth } from './memberRiskUpgrade';
import {
  createMemberRestrictions,
  extendMemberRestriction,
  getMemberRestrictionHistory,
  listActiveMemberRestrictions,
  releaseMemberRestriction,
  type MemberRestrictionScope,
} from './memberRestrictionService';

let poolInstance: any = null;
async function getPool() {
  if (poolInstance) return poolInstance;
  const mysql = await import('mysql2/promise');
  poolInstance = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 5 });
  return poolInstance;
}

export type MemberRiskLevel = 'normal' | 'review' | 'high';
export const MEMBER_RISK_RULES = Object.freeze({
  reviewWindowDays: 180,
  reviewAdverseCount: 2,
  reviewMinimumOrders: 3,
  reviewAdverseRatePercent: 30,
  highWindowDays: 90,
  highAdverseCount: 3,
  highAdverseRatePercent: 50,
});

type AggregateRow = {
  memberId: number | string;
  lineUserId: string | null;
  displayName: string | null;
  email: string | null;
  totalOrders: number | string;
  cancelledCount: number | string;
  refundedCount: number | string;
  adverseAmount: number | string;
  adversePoints: number | string;
  orders90: number | string;
  adverse90: number | string;
  orders180: number | string;
  adverse180: number | string;
  latestAdverseAt: Date | string | null;
};

const toNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

function calculateRiskLevel(row: AggregateRow): MemberRiskLevel {
  const orders90 = toNumber(row.orders90);
  const adverse90 = toNumber(row.adverse90);
  const adverse180 = toNumber(row.adverse180);
  const adverseRate90 = orders90 > 0 ? (adverse90 / orders90) * 100 : 0;
  if (adverse90 >= MEMBER_RISK_RULES.highAdverseCount && adverseRate90 >= MEMBER_RISK_RULES.highAdverseRatePercent) return 'high';
  if (adverse180 >= MEMBER_RISK_RULES.reviewAdverseCount) return 'review';
  return 'normal';
}

function normalizeAggregate(row: AggregateRow) {
  const totalOrders = toNumber(row.totalOrders);
  const cancelledCount = toNumber(row.cancelledCount);
  const refundedCount = toNumber(row.refundedCount);
  const orders90 = toNumber(row.orders90);
  const adverse90 = toNumber(row.adverse90);
  const orders180 = toNumber(row.orders180);
  const adverse180 = toNumber(row.adverse180);
  const lifetimeAdverseCount = cancelledCount + refundedCount;
  return {
    memberId: toNumber(row.memberId), lineUserId: row.lineUserId, displayName: row.displayName, email: row.email,
    riskLevel: calculateRiskLevel(row), hasAdverseHistory: lifetimeAdverseCount > 0,
    totalOrders, cancelledCount, refundedCount, lifetimeAdverseCount,
    adverseAmount: toNumber(row.adverseAmount), adversePoints: toNumber(row.adversePoints),
    orders90, adverse90, adverseRate90: orders90 > 0 ? Math.round((adverse90 / orders90) * 1000) / 10 : 0,
    orders180, adverse180, adverseRate180: orders180 > 0 ? Math.round((adverse180 / orders180) * 1000) / 10 : 0,
    latestAdverseAt: row.latestAdverseAt,
  };
}

const aggregateSql = `
  SELECT lu.id AS memberId, lu.lineUserId, lu.displayName, lu.email,
    COUNT(mo.id) AS totalOrders,
    SUM(CASE WHEN mo.status='cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
    SUM(CASE WHEN mo.status='refunded' THEN 1 ELSE 0 END) AS refundedCount,
    SUM(CASE WHEN mo.status IN ('cancelled','refunded') THEN COALESCE(mo.totalAmount,0) ELSE 0 END) AS adverseAmount,
    SUM(CASE WHEN mo.status IN ('cancelled','refunded') THEN COALESCE(mo.pointsUsed,0) ELSE 0 END) AS adversePoints,
    SUM(CASE WHEN mo.createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS orders90,
    SUM(CASE WHEN mo.createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) AND mo.status IN ('cancelled','refunded') THEN 1 ELSE 0 END) AS adverse90,
    SUM(CASE WHEN mo.createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 180 DAY) THEN 1 ELSE 0 END) AS orders180,
    SUM(CASE WHEN mo.createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 180 DAY) AND mo.status IN ('cancelled','refunded') THEN 1 ELSE 0 END) AS adverse180,
    MAX(CASE WHEN mo.status IN ('cancelled','refunded') THEN COALESCE(mo.cancelledAt,mo.updatedAt) ELSE NULL END) AS latestAdverseAt
  FROM line_users lu LEFT JOIN mall_orders mo ON mo.lineUserId=lu.id
`;

async function listMemberRisk(memberId?: number) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `${aggregateSql} ${memberId ? 'WHERE lu.id=?' : ''}
     GROUP BY lu.id,lu.lineUserId,lu.displayName,lu.email
     ORDER BY latestAdverseAt DESC,lu.id DESC`,
    memberId ? [memberId] : [],
  );
  return (rows as AggregateRow[]).map(normalizeAggregate);
}

const scopeSchema = z.enum(['order', 'receipt', 'points']);
const actorFromContext = (ctx: any) => ({ id: Number(ctx.user.id), name: ctx.user.name || null, email: ctx.user.email || null });

export const memberRiskRouter = router({
  list: protectedProcedure.query(async () => {
    const [allMembers, activeRestrictions] = await Promise.all([listMemberRisk(), listActiveMemberRestrictions()]);
    const restrictionMap = new Map<number, any[]>();
    for (const restriction of activeRestrictions) {
      const memberId = Number(restriction.memberId);
      restrictionMap.set(memberId, [...(restrictionMap.get(memberId) || []), restriction]);
    }
    const members = allMembers
      .filter(member => member.hasAdverseHistory || restrictionMap.has(member.memberId))
      .map(member => ({ ...member, restrictions: restrictionMap.get(member.memberId) || [], isRestricted: restrictionMap.has(member.memberId) }));
    return {
      rules: MEMBER_RISK_RULES,
      counts: {
        history: members.filter(member => member.hasAdverseHistory).length,
        review: members.filter(member => member.riskLevel === 'review').length,
        high: members.filter(member => member.riskLevel === 'high').length,
        restricted: members.filter(member => member.isRestricted).length,
      },
      members,
    };
  }),

  getMember: protectedProcedure.input(z.object({ memberId: z.number().int().positive() })).query(async ({ input }) => {
    const [summary] = await listMemberRisk(input.memberId);
    if (!summary) throw new TRPCError({ code: 'NOT_FOUND', message: '会員が見つかりません' });
    const pool = await getPool();
    const [[relatedOrders], history] = await Promise.all([
      pool.query(`SELECT id,orderNumber,status,totalAmount,pointsUsed,paymentMethod,createdAt,updatedAt,cancelledAt,cancelReason
                    FROM mall_orders WHERE lineUserId=? AND status IN ('cancelled','refunded')
                   ORDER BY COALESCE(cancelledAt,updatedAt) DESC,id DESC`, [input.memberId]),
      getMemberRestrictionHistory(input.memberId),
    ]);
    const activeRestrictions = history.restrictions.filter((row: any) => row.status === 'active' && new Date(row.expiresAt).getTime() > Date.now());
    return { ...summary, relatedOrders: relatedOrders as any[], ...history, activeRestrictions, isRestricted: activeRestrictions.length > 0 };
  }),

  restrict: adminProcedure.input(z.object({
    memberId: z.number().int().positive(), scopes: z.array(scopeSchema).min(1).max(3),
    reason: z.string().trim().min(10).max(1000),
    evidence: z.object({ relatedOrderIds: z.array(z.number().int().positive()).max(50), note: z.string().trim().min(3).max(2000) }),
    expiresAt: z.coerce.date(), approvalConfirmed: z.literal(true),
  })).mutation(async ({ ctx, input }) => createMemberRestrictions({
    memberId: input.memberId, scopes: input.scopes as MemberRestrictionScope[], reason: input.reason,
    evidence: input.evidence, expiresAt: input.expiresAt, actor: actorFromContext(ctx),
  })),

  release: adminProcedure.input(z.object({ restrictionId: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) }))
    .mutation(async ({ ctx, input }) => releaseMemberRestriction({ ...input, actor: actorFromContext(ctx) })),

  extend: adminProcedure.input(z.object({ restrictionId: z.number().int().positive(), expiresAt: z.coerce.date(), reason: z.string().trim().min(5).max(1000) }))
    .mutation(async ({ ctx, input }) => extendMemberRestriction({ ...input, actor: actorFromContext(ctx) })),

  health: protectedProcedure.query(() => getMemberRiskUpgradeHealth()),
});
