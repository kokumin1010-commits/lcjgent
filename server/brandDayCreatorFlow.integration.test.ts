import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";

const enabled = process.env.LCJ_BRAND_DAY_CREATOR_E2E === "1";
const describeFlow = enabled ? describe : describe.skip;
const databaseUrl = process.env.LCJ_BRAND_DAY_TEST_DATABASE_URL || "mysql://brandday_test:brandday_test@127.0.0.1:3306/lcj_brandday_test";

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://storage.test/${key}` })),
  storageGet: vi.fn(async (key: string) => ({ key, url: `https://storage.test/${key}` })),
  storageDelete: vi.fn(async (key: string) => ({ key })),
}));
vi.mock("./brandDayRecognition", () => ({
  recognizeBrandDayScreenshot: vi.fn(async () => ({ readable: true, timeReadable: true, totalGmv: 100_000, streamMinutes: 60, liveStartedAtJst: "2026-09-08T10:00", liveEndedAtJst: "2026-09-08T11:00", timeEvidence: "header", products: [{ productName: "KG Product", gmv: 60_000, isBrandProduct: true, confidenceBasisPoints: 9900 }], notes: "ok", model: "test-model" })),
  classifyScreenshotRecognitionError: vi.fn(() => "AI_SERVICE_UNAVAILABLE"),
  screenshotRecognitionErrorMessage: vi.fn(() => "AI unavailable"),
}));

describeFlow("Brand Day creator native flow", () => {
  let pool: mysql.Pool;
  let publicCaller: any;
  let creatorRouter: any;
  const slug = "creator-flow-brand";
  const otherSlug = "creator-flow-other";
  let creatorCookie = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    pool = mysql.createPool(databaseUrl);
    await pool.query("CREATE TABLE IF NOT EXISTS brands (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NULL, nameJa VARCHAR(255) NULL, deletedAt DATETIME NULL)");
    await pool.query("DELETE FROM brand_day_events WHERE slug IN (?, ?)", [slug, otherSlug]);
    for (const currentSlug of [slug, otherSlug]) await pool.query(
      "INSERT INTO brand_day_events (slug,title,short_name,timezone,event_start_at,event_end_at,minimum_stream_minutes,status,source_system,source_event_id,rules_json) VALUES (?,?,?,'Asia/Tokyo',?,?,60,'active','creator-flow-test',?,?)",
      [currentSlug, `Creator Flow ${currentSlug}`, "KGDAY", new Date("2026-09-08T00:00:00.000Z"), new Date("2026-09-10T14:59:59.000Z"), currentSlug, JSON.stringify({ brandKeywords: ["KG"] })],
    );
    const imported = await import("./brandDayPublicRouter");
    creatorRouter = imported.brandDayCreatorRouter;
    publicCaller = imported.brandDayPublicRouter.createCaller({ user: null, req: { protocol: "https", hostname: "localhost", headers: {} }, res: {} } as any);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query("DELETE FROM brand_day_events WHERE slug IN (?, ?)", [slug, otherSlug]);
      await pool.end();
    }
  });

  it("registers, logs in, uploads, auto-reflects and isolates the creator session by slug", async () => {
    const credentials = { slug, registrationName: "Creator Test", tiktokId: "@creator-flow-test", tiktokName: "Creator Test", lineId: "line-test", phone: "000000", email: "creator-flow@example.com", password: "password123", passwordConfirmation: "password123", website: "" };
    const entry = await publicCaller.enter(credentials);
    expect(entry.success).toBe(true);

    const loginCaller = creatorRouter.createCaller({
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { cookie: (_name: string, value: string) => { creatorCookie = value; }, clearCookie: () => undefined },
    } as any);
    const login = await loginCaller.login({ slug, tiktokId: credentials.tiktokId, password: credentials.password });
    expect(login.slug).toBe(slug);
    expect(creatorCookie.length).toBeGreaterThan(20);

    const caller = creatorRouter.createCaller({ user: null, req: { protocol: "https", hostname: "localhost", headers: { cookie: `lcj_brand_day_creator_session=${creatorCookie}` } }, res: { cookie: () => undefined, clearCookie: () => undefined } } as any);
    await expect(caller.dashboard({ slug: otherSlug })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const imageData = `data:image/png;base64,${Buffer.from("creator-flow-image-a").toString("base64")}`;
    const draft = await caller.beginScreenshot({ dayNumber: 1, imageData });
    expect(draft).toMatchObject({ mode: "ai", dayNumber: 1, sessionNumber: 1, totalGmv: 100_000, streamMinutes: 60, timeStatus: "valid" });
    const saved = await caller.confirmScreenshot({ performanceId: draft.performanceId, streamMinutes: 60, startedAt: Date.parse("2026-09-08T01:00:00.000Z"), endedAt: Date.parse("2026-09-08T02:00:00.000Z"), totalGmv: 100_000, source: "ai", products: [{ productName: "KG Product", gmv: 60_000, isBrandProduct: true, confidenceBasisPoints: 9900 }] });
    expect(saved.submissionOutcome).toBe("reflected");
    expect(saved.dashboard.totals).toMatchObject({ brandGmv: 60_000, streamMinutes: 60, reflectedCount: 1 });
    const ranking = await publicCaller.leaderboard({ slug, dayNumber: 0 });
    expect(ranking.sales).toHaveLength(1);
    expect(ranking.sales[0]).toMatchObject({ tiktokId: credentials.tiktokId, brandGmv: 60_000, streamMinutes: 60 });
    await expect(caller.beginScreenshot({ dayNumber: 1, imageData })).rejects.toMatchObject({ code: "CONFLICT" });

    const second = await caller.beginScreenshot({ dayNumber: 1, imageData: `data:image/png;base64,${Buffer.from("creator-flow-image-b").toString("base64")}` });
    const pending = await caller.confirmScreenshot({ performanceId: second.performanceId, streamMinutes: 60, startedAt: Date.parse("2026-08-17T10:00:00.000Z"), endedAt: Date.parse("2026-08-17T11:00:00.000Z"), totalGmv: 50_000, source: "manual", products: [{ productName: "Other Product", gmv: 50_000, isBrandProduct: false, confidenceBasisPoints: 0 }] });
    expect(pending.submissionOutcome).toBe("pending_review");
    expect(pending.dashboard.totals).toMatchObject({ brandGmv: 60_000, streamMinutes: 60, reflectedCount: 1, pendingReviewCount: 1 });
  }, 30_000);
});
