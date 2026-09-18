import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  buildReceiptOrderNumberLockKeys,
  buildReceiptOrderNumberOneEditVariants,
  decideApproximateReceiptOrderSubmission,
  decideReceiptOrderSubmission,
  normalizeReceiptOrderNumber,
  receiptOrderDecisionMessage,
  selectBlockingApproximateOrderClaims,
  type ReceiptOrderClaim,
  type ReceiptOrderDecision,
} from "./receiptOrderNumberPolicy";

type LineReceiptClaimRow = RowDataPacket & {
  id: number;
  lineUserId: string;
  status: string;
  orderNumber: string | null;
  totalAmount: number | null;
  storeName: string | null;
};

type PointRequestClaimRow = RowDataPacket & {
  id: number;
  userId: number;
  status: string;
  email: string | null;
  orderNumber: string | null;
  orderAmount: number | null;
};

type LineMemberRow = RowDataPacket & {
  id: number;
  lineUserId: string | null;
  email: string | null;
};

type CurrentReceiptEvidenceRow = RowDataPacket & {
  totalAmount: number | null;
  storeName: string | null;
};

type LockRow = RowDataPacket & { acquired: number | null };

export type ClaimReceiptOrderNumberInput = {
  receiptId: number;
  lineUserId: string;
  orderNumber: unknown;
  /** Persisted with the order claim so concurrent one-edit OCR variants compare the same evidence. */
  totalAmount?: unknown;
  storeName?: string | null;
  /** Reserved for explicit admin resolution of same-account pending/on_hold copies. */
  allowSameAccountUnapproved?: boolean;
  /** Explicit admin verification only; automated callers must never enable this. */
  allowApproximateConflict?: boolean;
  /** Runs only after the claim transaction commits and while every order-family lock is held. */
  onAllowedWhileLocked?: (result: ClaimReceiptOrderNumberResult) => Promise<void>;
};

export type ClaimReceiptOrderNumberResult = {
  orderNumber: string;
  decision: ReceiptOrderDecision;
  message: string;
};

let receiptPolicyPool: Pool | null = null;

function getReceiptPolicyPool(): Pool {
  if (receiptPolicyPool) return receiptPolicyPool;
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is required for receipt order checks");
  receiptPolicyPool = mysql.createPool({
    uri,
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 50,
  });
  return receiptPolicyPool;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function addLineIdentityKeys(keys: Set<string>, member: LineMemberRow | null) {
  if (!member) return;
  keys.add(`member:${member.id}`);
  if (member.lineUserId) keys.add(`line:${member.lineUserId}`);
  const email = normalizeEmail(member.email);
  if (email) keys.add(`email:${email}`);
}

async function getLineIdentityKeys(
  connection: PoolConnection,
  lineUserId: string
): Promise<Set<string>> {
  const keys = new Set<string>([`line:${lineUserId}`]);
  const emailMemberId = lineUserId.startsWith("email_")
    ? Number(lineUserId.slice("email_".length))
    : null;
  if (emailMemberId && Number.isSafeInteger(emailMemberId)) {
    keys.add(`member:${emailMemberId}`);
  }

  const [rows] = await connection.execute<LineMemberRow[]>(
    `SELECT id, lineUserId, email
       FROM line_users
      WHERE lineUserId=? OR id=?
      LIMIT 2`,
    [lineUserId, emailMemberId || -1]
  );
  for (const row of rows) addLineIdentityKeys(keys, row);
  return keys;
}

function chooseClaimOwnerKey(
  claimKeys: Set<string>,
  claimantKeys: Set<string>,
  fallback: string
): string {
  for (const key of claimKeys) {
    if (claimantKeys.has(key)) return key;
  }
  return fallback;
}

async function loadOrderClaims(
  connection: PoolConnection,
  orderNumber: string,
  excludeReceiptId: number,
  claimantKeys: Set<string>,
  approximate = false
): Promise<ReceiptOrderClaim[]> {
  const orderNumbers = approximate
    ? buildReceiptOrderNumberOneEditVariants(orderNumber)
    : [orderNumber];
  if (orderNumbers.length === 0) return [];
  const placeholders = orderNumbers.map(() => "?").join(",");
  const [lineRows] = await connection.execute<LineReceiptClaimRow[]>(
    `SELECT id, lineUserId, status,
            COALESCE(orderNumber, CASE WHEN JSON_VALID(ocrRawText)=1 THEN JSON_UNQUOTE(JSON_EXTRACT(ocrRawText, '$.orderNumber')) ELSE NULL END) AS orderNumber,
            totalAmount, storeName
       FROM line_receipts
      WHERE id<>?
        AND COALESCE(orderNumber, CASE WHEN JSON_VALID(ocrRawText)=1 THEN JSON_UNQUOTE(JSON_EXTRACT(ocrRawText, '$.orderNumber')) ELSE NULL END) IN (${placeholders})
      FOR UPDATE`,
    [excludeReceiptId, ...orderNumbers]
  );

  const claims: ReceiptOrderClaim[] = [];
  for (const row of lineRows) {
    const claimKeys = await getLineIdentityKeys(connection, row.lineUserId);
    claims.push({
      id: Number(row.id),
      source: "line_receipt",
      ownerKey: chooseClaimOwnerKey(
        claimKeys,
        claimantKeys,
        `line:${row.lineUserId}`
      ),
      status: row.status,
      orderNumber: row.orderNumber || undefined,
      totalAmount: row.totalAmount === null ? null : Number(row.totalAmount),
      storeName: row.storeName,
      matchDistance: approximate ? 1 : 0,
    });
  }

  const [pointRows] = await connection.execute<PointRequestClaimRow[]>(
    `SELECT pr.id, pr.userId, pr.status, u.email, pr.orderNumber, pr.orderAmount
       FROM point_requests pr
       LEFT JOIN users u ON u.id=pr.userId
      WHERE pr.orderNumber IN (${placeholders})
      FOR UPDATE`,
    orderNumbers
  );
  for (const row of pointRows) {
    const pointKeys = new Set<string>([`user:${row.userId}`]);
    const email = normalizeEmail(row.email);
    if (email) pointKeys.add(`email:${email}`);
    claims.push({
      id: Number(row.id),
      source: "point_request",
      ownerKey: chooseClaimOwnerKey(
        pointKeys,
        claimantKeys,
        `user:${row.userId}`
      ),
      status: row.status,
      orderNumber: row.orderNumber || undefined,
      totalAmount: row.orderAmount === null ? null : Number(row.orderAmount),
      storeName: "TikTok Shop",
      matchDistance: approximate ? 1 : 0,
    });
  }

  return claims;
}

/**
 * Serializes the order-number eligibility check across Railway instances.
 * When allowed, the independent line_receipts.orderNumber column is saved while
 * holding the same MySQL named lock. An optional admin-only callback can complete
 * the evidence approval before that lock is released, so concurrent copies cannot
 * both pass the unapproved-claim check and receive points.
 */
export async function claimReceiptOrderNumber(
  input: ClaimReceiptOrderNumberInput
): Promise<ClaimReceiptOrderNumberResult> {
  const orderNumber = normalizeReceiptOrderNumber(input.orderNumber);
  if (!orderNumber) {
    throw new Error("A valid 16-19 digit order number is required");
  }

  const connection = await getReceiptPolicyPool().getConnection();
  const lockNames = buildReceiptOrderNumberLockKeys(orderNumber)
    .map(key => `lcj_receipt_order_v2_${key}`);
  const acquiredLocks: string[] = [];

  try {
    for (const lockName of lockNames) {
      const [lockRows] = await connection.execute<LockRow[]>(
        "SELECT GET_LOCK(?, 10) AS acquired",
        [lockName]
      );
      if (Number(lockRows[0]?.acquired) !== 1) {
        throw new Error("Order number check is busy; retry required");
      }
      acquiredLocks.push(lockName);
    }

    await connection.beginTransaction();
    const claimantKeys = await getLineIdentityKeys(
      connection,
      input.lineUserId
    );
    const exactClaims = await loadOrderClaims(
      connection,
      orderNumber,
      input.receiptId,
      claimantKeys
    );
    const exactDecision = decideReceiptOrderSubmission(exactClaims, claimantKeys, {
      allowSameAccountUnapproved: input.allowSameAccountUnapproved === true,
    });
    let currentEvidenceRows: CurrentReceiptEvidenceRow[] = [];
    if (exactDecision.allowed) {
      const [rows] = await connection.execute<CurrentReceiptEvidenceRow[]>(
        `SELECT totalAmount, storeName
           FROM line_receipts
          WHERE id=? AND lineUserId=?
          LIMIT 1
          FOR UPDATE`,
        [input.receiptId, input.lineUserId]
      );
      currentEvidenceRows = rows;
    }
    const currentAmount = Number(currentEvidenceRows[0]?.totalAmount || 0);
    const claimedAmount = Number(input.totalAmount || currentAmount || 0);
    const approximateClaims = exactDecision.allowed
      ? selectBlockingApproximateOrderClaims(
          await loadOrderClaims(
            connection,
            orderNumber,
            input.receiptId,
            claimantKeys,
            true
          ),
          claimedAmount
        )
      : [];
    const approximateDecision = exactDecision.allowed
      ? decideApproximateReceiptOrderSubmission(approximateClaims, claimantKeys, {
          allowApproximateConflict: input.allowApproximateConflict === true,
        })
      : null;
    const decision = approximateDecision || exactDecision;

    if (decision.allowed) {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE line_receipts
            SET orderNumber=?,
                totalAmount=CASE WHEN ? > 0 THEN ? ELSE totalAmount END,
                storeName=COALESCE(NULLIF(?, ''), storeName)
          WHERE id=? AND lineUserId=?`,
        [
          orderNumber,
          claimedAmount,
          claimedAmount,
          input.storeName?.trim() || null,
          input.receiptId,
          input.lineUserId,
        ]
      );
      if (Number(result.affectedRows) !== 1) {
        throw new Error("Receipt identity changed during order number claim");
      }
    }

    await connection.commit();
    const result = {
      orderNumber,
      decision,
      message: receiptOrderDecisionMessage(decision, orderNumber),
    } satisfies ClaimReceiptOrderNumberResult;
    if (decision.allowed && input.onAllowedWhileLocked) {
      await input.onAllowedWhileLocked(result);
    }
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    for (const lockName of acquiredLocks.reverse()) {
      try {
        await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
      } catch {
        // The connection closing also releases the named lock.
      }
    }
    connection.release();
  }
}
