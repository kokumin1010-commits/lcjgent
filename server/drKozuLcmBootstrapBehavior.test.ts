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
        activeManagerCount: 1,
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
    { caseName: "existing active owner", memberRows: [{ festivalAccountId: 777, role: "owner", status: "active" }], claimStatus: "claimed", expectedRole: "editor" },
    { caseName: "verified catalogue profile without an active owner", memberRows: [], claimStatus: "unclaimed", expectedRole: "owner" },
  ])("safely converges the $caseName and publishes the eleven sourced products", async ({ memberRows, claimStatus, expectedRole }) => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    let productId = 100;
    const connectionQuery = vi.fn(async (rawSql: unknown, params?: unknown[]) => {
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
        companyName: "既存会社名",
        status: "draft",
        claimStatus,
        createdByAccountId: 777,
      }], []];
      if (sql.startsWith("SELECT festivalAccountId,role,status FROM lcm_brand_members")) {
        return [memberRows, []];
      }
      if (sql.startsWith("UPDATE lcm_brand_profiles SET")) {
        expect(params?.[4]).toBe(expectedRole);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith("INSERT INTO lcm_brand_members")) {
        expect(params?.[2]).toBe(expectedRole);
        return [{ insertId: 44, affectedRows: 1 }, []];
      }
      if (sql.startsWith("SELECT id,eventLabel,archivePath,verificationSource,sourceReference")) return [[{
        id: 9,
        eventLabel: "第1回LCF 出展実績",
        archivePath: "/livecommercefestival/2026/exhibitors",
        verificationSource: "lcf_catalog",
        sourceReference: "catalog-page-31",
      }], []];
      if (sql.startsWith("SELECT id,brandProfileId FROM lcm_products")) return [[], []];
      if (sql.startsWith("SELECT id FROM lcm_products WHERE slug=")) return [[], []];
      if (sql.startsWith("INSERT INTO lcm_products")) return [{ insertId: productId++, affectedRows: 1 }, []];
      if (sql.startsWith("UPDATE lcm_content_bootstrap_runs SET")) return [{ affectedRows: 1 }, []];
      if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }], []];
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
        if (normalized(rawSql).startsWith("CREATE TABLE IF NOT EXISTS lcm_content_bootstrap_runs")) return [{ affectedRows: 0 }, []];
        throw new Error(`Unhandled pool SQL: ${normalized(rawSql)}`);
      }),
      getConnection: vi.fn(async () => connection),
      end: vi.fn(),
    };
    vi.doMock("mysql2/promise", () => mockedMysql(pool));

    const { bootstrapDrKozuLcmBrand } = await import("./drKozuLcmBootstrap");
    await expect(bootstrapDrKozuLcmBrand()).resolves.toEqual({
      status: "completed",
      accountId: 30553,
      brandProfileId: 31,
      productCount: 11,
    });
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connectionQuery.mock.calls.filter(([sql]) => normalized(sql).startsWith("INSERT INTO lcm_products"))).toHaveLength(11);
    const profileUpdate = connectionQuery.mock.calls.map(([sql]) => normalized(sql)).find(sql => sql.startsWith("UPDATE lcm_brand_profiles SET"));
    expect(profileUpdate).toContain("companyName=COALESCE");
    expect(profileUpdate).toContain("claimStatus=CASE WHEN ?='owner' THEN 'claimed' ELSE claimStatus END");
    expect(profileUpdate).not.toContain("rejectionReason=");
    expect(connectionQuery.mock.calls.some(([sql]) => /DELETE FROM lcm_brand_members/i.test(normalized(sql)))).toBe(false);
  });

  it.each([
    { caseName: "has a pending claimant", memberRows: [{ festivalAccountId: 999, role: "owner", status: "pending" }], brandStatus: "draft", claimStatus: "pending", sourceBrandId: null, sourceCatalogPage: 31, expectedError: "DRKOZU_LCM_EXISTING_BRAND_PENDING_CLAIM" },
    { caseName: "is an unverified unowned human-created draft", memberRows: [], brandStatus: "draft", claimStatus: "pending", sourceBrandId: null, sourceCatalogPage: null, expectedError: "DRKOZU_LCM_EXISTING_BRAND_REQUIRES_ADMIN_RECONCILIATION" },
    { caseName: "is an unverified unowned published human profile", memberRows: [], brandStatus: "published", claimStatus: "unclaimed", sourceBrandId: null, sourceCatalogPage: null, expectedError: "DRKOZU_LCM_EXISTING_BRAND_REQUIRES_ADMIN_RECONCILIATION" },
    { caseName: "has an active owner but is not claimed", memberRows: [{ festivalAccountId: 999, role: "owner", status: "active" }], brandStatus: "draft", claimStatus: "pending", sourceBrandId: null, sourceCatalogPage: 31, expectedError: "DRKOZU_LCM_EXISTING_BRAND_CLAIM_STATE_MISMATCH" },
    { caseName: "has a mismatched source brand", memberRows: [{ festivalAccountId: 999, role: "owner", status: "active" }], brandStatus: "draft", claimStatus: "claimed", sourceBrandId: 11, sourceCatalogPage: 31, expectedError: "DRKOZU_LCM_EXISTING_BRAND_SOURCE_MISMATCH" },
    { caseName: "has a mismatched catalogue page", memberRows: [{ festivalAccountId: 999, role: "owner", status: "active" }], brandStatus: "draft", claimStatus: "claimed", sourceBrandId: null, sourceCatalogPage: 30, expectedError: "DRKOZU_LCM_EXISTING_BRAND_CATALOG_MISMATCH" },
    { caseName: "is rejected", memberRows: [{ festivalAccountId: 999, role: "owner", status: "active" }], brandStatus: "rejected", claimStatus: "claimed", sourceBrandId: null, sourceCatalogPage: 31, expectedError: "DRKOZU_LCM_EXISTING_BRAND_STATE_UNSAFE" },
    { caseName: "is suspended", memberRows: [{ festivalAccountId: 999, role: "owner", status: "active" }], brandStatus: "suspended", claimStatus: "claimed", sourceBrandId: null, sourceCatalogPage: 31, expectedError: "DRKOZU_LCM_EXISTING_BRAND_STATE_UNSAFE" },
    { caseName: "is archived", memberRows: [{ festivalAccountId: 999, role: "owner", status: "active" }], brandStatus: "archived", claimStatus: "claimed", sourceBrandId: null, sourceCatalogPage: 31, expectedError: "DRKOZU_LCM_EXISTING_BRAND_STATE_UNSAFE" },
  ])("fails closed and rolls back when the existing catalogue brand $caseName", async ({ memberRows, brandStatus, claimStatus, sourceBrandId, sourceCatalogPage, expectedError }) => {
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
        sourceBrandId,
        sourceCatalogPage,
        displayName: "Dr.Kozu",
        companyName: "Dr.Kozu",
        status: brandStatus,
        claimStatus,
        createdByAccountId: 999,
      }], []];
      if (sql.startsWith("SELECT festivalAccountId,role,status FROM lcm_brand_members")) return [memberRows, []];
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
    { caseName: "active manager is missing", overrides: { activeManagerCount: 0 } },
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
        activeManagerCount: 1,
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

  it("marks health unhealthy when a completed marker no longer has valid account and membership relations", async () => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    const connection = {
      query: vi.fn(async (rawSql: unknown) => {
        const sql = normalized(rawSql);
        if (sql.startsWith("SELECT run.accountId")) return [[{
          accountId: 30553,
          brandProfileId: 31,
          productCount: 11,
          accountPresent: 0,
          membershipPresent: 1,
          brandPresent: 1,
          activeManagerCount: 1,
          eventParticipationCount: 1,
          productsPresent: 11,
        }], []];
        throw new Error(`Unhandled connection SQL: ${sql}`);
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (rawSql: unknown) => {
        const sql = normalized(rawSql);
        if (sql.startsWith("SELECT status,productCount,errorCode")) return [[{
          status: "completed",
          productCount: 11,
          errorCode: null,
          accountId: 30553,
          brandProfileId: 31,
        }], []];
        throw new Error(`Unhandled pool SQL: ${sql}`);
      }),
      getConnection: vi.fn(async () => connection),
      end: vi.fn(),
    };
    vi.doMock("mysql2/promise", () => mockedMysql(pool));

    const { getDrKozuLcmBootstrapHealth } = await import("./drKozuLcmBootstrap");
    await expect(getDrKozuLcmBootstrapHealth()).resolves.toMatchObject({
      ok: false,
      runtimeState: "pending",
      markerStatus: "completed",
      productCount: 11,
      failureCode: "DRKOZU_LCM_COMPLETED_STATE_INCONSISTENT",
    });
    expect(connection.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("reports a safe runtime failure code without exposing database error text", async () => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    const databaseError = Object.assign(new Error("Access denied for secret-user@private-host"), {
      code: "ER_TABLEACCESS_DENIED_ERROR",
    });
    const pool = {
      query: vi.fn(async (rawSql: unknown) => {
        const sql = normalized(rawSql);
        if (sql.startsWith("CREATE TABLE IF NOT EXISTS lcm_content_bootstrap_runs")) throw databaseError;
        if (sql.startsWith("SELECT status,productCount,errorCode")) throw databaseError;
        throw new Error(`Unhandled pool SQL: ${sql}`);
      }),
      getConnection: vi.fn(),
      end: vi.fn(),
    };
    vi.doMock("mysql2/promise", () => mockedMysql(pool));

    const { bootstrapDrKozuLcmBrand, getDrKozuLcmBootstrapHealth } = await import("./drKozuLcmBootstrap");
    await expect(bootstrapDrKozuLcmBrand()).rejects.toThrow("Access denied for secret-user@private-host");
    const health = await getDrKozuLcmBootstrapHealth();
    expect(health).toMatchObject({
      ok: false,
      runtimeState: "failed",
      stage: "marker_table",
      markerStatus: "unavailable",
      productCount: 0,
      failureCode: "DRKOZU_LCM_MARKER_TABLE_ER_TABLEACCESS_DENIED_ERROR",
    });
    expect(JSON.stringify(health)).not.toContain("secret-user");
    expect(JSON.stringify(health)).not.toContain("private-host");
  });
});
