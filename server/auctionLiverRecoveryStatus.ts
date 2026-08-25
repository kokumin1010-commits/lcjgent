import { Router } from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";

const TOKEN = "48d6952a8277310144fd4a52edb4482cce9dac5c47dc13ec4e5b86b5213a949a";

export const auctionLiverRecoveryStatusRouter = Router();

auctionLiverRecoveryStatusRouter.get(`/${TOKEN}`, async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return res.status(503).json({ ok: false, error: "database unavailable" });
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2, waitForConnections: true });
  try {
    const [marker] = await pool.query<RowDataPacket[]>(
      "SELECT recoveryKey,status,liverCount,livestreamCount,linkedLivestreamCount,knownEffectiveSales,auctionCount,details,startedAt,completedAt,errorMessage FROM auction_liver_recovery_runs ORDER BY id DESC LIMIT 1",
    );
    const [counts] = await pool.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM livers WHERE isActive = 1) AS activeLivers,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL) AS totalLivestreams,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL AND liverId = 120005) AS linkedRyuLivestreams,
        (SELECT COALESCE(SUM(COALESCE(manualSalesAmount, salesAmount, gmv, 0)), 0)
           FROM brand_livestreams WHERE deletedAt IS NULL AND liverId = 120005) AS effectiveSalesAllTime,
        (SELECT COALESCE(SUM(COALESCE(manualSalesAmount, salesAmount, gmv, 0)), 0)
           FROM brand_livestreams WHERE deletedAt IS NULL AND liverId = 120005
            AND livestreamDate >= '2025-12-01 00:00:00' AND livestreamDate < '2026-01-01 00:00:00') AS effectiveSalesDec2025,
        (SELECT COUNT(*) FROM auction_records) AS auctionCount
    `);
    const [livers] = await pool.query<RowDataPacket[]>(
      "SELECT id,name,email,isActive,agencyId FROM livers ORDER BY name,id",
    );
    const [months] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(livestreamDate, '%Y-%m') AS month,
             COUNT(*) AS streams,
             COALESCE(SUM(COALESCE(manualSalesAmount, salesAmount, gmv, 0)), 0) AS sales,
             COALESCE(SUM(duration), 0) AS duration
        FROM brand_livestreams
       WHERE deletedAt IS NULL AND liverId = 120005
       GROUP BY DATE_FORMAT(livestreamDate, '%Y-%m')
       ORDER BY month
    `);
    return res.json({ ok: true, marker: marker[0] || null, counts: counts[0] || {}, livers, months });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await pool.end();
  }
});
