import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  bwAuditCentralLedgerByEmail,
  bwResolveCustomerForVerifiedLink,
} from "./bw-api";
import { sendEmail } from "./emailService";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_MAX_ATTEMPTS = 5;
const CHALLENGE_RATE_WINDOW_MS = 60 * 60 * 1000;
const CHALLENGE_RATE_LIMIT = 5;
const BEAUTY_WALLET_REGISTRATION_URL = "https://www.beautypass.ai/register";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 4,
    enableKeepAlive: true,
  });
  return pool;
}

export async function ensureBeautyWalletMemberLinkSchema(): Promise<void> {
  const database = getPool();
  const requiredColumns: Record<string, string[]> = {
    bw_member_link_challenges: [
      "id",
      "lineUserId",
      "email",
      "emailHash",
      "tokenHash",
      "codeHash",
      "status",
      "attemptCount",
      "expiresAt",
      "consumedAt",
      "createdAt",
    ],
    bw_member_link_audit_logs: [
      "id",
      "lineUserId",
      "event",
      "bwCustomerId",
      "emailHash",
      "details",
      "createdAt",
    ],
    bw_wallet_active_owners: [
      "bwCustomerId",
      "lineUserId",
      "verifiedEmailHash",
      "linkedAt",
      "updatedAt",
    ],
    bw_linked_accounts: [
      "id",
      "lineUserId",
      "bwUserId",
      "bwCustomerId",
      "bwDisplayName",
      "bwEmail",
      "status",
      "linkedAt",
      "unlinkedAt",
      "linkToken",
      "linkTokenExpiresAt",
      "updatedAt",
    ],
  };
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const [rows] = await database.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
      [tableName]
    );
    const found = new Set(rows.map(row => String(row.COLUMN_NAME)));
    const missing = columns.filter(column => !found.has(column));
    if (missing.length > 0) {
      throw new Error(
        `Beauty Wallet member-link schema is incomplete: ${tableName}.${missing.join(",")}`
      );
    }
  }

  const requiredUniqueIndexes = [
    {
      tableName: "bw_member_link_challenges",
      columns: "tokenHash",
    },
    {
      tableName: "bw_wallet_active_owners",
      columns: "bwCustomerId",
    },
    {
      tableName: "bw_wallet_active_owners",
      columns: "lineUserId",
    },
    {
      tableName: "bw_linked_accounts",
      columns: "lineUserId",
    },
  ];
  for (const index of requiredUniqueIndexes) {
    const [rows] = await database.query<RowDataPacket[]>(
      `SELECT INDEX_NAME,NON_UNIQUE,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexedColumns
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?
        GROUP BY INDEX_NAME,NON_UNIQUE`,
      [index.tableName]
    );
    const hasRequiredUniqueIndex = rows.some(
      row =>
        Number(row.NON_UNIQUE) === 0 &&
        String(row.indexedColumns || "") === index.columns
    );
    if (!hasRequiredUniqueIndex) {
      throw new Error(
        `Beauty Wallet member-link schema is missing unique index: ${index.tableName}(${index.columns})`
      );
    }
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function challengeSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

function hashCode(token: string, code: string): string {
  return createHmac("sha256", challengeSecret())
    .update(`${token}:${code}`)
    .digest("hex");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right))
    return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function requestIpHash(req: { ip?: string | null }): string {
  const value = req.ip || "unknown";
  return createHmac("sha256", challengeSecret())
    .update(String(value).trim())
    .digest("hex");
}

async function appendAudit(
  connection: PoolConnection,
  input: {
    lineUserId: number;
    event: string;
    bwCustomerId?: number | null;
    emailHash?: string | null;
    details?: Record<string, unknown> | null;
  }
) {
  await connection.query(
    `INSERT INTO bw_member_link_audit_logs
       (lineUserId,event,bwCustomerId,emailHash,details,createdAt)
     VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)`,
    [
      input.lineUserId,
      input.event,
      input.bwCustomerId ?? null,
      input.emailHash ?? null,
      input.details ? JSON.stringify(input.details) : null,
    ]
  );
}

export async function getMemberWalletLinkStatus(lineUserId: number) {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT l.id,l.bwCustomerId,l.bwDisplayName,l.bwEmail,l.linkedAt
       FROM bw_linked_accounts l
       INNER JOIN bw_wallet_active_owners o
         ON o.lineUserId=l.lineUserId AND o.bwCustomerId=l.bwCustomerId
      WHERE l.lineUserId=? AND l.status='active' AND l.bwCustomerId IS NOT NULL AND l.bwCustomerId>0
        AND EXISTS (
          SELECT 1 FROM bw_member_link_audit_logs a
           WHERE a.lineUserId=l.lineUserId
             AND a.bwCustomerId=l.bwCustomerId
             AND a.event='wallet_linked'
        )
      LIMIT 1`,
    [lineUserId]
  );
  const row = rows[0];
  if (!row) {
    return {
      linked: false as const,
      primaryLedger: "beauty_wallet" as const,
      registrationUrl: BEAUTY_WALLET_REGISTRATION_URL,
    };
  }
  return {
    linked: true as const,
    primaryLedger: "beauty_wallet" as const,
    linkedAt: row.linkedAt,
    displayName: String(row.bwDisplayName || ""),
    maskedEmail: maskEmail(String(row.bwEmail || "")),
  };
}

export async function getMemberCentralLedger(lineUserId: number) {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT l.bwEmail
       FROM bw_linked_accounts l
       INNER JOIN bw_wallet_active_owners o
         ON o.lineUserId=l.lineUserId AND o.bwCustomerId=l.bwCustomerId
      WHERE l.lineUserId=? AND l.status='active' AND l.bwCustomerId IS NOT NULL AND l.bwCustomerId>0
        AND EXISTS (
          SELECT 1 FROM bw_member_link_audit_logs a
           WHERE a.lineUserId=l.lineUserId
             AND a.bwCustomerId=l.bwCustomerId
             AND a.event='wallet_linked'
        )
      LIMIT 1`,
    [lineUserId]
  );
  const email = String(rows[0]?.bwEmail || "");
  if (!email) {
    return {
      linked: false as const,
      primaryLedger: "beauty_wallet" as const,
      centralLedgerAvailable: false,
      unifiedTotal: null,
      failureCode: "NOT_LINKED",
    };
  }
  let audit: Awaited<ReturnType<typeof bwAuditCentralLedgerByEmail>>;
  try {
    audit = await bwAuditCentralLedgerByEmail(email);
  } catch {
    return {
      linked: true as const,
      primaryLedger: "beauty_wallet" as const,
      centralLedgerAvailable: false,
      unifiedTotal: null,
      storeCount: 0,
      uniqueTransactionCount: 0,
      checkedAt: new Date().toISOString(),
      failureCode: "LEDGER_UNAVAILABLE",
    };
  }
  return {
    linked: true as const,
    primaryLedger: "beauty_wallet" as const,
    centralLedgerAvailable: audit.centralLedgerAvailable,
    unifiedTotal: audit.centralLedgerAvailable ? audit.unifiedTotal : null,
    storeCount: audit.storeCount,
    uniqueTransactionCount: audit.uniqueTransactionCount,
    checkedAt: new Date().toISOString(),
    failureCode: audit.failureCode,
  };
}

export async function requestMemberWalletLinkChallenge(input: {
  lineUserId: number;
  email: string;
  req: { ip?: string | null };
}) {
  const email = normalizeEmail(input.email);
  const emailHash = sha256(email);
  const ipHash = requestIpHash(input.req);
  const database = getPool();
  const token = randomBytes(32).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const connection = await database.getConnection();
  const rateLockNames = [
    `bw-link-rate-member-${input.lineUserId}`,
    `bw-link-rate-email-${emailHash.slice(0, 32)}`,
    `bw-link-rate-ip-${ipHash.slice(0, 32)}`,
  ].sort();
  const acquiredLocks: string[] = [];
  let challengeId = 0;
  try {
    for (const lockName of rateLockNames) {
      const [lockRows] = await connection.query<RowDataPacket[]>(
        "SELECT GET_LOCK(?,5) AS acquired",
        [lockName]
      );
      if (Number(lockRows[0]?.acquired || 0) !== 1) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "確認メールの送信処理が混み合っています。もう一度お試しください",
        });
      }
      acquiredLocks.push(lockName);
    }
    await connection.beginTransaction();
    const [rateRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS requestCount
         FROM bw_member_link_challenges c
         LEFT JOIN bw_member_link_audit_logs a
           ON a.lineUserId=c.lineUserId AND a.event='challenge_requested'
          AND JSON_UNQUOTE(JSON_EXTRACT(a.details,'$.challengeId'))=CAST(c.id AS CHAR)
        WHERE c.createdAt >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)
          AND (c.lineUserId=? OR c.emailHash=? OR JSON_UNQUOTE(JSON_EXTRACT(a.details,'$.ipHash'))=?)`,
      [input.lineUserId, emailHash, ipHash]
    );
    if (Number(rateRows[0]?.requestCount || 0) >= CHALLENGE_RATE_LIMIT) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "確認メールの送信回数が上限に達しました。1時間後にお試しください",
      });
    }
    await connection.query(
      `UPDATE bw_member_link_challenges
          SET status='superseded'
        WHERE lineUserId=? AND status='pending'`,
      [input.lineUserId]
    );
    const [result] = await connection.query<mysql.ResultSetHeader>(
      `INSERT INTO bw_member_link_challenges
         (lineUserId,email,emailHash,tokenHash,codeHash,status,attemptCount,expiresAt,createdAt)
       VALUES (?,?,?,?,?,'pending',0,?,CURRENT_TIMESTAMP)`,
      [
        input.lineUserId,
        email,
        emailHash,
        sha256(token),
        hashCode(token, code),
        expiresAt,
      ]
    );
    challengeId = result.insertId;
    await appendAudit(connection, {
      lineUserId: input.lineUserId,
      event: "challenge_requested",
      emailHash,
      details: { challengeId: String(challengeId), ipHash },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    for (const lockName of acquiredLocks.reverse()) {
      await connection
        .query("SELECT RELEASE_LOCK(?)", [lockName])
        .catch(() => undefined);
    }
    connection.release();
  }

  const delivery = await sendEmail({
    to: [email],
    subject: "Beauty Wallet 連携確認コード",
    content: `Beauty Wallet連携の確認コードは ${code} です。10分以内に入力してください。この操作に心当たりがない場合は、このメールを破棄してください。`,
    html: `<div style="font-family:Arial,'Noto Sans JP',sans-serif;color:#202124;line-height:1.7"><h2 style="margin:0 0 16px">Beauty Wallet 連携確認</h2><p>以下の確認コードをLCJ MALLの連携画面に入力してください。</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px 22px;background:#f6f3ff;border-radius:12px;display:inline-block">${code}</div><p>有効期限は10分です。この操作に心当たりがない場合は、このメールを破棄してください。</p></div>`,
  });
  if (!delivery.success) {
    await database.query(
      `UPDATE bw_member_link_challenges SET status='delivery_failed' WHERE id=? AND status='pending'`,
      [challengeId]
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "確認メールを送信できませんでした。時間をおいて再度お試しください",
    });
  }

  return {
    challengeToken: token,
    maskedEmail: maskEmail(email),
    expiresInSeconds: CHALLENGE_TTL_MS / 1000,
  };
}

export async function confirmMemberWalletLink(input: {
  lineUserId: number;
  challengeToken: string;
  code: string;
}) {
  const database = getPool();
  const tokenHash = sha256(input.challengeToken);
  const connection = await database.getConnection();
  const challengeLockName = `bw-link-challenge-${tokenHash.slice(0, 32)}`;
  const acquiredLocks: string[] = [];
  let transactionStarted = false;
  let challenge: RowDataPacket | undefined;
  let email = "";
  let customer: { id: number; name: string; hasWallet: boolean } | null = null;

  const acquireLock = async (lockName: string, message: string) => {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?,5) AS acquired",
      [lockName]
    );
    if (Number(lockRows[0]?.acquired || 0) !== 1) {
      throw new TRPCError({ code: "CONFLICT", message });
    }
    acquiredLocks.push(lockName);
  };

  try {
    // Serialize every confirmation for this challenge before reading attempts,
    // expiry or status. This closes parallel replay and five-attempt races.
    await acquireLock(
      challengeLockName,
      "確認処理が混み合っています。もう一度お試しください"
    );
    const [challengeRows] = await connection.query<RowDataPacket[]>(
      `SELECT id,email,emailHash,codeHash,attemptCount,status,expiresAt
         FROM bw_member_link_challenges
        WHERE lineUserId=? AND tokenHash=?
        LIMIT 1`,
      [input.lineUserId, tokenHash]
    );
    challenge = challengeRows[0];
    if (!challenge || String(challenge.status) !== "pending") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "確認コードが無効です",
      });
    }
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      await connection.query(
        `UPDATE bw_member_link_challenges SET status='expired' WHERE id=? AND status='pending'`,
        [challenge.id]
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "確認コードの有効期限が切れました",
      });
    }

    const attempts = Number(challenge.attemptCount || 0);
    if (attempts >= CHALLENGE_MAX_ATTEMPTS) {
      await connection.query(
        `UPDATE bw_member_link_challenges SET status='locked' WHERE id=? AND status='pending'`,
        [challenge.id]
      );
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "確認コードの入力回数が上限に達しました",
      });
    }

    const expectedHash = String(challenge.codeHash || "");
    const actualHash = hashCode(input.challengeToken, input.code);
    if (!constantTimeHexEqual(expectedHash, actualHash)) {
      await connection.query(
        `UPDATE bw_member_link_challenges
            SET attemptCount=attemptCount+1,
                status=IF(attemptCount+1>=?,'locked','pending')
          WHERE id=? AND status='pending'`,
        [CHALLENGE_MAX_ATTEMPTS, challenge.id]
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "確認コードが正しくありません",
      });
    }

    email = normalizeEmail(String(challenge.email));
    const resolved = await bwResolveCustomerForVerifiedLink(email);
    if (!resolved.found || !resolved.customer) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          resolved.failureCode === "LOOKUP_UNAVAILABLE"
            ? "Beauty Walletの確認に失敗しました。時間をおいて再度お試しください"
            : "このメールアドレスのBeauty Walletアカウントが見つかりません。先にBeauty Walletで新規登録してください",
      });
    }
    if (!resolved.customer.hasWallet) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Beauty Walletの利用開始後、もう一度連携してください",
      });
    }
    customer = resolved.customer;

    // Keep the challenge lock while also locking both sides of ownership. The
    // unique indexes remain the final database-level arbiter for cross-races.
    const ownershipLocks = [
      `bw-link-member-${input.lineUserId}`,
      `bw-link-wallet-${customer.id}`,
    ].sort();
    for (const lockName of ownershipLocks) {
      await acquireLock(
        lockName,
        "連携処理が混み合っています。もう一度お試しください"
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;
    const [lockedChallengeRows] = await connection.query<RowDataPacket[]>(
      `SELECT status,attemptCount,expiresAt
         FROM bw_member_link_challenges
        WHERE id=? FOR UPDATE`,
      [challenge.id]
    );
    const lockedChallenge = lockedChallengeRows[0];
    if (
      !lockedChallenge ||
      String(lockedChallenge.status) !== "pending" ||
      Number(lockedChallenge.attemptCount || 0) >= CHALLENGE_MAX_ATTEMPTS ||
      new Date(lockedChallenge.expiresAt).getTime() <= Date.now()
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "確認処理をもう一度やり直してください",
      });
    }

    const [ownerRows] = await connection.query<RowDataPacket[]>(
      `SELECT bwCustomerId,lineUserId
         FROM bw_wallet_active_owners
        WHERE bwCustomerId=? OR lineUserId=?
        FOR UPDATE`,
      [customer.id, input.lineUserId]
    );
    if (
      ownerRows.some(
        owner =>
          Number(owner.bwCustomerId) !== customer!.id ||
          Number(owner.lineUserId) !== input.lineUserId
      )
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "このBeauty Walletまたは会員は別の連携に使用されています。サポートへお問い合わせください",
      });
    }

    const [duplicateRows] = await connection.query<RowDataPacket[]>(
      `SELECT lineUserId
         FROM bw_linked_accounts
        WHERE bwCustomerId=? AND status='active' AND lineUserId<>?
        LIMIT 1 FOR UPDATE`,
      [customer.id, input.lineUserId]
    );
    if (duplicateRows.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "このBeauty Walletは別の会員に連携済みです。サポートへお問い合わせください",
      });
    }

    const [currentRows] = await connection.query<RowDataPacket[]>(
      `SELECT id,bwCustomerId,status
         FROM bw_linked_accounts
        WHERE lineUserId=?
        LIMIT 1 FOR UPDATE`,
      [input.lineUserId]
    );
    const current = currentRows[0];
    if (
      current &&
      String(current.status) === "active" &&
      Number(current.bwCustomerId || 0) > 0 &&
      Number(current.bwCustomerId) !== customer.id
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "別のBeauty Walletが連携済みです。変更はサポートへお問い合わせください",
      });
    }

    if (current) {
      await connection.query(
        `UPDATE bw_linked_accounts
            SET bwUserId=?,bwCustomerId=?,bwDisplayName=?,bwEmail=?,status='active',
                linkedAt=CURRENT_TIMESTAMP,unlinkedAt=NULL,linkToken=NULL,linkTokenExpiresAt=NULL,
                updatedAt=CURRENT_TIMESTAMP
          WHERE id=?`,
        [String(customer.id), customer.id, customer.name, email, current.id]
      );
    } else {
      await connection.query(
        `INSERT INTO bw_linked_accounts
           (lineUserId,bwUserId,bwCustomerId,bwDisplayName,bwEmail,status,linkedAt,createdAt,updatedAt)
         VALUES (?,?,?,?,?,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [
          input.lineUserId,
          String(customer.id),
          customer.id,
          customer.name,
          email,
        ]
      );
    }

    if (ownerRows.length > 0) {
      await connection.query(
        `UPDATE bw_wallet_active_owners
            SET verifiedEmailHash=?,updatedAt=CURRENT_TIMESTAMP
          WHERE bwCustomerId=? AND lineUserId=?`,
        [String(challenge.emailHash), customer.id, input.lineUserId]
      );
    } else {
      await connection.query(
        `INSERT INTO bw_wallet_active_owners
           (bwCustomerId,lineUserId,verifiedEmailHash,linkedAt,updatedAt)
         VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [customer.id, input.lineUserId, String(challenge.emailHash)]
      );
    }

    await connection.query(
      `UPDATE bw_member_link_challenges
          SET status='consumed',consumedAt=CURRENT_TIMESTAMP
        WHERE id=? AND status='pending'`,
      [challenge.id]
    );
    await appendAudit(connection, {
      lineUserId: input.lineUserId,
      event: "wallet_linked",
      bwCustomerId: customer.id,
      emailHash: String(challenge.emailHash),
      details: { method: "email_otp", challengeId: String(challenge.id) },
    });
    await connection.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback().catch(() => undefined);
    }
    throw error;
  } finally {
    for (const lockName of acquiredLocks.reverse()) {
      await connection
        .query("SELECT RELEASE_LOCK(?)", [lockName])
        .catch(() => undefined);
    }
    connection.release();
  }

  let ledger: Awaited<ReturnType<typeof bwAuditCentralLedgerByEmail>> | null =
    null;
  try {
    ledger = await bwAuditCentralLedgerByEmail(email);
  } catch {
    // The link transaction has already committed. Return a fail-closed balance
    // state rather than encouraging a duplicate retry or inventing a balance.
  }
  return {
    linked: true as const,
    primaryLedger: "beauty_wallet" as const,
    maskedEmail: maskEmail(email),
    centralLedgerAvailable: Boolean(ledger?.centralLedgerAvailable),
    unifiedTotal: ledger?.centralLedgerAvailable ? ledger.unifiedTotal : null,
  };
}

export const beautyWalletRegistrationUrl = BEAUTY_WALLET_REGISTRATION_URL;
