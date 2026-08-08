import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import mysql from "mysql2/promise";

let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

export const setImageRouter = router({
  // 素材一覧取得
  getAssets: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const pool = getPool();
      let where = "WHERE 1=1";
      const params: any[] = [];
      if (input?.category) { where += " AND category = ?"; params.push(input.category); }
      if (input?.search) { where += " AND name LIKE ?"; params.push(`%${input.search}%`); }
      const [rows] = await pool.query(
        `SELECT * FROM set_image_assets ${where} ORDER BY sortOrder ASC, createdAt DESC`,
        params
      ) as any;
      return rows;
    }),

  // 素材追加
  createAsset: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      imageUrl: z.string(),
      imageKey: z.string(),
      category: z.string().optional(),
      brandName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      await pool.query(
        `CREATE TABLE IF NOT EXISTS set_image_assets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          imageUrl TEXT NOT NULL,
          imageKey VARCHAR(512) NOT NULL,
          category VARCHAR(100),
          brandName VARCHAR(255),
          sortOrder INT DEFAULT 0,
          createdBy INT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      );
      const [result] = await pool.query(
        `INSERT INTO set_image_assets (name, imageUrl, imageKey, category, brandName, createdBy) VALUES (?, ?, ?, ?, ?, ?)`,
        [input.name, input.imageUrl, input.imageKey, input.category || null, input.brandName || null, ctx.user.id]
      ) as any;
      return { id: result.insertId };
    }),

  // 素材更新
  updateAsset: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      category: z.string().optional(),
      brandName: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      const updates: string[] = [];
      const params: any[] = [];
      if (input.name !== undefined) { updates.push("name = ?"); params.push(input.name); }
      if (input.category !== undefined) { updates.push("category = ?"); params.push(input.category); }
      if (input.brandName !== undefined) { updates.push("brandName = ?"); params.push(input.brandName); }
      if (input.sortOrder !== undefined) { updates.push("sortOrder = ?"); params.push(input.sortOrder); }
      if (updates.length === 0) return { success: true };
      params.push(input.id);
      await pool.query(`UPDATE set_image_assets SET ${updates.join(", ")} WHERE id = ?`, params);
      return { success: true };
    }),

  // 素材削除
  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query(`DELETE FROM set_image_assets WHERE id = ?`, [input.id]);
      return { success: true };
    }),

  // プリセット一覧
  getPresets: protectedProcedure.query(async () => {
    const pool = getPool();
    try {
      const [rows] = await pool.query(
        `SELECT * FROM set_image_presets ORDER BY updatedAt DESC`
      ) as any;
      return rows;
    } catch (e) {
      return [];
    }
  }),

  // プリセット保存
  savePreset: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      config: z.object({
        title: z.string(),
        subtitle: z.string(),
        bottomText: z.string(),
        colorPreset: z.string(),
        items: z.array(z.object({
          assetId: z.number(),
          label: z.string(),
          size: z.number(),
        })),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      await pool.query(
        `CREATE TABLE IF NOT EXISTS set_image_presets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          config JSON NOT NULL,
          thumbnailUrl TEXT,
          createdBy INT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      );
      if (input.id) {
        await pool.query(
          `UPDATE set_image_presets SET name = ?, config = ? WHERE id = ?`,
          [input.name, JSON.stringify(input.config), input.id]
        );
        return { id: input.id };
      } else {
        const [result] = await pool.query(
          `INSERT INTO set_image_presets (name, config, createdBy) VALUES (?, ?, ?)`,
          [input.name, JSON.stringify(input.config), ctx.user.id]
        ) as any;
        return { id: result.insertId };
      }
    }),

  // プリセット削除
  deletePreset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query(`DELETE FROM set_image_presets WHERE id = ?`, [input.id]);
      return { success: true };
    }),
});
