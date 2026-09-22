import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  buildFixedAssetChanges,
  ensureFixedAssetSchema,
  fixedAssetRouter,
  hasAtMostTwoDecimalPlaces,
  resetFixedAssetSchemaForTests,
  resolveFixedAssetEventType,
  validateFixedAssetLifecycle,
} from "./fixedAssetRouter";

const routerSource = readFileSync(new URL("./fixedAssetRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/FinanceManagement.tsx", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../client/src/components/FixedAssetsTab.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../drizzle/0158_finance_fixed_assets.sql", import.meta.url), "utf8");
const migrationJournal = readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8");

function lockedContext() {
  return {
    user: {
      id: 101,
      openId: "fixed-asset-test",
      email: "finance@example.invalid",
      name: "Finance Test",
      loginMethod: "password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      hostname: "lcjmall.com",
      headers: {},
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as unknown as TrpcContext;
}

afterEach(() => resetFixedAssetSchemaForTests());

describe("finance fixed asset ledger", () => {
  it("creates the ledger, foreign key and append-only event guards once across concurrent callers", async () => {
    const query = vi.fn(async () => [[], []]);
    const pool = { query } as any;

    await Promise.all([
      ensureFixedAssetSchema(pool),
      ensureFixedAssetSchema(pool),
      ensureFixedAssetSchema(pool),
    ]);

    expect(query).toHaveBeenCalledTimes(5);
    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS company_fixed_assets");
    expect(sql).toContain("UNIQUE KEY uq_company_fixed_assets_code");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS company_fixed_asset_events");
    expect(sql).toContain("FOREIGN KEY (assetId) REFERENCES company_fixed_assets(id) ON DELETE RESTRICT");
    expect(sql).toContain("CREATE TRIGGER trg_fixed_asset_events_no_update");
    expect(sql).toContain("CREATE TRIGGER trg_fixed_asset_events_no_delete");
  });

  it("clears a failed schema promise so a later request can retry", async () => {
    const firstPool = { query: vi.fn(async () => { throw new Error("temporary ddl failure"); }) } as any;
    await expect(ensureFixedAssetSchema(firstPool)).rejects.toThrow("temporary ddl failure");

    const retryQuery = vi.fn(async () => [[], []]);
    await expect(ensureFixedAssetSchema({ query: retryQuery } as any)).resolves.toBeUndefined();
    expect(retryQuery).toHaveBeenCalledTimes(5);
  });

  it("classifies assignment and lifecycle changes for the handover history", () => {
    expect(resolveFixedAssetEventType({ assigneeStaffId: null, status: "available" }, { assigneeStaffId: 8, status: "in_use" })).toBe("assign");
    expect(resolveFixedAssetEventType({ assigneeStaffId: 8, status: "in_use" }, { assigneeStaffId: 12, status: "in_use" })).toBe("transfer");
    expect(resolveFixedAssetEventType({ assigneeStaffId: 8, status: "in_use" }, { assigneeStaffId: null, status: "available" })).toBe("unassign");
    expect(resolveFixedAssetEventType({ assigneeStaffId: 8, status: "in_use" }, { assigneeStaffId: 8, status: "repair" })).toBe("status_change");
    expect(resolveFixedAssetEventType({ assigneeStaffId: 8, status: "in_use" }, { assigneeStaffId: 8, status: "in_use" })).toBe("update");
  });

  it("enforces assignee, assignment date and lifecycle invariants on the server", () => {
    expect(() => validateFixedAssetLifecycle({ acquisitionDate: "2026-01-01", assigneeStaffId: 8, assignedAt: "2026-01-02", status: "in_use", warrantyEndDate: "2027-01-01" }, "2026-09-22")).not.toThrow();
    expect(() => validateFixedAssetLifecycle({ acquisitionDate: null, assigneeStaffId: null, assignedAt: null, status: "in_use", warrantyEndDate: null }, "2026-09-22")).toThrow("使用中の資産");
    expect(() => validateFixedAssetLifecycle({ acquisitionDate: null, assigneeStaffId: 8, assignedAt: "2026-01-02", status: "disposed", warrantyEndDate: null }, "2026-09-22")).toThrow("現在の使用者");
    expect(() => validateFixedAssetLifecycle({ acquisitionDate: "2026-03-01", assigneeStaffId: 8, assignedAt: "2026-02-01", status: "in_use", warrantyEndDate: null }, "2026-09-22")).toThrow("取得日以降");
    expect(() => validateFixedAssetLifecycle({ acquisitionDate: "2026-01-01", assigneeStaffId: null, assignedAt: null, status: "available", warrantyEndDate: "2025-12-31" }, "2026-09-22")).toThrow("保証期限");
    expect(() => validateFixedAssetLifecycle({ acquisitionDate: "2026-09-23", assigneeStaffId: null, assignedAt: null, status: "available", warrantyEndDate: null }, "2026-09-22")).toThrow("未来日");
  });

  it("accepts only amounts that can be stored exactly in DECIMAL(15,2)", () => {
    expect(hasAtMostTwoDecimalPlaces(0)).toBe(true);
    expect(hasAtMostTwoDecimalPlaces(123456.78)).toBe(true);
    expect(hasAtMostTwoDecimalPlaces(1.239)).toBe(false);
    expect(hasAtMostTwoDecimalPlaces(Number.POSITIVE_INFINITY)).toBe(false);
    expect(routerSource).toContain("取得金額は小数点以下2桁以内で入力してください");
  });

  it("captures complete initial and changed financial/assignee snapshots", () => {
    const initial = buildFixedAssetChanges({}, {
      assetCode: "FA-2026-00001",
      assetName: "MacBook Pro",
      purchasePrice: 300000,
      currency: "JPY",
      invoiceNumber: "INV-1",
      assigneeDepartment: "财务部",
      assigneePosition: "经理",
    });
    expect(initial.purchasePrice).toEqual({ before: null, after: "300000" });
    expect(initial.invoiceNumber).toEqual({ before: null, after: "INV-1" });
    expect(initial.assigneeDepartment).toEqual({ before: null, after: "财务部" });
    expect(initial.assigneePosition).toEqual({ before: null, after: "经理" });
  });

  it("requires the finance unlock for ledger reads before touching the database", async () => {
    const caller = fixedAssetRouter.createCaller(lockedContext());
    await expect(caller.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.history({ assetId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("uses optimistic concurrency, staff snapshots, immutable audit events and soft archive", () => {
    expect(routerSource).toContain("WHERE id=? AND version=? AND deletedAt IS NULL");
    expect(routerSource).toContain("version=version+1");
    expect(routerSource).toContain("company_fixed_asset_events");
    expect(routerSource).toContain("assigneeDepartment");
    expect(routerSource).toContain("deletedAt=NOW()");
    expect(routerSource).not.toContain("DELETE FROM company_fixed_assets");
    expect(migrationSource).toContain("ON DELETE RESTRICT");
    expect(migrationSource).toContain("BEFORE UPDATE ON `company_fixed_asset_events`");
    expect(migrationSource).toContain("BEFORE DELETE ON `company_fixed_asset_events`");
    expect(migrationJournal).toContain('"tag": "0158_finance_fixed_assets"');
  });

  it("registers the finance tab and exposes required asset, assignee and summary fields", () => {
    expect(pageSource).toContain("'fixed-assets'");
    expect(pageSource).toContain("固定资产台账");
    expect(pageSource).toContain("<FixedAssetsTab />");
    expect(pageSource).toContain("trpcUtils.fixedAsset.overview.invalidate()");
    expect(pageSource).toContain("trpcUtils.fixedAsset.history.invalidate()");
    expect(uiSource).toContain("trpc.staff.listActive.useQuery()");
    expect(uiSource).toContain("序列号／IMEI");
    expect(uiSource).toContain("当前使用人");
    expect(uiSource).toContain("领用／转交日期");
    expect(uiSource).toContain("购置金额合计");
    expect(uiSource).toContain("按使用人统计");
    expect(uiSource).toContain("按资产类别统计");
    expect(uiSource).toContain("资产履历");
  });
});
