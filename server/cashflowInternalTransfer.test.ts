import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateActualJpyPerCny } from "./cashflowInternalTransfer";

const serviceSource = readFileSync(new URL("./cashflowInternalTransfer.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../drizzle/0136_cashflow_internal_transfers.sql", import.meta.url), "utf8");

describe("cashflow intercompany transfer linkage", () => {
  it("calculates the actual JPY per CNY rate from source records, never from the management reference rate", () => {
    expect(calculateActualJpyPerCny([
      { currency: "JPY", amount: 14_000_000 },
      { currency: "CNY", amount: 680_000 },
    ])).toBeCloseTo(20.58823529, 8);
    expect(calculateActualJpyPerCny([{ currency: "JPY", amount: 14_000_000 }])).toBeNull();
    expect(calculateActualJpyPerCny([{ currency: "CNY", amount: 0 }, { currency: "JPY", amount: 1 }])).toBeNull();
  });

  it("requires real expense and income rows across entities and currencies", () => {
    expect(serviceSource).toContain('source.type !== "expense" || destination.type !== "income"');
    expect(serviceSource).toContain('source.category === "本社送金"');
    expect(serviceSource).toContain('source.entity === destination.entity');
    expect(serviceSource).toContain('source.currency === destination.currency');
    expect(serviceSource).toContain('source.sourceAccount === destination.sourceAccount');
    expect(serviceSource).toContain('SELECT id,entity,type,category,amount,currency,sourceAccount,deletedAt');
    expect(serviceSource).toContain("両方の分类を本社送金または口座間振替にしてください");
    expect(pageSource).toContain("系统不会按参考汇率自动造账");
  });

  it("separates transfer principal from bank fee without editing the source row", () => {
    expect(serviceSource).toContain("sourceTransferAmount");
    expect(serviceSource).toContain("sourceFeeAmount");
    expect(serviceSource).toContain("rawSourceAmount - sourceTransferAmount");
    expect(serviceSource).toContain("汇款本金必须大于0且不能超过银行出金总额");
    expect(pageSource).toContain("汇款本金（空白=出金全额）");
  });

  it("uses row locks, a transaction and unique source/destination constraints", () => {
    expect(serviceSource).toContain("FOR UPDATE");
    expect(serviceSource).toContain("beginTransaction");
    expect(serviceSource).toContain("rollback");
    expect(migrationSource).toContain("UNIQUE KEY `uq_cashflow_transfer_active_source`");
    expect(migrationSource).toContain("UNIQUE KEY `uq_cashflow_transfer_active_destination`");
  });

  it("blocks edits and deletions while linked and keeps unlinking explicit", () => {
    expect(routerSource).toContain("assertCashflowRowsNotLinked(connection, [input.id])");
    expect(routerSource).toContain("assertCashflowRowsNotLinked(getPool(), [input.id])");
    expect(routerSource).toContain("unlinkInternalTransfer: financeAdminProcedure");
    expect(serviceSource).toContain("已关联的内部转账请先解除关联");
    expect(serviceSource).toContain("status='unlinked'");
    expect(serviceSource).toContain("activeSourceCashflowId=NULL");
    expect(serviceSource).not.toContain("DELETE FROM cashflow_internal_transfers");
  });

  it("keeps all writes admin-only while read-only status remains available to finance users", () => {
    expect(routerSource).toContain("getInternalTransferRows: financeProcedure");
    expect(routerSource).toContain("linkInternalTransfer: financeAdminProcedure");
    expect(routerSource).toContain("unlinkInternalTransfer: financeAdminProcedure");
    expect(pageSource).toContain('meQuery.data?.role === "admin"');
  });
});
