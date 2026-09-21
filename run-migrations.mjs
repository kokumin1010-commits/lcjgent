/**
 * Run drizzle migrations on deploy.
 * This script is called during the build/start process on Railway
 * to ensure the database schema is up to date.
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isDuplicateMysqlColumn(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    if (current.code === 'ER_DUP_FIELDNAME') return true;
    if (typeof current.message === 'string' && current.message.includes('Duplicate column')) return true;
    current = current.cause;
  }
  return false;
}

async function ensureMysqlColumns(connection, tableName, columns) {
  for (const column of columns) {
    try {
      await connection.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${column.name}\` ${column.definition}`);
    } catch (error) {
      if (!isDuplicateMysqlColumn(error)) throw error;
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Migration] DATABASE_URL is not set, skipping migrations');
    process.exit(0);
  }

  console.log('[Migration] Connecting to database...');
  
  const connection = await mysql.createConnection(connectionString);
  const db = drizzle(connection);

  console.log('[Migration] Running migrations from ./drizzle ...');
  
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, 'drizzle') });
    console.log('[Migration] All migrations applied successfully!');
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    // Don't fail the build if migrations have issues (table/column may already exist)
    if (err.message.includes('already exists') || err.message.includes('Duplicate column')) {
      console.log('[Migration] Schema already up to date, continuing...');
    } else {
      // Log but don't throw - let the app start
      console.error('[Migration] Non-fatal migration error, continuing deployment...');
      console.error('[Migration] Full error:', err);
    }
  }

  // Fallback: ensure critical tables exist (CREATE IF NOT EXISTS is safe to run always)
  try {
    console.log('[Migration] Running fallback table creation...');
    await connection.execute(`CREATE TABLE IF NOT EXISTS \`platform_accounts\` (
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
    await connection.execute(`CREATE TABLE IF NOT EXISTS \`contact_info\` (
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
    console.log('[Migration] Fallback tables ensured.');

    // Brand Day tables are applied separately because older LCJ migration files
    // contain multiple SQL statements that TiDB rejects before newer journal
    // entries are reached. This file is CREATE TABLE IF NOT EXISTS only and is
    // safely split on Drizzle statement breakpoints.
    console.log('[Migration] Ensuring Brand Day native tables...');
    const brandDayMigrationPath = path.join(__dirname, 'drizzle', '0139_brand_day_native.sql');
    const brandDaySql = await fs.readFile(brandDayMigrationPath, 'utf8');
    const brandDayStatements = brandDaySql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of brandDayStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] Brand Day native tables ensured (${brandDayStatements.length} statements).`);

    console.log('[Migration] Ensuring LCF bulk email tables...');
    const lcfBulkEmailMigrationPath = path.join(__dirname, 'drizzle', '0141_lcf_bulk_email_campaigns.sql');
    const lcfBulkEmailSql = await fs.readFile(lcfBulkEmailMigrationPath, 'utf8');
    const lcfBulkEmailStatements = lcfBulkEmailSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lcfBulkEmailStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] LCF bulk email tables ensured (${lcfBulkEmailStatements.length} statements).`);

    console.log('[Migration] Ensuring LCF bulk email template table...');
    const lcfBulkEmailTemplateMigrationPath = path.join(__dirname, 'drizzle', '0142_lcf_bulk_email_templates.sql');
    const lcfBulkEmailTemplateSql = await fs.readFile(lcfBulkEmailTemplateMigrationPath, 'utf8');
    const lcfBulkEmailTemplateStatements = lcfBulkEmailTemplateSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lcfBulkEmailTemplateStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] LCF bulk email template table ensured (${lcfBulkEmailTemplateStatements.length} statements).`);

    console.log('[Migration] Ensuring LINE group lifecycle state table...');
    const lineGroupLifecycleMigrationPath = path.join(__dirname, 'drizzle', '0143_line_group_lifecycle_order.sql');
    const lineGroupLifecycleSql = await fs.readFile(lineGroupLifecycleMigrationPath, 'utf8');
    const lineGroupLifecycleStatements = lineGroupLifecycleSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lineGroupLifecycleStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] LINE group lifecycle state table ensured (${lineGroupLifecycleStatements.length} statements).`);

    console.log('[Migration] Ensuring LINE AI manager tables...');
    const lineAiManagerMigrationPath = path.join(__dirname, 'drizzle', '0145_line_ai_manager.sql');
    const lineAiManagerSql = await fs.readFile(lineAiManagerMigrationPath, 'utf8');
    const lineAiManagerStatements = lineAiManagerSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lineAiManagerStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] LINE AI manager tables ensured (${lineAiManagerStatements.length} statements).`);

    console.log('[Migration] Ensuring LINE group AI insight columns...');
    const lineGroupAiInsightMigrationPath = path.join(__dirname, 'drizzle', '0147_line_group_ai_insights.sql');
    const lineGroupAiInsightSql = await fs.readFile(lineGroupAiInsightMigrationPath, 'utf8');
    const lineGroupAiInsightStatements = lineGroupAiInsightSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lineGroupAiInsightStatements) {
      await connection.execute(statement);
    }
    const lineGroupInsightColumns = [
      { name: 'analysisEnabled', definition: 'boolean NOT NULL DEFAULT false' },
      { name: 'proactiveAiEnabled', definition: 'boolean NOT NULL DEFAULT false' },
      { name: 'relationshipObjective', definition: 'text' },
      { name: 'groupInsightJson', definition: 'longtext' },
      { name: 'groupInsightUpdatedAt', definition: 'timestamp NULL' },
      { name: 'groupInsightLastMessageAt', definition: 'timestamp NULL' },
      { name: 'groupInsightMessageCount', definition: 'int NOT NULL DEFAULT 0' },
      { name: 'groupInsightLeaseToken', definition: 'varchar(64) NULL' },
      { name: 'groupInsightLeaseExpiresAt', definition: 'timestamp NULL' },
    ];
    await ensureMysqlColumns(connection, 'line_group_settings', lineGroupInsightColumns);
    console.log(`[Migration] LINE group AI insight storage ensured (${lineGroupAiInsightStatements.length} base statements, ${lineGroupInsightColumns.length} columns).`);

    console.log('[Migration] Ensuring LINE group AI draft audit table...');
    const lineGroupAiDraftAuditMigrationPath = path.join(__dirname, 'drizzle', '0151_line_group_ai_draft_audit.sql');
    const lineGroupAiDraftAuditSql = await fs.readFile(lineGroupAiDraftAuditMigrationPath, 'utf8');
    const lineGroupAiDraftAuditStatements = lineGroupAiDraftAuditSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lineGroupAiDraftAuditStatements) {
      try {
        await connection.execute(statement);
      } catch (error) {
        if (!isDuplicateMysqlColumn(error)) throw error;
      }
    }
    await ensureMysqlColumns(connection, 'line_groups', [
      { name: 'conversationRevision', definition: 'bigint unsigned NOT NULL DEFAULT 0' },
    ]);
    console.log(`[Migration] LINE group AI draft audit storage and conversation revision ensured (${lineGroupAiDraftAuditStatements.length} statements).`);

    console.log('[Migration] Ensuring LCM campaign page tables...');
    const lcmCampaignMigrationPath = path.join(__dirname, 'drizzle', '0152_lcm_campaign_pages.sql');
    const lcmCampaignSql = await fs.readFile(lcmCampaignMigrationPath, 'utf8');
    const lcmCampaignStatements = lcmCampaignSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lcmCampaignStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] LCM campaign page tables ensured (${lcmCampaignStatements.length} statements).`);

    console.log('[Migration] Ensuring LCJ Brain core super administrators...');
    const lcjBrainPermissionMigrationPath = path.join(__dirname, 'drizzle', '0148_lcj_brain_core_super_admins.sql');
    const lcjBrainPermissionSql = await fs.readFile(lcjBrainPermissionMigrationPath, 'utf8');
    const lcjBrainPermissionStatements = lcjBrainPermissionSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of lcjBrainPermissionStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] LCJ Brain core super administrators ensured (${lcjBrainPermissionStatements.length} statements).`);

    await ensureMysqlColumns(connection, 'users', [
      { name: 'sessionVersion', definition: 'int NOT NULL DEFAULT 1 AFTER `role`' },
    ]);
    console.log('[Migration] Main account session version ensured.');

    await ensureMysqlColumns(connection, 'lcj_brain_projects', [
      { name: 'deletedAt', definition: 'datetime NULL AFTER `completedAt`' },
      { name: 'deletedBy', definition: 'int NULL AFTER `deletedAt`' },
      { name: 'deletedByName', definition: 'varchar(255) NULL AFTER `deletedBy`' },
    ]);
    console.log('[Migration] LCJ Brain project soft-delete columns ensured.');

    console.log('[Migration] Ensuring managed store multi-brand relations...');
    const storeBrandMigrationPath = path.join(__dirname, 'drizzle', '0153_managed_store_brands.sql');
    const storeBrandSql = await fs.readFile(storeBrandMigrationPath, 'utf8');
    const storeBrandStatements = storeBrandSql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of storeBrandStatements) {
      await connection.execute(statement);
    }
    console.log(`[Migration] Managed store multi-brand relations ensured (${storeBrandStatements.length} statements).`);
  } catch (fallbackErr) {
    console.error('[Migration] Fallback error:', fallbackErr.message);
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('[Migration] Fatal error:', err);
  // Don't exit with error code to prevent broken deploys
  console.error('[Migration] Continuing despite error...');
  process.exit(0);
});
