import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  decideReceiptOrderSubmission,
  normalizeReceiptOrderNumber,
  receiptOrderDecisionMessage,
  type ReceiptOrderClaim,
  type ReceiptOrderDecision,
} from "./receiptOrderNumberPolicy";

type LineReceiptClaimRow = RowDataPacket & {
  id: number;
  lineUserId: string;
  status: string;
};

type PointRequestClaimRow = RowDataPacket & {
  id: number;
  userId: number;
  status: string;
  email: string | null;
};

type LineMemberRow = RowDataPacket & {
  id: number;
  lineUserId: string | null;
  email: string | null;
};

type LockRow = RowDataPacket & { acquired: number | null };

export type ClaimReceiptOrderNumberInput = {
  receiptId: number;
  lineUserId: string;
  orderNumber: unknown;
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
  claimantKeys: Set<string>
): Promise<ReceiptOrderClaim[]> {
  const [lineRows] = await connection.execute<LineReceiptClaimRow[]>(
    `SELECT id, lineUserId, status
       FROM line_receipts
      WHERE id<>?
        AND (
          orderNumber=?
          OR (
            JSON_VALID(ocrRawText)=1
            AND JSON_UNQUOTE(JSON_EXTRACT(ocrRawText, '$.orderNumber'))=?
          )
        )
      FOR UPDATE`,
    [excludeReceiptId, orderNumber, orderNumber]
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
    });
  }

  const [pointRows] = await connection.execute<PointRequestClaimRow[]>(
    `SELECT pr.id, pr.userId, pr.status, u.email
       FROM point_requests pr
       LEFT JOIN users u ON u.id=pr.userId
      WHERE pr.orderNumber=?
      FOR UPDATE`,
    [orderNumber]
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
    });
  }

  return claims;
}

/**
 * Serializes the order-number eligibility check across Railway instances.
 * When allowed, the independent line_receipts.orderNumber column is saved while
 * still holding the same MySQL named lock so a concurrent claimant sees it.
 */
export async function claimReceiptOrderNumber(
  input: ClaimReceiptOrderNumberInput
): Promise<ClaimReceiptOrderNumberResult> {
  const orderNumber = normalizeReceiptOrderNumber(input.orderNumber);
  if (!orderNumber) {
    throw new Error("A valid 16-19 digit order number is required");
  }

  const connection = await getReceiptPolicyPool().getConnection();
  const lockName = `lcj_receipt_order_${orderNumber}`;
  let acquired = false;

  try {
    const [lockRows] = await connection.execute<LockRow[]>(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [lockName]
    );
    acquired = Number(lockRows[0]?.acquired) === 1;
    if (!acquired) throw new Error("Order number check is busy; retry required");

    await connection.beginTransaction();
    const claimantKeys = await getLineIdentityKeys(
      connection,
      input.lineUserId
    );
    const claims = await loadOrderClaims(
      connection,
      orderNumber,
      input.receiptId,
      claimantKeys
    );
    const decision = decideReceiptOrderSubmission(claims, claimantKeys);

    if (decision.allowed) {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE line_receipts
            SET orderNumber=?
          WHERE id=? AND lineUserId=?`,
        [orderNumber, input.receiptId, input.lineUserId]
      );
      if (Number(result.affectedRows) !== 1) {
        throw new Error("Receipt identity changed during order number claim");
      }
    }

    await connection.commit();
    return {
      orderNumber,
      decision,
      message: receiptOrderDecisionMessage(decision, orderNumber),
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    if (acquired) {
      try {
        await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
      } catch {
        // The connection closing also releases the named lock.
      }
    }
    connection.release();
  }
}
