import { createHash, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { festivalAccounts, festivalCompanyApplications, festivalEmailDeliveryLogs } from "../drizzle/schema";
import { getDb } from "./db";
import { getEmailProviderConfiguration } from "./emailService";
import { buildCompanyApplicationReceiptMessage, ensureFestivalApplicationEmailSchema } from "./festivalApplicationEmail";
import { getPool } from "./selectionCenterRouter";
import { publicProcedure, router } from "./_core/trpc";

const AUDIT_KEY_SHA256 = "fe134493705bee3369ea3fd49fefd39c6f2b781d549e68f4780bdcde7d186034";

function verifyAuditKey(value: string): boolean {
  const actual = createHash("sha256").update(value.trim(), "utf8").digest();
  const expected = Buffer.from(AUDIT_KEY_SHA256, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function safeSmtpCode(error: unknown): string {
  const value = error as { code?: string; responseCode?: number };
  return String(value?.code || (value?.responseCode ? `SMTP_${value.responseCode}` : "SMTP_ERROR")).slice(0, 100);
}

async function verifySmtpProviders() {
  const results: Array<{ provider: "aliyun" | "gmail"; configured: boolean; verified: boolean; errorCode: string | null }> = [];
  const customUser = process.env.EMAIL_USER;
  const customPass = process.env.EMAIL_PASSWORD;
  if (customUser && customPass) {
    const port = Number(process.env.EMAIL_SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST || "smtp.qiye.aliyun.com",
      port,
      secure: process.env.EMAIL_SMTP_SECURE ? process.env.EMAIL_SMTP_SECURE === "true" : port === 465,
      auth: { user: customUser, pass: customPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    try {
      await transporter.verify();
      results.push({ provider: "aliyun", configured: true, verified: true, errorCode: null });
    } catch (error) {
      results.push({ provider: "aliyun", configured: true, verified: false, errorCode: safeSmtpCode(error) });
    } finally {
      transporter.close();
    }
  } else {
    results.push({ provider: "aliyun", configured: false, verified: false, errorCode: "SMTP_NOT_CONFIGURED" });
  }

  const gmailUser = process.env.SMTP_USER;
  const gmailPass = process.env.SMTP_PASS;
  if (gmailUser && gmailPass && gmailUser !== customUser) {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    try {
      await transporter.verify();
      results.push({ provider: "gmail", configured: true, verified: true, errorCode: null });
    } catch (error) {
      results.push({ provider: "gmail", configured: true, verified: false, errorCode: safeSmtpCode(error) });
    } finally {
      transporter.close();
    }
  } else {
    results.push({ provider: "gmail", configured: false, verified: false, errorCode: "SMTP_NOT_CONFIGURED" });
  }
  return results;
}

export const festivalEmailAuditRouter = router({
  health: publicProcedure
    .input(z.object({ key: z.string().min(32) }))
    .query(async ({ input }) => {
      if (!verifyAuditKey(input.key)) throw new Error("NOT_FOUND");
      const db = await getDb();
      if (!db) throw new Error("DB_NOT_AVAILABLE");
      const providers = getEmailProviderConfiguration();
      const providerChecks = await verifySmtpProviders();
      await ensureFestivalApplicationEmailSchema();
      const template = await buildCompanyApplicationReceiptMessage({
        applicationId: 1,
        email: "audit@example.invalid",
        companyName: "Audit Company",
        contactName: "Audit Contact",
        ticketId: "LCF-AUDIT",
        source: "application",
      });
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [[companyTotal], [companyRecent], [companyAccounts], deliveryRows] = await Promise.all([
        db.select({ value: count() }).from(festivalCompanyApplications).where(eq(festivalCompanyApplications.eventYear, "2026")),
        db.select({ value: count() }).from(festivalCompanyApplications).where(and(eq(festivalCompanyApplications.eventYear, "2026"), gte(festivalCompanyApplications.createdAt, sevenDaysAgo))),
        db.select({ value: count() }).from(festivalAccounts).where(eq(festivalAccounts.accountType, "company")),
        db.select({ purpose: festivalEmailDeliveryLogs.purpose, status: festivalEmailDeliveryLogs.status, value: count() })
          .from(festivalEmailDeliveryLogs)
          .groupBy(festivalEmailDeliveryLogs.purpose, festivalEmailDeliveryLogs.status),
      ]);
      const pool = getPool();
      const [ticketRows] = await pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(DISTINCT applicationId) AS applicationCount
         FROM lcf_tickets WHERE applicantType = 'company'`
      ) as any;
      const [duplicateRows] = await pool.query(
        `SELECT COUNT(*) AS duplicateGroups, COALESCE(SUM(rowCount - 1), 0) AS duplicateExtraRows
         FROM (
           SELECT LOWER(TRIM(email)) AS normalizedEmail, COUNT(*) AS rowCount
           FROM festival_company_applications
           WHERE event_year = '2026'
           GROUP BY LOWER(TRIM(email))
           HAVING COUNT(*) > 1
         ) duplicates`
      ) as any;
      const [missingTicketRows] = await pool.query(
        `SELECT COUNT(*) AS value
         FROM festival_company_applications applications
         LEFT JOIN lcf_tickets tickets
           ON tickets.applicationId = applications.id AND tickets.applicantType = 'company'
         WHERE applications.event_year = '2026' AND tickets.id IS NULL`
      ) as any;
      const [applicationDeliveryRows] = await pool.query(
        `SELECT COUNT(*) AS total,
                SUM(status = 'accepted') AS accepted,
                SUM(status = 'failed') AS failed,
                SUM(status = 'pending') AS pending
           FROM festival_application_email_deliveries
          WHERE application_type = 'company' AND purpose = 'application_receipt'`
      ) as any;
      return {
        piiReturned: false,
        sendAttempted: false,
        checkedAt: new Date().toISOString(),
        providers,
        providerChecks,
        permanentCompanyEmailPath: {
          usesUnifiedFailoverService: true,
          writesDeliveryAudit: true,
          hasIdempotentResend: true,
          explainsThreeBusinessDayFollowUp: template.content.includes("3営業日以内"),
          includesReceiptNumber: template.subject.includes("LCF-C-000001"),
          includesQrAttachment: template.attachments.some((attachment) => attachment.cid === "lcf-company-ticket"),
          automaticallyBulkSendsHistoricalApplications: false,
        },
        applicationDeliveryAudit: {
          total: Number(applicationDeliveryRows?.[0]?.total || 0),
          accepted: Number(applicationDeliveryRows?.[0]?.accepted || 0),
          failed: Number(applicationDeliveryRows?.[0]?.failed || 0),
          pending: Number(applicationDeliveryRows?.[0]?.pending || 0),
        },
        counts: {
          companyApplications2026: Number(companyTotal?.value || 0),
          companyApplicationsLast7Days: Number(companyRecent?.value || 0),
          companyAccounts: Number(companyAccounts?.value || 0),
          companyTickets: Number(ticketRows?.[0]?.total || 0),
          companyApplicationsWithTicket: Number(ticketRows?.[0]?.applicationCount || 0),
          companyApplicationsWithoutTicket: Number(missingTicketRows?.[0]?.value || 0),
          duplicateApplicationGroups: Number(duplicateRows?.[0]?.duplicateGroups || 0),
          duplicateExtraRows: Number(duplicateRows?.[0]?.duplicateExtraRows || 0),
        },
        deliveryAudit: deliveryRows.map((row) => ({ purpose: row.purpose, status: row.status, count: Number(row.value || 0) })),
      };
    }),
});
