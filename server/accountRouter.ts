import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { eq, desc, like, or, and, sql, notLike, isNull } from "drizzle-orm";
import {
  platformAccounts,
  contactInfo,
  accountReferenceLinks,
  accountWorkbookImports,
} from "../drizzle/schema";
import {
  decryptAccountSecret,
  encryptAccountSecret,
  isEncryptedAccountSecret,
} from "./accountCredentialCrypto";
import {
  ACCOUNT_WORKBOOK_MAX_BYTES,
  parseAccountWorkbook,
  safeAccountWorkbookPreview,
} from "./accountWorkbookImport";
import { upgradeAccountManagementForWorkbookImport } from "./migrations/upgradeAccountManagementForWorkbookImport";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const ACCOUNT_PAGE_KEY = "/master/account-management";
const RECOVERY_PROJECTION_MARKER = "%recovery_source=%";
const credentialRecordCondition = () =>
  or(
    isNull(platformAccounts.notes),
    notLike(platformAccounts.notes, RECOVERY_PROJECTION_MARKER),
  );

function rowArray(result: unknown): any[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as any[];
  if (Array.isArray(result)) return result as any[];
  return [];
}

async function requireAccountPermission(
  ctx: { user: { id: number; role?: string | null } },
  mode: "view" | "edit",
): Promise<void> {
  const db = await getDb();
  const assignmentResult = await db.execute(sql`
    SELECT ura.roleId, r.name AS roleName
      FROM user_role_assignments ura
      JOIN system_roles r ON r.id = ura.roleId
     WHERE ura.userId = ${ctx.user.id}
     LIMIT 1
  `);
  const assignment = rowArray(assignmentResult)[0];
  const roleName = String(assignment?.roleName || "");
  const isSuperRole = roleName.includes("超级") || roleName.includes("スーパー");

  if (ctx.user.role === "admin" && (!assignment || isSuperRole)) return;
  if (!assignment?.roleId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "アカウント管理権限がありません / 无账号管理权限" });
  }

  const permissionResult = await db.execute(sql`
    SELECT canView, canEdit
      FROM role_permissions
     WHERE roleId = ${Number(assignment.roleId)}
       AND pageKey = ${ACCOUNT_PAGE_KEY}
     LIMIT 1
  `);
  const permission = rowArray(permissionResult)[0];
  const allowed = mode === "edit" ? Boolean(permission?.canEdit) : Boolean(permission?.canView || permission?.canEdit);
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "アカウント管理権限がありません / 无账号管理权限" });
  }
}

function decodeWorkbookBase64(value: string): Buffer {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "XLSXデータが正しくありません / XLSX数据无效" });
  }
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0 || buffer.length > ACCOUNT_WORKBOOK_MAX_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "XLSXは5MB以下にしてください / XLSX文件不得超过5MB" });
  }
  return buffer;
}

function presentAccount(account: typeof platformAccounts.$inferSelect) {
  try {
    return {
      ...account,
      password: decryptAccountSecret(account.password),
      passwordEncryptedAtRest: isEncryptedAccountSecret(account.password),
      passwordUnreadable: false,
    };
  } catch (error) {
    console.error(`[AccountRouter] Failed to decrypt account ${account.id}:`, error);
    return {
      ...account,
      password: null,
      passwordEncryptedAtRest: true,
      passwordUnreadable: true,
    };
  }
}

let tablesInitialized = false;
async function ensureTables() {
  if (tablesInitialized) return;
  try {
    const db = await getDb();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`platform_accounts\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`platform\` varchar(100) NOT NULL,
      \`account_name\` varchar(255) NOT NULL,
      \`account_id\` varchar(255),
      \`password\` text,
      \`login_url\` text,
      \`email\` varchar(320),
      \`phone\` varchar(50),
      \`responsible\` varchar(255),
      \`status\` enum('active','inactive','expired','suspended') NOT NULL DEFAULT 'active',
      \`expires_at\` timestamp NULL,
      \`tags\` json,
      \`notes\` text,
      \`source_key\` varchar(191),
      \`source_file_hash\` varchar(64),
      \`source_rows\` json,
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`),
      UNIQUE KEY \`unique_platform_accounts_source_key\` (\`source_key\`),
      KEY \`idx_platform_accounts_source_hash\` (\`source_file_hash\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`contact_info\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`category\` enum('brand','client','partner','supplier','other') NOT NULL DEFAULT 'client',
      \`company_name\` varchar(255),
      \`contact_name\` varchar(255) NOT NULL,
      \`position\` varchar(255),
      \`email\` varchar(320),
      \`phone\` varchar(50),
      \`wechat\` varchar(255),
      \`line_id\` varchar(255),
      \`address\` text,
      \`responsible\` varchar(255),
      \`status\` enum('active','inactive') NOT NULL DEFAULT 'active',
      \`tags\` json,
      \`notes\` text,
      \`source_key\` varchar(191),
      \`source_file_hash\` varchar(64),
      \`source_rows\` json,
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`),
      UNIQUE KEY \`unique_contact_info_source_key\` (\`source_key\`),
      KEY \`idx_contact_info_source_hash\` (\`source_file_hash\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await upgradeAccountManagementForWorkbookImport(db);
    tablesInitialized = true;
    console.log("[AccountRouter] Tables ensured.");
  } catch (error) {
    console.error("[AccountRouter] Table init error:", error);
    throw error;
  }
}

const workbookInput = z.object({
  fileName: z.string().min(1).max(255).refine(value => /\.xlsx$/i.test(value), "XLSX only"),
  fileBase64: z.string().min(4).max(Math.ceil(ACCOUNT_WORKBOOK_MAX_BYTES * 4 / 3) + 16),
});

export const accountRouter = router({
  listAccounts: protectedProcedure
    .input(z.object({
      search: z.string().max(200).optional(),
      platform: z.string().max(100).optional(),
      status: z.enum(["active", "inactive", "expired", "suspended"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "view");
      await ensureTables();
      const db = await getDb();
      const conditions: any[] = [credentialRecordCondition()];
      if (input?.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(or(
          like(platformAccounts.accountName, searchTerm),
          like(platformAccounts.platform, searchTerm),
          like(platformAccounts.responsible, searchTerm),
          like(platformAccounts.email, searchTerm),
          like(platformAccounts.notes, searchTerm),
        ));
      }
      if (input?.platform) conditions.push(eq(platformAccounts.platform, input.platform));
      if (input?.status) conditions.push(eq(platformAccounts.status, input.status));
      const accounts = await db.select().from(platformAccounts).where(and(...conditions)).orderBy(desc(platformAccounts.updatedAt));
      return accounts.map(presentAccount);
    }),

  getAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "view");
      await ensureTables();
      const db = await getDb();
      const [account] = await db.select().from(platformAccounts).where(and(eq(platformAccounts.id, input.id), credentialRecordCondition()));
      return account ? presentAccount(account) : null;
    }),

  createAccount: protectedProcedure
    .input(z.object({
      platform: z.string().trim().min(1).max(100),
      accountName: z.string().trim().min(1).max(255),
      accountId: z.string().max(255).optional(),
      password: z.string().max(4000).optional(),
      loginUrl: z.string().url().max(4000).optional().or(z.literal("")),
      email: z.string().email().max(320).optional().or(z.literal("")),
      phone: z.string().max(50).optional(),
      responsible: z.string().max(255).optional(),
      status: z.enum(["active", "inactive", "expired", "suspended"]).default("active"),
      expiresAt: z.string().optional(),
      tags: z.array(z.string().max(100)).max(30).optional(),
      notes: z.string().max(8000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const db = await getDb();
      const [result] = await db.insert(platformAccounts).values({
        platform: input.platform,
        accountName: input.accountName,
        accountId: input.accountId || null,
        password: encryptAccountSecret(input.password),
        loginUrl: input.loginUrl || null,
        email: input.email || null,
        phone: input.phone || null,
        responsible: input.responsible || null,
        status: input.status,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        tags: input.tags || null,
        notes: input.notes || null,
        createdBy: ctx.user.id,
      });
      return { id: result.insertId };
    }),

  updateAccount: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      platform: z.string().trim().min(1).max(100).optional(),
      accountName: z.string().trim().min(1).max(255).optional(),
      accountId: z.string().max(255).optional(),
      password: z.string().max(4000).optional(),
      loginUrl: z.string().url().max(4000).optional().or(z.literal("")),
      email: z.string().email().max(320).optional().or(z.literal("")),
      phone: z.string().max(50).optional(),
      responsible: z.string().max(255).optional(),
      status: z.enum(["active", "inactive", "expired", "suspended"]).optional(),
      expiresAt: z.string().nullable().optional(),
      tags: z.array(z.string().max(100)).max(30).optional(),
      notes: z.string().max(8000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.platform !== undefined) updateData.platform = data.platform;
      if (data.accountName !== undefined) updateData.accountName = data.accountName;
      if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
      if (data.password !== undefined) updateData.password = encryptAccountSecret(data.password);
      if (data.loginUrl !== undefined) updateData.loginUrl = data.loginUrl || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.responsible !== undefined) updateData.responsible = data.responsible || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      await db.update(platformAccounts).set(updateData).where(and(eq(platformAccounts.id, id), credentialRecordCondition()));
      return { success: true };
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const db = await getDb();
      await db.delete(platformAccounts).where(and(eq(platformAccounts.id, input.id), credentialRecordCondition()));
      return { success: true };
    }),

  getPlatforms: protectedProcedure.query(async ({ ctx }) => {
    await requireAccountPermission(ctx, "view");
    await ensureTables();
    const db = await getDb();
    const results = await db.selectDistinct({ platform: platformAccounts.platform }).from(platformAccounts).where(credentialRecordCondition()).orderBy(platformAccounts.platform);
    return results.map(row => row.platform);
  }),

  previewWorkbook: protectedProcedure
    .input(workbookInput)
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      const parsed = parseAccountWorkbook(input.fileName, decodeWorkbookBase64(input.fileBase64));
      return safeAccountWorkbookPreview(parsed);
    }),

  importWorkbook: protectedProcedure
    .input(workbookInput.extend({
      confirmSha256: z.string().regex(/^[a-f0-9]{64}$/),
      repairExisting: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const parsed = parseAccountWorkbook(input.fileName, decodeWorkbookBase64(input.fileBase64));
      if (parsed.fileSha256 !== input.confirmSha256) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "プレビュー後にファイルが変わりました / 预览后文件已变更" });
      }
      const db = await getDb();
      const [existingRun] = await db.select().from(accountWorkbookImports).where(eq(accountWorkbookImports.fileSha256, parsed.fileSha256)).limit(1);
      if (existingRun?.status === "success" && !input.repairExisting) {
        return { success: true, alreadyImported: true, repaired: false, preview: safeAccountWorkbookPreview(parsed), counts: existingRun.counts || {} };
      }

      await db.insert(accountWorkbookImports).values({
        fileName: parsed.fileName,
        fileSha256: parsed.fileSha256,
        sheetName: parsed.sheetName,
        status: "running",
        counts: null,
        errorMessage: null,
        importedBy: ctx.user.id,
      }).onDuplicateKeyUpdate({
        set: {
          fileName: parsed.fileName,
          sheetName: parsed.sheetName,
          status: "running",
          counts: null,
          errorMessage: null,
          importedBy: ctx.user.id,
          startedAt: new Date(),
          completedAt: null,
        },
      });

      try {
        await runDatabaseBackup("pre-account-workbook-import", { force: true, waitForActive: true });
        const counts = await db.transaction(async transaction => {
          let accountsInserted = 0;
          let accountsUpdated = 0;
          let contactsInserted = 0;
          let contactsUpdated = 0;
          let referencesInserted = 0;
          let referencesUpdated = 0;

          for (const account of parsed.accounts) {
            const [existing] = await transaction.select({ id: platformAccounts.id }).from(platformAccounts).where(eq(platformAccounts.sourceKey, account.importKey)).limit(1);
            if (!existing) {
              const manualConditions = [eq(platformAccounts.platform, account.platform), isNull(platformAccounts.sourceKey)];
              if (account.accountId) manualConditions.push(eq(platformAccounts.accountId, account.accountId));
              else manualConditions.push(eq(platformAccounts.accountName, account.accountName));
              const [manualConflict] = await transaction.select({ id: platformAccounts.id }).from(platformAccounts).where(and(...manualConditions)).limit(1);
              if (manualConflict) {
                throw new TRPCError({ code: "CONFLICT", message: `既存の手入力資格情報と競合します: ${account.platform} / ${account.accountName}` });
              }
            }
            await transaction.insert(platformAccounts).values({
              platform: account.platform,
              accountName: account.accountName,
              accountId: account.accountId,
              password: encryptAccountSecret(account.password),
              loginUrl: account.loginUrl,
              email: account.email,
              phone: account.phone,
              responsible: account.responsible,
              status: account.status,
              tags: account.tags,
              notes: account.notes,
              sourceKey: account.importKey,
              sourceFileHash: parsed.fileSha256,
              sourceRows: account.sourceRows,
              createdBy: ctx.user.id,
            }).onDuplicateKeyUpdate({ set: {
              platform: account.platform,
              accountName: account.accountName,
              accountId: account.accountId,
              password: encryptAccountSecret(account.password),
              loginUrl: account.loginUrl,
              email: account.email,
              phone: account.phone,
              responsible: account.responsible,
              status: account.status,
              tags: account.tags,
              notes: account.notes,
              sourceFileHash: parsed.fileSha256,
              sourceRows: account.sourceRows,
              updatedAt: new Date(),
            }});
            if (existing) accountsUpdated += 1;
            else accountsInserted += 1;
          }

          for (const contact of parsed.contacts) {
            const [existing] = await transaction.select({ id: contactInfo.id }).from(contactInfo).where(eq(contactInfo.sourceKey, contact.importKey)).limit(1);
            if (!existing) {
              const companyCondition = contact.companyName ? eq(contactInfo.companyName, contact.companyName) : isNull(contactInfo.companyName);
              const [manualConflict] = await transaction.select({ id: contactInfo.id }).from(contactInfo).where(and(eq(contactInfo.contactName, contact.contactName), companyCondition, isNull(contactInfo.sourceKey))).limit(1);
              if (manualConflict) {
                throw new TRPCError({ code: "CONFLICT", message: `既存の手入力連絡先と競合します: ${contact.contactName}` });
              }
            }
            await transaction.insert(contactInfo).values({
              category: contact.category,
              companyName: contact.companyName,
              contactName: contact.contactName,
              position: null,
              email: contact.email,
              phone: contact.phone,
              wechat: null,
              lineId: null,
              address: contact.address,
              responsible: null,
              status: contact.status,
              tags: contact.tags,
              notes: contact.notes,
              sourceKey: contact.importKey,
              sourceFileHash: parsed.fileSha256,
              sourceRows: contact.sourceRows,
              createdBy: ctx.user.id,
            }).onDuplicateKeyUpdate({ set: {
              category: contact.category,
              companyName: contact.companyName,
              contactName: contact.contactName,
              phone: contact.phone,
              address: contact.address,
              status: contact.status,
              tags: contact.tags,
              notes: contact.notes,
              sourceFileHash: parsed.fileSha256,
              sourceRows: contact.sourceRows,
              updatedAt: new Date(),
            }});
            if (existing) contactsUpdated += 1;
            else contactsInserted += 1;
          }

          for (const reference of parsed.references) {
            const [existing] = await transaction.select({ id: accountReferenceLinks.id }).from(accountReferenceLinks).where(eq(accountReferenceLinks.sourceKey, reference.referenceKey)).limit(1);
            await transaction.insert(accountReferenceLinks).values({
              category: reference.category,
              name: reference.name,
              url: reference.url,
              notes: reference.notes,
              sourceKey: reference.referenceKey,
              sourceFileHash: parsed.fileSha256,
              sourceRows: reference.sourceRows,
              createdBy: ctx.user.id,
            }).onDuplicateKeyUpdate({ set: {
              category: reference.category,
              name: reference.name,
              url: reference.url,
              notes: reference.notes,
              sourceFileHash: parsed.fileSha256,
              sourceRows: reference.sourceRows,
              updatedAt: new Date(),
            }});
            if (existing) referencesUpdated += 1;
            else referencesInserted += 1;
          }

          const resultCounts = {
            accountsInserted,
            accountsUpdated,
            contactsInserted,
            contactsUpdated,
            referencesInserted,
            referencesUpdated,
            excludedRows: parsed.excluded.length,
          };
          await transaction.update(accountWorkbookImports).set({
            status: "success",
            counts: resultCounts,
            completedAt: new Date(),
            errorMessage: null,
          }).where(eq(accountWorkbookImports.fileSha256, parsed.fileSha256));
          return resultCounts;
        });

        let postBackupStatus: "success" | "failed" = "success";
        try {
          await runDatabaseBackup("post-account-workbook-import", { force: true, waitForActive: true });
        } catch (error) {
          postBackupStatus = "failed";
          console.error("[AccountRouter] Post-import backup failed:", error);
        }
        return {
          success: true,
          alreadyImported: false,
          repaired: Boolean(input.repairExisting && existingRun?.status === "success"),
          counts,
          postBackupStatus,
          preview: safeAccountWorkbookPreview(parsed),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.update(accountWorkbookImports).set({
          status: "failed",
          errorMessage: message.slice(0, 4000),
          completedAt: new Date(),
        }).where(eq(accountWorkbookImports.fileSha256, parsed.fileSha256)).catch(() => undefined);
        throw error;
      }
    }),

  listWorkbookImports: protectedProcedure.query(async ({ ctx }) => {
    await requireAccountPermission(ctx, "view");
    await ensureTables();
    const db = await getDb();
    return db.select().from(accountWorkbookImports).orderBy(desc(accountWorkbookImports.startedAt)).limit(20);
  }),

  listReferences: protectedProcedure
    .input(z.object({
      search: z.string().max(200).optional(),
      category: z.enum(["system", "meeting", "ai", "workflow", "other"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "view");
      await ensureTables();
      const db = await getDb();
      const conditions: any[] = [];
      if (input?.search) {
        const term = `%${input.search}%`;
        conditions.push(or(like(accountReferenceLinks.name, term), like(accountReferenceLinks.url, term), like(accountReferenceLinks.notes, term)));
      }
      if (input?.category) conditions.push(eq(accountReferenceLinks.category, input.category));
      return db.select().from(accountReferenceLinks).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(accountReferenceLinks.updatedAt));
    }),

  listContacts: protectedProcedure
    .input(z.object({
      search: z.string().max(200).optional(),
      category: z.enum(["brand", "client", "partner", "supplier", "other"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "view");
      await ensureTables();
      const db = await getDb();
      const conditions: any[] = [];
      if (input?.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(or(
          like(contactInfo.contactName, searchTerm),
          like(contactInfo.companyName, searchTerm),
          like(contactInfo.email, searchTerm),
          like(contactInfo.phone, searchTerm),
          like(contactInfo.responsible, searchTerm),
          like(contactInfo.notes, searchTerm),
        ));
      }
      if (input?.category) conditions.push(eq(contactInfo.category, input.category));
      if (input?.status) conditions.push(eq(contactInfo.status, input.status));
      return db.select().from(contactInfo).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(contactInfo.updatedAt));
    }),

  getContact: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "view");
      await ensureTables();
      const db = await getDb();
      const [contact] = await db.select().from(contactInfo).where(eq(contactInfo.id, input.id));
      return contact ?? null;
    }),

  createContact: protectedProcedure
    .input(z.object({
      category: z.enum(["brand", "client", "partner", "supplier", "other"]).default("client"),
      companyName: z.string().max(255).optional(),
      contactName: z.string().trim().min(1).max(255),
      position: z.string().max(255).optional(),
      email: z.string().email().max(320).optional().or(z.literal("")),
      phone: z.string().max(50).optional(),
      wechat: z.string().max(255).optional(),
      lineId: z.string().max(255).optional(),
      address: z.string().max(8000).optional(),
      responsible: z.string().max(255).optional(),
      status: z.enum(["active", "inactive"]).default("active"),
      tags: z.array(z.string().max(100)).max(30).optional(),
      notes: z.string().max(8000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const db = await getDb();
      const [result] = await db.insert(contactInfo).values({
        category: input.category,
        companyName: input.companyName || null,
        contactName: input.contactName,
        position: input.position || null,
        email: input.email || null,
        phone: input.phone || null,
        wechat: input.wechat || null,
        lineId: input.lineId || null,
        address: input.address || null,
        responsible: input.responsible || null,
        status: input.status,
        tags: input.tags || null,
        notes: input.notes || null,
        createdBy: ctx.user.id,
      });
      return { id: result.insertId };
    }),

  updateContact: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      category: z.enum(["brand", "client", "partner", "supplier", "other"]).optional(),
      companyName: z.string().max(255).optional(),
      contactName: z.string().trim().min(1).max(255).optional(),
      position: z.string().max(255).optional(),
      email: z.string().email().max(320).optional().or(z.literal("")),
      phone: z.string().max(50).optional(),
      wechat: z.string().max(255).optional(),
      lineId: z.string().max(255).optional(),
      address: z.string().max(8000).optional(),
      responsible: z.string().max(255).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      tags: z.array(z.string().max(100)).max(30).optional(),
      notes: z.string().max(8000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.category !== undefined) updateData.category = data.category;
      if (data.companyName !== undefined) updateData.companyName = data.companyName || null;
      if (data.contactName !== undefined) updateData.contactName = data.contactName;
      if (data.position !== undefined) updateData.position = data.position || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.wechat !== undefined) updateData.wechat = data.wechat || null;
      if (data.lineId !== undefined) updateData.lineId = data.lineId || null;
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.responsible !== undefined) updateData.responsible = data.responsible || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      await db.update(contactInfo).set(updateData).where(eq(contactInfo.id, id));
      return { success: true };
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountPermission(ctx, "edit");
      await ensureTables();
      const db = await getDb();
      await db.delete(contactInfo).where(eq(contactInfo.id, input.id));
      return { success: true };
    }),
});
