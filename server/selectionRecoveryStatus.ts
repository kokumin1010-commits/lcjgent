import type { Express } from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";

const STATUS_TOKEN = "2ce7552cbad871a9c88ebcceba27e0b63ae7c754db3342f08ecdafb8dadc8aa5";
const TABLES = [
  "selection_products",
  "selection_categories",
  "product_bundles",
  "bundle_items",
  "selection_price_history",
  "selection_discount_history",
  "anchor_selections",
  "sc_schedules",
  "selection_performances",
  "selection_settlements",
  "procurement_orders",
  "product_cost_history",
  "brand_livestreams",
  "livestream_products",
  "brand_products",
  "brands",
  "livers",
  "csv_import_history",
] as const;

export function registerSelectionRecoveryStatus(app: Express): void {
  app.get(`/api/internal/selection-recovery/${STATUS_TOKEN}`, async (_req, res) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return res.status(503).json({ error: "database unavailable" });
    const connection = await mysql.createConnection(databaseUrl);
    try {
      const counts: Record<string, number> = {};
      for (const table of TABLES) {
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
        counts[table] = Number(rows[0]?.count || 0);
      }
      const [marker] = await connection.query<RowDataPacket[]>(
        "SELECT recoveryKey, status, details, startedAt, completedAt FROM selection_recovery_markers WHERE recoveryKey='selection-center-recovery-v1' LIMIT 1",
      );
      const [samples] = await connection.query<RowDataPacket[]>(
        "SELECT id, productName, brandName, productId, status FROM selection_products WHERE deletedAt IS NULL ORDER BY id LIMIT 8",
      );
      const [bundles] = await connection.query<RowDataPacket[]>(
        "SELECT id, bundleName, status FROM product_bundles WHERE deletedAt IS NULL ORDER BY id LIMIT 8",
      );
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, counts, marker: marker[0] || null, samples, bundles });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      await connection.end();
    }
  });
}
