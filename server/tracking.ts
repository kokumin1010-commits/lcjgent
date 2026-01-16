import { Router } from "express";
import { getDb } from "./db";
import { emailTracking } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const trackingRouter = Router();

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
