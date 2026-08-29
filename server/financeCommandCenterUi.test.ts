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
    expect(financePage).toContain("<CashflowTab />");
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

  it("shows the monthly expense denominator and hides unreliable runway months", () => {
    expect(commandCenterPage).toContain("最近30天银行余额变化（JPY参考）");
    expect(commandCenterPage).toContain("含工资与集团内部汇款；原币数据分开保存");
    expect(commandCenterPage).toContain("每月平均经营支出（JPY参考）");
    expect(commandCenterPage).toContain("最近90天全部出金");
    expect(commandCenterPage).toContain("减：集团内部汇款");
    expect(commandCenterPage).toContain("÷ 3 = 每月平均经营支出");
    expect(commandCenterPage).toContain("现金余额尚未满足可靠性条件");
    expect(commandCenterPage).toContain("data.runway.ready");
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
