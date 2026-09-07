import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export const AFTER_PARTY_BATCH_KEY = "after-party-2026-groups-1-2-v1";
export const AFTER_PARTY_BATCH_CONFIRMATION = "AFTER-PARTY-34";
export const AFTER_PARTY_TARGET_IDENTITY_COUNT = 34;
export const AFTER_PARTY_IDENTITY_HASH_SALT = "lcf-after-party-2026:v1:";
export const AFTER_PARTY_TARGET_MANIFEST_SHA256 = "c0d3cbdf6c58dc52ddad97fdf9db543f2ccf312c86f9031f1200a3972875947c";

// Private-repository manifest: salted hashes only. No name, email, ticket ID or QR value is stored in source.
export const AFTER_PARTY_TARGET_IDENTITY_HASHES = [
  "06b22bb16901c6a0e68f4e7f74e641427b4683c09054c204bef36406905c3f10",
  "17f184602a5391a90b2508d6231d02c39572eb118a793dc991e670c75f9be874",
  "20d510a93ff6d03d958684f36f04a043d645eee91e3fabe8f883b71945b3f728",
  "20e6601588f2352526b03b185339213c9722e18a4a923e9d43cb68c53252ad68",
  "2fec218b12b84cbdcbe0f066212e89785e965bc571b85a760ed4b1468b1c7c10",
  "3080379a782323ed9e5e5c6149aaf07c4eaa1588df4402eb8d7f5f507adfbc7f",
  "390eb293a5842293c9a1484f667706d64bd06024753bdf57216bba4e49775c49",
  "411870a473adba38ee51b7ae2f283fb4f293621223e5365fa4be9b84be6ede05",
  "4b155de5ec0690c8556b0afe3795ac8e74114f9dee9a45aa6d04d74f5af26adc",
  "511f0e4cea4a24609b03e0f46e531523859d5dbb3480f6bcd9296e5ad026616f",
  "52246db01546075b5515265b0cca31e9e4f4395151abddc69d28b97ab296a2d3",
  "56f678949a7580e7cd05d9221092e837c4e02cb1dec117702e2f0bae414a4255",
  "650d432ec9f2359c2901548bb90c37d988aa193bba74c834b1c17584b2b67ce3",
  "6563091a4cf58e1008bdac51d049637c327386e1535eabd9b3b9a09cdaef55d7",
  "69c2867337dbe6719b3a98a1e96ad574650bee71d9b12ff865a817bba5f6ff82",
  "6eb4ce46d8168348eb99334cd2cd4a6268e48866153fe2292b2750be10f6ca6e",
  "7725b997fc1a5c8954c17da6bcabf7e3afca15ede69c0eff0549856d0fef2f07",
  "7f67b7ef22be76c74c51716075ba8f4341ab12280210eadf51d1b160cf785c71",
  "805188e6ff112fa869e4bbf281974aa1d47804e6c06897653afa56d328df5ec2",
  "87e767b4838e4ae8ece4731f6f8691b2ad9fbd3f5b43d7656b8c8c14d119bd4a",
  "95db2599568888205a8032e4e5bb6f0ed37756282ff932e3b40a00b5ede2f9ec",
  "a95bc7bcbbf886ff57b9092d153ca525b3543be9f56f290ba03fa6e280bc7bb3",
  "adbc61100217f989240eefced07e1b02aa4d08bbe93177915df7ff5df04a75a4",
  "bdf9c89cce2f8f7ee8c04b69b1c3f3eb37ef9aa58540668754b840d6f7d87c45",
  "c6e48d53497349eeb607eadb77d4a442505f0f509b348c08fe4cf79442178b40",
  "d38458bd508f1d8265ec3dace5d9d617b6f42429e26517626e4621a4fc8b4857",
  "dc8c7afb2e940d3d7dadc3247626ed06606593e6faac1a1b70693c2a72ebdb7d",
  "e1c7a6598434ec8acf98493f9150544b9c403018ccdbd27d417621b6600b8c7d",
  "e48581ee630c849f62b38b699c5d55597190e240cb966529d930c61ffbdf9217",
  "e8036025c4892916da756c551073f9da335c1914d3f8499a995d04ffb45240bc",
  "ece0e87ba9c9865a02eb14d298edafa8a24f2517af129dd71f06d77661a24a11",
  "f22c306074ad26307776574fed1a202bd55dd7e2bd4c28385dafe19a19ec0ca0",
  "f747fa934538d2621104093885bd7b988fe0b5f3f189b4189243af77dae6183f",
  "fc9845e88d9869faf1eb093edfcd16c90d9eec7fa9b00e7661c0bda3071e0912",
] as const;

let schemaPromise: Promise<void> | null = null;

export function hashAfterPartyIdentity(email: string): string {
  return createHash("sha256")
    .update(`${AFTER_PARTY_IDENTITY_HASH_SALT}${email.trim().toLowerCase()}`, "utf8")
    .digest("hex");
}

async function performSchemaUpgrade(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_after_party_eligibilities (
      ticketId VARCHAR(20) NOT NULL PRIMARY KEY,
      identityHash CHAR(64) NOT NULL,
      sourceBatch VARCHAR(80) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      createdByAdminId INT NULL,
      updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      updatedByAdminId INT NULL,
      KEY idx_lcf_after_party_identity (identityHash, active),
      KEY idx_lcf_after_party_active (active, updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_after_party_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      requestId VARCHAR(80) NOT NULL,
      action ENUM('batch_apply', 'manual_enable', 'manual_disable') NOT NULL,
      ticketId VARCHAR(20) NULL,
      sourceBatch VARCHAR(80) NOT NULL,
      actorAdminId INT NULL,
      affectedCount INT NOT NULL DEFAULT 0,
      detailHash CHAR(64) NOT NULL,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uk_lcf_after_party_audit_request (requestId),
      KEY idx_lcf_after_party_audit_created (createdAt),
      KEY idx_lcf_after_party_audit_ticket (ticketId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function ensureFestivalAfterPartySchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = performSchemaUpgrade(pool).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function isTicketAfterPartyEligible(connection: PoolConnection, ticketId: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT active FROM lcf_after_party_eligibilities WHERE ticketId = ? LIMIT 1`,
    [ticketId],
  );
  return Number(rows[0]?.active || 0) === 1;
}

export async function getAfterPartyBatchPreview(pool: Pool) {
  await ensureFestivalAfterPartySchema(pool);
  const placeholders = AFTER_PARTY_TARGET_IDENTITY_HASHES.map(() => "?").join(", ");
  const [targetRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS ticketCount,
            COUNT(DISTINCT SHA2(CONCAT(?, LOWER(TRIM(ticket.applicantEmail))), 256)) AS identityCount
       FROM lcf_tickets ticket
      WHERE SHA2(CONCAT(?, LOWER(TRIM(ticket.applicantEmail))), 256) IN (${placeholders})`,
    [AFTER_PARTY_IDENTITY_HASH_SALT, AFTER_PARTY_IDENTITY_HASH_SALT, ...AFTER_PARTY_TARGET_IDENTITY_HASHES],
  );
  const [eligibilityRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS activeTicketCount,
            COUNT(DISTINCT identityHash) AS activeIdentityCount
       FROM lcf_after_party_eligibilities
      WHERE active = 1`,
  );
  return {
    batchKey: AFTER_PARTY_BATCH_KEY,
    expectedIdentityCount: AFTER_PARTY_TARGET_IDENTITY_COUNT,
    matchedIdentityCount: Number(targetRows[0]?.identityCount || 0),
    matchedTicketCount: Number(targetRows[0]?.ticketCount || 0),
    activeIdentityCount: Number(eligibilityRows[0]?.activeIdentityCount || 0),
    activeTicketCount: Number(eligibilityRows[0]?.activeTicketCount || 0),
    manifestSha256: AFTER_PARTY_TARGET_MANIFEST_SHA256,
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

export async function applyAfterPartyBatch(
  pool: Pool,
  input: { requestId: string; confirmation: string; actorAdminId: number | null },
) {
  if (input.confirmation !== AFTER_PARTY_BATCH_CONFIRMATION) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "確認文字が一致しません" });
  }
  await ensureFestivalAfterPartySchema(pool);
  const placeholders = AFTER_PARTY_TARGET_IDENTITY_HASHES.map(() => "?").join(", ");
  return runTransaction(pool, async (connection) => {
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT affectedCount FROM lcf_after_party_audit_logs WHERE requestId = ? LIMIT 1 FOR UPDATE`,
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
      [AFTER_PARTY_IDENTITY_HASH_SALT, AFTER_PARTY_IDENTITY_HASH_SALT, ...AFTER_PARTY_TARGET_IDENTITY_HASHES],
    );
    const identityCount = new Set(ticketRows.map((row) => String(row.identityHash))).size;
    if (identityCount !== AFTER_PARTY_TARGET_IDENTITY_COUNT) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `対象者の照合件数が一致しません（${identityCount}/${AFTER_PARTY_TARGET_IDENTITY_COUNT}）`,
      });
    }

    for (const ticket of ticketRows) {
      await connection.query(
        `INSERT INTO lcf_after_party_eligibilities
          (ticketId, identityHash, sourceBatch, active, createdByAdminId, updatedByAdminId)
         VALUES (?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           identityHash = VALUES(identityHash),
           sourceBatch = VALUES(sourceBatch),
           active = 1,
           updatedByAdminId = VALUES(updatedByAdminId)`,
        [ticket.ticketId, ticket.identityHash, AFTER_PARTY_BATCH_KEY, input.actorAdminId, input.actorAdminId],
      );
    }
    const detailHash = createHash("sha256")
      .update(ticketRows.map((row) => String(row.ticketId)).sort().join("\n"), "utf8")
      .digest("hex");
    await connection.query(
      `INSERT INTO lcf_after_party_audit_logs
        (requestId, action, sourceBatch, actorAdminId, affectedCount, detailHash)
       VALUES (?, 'batch_apply', ?, ?, ?, ?)`,
      [input.requestId, AFTER_PARTY_BATCH_KEY, input.actorAdminId, ticketRows.length, detailHash],
    );
    return { success: true as const, idempotent: false, affectedTicketCount: ticketRows.length };
  });
}

export async function setTicketAfterPartyEligibility(
  pool: Pool,
  input: { ticketId: string; eligible: boolean; requestId: string; actorAdminId: number | null },
) {
  await ensureFestivalAfterPartySchema(pool);
  return runTransaction(pool, async (connection) => {
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT affectedCount FROM lcf_after_party_audit_logs WHERE requestId = ? LIMIT 1 FOR UPDATE`,
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
    const identityHash = hashAfterPartyIdentity(String(ticket.applicantEmail));
    await connection.query(
      `INSERT INTO lcf_after_party_eligibilities
        (ticketId, identityHash, sourceBatch, active, createdByAdminId, updatedByAdminId)
       VALUES (?, ?, 'manual', ?, ?, ?)
       ON DUPLICATE KEY UPDATE active = VALUES(active), sourceBatch = 'manual', updatedByAdminId = VALUES(updatedByAdminId)`,
      [input.ticketId, identityHash, input.eligible ? 1 : 0, input.actorAdminId, input.actorAdminId],
    );
    const detailHash = createHash("sha256")
      .update(`${input.ticketId}:${input.eligible ? "enable" : "disable"}`, "utf8")
      .digest("hex");
    await connection.query(
      `INSERT INTO lcf_after_party_audit_logs
        (requestId, action, ticketId, sourceBatch, actorAdminId, affectedCount, detailHash)
       VALUES (?, ?, ?, 'manual', ?, 1, ?)`,
      [input.requestId, input.eligible ? "manual_enable" : "manual_disable", input.ticketId, input.actorAdminId, detailHash],
    );
    return { success: true as const, idempotent: false, eligible: input.eligible };
  });
}
