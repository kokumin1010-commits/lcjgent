import crypto from "node:crypto";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type ReceiptS3RecoveryInput = {
  lineUserId: string;
  submittedAt: string;
  imageKeys: string[];
  etags: Array<string | null>;
  fraudFlags?: string[];
};

export type ReceiptS3RecoveryChunkInput = {
  batchId: string;
  receipts: ReceiptS3RecoveryInput[];
};

type ReceiptRecoverySummary = {
  membersCreated: number;
  membersReused: number;
  receiptCandidates: number;
  receiptsCreated: number;
  receiptsReused: number;
  duplicateFlagged: number;
  auditRowsCreated: number;
};

function publicUrlForKey(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  const cdnDomain = process.env.AWS_S3_PUBLIC_URL;
  if (cdnDomain) return `${cdnDomain.replace(/\/+$/, "")}/${normalized}`;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const bucket = process.env.AWS_S3_BUCKET;
  if (endpoint && bucket) {
    return `${endpoint.replace(/\/+$/, "")}/${bucket}/${normalized}`;
  }
  const region = process.env.AWS_S3_REGION || "us-east-1";
  if (!bucket) throw new Error("AWS_S3_BUCKET not configured");
  return `https://${bucket}.s3.${region}.amazonaws.com/${normalized}`;
}

function asSqlDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error(`Invalid receipt timestamp: ${value}`);
  return date;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

function validateReceipt(receipt: ReceiptS3RecoveryInput): void {
  if (!/^(?:U[0-9a-f]{32}|email_\d+)$/i.test(receipt.lineUserId)) {
    throw new Error("Invalid recovered LINE user identifier");
  }
  if (receipt.imageKeys.length < 1 || receipt.imageKeys.length > 5) {
    throw new Error("Recovered receipt must contain 1-5 images");
  }
  for (const key of receipt.imageKeys) {
    if (!key.startsWith(`web-receipts/${receipt.lineUserId}/`)) {
      throw new Error("Receipt image key does not match LINE user identifier");
    }
  }
  asSqlDate(receipt.submittedAt);
}

async function ensureRecoveryAuditTable(
  connection: mysql.PoolConnection
): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS \`receipt_s3_recovery_audit\` (
    \`id\` bigint NOT NULL AUTO_INCREMENT,
    \`batchId\` varchar(64) NOT NULL,
    \`primaryImageKey\` varchar(512) NOT NULL,
    \`lineUserId\` varchar(64) NOT NULL,
    \`receiptId\` int NOT NULL,
    \`imageCount\` int NOT NULL,
    \`evidenceSha256\` char(64) NOT NULL,
    \`action\` varchar(32) NOT NULL,
    \`recoveredAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`receipt_s3_recovery_key_unique\` (\`primaryImageKey\`(191)),
    KEY \`receipt_s3_recovery_batch_idx\` (\`batchId\`),
    KEY \`receipt_s3_recovery_receipt_idx\` (\`receiptId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function restoreReceiptS3Chunk(
  input: ReceiptS3RecoveryChunkInput
): Promise<ReceiptRecoverySummary> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not configured");
  if (input.receipts.length < 1 || input.receipts.length > 200) {
    throw new Error("Receipt recovery chunk must contain 1-200 records");
  }
  for (const receipt of input.receipts) validateReceipt(receipt);

  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 });
  const connection = await pool.getConnection();
  const summary: ReceiptRecoverySummary = {
    membersCreated: 0,
    membersReused: 0,
    receiptCandidates: input.receipts.length,
    receiptsCreated: 0,
    receiptsReused: 0,
    duplicateFlagged: input.receipts.filter(receipt =>
      (receipt.fraudFlags || []).includes("duplicate_image_etag")
    ).length,
    auditRowsCreated: 0,
  };

  try {
    await connection.beginTransaction();
    await ensureRecoveryAuditTable(connection);

    const lineUserIds = [
      ...new Set(input.receipts.map(receipt => receipt.lineUserId)),
    ];
    const [existingMemberRows] = await connection.query<RowDataPacket[]>(
      `SELECT \`id\`, \`lineUserId\` FROM \`line_users\` WHERE \`lineUserId\` IN (${placeholders(lineUserIds.length)})`,
      lineUserIds
    );
    const memberMap = new Map<string, number>();
    for (const row of existingMemberRows) {
      memberMap.set(String(row.lineUserId), Number(row.id));
    }
    summary.membersReused = existingMemberRows.length;

    const missingUserIds = lineUserIds.filter(
      lineUserId => !memberMap.has(lineUserId)
    );
    if (missingUserIds.length > 0) {
      const values = missingUserIds
        .map(() => "(?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
        .join(",");
      const parameters: unknown[] = [];
      for (const lineUserId of missingUserIds) {
        const displayName = lineUserId.startsWith("email_")
          ? `復旧会員 #${lineUserId.slice(6)}`
          : "LINEレシート履歴復旧会員";
        parameters.push(
          lineUserId,
          displayName,
          "S3レシート履歴から復旧・本人再連携待ち"
        );
      }
      await connection.execute(
        `INSERT IGNORE INTO \`line_users\`
          (\`lineUserId\`, \`displayName\`, \`statusMessage\`, \`createdAt\`, \`updatedAt\`)
         VALUES ${values}`,
        parameters
      );
      const [memberRows] = await connection.query<RowDataPacket[]>(
        `SELECT \`id\`, \`lineUserId\` FROM \`line_users\` WHERE \`lineUserId\` IN (${placeholders(lineUserIds.length)})`,
        lineUserIds
      );
      memberMap.clear();
      for (const row of memberRows) {
        memberMap.set(String(row.lineUserId), Number(row.id));
      }
      summary.membersCreated = missingUserIds.filter(lineUserId =>
        memberMap.has(lineUserId)
      ).length;
    }

    const primaryKeys = input.receipts.map(receipt => receipt.imageKeys[0]);
    const [existingReceiptRows] = await connection.query<RowDataPacket[]>(
      `SELECT \`id\`, \`imageKey\` FROM \`line_receipts\` WHERE \`imageKey\` IN (${placeholders(primaryKeys.length)})`,
      primaryKeys
    );
    const receiptIdByKey = new Map<string, number>();
    for (const row of existingReceiptRows) {
      receiptIdByKey.set(String(row.imageKey), Number(row.id));
    }
    summary.receiptsReused = existingReceiptRows.length;

    const missingReceipts = input.receipts.filter(
      receipt => !receiptIdByKey.has(receipt.imageKeys[0])
    );
    if (missingReceipts.length > 0) {
      const values = missingReceipts
        .map(() => "(?, ?, ?, ?, NULL, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)")
        .join(",");
      const parameters: unknown[] = [];
      for (const receipt of missingReceipts) {
        const imageUrls = receipt.imageKeys.map(publicUrlForKey);
        const flags = ["recovered_from_s3", ...(receipt.fraudFlags || [])];
        const uniqueFlags = [...new Set(flags)];
        const submittedAt = asSqlDate(receipt.submittedAt);
        const messageId = `s3rec_${crypto
          .createHash("sha256")
          .update(receipt.imageKeys[0])
          .digest("hex")
          .slice(0, 40)}`;
        parameters.push(
          receipt.lineUserId,
          messageId,
          imageUrls[0],
          receipt.imageKeys[0],
          JSON.stringify(imageUrls),
          JSON.stringify(receipt.imageKeys),
          `S3保存履歴から復旧。元のAI解析・審査履歴は消失しているため再審査待ち。batch=${input.batchId}`,
          JSON.stringify(uniqueFlags),
          uniqueFlags.includes("duplicate_image_etag") ? "50.00" : "0.00",
          submittedAt,
          submittedAt,
          submittedAt
        );
      }
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO \`line_receipts\`
          (\`lineUserId\`, \`lineMessageId\`, \`imageUrl\`, \`imageKey\`, \`imageHash\`, \`imageUrls\`, \`imageKeys\`,
           \`status\`, \`reviewNote\`, \`fraudFlags\`, \`fraudScore\`, \`submittedAt\`, \`createdAt\`, \`updatedAt\`)
         VALUES ${values}`,
        parameters
      );
      summary.receiptsCreated = insertResult.affectedRows;

      const insertedKeys = missingReceipts.map(receipt => receipt.imageKeys[0]);
      const [insertedRows] = await connection.query<RowDataPacket[]>(
        `SELECT \`id\`, \`imageKey\` FROM \`line_receipts\` WHERE \`imageKey\` IN (${placeholders(insertedKeys.length)})`,
        insertedKeys
      );
      for (const row of insertedRows) {
        receiptIdByKey.set(String(row.imageKey), Number(row.id));
      }
    }

    const auditValues: string[] = [];
    const auditParameters: unknown[] = [];
    for (const receipt of input.receipts) {
      const primaryImageKey = receipt.imageKeys[0];
      const receiptId = receiptIdByKey.get(primaryImageKey);
      if (!receiptId) throw new Error("Recovered receipt ID not found");
      const evidenceSha256 = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            lineUserId: receipt.lineUserId,
            submittedAt: receipt.submittedAt,
            imageKeys: receipt.imageKeys,
            etags: receipt.etags,
          })
        )
        .digest("hex");
      auditValues.push("(?, ?, ?, ?, ?, ?, ?)");
      auditParameters.push(
        input.batchId,
        primaryImageKey,
        receipt.lineUserId,
        receiptId,
        receipt.imageKeys.length,
        evidenceSha256,
        missingReceipts.some(item => item.imageKeys[0] === primaryImageKey)
          ? "created"
          : "reused"
      );
    }
    const [auditResult] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO \`receipt_s3_recovery_audit\`
        (\`batchId\`, \`primaryImageKey\`, \`lineUserId\`, \`receiptId\`, \`imageCount\`, \`evidenceSha256\`, \`action\`)
       VALUES ${auditValues.join(",")}`,
      auditParameters
    );
    summary.auditRowsCreated = auditResult.affectedRows;

    await connection.commit();
    return summary;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}
