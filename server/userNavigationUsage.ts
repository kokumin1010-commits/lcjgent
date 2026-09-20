import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRACKABLE_ADMIN_MENU_PATH_SET } from "../shared/adminMenuPaths";

const MAX_TRACKED_PATH_LENGTH = 255;
let pool: Pool | null = null;
let setupPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is not configured");
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

export function normalizeTrackedMenuPath(value: string): string {
  const path = value.trim().slice(0, MAX_TRACKED_PATH_LENGTH);
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("INVALID_NAVIGATION_PATH");
  if (/^[a-z]+:\/\//i.test(path) || /[\u0000-\u001f]/.test(path))
    throw new Error("INVALID_NAVIGATION_PATH");
  if (!TRACKABLE_ADMIN_MENU_PATH_SET.has(path))
    throw new Error("UNTRACKABLE_NAVIGATION_PATH");
  return path;
}

async function setupNavigationUsageStorage(): Promise<void> {
  await getPool().query(`CREATE TABLE IF NOT EXISTS user_navigation_usage (
    userId INT NOT NULL,
    menuPath VARCHAR(255) NOT NULL,
    clickCount INT UNSIGNED NOT NULL DEFAULT 0,
    lastClickedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, menuPath),
    INDEX idx_user_navigation_rank (userId, clickCount, lastClickedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export function ensureNavigationUsageStorage(): Promise<void> {
  if (!setupPromise) {
    setupPromise = setupNavigationUsageStorage().catch(error => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

export async function getNavigationUsageHealth(): Promise<void> {
  await ensureNavigationUsageStorage();
  const [columns] = await getPool().query<RowDataPacket[]>(
    "SHOW COLUMNS FROM user_navigation_usage"
  );
  const present = new Set(columns.map(row => String(row.Field)));
  for (const required of ["userId", "menuPath", "clickCount", "lastClickedAt"])
    if (!present.has(required))
      throw new Error(`NAVIGATION_USAGE_COLUMN_MISSING:${required}`);
}

export const userNavigationUsageRouter = router({
  top: protectedProcedure.query(async ({ ctx }) => {
    await ensureNavigationUsageStorage();
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT menuPath,clickCount,lastClickedAt
       FROM user_navigation_usage
       WHERE userId=?
       ORDER BY clickCount DESC,lastClickedAt DESC,menuPath ASC
       LIMIT 100`,
      [ctx.user.id]
    );
    return rows.map(row => ({
      path: String(row.menuPath),
      clickCount: Number(row.clickCount || 0),
      lastClickedAt: row.lastClickedAt,
    }));
  }),

  record: protectedProcedure
    .input(
      z.object({
        path: z
          .string()
          .min(1)
          .max(MAX_TRACKED_PATH_LENGTH)
          .refine(
            value => TRACKABLE_ADMIN_MENU_PATH_SET.has(value.trim()),
            "UNTRACKABLE_NAVIGATION_PATH"
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureNavigationUsageStorage();
      const path = normalizeTrackedMenuPath(input.path);
      const [result] = await getPool().query<ResultSetHeader>(
        `INSERT INTO user_navigation_usage
         (userId,menuPath,clickCount,lastClickedAt)
         VALUES (?,?,1,CURRENT_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE
           clickCount=IF(clickCount<4294967295,clickCount+1,clickCount),
           lastClickedAt=CURRENT_TIMESTAMP(3)`,
        [ctx.user.id, path]
      );
      return { ok: result.affectedRows > 0, path };
    }),
});
