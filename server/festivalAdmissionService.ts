import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export const FESTIVAL_ADMISSION_WARNING_THRESHOLD = 10;

export type FestivalAdmissionSource =
  | "ticket_qr"
  | "ticket_manual"
  | "ticket_list"
  | "legacy_qr";

export type FestivalAdmissionActor = {
  adminId: number | null;
  deviceId?: string | null;
};

type ApplicationType = "company" | "liver" | "general";

const APPLICATION_TABLES: Record<ApplicationType, string> = {
  company: "festival_company_applications",
  liver: "festival_liver_applications",
  general: "festival_general_applications",
};

let schemaPromise: Promise<void> | null = null;

async function columnExists(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 AS present
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function indexExists(pool: Pool, tableName: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 AS present
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
      LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function ensureColumn(pool: Pool, tableName: string, columnName: string, definition: string): Promise<void> {
  if (await columnExists(pool, tableName, columnName)) return;
  try {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  }
}

async function ensureIndex(pool: Pool, tableName: string, indexName: string, columns: string): Promise<void> {
  if (await indexExists(pool, tableName, indexName)) return;
  try {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columns})`);
  } catch (error: any) {
    if (error?.code !== "ER_DUP_KEYNAME") throw error;
  }
}

async function backfillLegacyAdmissions(pool: Pool): Promise<void> {
  await pool.query(`
    INSERT IGNORE INTO lcf_admission_events
      (ticketId, requestId, sequenceNumber, source, actorAdminId, deviceId, createdAt)
    SELECT ticketId,
           CONCAT('legacy-ticket:', ticketId),
           1,
           'legacy_backfill',
           NULL,
           'legacy-data',
           COALESCE(checkedInAt, createdAt, CURRENT_TIMESTAMP(3))
      FROM lcf_tickets
     WHERE checkedIn = 1 OR checkedInAt IS NOT NULL
  `);

  for (const [applicationType, tableName] of Object.entries(APPLICATION_TABLES)) {
    await pool.query(`
      INSERT IGNORE INTO lcf_admission_events
        (ticketId, requestId, sequenceNumber, source, actorAdminId, deviceId, createdAt)
      SELECT ticket.ticketId,
             CONCAT('legacy-application:${applicationType}:', application.id),
             1,
             'legacy_backfill',
             NULL,
             'legacy-data',
             application.checked_in_at
        FROM \`${tableName}\` application
        JOIN lcf_tickets ticket
          ON ticket.applicationId = application.id
         AND ticket.applicantType = '${applicationType}'
        LEFT JOIN lcf_admission_events event ON event.ticketId = ticket.ticketId
       WHERE application.checked_in_at IS NOT NULL
         AND event.id IS NULL
    `);
  }

  await pool.query(`
    UPDATE lcf_tickets ticket
    LEFT JOIN (
      SELECT ticketId,
             COUNT(*) AS activeCount,
             MIN(createdAt) AS firstAt,
             MAX(createdAt) AS lastAt
        FROM lcf_admission_events
       WHERE reversedAt IS NULL
       GROUP BY ticketId
    ) summary ON summary.ticketId = ticket.ticketId
       SET ticket.admissionCount = COALESCE(summary.activeCount, 0),
           ticket.firstCheckedInAt = summary.firstAt,
           ticket.lastCheckedInAt = summary.lastAt,
           ticket.checkedIn = IF(COALESCE(summary.activeCount, 0) > 0, 1, 0),
           ticket.checkedInAt = summary.firstAt,
           ticket.checkedInBy = IF(COALESCE(summary.activeCount, 0) > 0, ticket.checkedInBy, NULL)
  `);
}

async function performSchemaUpgrade(pool: Pool): Promise<void> {
  for (const tableName of Object.values(APPLICATION_TABLES)) {
    await ensureColumn(pool, tableName, "checkin_token", "VARCHAR(32) NULL");
    await ensureColumn(pool, tableName, "checked_in_at", "TIMESTAMP NULL");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticketId VARCHAR(20) NOT NULL UNIQUE,
      applicationId INT NOT NULL,
      applicantName VARCHAR(255) NOT NULL,
      applicantEmail VARCHAR(255) NOT NULL,
      applicantType ENUM('liver', 'company', 'general') NOT NULL,
      checkedIn TINYINT(1) NOT NULL DEFAULT 0,
      checkedInAt TIMESTAMP NULL,
      checkedInBy VARCHAR(255) NULL,
      admissionCount INT NOT NULL DEFAULT 0,
      firstCheckedInAt TIMESTAMP(3) NULL,
      lastCheckedInAt TIMESTAMP(3) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn(pool, "lcf_tickets", "admissionCount", "INT NOT NULL DEFAULT 0 AFTER checkedInBy");
  await ensureColumn(pool, "lcf_tickets", "firstCheckedInAt", "TIMESTAMP(3) NULL AFTER admissionCount");
  await ensureColumn(pool, "lcf_tickets", "lastCheckedInAt", "TIMESTAMP(3) NULL AFTER firstCheckedInAt");
  await ensureIndex(pool, "lcf_tickets", "idx_lcf_ticket_admission_count", "admissionCount");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_ticket_aliases (
      aliasTicketId VARCHAR(32) NOT NULL PRIMARY KEY,
      canonicalTicketId VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lcf_ticket_alias_canonical (canonicalTicketId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_admission_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      ticketId VARCHAR(20) NOT NULL,
      requestId VARCHAR(80) NOT NULL,
      sequenceNumber INT NOT NULL,
      source ENUM('ticket_qr', 'ticket_manual', 'ticket_list', 'legacy_qr', 'legacy_backfill') NOT NULL,
      actorAdminId INT NULL,
      deviceId VARCHAR(80) NULL,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      reversedAt TIMESTAMP(3) NULL,
      reversedByAdminId INT NULL,
      reversedDeviceId VARCHAR(80) NULL,
      reversalRequestId VARCHAR(80) NULL,
      reversalReason VARCHAR(200) NULL,
      UNIQUE KEY uk_lcf_admission_request (requestId),
      UNIQUE KEY uk_lcf_admission_ticket_sequence (ticketId, sequenceNumber),
      UNIQUE KEY uk_lcf_admission_reversal_request (reversalRequestId),
      KEY idx_lcf_admission_ticket_active (ticketId, reversedAt, createdAt),
      KEY idx_lcf_admission_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn(pool, "lcf_admission_events", "reversedDeviceId", "VARCHAR(80) NULL AFTER reversedByAdminId");

  await backfillLegacyAdmissions(pool);
}

export async function ensureFestivalAdmissionSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = performSchemaUpgrade(pool).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function assertApplicationType(value: unknown): asserts value is ApplicationType {
  if (value !== "company" && value !== "liver" && value !== "general") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "参加区分が正しくありません" });
  }
}

function admissionWarning(admissionCount: number): boolean {
  return admissionCount >= FESTIVAL_ADMISSION_WARNING_THRESHOLD;
}

async function getTicketSummary(connection: PoolConnection, ticketId: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, ticketId, applicationId, applicantName, applicantType,
            checkedIn, checkedInAt, admissionCount, firstCheckedInAt, lastCheckedInAt
       FROM lcf_tickets
      WHERE ticketId = ?
      LIMIT 1`,
    [ticketId],
  );
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "チケットが見つかりません" });
  return rows[0];
}

async function updateApplicationFirstCheckin(
  connection: PoolConnection,
  applicationType: ApplicationType,
  applicationId: number,
  firstCheckedInAt: Date | string | null,
): Promise<void> {
  const tableName = APPLICATION_TABLES[applicationType];
  await connection.query(
    `UPDATE \`${tableName}\` SET checked_in_at = ? WHERE id = ?`,
    [firstCheckedInAt, applicationId],
  );
}

async function recordForLockedTicket(
  connection: PoolConnection,
  ticket: RowDataPacket,
  input: {
    requestId: string;
    source: FestivalAdmissionSource;
    actor: FestivalAdmissionActor;
  },
) {
  const [existingRows] = await connection.query<RowDataPacket[]>(
    `SELECT ticketId FROM lcf_admission_events WHERE requestId = ? LIMIT 1`,
    [input.requestId],
  );
  if (existingRows[0]) {
    if (existingRows[0].ticketId !== ticket.ticketId) {
      throw new TRPCError({ code: "CONFLICT", message: "受付リクエストが競合しました。再度お試しください。" });
    }
    const summary = await getTicketSummary(connection, ticket.ticketId);
    return {
      success: true as const,
      idempotent: true,
      admissionCount: Number(summary.admissionCount || 0),
      warning: admissionWarning(Number(summary.admissionCount || 0)),
      ticket: summary,
    };
  }

  const [aggregateRows] = await connection.query<RowDataPacket[]>(
    `SELECT SUM(CASE WHEN reversedAt IS NULL THEN 1 ELSE 0 END) AS activeCount,
            COALESCE(MAX(sequenceNumber), 0) AS maxSequence,
            MIN(CASE WHEN reversedAt IS NULL THEN createdAt ELSE NULL END) AS firstAt
       FROM lcf_admission_events
      WHERE ticketId = ?`,
    [ticket.ticketId],
  );
  const activeCount = Number(aggregateRows[0]?.activeCount || 0);
  const sequenceNumber = Number(aggregateRows[0]?.maxSequence || 0) + 1;

  await connection.query(
    `INSERT INTO lcf_admission_events
      (ticketId, requestId, sequenceNumber, source, actorAdminId, deviceId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))`,
    [
      ticket.ticketId,
      input.requestId,
      sequenceNumber,
      input.source,
      input.actor.adminId,
      input.actor.deviceId || null,
    ],
  );

  const [eventRows] = await connection.query<RowDataPacket[]>(
    `SELECT createdAt FROM lcf_admission_events WHERE requestId = ? LIMIT 1`,
    [input.requestId],
  );
  const eventCreatedAt = eventRows[0]?.createdAt || new Date();
  const firstCheckedInAt = aggregateRows[0]?.firstAt || eventCreatedAt;
  const admissionCount = activeCount + 1;

  await connection.query(
    `UPDATE lcf_tickets
        SET checkedIn = 1,
            checkedInAt = ?,
            checkedInBy = COALESCE(checkedInBy, ?),
            admissionCount = ?,
            firstCheckedInAt = ?,
            lastCheckedInAt = ?
      WHERE ticketId = ?`,
    [
      firstCheckedInAt,
      input.actor.adminId == null ? null : `admin:${input.actor.adminId}`,
      admissionCount,
      firstCheckedInAt,
      eventCreatedAt,
      ticket.ticketId,
    ],
  );

  assertApplicationType(ticket.applicantType);
  await updateApplicationFirstCheckin(connection, ticket.applicantType, Number(ticket.applicationId), firstCheckedInAt);
  const summary = await getTicketSummary(connection, ticket.ticketId);
  return {
    success: true as const,
    idempotent: false,
    admissionCount,
    warning: admissionWarning(admissionCount),
    ticket: summary,
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

export async function recordTicketAdmission(
  pool: Pool,
  input: {
    scannedTicketId: string;
    requestId: string;
    source: FestivalAdmissionSource;
    actor: FestivalAdmissionActor;
  },
) {
  await ensureFestivalAdmissionSchema(pool);
  return runTransaction(pool, async (connection) => {
    let [rows] = await connection.query<RowDataPacket[]>(
      `SELECT ticket.*, 0 AS aliasUsed
         FROM lcf_tickets ticket
        WHERE ticket.ticketId = ?
        LIMIT 1 FOR UPDATE`,
      [input.scannedTicketId],
    );
    if (!rows[0]) {
      [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ticket.*, 1 AS aliasUsed
           FROM lcf_ticket_aliases alias
           JOIN lcf_tickets ticket ON ticket.ticketId = alias.canonicalTicketId
          WHERE alias.aliasTicketId = ?
          LIMIT 1 FOR UPDATE`,
        [input.scannedTicketId],
      );
    }
    const ticket = rows[0];
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "チケットが見つかりません" });
    const result = await recordForLockedTicket(connection, ticket, input);
    return { ...result, aliasUsed: ticket.aliasUsed === 1 };
  });
}

export async function recordLegacyApplicationAdmission(
  pool: Pool,
  input: {
    applicationType: ApplicationType;
    applicationId: number;
    token: string;
    requestId: string;
    actor: FestivalAdmissionActor;
  },
) {
  await ensureFestivalAdmissionSchema(pool);
  return runTransaction(pool, async (connection) => {
    const tableName = APPLICATION_TABLES[input.applicationType];
    const nameColumn = input.applicationType === "company"
      ? "company_name"
      : input.applicationType === "liver"
        ? "COALESCE(liver_name, name)"
        : "name";
    const [applicationRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, ${nameColumn} AS applicantName, email,
              checkin_token AS checkinToken, checked_in_at AS checkedInAt
         FROM \`${tableName}\`
        WHERE id = ?
        LIMIT 1 FOR UPDATE`,
      [input.applicationId],
    );
    const application = applicationRows[0];
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "申込みが見つかりません" });
    if (application.checkinToken !== input.token) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "トークンが一致しません" });
    }

    let [ticketRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM lcf_tickets
        WHERE applicationId = ? AND applicantType = ?
        ORDER BY id ASC LIMIT 1 FOR UPDATE`,
      [input.applicationId, input.applicationType],
    );
    if (!ticketRows[0]) {
      for (let attempt = 0; attempt < 5 && !ticketRows[0]; attempt += 1) {
        const ticketId = `LCF-${nanoid(8).toUpperCase()}`;
        try {
          await connection.query(
            `INSERT INTO lcf_tickets
              (ticketId, applicationId, applicantName, applicantEmail, applicantType)
             VALUES (?, ?, ?, ?, ?)`,
            [ticketId, input.applicationId, application.applicantName, String(application.email).toLowerCase(), input.applicationType],
          );
          [ticketRows] = await connection.query<RowDataPacket[]>(
            `SELECT * FROM lcf_tickets WHERE ticketId = ? LIMIT 1 FOR UPDATE`,
            [ticketId],
          );
        } catch (error: any) {
          if (error?.code !== "ER_DUP_ENTRY") throw error;
        }
      }
    }
    const ticket = ticketRows[0];
    if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "チケットを準備できませんでした" });
    if (application.checkedInAt) {
      await connection.query(
        `INSERT IGNORE INTO lcf_admission_events
          (ticketId, requestId, sequenceNumber, source, actorAdminId, deviceId, createdAt)
         SELECT ?, ?, 1, 'legacy_backfill', NULL, 'legacy-data', ?
          WHERE NOT EXISTS (
            SELECT 1 FROM lcf_admission_events WHERE ticketId = ?
          )`,
        [
          ticket.ticketId,
          `legacy-application:${input.applicationType}:${input.applicationId}`,
          application.checkedInAt,
          ticket.ticketId,
        ],
      );
      await connection.query(
        `UPDATE lcf_tickets
            SET checkedIn = 1,
                checkedInAt = ?,
                admissionCount = GREATEST(admissionCount, 1),
                firstCheckedInAt = COALESCE(firstCheckedInAt, ?),
                lastCheckedInAt = COALESCE(lastCheckedInAt, ?)
          WHERE ticketId = ?`,
        [application.checkedInAt, application.checkedInAt, application.checkedInAt, ticket.ticketId],
      );
    }
    const result = await recordForLockedTicket(connection, ticket, {
      requestId: input.requestId,
      source: "legacy_qr",
      actor: input.actor,
    });
    return {
      ...result,
      name: application.applicantName,
      type: input.applicationType,
      alreadyCheckedIn: false,
    };
  });
}

export async function undoLatestTicketAdmission(
  pool: Pool,
  input: {
    ticketId: string;
    requestId: string;
    actor: FestivalAdmissionActor;
    reason: string;
  },
) {
  await ensureFestivalAdmissionSchema(pool);
  return runTransaction(pool, async (connection) => {
    const [ticketRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM lcf_tickets WHERE ticketId = ? LIMIT 1 FOR UPDATE`,
      [input.ticketId],
    );
    const ticket = ticketRows[0];
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "チケットが見つかりません" });

    const [existingUndoRows] = await connection.query<RowDataPacket[]>(
      `SELECT ticketId FROM lcf_admission_events WHERE reversalRequestId = ? LIMIT 1`,
      [input.requestId],
    );
    if (existingUndoRows[0]) {
      if (existingUndoRows[0].ticketId !== ticket.ticketId) {
        throw new TRPCError({ code: "CONFLICT", message: "取消リクエストが競合しました。再度お試しください。" });
      }
      const summary = await getTicketSummary(connection, ticket.ticketId);
      return {
        success: true as const,
        idempotent: true,
        admissionCount: Number(summary.admissionCount || 0),
        ticket: summary,
      };
    }

    const [eventRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, sequenceNumber
         FROM lcf_admission_events
        WHERE ticketId = ? AND reversedAt IS NULL
        ORDER BY sequenceNumber DESC
        LIMIT 1 FOR UPDATE`,
      [ticket.ticketId],
    );
    const event = eventRows[0];
    if (!event) throw new TRPCError({ code: "BAD_REQUEST", message: "取消できる受付履歴がありません" });

    await connection.query(
      `UPDATE lcf_admission_events
          SET reversedAt = CURRENT_TIMESTAMP(3),
              reversedByAdminId = ?,
              reversedDeviceId = ?,
              reversalRequestId = ?,
              reversalReason = ?
        WHERE id = ? AND reversedAt IS NULL`,
      [input.actor.adminId, input.actor.deviceId || null, input.requestId, input.reason, event.id],
    );

    const [summaryRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS activeCount,
              MIN(createdAt) AS firstAt,
              MAX(createdAt) AS lastAt
         FROM lcf_admission_events
        WHERE ticketId = ? AND reversedAt IS NULL`,
      [ticket.ticketId],
    );
    const admissionCount = Number(summaryRows[0]?.activeCount || 0);
    const firstCheckedInAt = summaryRows[0]?.firstAt || null;
    const lastCheckedInAt = summaryRows[0]?.lastAt || null;
    await connection.query(
      `UPDATE lcf_tickets
          SET checkedIn = ?,
              checkedInAt = ?,
              checkedInBy = IF(? > 0, checkedInBy, NULL),
              admissionCount = ?,
              firstCheckedInAt = ?,
              lastCheckedInAt = ?
        WHERE ticketId = ?`,
      [
        admissionCount > 0 ? 1 : 0,
        firstCheckedInAt,
        admissionCount,
        admissionCount,
        firstCheckedInAt,
        lastCheckedInAt,
        ticket.ticketId,
      ],
    );
    assertApplicationType(ticket.applicantType);
    await updateApplicationFirstCheckin(connection, ticket.applicantType, Number(ticket.applicationId), firstCheckedInAt);
    const summary = await getTicketSummary(connection, ticket.ticketId);
    return {
      success: true as const,
      idempotent: false,
      undoneSequenceNumber: Number(event.sequenceNumber),
      admissionCount,
      ticket: summary,
    };
  });
}
