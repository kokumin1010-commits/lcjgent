import type { User } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

const CEO_POSITION_LABELS = ["ceo", "最高経営責任者", "最高执行官", "最高執行官"] as const;

export function isCeoPosition(value: unknown): boolean {
  const normalized = String(value ?? "").normalize("NFKC").trim().toLowerCase();
  return CEO_POSITION_LABELS.includes(normalized as (typeof CEO_POSITION_LABELS)[number]);
}

export async function canAccessCeoCommandCenter(user: User | null | undefined): Promise<boolean> {
  if (!user || user.role !== "admin" || !user.email) return false;
  const db = await getDb();
  if (!db) return false;

  const result = await db.execute(sql`
    SELECT position
    FROM staff
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(${user.email}))
      AND isActive = 'active'
      AND archivedAt IS NULL
      AND mergedIntoStaffId IS NULL
    ORDER BY id DESC
    LIMIT 1
  `);
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] as Array<{ position?: unknown }> : [];
  return isCeoPosition(rows[0]?.position);
}
