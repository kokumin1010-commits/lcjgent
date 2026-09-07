import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export const VIP_BATCH_KEY = "vip-2026-highlighted-41-v1";
export const VIP_BATCH_CONFIRMATION = "VIP-41";
export const VIP_TARGET_IDENTITY_COUNT = 41;
export const VIP_TARGET_TICKET_COUNT_AT_AUDIT = 42;
export const VIP_IDENTITY_HASH_SALT = "lcf-vip-2026:v1:";
export const VIP_TARGET_MANIFEST_SHA256 = "35604c9a9724d5a7bf8f92a1c2bcc5dab8981aa472b352b3ff1e20f71b3a0cd2";

// Private-repository manifest: salted hashes only. No name, email, ticket ID or QR value is stored in source.
export const VIP_TARGET_IDENTITY_HASHES = [
  "0358a4b795028e3e962ea8bbfcb8105b72124911128a5ec014630345f6fe679f",
  "0db5568d2336ceeb357729f681f9bd5bde04aaef41ceb0e51aa5f6411f2d49ac",
  "126da6fe705e81fa2d5f7e887e97104efbf9eadd2b0e9b811ee27835a01a3d34",
  "133413b133432e1af632ca11c25d4b422a4fa146365d0a2f9ebeafb602f17df4",
  "15d409e4e118b2561d9fbe033037f645fe4974b5597baeeea5a30dad4c1960f8",
  "23a1f22881257d21a59a2ea7774d5a5a246feab52b3804aa7fafd315ab6e39d1",
  "2450dfd9ff86751f1c434790882a62729e101ce581a98f694d2fc635723919e1",
  "2af92d8f43d9d54151b0e5947916b853939c1817f414eecd33569d3acc525025",
  "30132a5dd2d1f741bc4777604780d8a0efcb7ff4d6e08fd0257df1ccfdd4ee66",
  "31ae5f27bf0f718bd8b630332964033d5ee969f7c03f013744f0a243e1eb919d",
  "338b6fd6171802e1885d47c004a2714c37397873a3c0108b0deb3fa10bfa9b59",
  "417eab7795d7b3207a6fc17d7fac62defc90ca6efe87c1eba972a4c0477091cf",
  "4f6d88ed0b01fe3524b22bbafcf3478362f038e6da90952d762a3de4e6b5ae0b",
  "50a6da152669ac8b6d7aecef919d5e9a143a955ae6149af6b724c14f448eb51b",
  "56b4540828aac8464d38647716ffc19f5eebfa390cb4289ad34bac423ae3c671",
  "64104ac1f930c2036e86cc3a89c94b559e117a74673dbd318e750dd0507067ce",
  "66b90bf4d1926b6007427147623c05801ea99f7a0a362a72f09f1a7e4b125a9e",
  "6add432191a1e5c4b3a0207d0309407be45677a07715f39ab5f1f02079f514c2",
  "6c58002f42ec60e63d502eab2d897a289737bde55e4b6a7374cc6e6e1b5f2ea1",
  "76ceccbe4743714f6161153e255fb0363b36de7c5367c46b11703d3fa596f376",
  "773a09856fdb88f84943d55ad1476b5fa6c69afbce772af4b11396ffbb25c5ea",
  "8522addfde7aa47938b9373eb33dd557d96c83c3194eacd7049f54a83e259d76",
  "8c14206d36deeb992441b2e86c0e398f1b5a942373554109e4ecae7f3e288ec6",
  "ac2e1f9e994c57e274a53465cb6022344c7aff8536cc610087a1f8fdfa6c8d33",
  "b39fd11ca4cb014e26291d7e366c1ba958c51363c98c2b008d82e884208923c3",
  "b5edc5469203520b3fd66b99ca85722b5d99b381b76d6dfe777002bf562b89b9",
  "b96c5817a174b2dab78bfae424d95ad1de4ff139237ef54a7a18f0603211a0e1",
  "bac5489d4fd74e0811a646e6171ff3e0f7da21bbceb6021907abed156feddc45",
  "cd170e0022c4c9713dd0e02d0aa08f889fc2b382395bef4d962a967ad2e525a9",
  "cfba73a7ca04c07058b535012dae5c2af1b3c9d1207bf39e31e4cf47a8a44dc6",
  "d875670a44b1fedeac0c5b623ebbba7e0d1dc3c9e71889070a54a0188e962892",
  "d8a957f792f73f3f2c22b8582b731783d3f17065bfc26ad1b86f18cf64bc58b1",
  "dea20fd2846e69bfb09ea873ce06eaac58b7771b225e111cde387cddd6f0379e",
  "e2794beab34b2cf6613c63017a2ee261b098567c076117995c946941736b78b1",
  "e818cc7ce9398fc5d135243f07118c595ace15d14a05e5923cf7395f9c843cab",
  "ee0fcdf0573e056608976c5c723a6337aae0882b39626c43313649a977ffb09f",
  "efdcf1ceca351401c4a0b924f632eb63999f0be7231f96c41b230d0cf4aefba5",
  "f2765b69f268f5f00f01cb338b0ca483ae7509ae3ac2650734f0168a28f50bbd",
  "f559093246e818a7201b8eef2d2643301d1c8aa638a4418e4a775ba992457d60",
  "f95fb4acc743d6d9da22754a32f955fc86661360a1b4e165059c9ee3627fb9a7",
  "fe28834070422262619301c910c158d893c5d82bed50d7234757d585ca83123e",
] as const;

let schemaPromise: Promise<void> | null = null;

export function hashVipIdentity(email: string): string {
  return createHash("sha256")
    .update(`${VIP_IDENTITY_HASH_SALT}${email.trim().toLowerCase()}`, "utf8")
    .digest("hex");
}

async function performSchemaUpgrade(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_vip_eligibilities (
      ticketId VARCHAR(20) NOT NULL PRIMARY KEY,
      identityHash CHAR(64) NOT NULL,
      sourceBatch VARCHAR(80) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      createdByAdminId INT NULL,
      updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      updatedByAdminId INT NULL,
      KEY idx_lcf_vip_identity (identityHash, active),
      KEY idx_lcf_vip_active (active, updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_vip_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      requestId VARCHAR(80) NOT NULL,
      action ENUM('batch_apply', 'manual_enable', 'manual_disable') NOT NULL,
      ticketId VARCHAR(20) NULL,
      sourceBatch VARCHAR(80) NOT NULL,
      actorAdminId INT NULL,
      affectedCount INT NOT NULL DEFAULT 0,
      detailHash CHAR(64) NOT NULL,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uk_lcf_vip_audit_request (requestId),
      KEY idx_lcf_vip_audit_created (createdAt),
      KEY idx_lcf_vip_audit_ticket (ticketId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function ensureFestivalVipSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = performSchemaUpgrade(pool).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function isTicketVipEligible(connection: PoolConnection, ticketId: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT active FROM lcf_vip_eligibilities WHERE ticketId = ? LIMIT 1`,
    [ticketId],
  );
  return Number(rows[0]?.active || 0) === 1;
}

export async function getVipBatchPreview(pool: Pool) {
  await ensureFestivalVipSchema(pool);
  const placeholders = VIP_TARGET_IDENTITY_HASHES.map(() => "?").join(", ");
  const [targetRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS ticketCount,
            COUNT(DISTINCT SHA2(CONCAT(?, LOWER(TRIM(ticket.applicantEmail))), 256)) AS identityCount
       FROM lcf_tickets ticket
      WHERE SHA2(CONCAT(?, LOWER(TRIM(ticket.applicantEmail))), 256) IN (${placeholders})`,
    [VIP_IDENTITY_HASH_SALT, VIP_IDENTITY_HASH_SALT, ...VIP_TARGET_IDENTITY_HASHES],
  );
  const [eligibilityRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS activeTicketCount,
            COUNT(DISTINCT identityHash) AS activeIdentityCount
       FROM lcf_vip_eligibilities
      WHERE active = 1`,
  );
  return {
    batchKey: VIP_BATCH_KEY,
    expectedIdentityCount: VIP_TARGET_IDENTITY_COUNT,
    ticketCountAtAudit: VIP_TARGET_TICKET_COUNT_AT_AUDIT,
    matchedIdentityCount: Number(targetRows[0]?.identityCount || 0),
    matchedTicketCount: Number(targetRows[0]?.ticketCount || 0),
    activeIdentityCount: Number(eligibilityRows[0]?.activeIdentityCount || 0),
    activeTicketCount: Number(eligibilityRows[0]?.activeTicketCount || 0),
    manifestSha256: VIP_TARGET_MANIFEST_SHA256,
  };
}

async function runTransaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

export async function applyVipBatch(
  pool: Pool,
  input: { requestId: string; confirmation: string; actorAdminId: number | null },
) {
  if (input.confirmation !== VIP_BATCH_CONFIRMATION) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "確認文字が一致しません" });
  }
  await ensureFestivalVipSchema(pool);
  const placeholders = VIP_TARGET_IDENTITY_HASHES.map(() => "?").join(", ");
  return runTransaction(pool, async (connection) => {
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT affectedCount FROM lcf_vip_audit_logs WHERE requestId = ? LIMIT 1 FOR UPDATE`,
      [input.requestId],
    );
    if (existingRows[0]) {
      return { success: true as const, idempotent: true, affectedTicketCount: Number(existingRows[0].affectedCount || 0) };
    }

    const [ticketRows] = await connection.query<RowDataPacket[]>(
      `SELECT ticket.ticketId,
              SHA2(CONCAT(?, LOWER(TRIM(ticket.applicantEmail))), 256) AS identityHash
         FROM lcf_tickets ticket
        WHERE SHA2(CONCAT(?, LOWER(TRIM(ticket.applicantEmail))), 256) IN (${placeholders})
        ORDER BY ticket.ticketId ASC
        FOR UPDATE`,
      [VIP_IDENTITY_HASH_SALT, VIP_IDENTITY_HASH_SALT, ...VIP_TARGET_IDENTITY_HASHES],
    );
    const identityCount = new Set(ticketRows.map((row) => String(row.identityHash))).size;
    if (identityCount !== VIP_TARGET_IDENTITY_COUNT) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `VIP対象者の照合件数が一致しません（${identityCount}/${VIP_TARGET_IDENTITY_COUNT}）`,
      });
    }

    for (const ticket of ticketRows) {
      await connection.query(
        `INSERT INTO lcf_vip_eligibilities
          (ticketId, identityHash, sourceBatch, active, createdByAdminId, updatedByAdminId)
         VALUES (?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           identityHash = VALUES(identityHash),
           sourceBatch = VALUES(sourceBatch),
           active = 1,
           updatedByAdminId = VALUES(updatedByAdminId)`,
        [ticket.ticketId, ticket.identityHash, VIP_BATCH_KEY, input.actorAdminId, input.actorAdminId],
      );
    }
    const detailHash = createHash("sha256")
      .update(ticketRows.map((row) => String(row.ticketId)).sort().join("\n"), "utf8")
      .digest("hex");
    await connection.query(
      `INSERT INTO lcf_vip_audit_logs
        (requestId, action, sourceBatch, actorAdminId, affectedCount, detailHash)
       VALUES (?, 'batch_apply', ?, ?, ?, ?)`,
      [input.requestId, VIP_BATCH_KEY, input.actorAdminId, ticketRows.length, detailHash],
    );
    return { success: true as const, idempotent: false, affectedTicketCount: ticketRows.length };
  });
}

export async function setTicketVipEligibility(
  pool: Pool,
  input: { ticketId: string; eligible: boolean; requestId: string; actorAdminId: number | null },
) {
  await ensureFestivalVipSchema(pool);
  return runTransaction(pool, async (connection) => {
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT affectedCount FROM lcf_vip_audit_logs WHERE requestId = ? LIMIT 1 FOR UPDATE`,
      [input.requestId],
    );
    if (existingRows[0]) return { success: true as const, idempotent: true, eligible: input.eligible };

    const [ticketRows] = await connection.query<RowDataPacket[]>(
      `SELECT ticketId, LOWER(TRIM(applicantEmail)) AS applicantEmail
         FROM lcf_tickets WHERE ticketId = ? LIMIT 1 FOR UPDATE`,
      [input.ticketId],
    );
    const ticket = ticketRows[0];
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "チケットが見つかりません" });
    const identityHash = hashVipIdentity(String(ticket.applicantEmail));
    await connection.query(
      `INSERT INTO lcf_vip_eligibilities
        (ticketId, identityHash, sourceBatch, active, createdByAdminId, updatedByAdminId)
       VALUES (?, ?, 'manual', ?, ?, ?)
       ON DUPLICATE KEY UPDATE active = VALUES(active), sourceBatch = 'manual', updatedByAdminId = VALUES(updatedByAdminId)`,
      [input.ticketId, identityHash, input.eligible ? 1 : 0, input.actorAdminId, input.actorAdminId],
    );
    const detailHash = createHash("sha256")
      .update(`${input.ticketId}:${input.eligible ? "enable" : "disable"}`, "utf8")
      .digest("hex");
    await connection.query(
      `INSERT INTO lcf_vip_audit_logs
        (requestId, action, ticketId, sourceBatch, actorAdminId, affectedCount, detailHash)
       VALUES (?, ?, ?, 'manual', ?, 1, ?)`,
      [input.requestId, input.eligible ? "manual_enable" : "manual_disable", input.ticketId, input.actorAdminId, detailHash],
    );
    return { success: true as const, idempotent: false, eligible: input.eligible };
  });
}
