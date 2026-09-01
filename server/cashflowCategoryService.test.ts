import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CASHFLOW_CATEGORY_RULES,
  CASHFLOW_CATEGORY_SEEDS,
  inferCashflowCategory,
} from "./cashflowCategoryService";

const EXPECTED_CATEGORIES = [
  "交通費",
  "家賃・オフィス",
  "その他経費",
  "保険・社会保険",
  "本社送金",
  "従業員経費精算",
  "利息・その他収入",
  "手数料",
  "税金・公租公課",
  "通信・光熱費",
  "外注費",
  "物流・配送",
  "飲食・接待",
  "中国人工費",
  "日本人工費",
  "ブランド枠代収入",
  "TikTok 越境 EC 売上",
  "TikTok・越境 EC",
  "越境 EC 商品売上",
  "商品仕入",
  "広告アカウントチャージ",
  "広告・マーケティング",
  "総務費",
  "ソフトウェア・ツール",
  "口座間振替",
  "資本金",
  "借入金",
  "モデル・タレント",
  "ライブ・配信",
  "採用費",
  "設備・備品",
  "支払利息",
];

describe("现金流分类主数据", () => {
  it("按用户截图原顺序提供全部32个日文字段且无重复", () => {
    expect(CASHFLOW_CATEGORY_SEEDS.map(item => item.name)).toEqual(
      EXPECTED_CATEGORIES
    );
    expect(new Set(EXPECTED_CATEGORIES).size).toBe(32);
  });

  it("所有AI规则输出都属于32个系统分类", () => {
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

  it("分类管理只允许财务管理员，普通财务用户只读取分类", () => {
    expect(routerSource).toContain("getCategories: financeProcedure.query");
    expect(routerSource).toContain(
      "getCategoryDefinitions: financeAdminProcedure.query"
    );
    expect(routerSource).toContain("createCategory: financeAdminProcedure");
    expect(routerSource).toContain(
      "updateCategoryDefinition: financeAdminProcedure"
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
  });
});
