import { Router } from "express";
import path from "path";
import { getDb } from "./db";
import { emailTracking, salesEmailLogs } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export const trackingRouter = Router();

/**
 * Disguised tracking endpoint for Gmail compatibility
 * Gmail blocks obvious tracking pixels (URLs with 'track', 'pixel', 'open' in path)
 * This endpoint uses a natural-looking image URL pattern
 * Route: /api/track/i/e/:trackingId  (trackingId ends with .gif)
 */
trackingRouter.get("/i/e/:trackingId", async (req, res) => {
  // Remove .gif extension if present in the param
  const trackingId = (req.params.trackingId || '').replace(/\.gif$/, '');

  try {
    const db = await getDb();
    if (db && trackingId) {
      const [existing] = await db
        .select()
        .from(salesEmailLogs)
        .where(eq(salesEmailLogs.trackingId, trackingId))
        .limit(1);

      if (existing) {
        const now = new Date();
        await db
          .update(salesEmailLogs)
          .set({
            openedAt: existing.openedAt || now,
            openCount: (existing.openCount || 0) + 1,
            lastOpenedAt: now,
          })
          .where(eq(salesEmailLogs.trackingId, trackingId));
      }
    }
  } catch (error) {
    console.error("[Email Tracking] Error recording open:", error);
  }

  // Return transparent 1x1 pixel GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(pixel.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  res.send(pixel);
});

/**
 * Tracking pixel endpoint
 * Returns a transparent 1x1 pixel GIF and records email open
 */
trackingRouter.get("/pixel/:token", async (req, res) => {
  const { token } = req.params;
  const ipAddress = req.ip || req.socket.remoteAddress || "";
  const userAgent = req.get("user-agent") || "";

  try {
    const db = await getDb();
    if (!db) {
      console.error("[Tracking] Database not available");
      // Still return pixel even if DB fails
    } else {
      // Find tracking record by token
      const [tracking] = await db
        .select()
        .from(emailTracking)
        .where(eq(emailTracking.trackingToken, token))
        .limit(1);

      if (tracking) {
        // Update tracking record
        const now = Date.now();
        await db
          .update(emailTracking)
          .set({
            openedAt: tracking.openedAt || now, // Only set on first open
            openCount: tracking.openCount + 1,
            ipAddress: ipAddress,
            userAgent: userAgent,
          })
          .where(eq(emailTracking.trackingToken, token));
      }
    }
  } catch (error) {
    console.error("[Tracking] Error recording email open:", error);
  }

  // Return transparent 1x1 pixel GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": pixel.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  res.send(pixel);
});

/**
 * Step Email - Open tracking pixel
 * Records email open event for step emails
 */
trackingRouter.get("/step-email/open/:trackingId", async (req, res) => {
  const { trackingId } = req.params;

  try {
    const { recordStepEmailOpen } = await import("./db");
    await recordStepEmailOpen(trackingId);
  } catch (error) {
    console.error("[Step Email Tracking] Error recording open:", error);
  }

  // Return transparent 1x1 pixel GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(pixel.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  res.send(pixel);
});

/**
 * Step Email - Click tracking redirect
 * Records click event and redirects to the original URL
 */
trackingRouter.get("/step-email/click/:trackingId", async (req, res) => {
  const { trackingId } = req.params;
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).send("Missing URL parameter");
  }

  try {
    const { recordStepEmailClick } = await import("./db");
    await recordStepEmailClick(trackingId, decodeURIComponent(url));
  } catch (error) {
    console.error("[Step Email Tracking] Error recording click:", error);
  }

  // Redirect to the original URL
  res.redirect(302, decodeURIComponent(url));
});

/**
 * Sales Email - Open tracking pixel
 * Records email open event for sales emails (business card / lead emails)
 */
trackingRouter.get("/sales-email/open/:trackingId", async (req, res) => {
  const { trackingId } = req.params;

  try {
    const db = await getDb();
    if (db) {
      const [existing] = await db
        .select()
        .from(salesEmailLogs)
        .where(eq(salesEmailLogs.trackingId, trackingId))
        .limit(1);

      if (existing) {
        const now = new Date();
        await db
          .update(salesEmailLogs)
          .set({
            openedAt: existing.openedAt || now,
            openCount: (existing.openCount || 0) + 1,
            lastOpenedAt: now,
          })
          .where(eq(salesEmailLogs.trackingId, trackingId));
      }
    }
  } catch (error) {
    console.error("[Sales Email Tracking] Error recording open:", error);
  }

  // Return transparent 1x1 pixel GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(pixel.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  res.send(pixel);
});

/**
 * Sales Email - PDF download tracking
 * Records PDF download event and serves the PDF file
 */
trackingRouter.get("/sales-email/pdf/:trackingId", async (req, res) => {
  const { trackingId } = req.params;

  try {
    const db = await getDb();
    if (db) {
      const [existing] = await db
        .select()
        .from(salesEmailLogs)
        .where(eq(salesEmailLogs.trackingId, trackingId))
        .limit(1);

      if (existing) {
        const now = new Date();
        await db
          .update(salesEmailLogs)
          .set({
            pdfDownloadedAt: existing.pdfDownloadedAt || now,
            pdfDownloadCount: (existing.pdfDownloadCount || 0) + 1,
          })
          .where(eq(salesEmailLogs.trackingId, trackingId));
      }
    }
  } catch (error) {
    console.error("[Sales Email Tracking] Error recording PDF download:", error);
  }

  // Serve the PDF file
  const pdfPath = path.resolve(process.cwd(), "server/assets/LCJ_proposal_ja_v06.pdf");
  res.download(pdfPath, "LCJ提案書.pdf", (err) => {
    if (err) {
      console.error("[Sales Email Tracking] Error serving PDF:", err);
      if (!res.headersSent) {
        res.status(404).send("PDF not found");
      }
    }
  });
});
