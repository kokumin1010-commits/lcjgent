import { and, desc, eq, sql } from "drizzle-orm";
import { festivalBulkEmailTemplates } from "../drizzle/schema";
import { getDb } from "./db";
import { validateLcfEmailContent } from "./lcfAdminEmailService";

export type LcfBulkEmailTemplateCategory = "sales" | "event" | "follow_up" | "other";

export type LcfBulkEmailTemplateInput = {
  name: string;
  category: LcfBulkEmailTemplateCategory;
  subjectTemplate: string;
  bodyTemplate: string;
};

let ensureTemplateSchemaPromise: Promise<void> | null = null;

export async function ensureLcfBulkEmailTemplateSchema(): Promise<void> {
  if (!ensureTemplateSchemaPromise) {
    ensureTemplateSchemaPromise = (async () => {
      const db = await getDb();
      if (!db) throw new Error("DB接続エラー");
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS festival_bulk_email_templates (
        id BIGINT NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        category ENUM('sales','event','follow_up','other') NOT NULL DEFAULT 'sales',
        subject_template VARCHAR(500) NOT NULL,
        body_template TEXT NOT NULL,
        created_by_account_id INT NOT NULL,
        created_by_email VARCHAR(320) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE INDEX uk_lcf_bulk_template_category_name (category, name),
        INDEX idx_lcf_bulk_template_category_updated (category, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));
    })().catch((error) => {
      ensureTemplateSchemaPromise = null;
      throw error;
    });
  }
  await ensureTemplateSchemaPromise;
}

function validateTemplateInput(input: LcfBulkEmailTemplateInput): LcfBulkEmailTemplateInput {
  const name = String(input.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (name.length < 2) throw new Error("テンプレート名は2文字以上で入力してください");

  const validation = validateLcfEmailContent(input.subjectTemplate, input.bodyTemplate);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("、"));
  }

  return {
    name,
    category: input.category,
    subjectTemplate: validation.subject,
    bodyTemplate: validation.body,
  };
}

export async function listLcfBulkEmailTemplates() {
  await ensureLcfBulkEmailTemplateSchema();
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  return db.select().from(festivalBulkEmailTemplates).orderBy(
    desc(festivalBulkEmailTemplates.updatedAt),
    desc(festivalBulkEmailTemplates.id),
  );
}

export async function createLcfBulkEmailTemplate(
  input: LcfBulkEmailTemplateInput & { createdByAccountId: number; createdByEmail: string },
) {
  await ensureLcfBulkEmailTemplateSchema();
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const template = validateTemplateInput(input);
  const duplicate = await db.select({ id: festivalBulkEmailTemplates.id })
    .from(festivalBulkEmailTemplates)
    .where(and(
      eq(festivalBulkEmailTemplates.category, template.category),
      eq(festivalBulkEmailTemplates.name, template.name),
    ))
    .limit(1);
  if (duplicate.length > 0) throw new Error("同じ分類・名前のテンプレートが既にあります。既存テンプレートを選んで上書きしてください");

  const [result] = await db.insert(festivalBulkEmailTemplates).values({
    ...template,
    createdByAccountId: input.createdByAccountId,
    createdByEmail: input.createdByEmail,
  });
  return { id: Number((result as any).insertId), ...template };
}

export async function updateLcfBulkEmailTemplate(
  id: number,
  input: LcfBulkEmailTemplateInput,
) {
  await ensureLcfBulkEmailTemplateSchema();
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const current = await db.select({ id: festivalBulkEmailTemplates.id })
    .from(festivalBulkEmailTemplates)
    .where(eq(festivalBulkEmailTemplates.id, id))
    .limit(1);
  if (current.length === 0) throw new Error("テンプレートが見つかりません");

  const template = validateTemplateInput(input);
  const duplicate = await db.select({ id: festivalBulkEmailTemplates.id })
    .from(festivalBulkEmailTemplates)
    .where(and(
      eq(festivalBulkEmailTemplates.category, template.category),
      eq(festivalBulkEmailTemplates.name, template.name),
    ))
    .limit(1);
  if (duplicate.some((item) => Number(item.id) !== id)) {
    throw new Error("同じ分類・名前のテンプレートが既にあります");
  }

  await db.update(festivalBulkEmailTemplates)
    .set(template)
    .where(eq(festivalBulkEmailTemplates.id, id));
  return { id, ...template };
}

export async function deleteLcfBulkEmailTemplate(id: number) {
  await ensureLcfBulkEmailTemplateSchema();
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const current = await db.select({ id: festivalBulkEmailTemplates.id, name: festivalBulkEmailTemplates.name })
    .from(festivalBulkEmailTemplates)
    .where(eq(festivalBulkEmailTemplates.id, id))
    .limit(1);
  if (current.length === 0) throw new Error("テンプレートが見つかりません");
  await db.delete(festivalBulkEmailTemplates).where(eq(festivalBulkEmailTemplates.id, id));
  return { id, name: current[0].name };
}
