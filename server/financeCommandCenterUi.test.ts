import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financePage = readFileSync(new URL("../client/src/pages/FinanceManagement.tsx", import.meta.url), "utf8");
const cashflowPage = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");
const cashflowRouter = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const financeRouter = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const evidenceService = readFileSync(new URL("./financeImportEvidence.ts", import.meta.url), "utf8");
const commandCenterPage = readFileSync(new URL("../client/src/components/FinanceCommandCenter.tsx", import.meta.url), "utf8");

describe("finance command center and import evidence UI", () => {
  it("places the finance command center next to cashflow without replacing reconciliation", () => {
    const commandPosition = financePage.indexOf("{ key: 'finance-command', label: '财务司令塔'");
    const cashflowPosition = financePage.indexOf("{ key: 'cashflow', label: '入出金管理'");
    expect(commandPosition).toBeGreaterThan(0);
    expect(cashflowPosition).toBeGreaterThan(commandPosition);
    expect(financePage).toContain("<FinanceCommandCenter");
    expect(financePage).toContain("<CashflowTab");
  });

  it("shows downloadable new files and an honest boundary for old unsaved imports", () => {
    expect(cashflowPage).toContain("查看／下载原文件");
    expect(cashflowPage).toContain("原文件保存已启用");
    expect(cashflowPage).toContain("旧インポート履歴（原文件未保存）");
    expect(cashflowPage).toContain("系统不会伪造恢复");
  });

  it("sends source file evidence for bank, payroll, payment, TAP and CAP uploads", () => {
    expect(cashflowPage).toContain("sourceFileBase64: arrayBufferToBase64(data)");
    expect(cashflowPage).toContain("sourceFileBase64: arrayBufferToBase64(sourceBuffer)");
    expect(financePage.match(/fileName: file\.name/g)?.length || 0).toBeGreaterThanOrEqual(4);
    expect(financePage).toContain("fileName: capCreatorFile.name");
    expect(financePage).toContain("fileName: capProductFile.name");
    expect(cashflowRouter).toContain('module: "bank_statement"');
    expect(cashflowRouter).toContain('module: "payroll"');
    expect(financeRouter).toContain('module: "tiktok_payment"');
    expect(financeRouter).toContain('module: "tap"');
    expect(financeRouter).toContain('module: "cap_creator"');
    expect(financeRouter).toContain('module: "cap_product"');
  });

  it("shows future payroll, cash scenarios and an honest estimated runway", () => {
    expect(commandCenterPage).toContain("未来30天预计人工费");
    expect(commandCenterPage).toContain("未来30／60／90天资金预测");
    expect(commandCenterPage).toContain("确定应收应付");
    expect(commandCenterPage).toContain("公司现金跑道");
    expect(commandCenterPage).toContain("流水推算值・待补银行余额基准日");
    expect(commandCenterPage).toContain("余额没有有效银行基准日，因此跑道标记为估算");
    expect(commandCenterPage).toContain("forecast.runway.isEstimate");
    expect(commandCenterPage).toContain("不外推新销售");
    expect(commandCenterPage).toContain("不返回员工姓名或个人工资");
  });

  it("shows original currency and JPY reference on every top expense and opens the exact row drilldown", () => {
    expect(commandCenterPage).toContain("JPY参考 {money(item.referenceAmountJpy");
    expect(commandCenterPage).toContain("点击看逐笔详情");
    expect(commandCenterPage).toContain('onNavigate("cashflow", {');
    for (const field of ["entity: item.entity", 'flowType: "expense"', "category: item.category", "currency: item.currency", "startDate: item.startDate", "endDate: item.endDate", "openReconciliation: true"]) {
      expect(commandCenterPage).toContain(field);
    }
    expect(financePage).toContain("initialDrilldown={cashflowDrilldown}");
    expect(cashflowPage).toContain("initialDrilldown?.category");
    expect(cashflowPage).toContain("initialDrilldown?.currency");
    expect(cashflowPage).toContain("initialDrilldown?.openReconciliation");
  });

  it("never returns a private storage key in the import history DTO", () => {
    const mapStart = evidenceService.indexOf("function mapDocumentRow");
    const mapEnd = evidenceService.indexOf("export async function listFinanceImportDocuments", mapStart);
    const mapper = evidenceService.slice(mapStart, mapEnd);
    expect(mapper).toContain("sourceFileSha256Short");
    expect(mapper).toContain("originalFileSaved");
    expect(mapper).not.toContain("sourceStorageKey:");
  });
});
