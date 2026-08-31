import { createHash, timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { festivalCompanyApplications } from "../drizzle/schema";
import { getDb } from "./db";
import { isValidEmailForSending } from "./emailValidator";
import {
  ensureFestivalApplicationEmailSchema,
  getCompanyApplicationEmailStatuses,
  sendCompanyApplicationReceipt,
  type ApplicationEmailStatusSummary,
} from "./festivalApplicationEmail";
import { getPool } from "./selectionCenterRouter";
import { publicProcedure, router } from "./_core/trpc";

const OPERATION_KEY_SHA256 = "0b88e9bf8c30f8a73540aab877f64b99a3f5a8083d63e8986a8b89ac2909c50a";
const CONFIRMATION_TEXT = "CONFIRM_RESEND_ALL_LEGACY_COMPANY_APPLICATIONS_2026";
const GLOBAL_LOCK_NAME = "lcf-company-bulk-resend-2026";

interface CompanyApplicationCandidate {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
}

interface CandidateWithTicket extends CompanyApplicationCandidate {
  ticketId: string;
}

interface CandidatePlanInput {
  applications: CompanyApplicationCandidate[];
  ticketsByApplicationId: Map<number, string>;
  deliveryStatuses: Map<number, ApplicationEmailStatusSummary>;
}

export interface CandidatePlan {
  eligible: CandidateWithTicket[];
  summary: {
    totalApplications: number;
    acceptedAlready: number;
    failedExisting: number;
    pendingExisting: number;
    noDeliveryRecord: number;
    invalidEmail: number;
    missingTicket: number;
    duplicateEmailSkipped: number;
    eligibleToSend: number;
  };
}

function verifyOperationKey(key: string): boolean {
  const actual = Buffer.from(createHash("sha256").update(key.trim(), "utf8").digest("hex"));
  const expected = Buffer.from(OPERATION_KEY_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requireOperationKey(key: string): void {
  if (!verifyOperationKey(key)) throw new TRPCError({ code: "NOT_FOUND", message: "NOT_FOUND" });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildCompanyBulkResendCandidatePlan(input: CandidatePlanInput): CandidatePlan {
  const summary = {
    totalApplications: input.applications.length,
    acceptedAlready: 0,
    failedExisting: 0,
    pendingExisting: 0,
    noDeliveryRecord: 0,
    invalidEmail: 0,
    missingTicket: 0,
    duplicateEmailSkipped: 0,
    eligibleToSend: 0,
  };
  const eligible: CandidateWithTicket[] = [];
  const seenRecipients = new Set<string>();

  for (const application of input.applications) {
    const status = input.deliveryStatuses.get(application.id);
    if (status?.status === "accepted") {
      summary.acceptedAlready += 1;
      continue;
    }
    if (status?.status === "failed") summary.failedExisting += 1;
    else if (status?.status === "pending") summary.pendingExisting += 1;
    else summary.noDeliveryRecord += 1;

    const normalizedEmail = normalizeEmail(application.email);
    if (!isValidEmailForSending(normalizedEmail)) {
      summary.invalidEmail += 1;
      continue;
    }
    const ticketId = input.ticketsByApplicationId.get(application.id);
    if (!ticketId) {
      summary.missingTicket += 1;
      continue;
    }
    if (seenRecipients.has(normalizedEmail)) {
      summary.duplicateEmailSkipped += 1;
      continue;
    }
    seenRecipients.add(normalizedEmail);
    eligible.push({ ...application, email: normalizedEmail, ticketId });
  }

  summary.eligibleToSend = eligible.length;
  return { eligible, summary };
}

async function loadCandidatePlan(): Promise<CandidatePlan> {
  await ensureFestivalApplicationEmailSchema();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB_NOT_AVAILABLE" });
  const applications = await db
    .select({
      id: festivalCompanyApplications.id,
      email: festivalCompanyApplications.email,
      companyName: festivalCompanyApplications.companyName,
      contactName: festivalCompanyApplications.contactName,
    })
    .from(festivalCompanyApplications)
    .where(eq(festivalCompanyApplications.eventYear, "2026"))
    .orderBy(asc(festivalCompanyApplications.id));
  const pool = getPool();
  const [ticketRows] = await pool.query(
    `SELECT applicationId, ticketId
       FROM lcf_tickets
      WHERE applicantType = 'company'
      ORDER BY id ASC`,
  ) as any;
  const ticketsByApplicationId = new Map<number, string>();
  for (const row of ticketRows as any[]) {
    const applicationId = Number(row.applicationId);
    if (!ticketsByApplicationId.has(applicationId)) ticketsByApplicationId.set(applicationId, String(row.ticketId));
  }
  const deliveryStatuses = await getCompanyApplicationEmailStatuses(applications.map((application) => application.id));
  return buildCompanyBulkResendCandidatePlan({ applications, ticketsByApplicationId, deliveryStatuses });
}

function safeErrorCode(value: unknown): string {
  const raw = String((value as { errorCode?: string; code?: string })?.errorCode || (value as { code?: string })?.code || "UNKNOWN");
  return raw.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 100) || "UNKNOWN";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const festivalCompanyBulkResendRouter = router({
  preview: publicProcedure
    .input(z.object({ key: z.string().min(32) }))
    .query(async ({ input }) => {
      requireOperationKey(input.key);
      const plan = await loadCandidatePlan();
      return {
        piiReturned: false,
        sendAttempted: false,
        confirmationRequired: CONFIRMATION_TEXT,
        ...plan.summary,
      };
    }),

  run: publicProcedure
    .input(z.object({
      key: z.string().min(32),
      confirmation: z.literal(CONFIRMATION_TEXT),
    }))
    .mutation(async ({ input }) => {
      requireOperationKey(input.key);
      const pool = getPool();
      const connection = await pool.getConnection();
      let lockAcquired = false;
      try {
        const [lockRows] = await connection.query("SELECT GET_LOCK(?, 0) AS acquired", [GLOBAL_LOCK_NAME]) as any;
        lockAcquired = Number(lockRows?.[0]?.acquired || 0) === 1;
        if (!lockAcquired) throw new TRPCError({ code: "CONFLICT", message: "BULK_RESEND_ALREADY_RUNNING" });

        const before = await loadCandidatePlan();
        const providerAccepted: Record<string, number> = {};
        const errorCodes: Record<string, number> = {};
        let attempted = 0;
        let newlyAccepted = 0;
        let alreadyAcceptedDuringRun = 0;
        let failed = 0;

        for (const application of before.eligible) {
          attempted += 1;
          try {
            const result = await sendCompanyApplicationReceipt({
              applicationId: application.id,
              email: application.email,
              companyName: application.companyName,
              contactName: application.contactName,
              ticketId: application.ticketId,
              source: "admin_retry",
            });
            if (result.success) {
              if (result.alreadyAccepted) alreadyAcceptedDuringRun += 1;
              else newlyAccepted += 1;
              const provider = String(result.provider || "unknown").slice(0, 32);
              providerAccepted[provider] = (providerAccepted[provider] || 0) + 1;
            } else {
              failed += 1;
              const code = safeErrorCode(result);
              errorCodes[code] = (errorCodes[code] || 0) + 1;
            }
          } catch (error) {
            failed += 1;
            const code = safeErrorCode(error);
            errorCodes[code] = (errorCodes[code] || 0) + 1;
          }
          await delay(250);
        }

        const after = await loadCandidatePlan();
        return {
          piiReturned: false,
          operation: "resend_all_legacy_company_application_receipts_2026",
          confirmed: true,
          before: before.summary,
          execution: {
            attempted,
            newlyAccepted,
            alreadyAcceptedDuringRun,
            failed,
            providerAccepted,
            errorCodes,
          },
          after: after.summary,
          completedAt: new Date().toISOString(),
        };
      } finally {
        if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [GLOBAL_LOCK_NAME]).catch(() => {});
        connection.release();
      }
    }),
});
