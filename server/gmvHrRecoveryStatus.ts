import type { Express } from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";

const STATUS_TOKEN = "6f55a9374d5fc37f820c5ae971c49ca8f82c6ae1bd6a1d85bae42f5d044d5e1c";

export function registerGmvHrRecoveryStatusRoute(app: Express): void {
  app.get(`/api/internal/gmv-hr-recovery/${STATUS_TOKEN}`, async (_req, res) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return res.status(503).json({ ok: false, error: "database unavailable" });
    const connection = await mysql.createConnection(databaseUrl);
    try {
      const [marker] = await connection.query<RowDataPacket[]>(
        "SELECT recoveryKey, status, completedAt, storeCount, totalGmv, staffCount, details, errorMessage FROM gmv_hr_recovery_runs ORDER BY id DESC LIMIT 1",
      );
      const [storeRows] = await connection.query<RowDataPacket[]>(
        `SELECT s.id, s.name, s.platform, s.operatorName, u.dataJson
         FROM managed_stores s
         LEFT JOIN store_data_uploads u ON u.storeId = s.id AND u.year = 2026 AND u.month = 7 AND u.dataType = 'shop_stats'
         WHERE s.isActive = 1 ORDER BY s.id`,
      );
      const stores = storeRows.map((row) => {
        const parsed = row.dataJson ? JSON.parse(String(row.dataJson)) : [];
        const summary = parsed.find((item: any) => item?._type === "summary") || {};
        const gmv = Number(summary?.GMV?.value || 0);
        const refund = Number(summary?.["返金"]?.value || 0);
        return {
          id: Number(row.id),
          name: String(row.name),
          platform: String(row.platform),
          operatorName: row.operatorName ? String(row.operatorName) : null,
          gmv,
          gmvPct: Number(summary?.GMV?.pct || 0),
          refund,
          returnRate: gmv > 0 ? Math.round((refund / gmv) * 1000) / 10 : 0,
        };
      });
      const [staff] = await connection.query<RowDataPacket[]>(
        "SELECT id, name, email, department, position, country, isActive FROM staff ORDER BY id",
      );
      const [reportStaff] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM report_staff WHERE isActive = 'active'",
      );
      const [backups] = await connection.query<RowDataPacket[]>(
        "SELECT id, reason, status, completedAt, tableCount, rowCount, checksum FROM db_backup_runs WHERE reason IN ('pre-gmv-hr-recovery', 'post-gmv-hr-recovery') ORDER BY id DESC LIMIT 4",
      );
      return res.json({
        ok: true,
        marker: marker[0] || null,
        totals: {
          stores: stores.length,
          gmv: stores.reduce((sum, row) => sum + row.gmv, 0),
          activeStaff: staff.filter((row) => row.isActive === "active").length,
          activeReportStaff: Number(reportStaff[0]?.count || 0),
        },
        stores,
        staff,
        backups,
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await connection.end();
    }
  });
}
