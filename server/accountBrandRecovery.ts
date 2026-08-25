import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { fetchFeishuBrands, isFeishuConfigured } from "./feishuService";

const CANDIDATE_PATTERNS = [
  "account",
  "brand",
  "contact",
  "shop",
  "tiktok",
  "creator",
  "liver",
  "feishu",
];

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(
    0,
    1000
  );
}

function numberValue(value: unknown): number {
  return Number(value || 0);
}

async function tableExists(
  connection: Connection,
  tableName: string
): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT 1 AS present
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
      LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function countTable(
  connection: Connection,
  tableName: string
): Promise<number | null> {
  if (
    !/^[A-Za-z0-9_]+$/.test(tableName) ||
    !(await tableExists(connection, tableName))
  )
    return null;
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS rowCount FROM \`${tableName}\``
    );
    return numberValue(rows[0]?.rowCount);
  } catch {
    return null;
  }
}

async function getCandidateTableCounts(
  connection: Connection
): Promise<Record<string, number | null>> {
  const clauses = CANDIDATE_PATTERNS.map(() => "LOWER(table_name) LIKE ?").join(
    " OR "
  );
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        AND (${clauses})
      ORDER BY table_name`,
    CANDIDATE_PATTERNS.map(pattern => `%${pattern}%`)
  );
  const result: Record<string, number | null> = {};
  for (const row of rows) {
    const tableName = String(row.tableName);
    result[tableName] = await countTable(connection, tableName);
  }
  return result;
}

async function getBrandState(connection: Connection) {
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END) AS visible,
      SUM(CASE WHEN deletedAt IS NOT NULL THEN 1 ELSE 0 END) AS deleted,
      SUM(CASE WHEN deletedAt IS NULL AND larkRecordId IS NOT NULL AND larkRecordId <> '' THEN 1 ELSE 0 END) AS larkLinked,
      COUNT(DISTINCT CASE WHEN deletedAt IS NULL AND larkRecordId IS NOT NULL AND larkRecordId <> '' THEN larkRecordId END) AS uniqueLarkRecordIds,
      SUM(CASE WHEN deletedAt IS NULL AND larkShopId IS NOT NULL AND larkShopId <> '' THEN 1 ELSE 0 END) AS withLarkShopId,
      COUNT(DISTINCT CASE WHEN deletedAt IS NULL AND larkShopId IS NOT NULL AND larkShopId <> '' THEN larkShopId END) AS uniqueLarkShopIds,
      SUM(CASE WHEN deletedAt IS NULL AND shopId IS NOT NULL AND shopId <> '' THEN 1 ELSE 0 END) AS withShopId,
      COUNT(DISTINCT CASE WHEN deletedAt IS NULL AND shopId IS NOT NULL AND shopId <> '' THEN shopId END) AS uniqueShopIds,
      SUM(CASE WHEN deletedAt IS NULL AND (email IS NOT NULL AND email <> '' OR phoneNumber IS NOT NULL AND phoneNumber <> '' OR contactPerson IS NOT NULL AND contactPerson <> '') THEN 1 ELSE 0 END) AS withDirectContact,
      SUM(CASE WHEN deletedAt IS NULL AND (larkBrandManager IS NOT NULL AND larkBrandManager <> '' OR larkBusinessContact IS NOT NULL AND larkBusinessContact <> '' OR larkBusinessLead IS NOT NULL AND larkBusinessLead <> '' OR larkOperationsContact IS NOT NULL AND larkOperationsContact <> '') THEN 1 ELSE 0 END) AS withLarkContact
    FROM brands
  `);
  const row = rows[0] || {};
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, numberValue(value)])
  );
}

async function getAccountSourceState(connection: Connection) {
  const platformAccounts = await countTable(connection, "platform_accounts");
  const contacts = await countTable(connection, "contact_info");
  const svmAccounts = await countTable(connection, "svm_accounts");
  const creators = await countTable(connection, "creators");
  const livers = await countTable(connection, "livers");
  const lineUsers = await countTable(connection, "line_users");
  const users = await countTable(connection, "users");
  const staff = await countTable(connection, "staff");
  return {
    platformAccounts,
    contacts,
    svmAccounts,
    creators,
    livers,
    lineUsers,
    users,
    staff,
  };
}

async function getSyncHistory(connection: Connection) {
  if (!(await tableExists(connection, "feishu_sync_history"))) return [];
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT syncType, status, totalRecords, newRecords, updatedRecords,
           triggeredBy, durationMs, syncedAt,
           CASE WHEN errorMessage IS NULL OR errorMessage = '' THEN 0 ELSE 1 END AS hasError
      FROM feishu_sync_history
     ORDER BY id DESC
     LIMIT 20
  `);
  return rows.map(row => ({
    syncType: String(row.syncType || ""),
    status: String(row.status || ""),
    totalRecords: numberValue(row.totalRecords),
    newRecords: numberValue(row.newRecords),
    updatedRecords: numberValue(row.updatedRecords),
    triggeredBy: String(row.triggeredBy || ""),
    durationMs: numberValue(row.durationMs),
    syncedAt: row.syncedAt ? new Date(row.syncedAt).toISOString() : null,
    hasError: Boolean(row.hasError),
  }));
}

async function getLiveLarkState() {
  if (!isFeishuConfigured()) {
    return { configured: false, ok: false, error: "not-configured" };
  }
  try {
    const rows = await fetchFeishuBrands();
    const valid = rows.filter(
      row =>
        row.brandName &&
        row.brandName !== "Unknown" &&
        row.brandName.length <= 80
    );
    const taskRows = valid.filter(
      row => row.brandName.includes("<") || row.brandName.includes("＜")
    );
    const brandRows = valid.filter(
      row => !row.brandName.includes("<") && !row.brandName.includes("＜")
    );
    return {
      configured: true,
      ok: true,
      totalRecords: rows.length,
      validRecords: valid.length,
      taskRecords: taskRows.length,
      brandRecords: brandRows.length,
      uniqueRecordIds: new Set(brandRows.map(row => row.recordId)).size,
      uniqueBrandNames: new Set(
        brandRows.map(row => row.brandName.trim().toLowerCase())
      ).size,
      withShopId: brandRows.filter(row => Boolean(row.shopId)).length,
    };
  } catch (error) {
    return { configured: true, ok: false, error: safeError(error) };
  }
}

export async function getAccountBrandRecoverySnapshot() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for account/brand recovery diagnostics"
    );
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [
      brandState,
      accountSources,
      candidateTableCounts,
      syncHistory,
      liveLark,
    ] = await Promise.all([
      getBrandState(connection),
      getAccountSourceState(connection),
      getCandidateTableCounts(connection),
      getSyncHistory(connection),
      getLiveLarkState(),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      brandState,
      accountSources,
      candidateTableCounts,
      syncHistory,
      liveLark,
    };
  } finally {
    await connection.end();
  }
}
