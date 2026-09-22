import { afterEach, describe, expect, it, vi } from "vitest";

function normalized(sql: unknown): string {
  return String(sql).replace(/\s+/g, " ").trim();
}

function mockedMysql(pool: unknown) {
  return {
    default: { createPool: () => pool },
    createPool: () => pool,
  };
}

describe("Dr.Kozu LCM bootstrap convergence", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  it("returns an already-completed healthy state without rewriting account, brand, or products", async () => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    const connectionQuery = vi.fn(async (rawSql: unknown) => {
      const sql = normalized(rawSql);
      if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.startsWith("SELECT run.accountId")) return [[{
        accountId: 30553,
        brandProfileId: 31,
        productCount: 11,
        accountPresent: 1,
        membershipPresent: 1,
        brandPresent: 1,
        activeOwnerCount: 1,
        conflictingMemberCount: 0,
        eventParticipationCount: 1,
        productsPresent: 11,
      }], []];
      if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }], []];
      throw new Error(`Unhandled connection SQL: ${sql}`);
    });
    const connection = {
      query: connectionQuery,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (rawSql: unknown) => {
        const sql = normalized(rawSql);
        if (sql.startsWith("CREATE TABLE IF NOT EXISTS lcm_content_bootstrap_runs")) return [{ affectedRows: 0 }, []];
        throw new Error(`Unhandled pool SQL: ${sql}`);
      }),
      getConnection: vi.fn(async () => connection),
      end: vi.fn(),
    };
    vi.doMock("mysql2/promise", () => mockedMysql(pool));

    const { bootstrapDrKozuLcmBrand } = await import("./drKozuLcmBootstrap");
    await expect(bootstrapDrKozuLcmBrand()).resolves.toEqual({
      status: "already_completed",
      accountId: 30553,
      brandProfileId: 31,
      productCount: 11,
    });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it.each([
    { caseName: "has an owner or pending claimant", memberRows: [{ festivalAccountId: 999, status: "pending" }], brandStatus: "draft", claimStatus: "pending", expectedError: "DRKOZU_LCM_EXISTING_BRAND_ALREADY_OWNED" },
    { caseName: "is an unowned human-created draft", memberRows: [], brandStatus: "draft", claimStatus: "pending", expectedError: "DRKOZU_LCM_EXISTING_BRAND_REQUIRES_ADMIN_RECONCILIATION" },
    { caseName: "is an unowned published human profile", memberRows: [], brandStatus: "published", claimStatus: "unclaimed", expectedError: "DRKOZU_LCM_EXISTING_BRAND_REQUIRES_ADMIN_RECONCILIATION" },
  ])("fails closed and rolls back when the existing catalogue brand $caseName", async ({ memberRows, brandStatus, claimStatus, expectedError }) => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    let productInsertAttempted = false;
    const connectionQuery = vi.fn(async (rawSql: unknown) => {
      const sql = normalized(rawSql);
      if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.startsWith("SELECT run.accountId")) return [[], []];
      if (sql.startsWith("INSERT INTO lcm_content_bootstrap_runs")) return [{ affectedRows: 1 }, []];
      if (sql.startsWith("SELECT id FROM brands")) return [[{ id: 10 }], []];
      if (sql.startsWith("SELECT id FROM managed_stores")) return [[{ id: 4 }], []];
      if (sql.startsWith("SELECT 1 AS linked FROM managed_store_brands")) return [[{ linked: 1 }], []];
      if (sql.startsWith("SELECT id,email,account_type AS accountType")) return [[], []];
      if (sql.startsWith("INSERT INTO festival_accounts")) return [{ insertId: 30553, affectedRows: 1 }, []];
      if (sql.startsWith("INSERT INTO festival_activity_logs")) return [{ insertId: 1, affectedRows: 1 }, []];
      if (sql.startsWith("INSERT INTO lcm_memberships")) return [{ insertId: 8, affectedRows: 1 }, []];
      if (sql.startsWith("INSERT INTO lcm_audit_logs")) return [{ insertId: 2, affectedRows: 1 }, []];
      if (sql.startsWith("SELECT id,slug,sourceBrandId")) return [[{
        id: 31,
        slug: "dr-kozu-existing",
        sourceBrandId: null,
        sourceCatalogPage: 31,
        displayName: "Dr.Kozu",
        companyName: "Dr.Kozu",
        status: brandStatus,
        claimStatus,
        createdByAccountId: 999,
      }], []];
      if (sql.startsWith("SELECT festivalAccountId,status FROM lcm_brand_members")) return [memberRows, []];
      if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }], []];
      if (sql.startsWith("INSERT INTO lcm_products")) productInsertAttempted = true;
      throw new Error(`Unhandled connection SQL: ${sql}`);
    });
    const connection = {
      query: connectionQuery,
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (rawSql: unknown) => {
        const sql = normalized(rawSql);
        if (sql.startsWith("CREATE TABLE IF NOT EXISTS lcm_content_bootstrap_runs")) return [{ affectedRows: 0 }, []];
        throw new Error(`Unhandled pool SQL: ${sql}`);
      }),
      getConnection: vi.fn(async () => connection),
      end: vi.fn(),
    };
    vi.doMock("mysql2/promise", () => mockedMysql(pool));

    const { bootstrapDrKozuLcmBrand } = await import("./drKozuLcmBootstrap");
    await expect(bootstrapDrKozuLcmBrand()).rejects.toThrow(expectedError);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(productInsertAttempted).toBe(false);
    expect(connectionQuery.mock.calls.some(([sql]) => normalized(sql).startsWith("UPDATE lcm_brand_profiles SET"))).toBe(false);
    expect(connection.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it.each([
    { caseName: "account state is invalid", overrides: { accountPresent: 0 } },
    { caseName: "membership is not approved", overrides: { membershipPresent: 0 } },
    { caseName: "brand state or creator is invalid", overrides: { brandPresent: 0 } },
    { caseName: "active owner is missing", overrides: { activeOwnerCount: 0 } },
    { caseName: "another pending member exists", overrides: { conflictingMemberCount: 1 } },
    { caseName: "catalogue participation provenance is missing", overrides: { eventParticipationCount: 0 } },
    { caseName: "one exact source product is missing", overrides: { productsPresent: 10 } },
  ])("rejects a completed marker when $caseName", async ({ overrides }) => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    const connectionQuery = vi.fn(async (rawSql: unknown) => {
      const sql = normalized(rawSql);
      if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.startsWith("SELECT run.accountId")) return [[{
        accountId: 30553,
        brandProfileId: 31,
        productCount: 11,
        accountPresent: 1,
        membershipPresent: 1,
        brandPresent: 1,
        activeOwnerCount: 0,
        conflictingMemberCount: 0,
        eventParticipationCount: 1,
        productsPresent: 11,
        ...overrides,
      }], []];
      if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }], []];
      throw new Error(`Unhandled connection SQL: ${sql}`);
    });
    const connection = {
      query: connectionQuery,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (rawSql: unknown) => {
        if (normalized(rawSql).startsWith("CREATE TABLE IF NOT EXISTS lcm_content_bootstrap_runs")) return [{ affectedRows: 0 }, []];
        throw new Error(`Unhandled pool SQL: ${normalized(rawSql)}`);
      }),
      getConnection: vi.fn(async () => connection),
      end: vi.fn(),
    };
    vi.doMock("mysql2/promise", () => mockedMysql(pool));

    const { bootstrapDrKozuLcmBrand } = await import("./drKozuLcmBootstrap");
    await expect(bootstrapDrKozuLcmBrand()).rejects.toThrow("DRKOZU_LCM_COMPLETED_STATE_INCONSISTENT");
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
