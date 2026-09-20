import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SELECTION_CATEGORIES,
  formatSelectionCategoryLabel,
  planDefaultSelectionCategories,
  type ExistingSelectionCategory,
} from "../shared/selectionCategories";
import {
  ensureDefaultSelectionCategories,
  ensureSelectionCategorySchema,
} from "./selectionCategoryCatalog";

const existingProductionCategories: ExistingSelectionCategory[] = [
  { id: 1, name: "スキンケア", nameCn: null, catalogKey: null, parentId: null, sortOrder: 0 },
  { id: 2, name: "ヘアケア", nameCn: null, catalogKey: null, parentId: null, sortOrder: 0 },
  { id: 3, name: "美容家電・ガジェット", nameCn: null, catalogKey: null, parentId: null, sortOrder: 0 },
];

function createStatefulCatalogPool(initialRows: ExistingSelectionCategory[]) {
  const rows = initialRows.map(row => ({ ...row }));
  let nextId = Math.max(0, ...rows.map(row => row.id)) + 1;
  const transactionEvents: string[] = [];

  const connection = {
    beginTransaction: async () => { transactionEvents.push("begin"); },
    commit: async () => { transactionEvents.push("commit"); },
    rollback: async () => { transactionEvents.push("rollback"); },
    release: () => { transactionEvents.push("release"); },
    query: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("SELECT id, name, nameCn, catalogKey")) {
        return [rows.map(row => ({ ...row }))];
      }
      if (sql.includes("UPDATE selection_categories")) {
        const [catalogKey, name, nameCn, sortOrder, id] = values as [string, string, string, number, number];
        const row = rows.find(category => category.id === id);
        if (!row || (row.catalogKey && row.catalogKey !== catalogKey)) return [{ affectedRows: 0 }];
        Object.assign(row, { catalogKey, name, nameCn, parentId: null, sortOrder });
        return [{ affectedRows: 1, changedRows: 1 }];
      }
      if (sql.includes("INSERT INTO selection_categories")) {
        const [catalogKey, name, nameCn, sortOrder] = values as [string, string, string, number];
        if (rows.some(category => category.catalogKey === catalogKey)) return [{ affectedRows: 0 }];
        const insertedId = nextId++;
        rows.push({ id: insertedId, catalogKey, name, nameCn, parentId: null, sortOrder });
        return [{ affectedRows: 1, insertId: insertedId }];
      }
      if (sql.includes("SELECT id, catalogKey, name, nameCn")) {
        const keys = new Set(values.map(String));
        return [rows.filter(row => row.catalogKey && keys.has(row.catalogKey)).map(row => ({ ...row }))];
      }
      throw new Error(`Unexpected query in fake catalog connection: ${sql}`);
    },
  };

  return {
    pool: { getConnection: async () => connection },
    rows,
    transactionEvents,
  };
}

describe("selection center default category catalog", () => {
  it("defines the requested 15 bilingual top-level categories in order with unique stable keys", () => {
    expect(DEFAULT_SELECTION_CATEGORIES.map(({ name, nameCn }) => `${name} — ${nameCn}`)).toEqual([
      "スキンケア — 护肤",
      "ヘアケア — 洗护/护发",
      "美容家電・ガジェット — 美容仪器/小型电子产品",
      "インナーケア・健康食品 — 内服美容/保健食品",
      "ボディケア — 身体护理",
      "メイク・コスメ — 彩妆/化妆品",
      "美容雑貨・ケア用品 — 美容周边/护理用品",
      "ファッション・インナー — 服饰/内衣",
      "キッチン・生活雑貨 — 厨房/生活用品",
      "健康・ウェルネス — 健康/养生",
      "食品・飲料 — 食品/饮料",
      "日用品 — 日常用品",
      "ベビー・キッズ — 母婴/儿童",
      "ペット用品 — 宠物用品",
      "その他 — 其他",
    ]);
    expect(new Set(DEFAULT_SELECTION_CATEGORIES.map(category => category.catalogKey)).size).toBe(15);
  });

  it("migrates only the confirmed legacy IDs 1–3 and plans the other 12 as inserts", () => {
    const plan = planDefaultSelectionCategories(existingProductionCategories);
    expect(plan.updates.map(update => update.id)).toEqual([1, 2, 3]);
    expect(plan.updates.map(update => update.catalogKey)).toEqual([
      "system-skincare",
      "system-haircare",
      "system-beauty-devices",
    ]);
    expect(plan.inserts).toHaveLength(12);
    expect(plan.inserts[0]?.name).toBe("インナーケア・健康食品");
    expect(plan.inserts.at(-1)?.name).toBe("その他");
  });

  it("does not adopt or modify a custom category that collides with a default display name", () => {
    const collision = { id: 99, name: "日用品", nameCn: null, catalogKey: null, parentId: null, sortOrder: 999 };
    const plan = planDefaultSelectionCategories([...existingProductionCategories, collision]);
    expect(plan.updates.some(update => update.id === collision.id)).toBe(false);
    expect(plan.inserts.some(category => category.catalogKey === "system-daily-necessities")).toBe(true);
  });

  it("is idempotent when all system catalog keys and canonical values already exist", () => {
    const complete = DEFAULT_SELECTION_CATEGORIES.map((category, index) => ({
      id: index + 1,
      ...category,
      parentId: null,
    }));
    expect(planDefaultSelectionCategories(complete)).toEqual({ inserts: [], updates: [] });
  });

  it("formats bilingual labels consistently for lists, selects, and CSV", () => {
    expect(formatSelectionCategoryLabel({ name: "スキンケア", nameCn: "护肤" })).toBe("スキンケア — 护肤");
    expect(formatSelectionCategoryLabel(
      { name: "子カテゴリ", nameCn: "子分类" },
      { name: "親カテゴリ", nameCn: "父分类" },
    )).toBe("親カテゴリ — 父分类 / 子カテゴリ — 子分类");
  });

  it("preserves IDs, creates 12 rows, verifies 15 rows, and performs zero writes on the second run", async () => {
    const fixture = createStatefulCatalogPool(existingProductionCategories);
    const first = await ensureDefaultSelectionCategories(fixture.pool);
    expect(first).toEqual({ inserted: 12, updated: 3 });
    expect(fixture.rows).toHaveLength(15);
    expect(fixture.rows.slice(0, 3).map(row => row.id)).toEqual([1, 2, 3]);
    expect(fixture.rows.map(row => row.catalogKey).filter(Boolean)).toHaveLength(15);

    const second = await ensureDefaultSelectionCategories(fixture.pool);
    expect(second).toEqual({ inserted: 0, updated: 0 });
    expect(fixture.rows).toHaveLength(15);
    expect(fixture.transactionEvents).toEqual([
      "begin", "commit", "release",
      "begin", "commit", "release",
    ]);
  });

  it("treats duplicate-column and duplicate-index races as already-applied schema changes", async () => {
    const statements: string[] = [];
    let indexChecks = 0;
    const pool = {
      getConnection: async () => { throw new Error("not used"); },
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) return [[]];
        if (sql.includes("INFORMATION_SCHEMA.STATISTICS")) {
          indexChecks += 1;
          return indexChecks === 1
            ? [[]]
            : [[{ INDEX_NAME: "uq_selection_categories_catalog_key", NON_UNIQUE: 0, COLUMN_NAME: "catalogKey", SEQ_IN_INDEX: 1 }]];
        }
        if (sql.includes("ADD COLUMN nameCn")) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_FIELDNAME" });
        if (sql.includes("ADD COLUMN catalogKey")) throw Object.assign(new Error("duplicate"), { errno: 1060 });
        if (sql.includes("ADD UNIQUE KEY")) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_KEYNAME" });
        return [{ affectedRows: 0 }];
      },
    };
    await expect(ensureSelectionCategorySchema(pool)).resolves.toBeUndefined();
    expect(statements.some(sql => sql.includes("UNIQUE KEY uq_selection_categories_catalog_key"))).toBe(true);
  });

  it("rejects a same-name index that is not a unique catalogKey constraint", async () => {
    const pool = {
      getConnection: async () => { throw new Error("not used"); },
      query: async (sql: string) => {
        if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) return [[{ COLUMN_NAME: "present" }]];
        if (sql.includes("INFORMATION_SCHEMA.STATISTICS")) {
          return [[{ INDEX_NAME: "uq_selection_categories_catalog_key", NON_UNIQUE: 1, COLUMN_NAME: "name", SEQ_IN_INDEX: 1 }]];
        }
        return [{ affectedRows: 0 }];
      },
    };
    await expect(ensureSelectionCategorySchema(pool)).rejects.toThrow("is not a unique single-column catalogKey index");
  });

  it("rolls back the whole catalog update when any insert fails", async () => {
    let committed = false;
    let rolledBack = false;
    let released = false;
    const connection = {
      beginTransaction: async () => {},
      commit: async () => { committed = true; },
      rollback: async () => { rolledBack = true; },
      release: () => { released = true; },
      query: async (sql: string) => {
        if (sql.includes("SELECT id, name, nameCn, catalogKey")) return [existingProductionCategories];
        if (sql.includes("INSERT INTO selection_categories")) throw new Error("simulated insert failure");
        return [{ affectedRows: 1 }];
      },
    };

    await expect(ensureDefaultSelectionCategories({ getConnection: async () => connection }))
      .rejects.toThrow("simulated insert failure");
    expect(committed).toBe(false);
    expect(rolledBack).toBe(true);
    expect(released).toBe(true);
  });

  it("wires verified bootstrap, stable sorting, and shared labels into UI and CSV paths", () => {
    const routerSource = readFileSync(new URL("./selectionCenterRouter.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/SelectionCenter.tsx", import.meta.url), "utf8");
    const schemaSource = readFileSync(new URL("../drizzle/selectionCenterSchema.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("ensureSelectionCategoryCatalog(pool)");
    expect(routerSource).toContain("await selectionCategoryCatalogPromise");
    expect(routerSource).toContain("ORDER BY sortOrder ASC, id ASC");
    expect(routerSource).not.toContain("NULL as nameCn");
    expect(pageSource).toContain("disabled={categoriesQuery.isLoading || categoriesQuery.isError}");
    expect(pageSource).toContain("unresolvedCategoryCount");
    expect(pageSource).not.toContain("p.category || ''");
    expect(pageSource.match(/formatSelectionCategoryLabel\(/g)?.length).toBeGreaterThanOrEqual(3);
    const catalogSource = readFileSync(new URL("./selectionCategoryCatalog.ts", import.meta.url), "utf8");
    expect(catalogSource).not.toContain("selection_products");
    expect(schemaSource).toContain('uniqueIndex("uq_selection_categories_catalog_key").on(table.catalogKey)');
  });
});
