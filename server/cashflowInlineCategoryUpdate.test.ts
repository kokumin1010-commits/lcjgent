import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  applyCashflowInlineCategoryUpdate,
  type CashflowInlineCategoryConnection,
} from "./cashflowInlineCategoryUpdate";

function createHarness(oldRow: Record<string, unknown> | null) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT * FROM company_cashflows")) {
      return [oldRow ? [oldRow] : [], []];
    }
    return [{ affectedRows: 1 }, []];
  });
  const connection: CashflowInlineCategoryConnection = {
    beginTransaction: vi.fn(async () => undefined),
    query,
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
  };
  const dependencies = {
    assertCategoryAllowed: vi.fn(async () => undefined),
    isPayrollCategory: vi.fn((category: string | null | undefined) =>
      String(category || "").includes("人工費")
    ),
    requirePayrollAccess: vi.fn(async () => undefined),
    recordCategoryCorrection: vi.fn(async () => undefined),
  };
  return {
    connection,
    query,
    dependencies,
    pool: { getConnection: vi.fn(async () => connection) },
  };
}

const baseRow = {
  id: 42,
  entity: "japan",
  type: "expense",
  category: "その他経費",
  categorySource: "import",
  categoryLockedByUser: 1,
  // mysql2 returns DECIMAL as a string by default. The category-only path must ignore it.
  amount: "15150.00",
  currency: "JPY",
  description: "待确认",
  counterparty: "0502354A",
  payrollRecordKey: null,
  payrollMonth: null,
  payrollEmployee: null,
  deletedAt: null,
};

async function apply(harness: ReturnType<typeof createHarness>, category = "広告宣伝費") {
  return applyCashflowInlineCategoryUpdate({
    pool: harness.pool,
    id: 42,
    category,
    actor: { id: 7, name: "财务管理员", email: "finance@example.com" },
    dependencies: harness.dependencies,
  });
}

describe("cashflow inline category update", () => {
  it("updates a row whose DECIMAL amount is a string without reading or resending amount", async () => {
    const harness = createHarness(baseRow);
    const result = await apply(harness);

    expect(result).toMatchObject({ success: true, changed: true, category: "広告宣伝費" });
    const updateCall = harness.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE company_cashflows")
    );
    expect(updateCall).toBeTruthy();
    expect(String(updateCall?.[0])).not.toContain("amount");
    expect(updateCall?.[1]).toEqual(["広告宣伝費", 7, 42]);
    expect(harness.dependencies.recordCategoryCorrection).toHaveBeenCalledWith(
      harness.connection,
      expect.objectContaining({
        cashflowId: 42,
        fromCategory: "その他経費",
        toCategory: "広告宣伝費",
        actorId: 7,
      })
    );
    expect(harness.connection.commit).toHaveBeenCalledOnce();
    expect(harness.connection.rollback).not.toHaveBeenCalled();
    expect(harness.connection.release).toHaveBeenCalledOnce();
  });

  it("does not write or create a correction when the category is unchanged", async () => {
    const harness = createHarness(baseRow);
    const result = await apply(harness, "その他経費");

    expect(result.changed).toBe(false);
    expect(
      harness.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE company_cashflows"))
    ).toBe(false);
    expect(harness.dependencies.recordCategoryCorrection).not.toHaveBeenCalled();
    expect(harness.connection.commit).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the connection when category validation fails", async () => {
    const harness = createHarness(baseRow);
    harness.dependencies.assertCategoryAllowed.mockRejectedValueOnce(
      new Error("分类不存在或已停用")
    );

    await expect(apply(harness, "不存在分类")).rejects.toThrow("分类不存在或已停用");
    expect(harness.connection.commit).not.toHaveBeenCalled();
    expect(harness.connection.rollback).toHaveBeenCalledOnce();
    expect(harness.connection.release).toHaveBeenCalledOnce();
  });

  it("requires payroll secondary access before changing a protected row", async () => {
    const harness = createHarness({ ...baseRow, category: "日本人工費", payrollMonth: "2026-08" });
    harness.dependencies.requirePayrollAccess.mockRejectedValueOnce(new Error("工资明细需要二次验证"));

    await expect(apply(harness, "その他経費")).rejects.toThrow("工资明细需要二次验证");
    expect(harness.dependencies.assertCategoryAllowed).not.toHaveBeenCalled();
    expect(harness.connection.rollback).toHaveBeenCalledOnce();
  });

  it("rejects missing or soft-deleted rows without updating anything", async () => {
    for (const row of [null, { ...baseRow, deletedAt: new Date() }]) {
      const harness = createHarness(row);
      await expect(apply(harness)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        harness.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE company_cashflows"))
      ).toBe(false);
      expect(harness.connection.rollback).toHaveBeenCalledOnce();
      expect(harness.connection.release).toHaveBeenCalledOnce();
    }
  });
});

describe("cashflow inline category UI contract", () => {
  const pageSource = readFileSync(
    fileURLToPath(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url)),
    "utf8"
  );
  const routerSource = readFileSync(
    fileURLToPath(new URL("./cashflowRouter.ts", import.meta.url)),
    "utf8"
  );

  it("sends only id and category from the dropdown", () => {
    expect(pageSource).toContain("trpc.cashflow.updateCategoryOnly.useMutation");
    expect(pageSource).toContain("id: Number(item.id),\n        category: nextCategory");
    expect(pageSource).not.toContain(
      "updateMutation.mutate({ id: item.id, category: e.target.value"
    );
    expect(pageSource).toContain('pendingCategoryById[item.id] !== undefined\n                        ? "保存中..."');
  });

  it("exposes a finance-protected category-only input without amount", () => {
    const route = routerSource.slice(
      routerSource.indexOf("updateCategoryOnly: financeProcedure"),
      routerSource.indexOf("// 入出金削除（ソフトデリート）")
    );
    expect(route).toContain("id: z.number().int().positive()");
    expect(route).toContain("category: z.string().trim().min(1).max(100)");
    expect(route).not.toContain("amount: z.number()");
    expect(route).toContain("applyCashflowInlineCategoryUpdate");
  });
});
