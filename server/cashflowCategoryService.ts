import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ensureMysqlColumns, ensureMysqlIndexes } from "./mysqlSchemaHelpers";

export type CashflowType = "income" | "expense";
export type CategoryFlowType = CashflowType | "both";

export type CashflowCategorySeed = {
  name: string;
  flowType: CategoryFlowType;
  sortOrder: number;
};

export const CASHFLOW_CATEGORY_SEEDS: CashflowCategorySeed[] = [
  "交通費",
  "家賃・オフィス",
  "その他経費",
  "保険・社会保険",
  "従業員経費精算",
  "手数料",
  "税金・公租公課",
  "通信・光熱費",
  "外注費",
  "物流・配送",
  "飲食・接待",
  "中国人工費",
  "日本人工費",
  "商品仕入",
  "広告・マーケティング",
  "総務費",
  "ソフトウェア・ツール",
  "モデル・タレント",
  "ライブ・配信",
  "採用費",
  "設備・備品",
  "支払利息",
  "本社送金",
  "口座間振替",
  "利息・その他収入",
  "売上高-ライブ枠料収入",
  "売上高-販売手数料収入",
  "売上高-商品販売売上",
  "売上高-代理営業務売上",
  "広告アカウントチャージ",
  "資本金",
  "借入金",
  "雑収入",
  "差入保証金",
].map((name, index) => ({
  name,
  flowType: "both" as const,
  sortOrder: (index + 1) * 10,
}));

export const CASHFLOW_CATEGORY_RULES: Array<{
  keywords: string[];
  category: string;
  type?: CashflowType;
}> = [
  {
    keywords: ["給与", "給料", "工资", "薪水", "工資", "月薪"],
    category: "中国人工費",
    type: "expense",
  },
  {
    keywords: ["給与", "給料", "ib "],
    category: "日本人工費",
    type: "expense",
  },
  {
    keywords: ["社保", "保险", "社会保険", "保険料", "口座振替"],
    category: "保険・社会保険",
    type: "expense",
  },
  {
    keywords: ["経費精算", "费用报销", "报销", "立替"],
    category: "従業員経費精算",
    type: "expense",
  },
  {
    keywords: ["利息收入", "受取利息"],
    category: "利息・その他収入",
    type: "income",
  },
  { keywords: ["借入", "融資", "贷款"], category: "借入金", type: "income" },
  {
    keywords: ["資本金", "出資金", "増資"],
    category: "資本金",
    type: "income",
  },
  {
    keywords: ["ブランド枠", "品牌坑位", "坑位费收入"],
    category: "売上高-ライブ枠料収入",
    type: "income",
  },
  {
    keywords: ["tiktok shop", "tiktok売上", "tiktok 売上"],
    category: "売上高-商品販売売上",
    type: "income",
  },
  {
    keywords: ["越境ec商品", "商品売上", "跨境商品销售"],
    category: "売上高-商品販売売上",
    type: "income",
  },
  {
    keywords: ["广告充值", "広告チャージ", "アカウントチャージ", "充值广告"],
    category: "広告アカウントチャージ",
    type: "expense",
  },
  {
    keywords: ["支払利息", "借款利息", "贷款利息", "利息"],
    category: "支払利息",
    type: "expense",
  },
  {
    keywords: [
      "手续费",
      "手数料",
      "服务费",
      "銀行收费",
      "银行收费",
      "振込手数料",
      "ﾃｽｳﾘﾖｳ",
    ],
    category: "手数料",
  },
  {
    keywords: [
      "打车",
      "交通",
      "机票",
      "高铁",
      "出租车",
      "滴滴",
      "车费",
      "地铁",
      "通勤",
    ],
    category: "交通費",
    type: "expense",
  },
  {
    keywords: ["広告", "广告", "推广", "投放", "kalodata", "营销", "宣伝"],
    category: "広告・マーケティング",
    type: "expense",
  },
  {
    keywords: [
      "租金",
      "物业",
      "房租",
      "办公室",
      "オフィス",
      "家賃",
      "賃料",
      "ヤチン",
    ],
    category: "家賃・オフィス",
    type: "expense",
  },
  {
    keywords: [
      "网络",
      "電気",
      "电费",
      "光熱",
      "宽带",
      "電話",
      "kddi",
      "ntt",
      "ソフトバンク",
      "水道",
    ],
    category: "通信・光熱費",
    type: "expense",
  },
  {
    keywords: ["快递", "物流", "运费", "闪送", "邮寄", "配送", "运输"],
    category: "物流・配送",
    type: "expense",
  },
  {
    keywords: [
      "餐费",
      "飲食",
      "点餐",
      "外卖",
      "餐",
      "饭",
      "住宿",
      "酒店",
      "招待",
    ],
    category: "飲食・接待",
    type: "expense",
  },
  {
    keywords: ["软件", "ソフト", "会员", "订阅", "服务器", "クラウド", "云雀"],
    category: "ソフトウェア・ツール",
    type: "expense",
  },
  {
    keywords: [
      "本社送金",
      "总部汇款",
      "拨付",
      "往来款",
      "日本总部",
      "eb8",
      "ﾍﾝｻｲ",
    ],
    category: "本社送金",
  },
  {
    keywords: ["口座間", "内部振替", "账户互转", "同名口座"],
    category: "口座間振替",
  },
  {
    keywords: ["直播", "ライブ", "配信", "場地", "场地", "跟播"],
    category: "ライブ・配信",
  },
  {
    keywords: ["跨境", "越境", "tiktok", "橱窗", "带货", "提现"],
    category: "売上高-代理営業務売上",
  },
  {
    keywords: ["税理士", "税金", "源泉", "公租公課", "ゼイリシ"],
    category: "税金・公租公課",
    type: "expense",
  },
  {
    keywords: ["外包", "外注", "業務委託", "业务委托", "兼职", "振込サービス"],
    category: "外注費",
    type: "expense",
  },
  {
    keywords: ["仕入", "采购商品", "商品采购", "珠宝", "首饰", "样品"],
    category: "商品仕入",
    type: "expense",
  },
  {
    keywords: ["模特", "モデル", "タレント", "达人费用", "服装租赁", "造型"],
    category: "モデル・タレント",
    type: "expense",
  },
  {
    keywords: ["招聘", "採用", "人材", "面试"],
    category: "採用費",
    type: "expense",
  },
  {
    keywords: ["設備", "備品", "物品", "用品", "什器", "装饰"],
    category: "設備・備品",
    type: "expense",
  },
  {
    keywords: ["総務", "行政費", "办公杂费"],
    category: "総務費",
    type: "expense",
  },
];

const MIGRATION_VERSION = "cashflow_categories_v1";
const EDITABLE_CATEGORY_MIGRATION_VERSION =
  "cashflow_categories_v2_editable_both";

const LEGACY_PRESET_CATEGORY_NAMES = [
  "ブランド枠代収入",
  "TikTok 越境 EC 売上",
  "TikTok・越境 EC",
  "越境 EC 商品売上",
] as const;

async function ensureEditableCategoryMigrationV2(pool: Pool) {
  const [runRows] = await pool.query<RowDataPacket[]>(
    `SELECT status FROM cashflow_category_schema_runs WHERE version=? LIMIT 1`,
    [EDITABLE_CATEGORY_MIGRATION_VERSION]
  );
  if (runRows[0]?.status === "success") return;

  await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_category_definition_backup_v2 (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    flowType VARCHAR(20) NOT NULL,
    sortOrder INT NOT NULL,
    isActive TINYINT(1) NOT NULL,
    isSystem TINYINT(1) NOT NULL,
    deletedAt TIMESTAMP NULL,
    backedUpAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  try {
    await pool.query(
      `INSERT INTO cashflow_category_schema_runs (version,status)
       VALUES (?,'running')
       ON DUPLICATE KEY UPDATE status='running',errorMessage=NULL,startedAt=CURRENT_TIMESTAMP,completedAt=NULL`,
      [EDITABLE_CATEGORY_MIGRATION_VERSION]
    );
    const [sourceRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cashflow_category_definitions`
    );
    const sourceRowCount = Number(sourceRows[0]?.total || 0);
    await pool.query(`INSERT IGNORE INTO cashflow_category_definition_backup_v2
      (id,name,flowType,sortOrder,isActive,isSystem,deletedAt)
      SELECT id,name,flowType,sortOrder,isActive,isSystem,deletedAt
        FROM cashflow_category_definitions`);
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cashflow_category_definition_backup_v2`
    );
    const backupRowCount = Number(backupRows[0]?.total || 0);
    if (backupRowCount < sourceRowCount) {
      throw new Error(
        `分类定义备份不完整：${backupRowCount}/${sourceRowCount}`
      );
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE cashflow_category_definitions
            SET flowType='both',isSystem=0
          WHERE deletedAt IS NULL`
      );
      for (const seed of CASHFLOW_CATEGORY_SEEDS) {
        await connection.query(
          `INSERT INTO cashflow_category_definitions
             (name,flowType,sortOrder,isActive,isSystem,deletedAt)
           VALUES (?,'both',?,1,0,NULL)
           ON DUPLICATE KEY UPDATE
             flowType='both',sortOrder=VALUES(sortOrder),isActive=1,isSystem=0,deletedAt=NULL`,
          [seed.name, seed.sortOrder]
        );
      }
      await connection.query(
        `UPDATE cashflow_category_definitions
            SET isActive=0,isSystem=0,deletedAt=CURRENT_TIMESTAMP
          WHERE name IN (${LEGACY_PRESET_CATEGORY_NAMES.map(() => "?").join(",")})
            AND deletedAt IS NULL`,
        [...LEGACY_PRESET_CATEGORY_NAMES]
      );
      await connection.query(
        `UPDATE cashflow_category_schema_runs
            SET status='success',sourceRowCount=?,backupRowCount=?,completedAt=CURRENT_TIMESTAMP
          WHERE version=?`,
        [sourceRowCount, backupRowCount, EDITABLE_CATEGORY_MIGRATION_VERSION]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    await pool
      .query(
        `UPDATE cashflow_category_schema_runs
            SET status='failed',errorMessage=?,completedAt=CURRENT_TIMESTAMP
          WHERE version=?`,
        [
          String(error instanceof Error ? error.message : error).slice(0, 4000),
          EDITABLE_CATEGORY_MIGRATION_VERSION,
        ]
      )
      .catch(() => undefined);
    throw error;
  }
}

async function withSchemaLock(pool: Pool, callback: () => Promise<void>) {
  const lockConnection = await pool.getConnection();
  try {
    const [lockRows] = await lockConnection.query<RowDataPacket[]>(
      `SELECT GET_LOCK('lcj_cashflow_category_schema_v1', 30) AS acquired`
    );
    if (Number(lockRows[0]?.acquired) !== 1)
      throw new Error("现金流分类升级锁获取失败");
    try {
      await callback();
    } finally {
      await lockConnection
        .query(`SELECT RELEASE_LOCK('lcj_cashflow_category_schema_v1')`)
        .catch(() => undefined);
    }
  } finally {
    lockConnection.release();
  }
}

export async function ensureCashflowCategorySchema(pool: Pool) {
  await withSchemaLock(pool, async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_category_definitions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      flowType ENUM('income','expense','both') NOT NULL DEFAULT 'both',
      sortOrder INT NOT NULL DEFAULT 0,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      isSystem TINYINT(1) NOT NULL DEFAULT 0,
      createdBy INT DEFAULT NULL,
      updatedBy INT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP NULL,
      UNIQUE KEY uq_cashflow_category_name (name),
      INDEX idx_cashflow_category_active_sort (isActive, sortOrder)
    )`);
    await ensureMysqlColumns(pool, "cashflow_category_definitions", [
      { name: "deletedAt", definition: "TIMESTAMP NULL" },
    ]);
    await ensureMysqlIndexes(pool, "cashflow_category_definitions", [
      { name: "idx_cashflow_category_deleted", columns: ["deletedAt"] },
    ]);
    await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_category_corrections (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      cashflowId INT NOT NULL,
      fromCategory VARCHAR(100) DEFAULT NULL,
      toCategory VARCHAR(100) NOT NULL,
      aiCategory VARCHAR(100) DEFAULT NULL,
      source ENUM('manual','category_rename') NOT NULL DEFAULT 'manual',
      counterpartySnapshot VARCHAR(255) DEFAULT NULL,
      descriptionSnapshot TEXT,
      correctedBy INT DEFAULT NULL,
      correctedByName VARCHAR(200) DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cashflow_category_correction_row (cashflowId, createdAt),
      INDEX idx_cashflow_category_correction_match (counterpartySnapshot, toCategory)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_category_schema_runs (
      version VARCHAR(100) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      sourceRowCount INT NOT NULL DEFAULT 0,
      backupRowCount INT NOT NULL DEFAULT 0,
      errorMessage TEXT,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS cashflow_category_migration_backup_v1 (
      cashflowId INT PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      backedUpAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await ensureMysqlColumns(pool, "company_cashflows", [
      {
        name: "categorySource",
        definition: "VARCHAR(32) NOT NULL DEFAULT 'legacy'",
      },
      {
        name: "categoryLockedByUser",
        definition: "TINYINT(1) NOT NULL DEFAULT 0",
      },
      { name: "categoryConfidence", definition: "DECIMAL(5,4) DEFAULT NULL" },
      { name: "categoryReason", definition: "VARCHAR(500) DEFAULT NULL" },
      { name: "lastClassifiedAt", definition: "TIMESTAMP NULL DEFAULT NULL" },
      { name: "categoryUpdatedBy", definition: "INT DEFAULT NULL" },
    ]);
    await ensureMysqlIndexes(pool, "company_cashflows", [
      {
        name: "idx_cashflow_category_locked",
        columns: ["categoryLockedByUser"],
      },
    ]);

    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM cashflow_category_schema_runs WHERE version=? LIMIT 1`,
      [MIGRATION_VERSION]
    );
    if (runRows[0]?.status === "success") {
      await ensureEditableCategoryMigrationV2(pool);
      return;
    }

    try {
      await pool.query(
        `INSERT INTO cashflow_category_schema_runs (version,status)
         VALUES (?,'running')
         ON DUPLICATE KEY UPDATE status='running',errorMessage=NULL,startedAt=CURRENT_TIMESTAMP,completedAt=NULL`,
        [MIGRATION_VERSION]
      );
      const [sourceRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM company_cashflows`
      );
      const sourceRowCount = Number(sourceRows[0]?.total || 0);
      await pool.query(
        `INSERT IGNORE INTO cashflow_category_migration_backup_v1 (cashflowId,category)
         SELECT id,category FROM company_cashflows`
      );
      const [backupRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM cashflow_category_migration_backup_v1`
      );
      const backupRowCount = Number(backupRows[0]?.total || 0);
      if (backupRowCount < sourceRowCount)
        throw new Error(`分类备份不完整：${backupRowCount}/${sourceRowCount}`);

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `UPDATE company_cashflows
             SET categorySource='migration',
                 category=CASE
                   WHEN category='給与・人件費' AND (entity='china' OR currency='CNY') THEN '中国人工費'
                   WHEN category='給与・人件費' THEN '日本人工費'
                   WHEN category='TikTok・越境EC' THEN 'TikTok・越境 EC'
                   WHEN category='振込' THEN '口座間振替'
                   ELSE category END
           WHERE category IN ('給与・人件費','TikTok・越境EC','振込')`
        );
        await connection.query(
          `UPDATE cashflow_category_schema_runs
              SET status='success',sourceRowCount=?,backupRowCount=?,completedAt=CURRENT_TIMESTAMP
            WHERE version=?`,
          [sourceRowCount, backupRowCount, MIGRATION_VERSION]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      await pool
        .query(
          `UPDATE cashflow_category_schema_runs
            SET status='failed',errorMessage=?,completedAt=CURRENT_TIMESTAMP
          WHERE version=?`,
          [
            String(error instanceof Error ? error.message : error).slice(
              0,
              4000
            ),
            MIGRATION_VERSION,
          ]
        )
        .catch(() => undefined);
      throw error;
    }
    await ensureEditableCategoryMigrationV2(pool);
  });
}

export function normalizeCashflowCategoryText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export type LearnedCategoryCorrection = {
  counterparty: string;
  description: string;
  category: string;
};

export async function loadCashflowCategoryCorrections(
  pool: Pool
): Promise<LearnedCategoryCorrection[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT c.counterpartySnapshot,c.descriptionSnapshot,c.toCategory
      FROM cashflow_category_corrections c
      JOIN cashflow_category_definitions d ON d.name=c.toCategory AND d.isActive=1 AND d.deletedAt IS NULL
     WHERE c.source='manual'
     ORDER BY c.id DESC LIMIT 1000`);
  return rows.map(row => ({
    counterparty: normalizeCashflowCategoryText(row.counterpartySnapshot),
    description: normalizeCashflowCategoryText(row.descriptionSnapshot),
    category: String(row.toCategory),
  }));
}

export function inferCashflowCategory(input: {
  type: CashflowType;
  entity?: "japan" | "china";
  counterparty?: unknown;
  description?: unknown;
  corrections?: LearnedCategoryCorrection[];
}) {
  const counterparty = normalizeCashflowCategoryText(input.counterparty);
  const description = normalizeCashflowCategoryText(input.description);
  const learned = input.corrections?.find(
    item =>
      item.category &&
      item.counterparty === counterparty &&
      item.description === description
  );
  if (learned) {
    return {
      category: learned.category,
      confidence: 1,
      reason: "最近一次相同取引先・説明の人工修正",
      source: "ai_learned" as const,
      matched: true,
    };
  }

  const searchText = `${counterparty} ${description}`;
  for (const rule of CASHFLOW_CATEGORY_RULES) {
    if (rule.type && rule.type !== input.type) continue;
    if (rule.category === "中国人工費" && input.entity === "japan") continue;
    if (rule.category === "日本人工費" && input.entity === "china") continue;
    const keyword = rule.keywords.find(item =>
      searchText.includes(item.toLowerCase())
    );
    if (keyword) {
      return {
        category: rule.category,
        confidence: 0.85,
        reason: `关键词：${keyword}`,
        source: "ai_rule" as const,
        matched: true,
      };
    }
  }
  return {
    category: input.type === "income" ? "利息・その他収入" : "その他経費",
    confidence: 0.35,
    reason: "未命中规则，归入对应收支的其他分类",
    source: "ai_rule" as const,
    matched: false,
  };
}

export async function listCashflowCategories(
  pool: Pool,
  includeInactive = false,
  includeLegacy = true
) {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT d.id,d.name,d.flowType,d.sortOrder,d.isActive,d.isSystem,d.createdAt,d.updatedAt,
           COUNT(cf.id) AS usageCount
      FROM cashflow_category_definitions d
      LEFT JOIN company_cashflows cf ON cf.category=d.name AND cf.deletedAt IS NULL
     WHERE d.deletedAt IS NULL${includeInactive ? "" : " AND d.isActive=1"}
     GROUP BY d.id,d.name,d.flowType,d.sortOrder,d.isActive,d.isSystem,d.createdAt,d.updatedAt
     ORDER BY d.sortOrder ASC,d.id ASC`);
  const [legacyRows] = await pool.query<RowDataPacket[]>(`
    SELECT cf.category AS name,COUNT(*) AS usageCount
      FROM company_cashflows cf
      LEFT JOIN cashflow_category_definitions d ON d.name=cf.category AND d.deletedAt IS NULL
     WHERE cf.deletedAt IS NULL AND d.id IS NULL
     GROUP BY cf.category ORDER BY cf.category`);
  const definitions = rows.map(row => ({
    id: Number(row.id),
    name: String(row.name),
    flowType: row.flowType as CategoryFlowType,
    sortOrder: Number(row.sortOrder),
    isActive: Number(row.isActive) === 1,
    isSystem: Number(row.isSystem) === 1,
    usageCount: Number(row.usageCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isLegacy: false,
  }));
  if (!includeLegacy) return definitions;
  return [
    ...definitions,
    ...legacyRows.map((row, index) => ({
      id: -(index + 1),
      name: String(row.name),
      flowType: "both" as const,
      sortOrder: 10_000 + index,
      isActive: true,
      isSystem: false,
      usageCount: Number(row.usageCount || 0),
      createdAt: null,
      updatedAt: null,
      isLegacy: true,
    })),
  ];
}

export async function createCashflowCategory(
  pool: Pool,
  input: {
    name: string;
    flowType: CategoryFlowType;
    actorId: number | null;
  }
) {
  const normalized = input.name.trim();
  if (!normalized) throw new Error("分类名称不能为空");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT id,deletedAt FROM cashflow_category_definitions WHERE name=? FOR UPDATE`,
      [normalized]
    );
    const existing = existingRows[0];
    if (existing && !existing.deletedAt) throw new Error("分类名称已存在");
    if (existing) {
      await connection.query(
        `UPDATE cashflow_category_definitions
            SET flowType='both',isActive=1,isSystem=0,deletedAt=NULL,updatedBy=?
          WHERE id=?`,
        [input.actorId, existing.id]
      );
      await connection.commit();
      return Number(existing.id);
    }
    const [maxRows] = await connection.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(sortOrder),0) AS maxSort FROM cashflow_category_definitions`
    );
    const [result] = await connection.query(
      `INSERT INTO cashflow_category_definitions
         (name,flowType,sortOrder,isActive,isSystem,createdBy,updatedBy)
       VALUES (?,'both',?,1,0,?,?)`,
      [
        normalized,
        Number(maxRows[0]?.maxSort || 0) + 10,
        input.actorId,
        input.actorId,
      ]
    );
    await connection.commit();
    return Number((result as { insertId?: number }).insertId || 0);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateCashflowCategoryDefinition(
  pool: Pool,
  input: {
    id: number;
    name?: string;
    flowType?: CategoryFlowType;
    isActive?: boolean;
    actorId: number | null;
    actorName: string;
  }
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM cashflow_category_definitions WHERE id=? AND deletedAt IS NULL FOR UPDATE`,
      [input.id]
    );
    const current = rows[0];
    if (!current) throw new Error("分类不存在");
    const nextName =
      input.name === undefined ? String(current.name) : input.name.trim();
    if (!nextName) throw new Error("分类名称不能为空");
    const nextFlowType: CategoryFlowType = "both";
    const nextIsActive =
      input.isActive === undefined
        ? Number(current.isActive)
        : input.isActive
          ? 1
          : 0;
    await connection.query(
      `UPDATE cashflow_category_definitions SET name=?,flowType=?,isActive=?,updatedBy=? WHERE id=?`,
      [nextName, nextFlowType, nextIsActive, input.actorId, input.id]
    );
    if (nextName !== current.name) {
      const [cashflowRows] = await connection.query<RowDataPacket[]>(
        `SELECT id,category,counterparty,description,categorySource FROM company_cashflows WHERE category=? FOR UPDATE`,
        [current.name]
      );
      await connection.query(
        `UPDATE company_cashflows SET category=?,categoryReason=?,categoryUpdatedBy=? WHERE category=?`,
        [nextName, "分类主数据改名", input.actorId, current.name]
      );
      for (const row of cashflowRows) {
        await connection.query(
          `INSERT INTO cashflow_category_corrections
            (cashflowId,fromCategory,toCategory,aiCategory,source,counterpartySnapshot,descriptionSnapshot,correctedBy,correctedByName)
           VALUES (?,?,?,?,'category_rename',?,?,?,?)`,
          [
            row.id,
            row.category,
            nextName,
            row.categorySource?.startsWith("ai_") ? row.category : null,
            row.counterparty,
            row.description,
            input.actorId,
            input.actorName,
          ]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteCashflowCategoryDefinition(
  pool: Pool,
  input: { id: number; actorId: number | null }
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id,name,deletedAt FROM cashflow_category_definitions WHERE id=? FOR UPDATE`,
      [input.id]
    );
    const current = rows[0];
    if (!current || current.deletedAt) {
      await connection.commit();
      return { deleted: false, name: current ? String(current.name) : null };
    }
    await connection.query(
      `UPDATE cashflow_category_definitions
          SET isActive=0,isSystem=0,deletedAt=CURRENT_TIMESTAMP,updatedBy=?
        WHERE id=?`,
      [input.actorId, input.id]
    );
    await connection.commit();
    return { deleted: true, name: String(current.name) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assertCashflowCategoryAllowed(
  pool: Pool | PoolConnection,
  category: string,
  type: CashflowType
) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,name,flowType,isActive FROM cashflow_category_definitions WHERE name=? AND deletedAt IS NULL LIMIT 1`,
    [category]
  );
  const row = rows[0];
  if (!row || Number(row.isActive) !== 1) throw new Error("分类不存在或已停用");
  if (row.flowType !== "both" && row.flowType !== type)
    throw new Error("该分类不适用于当前收支类型");
  return row;
}

export async function recordCashflowCategoryCorrection(
  connection: PoolConnection,
  input: {
    cashflowId: number;
    fromCategory: string | null;
    toCategory: string;
    aiCategory: string | null;
    counterparty: string | null;
    description: string | null;
    actorId: number | null;
    actorName: string;
  }
) {
  await connection.query(
    `INSERT INTO cashflow_category_corrections
      (cashflowId,fromCategory,toCategory,aiCategory,source,counterpartySnapshot,descriptionSnapshot,correctedBy,correctedByName)
     VALUES (?,?,?,?, 'manual',?,?,?,?)`,
    [
      input.cashflowId,
      input.fromCategory,
      input.toCategory,
      input.aiCategory,
      input.counterparty,
      input.description,
      input.actorId,
      input.actorName,
    ]
  );
}
