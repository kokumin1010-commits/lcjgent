/**
 * Lessons Learned Helper - AI自動進化システム
 *
 * バグ修正・知見・教訓をDBに永続化し、
 * 次のManusセッションで自動的に引き継ぐ仕組み。
 */
import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { lessonsLearned, type InsertLessonLearned } from "../drizzle/schema";

export type LessonCategory =
  | "danger"
  | "lesson"
  | "dependency"
  | "rule"
  | "status"
  | "checklist"
  | "preference"
  | "bugfix"
  | "workflow";

export type LessonSeverity = "critical" | "warning" | "info";

interface RegisterLessonInput {
  category: LessonCategory;
  severity?: LessonSeverity;
  title: string;
  content: string;
  compactRule?: string;
  checkPattern?: string;
  relatedFeature?: string;
  relatedFiles?: string[];
}

/**
 * Register a new lesson learned.
 * If a lesson with the same title already exists, update it instead.
 */
export async function registerLesson(input: RegisterLessonInput): Promise<number> {
  const db = await getDb();

  // Check for existing lesson with same title
  const existing = await db
    .select({ id: lessonsLearned.id })
    .from(lessonsLearned)
    .where(eq(lessonsLearned.title, input.title))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(lessonsLearned)
      .set({
        category: input.category,
        severity: input.severity || "info",
        content: input.content,
        compactRule: input.compactRule || null,
        checkPattern: input.checkPattern || null,
        relatedFeature: input.relatedFeature || null,
        relatedFiles: input.relatedFiles || null,
        isActive: true,
      })
      .where(eq(lessonsLearned.id, existing[0].id));
    return existing[0].id;
  }

  // Insert new
  const result = await db.insert(lessonsLearned).values({
    category: input.category,
    severity: input.severity || "info",
    title: input.title,
    content: input.content,
    compactRule: input.compactRule || null,
    checkPattern: input.checkPattern || null,
    relatedFeature: input.relatedFeature || null,
    relatedFiles: input.relatedFiles || null,
    isActive: true,
  });

  return result[0].insertId;
}

/**
 * Get all active lessons, ordered by severity (critical first).
 */
export async function getAllActiveLessons() {
  const db = await getDb();
  return db
    .select()
    .from(lessonsLearned)
    .where(eq(lessonsLearned.isActive, true))
    .orderBy(desc(lessonsLearned.severity), lessonsLearned.category);
}

/**
 * Get lessons filtered by feature.
 */
export async function getLessonsByFeature(feature: string) {
  const db = await getDb();
  return db
    .select()
    .from(lessonsLearned)
    .where(
      and(
        eq(lessonsLearned.isActive, true),
        eq(lessonsLearned.relatedFeature, feature)
      )
    )
    .orderBy(desc(lessonsLearned.severity));
}

/**
 * Get AI context summary - compact rules for all active lessons.
 * This is the primary endpoint for new Manus sessions to load knowledge.
 */
export async function getAiContext(): Promise<string> {
  const db = await getDb();
  const lessons = await db
    .select({
      category: lessonsLearned.category,
      severity: lessonsLearned.severity,
      compactRule: lessonsLearned.compactRule,
      title: lessonsLearned.title,
      relatedFeature: lessonsLearned.relatedFeature,
    })
    .from(lessonsLearned)
    .where(eq(lessonsLearned.isActive, true))
    .orderBy(desc(lessonsLearned.severity), lessonsLearned.category);

  if (lessons.length === 0) {
    return "No lessons recorded yet.";
  }

  const lines = lessons.map((l) => {
    const rule = l.compactRule || l.title;
    const feature = l.relatedFeature ? ` [${l.relatedFeature}]` : "";
    return `[${l.category.toUpperCase()}/${l.severity}]${feature} ${rule}`;
  });

  return `=== LCJ MALL LESSONS (${lessons.length}) ===\n${lines.join("\n")}`;
}

/**
 * Deactivate a lesson (soft delete).
 */
export async function deactivateLesson(id: number): Promise<void> {
  const db = await getDb();
  await db
    .update(lessonsLearned)
    .set({ isActive: false })
    .where(eq(lessonsLearned.id, id));
}

/**
 * Get lesson statistics by category.
 */
export async function getLessonStats() {
  const db = await getDb();
  const stats = await db
    .select({
      category: lessonsLearned.category,
      count: sql<number>`COUNT(*)`,
    })
    .from(lessonsLearned)
    .where(eq(lessonsLearned.isActive, true))
    .groupBy(lessonsLearned.category);

  return stats;
}
