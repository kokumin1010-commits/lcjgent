import { createHash } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import type { TrpcContext } from "./_core/context";

const enabled = process.env.LCJ_BRAND_DAY_MIGRATION_E2E === "1";
const describeMigration = enabled ? describe : describe.skip;
const databaseUrl = process.env.LCJ_BRAND_DAY_TEST_DATABASE_URL || "mysql://brandday_test:brandday_test@127.0.0.1:3306/lcj_brandday_test";
const imageBytes = Buffer.from("lcj-brand-day-migration-image");
const imageHash = createHash("sha256").update(imageBytes).digest("hex");

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://storage.test/${key}` })),
  storageGet: vi.fn(async (key: string) => ({ key, url: `https://storage.test/${key}` })),
  storageDelete: vi.fn(async (key: string) => ({ key })),
}));

describeMigration("KGDAY native migration", () => {
  let appRouter: any;
  let pool: mysql.Pool;
  let caller: any;

  const manifest: any = {
    sourceSystem: "kgday-manus",
    sourceEventId: "kgday-migration-test",
    migrationKey: "kgday-native-migration-integration-v1",
    event: {
      slug: "kgday-migration-test", title: "KGDAY Migration Test", shortName: "KGDAY TEST", timezone: "Asia/Tokyo",
      eventStartAt: "2026-09-08T00:00:00.000Z", eventEndAt: "2026-09-10T14:59:59.999Z", registrationOpenAt: null, registrationCloseAt: "2026-09-07T09:00:00.000Z",
      minimumStreamMinutes: 60, status: "closed", legacyBaseUrl: "https://kgdayreco-2kqllucq.manus.space", theme: { background: "cosmic" }, rules: { brandKeywords: ["KG"] },
    },
    entries: [{ sourceEntryId: 101, registrationName: "Migration Test", tiktokId: "@migration-test", tiktokName: "Migration Test", lineId: "line-test", phone: "000000", email: "migration-test@example.com", dashboardPasswordHash: "$2b$12$012345678901234567890u012345678901234567890123456789012", status: "approved", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
    accounts: [{ sourceAccountId: 201, sourceEntryId: 101, tiktokId: "@migration-test", tiktokName: "Migration Test", passwordHash: "$2b$12$012345678901234567890u012345678901234567890123456789012", status: "active", lastSignedInAt: null, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
    performances: [{ sourcePerformanceId: 301, sourceAccountId: 201, dayNumber: 1, sessionNumber: 1, streamDate: "2026-09-08T00:00:00.000Z", startedAt: "2026-09-08T01:00:00.000Z", endedAt: "2026-09-08T02:00:00.000Z", streamMinutes: 60, totalGmv: 100000, brandGmv: 60000, screenshotHash: imageHash, screenshotMimeType: "image/png", screenshotDownloadUrl: "https://source.test/image.png", aiStatus: "completed", aiModel: "test-model", aiReport: { recognition: { mode: "ai" } }, status: "reflected", reviewDecision: null, reviewReason: null, forceIncludeOutsideWindow: false, reviewedAt: null, createdAt: "2026-09-08T02:00:00.000Z", updatedAt: "2026-09-08T02:00:00.000Z" }],
    products: [{ sourceProductId: 401, sourcePerformanceId: 301, productName: "KG Product", gmv: 60000, brandGmv: 60000, isBrandProduct: true, selected: true, confidenceBasisPoints: 9800, createdAt: "2026-09-08T02:00:00.000Z", updatedAt: "2026-09-08T02:00:00.000Z" }],
    audits: [{ sourceAuditId: 501, sourceAccountId: 201, action: "auto_reflected", entityType: "creator_performance", sourceEntityId: 301, detail: { source: "ai" }, createdAt: "2026-09-08T02:00:00.000Z" }],
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(imageBytes, { status: 200, headers: { "content-type": "image/png" } })));
    ({ appRouter } = await import("./routers"));
    pool = mysql.createPool(databaseUrl);
    await pool.query("DELETE FROM brand_day_migration_runs WHERE source_system = 'kgday-manus' AND migration_key = ?", [manifest.migrationKey]);
    await pool.query("DELETE FROM brand_day_events WHERE source_system = 'kgday-manus' AND source_event_id = ?", [manifest.sourceEventId]);
    const now = new Date();
    const ctx = {
      user: { id: 1, openId: "migration-admin", email: "admin@example.com", name: "Migration Admin", loginMethod: "test", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now },
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: {},
    } as TrpcContext;
    caller = appRouter.createCaller(ctx);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query("DELETE FROM brand_day_events WHERE source_system = 'kgday-manus' AND source_event_id = ?", [manifest.sourceEventId]);
      await pool.query("DELETE FROM brand_day_migration_runs WHERE source_system = 'kgday-manus' AND migration_key = ?", [manifest.migrationKey]);
      await pool.end();
    }
    vi.unstubAllGlobals();
  });

  it("previews references and imports every source table exactly once", async () => {
    const manifestSha256 = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
    const preview = await caller.brandDay.migration.preview({ manifest, manifestSha256 });
    expect(preview.valid).toBe(true);
    expect(preview.counts).toEqual({ entries: 1, accounts: 1, performances: 1, products: 1, audits: 1, screenshots: 1 });

    const first = await caller.brandDay.migration.run({ manifest, manifestSha256, brandId: null });
    expect(first.idempotent).toBe(false);
    expect(first.sourceCounts).toEqual(first.targetCounts);
    const second = await caller.brandDay.migration.run({ manifest, manifestSha256, brandId: null });
    expect(second.idempotent).toBe(true);
    expect(second.targetCounts).toEqual(first.targetCounts);

    const [events] = await pool.query("SELECT id FROM brand_day_events WHERE source_system = 'kgday-manus' AND source_event_id = ?", [manifest.sourceEventId]);
    const eventId = Number((events as any[])[0].id);
    const [counts] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM brand_day_entries WHERE event_id = ?) AS entries,
        (SELECT COUNT(*) FROM brand_day_creator_accounts WHERE event_id = ?) AS accounts,
        (SELECT COUNT(*) FROM brand_day_performances WHERE event_id = ?) AS performances,
        (SELECT COUNT(*) FROM brand_day_performance_products WHERE event_id = ?) AS products,
        (SELECT COUNT(*) FROM brand_day_audit_logs WHERE event_id = ?) AS audits`,
      [eventId, eventId, eventId, eventId, eventId],
    );
    expect(counts).toEqual([{ entries: 1, accounts: 1, performances: 1, products: 1, audits: 1 }]);
  }, 30_000);
});
