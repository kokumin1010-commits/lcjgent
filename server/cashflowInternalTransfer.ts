import { randomUUID } from "node:crypto";
import type mysql from "mysql2/promise";

export const INTERNAL_TRANSFER_CATEGORIES = ["本社送金", "口座間振替"] as const;

export async function ensureCashflowInternalTransferSchema(pool: mysql.Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_internal_transfers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transferKey VARCHAR(64) NOT NULL,
    sourceCashflowId INT NOT NULL,
    destinationCashflowId INT NOT NULL,
    activeSourceCashflowId INT DEFAULT NULL,
    activeDestinationCashflowId INT DEFAULT NULL,
    status ENUM('linked','unlinked') NOT NULL DEFAULT 'linked',
    sourceAmount DECIMAL(15,2) NOT NULL,
    sourceCurrency ENUM('JPY','CNY') NOT NULL,
    destinationAmount DECIMAL(15,2) NOT NULL,
    destinationCurrency ENUM('JPY','CNY') NOT NULL,
    actualJpyPerCny DECIMAL(18,8) DEFAULT NULL,
    note VARCHAR(500) DEFAULT NULL,
    createdBy INT DEFAULT NULL,
    unlinkedBy INT DEFAULT NULL,
    unlinkedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cashflow_transfer_key (transferKey),
    UNIQUE KEY uq_cashflow_transfer_active_source (activeSourceCashflowId),
    UNIQUE KEY uq_cashflow_transfer_active_destination (activeDestinationCashflowId),
    INDEX idx_cashflow_transfer_source (sourceCashflowId),
    INDEX idx_cashflow_transfer_destination (destinationCashflowId),
    INDEX idx_cashflow_transfer_created (createdAt)
  )`);
}

function isInternalCategory(value: unknown) {
  return INTERNAL_TRANSFER_CATEGORIES.includes(String(value || "").trim() as typeof INTERNAL_TRANSFER_CATEGORIES[number]);
}

function finitePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function calculateActualJpyPerCny(rows: Array<{ currency: string; amount: unknown }>) {
  const jpy = rows.find(row => row.currency === "JPY");
  const cny = rows.find(row => row.currency === "CNY");
  const jpyAmount = finitePositive(jpy?.amount);
  const cnyAmount = finitePositive(cny?.amount);
  if (!jpyAmount || !cnyAmount) return null;
  return Math.round((jpyAmount / cnyAmount) * 100000000) / 100000000;
}

export async function listCashflowInternalTransferRows(
  pool: mysql.Pool,
  input: { entity?: "japan" | "china" | "all"; startDate?: string; endDate?: string },
) {
  await ensureCashflowInternalTransferSchema(pool);
  let where = "WHERE cf.deletedAt IS NULL AND cf.category IN ('本社送金','口座間振替')";
  const params: unknown[] = [];
  if (input.entity && input.entity !== "all") { where += " AND cf.entity = ?"; params.push(input.entity); }
  if (input.startDate) { where += " AND cf.transactionDate >= ?"; params.push(input.startDate); }
  if (input.endDate) { where += " AND cf.transactionDate <= ?"; params.push(input.endDate); }
  const [rows] = await pool.query(`
    SELECT cf.id AS cashflowId,cf.entity,cf.type,cf.category,cf.amount,cf.currency,
           cf.transactionDate,cf.sourceAccount,
           t.id AS transferId,t.transferKey,t.actualJpyPerCny,t.note,
           CASE WHEN t.activeSourceCashflowId=cf.id THEN t.activeDestinationCashflowId ELSE t.activeSourceCashflowId END AS pairedCashflowId
      FROM company_cashflows cf
      LEFT JOIN cashflow_internal_transfers t
        ON t.status='linked' AND (t.activeSourceCashflowId=cf.id OR t.activeDestinationCashflowId=cf.id)
      ${where}
     ORDER BY cf.transactionDate DESC,cf.amount DESC,cf.id DESC
  `, params) as any;
  return (rows as any[]).map(row => ({
    cashflowId: Number(row.cashflowId),
    entity: row.entity as "japan" | "china",
    type: row.type as "income" | "expense",
    category: String(row.category || ""),
    amount: Number(row.amount || 0),
    currency: row.currency as "JPY" | "CNY",
    transactionDate: String(row.transactionDate || ""),
    sourceAccount: row.sourceAccount ? String(row.sourceAccount) : null,
    linked: row.transferId != null,
    transferId: row.transferId == null ? null : Number(row.transferId),
    transferKey: row.transferKey ? String(row.transferKey) : null,
    pairedCashflowId: row.pairedCashflowId == null ? null : Number(row.pairedCashflowId),
    actualJpyPerCny: row.actualJpyPerCny == null ? null : Number(row.actualJpyPerCny),
    note: row.note ? String(row.note) : null,
  }));
}

export async function linkCashflowInternalTransfer(
  pool: mysql.Pool,
  input: { sourceCashflowId: number; destinationCashflowId: number; note?: string; actorId?: number | null },
) {
  await ensureCashflowInternalTransferSchema(pool);
  if (input.sourceCashflowId === input.destinationCashflowId) throw new Error("同じ流水は关联できません");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = [input.sourceCashflowId, input.destinationCashflowId].sort((a, b) => a - b);
    const [rows] = await connection.query(
      `SELECT id,entity,type,category,amount,currency,deletedAt
         FROM company_cashflows WHERE id IN (?,?) FOR UPDATE`, ids,
    ) as any;
    if ((rows as any[]).length !== 2 || (rows as any[]).some(row => row.deletedAt)) throw new Error("关联対象の流水が見つかりません");
    const source = (rows as any[]).find(row => Number(row.id) === input.sourceCashflowId);
    const destination = (rows as any[]).find(row => Number(row.id) === input.destinationCashflowId);
    if (!source || !destination) throw new Error("关联対象の流水が見つかりません");
    if (source.type !== "expense" || destination.type !== "income") throw new Error("出金流水と入金流水を選択してください");
    if (source.entity === destination.entity) throw new Error("内部转账は異なる法人間で关联してください");
    if (source.currency === destination.currency) throw new Error("JPYとCNYの異なる通貨を关联してください");
    if (!isInternalCategory(source.category) || !isInternalCategory(destination.category)) throw new Error("両方の分类を本社送金または口座間振替にしてください");
    const [existing] = await connection.query(
      `SELECT id FROM cashflow_internal_transfers
        WHERE status='linked' AND (activeSourceCashflowId IN (?,?) OR activeDestinationCashflowId IN (?,?)) FOR UPDATE`,
      [input.sourceCashflowId, input.destinationCashflowId, input.sourceCashflowId, input.destinationCashflowId],
    ) as any;
    if ((existing as any[]).length > 0) throw new Error("選択した流水はすでに内部转账へ关联されています");
    const actualRate = calculateActualJpyPerCny([source, destination]);
    const transferKey = randomUUID();
    const [result] = await connection.query(
      `INSERT INTO cashflow_internal_transfers
        (transferKey,sourceCashflowId,destinationCashflowId,activeSourceCashflowId,activeDestinationCashflowId,status,sourceAmount,sourceCurrency,destinationAmount,destinationCurrency,actualJpyPerCny,note,createdBy)
       VALUES (?,?,?,?,?,'linked',?,?,?,?,?,?,?,?)`,
      [transferKey, source.id, destination.id, source.id, destination.id, source.amount, source.currency, destination.amount, destination.currency, actualRate, input.note?.trim().slice(0, 500) || null, input.actorId || null],
    ) as any;
    await connection.commit();
    return { id: Number(result.insertId), transferKey, actualJpyPerCny: actualRate };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assertCashflowRowsNotLinked(
  connection: mysql.Pool | mysql.PoolConnection,
  cashflowIds: number[],
) {
  if (cashflowIds.length === 0) return;
  const uniqueIds = [...new Set(cashflowIds.map(Number).filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) return;
  const placeholders = uniqueIds.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT id FROM cashflow_internal_transfers
      WHERE status='linked' AND (activeSourceCashflowId IN (${placeholders}) OR activeDestinationCashflowId IN (${placeholders}))
      LIMIT 1`,
    [...uniqueIds, ...uniqueIds],
  ) as any;
  if ((rows as any[]).length > 0) throw new Error("已关联的内部转账请先解除关联，再修改或删除原始流水");
}

export async function unlinkCashflowInternalTransfer(
  pool: mysql.Pool,
  input: { transferId: number; actorId?: number | null },
) {
  await ensureCashflowInternalTransferSchema(pool);
  const [result] = await pool.query(
    `UPDATE cashflow_internal_transfers
        SET status='unlinked',activeSourceCashflowId=NULL,activeDestinationCashflowId=NULL,unlinkedBy=?,unlinkedAt=CURRENT_TIMESTAMP
      WHERE id=? AND status='linked'`,
    [input.actorId || null, input.transferId],
  ) as any;
  if (Number(result?.affectedRows || 0) !== 1) throw new Error("有効な内部转账关联が見つかりません");
  return { success: true };
}
