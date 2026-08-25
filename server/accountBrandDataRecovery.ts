import crypto from "node:crypto";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import {
  fetchFeishuBrands,
  mapLarkStageToStatus,
  type LarkBrandData,
} from "./feishuService";

const RECOVERY_KEY = "account-brand-lark-recovery-v1-2026-08-26";
const PRE_BACKUP_REASON = "pre-account-brand-lark-v1";
const POST_BACKUP_REASON = "post-account-brand-lark-v1";
const SOURCE_PREFIX = "recovery_source=";

type PlatformStatus = "active" | "inactive" | "expired" | "suspended";
type ContactCategory = "brand" | "client" | "partner" | "supplier" | "other";

type PlatformSeed = {
  source: string;
  platform: string;
  accountName: string;
  accountId: string | null;
  loginUrl: string | null;
  email: string | null;
  phone: string | null;
  responsible: string | null;
  status: PlatformStatus;
  tags: string[];
  notes: string;
};

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

function sourceHash(scope: string, value: string): string {
  return `${scope}:${crypto.createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

function parsePlatform(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("instagram") || lower.includes("インスタ"))
    return "Instagram";
  if (lower.includes("youtube")) return "YouTube";
  if (lower.includes("line")) return "LINE";
  if (lower.includes("twitter") || lower.includes("x.com")) return "X";
  return "TikTok";
}

function profileUrl(platform: string, accountId: string | null): string | null {
  if (!accountId) return null;
  if (/^https?:\/\//i.test(accountId)) return accountId;
  const handle = accountId.replace(/^@/, "").trim();
  if (!handle || /[\s,，、]/.test(handle)) return null;
  if (platform === "TikTok") return `https://www.tiktok.com/@${handle}`;
  if (platform === "Instagram") return `https://www.instagram.com/${handle}/`;
  if (platform === "YouTube") return `https://www.youtube.com/@${handle}`;
  return null;
}

function accountKey(seed: PlatformSeed): string {
  return `${seed.platform.toLowerCase()}|${String(
    seed.accountId || seed.accountName
  )
    .trim()
    .toLowerCase()}`;
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

async function upsertPlatformAccount(
  connection: Connection,
  seed: PlatformSeed,
  createdBy: number | null
): Promise<"inserted" | "updated"> {
  const marker = `${SOURCE_PREFIX}${seed.source}`;
  const notes = `${marker}\n${seed.notes}`.slice(0, 4000);
  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM platform_accounts WHERE notes LIKE ? ORDER BY id LIMIT 1",
    [`%${marker}%`]
  );
  const values = [
    seed.platform,
    seed.accountName,
    seed.accountId,
    seed.loginUrl,
    seed.email,
    seed.phone,
    seed.responsible,
    seed.status,
    JSON.stringify(seed.tags),
    notes,
    createdBy,
  ];
  if (existing[0]?.id) {
    await connection.execute(
      `UPDATE platform_accounts
          SET platform=?, account_name=?, account_id=?, login_url=?, email=?, phone=?,
              responsible=?, status=?, tags=?, notes=?, created_by=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?`,
      [...values, Number(existing[0].id)]
    );
    return "updated";
  }
  await connection.execute(
    `INSERT INTO platform_accounts
      (platform, account_name, account_id, password, login_url, email, phone, responsible,
       status, expires_at, tags, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    values
  );
  return "inserted";
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

async function loadProjectionSeeds(connection: Connection): Promise<{
  platformSeeds: PlatformSeed[];
  contactSeeds: ContactSeed[];
}> {
  const platformSeeds: PlatformSeed[] = [];
  const contactSeeds: ContactSeed[] = [];

  const [brandRows] = await connection.query<RowDataPacket[]>(`
    SELECT id, name, status, larkRecordId, larkShopId, larkCategory, larkContactPlatform,
           larkBrandManager, larkBusinessContact, larkBusinessLead, larkOperationsContact
      FROM brands
     WHERE deletedAt IS NULL
     ORDER BY id
  `);
  const seenShopIds = new Set<string>();
  for (const row of brandRows) {
    const shopId = text(row.larkShopId);
    const brandName = text(row.name) || `Brand ${row.id}`;
    const responsibleNames = uniqueText([
      row.larkBrandManager,
      row.larkBusinessContact,
      row.larkBusinessLead,
      row.larkOperationsContact,
    ]);
    if (shopId && !seenShopIds.has(shopId.toLowerCase())) {
      seenShopIds.add(shopId.toLowerCase());
      platformSeeds.push({
        source: sourceHash("lark-shop", shopId.toLowerCase()),
        platform: "TikTok Shop",
        accountName: brandName,
        accountId: shopId,
        loginUrl: "https://seller-jp.tiktok.com/",
        email: null,
        phone: null,
        responsible: responsibleNames.join(", ") || null,
        status: row.status === "終了" ? "inactive" : "active",
        tags: uniqueText(["Lark", "TikTok Shop", row.larkCategory]),
        notes: `Larkブランド同期から再構築。Lark record: ${text(row.larkRecordId) || "なし"}`,
      });
    }
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
    SELECT id, name, email, tiktokAccount, instagramAccount, youtubeAccount, otherAccount,
           lineUserId, uid, isActive
      FROM livers
     ORDER BY id
  `);
  for (const row of liverRows) {
    const socialAccounts = [
      ["TikTok", text(row.tiktokAccount)],
      ["Instagram", text(row.instagramAccount)],
      ["YouTube", text(row.youtubeAccount)],
      ["Other", text(row.otherAccount)],
    ] as const;
    for (const [platform, accountId] of socialAccounts) {
      if (!accountId) continue;
      platformSeeds.push({
        source: `liver-${platform.toLowerCase()}:${row.id}`,
        platform,
        accountName: text(row.name) || accountId,
        accountId,
        loginUrl: profileUrl(platform, accountId),
        email: text(row.email),
        phone: null,
        responsible: text(row.name),
        status: row.isActive ? "active" : "inactive",
        tags: ["ライバー", platform],
        notes: `ライバーマスターから再構築。UID: ${text(row.uid) || "なし"}`,
      });
    }
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
           website_url, line_or_lark, tiktok_shop_seller_name, tiktok_shop_url, status
      FROM festival_company_applications
     ORDER BY id
  `);
  const seenFestivalSellers = new Set<string>();
  for (const row of companyRows) {
    const sellerName = text(row.tiktok_shop_seller_name);
    if (sellerName) {
      const sellerKey = sellerName.toLowerCase();
      if (!seenFestivalSellers.has(sellerKey)) {
        seenFestivalSellers.add(sellerKey);
        platformSeeds.push({
          source: sourceHash("festival-company-shop", sellerKey),
          platform: "TikTok Shop",
          accountName: sellerName,
          accountId: sellerName,
          loginUrl:
            text(row.tiktok_shop_url) || "https://seller-jp.tiktok.com/",
          email: text(row.email),
          phone: text(row.phone),
          responsible: text(row.contact_name),
          status:
            row.status === "cancelled" || row.status === "rejected"
              ? "inactive"
              : "active",
          tags: ["Live Commerce Festival", "TikTok Shop"],
          notes: "Live Commerce Festival企業申込から再構築。",
        });
      }
    }
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
  const seenFestivalAccounts = new Set<string>();
  for (const row of festivalLiverRows) {
    const accountInfo = text(row.account_info);
    if (accountInfo) {
      const platform = parsePlatform(accountInfo);
      const key = `${platform.toLowerCase()}|${accountInfo.toLowerCase()}`;
      if (!seenFestivalAccounts.has(key)) {
        seenFestivalAccounts.add(key);
        platformSeeds.push({
          source: sourceHash("festival-liver-account", key),
          platform,
          accountName: text(row.liver_name) || text(row.name) || accountInfo,
          accountId: accountInfo,
          loginUrl: profileUrl(platform, accountInfo),
          email: text(row.email),
          phone: text(row.phone),
          responsible: text(row.name),
          status:
            row.status === "cancelled" || row.status === "rejected"
              ? "inactive"
              : "active",
          tags: ["Live Commerce Festival", "ライバー"],
          notes: "Live Commerce Festivalライバー申込から再構築。",
        });
      }
    }
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

  const seenAccounts = new Set<string>();
  const deduplicatedPlatformSeeds = platformSeeds.filter(seed => {
    const key = accountKey(seed);
    if (seenAccounts.has(key)) return false;
    seenAccounts.add(key);
    return true;
  });

  return { platformSeeds: deduplicatedPlatformSeeds, contactSeeds };
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

export async function syncAccountBrandProjectionsFromCurrentSources(): Promise<ProjectionResult> {
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
    const { platformSeeds, contactSeeds } =
      await loadProjectionSeeds(connection);
    let platformInserted = 0;
    let platformUpdated = 0;
    let contactInserted = 0;
    let contactUpdated = 0;

    await connection.beginTransaction();
    try {
      for (const seed of platformSeeds) {
        const result = await upsertPlatformAccount(connection, seed, createdBy);
        if (result === "inserted") platformInserted += 1;
        else platformUpdated += 1;
      }
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
      expectedPlatformSources: platformSeeds.length,
      expectedContactSources: contactSeeds.length,
      platformInserted,
      platformUpdated,
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
      (SELECT COUNT(*) FROM contact_info) AS contacts,
      (SELECT COUNT(*) FROM contact_info WHERE notes LIKE '%${SOURCE_PREFIX}%') AS recoveredContacts
  `);
  const row = rows[0] || {};
  return {
    visibleBrands: Number(row.visibleBrands || 0),
    platformAccounts: Number(row.platformAccounts || 0),
    recoveredPlatformAccounts: Number(row.recoveredPlatformAccounts || 0),
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
      [PRE_BACKUP_REASON, POST_BACKUP_REASON]
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
    const liveLarkRows = await fetchFeishuBrands();
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
      before.recoveredPlatformAccounts > 0 &&
      before.recoveredContacts > 0
    ) {
      // 正常時も起動直後に最新Lark・SNS・申込データを反映する。
      // これにより定期同期の初回実行（5分後）を待たず、画面が最新件数になる。
      const { runFeishuSync } = await import("./feishuSyncScheduler");
      const syncResult = await runFeishuSync("auto");
      console.log(
        `[AccountBrandRecovery] healthy and refreshed ${JSON.stringify({ before, syncResult })}`
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
        }),
      ]
    );

    await runVerifiedBackup(connection, PRE_BACKUP_REASON);

    const { runFeishuSync } = await import("./feishuSyncScheduler");
    const larkSync = await runFeishuSync("manual");
    const projection =
      larkSync.projection ||
      (await syncAccountBrandProjectionsFromCurrentSources());
    const after = await getRecoveryCounts(connection);

    if (after.visibleBrands < expectedBrands) {
      throw new Error(
        `brand verification failed: actual=${after.visibleBrands}, expected=${expectedBrands}`
      );
    }
    if (after.recoveredPlatformAccounts < projection.expectedPlatformSources) {
      throw new Error(
        `platform account verification failed: actual=${after.recoveredPlatformAccounts}, expected=${projection.expectedPlatformSources}`
      );
    }
    if (after.recoveredContacts < projection.expectedContactSources) {
      throw new Error(
        `contact verification failed: actual=${after.recoveredContacts}, expected=${projection.expectedContactSources}`
      );
    }

    await runVerifiedBackup(connection, POST_BACKUP_REASON);

    const details = { before, after, expectedBrands, larkSync, projection };
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
