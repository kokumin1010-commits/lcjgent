/**
 * LCF multi-edition mypage mutations.
 * Design: edition ownership is mandatory; cancellations are reversible only by operations,
 * and companions always receive their own ticket instead of sharing the applicant QR.
 */
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ensureFestivalAdmissionSchema } from "./festivalAdmissionService";

export type FestivalApplicantType = "company" | "liver" | "general";
export type FestivalAttendanceSchedule = "day1_only" | "day2_only" | "both_days";

const APPLICATION_TABLES: Record<FestivalApplicantType, string> = {
  company: "festival_company_applications",
  liver: "festival_liver_applications",
  general: "festival_general_applications",
};

let schemaPromise: Promise<void> | null = null;

async function performSchemaUpgrade(pool: Pool): Promise<void> {
  await ensureFestivalAdmissionSchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS festival_application_companions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_year VARCHAR(10) NOT NULL,
      account_id INT NOT NULL,
      applicant_type ENUM('company', 'liver', 'general') NOT NULL,
      application_id INT NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      full_name_kana VARCHAR(255) NOT NULL,
      email VARCHAR(320) NOT NULL,
      status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
      cancelled_at TIMESTAMP NULL,
      cancellation_reason VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_festival_companion_owner (account_id, event_year, status),
      KEY idx_festival_companion_application (applicant_type, application_id, status),
      KEY idx_festival_companion_email (email, event_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function ensureFestivalMypageSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = performSchemaUpgrade(pool).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function applicationTable(applicantType: FestivalApplicantType): string {
  return APPLICATION_TABLES[applicantType];
}

async function lockOwnedApplication(
  connection: PoolConnection,
  input: {
    accountEmail: string;
    applicantType: FestivalApplicantType;
    applicationId: number;
    eventYear: string;
  },
) {
  const table = applicationTable(input.applicantType);
  const scheduleColumn = input.applicantType === "company" ? "NULL" : "attendance_schedule";
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, event_year AS eventYear, status, checked_in_at AS checkedInAt,
            ${scheduleColumn} AS attendanceSchedule
       FROM \`${table}\`
      WHERE id = ? AND event_year = ? AND LOWER(TRIM(email)) = ?
      LIMIT 1 FOR UPDATE`,
    [input.applicationId, input.eventYear, input.accountEmail.trim().toLowerCase()],
  );
  const application = rows[0];
  if (!application) {
    throw new TRPCError({ code: "NOT_FOUND", message: "対象の申込みが見つかりません" });
  }
  return application;
}

async function assertNotCheckedIn(connection: PoolConnection, input: {
  applicantType: FestivalApplicantType;
  applicationId: number;
  eventYear: string;
}) {
  const [ticketRows] = await connection.query<RowDataPacket[]>(
    `SELECT ticketId, admissionCount, isActive
       FROM lcf_tickets
      WHERE applicantType = ? AND applicationId = ? AND eventYear = ?
      FOR UPDATE`,
    [input.applicantType, input.applicationId, input.eventYear],
  );
  if (ticketRows.some((ticket) => Number(ticket.admissionCount || 0) > 0)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "受付済みのため、マイページから変更できません。運営へお問い合わせください。" });
  }
  return ticketRows;
}

async function runTransaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateOwnedAttendanceSchedule(pool: Pool, input: {
  accountEmail: string;
  applicantType: FestivalApplicantType;
  applicationId: number;
  eventYear: string;
  attendanceSchedule: FestivalAttendanceSchedule;
}) {
  await ensureFestivalMypageSchema(pool);
  if (input.applicantType === "company") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "企業・ブランド申込みは両日参加のため、日程変更の対象外です" });
  }
  return runTransaction(pool, async (connection) => {
    const application = await lockOwnedApplication(connection, input);
    if (application.status === "cancelled" || application.status === "rejected") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "無効または取消済みの申込みは変更できません" });
    }
    await assertNotCheckedIn(connection, input);
    const table = applicationTable(input.applicantType);
    await connection.query(
      `UPDATE \`${table}\` SET attendance_schedule = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [input.attendanceSchedule, input.applicationId],
    );
    return { before: application.attendanceSchedule as FestivalAttendanceSchedule, after: input.attendanceSchedule };
  });
}

export async function cancelOwnedApplication(pool: Pool, input: {
  accountEmail: string;
  applicantType: FestivalApplicantType;
  applicationId: number;
  eventYear: string;
  reason: string;
}) {
  await ensureFestivalMypageSchema(pool);
  return runTransaction(pool, async (connection) => {
    const application = await lockOwnedApplication(connection, input);
    if (application.status === "cancelled") {
      return { alreadyCancelled: true, previousStatus: "cancelled" };
    }
    if (application.status === "rejected") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "無効な申込みはマイページから取消できません" });
    }
    await assertNotCheckedIn(connection, input);
    const table = applicationTable(input.applicantType);
    await connection.query(
      `UPDATE \`${table}\` SET status = 'cancelled', notes = CONCAT_WS('\n', NULLIF(notes, ''), ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [`本人取消: ${input.reason}`, input.applicationId],
    );
    await connection.query(
      `UPDATE festival_application_companions
          SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE event_year = ? AND applicant_type = ? AND application_id = ? AND status = 'active'`,
      [`本人申込取消: ${input.reason}`, input.eventYear, input.applicantType, input.applicationId],
    );
    await connection.query(
      `UPDATE lcf_tickets
          SET isActive = 0, invalidatedAt = CURRENT_TIMESTAMP, invalidationReason = ?
        WHERE eventYear = ? AND applicantType = ? AND applicationId = ? AND isActive = 1`,
      [`本人申込取消: ${input.reason}`.slice(0, 200), input.eventYear, input.applicantType, input.applicationId],
    );
    return { alreadyCancelled: false, previousStatus: String(application.status) };
  });
}

export async function listOwnedCompanions(pool: Pool, input: { accountId: number; eventYear?: string }) {
  await ensureFestivalMypageSchema(pool);
  const params: Array<number | string> = [input.accountId];
  const yearClause = input.eventYear ? " AND companion.event_year = ?" : "";
  if (input.eventYear) params.push(input.eventYear);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT companion.id, companion.event_year AS eventYear,
            companion.applicant_type AS applicantType, companion.application_id AS applicationId,
            companion.full_name AS fullName, companion.full_name_kana AS fullNameKana,
            companion.email, companion.status, companion.cancelled_at AS cancelledAt,
            companion.cancellation_reason AS cancellationReason,
            companion.created_at AS createdAt, companion.updated_at AS updatedAt,
            ticket.ticketId, ticket.admissionCount, ticket.firstCheckedInAt, ticket.lastCheckedInAt,
            ticket.isActive AS ticketActive
       FROM festival_application_companions companion
       LEFT JOIN lcf_tickets ticket
         ON ticket.companionId = companion.id AND ticket.holderType = 'companion'
      WHERE companion.account_id = ?${yearClause}
      ORDER BY companion.event_year DESC, companion.id ASC`,
    params,
  );
  return rows;
}

export async function addOwnedCompanion(pool: Pool, input: {
  accountId: number;
  accountEmail: string;
  applicantType: FestivalApplicantType;
  applicationId: number;
  eventYear: string;
  fullName: string;
  fullNameKana: string;
  email: string;
}) {
  await ensureFestivalMypageSchema(pool);
  return runTransaction(pool, async (connection) => {
    const application = await lockOwnedApplication(connection, input);
    if (application.status === "cancelled" || application.status === "rejected") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "無効または取消済みの申込みへ同行者を追加できません" });
    }
    await assertNotCheckedIn(connection, input);
    const [countRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
         FROM festival_application_companions
        WHERE event_year = ? AND applicant_type = ? AND application_id = ? AND status = 'active'
        FOR UPDATE`,
      [input.eventYear, input.applicantType, input.applicationId],
    );
    if (Number(countRows[0]?.count || 0) >= 10) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "同行者は1申込みにつき10名まで登録できます" });
    }
    const normalizedEmail = input.email.trim().toLowerCase();
    const [duplicateRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM festival_application_companions
        WHERE event_year = ? AND applicant_type = ? AND application_id = ?
          AND LOWER(TRIM(email)) = ? AND status = 'active'
        LIMIT 1 FOR UPDATE`,
      [input.eventYear, input.applicantType, input.applicationId, normalizedEmail],
    );
    if (duplicateRows[0]) {
      throw new TRPCError({ code: "CONFLICT", message: "同じメールアドレスの同行者が既に登録されています" });
    }
    const [insertResult] = await connection.query<any>(
      `INSERT INTO festival_application_companions
        (event_year, account_id, applicant_type, application_id, full_name, full_name_kana, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [input.eventYear, input.accountId, input.applicantType, input.applicationId, input.fullName, input.fullNameKana, normalizedEmail],
    );
    const companionId = Number(insertResult.insertId);
    let ticketId = "";
    for (let attempt = 0; attempt < 5 && !ticketId; attempt += 1) {
      const candidate = `LCF-${nanoid(8).toUpperCase()}`;
      try {
        await connection.query(
          `INSERT INTO lcf_tickets
            (ticketId, applicationId, applicantName, applicantEmail, applicantType,
             eventYear, holderType, companionId, isActive)
           VALUES (?, ?, ?, ?, ?, ?, 'companion', ?, 1)`,
          [candidate, input.applicationId, input.fullName, normalizedEmail, input.applicantType, input.eventYear, companionId],
        );
        ticketId = candidate;
      } catch (error: any) {
        if (error?.code !== "ER_DUP_ENTRY") throw error;
      }
    }
    if (!ticketId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "同行者QRを発行できませんでした" });
    return { companionId, ticketId };
  });
}

export async function updateOwnedCompanion(pool: Pool, input: {
  accountId: number;
  companionId: number;
  fullName: string;
  fullNameKana: string;
  email: string;
}) {
  await ensureFestivalMypageSchema(pool);
  return runTransaction(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM festival_application_companions
        WHERE id = ? AND account_id = ? AND status = 'active'
        LIMIT 1 FOR UPDATE`,
      [input.companionId, input.accountId],
    );
    const companion = rows[0];
    if (!companion) throw new TRPCError({ code: "NOT_FOUND", message: "同行者が見つかりません" });
    await assertNotCheckedIn(connection, {
      applicantType: companion.applicant_type,
      applicationId: Number(companion.application_id),
      eventYear: String(companion.event_year),
    });
    const normalizedEmail = input.email.trim().toLowerCase();
    await connection.query(
      `UPDATE festival_application_companions
          SET full_name = ?, full_name_kana = ?, email = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [input.fullName, input.fullNameKana, normalizedEmail, input.companionId],
    );
    await connection.query(
      `UPDATE lcf_tickets SET applicantName = ?, applicantEmail = ?
        WHERE companionId = ? AND holderType = 'companion'`,
      [input.fullName, normalizedEmail, input.companionId],
    );
    return { before: companion, after: { fullName: input.fullName, fullNameKana: input.fullNameKana, email: normalizedEmail } };
  });
}

export async function cancelOwnedCompanion(pool: Pool, input: {
  accountId: number;
  companionId: number;
  reason: string;
}) {
  await ensureFestivalMypageSchema(pool);
  return runTransaction(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM festival_application_companions
        WHERE id = ? AND account_id = ?
        LIMIT 1 FOR UPDATE`,
      [input.companionId, input.accountId],
    );
    const companion = rows[0];
    if (!companion) throw new TRPCError({ code: "NOT_FOUND", message: "同行者が見つかりません" });
    if (companion.status === "cancelled") return { alreadyCancelled: true };
    const [ticketRows] = await connection.query<RowDataPacket[]>(
      `SELECT admissionCount FROM lcf_tickets
        WHERE companionId = ? AND holderType = 'companion'
        FOR UPDATE`,
      [input.companionId],
    );
    if (ticketRows.some((ticket) => Number(ticket.admissionCount || 0) > 0)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "受付済みの同行者はマイページから取消できません。運営へお問い合わせください。" });
    }
    await connection.query(
      `UPDATE festival_application_companions
          SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [input.reason, input.companionId],
    );
    await connection.query(
      `UPDATE lcf_tickets
          SET isActive = 0, invalidatedAt = CURRENT_TIMESTAMP, invalidationReason = ?
        WHERE companionId = ? AND holderType = 'companion' AND isActive = 1`,
      [`同行者取消: ${input.reason}`.slice(0, 200), input.companionId],
    );
    return { alreadyCancelled: false };
  });
}
