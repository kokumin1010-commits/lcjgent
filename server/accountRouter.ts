/**
 * Account/Information Management Router - 账号/信息管理系统
 * 
 * CRUD operations for platform accounts and contact information.
 */
import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { eq, desc, like, or, and, sql } from "drizzle-orm";
import { platformAccounts, contactInfo } from "../drizzle/schema";

// Ensure tables exist on first use
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
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
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
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    tablesInitialized = true;
    console.log('[AccountRouter] Tables ensured.');
  } catch (err: any) {
    console.error('[AccountRouter] Table init error:', err.message);
    tablesInitialized = true; // Don't retry on every request
  }
}

export const accountRouter = router({
  // ===== Platform Accounts =====

  // List all platform accounts with optional search and filter
  listAccounts: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      platform: z.string().optional(),
      status: z.enum(["active", "inactive", "expired", "suspended"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      await ensureTables();
      const db = await getDb();
      const conditions: any[] = [];

      if (input?.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(
          or(
            like(platformAccounts.accountName, searchTerm),
            like(platformAccounts.platform, searchTerm),
            like(platformAccounts.responsible, searchTerm),
            like(platformAccounts.email, searchTerm),
            like(platformAccounts.notes, searchTerm),
          )
        );
      }
      if (input?.platform) {
        conditions.push(eq(platformAccounts.platform, input.platform));
      }
      if (input?.status) {
        conditions.push(eq(platformAccounts.status, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const accounts = await db
        .select()
        .from(platformAccounts)
        .where(whereClause)
        .orderBy(desc(platformAccounts.updatedAt));

      return accounts;
    }),

  // Get single account
  getAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [account] = await db
        .select()
        .from(platformAccounts)
        .where(eq(platformAccounts.id, input.id));
      return account ?? null;
    }),

  // Create account
  createAccount: protectedProcedure
    .input(z.object({
      platform: z.string().min(1),
      accountName: z.string().min(1),
      accountId: z.string().optional(),
      password: z.string().optional(),
      loginUrl: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      responsible: z.string().optional(),
      status: z.enum(["active", "inactive", "expired", "suspended"]).default("active"),
      expiresAt: z.string().optional(), // ISO date string
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [result] = await db.insert(platformAccounts).values({
        platform: input.platform,
        accountName: input.accountName,
        accountId: input.accountId || null,
        password: input.password || null,
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

  // Update account
  updateAccount: protectedProcedure
    .input(z.object({
      id: z.number(),
      platform: z.string().min(1).optional(),
      accountName: z.string().min(1).optional(),
      accountId: z.string().optional(),
      password: z.string().optional(),
      loginUrl: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      responsible: z.string().optional(),
      status: z.enum(["active", "inactive", "expired", "suspended"]).optional(),
      expiresAt: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.platform !== undefined) updateData.platform = data.platform;
      if (data.accountName !== undefined) updateData.accountName = data.accountName;
      if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
      if (data.password !== undefined) updateData.password = data.password || null;
      if (data.loginUrl !== undefined) updateData.loginUrl = data.loginUrl || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.responsible !== undefined) updateData.responsible = data.responsible || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.notes !== undefined) updateData.notes = data.notes || null;

      await db.update(platformAccounts).set(updateData).where(eq(platformAccounts.id, id));
      return { success: true };
    }),

  // Delete account
  deleteAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(platformAccounts).where(eq(platformAccounts.id, input.id));
      return { success: true };
    }),

  // Get distinct platforms for filter dropdown
  getPlatforms: protectedProcedure.query(async () => {
    const db = await getDb();
    const results = await db
      .selectDistinct({ platform: platformAccounts.platform })
      .from(platformAccounts)
      .orderBy(platformAccounts.platform);
    return results.map(r => r.platform);
  }),

  // ===== Contact Information =====

  // List contacts with optional search and filter
  listContacts: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      category: z.enum(["brand", "client", "partner", "supplier", "other"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions: any[] = [];

      if (input?.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(
          or(
            like(contactInfo.contactName, searchTerm),
            like(contactInfo.companyName, searchTerm),
            like(contactInfo.email, searchTerm),
            like(contactInfo.phone, searchTerm),
            like(contactInfo.responsible, searchTerm),
            like(contactInfo.notes, searchTerm),
          )
        );
      }
      if (input?.category) {
        conditions.push(eq(contactInfo.category, input.category));
      }
      if (input?.status) {
        conditions.push(eq(contactInfo.status, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const contacts = await db
        .select()
        .from(contactInfo)
        .where(whereClause)
        .orderBy(desc(contactInfo.updatedAt));

      return contacts;
    }),

  // Get single contact
  getContact: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [contact] = await db
        .select()
        .from(contactInfo)
        .where(eq(contactInfo.id, input.id));
      return contact ?? null;
    }),

  // Create contact
  createContact: protectedProcedure
    .input(z.object({
      category: z.enum(["brand", "client", "partner", "supplier", "other"]).default("client"),
      companyName: z.string().optional(),
      contactName: z.string().min(1),
      position: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      wechat: z.string().optional(),
      lineId: z.string().optional(),
      address: z.string().optional(),
      responsible: z.string().optional(),
      status: z.enum(["active", "inactive"]).default("active"),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
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

  // Update contact
  updateContact: protectedProcedure
    .input(z.object({
      id: z.number(),
      category: z.enum(["brand", "client", "partner", "supplier", "other"]).optional(),
      companyName: z.string().optional(),
      contactName: z.string().min(1).optional(),
      position: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      wechat: z.string().optional(),
      lineId: z.string().optional(),
      address: z.string().optional(),
      responsible: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
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

  // Delete contact
  deleteContact: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(contactInfo).where(eq(contactInfo.id, input.id));
      return { success: true };
    }),
});
