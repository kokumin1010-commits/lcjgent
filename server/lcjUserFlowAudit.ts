import { createHash, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const EXPECTED_KEY_HASH = "a71354613f9f4e4166967b83a49b889cc55bceb4df1637ae1e3ac7ebeaa9fca0";
let auditPool: mysql.Pool | undefined;

function pool() {
  if (!auditPool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    auditPool = mysql.createPool({ uri, connectionLimit: 2, waitForConnections: true, queueLimit: 20 });
  }
  return auditPool;
}

function verifyKey(value: string) {
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function first(sql: string, params: unknown[] = []) {
  const [rows] = await pool().query(sql, params);
  return (rows as Record<string, unknown>[])[0] ?? {};
}

async function targetSnapshot(label: string, displayName: string) {
  const [memberRows] = await pool().query(
    `SELECT id,
      CASE WHEN lineUserId LIKE 'U%' THEN 1 ELSE 0 END AS hasRealLineId,
      CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END AS hasEmail,
      CASE WHEN password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END AS hasPassword,
      isBlocked,userType,createdAt,updatedAt,
      CASE
        WHEN lineUserId LIKE 'U%' AND displayName LIKE 'LINE復旧会員%' THEN 'line_claimable_recovery'
        WHEN lineUserId LIKE 'U%' THEN 'line_verified'
        WHEN email IS NOT NULL AND email <> '' AND password IS NOT NULL AND password <> '' THEN 'email_loginable'
        WHEN email IS NOT NULL AND email <> '' THEN 'email_claimable'
        WHEN lineUserId LIKE 'email\\_%' THEN 'reference_only'
        ELSE 'legacy_review'
      END AS identityClass
    FROM line_users
    WHERE LOWER(TRIM(displayName))=LOWER(TRIM(?))
    ORDER BY id`,
    [displayName],
  );

  const [messageRows] = await pool().query(
    `SELECT COUNT(*) AS messageCount,
      COUNT(DISTINCT lm.lineUserId) AS distinctSenderIds,
      MAX(lm.createdAt) AS latestMessageAt,
      SUM(CASE WHEN lu.id IS NULL THEN 1 ELSE 0 END) AS messagesWithoutMember,
      COUNT(DISTINCT CASE WHEN lu.id IS NULL THEN lm.lineUserId END) AS unlinkedSenderIds
    FROM line_messages lm
    LEFT JOIN line_users lu ON lu.lineUserId=lm.lineUserId
    WHERE lm.direction='incoming' AND LOWER(TRIM(lm.senderName))=LOWER(TRIM(?))`,
    [displayName],
  );

  const members = [] as Record<string, unknown>[];
  for (const rawMember of memberRows as Record<string, unknown>[]) {
    const memberId = Number(rawMember.id);
    const detail = await first(
      `SELECT
        (SELECT COUNT(*) FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)) AS balanceKeyCount,
        (SELECT COALESCE(SUM(pb.balance),0) FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)) AS combinedBalance,
        (SELECT COALESCE(SUM(pb.totalEarned),0) FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)) AS combinedEarned,
        (SELECT COALESCE(SUM(pb.totalUsed),0) FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)) AS combinedUsed,
        (SELECT COALESCE(SUM(CASE WHEN pb.lineUserId=lu.lineUserId THEN pb.balance ELSE 0 END),0) FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)) AS canonicalBalance,
        (SELECT COALESCE(SUM(CASE WHEN pb.lineUserId=CONCAT('email_',lu.id) THEN pb.balance ELSE 0 END),0) FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)) AS legacyEmailBalance,
        (SELECT COUNT(*) FROM line_point_transactions tx WHERE tx.lineUserId=lu.lineUserId OR tx.lineUserId=CONCAT('email_',lu.id)) AS pointTransactionCount,
        (SELECT COALESCE(SUM(tx.amount),0) FROM line_point_transactions tx WHERE tx.lineUserId=lu.lineUserId OR tx.lineUserId=CONCAT('email_',lu.id)) AS pointTransactionNet,
        (SELECT COUNT(*) FROM line_receipts lr WHERE (lr.lineUserId=lu.lineUserId OR lr.lineUserId=CONCAT('email_',lu.id)) AND lr.status='approved') AS approvedReceiptCount,
        (SELECT COALESCE(SUM(lr.pointsAwarded),0) FROM line_receipts lr WHERE (lr.lineUserId=lu.lineUserId OR lr.lineUserId=CONCAT('email_',lu.id)) AND lr.status='approved') AS approvedReceiptPoints,
        (SELECT COUNT(*) FROM mall_orders mo WHERE mo.lineUserId=lu.id) AS orderCount,
        (SELECT COUNT(*) FROM mall_orders mo WHERE mo.lineUserId=lu.id AND mo.paymentMethod='points') AS pointOrderCount,
        (SELECT COALESCE(SUM(mo.pointsUsed),0) FROM mall_orders mo WHERE mo.lineUserId=lu.id AND mo.status NOT IN ('cancelled','refunded')) AS netOrderPointsUsed,
        (SELECT COUNT(*) FROM mall_carts mc WHERE mc.lineUserId=lu.id) AS cartItemCount,
        (SELECT COUNT(*) FROM user_addresses ua WHERE ua.lineUserId=lu.id) AS addressCount,
        (SELECT COUNT(*) FROM member_risk_restrictions mr WHERE mr.memberId=lu.id AND mr.status='active' AND mr.expiresAt>NOW()) AS activeRestrictionCount,
        (SELECT COUNT(*) FROM member_identity_action_logs ml WHERE ml.memberId=lu.id) AS identityClaimLogCount,
        (SELECT COUNT(*) FROM point_balance_link_recovery_audit pa WHERE pa.memberId=lu.id) AS pointLinkAuditCount
      FROM line_users lu WHERE lu.id=?`,
      [memberId],
    );

    members.push({
      memberHash: createHash("sha256").update(String(memberId)).digest("hex"),
      hasRealLineId: Boolean(rawMember.hasRealLineId),
      hasEmail: Boolean(rawMember.hasEmail),
      hasPassword: Boolean(rawMember.hasPassword),
      isBlocked: Boolean(rawMember.isBlocked),
      userType: rawMember.userType,
      identityClass: rawMember.identityClass,
      createdAt: rawMember.createdAt,
      updatedAt: rawMember.updatedAt,
      ...detail,
    });
  }

  return {
    label,
    exactMemberMatches: members.length,
    members,
    messageEvidence: (messageRows as Record<string, unknown>[])[0] ?? {},
  };
}

const targetSchema = z.object({
  label: z.string().min(1).max(32).regex(/^[a-z0-9_-]+$/i),
  displayName: z.string().min(1).max(255),
});

export const lcjUserFlowAuditRouter = router({
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(1), targets: z.array(targetSchema).min(1).max(5) }))
    .query(async ({ input }) => {
      if (!verifyKey(input.key)) throw new Error("not found");
      const system = await first(`SELECT
        (SELECT COUNT(*) FROM line_users) AS memberRows,
        (SELECT COUNT(*) FROM line_users WHERE lineUserId LIKE 'U%') AS realLineMembers,
        (SELECT COUNT(*) FROM line_users WHERE email IS NOT NULL AND email<>'' AND password IS NOT NULL AND password<>'') AS emailLoginableMembers,
        (SELECT COUNT(*) FROM line_users WHERE isBlocked=1) AS blockedMembers,
        (SELECT COUNT(*) FROM line_point_balances) AS pointBalanceRows,
        (SELECT COALESCE(SUM(balance),0) FROM line_point_balances) AS pointBalanceTotal,
        (SELECT COUNT(*) FROM line_point_balances WHERE balance<0) AS negativePointBalances,
        (SELECT COUNT(*) FROM line_point_balances pb LEFT JOIN line_users lu ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id) WHERE lu.id IS NULL) AS orphanPointBalances,
        (SELECT COUNT(*) FROM line_users lu JOIN line_point_balances lp ON lp.lineUserId=lu.lineUserId JOIN line_point_balances ep ON ep.lineUserId=CONCAT('email_',lu.id) WHERE lp.balance<>0 AND ep.balance<>0) AS membersWithSplitPositiveBalances,
        (SELECT COUNT(*) FROM mall_products) AS productRows,
        (SELECT COUNT(*) FROM mall_products WHERE status='active') AS activeProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='active' AND stock>0) AS activeInStockProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='active' AND pointPrice IS NOT NULL AND pointPrice>0) AS activePointEligibleProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='active' AND pointPrice IS NOT NULL AND pointPrice>0 AND stock>0) AS exchangeableProducts,
        (SELECT COALESCE(SUM(stock),0) FROM mall_products WHERE status='active') AS activeStockTotal,
        (SELECT MIN(pointPrice) FROM mall_products WHERE status='active' AND pointPrice IS NOT NULL AND pointPrice>0 AND stock>0) AS minimumExchangePoints,
        (SELECT COUNT(*) FROM mall_orders WHERE paymentMethod='points') AS successfulPointOrders,
        (SELECT COUNT(*) FROM member_risk_restrictions WHERE status='active' AND expiresAt>NOW()) AS activeMemberRestrictions,
        (SELECT COUNT(*) FROM point_balance_link_recovery_runs WHERE status='success') AS successfulPointLinkRecoveryRuns,
        (SELECT COUNT(*) FROM point_balance_link_recovery_audit) AS pointLinkAuditRows`);

      const targets = [];
      for (const target of input.targets) targets.push(await targetSnapshot(target.label, target.displayName));
      return { capturedAt: new Date().toISOString(), system, targets };
    }),

  preRepairBackup: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (!verifyKey(input.key)) throw new Error("not found");
      const before = await first(`SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs`);
      await runDatabaseBackup("pre-user-flow-fix-v1", { force: true, waitForActive: true });
      const row = await first(
        `SELECT id,reason,status,tableCount,rowCount,encryptedBytes,checksum,completedAt,errorMessage
         FROM db_backup_runs WHERE id>? AND reason='pre-user-flow-fix-v1' ORDER BY id DESC LIMIT 1`,
        [Number(before.id ?? 0)],
      );
      if (row.status !== "success") throw new Error(`verified backup failed: ${String(row.errorMessage ?? "missing success row")}`);
      return row;
    }),
});
