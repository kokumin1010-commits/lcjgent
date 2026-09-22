import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const pool = { query: vi.fn(), getConnection: vi.fn() };
  return { pool, createPool: vi.fn(() => pool) };
});

vi.mock("mysql2/promise", () => ({
  default: { createPool: mocks.createPool },
  createPool: mocks.createPool,
}));

import {
  assertCreatorProfileUrlMatches,
  consumeInfluencerCreatorImportQuota,
  enrichInfluencerCreatorImportPreviewForUser,
  influencerBdRouter,
  issueInfluencerCreatorImportPreviewForUser,
} from "./influencerBdRouter";

const basePreview = {
  version: "influencer-creator-import-v1" as const,
  sourceType: "spreadsheet" as const,
  fileName: "creators.xlsx",
  sheetName: "达人",
  model: null,
  deterministic: true,
  warnings: [],
  totalSourceRows: 1,
  truncated: false,
  rows: [{
    sourceKey: "达人:2",
    sourceSheet: "达人",
    sourceRow: 2,
    displayName: "Candidate",
    platform: "TikTok" as const,
    handle: "candidate.user",
    profileUrl: "https://www.tiktok.com/@candidate.user",
    followerCount: null,
    category: null,
    country: null,
    language: null,
    contactInfo: null,
    ownerStaffName: null,
    status: "potential" as const,
    notes: null,
    confidence: "high" as const,
    warnings: [],
    eligible: true,
  }],
};

beforeEach(() => {
  process.env.DATABASE_URL = "mysql://test.invalid/db";
  mocks.pool.query.mockReset();
  mocks.pool.getConnection.mockReset();
  mocks.createPool.mockClear();
});

describe("influencer creator import router behavior", () => {
  it("binds every supported known-platform profile URL to the same handle", () => {
    const valid: Array<[string, string, string | null]> = [
      ["TikTok", "tok.creator", "https://www.tiktok.com/@tok.creator"],
      ["Instagram", "insta.creator", "https://www.instagram.com/insta.creator/"],
      ["X", "x_creator", "https://x.com/x_creator"],
      ["YouTube", "youtube.creator", "https://www.youtube.com/@youtube.creator"],
      ["LINE", "line.creator", "https://page.line.me/line.creator"],
      ["WeChat", "wechat.creator", null],
    ];
    for (const [platform, handle, profileUrl] of valid) {
      expect(() => assertCreatorProfileUrlMatches(platform, handle, profileUrl)).not.toThrow();
    }
    for (const platform of ["TikTok", "Instagram", "X", "YouTube", "LINE"]) {
      expect(() => assertCreatorProfileUrlMatches(platform, "creator.user", null)).toThrow();
      expect(() => assertCreatorProfileUrlMatches(platform, "creator.user", "")).toThrow();
    }
    expect(() => assertCreatorProfileUrlMatches("WeChat", "wechat.creator", "")).not.toThrow();

    const invalid: Array<[string, string, string]> = [
      ["TikTok", "tok.creator", "https://www.tiktok.com/login"],
      ["Instagram", "explore", "https://www.instagram.com/explore/"],
      ["X", "messages", "https://x.com/messages"],
      ["YouTube", "youtube.creator", "https://www.youtube.com/watch?v=abc"],
      ["YouTube", "youtube.creator", "https://www.youtube.com/@someone.else"],
      ["LINE", "line.creator", "https://line.me/login"],
      ["WeChat", "wechat.creator", "https://mp.weixin.qq.com/s/article"],
    ];
    for (const [platform, handle, profileUrl] of invalid) {
      expect(() => assertCreatorProfileUrlMatches(platform, handle, profileUrl)).toThrow();
    }
  });

  it("rejects handle/profile mismatches through the actual tokenized import mutation", async () => {
    mocks.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name FROM staff") && sql.includes("LOWER(email)")) return [[], []];
      if (sql.includes("SELECT id,displayName,platform,normalizedHandle")) return [[], []];
      if (sql.includes("SELECT id,name FROM staff WHERE isActive")) return [[], []];
      if (sql.includes("INSERT INTO influencer_bd_creator_import_previews")) return [{ affectedRows: 1 }, []];
      if (sql.includes("DELETE FROM influencer_bd_creator_import_previews")) return [{ affectedRows: 0 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const cases = [
      ["TikTok", "creator.one", "https://www.tiktok.com/@creator.two"],
      ["Instagram", "creator.one", "https://www.instagram.com/creator.two/"],
      ["X", "creator.one", "https://x.com/creator.two"],
      ["YouTube", "creator.one", "https://www.youtube.com/@creator.two"],
      ["LINE", "creator.one", "https://page.line.me/creator.two"],
      ["WeChat", "creator.one", "https://mp.weixin.qq.com/s/article"],
    ] as const;
    for (const [platform, handle, profileUrl] of cases) {
      const row = { ...basePreview.rows[0], platform, handle, profileUrl } as any;
      const issued = await issueInfluencerCreatorImportPreviewForUser({
        id: 1, name: "Admin", email: "admin@example.invalid", role: "admin",
      }, { ...basePreview, rows: [row] });
      const connection = {
        query: vi.fn().mockResolvedValue([[], []]), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
      };
      mocks.pool.getConnection.mockResolvedValueOnce(connection);
      const caller = influencerBdRouter.createCaller({ user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" } } as any);
      await expect(caller.importCreators({
        importVersion: "influencer-creator-import-v1",
        previewToken: issued.previewToken,
        rows: [{ sourceKey: row.sourceKey, displayName: row.displayName, platform, handle, profileUrl, followerCount: null, category: null, country: null, language: null, contactInfo: null }],
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(connection.beginTransaction).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalledTimes(1);
    }
  });

  it("issues an actor-bound one-time preview token for image recognition too", async () => {
    mocks.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name FROM staff") && sql.includes("LOWER(email)")) return [[], []];
      if (sql.includes("SELECT id,displayName,platform,normalizedHandle")) return [[], []];
      if (sql.includes("SELECT id,name FROM staff WHERE isActive")) return [[], []];
      if (sql.includes("INSERT INTO influencer_bd_creator_import_previews")) return [{ affectedRows: 1 }, []];
      if (sql.includes("DELETE FROM influencer_bd_creator_import_previews")) return [{ affectedRows: 0 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const result = await issueInfluencerCreatorImportPreviewForUser({
      id: 1, name: "Admin", email: "admin@example.invalid", role: "admin",
    }, { ...basePreview, sourceType: "image", sheetName: null, fileName: "profile.png", model: "gemini-3-flash-preview", deterministic: false });
    expect(result.previewToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(result.rows[0].eligible).toBe(true);
  });

  it("blocks a globally duplicate handle without leaking another owner's creator name or id", async () => {
    mocks.pool.query
      .mockResolvedValueOnce([[{ id: 12, name: "Current Staff" }], []])
      .mockResolvedValueOnce([[
        { id: 88, displayName: "Private Creator Name", platform: "TikTok", normalizedHandle: "candidate.user", ownerStaffId: 99, createdById: 999, deletedAt: null },
      ], []]);

    const result = await enrichInfluencerCreatorImportPreviewForUser({
      id: 7,
      name: "Current User",
      email: "current@example.invalid",
      role: "user",
    }, basePreview);

    expect(result.rows[0]).toMatchObject({ eligible: false, existingCreatorId: null, existingCreatorName: null });
    expect(result.rows[0].warnings).toContain("系统已有该账号，无法重复导入");
    expect(JSON.stringify(result)).not.toContain("Private Creator Name");
    expect(JSON.stringify(result)).not.toContain('"existingCreatorId":88');
  });

  it("commits selected creators atomically and redacts contact information from audit JSON", async () => {
    let issuedRowHashes = "{}";
    mocks.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT id,name FROM staff") && sql.includes("LOWER(email)")) return [[], []];
      if (sql.includes("SELECT id,displayName,platform,normalizedHandle")) return [[], []];
      if (sql.includes("SELECT id,name FROM staff WHERE isActive")) return [[], []];
      if (sql.includes("INSERT INTO influencer_bd_creator_import_previews")) {
        issuedRowHashes = String(params?.[2] || "{}");
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("DELETE FROM influencer_bd_creator_import_previews")) return [{ affectedRows: 0 }, []];
      throw new Error(`Unexpected pool SQL: ${sql}`);
    });
    const issued = await issueInfluencerCreatorImportPreviewForUser({
      id: 1, name: "Admin", email: "admin@example.invalid", role: "admin",
    }, { ...basePreview, rows: [{ ...basePreview.rows[0], displayName: "Imported Creator", handle: "imported.creator", profileUrl: "https://www.tiktok.com/@imported.creator", followerCount: 46900, category: "美容", language: "日本語", contactInfo: "private-contact" }] });
    expect(issued.previewToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const connection = {
      query: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name FROM staff") && sql.includes("LOWER(email)")) return [[], []];
      if (sql.includes("FROM influencer_bd_creator_import_previews") && sql.includes("FOR UPDATE")) return [[{ rowHashesJson: issuedRowHashes, eligibleCount: 1 }], []];
      if (sql.includes("SELECT id,displayName,platform,normalizedHandle,deletedAt")) return [[], []];
      if (sql.includes("INSERT INTO influencer_bd_creators")) return [{ insertId: 501 }, []];
      if (sql.includes("INSERT INTO influencer_bd_audit_logs")) return [{ insertId: 9001 }, []];
      if (sql.includes("UPDATE influencer_bd_creator_import_previews SET consumedAt")) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const caller = influencerBdRouter.createCaller({
      user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" },
    } as any);
    const result = await caller.importCreators({
      importVersion: "influencer-creator-import-v1",
      previewToken: issued.previewToken!,
      defaultOwnerStaffId: null,
      rows: [{
        sourceKey: "达人:2",
        displayName: "Imported Creator",
        platform: "TikTok",
        handle: "imported.creator",
        profileUrl: "https://www.tiktok.com/@imported.creator",
        followerCount: 46900,
        category: "美容",
        country: null,
        language: "日本語",
        contactInfo: "private-contact",
      }],
    });

    expect(result).toEqual({ importedCount: 1, created: [{ id: 501, sourceKey: "达人:2", displayName: "Imported Creator" }] });
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    const auditCall = connection.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO influencer_bd_audit_logs"));
    expect(auditCall).toBeTruthy();
    const auditParams = auditCall?.[1] as unknown[];
    expect(String(auditParams?.[4])).not.toContain("private-contact");
    expect(String(auditParams?.[4])).toContain("contactInfoLength");
    const creatorInsert = connection.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO influencer_bd_creators"));
    expect(creatorInsert?.[1]).toContain("potential");
    expect(creatorInsert?.[1]).toContain(null);
  });

  it("rejects a tampered row before writing and keeps the one-time preview unconsumed", async () => {
    const connection = {
      query: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ rowHashesJson: { invalid: "invalid" }, eligibleCount: 1 }], []]);
    const caller = influencerBdRouter.createCaller({ user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" } } as any);
    await expect(caller.importCreators({
      importVersion: "influencer-creator-import-v1",
      previewToken: "A".repeat(43),
      defaultOwnerStaffId: null,
      rows: [{ sourceKey: "达人:2", displayName: "Tampered", platform: "TikTok", handle: "tampered.user", profileUrl: "https://www.tiktok.com/@tampered.user", followerCount: null, category: null, country: null, language: null, contactInfo: null }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO influencer_bd_creators"))).toBe(false);
    expect(connection.query.mock.calls.some(([sql]) => String(sql).includes("SET consumedAt"))).toBe(false);
  });

  it("enforces user and IP quotas through shared transactional database buckets", async () => {
    const connection = {
      query: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    mocks.pool.query.mockResolvedValue([{ affectedRows: 0 }, []]);
    let selectedBuckets = 0;
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO influencer_bd_import_rate_limits")) return [{ affectedRows: 1 }, []];
      if (sql.includes("SELECT attempts,windowStartedAt")) {
        selectedBuckets += 1;
        return [[{ attempts: selectedBuckets === 1 ? 10 : 30, windowStartedAt: new Date() }], []];
      }
      if (sql.includes("UPDATE influencer_bd_import_rate_limits")) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    await expect(consumeInfluencerCreatorImportQuota({ userId: 7, ipAddress: "203.0.113.7" })).resolves.toBe(false);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.filter(([sql]) => String(sql).includes("FOR UPDATE"))).toHaveLength(2);
  });

  it("rejects an expired or already consumed preview token before creator writes", async () => {
    const connection = {
      query: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    connection.query
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []]);
    const caller = influencerBdRouter.createCaller({ user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" } } as any);
    await expect(caller.importCreators({
      importVersion: "influencer-creator-import-v1",
      previewToken: "R".repeat(43),
      rows: [{ sourceKey: "达人:2", displayName: "Replay", platform: "TikTok", handle: "replay.user", profileUrl: "https://www.tiktok.com/@replay.user", followerCount: null, category: null, country: null, language: null, contactInfo: null }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(connection.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO influencer_bd_creators"))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });

  it("releases the connection when pre-transaction handle validation fails", async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([[], []]), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    const caller = influencerBdRouter.createCaller({ user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" } } as any);
    await expect(caller.importCreators({
      importVersion: "influencer-creator-import-v1",
      previewToken: "V".repeat(43),
      rows: [{ sourceKey: "达人:2", displayName: "Invalid", platform: "TikTok", handle: "***", profileUrl: null, followerCount: null, category: null, country: null, language: null, contactInfo: null }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it("rejects a known-platform URL that is not a matching creator profile path", async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([[], []]), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    };
    mocks.pool.getConnection.mockResolvedValue(connection);
    const caller = influencerBdRouter.createCaller({ user: { id: 1, name: "Admin", email: "admin@example.invalid", role: "admin" } } as any);
    await expect(caller.importCreators({
      importVersion: "influencer-creator-import-v1",
      previewToken: "P".repeat(43),
      rows: [{ sourceKey: "达人:2", displayName: "Wrong URL", platform: "TikTok", handle: "creator.user", profileUrl: "https://www.tiktok.com/login", followerCount: null, category: null, country: null, language: null, contactInfo: null }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });
});
