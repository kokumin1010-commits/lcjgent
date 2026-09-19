import { and, desc, eq } from "drizzle-orm";
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
