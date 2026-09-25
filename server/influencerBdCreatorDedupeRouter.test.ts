import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const pool = { query: vi.fn(), getConnection: vi.fn() };
  return { pool, createPool: vi.fn(() => pool) };
});

vi.mock("mysql2/promise", () => ({
  default: { createPool: mocks.createPool },
  createPool: mocks.createPool,
}));

import { creatorDedupePreview, influencerBdRouter } from "./influencerBdRouter";

const adminContext = {
  user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" },
} as any;

function confirmedDedupeInput(rows: any[]) {
  const preview = creatorDedupePreview(rows);
  return {
    reason: "duplicate cleanup",
    expectedFingerprint: preview.fingerprint,
    expectedDuplicateGroupCount: preview.duplicateGroupCount,
    expectedDuplicateRecordCount: preview.duplicateRecordCount,
    expectedNormalizationPendingCount: preview.normalizationPendingCount,
  };
}

const emptyConfirmedDedupeInput = {
  reason: "duplicate cleanup",
  expectedFingerprint: "0".repeat(64),
  expectedDuplicateGroupCount: 0,
  expectedDuplicateRecordCount: 0,
  expectedNormalizationPendingCount: 0,
};

beforeEach(() => {
  process.env.DATABASE_URL = "mysql://test.invalid/db";
  mocks.pool.query.mockReset();
  mocks.pool.getConnection.mockReset();
});

describe("influencer creator dedupe router", () => {
  it("searches creators by display name or a normalized account ID with an optional at-sign", async () => {
    mocks.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name FROM staff")) return [[], []];
      if (sql.includes("FROM influencer_bd_creators c") && sql.includes("ORDER BY COALESCE")) {
        return [[{ id: 77, displayName: "Creator", handle: "creator.one", normalizedHandle: "creator.one" }], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller(adminContext);
    await expect(caller.listCreators({ search: " ＠Creator.ONE ", limit: 300, offset: 0 })).resolves.toHaveLength(1);

    const listQuery = mocks.pool.query.mock.calls.find(call => String(call[0]).includes("FROM influencer_bd_creators c") && String(call[0]).includes("ORDER BY COALESCE"));
    expect(String(listQuery?.[0])).toContain("c.displayName LIKE ? ESCAPE '!' OR c.handle LIKE ? ESCAPE '!' OR c.normalizedHandle LIKE ? ESCAPE '!'");
    expect(String(listQuery?.[0])).toContain("c.deletedAt IS NULL");
    expect(listQuery?.[1]).toEqual(["%@Creator.ONE%", "%creator.one%", "%creator.one%", 300, 0]);

    mocks.pool.query.mockClear();
    await expect(caller.listCreators({ search: "name_100%", limit: 300, offset: 0 })).resolves.toHaveLength(1);
    const wildcardQuery = mocks.pool.query.mock.calls.find(call => String(call[0]).includes("FROM influencer_bd_creators c") && String(call[0]).includes("ORDER BY COALESCE"));
    expect(wildcardQuery?.[1]).toEqual(["%name!_100!%%", "%name!_100!%%", "%name!_100!%%", 300, 0]);
  });

  it("keeps creator searches inside the authenticated staff scope and excludes soft-deleted rows", async () => {
    mocks.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name FROM staff")) return [[{ id: 22, name: "Staff" }], []];
      if (sql.includes("FROM influencer_bd_creators c") && sql.includes("ORDER BY COALESCE")) return [[], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller({
      user: { id: 9, name: "Staff", email: "staff@example.invalid", role: "user" },
    } as any);
    await expect(caller.listCreators({ search: "ペリ", limit: 100, offset: 0 })).resolves.toEqual([]);

    const listQuery = mocks.pool.query.mock.calls.find(call => String(call[0]).includes("FROM influencer_bd_creators c") && String(call[0]).includes("ORDER BY COALESCE"));
    expect(String(listQuery?.[0])).toContain("c.deletedAt IS NULL");
    expect(String(listQuery?.[0])).toContain("(c.ownerStaffId=? OR (c.ownerStaffId IS NULL AND c.createdById=?))");
    expect(listQuery?.[1]).toEqual([22, 9, "%ペリ%", "%ペリ%", "%ペリ%", 100, 0]);
  });

  it("stores a canonical account ID for manual creator creation", async () => {
    const connection = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name FROM staff")) return [[], []];
      if (sql.includes("INSERT INTO influencer_bd_creators")) return [{ insertId: 77 }, []];
      if (sql.includes("SELECT * FROM influencer_bd_creators WHERE id=?")) return [[{ id: 77, displayName: "Creator", handle: "creator.one", normalizedHandle: "creator.one" }], []];
      if (sql.includes("INSERT INTO influencer_bd_audit_logs")) return [{ insertId: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller(adminContext);
    await caller.saveCreator({
      displayName: "Creator",
      platform: "TikTok",
      handle: " https://www.tiktok.com/@Creator.ONE?lang=ja ",
      profileUrl: "https://www.tiktok.com/@Creator.ONE",
      followerCount: null,
      category: null,
      country: null,
      language: null,
      contactInfo: null,
      ownerStaffId: null,
      ownerStaffName: null,
      status: "potential",
      notes: null,
    });
    const insert = connection.query.mock.calls.find(call => String(call[0]).includes("INSERT INTO influencer_bd_creators"));
    expect(insert).toBeTruthy();
    expect((insert?.[1] as unknown[]).slice(0, 4)).toEqual(["Creator", "TikTok", "creator.one", "creator.one"]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  it("rejects a profile URL that does not belong to the selected platform before writing", async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([[], []]),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    const caller = influencerBdRouter.createCaller(adminContext);
    await expect(caller.saveCreator({
      displayName: "Creator",
      platform: "Instagram",
      handle: "https://example.invalid/not-an-instagram-account",
      profileUrl: null,
      followerCount: null,
      category: null,
      country: null,
      language: null,
      contactInfo: null,
      ownerStaffId: null,
      ownerStaffName: null,
      status: "potential",
      notes: null,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.some(call => String(call[0]).includes("INSERT INTO influencer_bd_creators"))).toBe(false);
  });

  it("previews duplicate counts without mutating data", async () => {
    mocks.pool.query.mockResolvedValueOnce([[
      { id: 1, displayName: "creator.one", platform: "TikTok", handle: "@Creator.One", normalizedHandle: null, deletedAt: null, outreachCount: 1, attachmentCount: 0 },
      { id: 2, displayName: "Real Creator Name", platform: "TikTok", handle: "creator.one", normalizedHandle: null, deletedAt: null, outreachCount: 0, attachmentCount: 1 },
      { id: 3, displayName: "Other", platform: "TikTok", handle: "other", normalizedHandle: "other", deletedAt: null, outreachCount: 0, attachmentCount: 0 },
    ], []]);

    const caller = influencerBdRouter.createCaller(adminContext);
    await expect(caller.previewCreatorDedupe()).resolves.toMatchObject({
      duplicateGroupCount: 1,
      duplicateRecordCount: 1,
      normalizationPendingCount: 2,
      groups: [{ keeperId: 2, keeperName: "Real Creator Name", handle: "creator.one", duplicateCount: 1 }],
    });
    expect(mocks.pool.query).toHaveBeenCalledTimes(1);
  });

  it("moves progress and attachments, archives duplicates and writes audits atomically", async () => {
    const lockedRows = [
      { id: 10, displayName: "creator.one", platform: "TikTok", handle: "@creator.one", normalizedHandle: null, deletedAt: null, outreachCount: 2, attachmentCount: 1, status: "contacting", notes: "private-note", contactInfo: "private-contact" },
      { id: 11, displayName: "Real TikTok Name", platform: "TikTok", handle: "creator.one", normalizedHandle: "creator.one", deletedAt: null, outreachCount: 1, attachmentCount: 2, status: "cooperating" },
    ];
    const connection = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("FROM influencer_bd_creators c") && sql.includes("FOR UPDATE")) return [lockedRows, []];
      if (sql.includes("SELECT id,creatorId FROM influencer_bd_outreach_logs")) return [[{ id: 501, creatorId: 10 }, { id: 502, creatorId: 10 }], []];
      if (sql.includes("SELECT id,creatorId FROM influencer_bd_attachments")) return [[{ id: 601, creatorId: 10 }], []];
      if (sql.includes("UPDATE influencer_bd_outreach_logs")) return [{ affectedRows: 2 }, []];
      if (sql.includes("UPDATE influencer_bd_attachments")) return [{ affectedRows: 1 }, []];
      if (sql.includes("SELECT * FROM influencer_bd_creators WHERE id=?")) return [[{ id: 11, displayName: "Real TikTok Name", normalizedHandle: "creator.one" }], []];
      if (sql.includes("UPDATE influencer_bd_creators")) return [{ affectedRows: 1 }, []];
      if (sql.includes("INSERT INTO influencer_bd_audit_logs")) return [{ insertId: 1 }, []];
      if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller(adminContext);
    await expect(caller.dedupeCreators(confirmedDedupeInput(lockedRows))).resolves.toEqual({
      duplicateGroupCount: 1,
      mergedRecordCount: 1,
      normalizedRecordCount: 0,
      movedOutreachCount: 2,
      movedAttachmentCount: 1,
    });
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    const sql = connection.query.mock.calls.map(call => String(call[0])).join("\n");
    expect(sql).toContain("UPDATE influencer_bd_outreach_logs SET creatorId=?");
    expect(sql).toContain("UPDATE influencer_bd_attachments SET creatorId=?");
    expect(sql).toContain("status='archived'");
    const auditCalls = connection.query.mock.calls.filter(call => String(call[0]).includes("INSERT INTO influencer_bd_audit_logs"));
    expect(auditCalls).toHaveLength(5);
    const auditPayload = JSON.stringify(auditCalls.map(call => call[1]));
    expect(auditPayload).toContain("501");
    expect(auditPayload).toContain("601");
    expect(auditPayload).not.toContain("Real TikTok Name");
    expect(auditPayload).not.toContain("creator.one");
    expect(auditPayload).not.toContain("private-note");
    expect(auditPayload).not.toContain("private-contact");
  });

  it("does not reactivate a duplicate group when every record was already deleted", async () => {
    const lockedRows = [
      { id: 30, displayName: "creator.old", platform: "TikTok", handle: "creator.old", normalizedHandle: null, deletedAt: "2026-08-01T00:00:00.000Z", outreachCount: 0, attachmentCount: 0, status: "archived" },
      { id: 31, displayName: "Archived Creator Name", platform: "TikTok", handle: "@creator.old", normalizedHandle: "creator.old", deletedAt: "2026-08-02T00:00:00.000Z", outreachCount: 0, attachmentCount: 0, status: "archived" },
    ];
    const connection = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("FROM influencer_bd_creators c") && sql.includes("FOR UPDATE")) return [lockedRows, []];
      if (sql.includes("SELECT id,creatorId FROM influencer_bd_outreach_logs") || sql.includes("SELECT id,creatorId FROM influencer_bd_attachments")) return [[], []];
      if (sql.includes("UPDATE influencer_bd_outreach_logs") || sql.includes("UPDATE influencer_bd_attachments")) return [{ affectedRows: 0 }, []];
      if (sql.includes("SELECT * FROM influencer_bd_creators WHERE id=?")) return [[{ id: 31, displayName: "Archived Creator Name", deletedAt: "2026-08-02T00:00:00.000Z" }], []];
      if (sql.includes("UPDATE influencer_bd_creators")) return [{ affectedRows: 1 }, []];
      if (sql.includes("INSERT INTO influencer_bd_audit_logs")) return [{ insertId: 1 }, []];
      if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller(adminContext);
    await caller.dedupeCreators(confirmedDedupeInput(lockedRows));
    const keeperUpdate = connection.query.mock.calls.find(call => String(call[0]).includes("displayName=?,handle=?,normalizedHandle=?"));
    expect(keeperUpdate).toBeTruthy();
    const params = keeperUpdate?.[1] as unknown[];
    expect(params.at(-2)).toBe("2026-08-02T00:00:00.000Z");
  });

  it("fails closed without starting a transaction when another dedupe run holds the lock", async () => {
    const connection = {
      query: vi.fn().mockResolvedValueOnce([[{ acquired: 0 }], []]),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    const caller = influencerBdRouter.createCaller(adminContext);
    await expect(caller.dedupeCreators(emptyConfirmedDedupeInput)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  it("rolls back when the locked data no longer matches the confirmed preview", async () => {
    const connection = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn(),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("FROM influencer_bd_creators c") && sql.includes("FOR UPDATE")) return [[
        { id: 90, displayName: "Creator", platform: "TikTok", handle: "creator.changed", normalizedHandle: "creator.changed", deletedAt: null, outreachCount: 0, attachmentCount: 0 },
      ], []];
      if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller(adminContext);
    await expect(caller.dedupeCreators(emptyConfirmedDedupeInput)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(call => String(call[0]).startsWith("UPDATE"))).toBe(false);
  });

  it("rejects non-admin dedupe requests before database access", async () => {
    const caller = influencerBdRouter.createCaller({
      user: { id: 2, name: "Staff", email: "staff@example.invalid", role: "user" },
    } as any);
    await expect(caller.dedupeCreators(emptyConfirmedDedupeInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.pool.getConnection).not.toHaveBeenCalled();
  });
});
