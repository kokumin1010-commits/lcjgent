import {
  DEFAULT_SELECTION_CATEGORIES,
  planDefaultSelectionCategories,
  type ExistingSelectionCategory,
} from "../shared/selectionCategories";

interface QueryResultHeader {
  affectedRows?: number;
  changedRows?: number;
  insertId?: number;
}

interface SelectionCategoryConnection {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown?]>;
}

interface SelectionCategoryPool {
  getConnection(): Promise<SelectionCategoryConnection>;
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown?]>;
}

function isConcurrentSchemaAlreadyApplied(error: unknown, expectedCode: "ER_DUP_FIELDNAME" | "ER_DUP_KEYNAME") {
  const candidate = error as { code?: string; errno?: number };
  const expectedErrno = expectedCode === "ER_DUP_FIELDNAME" ? 1060 : 1061;
  return candidate?.code === expectedCode || candidate?.errno === expectedErrno;
}

async function ensureColumn(
  pool: SelectionCategoryPool,
  columnName: "nameCn" | "catalogKey",
  definition: string,
) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'selection_categories'
        AND COLUMN_NAME = ?`,
    [columnName],
  );
  if ((rows as unknown[]).length > 0) return;
  try {
    await pool.query(`ALTER TABLE selection_categories ADD COLUMN ${definition}`);
  } catch (error) {
    if (!isConcurrentSchemaAlreadyApplied(error, "ER_DUP_FIELDNAME")) throw error;
  }
}

async function ensureCatalogKeyIndex(pool: SelectionCategoryPool) {
  const hasValidCatalogKeyIndex = async () => {
    const [rows] = await pool.query(
      `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'selection_categories'
        AND INDEX_NAME = 'uq_selection_categories_catalog_key'
       ORDER BY SEQ_IN_INDEX`,
    );
    const indexRows = rows as Array<{ NON_UNIQUE: number | string; COLUMN_NAME: string; SEQ_IN_INDEX: number | string }>;
    if (indexRows.length === 0) return false;
    const isValid = indexRows.length === 1
      && Number(indexRows[0]?.NON_UNIQUE) === 0
      && indexRows[0]?.COLUMN_NAME === "catalogKey"
      && Number(indexRows[0]?.SEQ_IN_INDEX) === 1;
    if (!isValid) {
      throw new Error("selection_categories catalog key index exists but is not a unique single-column catalogKey index");
    }
    return true;
  };

  if (await hasValidCatalogKeyIndex()) return;
  try {
    await pool.query(
      `ALTER TABLE selection_categories
       ADD UNIQUE KEY uq_selection_categories_catalog_key (catalogKey)`,
    );
  } catch (error) {
    if (!isConcurrentSchemaAlreadyApplied(error, "ER_DUP_KEYNAME")) throw error;
  }
  if (!await hasValidCatalogKeyIndex()) {
    throw new Error("selection_categories catalog key unique index was not created");
  }
}

export async function ensureSelectionCategorySchema(pool: SelectionCategoryPool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS selection_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nameCn VARCHAR(100) DEFAULT NULL,
    catalogKey VARCHAR(64) DEFAULT NULL,
    parentId INT DEFAULT NULL,
    sortOrder INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_selection_categories_catalog_key (catalogKey)
  )`);
  await ensureColumn(pool, "nameCn", "nameCn VARCHAR(100) DEFAULT NULL AFTER name");
  await ensureColumn(pool, "catalogKey", "catalogKey VARCHAR(64) DEFAULT NULL AFTER nameCn");
  await ensureCatalogKeyIndex(pool);
}

export async function ensureDefaultSelectionCategories(pool: SelectionCategoryPool) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, name, nameCn, catalogKey, parentId, sortOrder
         FROM selection_categories
        FOR UPDATE`,
    );
    const plan = planDefaultSelectionCategories(rows as ExistingSelectionCategory[]);
    let inserted = 0;
    let updated = 0;

    for (const category of plan.updates) {
      const [result] = await connection.query(
        `UPDATE selection_categories
            SET catalogKey = ?, name = ?, nameCn = ?, parentId = NULL, sortOrder = ?
          WHERE id = ?
            AND (catalogKey IS NULL OR catalogKey = ?)`,
        [category.catalogKey, category.name, category.nameCn, category.sortOrder, category.id, category.catalogKey],
      );
      const header = result as QueryResultHeader;
      updated += Number(header.changedRows ?? header.affectedRows ?? 0);
    }

    for (const category of plan.inserts) {
      const [result] = await connection.query(
        `INSERT INTO selection_categories (catalogKey, name, nameCn, parentId, sortOrder)
         VALUES (?, ?, ?, NULL, ?)
         ON DUPLICATE KEY UPDATE catalogKey = VALUES(catalogKey)`,
        [category.catalogKey, category.name, category.nameCn, category.sortOrder],
      );
      inserted += Number((result as QueryResultHeader).insertId || 0) > 0 ? 1 : 0;
    }

    const catalogKeys = DEFAULT_SELECTION_CATEGORIES.map(category => category.catalogKey);
    const placeholders = catalogKeys.map(() => "?").join(", ");
    const [verifiedRows] = await connection.query(
      `SELECT id, catalogKey, name, nameCn, parentId, sortOrder
         FROM selection_categories
        WHERE catalogKey IN (${placeholders})`,
      catalogKeys,
    );
    const verifiedByKey = new Map(
      (verifiedRows as ExistingSelectionCategory[]).map(category => [category.catalogKey, category]),
    );
    const incomplete = DEFAULT_SELECTION_CATEGORIES.filter(category => {
      const current = verifiedByKey.get(category.catalogKey);
      return !current
        || current.name !== category.name
        || current.nameCn !== category.nameCn
        || current.parentId !== null
        || current.sortOrder !== category.sortOrder;
    });
    if (incomplete.length > 0) {
      throw new Error(`Selection category catalog verification failed: ${incomplete.map(category => category.catalogKey).join(", ")}`);
    }

    await connection.commit();
    return { inserted, updated };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureSelectionCategoryCatalog(pool: SelectionCategoryPool) {
  await ensureSelectionCategorySchema(pool);
  return ensureDefaultSelectionCategories(pool);
}
