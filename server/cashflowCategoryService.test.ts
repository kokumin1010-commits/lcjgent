import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CASHFLOW_CATEGORY_RULES,
  CASHFLOW_CATEGORY_SEEDS,
  createCashflowCategory,
  deleteCashflowCategoryDefinition,
  inferCashflowCategory,
  updateCashflowCategoryDefinition,
} from "./cashflowCategoryService";

const EXPECTED_CATEGORIES = [
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
];

describe("现金流分类主数据", () => {
  it("按用户最新截图原顺序提供全部34个日文字段且无重复", () => {
    expect(CASHFLOW_CATEGORY_SEEDS.map(item => item.name)).toEqual(
      EXPECTED_CATEGORIES
    );
    expect(new Set(EXPECTED_CATEGORIES).size).toBe(34);
    expect(
      CASHFLOW_CATEGORY_SEEDS.every(item => item.flowType === "both")
    ).toBe(true);
  });

  it("所有AI规则输出都属于34个可编辑分类", () => {
    const categoryNames = new Set(EXPECTED_CATEGORIES);
    expect(
      CASHFLOW_CATEGORY_RULES.every(rule => categoryNames.has(rule.category))
    ).toBe(true);
  });

  it("按法人区分中国人工費和日本人工費", () => {
    expect(
      inferCashflowCategory({
        type: "expense",
        entity: "china",
        description: "8月工资",
      }).category
    ).toBe("中国人工費");
    expect(
      inferCashflowCategory({
        type: "expense",
        entity: "japan",
        description: "8月給与",
      }).category
    ).toBe("日本人工費");
  });

  it("区分利息收入和支払利息", () => {
    expect(
      inferCashflowCategory({
        type: "income",
        description: "利息收入",
      }).category
    ).toBe("利息・その他収入");
    expect(
      inferCashflowCategory({
        type: "expense",
        description: "借款利息",
      }).category
    ).toBe("支払利息");
  });

  it("未命中规则时返回低置信度且明确标记未命中", () => {
    expect(
      inferCashflowCategory({
        type: "expense",
        description: "无法识别的新业务",
      })
    ).toMatchObject({
      category: "その他経費",
      matched: false,
      confidence: 0.35,
    });
  });

  it("相同取引先和说明优先采用最近人工纠正", () => {
    const result = inferCashflowCategory({
      type: "expense",
      counterparty: "ABC株式会社",
      description: "每月费用",
      corrections: [
        {
          counterparty: "abc株式会社",
          description: "每月费用",
          category: "総務費",
        },
      ],
    });
    expect(result).toMatchObject({
      category: "総務費",
      source: "ai_learned",
      confidence: 1,
      matched: true,
    });
  });
});

describe("现金流分类CRUD行为", () => {
  function createFakePool(selectRows: unknown[] = []) {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    let selectIndex = 0;
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes("SELECT")) {
          const rows = selectRows[selectIndex++] ?? [];
          return [rows];
        }
        if (sql.includes("INSERT INTO cashflow_category_definitions")) {
          return [{ insertId: 77 }];
        }
        return [{ affectedRows: 1 }];
      },
    };
    return {
      calls,
      pool: { getConnection: async () => connection } as any,
    };
  }

  it("新增分类始终保存为入金・出金双向", async () => {
    const { pool, calls } = createFakePool([[], [{ maxSort: 340 }]]);
    const id = await createCashflowCategory(pool, {
      name: "  新分类  ",
      flowType: "expense",
      actorId: 1,
    });
    expect(id).toBe(77);
    const insert = calls.find(call =>
      call.sql.includes("INSERT INTO cashflow_category_definitions")
    );
    expect(insert?.sql).toContain("VALUES (?,'both',?,1,0,?,?)");
    expect(insert?.params?.[0]).toBe("新分类");
  });

  it("重新添加已删除的同名分类会恢复而非报重复", async () => {
    const { pool, calls } = createFakePool([
      [{ id: 9, deletedAt: new Date() }],
    ]);
    const id = await createCashflowCategory(pool, {
      name: "交通費",
      flowType: "income",
      actorId: 2,
    });
    expect(id).toBe(9);
    const update = calls.find(call => call.sql.includes("deletedAt=NULL"));
    expect(update?.sql).toContain("flowType='both'");
  });

  it("旧系统分类也可改名并保持双向", async () => {
    const { pool, calls } = createFakePool([
      [
        {
          id: 1,
          name: "交通費",
          flowType: "expense",
          isActive: 1,
          isSystem: 1,
        },
      ],
      [],
    ]);
    await expect(
      updateCashflowCategoryDefinition(pool, {
        id: 1,
        name: "交通関連費",
        flowType: "income",
        actorId: 2,
        actorName: "管理员",
      })
    ).resolves.toBeUndefined();
    const update = calls.find(call =>
      call.sql.includes("UPDATE cashflow_category_definitions SET name=")
    );
    expect(update?.params?.slice(0, 2)).toEqual(["交通関連費", "both"]);
  });

  it("删除仅软删除分类定义，不删除或改写历史流水", async () => {
    const { pool, calls } = createFakePool([
      [{ id: 3, name: "交通費", deletedAt: null }],
    ]);
    await expect(
      deleteCashflowCategoryDefinition(pool, { id: 3, actorId: 2 })
    ).resolves.toEqual({ deleted: true, name: "交通費" });
    expect(
      calls.some(call => call.sql.includes("deletedAt=CURRENT_TIMESTAMP"))
    ).toBe(true);
    expect(
      calls.some(call => call.sql.includes("DELETE FROM company_cashflows"))
    ).toBe(false);
    expect(
      calls.some(call => call.sql.includes("UPDATE company_cashflows"))
    ).toBe(false);
  });
});

describe("现金流分类数据库和权限契约", () => {
  const serviceSource = readFileSync(
    new URL("./cashflowCategoryService.ts", import.meta.url),
    "utf8"
  );
  const routerSource = readFileSync(
    new URL("./cashflowRouter.ts", import.meta.url),
    "utf8"
  );
  const payrollAccessSource = readFileSync(
    new URL("./payrollAccess.ts", import.meta.url),
    "utf8"
  );
  const pageSource = readFileSync(
    new URL("../client/src/pages/CashflowTab.tsx", import.meta.url),
    "utf8"
  );
  const managerSource = readFileSync(
    new URL(
      "../client/src/components/CashflowCategoryManager.tsx",
      import.meta.url
    ),
    "utf8"
  );

  it("迁移先备份全部分类再改写旧分类，并记录成功状态", () => {
    const backupIndex = serviceSource.indexOf(
      "INSERT IGNORE INTO cashflow_category_migration_backup_v1"
    );
    const migrateIndex = serviceSource.indexOf(
      "UPDATE company_cashflows\n             SET categorySource='migration'"
    );
    expect(backupIndex).toBeGreaterThan(0);
    expect(migrateIndex).toBeGreaterThan(backupIndex);
    expect(serviceSource).toContain("if (backupRowCount < sourceRowCount)");
    expect(serviceSource).toContain("status='success'");
  });

  it("分类增改删除只允许财务管理员，普通财务用户只读取分类", () => {
    expect(routerSource).toContain("getCategories: financeProcedure.query");
    expect(routerSource).toContain(
      "listCashflowCategories(getPool(), false, false)"
    );
    expect(routerSource).toContain(
      "getCategoryDefinitions: financeAdminProcedure.query"
    );
    expect(routerSource).toContain("createCategory: financeAdminProcedure");
    expect(routerSource).toContain(
      "updateCategoryDefinition: financeAdminProcedure"
    );
    expect(routerSource).toContain(
      "deleteCategoryDefinition: financeAdminProcedure"
    );
  });

  it("人工修改记录纠正并锁定，批量AI只处理未锁定流水", () => {
    expect(routerSource).toContain('categorySource: "manual"');
    expect(routerSource).toContain("categoryLockedByUser: 1");
    expect(routerSource).toContain(
      "recordCashflowCategoryCorrection(connection"
    );
    expect(routerSource).toContain(
      "if (Number(row.categoryLockedByUser) === 1)"
    );
    expect(routerSource).toContain("WHERE id=? AND categoryLockedByUser=0");
    expect(routerSource).toContain("lockedSkipped");
  });

  it("工资隐私同时保护旧分类、中国人工費和日本人工費", () => {
    expect(payrollAccessSource).toContain(
      '["給与・人件費", "中国人工費", "日本人工費"]'
    );
    expect(payrollAccessSource).toContain(
      "category IN ('給与・人件費','中国人工費','日本人工費')"
    );
    expect(routerSource).toContain(
      'const payrollCategory = input.entity === "japan" ? "日本人工費" : "中国人工費"'
    );
  });

  it("V2先备份分类定义再改为双向可编辑，删除不改写历史流水", () => {
    const backupIndex = serviceSource.indexOf(
      "INSERT IGNORE INTO cashflow_category_definition_backup_v2"
    );
    const editableIndex = serviceSource.indexOf(
      "UPDATE cashflow_category_definitions\n            SET flowType='both',isSystem=0"
    );
    const deleteFunction = serviceSource.slice(
      serviceSource.indexOf(
        "export async function deleteCashflowCategoryDefinition"
      ),
      serviceSource.indexOf(
        "export async function assertCashflowCategoryAllowed"
      )
    );
    expect(backupIndex).toBeGreaterThan(0);
    expect(editableIndex).toBeGreaterThan(backupIndex);
    expect(serviceSource).toContain("cashflow_categories_v2_editable_both");
    expect(deleteFunction).toContain("deletedAt=CURRENT_TIMESTAMP");
    expect(deleteFunction).not.toContain("DELETE FROM company_cashflows");
    expect(serviceSource).not.toContain("系统分类不可改名或停用");
  });

  it("页面三个分类入口都使用动态主数据并显示人工修正保护", () => {
    expect(pageSource).toContain("trpc.cashflow.getCategories.useQuery");
    expect(pageSource).toContain(
      "categoryOptionsFor(item.type, item.category)"
    );
    expect(pageSource).toContain(
      "categoryOptionsFor(formData.type, formData.category)"
    );
    expect(pageSource).toContain("人工修正不会被下一次AI覆盖");
    expect(pageSource).toContain("autoClassifyMutation.mutate({ entity })");
    expect(pageSource).toContain("CashflowCategoryManager");
    expect(managerSource).toContain("trpc.cashflow.createCategory.useMutation");
    expect(managerSource).toContain(
      "trpc.cashflow.updateCategoryDefinition.useMutation"
    );
    expect(managerSource).toContain(
      "trpc.cashflow.deleteCategoryDefinition.useMutation"
    );
    expect(managerSource).toContain('flowType: "both"');
    expect(managerSource).toContain("历史流水仍完整保留");
  });
});
