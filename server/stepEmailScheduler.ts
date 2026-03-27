import { nanoid } from "nanoid";
import { sendEmail } from "./emailService";
import {
  getEnabledStepEmailTemplates,
  getEligibleUsersForStepEmail,
  createStepEmailLog,
  hasStepEmailBeenSent,
} from "./db";

const STEP_EMAIL_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Process and send step emails to eligible users
 */
async function processStepEmails() {
  console.log("[Step Email] Starting step email processing...");

  try {
    const templates = await getEnabledStepEmailTemplates();
    if (templates.length === 0) {
      console.log("[Step Email] No enabled templates found.");
      return;
    }

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const template of templates) {
      const eligibleUsers = await getEligibleUsersForStepEmail(template.id, template.delayDays);

      for (const user of eligibleUsers) {
        if (!user.email) continue;

        // Double-check to prevent race conditions
        const alreadySent = await hasStepEmailBeenSent(template.id, user.id);
        if (alreadySent) {
          totalSkipped++;
          continue;
        }

        const trackingId = nanoid(32);
        const baseUrl = process.env.APP_URL || "https://3000-iaewl8ct8n2mc6jri0v9e-04e9dcee.sg1.manus.computer";

        // Replace placeholders in template
        const personalizedHtml = template.bodyHtml
          .replace(/\{\{name\}\}/g, user.displayName || "お客様")
          .replace(/\{\{email\}\}/g, user.email)
          // Add tracking pixel at the end of HTML
          + `<img src="${baseUrl}/api/track/step-email/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;

        // Replace links with tracking redirects
        const trackedHtml = personalizedHtml.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (match, url) => {
            const encodedUrl = encodeURIComponent(url);
            return `href="${baseUrl}/api/track/step-email/click/${trackingId}?url=${encodedUrl}"`;
          }
        );

        const personalizedText = template.bodyText
          .replace(/\{\{name\}\}/g, user.displayName || "お客様")
          .replace(/\{\{email\}\}/g, user.email);

        try {
          const result = await sendEmail({
            to: [user.email],
            subject: template.subject.replace(/\{\{name\}\}/g, user.displayName || "お客様"),
            content: personalizedText,
            html: trackedHtml,
          });

          await createStepEmailLog({
            templateId: template.id,
            lineUserId: user.id,
            email: user.email,
            status: result.success ? "sent" : "failed",
            errorMessage: result.error || null,
            trackingId,
          });

          if (result.success) {
            totalSent++;
          } else {
            totalFailed++;
          }
        } catch (error) {
          await createStepEmailLog({
            templateId: template.id,
            lineUserId: user.id,
            email: user.email,
            status: "failed",
            errorMessage: String(error),
            trackingId,
          });
          totalFailed++;
        }
      }
    }

    console.log(`[Step Email] Completed. Sent: ${totalSent}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`);
  } catch (error) {
    console.error("[Step Email] Error during processing:", error);
  }
}

/**
 * Start the step email scheduler
 */
export function startStepEmailScheduler() {
  console.log("[Step Email Scheduler] Starting (runs every 1 hour)...");

  // Run immediately on startup
  processStepEmails().catch((err) =>
    console.error("[Step Email Scheduler] Error during initial run:", err)
  );

  // Then run every hour
  setInterval(() => {
    processStepEmails().catch((err) =>
      console.error("[Step Email Scheduler] Error during scheduled run:", err)
    );
  }, STEP_EMAIL_INTERVAL);
}
