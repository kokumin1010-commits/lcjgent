import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("../client/src/components/IpoReadinessOperationsPanel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/components/IpoReadinessCommandCenter.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const operations = readFileSync(new URL("./ipoReadinessOperations.ts", import.meta.url), "utf8");
const board = readFileSync(new URL("./ipoReadinessBoardReport.ts", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("./ipoReadinessUpgrade.ts", import.meta.url), "utf8");
const serverEntry = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

describe("IPO readiness V2 UI and access boundaries", () => {
  it("keeps the existing roadmap and cash management flash while mounting the operations panel", () => {
    expect(page).toContain("上場ロードマップ");
    expect(page).toContain("管理速報");
    expect(page).toContain("IpoReadinessOperationsPanel");
    expect(page).toContain("正式利益に月次決算データがない場合は「未登録」と表示");
    expect(page).toContain("目標営業利益率＝20%");
    expect(page).toContain("必要売上高");
  });

  it("renders every requested command-center module", () => {
    for (const label of [
      "月次目標／正式実績／現金参考",
      "目標差額から必要売上高を反推",
      "3シナリオ期末予測",
      "営業利益20%と税金原資",
      "利益差額の要因",
      "正式P/L利益ブリッジ",
      "銀行営業キャッシュ支出・上位分類",
      "月次決算品質カレンダー",
      "上場準備チェックリスト・監査証拠",
      "取締役会月報・版管理",
    ]) expect(panel).toContain(label);
  });

  it("shows formal P&L and bank cash as separate named series and bases", () => {
    expect(panel).toContain('name="正式営業利益"');
    expect(panel).toContain('name="営業キャッシュ参考"');
    expect(panel).toContain("現金線は経営参考");
    expect(panel).toContain("operations.cashExpenseDrivers.disclaimer");
    expect(panel).toContain("正式P/Lが月次決算済みではないため、売上原価・営業費用・利益率は推測しません");
    expect(panel).toContain("20%（固定）");
    expect(panel).toContain("operations.taxFunding.disclaimer");
  });

  it("keeps the 20 percent revenue plan fixed across UI and API writes", () => {
    expect(panel).toContain("売上目標（自動計算）");
    expect(panel).toContain("営業利益目標 ÷ 20%");
    expect(panel).toContain("revenueTargetJpy: null");
    expect(router).toContain("const normalizedInput = { ...input, revenueTargetJpy: null }");
    expect(router).toContain("z.literal(20)");
  });

  it("protects all V2 reads and writes with the existing finance procedure", () => {
    for (const route of [
      "getFinanceCommandCenter: financeProcedure",
      "upsertIpoMonthlyPlan: financeProcedure",
      "updateIpoReadinessSettings: financeProcedure",
      "saveIpoReadinessTask: financeProcedure",
      "archiveIpoReadinessTask: financeProcedure",
      "generateIpoBoardReport: financeProcedure",
    ]) expect(router).toContain(route);
  });

  it("recomputes board reports from database source data instead of accepting a client summary", () => {
    expect(router).toContain("buildIpoBoardReportDraftFromDatabase(getPool())");
    expect(router).not.toMatch(/generateIpoBoardReport:[\s\S]{0,400}summary:\s*z\./);
    expect(board).toContain("listIpoReadinessMonthlyPnl(pool)");
    expect(board).toContain("listIpoReadinessOperations(pool)");
    expect(board).toContain("buildCashflowMonthlySummary");
  });

  it("excludes internal transfers from bank expense drivers", () => {
    expect(router).toContain("CASHFLOW_INTERNAL_TRANSFER_CATEGORIES");
    expect(router).toContain("category NOT IN");
    expect(board).toContain("CASHFLOW_INTERNAL_TRANSFER_CATEGORIES");
    expect(board).toContain("category NOT IN");
  });

  it("creates only additive IPO tables and preserves audit/version history", () => {
    for (const table of [
      "ipo_monthly_plans",
      "ipo_readiness_settings",
      "ipo_readiness_tasks",
      "ipo_board_report_snapshots",
      "ipo_readiness_audit_logs",
    ]) expect(schema).toContain(`\"${table}\"`);
    expect(operations).toContain("deletedAt=CURRENT_TIMESTAMP");
    expect(operations).toContain("create_version");
    expect(operations).toContain("FOR UPDATE");
  });

  it("starts the heavy backup upgrade without blocking Railway health while V2 routes await the same promise", () => {
    expect(serverEntry).toContain("startIpoReadinessUpgradeSetup();");
    expect(serverEntry).not.toContain("await runIpoReadinessUpgradeSetup();");
    expect(router).toContain("await waitForIpoReadinessUpgradeSetup();");
    expect(upgrade).toContain("ipoReadinessUpgradePromise");
    expect(upgrade).toContain("runDatabaseBackup");
    expect(upgrade).toContain("company_cashflows");
    expect(upgrade).toContain("finance_monthly_pnl");
    expect(upgrade).toContain("cashflow_internal_transfers");
    expect(upgrade).toContain("existingBusinessRowsModified: 0");
  });
});
