import type { Pool, PoolConnection } from "mysql2/promise";

export type MonthlyPnlStatus = "draft" | "closed" | "audited";

export type MonthlyPnlInput = {
  month: string;
  revenueJpy: number;
  grossProfitJpy: number;
  operatingProfitJpy: number;
  netProfitJpy?: number | null;
  status: MonthlyPnlStatus;
  note?: string | null;
  actorId?: number | null;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS finance_monthly_pnl (
    id BIGINT NOT NULL AUTO_INCREMENT,
    month VARCHAR(7) NOT NULL,
    revenueJpy DECIMAL(18,2) NOT NULL DEFAULT 0,
    grossProfitJpy DECIMAL(18,2) NOT NULL DEFAULT 0,
    operatingProfitJpy DECIMAL(18,2) NOT NULL DEFAULT 0,
    netProfitJpy DECIMAL(18,2) DEFAULT NULL,
    status ENUM('draft','closed','audited') NOT NULL DEFAULT 'draft',
    note VARCHAR(1000) DEFAULT NULL,
    createdBy INT DEFAULT NULL,
    updatedBy INT DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_finance_monthly_pnl_month (month),
    KEY idx_finance_monthly_pnl_status_month (status, month)
  )
`;

export async function ensureIpoReadinessMonthlyPnlSchema(pool: Pick<Pool, "query"> | Pick<PoolConnection, "query">) {
  await pool.query(CREATE_TABLE_SQL);
}

export async function listIpoReadinessMonthlyPnl(pool: Pick<Pool, "query">) {
  await ensureIpoReadinessMonthlyPnlSchema(pool);
  const [rows] = await pool.query(`
    SELECT id,month,revenueJpy,grossProfitJpy,operatingProfitJpy,netProfitJpy,status,note,updatedAt
      FROM finance_monthly_pnl
     ORDER BY month ASC
  `) as any;
  return (rows as any[]).map((row) => ({
    id: Number(row.id),
    month: String(row.month),
    revenueJpy: Number(row.revenueJpy || 0),
    grossProfitJpy: Number(row.grossProfitJpy || 0),
    operatingProfitJpy: Number(row.operatingProfitJpy || 0),
    netProfitJpy: row.netProfitJpy == null ? null : Number(row.netProfitJpy),
    status: row.status as MonthlyPnlStatus,
    note: row.note == null ? null : String(row.note),
    updatedAt: row.updatedAt,
  }));
}

export async function upsertIpoReadinessMonthlyPnl(pool: Pool, input: MonthlyPnlInput) {
  await ensureIpoReadinessMonthlyPnlSchema(pool);
  const actorId = input.actorId || null;
  const note = input.note?.trim() || null;
  await pool.query(
    `INSERT INTO finance_monthly_pnl
       (month,revenueJpy,grossProfitJpy,operatingProfitJpy,netProfitJpy,status,note,createdBy,updatedBy)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       revenueJpy=VALUES(revenueJpy),
       grossProfitJpy=VALUES(grossProfitJpy),
       operatingProfitJpy=VALUES(operatingProfitJpy),
       netProfitJpy=VALUES(netProfitJpy),
       status=VALUES(status),
       note=VALUES(note),
       updatedBy=VALUES(updatedBy),
       updatedAt=CURRENT_TIMESTAMP`,
    [
      input.month,
      input.revenueJpy,
      input.grossProfitJpy,
      input.operatingProfitJpy,
      input.netProfitJpy ?? null,
      input.status,
      note,
      actorId,
      actorId,
    ],
  );
  return { success: true as const, month: input.month };
}
