import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import {
  fetchFeishuBrands,
  mapLarkStageToStatus,
  type LarkBrandData,
} from "./feishuService";

const RECOVERY_KEY = "account-brand-lark-recovery-v2-2026-08-26";
const CLASSIFICATION_KEY = "platform-account-classification-v2-2026-08-26";
const PRE_CLASSIFICATION_BACKUP_REASON = "pre-acct-class-v2";
const POST_CLASSIFICATION_BACKUP_REASON = "post-acct-class-v2";
const SOURCE_PREFIX = "recovery_source=";

type ContactCategory = "brand" | "client" | "partner" | "supplier" | "other";

type ContactSeed = {
  source: string;
  category: ContactCategory;
  companyName: string | null;
  contactName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
  lineId: string | null;
  address: string | null;
  responsible: string | null;
  status: "active" | "inactive";
  tags: string[];
  notes: string;
};

export type ProjectionResult = {
  expectedPlatformSources: number;
  expectedContactSources: number;
  platformInserted: number;
  platformUpdated: number;
  contactInserted: number;
  contactUpdated: number;
};

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function uniqueText(values: unknown[]): string[] {
  return [
    ...new Set(
      values.map(text).filter((value): value is string => Boolean(value))
    ),
  ];
}

async function ensureTables(connection: Connection): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS platform_accounts (
    id int AUTO_INCREMENT NOT NULL,
    platform varchar(100) NOT NULL,
    account_name varchar(255) NOT NULL,
    account_id varchar(255),
    password text,
    login_url text,
    email varchar(320),
    phone varchar(50),
    responsible varchar(255),
    status enum('active','inactive','expired','suspended') NOT NULL DEFAULT 'active',
    expires_at timestamp NULL,
    tags json,
    notes text,
    created_by int,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await connection.execute(`CREATE TABLE IF NOT EXISTS contact_info (
    id int AUTO_INCREMENT NOT NULL,
    category enum('brand','client','partner','supplier','other') NOT NULL DEFAULT 'client',
    company_name varchar(255),
    contact_name varchar(255) NOT NULL,
    position varchar(255),
    email varchar(320),
    phone varchar(50),
    wechat varchar(255),
    line_id varchar(255),
    address text,
    responsible varchar(255),
    status enum('active','inactive') NOT NULL DEFAULT 'active',
    tags json,
    notes text,
    created_by int,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await connection.execute(`CREATE TABLE IF NOT EXISTS account_brand_recovery_runs (
    recoveryKey varchar(100) NOT NULL,
    status varchar(20) NOT NULL,
    details json DEFAULT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    PRIMARY KEY(recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await connection.execute(`CREATE TABLE IF NOT EXISTS platform_account_projection_archive (
    original_id int NOT NULL,
    platform varchar(100) NOT NULL,
    account_name varchar(255) NOT NULL,
    account_id varchar(255),
    password text,
    login_url text,
    email varchar(320),
    phone varchar(50),
    responsible varchar(255),
    status varchar(20) NOT NULL,
    expires_at timestamp NULL,
    tags json,
    notes text,
    created_by int,
    original_created_at timestamp NULL,
    original_updated_at timestamp NULL,
    classification_key varchar(100) NOT NULL,
    archived_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(original_id),
    KEY idx_projection_archive_classification(classification_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(connection: Connection): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs"
  );
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(
  connection: Connection,
  reason: string
): Promise<void> {
  const before = await latestBackupId(connection);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT status, errorMessage
       FROM db_backup_runs
      WHERE id > ? AND reason = ?
      ORDER BY id DESC
      LIMIT 1`,
    [before, reason]
  );
  if (rows[0]?.status !== "success") {
    throw new Error(
      `database backup failed for ${reason}: ${String(rows[0]?.errorMessage || "not-recorded")}`
    );
  }
}

async function archiveMisclassifiedPlatformProjections(
  connection: Connection
): Promise<{ before: number; archived: number; removed: number; remainingManual: number }> {
  const [beforeRows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM platform_accounts WHERE notes LIKE ?",
    [`%${SOURCE_PREFIX}%`]
  );
  const before = Number(beforeRows[0]?.count || 0);

  await connection.beginTransaction();
  try {
    const [archiveResult] = await connection.execute<mysql.ResultSetHeader>(
      `INSERT IGNORE INTO platform_account_projection_archive
        (original_id, platform, account_name, account_id, password, login_url, email, phone,
         responsible, status, expires_at, tags, notes, created_by, original_created_at,
         original_updated_at, classification_key, archived_at)
       SELECT id, platform, account_name, account_id, password, login_url, email, phone,
              responsible, status, expires_at, tags, notes, created_by, created_at, updated_at,
              ?, CURRENT_TIMESTAMP
         FROM platform_accounts
        WHERE notes LIKE ?`,
      [CLASSIFICATION_KEY, `%${SOURCE_PREFIX}%`]
    );
    const [deleteResult] = await connection.execute<mysql.ResultSetHeader>(
      "DELETE FROM platform_accounts WHERE notes LIKE ?",
      [`%${SOURCE_PREFIX}%`]
    );
    await connection.commit();

    const [remainingRows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM platform_accounts"
    );
    const removed = Number(deleteResult.affectedRows || 0);
    if (removed !== before) {
      throw new Error(
        `projection archive verification failed: before=${before}, removed=${removed}`
      );
    }
    return {
      before,
      archived: Number(archiveResult.affectedRows || 0),
      removed,
      remainingManual: Number(remainingRows[0]?.count || 0),
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  }
}

async function upsertContact(
  connection: Connection,
  seed: ContactSeed,
  createdBy: number | null
): Promise<"inserted" | "updated"> {
  const marker = `${SOURCE_PREFIX}${seed.source}`;
  const notes = `${marker}\n${seed.notes}`.slice(0, 4000);
  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM contact_info WHERE notes LIKE ? ORDER BY id LIMIT 1",
    [`%${marker}%`]
  );
  const values = [
    seed.category,
    seed.companyName,
    seed.contactName,
    seed.position,
    seed.email,
    seed.phone,
    seed.wechat,
    seed.lineId,
    seed.address,
    seed.responsible,
    seed.status,
    JSON.stringify(seed.tags),
    notes,
    createdBy,
  ];
  if (existing[0]?.id) {
    await connection.execute(
      `UPDATE contact_info
          SET category=?, company_name=?, contact_name=?, position=?, email=?, phone=?,
              wechat=?, line_id=?, address=?, responsible=?, status=?, tags=?, notes=?,
              created_by=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?`,
      [...values, Number(existing[0].id)]
    );
    return "updated";
  }
  await connection.execute(
    `INSERT INTO contact_info
      (category, company_name, contact_name, position, email, phone, wechat, line_id,
       address, responsible, status, tags, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    values
  );
  return "inserted";
}

async function loadContactSeeds(connection: Connection): Promise<ContactSeed[]> {
  const contactSeeds: ContactSeed[] = [];

  const [brandRows] = await connection.query<RowDataPacket[]>(`
    SELECT id, name, status, larkRecordId, larkCategory, larkContactPlatform,
           larkBrandManager, larkBusinessContact, larkBusinessLead, larkOperationsContact
      FROM brands
     WHERE deletedAt IS NULL
     ORDER BY id
  `);
  for (const row of brandRows) {
    const brandName = text(row.name) || `Brand ${row.id}`;
    const responsibleNames = uniqueText([
      row.larkBrandManager,
      row.larkBusinessContact,
      row.larkBusinessLead,
      row.larkOperationsContact,
    ]);
    if (responsibleNames.length > 0) {
      contactSeeds.push({
        source: `lark-brand:${row.id}`,
        category: "brand",
        companyName: brandName,
        contactName: responsibleNames.join(", "),
        position: "Larkブランド担当者",
        email: null,
        phone: null,
        wechat: text(row.larkContactPlatform)?.toLowerCase().includes("微信")
          ? text(row.larkContactPlatform)
          : null,
        lineId: null,
        address: null,
        responsible: text(row.larkBusinessLead) || text(row.larkBrandManager),
        status: row.status === "終了" ? "inactive" : "active",
        tags: uniqueText(["Lark", "ブランド", row.larkCategory]),
        notes: `Larkブランド担当者情報から再構築。Lark record: ${text(row.larkRecordId) || "なし"}`,
      });
    }
  }

  const [liverRows] = await connection.query<RowDataPacket[]>(`
    SELECT id, name, email, lineUserId, uid, isActive
      FROM livers
     ORDER BY id
  `);
  for (const row of liverRows) {
    contactSeeds.push({
      source: `liver:${row.id}`,
      category: "partner",
      companyName: null,
      contactName: text(row.name) || `Liver ${row.id}`,
      position: "ライバー",
      email: text(row.email),
      phone: null,
      wechat: null,
      lineId: text(row.lineUserId),
      address: null,
      responsible: null,
      status: row.isActive ? "active" : "inactive",
      tags: ["ライバー", "現行マスター"],
      notes: `ライバーマスターから再構築。UID: ${text(row.uid) || "なし"}`,
    });
  }

  const [companyRows] = await connection.query<RowDataPacket[]>(`
    SELECT id, company_name, contact_name, contact_department, address, phone, email,
           website_url, line_or_lark, status
      FROM festival_company_applications
     ORDER BY id
  `);
  for (const row of companyRows) {
    contactSeeds.push({
      source: `festival-company:${row.id}`,
      category: "brand",
      companyName: text(row.company_name),
      contactName:
        text(row.contact_name) || text(row.company_name) || `Company ${row.id}`,
      position: text(row.contact_department),
      email: text(row.email),
      phone: text(row.phone),
      wechat: text(row.line_or_lark)?.toLowerCase().includes("wechat")
        ? text(row.line_or_lark)
        : null,
      lineId: text(row.line_or_lark),
      address: text(row.address),
      responsible: null,
      status:
        row.status === "cancelled" || row.status === "rejected"
          ? "inactive"
          : "active",
      tags: ["Live Commerce Festival", "企業"],
      notes: `企業申込から再構築。Website: ${text(row.website_url) || "なし"}`,
    });
  }

  const [festivalLiverRows] = await connection.query<RowDataPacket[]>(`
    SELECT id, name, liver_name, agency, account_info, email, phone, line_or_lark, status
      FROM festival_liver_applications
     ORDER BY id
  `);
  for (const row of festivalLiverRows) {
    const accountInfo = text(row.account_info);
    contactSeeds.push({
      source: `festival-liver:${row.id}`,
      category: "partner",
      companyName: text(row.agency),
      contactName:
        text(row.name) || text(row.liver_name) || `Festival Liver ${row.id}`,
      position: text(row.liver_name)
        ? `ライバー名: ${text(row.liver_name)}`
        : "ライバー",
      email: text(row.email),
      phone: text(row.phone),
      wechat: text(row.line_or_lark)?.toLowerCase().includes("wechat")
        ? text(row.line_or_lark)
        : null,
      lineId: text(row.line_or_lark),
      address: null,
      responsible: null,
      status:
        row.status === "cancelled" || row.status === "rejected"
          ? "inactive"
          : "active",
      tags: ["Live Commerce Festival", "ライバー"],
      notes: `ライバー申込から再構築。SNS: ${accountInfo || "なし"}`,
    });
  }

  const [generalRows] = await connection.query<RowDataPacket[]>(`
    SELECT id, participation_type, company_name, department, name, email, phone, status
      FROM festival_general_applications
     ORDER BY id
  `);
  for (const row of generalRows) {
    contactSeeds.push({
      source: `festival-general:${row.id}`,
      category: row.participation_type === "corporate" ? "client" : "other",
      companyName: text(row.company_name),
      contactName: text(row.name) || `Festival Guest ${row.id}`,
      position: text(row.department),
      email: text(row.email),
      phone: text(row.phone),
      wechat: null,
      lineId: null,
      address: null,
      responsible: null,
      status:
        row.status === "cancelled" || row.status === "rejected"
          ? "inactive"
          : "active",
      tags: ["Live Commerce Festival", "一般来場"],
      notes: "Live Commerce Festival一般来場申込から再構築。",
    });
  }

  // ブランド、Shop ID、ライバーSNS、Festival申込は各原本テーブルとCRMに保持する。
  // platform_accounts へ投影するコード経路は存在させない。
  return contactSeeds;
}

function normalizeLarkBrandName(value: string): string {
  return value
    .trim()
    .replace(/[\(（].*?[\)）]/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, character =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0)
    )
    .toLowerCase()
    .replace(/[\s\u3000.\-_・]+/g, "");
}

function larkCompleteness(row: LarkBrandData): number {
  return [
    row.intro,
    row.stage,
    row.tier,
    row.category,
    row.contactPlatform,
    row.brandManager,
    row.businessContact,
    row.businessLead,
    row.operationsContact,
    row.shopId,
  ].filter(Boolean).length;
}

export async function reconcileLarkBrandEntities(
  rows: LarkBrandData[]
): Promise<{ expected: number; created: number; renamed: number }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for Lark brand reconciliation");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const groups = new Map<string, LarkBrandData[]>();
    for (const row of rows) {
      if (
        !row.brandName ||
        row.brandName === "Unknown" ||
        row.brandName.length > 80 ||
        row.brandName.includes("<") ||
        row.brandName.includes("＜")
      ) {
        continue;
      }
      const key = normalizeLarkBrandName(row.brandName);
      if (!key) continue;
      const group = groups.get(key) || [];
      group.push(row);
      groups.set(key, group);
    }

    const [ownerRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE LOWER(email) = 'ryuhairartist@gmail.com' ORDER BY id LIMIT 1"
    );
    const createdBy = ownerRows[0]?.id ? Number(ownerRows[0].id) : 1;
    const [brandRows] = await connection.query<RowDataPacket[]>(`
      SELECT id, name, larkRecordId
        FROM brands
       WHERE deletedAt IS NULL
       ORDER BY id
    `);
    const byName = new Map<string, RowDataPacket>();
    const byRecordId = new Map<string, RowDataPacket>();
    for (const row of brandRows) {
      byName.set(normalizeLarkBrandName(String(row.name || "")), row);
      if (row.larkRecordId) byRecordId.set(String(row.larkRecordId), row);
    }
    const larkKeys = new Set(groups.keys());
    let created = 0;
    let renamed = 0;

    await connection.beginTransaction();
    try {
      for (const [key, group] of groups) {
        if (byName.has(key)) continue;
        const canonical = [...group].sort(
          (left, right) => larkCompleteness(right) - larkCompleteness(left)
        )[0];
        const safeRecordCandidate = group
          .map(row => byRecordId.get(row.recordId))
          .find(candidate => {
            if (!candidate) return false;
            const oldKey = normalizeLarkBrandName(String(candidate.name || ""));
            return oldKey !== key && !larkKeys.has(oldKey);
          });
        const larkValues = [
          canonical.brandName,
          mapLarkStageToStatus(canonical.stage),
          canonical.category,
          canonical.recordId,
          canonical.stage,
          canonical.tier,
          canonical.category,
          canonical.contactPlatform,
          canonical.brandManager,
          canonical.businessContact,
          canonical.businessLead,
          canonical.operationsContact,
          canonical.shopId,
          canonical.intro,
        ];

        if (safeRecordCandidate) {
          await connection.execute(
            `UPDATE brands
                SET name=?, status=?, materialCategory=?, larkRecordId=?, larkStage=?, larkTier=?,
                    larkCategory=?, larkContactPlatform=?, larkBrandManager=?, larkBusinessContact=?,
                    larkBusinessLead=?, larkOperationsContact=?, larkShopId=?, larkIntro=?,
                    larkSyncedAt=CURRENT_TIMESTAMP, deletedAt=NULL, updatedAt=CURRENT_TIMESTAMP
              WHERE id=?`,
            [...larkValues, Number(safeRecordCandidate.id)]
          );
          safeRecordCandidate.name = canonical.brandName;
          safeRecordCandidate.larkRecordId = canonical.recordId;
          byName.set(key, safeRecordCandidate);
          byRecordId.set(canonical.recordId, safeRecordCandidate);
          renamed += 1;
        } else {
          const [result] = await connection.execute<mysql.ResultSetHeader>(
            `INSERT INTO brands
              (name, nameJa, status, materialCategory, larkRecordId, larkStage, larkTier,
               larkCategory, larkContactPlatform, larkBrandManager, larkBusinessContact,
               larkBusinessLead, larkOperationsContact, larkShopId, larkIntro,
               larkSyncedAt, createdBy, createdAt, updatedAt, deletedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?,
                     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)`,
            [canonical.brandName, ...larkValues, createdBy]
          );
          const inserted = {
            id: result.insertId,
            name: canonical.brandName,
            larkRecordId: canonical.recordId,
          } as RowDataPacket;
          byName.set(key, inserted);
          byRecordId.set(canonical.recordId, inserted);
          created += 1;
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    return { expected: groups.size, created, renamed };
  } finally {
    await connection.end();
  }
}

export async function syncBrandContactProjectionsFromCurrentSources(): Promise<ProjectionResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for account/brand projections");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureTables(connection);
    const [ownerRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE LOWER(email) = 'ryuhairartist@gmail.com' ORDER BY id LIMIT 1"
    );
    const createdBy = ownerRows[0]?.id ? Number(ownerRows[0].id) : null;
    const contactSeeds = await loadContactSeeds(connection);
    let contactInserted = 0;
    let contactUpdated = 0;

    await connection.beginTransaction();
    try {
      for (const seed of contactSeeds) {
        const result = await upsertContact(connection, seed, createdBy);
        if (result === "inserted") contactInserted += 1;
        else contactUpdated += 1;
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    return {
      expectedPlatformSources: 0,
      expectedContactSources: contactSeeds.length,
      platformInserted: 0,
      platformUpdated: 0,
      contactInserted,
      contactUpdated,
    };
  } finally {
    await connection.end();
  }
}

async function getRecoveryCounts(connection: Connection) {
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM brands WHERE deletedAt IS NULL) AS visibleBrands,
      (SELECT COUNT(*) FROM platform_accounts) AS platformAccounts,
      (SELECT COUNT(*) FROM platform_accounts WHERE notes LIKE '%${SOURCE_PREFIX}%') AS recoveredPlatformAccounts,
      (SELECT COUNT(*) FROM platform_account_projection_archive) AS archivedPlatformProjections,
      (SELECT COUNT(*) FROM contact_info) AS contacts,
      (SELECT COUNT(*) FROM contact_info WHERE notes LIKE '%${SOURCE_PREFIX}%') AS recoveredContacts
  `);
  const row = rows[0] || {};
  return {
    visibleBrands: Number(row.visibleBrands || 0),
    platformAccounts: Number(row.platformAccounts || 0),
    recoveredPlatformAccounts: Number(row.recoveredPlatformAccounts || 0),
    archivedPlatformProjections: Number(row.archivedPlatformProjections || 0),
    contacts: Number(row.contacts || 0),
    recoveredContacts: Number(row.recoveredContacts || 0),
  };
}

export async function getAccountBrandDataRecoveryHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for account/brand recovery health"
    );
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureTables(connection);
    const counts = await getRecoveryCounts(connection);
    const [runs] = await connection.query<RowDataPacket[]>(
      `SELECT status, details, startedAt, completedAt
         FROM account_brand_recovery_runs
        WHERE recoveryKey = ?
        LIMIT 1`,
      [RECOVERY_KEY]
    );
    const [backups] = await connection.query<RowDataPacket[]>(
      `SELECT reason, status, tableCount, rowCount, startedAt, completedAt
         FROM db_backup_runs
        WHERE reason IN (?, ?)
        ORDER BY id DESC
        LIMIT 4`,
      [PRE_CLASSIFICATION_BACKUP_REASON, POST_CLASSIFICATION_BACKUP_REASON]
    );
    return {
      recoveryKey: RECOVERY_KEY,
      counts,
      latestRun: runs[0] || null,
      backups: backups.map(row => ({
        reason: String(row.reason || ""),
        status: String(row.status || ""),
        tableCount: Number(row.tableCount || 0),
        rowCount: Number(row.rowCount || 0),
        startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
        completedAt: row.completedAt
          ? new Date(row.completedAt).toISOString()
          : null,
      })),
    };
  } finally {
    await connection.end();
  }
}

export async function runAccountBrandDataRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for account/brand recovery");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureTables(connection);
    let liveLarkRows: LarkBrandData[] = [];
    let larkFetchError: string | null = null;
    try {
      liveLarkRows = await fetchFeishuBrands();
    } catch (error) {
      larkFetchError = error instanceof Error ? error.message : String(error);
      console.error("[AccountBrandRecovery] Lark fetch unavailable; continuing local classification", error);
    }
    const validBrandNames = new Set(
      liveLarkRows
        .filter(
          row =>
            row.brandName &&
            row.brandName !== "Unknown" &&
            row.brandName.length <= 80
        )
        .filter(
          row => !row.brandName.includes("<") && !row.brandName.includes("＜")
        )
        .map(row =>
          row.brandName
            .trim()
            .replace(/[\(（].*?[\)）]/g, "")
            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, character =>
              String.fromCharCode(character.charCodeAt(0) - 0xfee0)
            )
            .toLowerCase()
            .replace(/[\s\u3000.\-_・]+/g, "")
        )
        .filter(Boolean)
    );
    const expectedBrands = validBrandNames.size;
    const before = await getRecoveryCounts(connection);
    const hasSuccessfulRun = await connection
      .query<
        RowDataPacket[]
      >("SELECT status FROM account_brand_recovery_runs WHERE recoveryKey = ? LIMIT 1", [RECOVERY_KEY])
      .then(([rows]) => rows[0]?.status === "success");

    if (
      hasSuccessfulRun &&
      before.visibleBrands >= expectedBrands &&
      before.recoveredPlatformAccounts === 0 &&
      before.recoveredContacts > 0
    ) {
      // 正常時はCRM連絡先のみ最新化する。外部同期失敗は分類済み状態を壊さない。
      let syncResult: unknown = null;
      try {
        const { runFeishuSync } = await import("./feishuSyncScheduler");
        syncResult = await runFeishuSync("auto");
      } catch (error) {
        syncResult = { error: error instanceof Error ? error.message : String(error) };
      }
      console.log(
        `[AccountBrandRecovery] healthy and refreshed ${JSON.stringify({ before, larkFetchError, syncResult })}`
      );
      return;
    }

    await connection.execute(
      `INSERT INTO account_brand_recovery_runs
        (recoveryKey, status, details, startedAt, completedAt)
       VALUES (?, 'running', ?, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE status='running', details=VALUES(details), startedAt=CURRENT_TIMESTAMP, completedAt=NULL`,
      [
        RECOVERY_KEY,
        JSON.stringify({
          before,
          expectedBrands,
          larkRecords: liveLarkRows.length,
          larkFetchError,
        }),
      ]
    );

    await runVerifiedBackup(connection, PRE_CLASSIFICATION_BACKUP_REASON);
    const classification = await archiveMisclassifiedPlatformProjections(connection);

    const { runFeishuSync } = await import("./feishuSyncScheduler");
    let larkSync: Awaited<ReturnType<typeof runFeishuSync>> | null = null;
    let larkSyncError: string | null = null;
    try {
      larkSync = await runFeishuSync("manual");
    } catch (error) {
      larkSyncError = error instanceof Error ? error.message : String(error);
      console.error("[AccountBrandRecovery] Lark sync unavailable; continuing contact projection", error);
    }
    const projection =
      larkSync?.projection ||
      (await syncBrandContactProjectionsFromCurrentSources());
    const after = await getRecoveryCounts(connection);

    if (expectedBrands > 0 && after.visibleBrands < expectedBrands) {
      throw new Error(
        `brand verification failed: actual=${after.visibleBrands}, expected=${expectedBrands}`
      );
    }
    if (after.recoveredPlatformAccounts !== 0 || projection.expectedPlatformSources !== 0) {
      throw new Error(
        `platform classification verification failed: recovered=${after.recoveredPlatformAccounts}, expectedSources=${projection.expectedPlatformSources}`
      );
    }
    if (after.recoveredContacts < projection.expectedContactSources) {
      throw new Error(
        `contact verification failed: actual=${after.recoveredContacts}, expected=${projection.expectedContactSources}`
      );
    }

    await runVerifiedBackup(connection, POST_CLASSIFICATION_BACKUP_REASON);

    const details = {
      before,
      after,
      expectedBrands,
      classification,
      larkFetchError,
      larkSyncError,
      larkSync,
      projection,
    };
    await connection.execute(
      `UPDATE account_brand_recovery_runs
          SET status='success', details=?, completedAt=CURRENT_TIMESTAMP
        WHERE recoveryKey=?`,
      [JSON.stringify(details), RECOVERY_KEY]
    );
    console.log(`[AccountBrandRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await connection
      .execute(
        `UPDATE account_brand_recovery_runs
            SET status='failed', details=?, completedAt=CURRENT_TIMESTAMP
          WHERE recoveryKey=?`,
        [JSON.stringify({ error: message.slice(0, 3000) }), RECOVERY_KEY]
      )
      .catch(() => undefined);
    console.error("[AccountBrandRecovery] failed", error);
    throw error;
  } finally {
    await connection.end();
  }
}
