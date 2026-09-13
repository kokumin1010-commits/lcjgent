import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";

const enabled = process.env.LCJ_BRAND_DAY_ADMIN_REVIEW_E2E === "1";
const describeReview = enabled ? describe : describe.skip;
const databaseUrl = process.env.LCJ_BRAND_DAY_TEST_DATABASE_URL || "mysql://brandday_test:brandday_test@127.0.0.1:3306/lcj_brandday_test";

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://storage.test/${key}` })),
  storageGet: vi.fn(async (key: string) => ({ key, url: `https://storage.test/${key}` })),
  storageDelete: vi.fn(async (key: string) => ({ key })),
}));

describeReview("Brand Day administrator review flow", () => {
  let pool: mysql.Pool;
  let router: any;
  let publicRouter: any;
  let eventId = 0;
  let accountId = 0;
  let adminId = 0;
  let validPendingId = 0;
  let outsidePendingId = 0;
  let rejectedPendingId = 0;
  let deleteTargetId = 0;
  const slug = "admin-review-brand";
  const adminEmail = "brandday-admin-review@example.com";

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    pool = mysql.createPool(databaseUrl);
    await pool.query("CREATE TABLE IF NOT EXISTS brands (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NULL, nameJa VARCHAR(255) NULL, deletedAt DATETIME NULL)");
    await pool.query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, name VARCHAR(255) NULL, role VARCHAR(32) NOT NULL DEFAULT 'user')");
    await pool.query("DELETE FROM brand_day_events WHERE slug = ?", [slug]);
    await pool.query("DELETE FROM users WHERE email = ?", [adminEmail]);
    const [userResult] = await pool.query("INSERT INTO users (email,password,name,role) VALUES (?,'test-hash','Brand Day Review Admin','admin')", [adminEmail]);
    adminId = Number((userResult as any).insertId);
    const [eventResult] = await pool.query(
      "INSERT INTO brand_day_events (slug,title,short_name,timezone,event_start_at,event_end_at,minimum_stream_minutes,status,source_system,source_event_id,rules_json) VALUES (?,?,?,'Asia/Tokyo',?,?,60,'active','admin-review-test',?,?)",
      [slug, "Admin Review Brand Day", "REVIEW", new Date("2026-09-08T00:00:00.000Z"), new Date("2026-09-10T14:59:59.000Z"), slug, JSON.stringify({ brandKeywords: ["KG"] })],
    );
    eventId = Number((eventResult as any).insertId);
    const [accountResult] = await pool.query("INSERT INTO brand_day_creator_accounts (event_id,tiktok_id,tiktok_name,password_hash,status,source_system) VALUES (?, '@review-creator','Review Creator','hash','active','admin-review-test')", [eventId]);
    accountId = Number((accountResult as any).insertId);

    const insertPerformance = async (sessionNumber: number, status: string, reviewDecision: string | null, start: Date, end: Date, hash: string) => {
      const [result] = await pool.query(
        "INSERT INTO brand_day_performances (event_id,creator_account_id,day_number,session_number,stream_date,started_at,ended_at,stream_minutes,total_gmv,brand_gmv,screenshot_hash,ai_status,status,review_decision,review_reason,source_system) VALUES (?,?,1,?,?,?,?,60,100000,60000,?,'completed',?,?,?,'admin-review-test')",
        [eventId, accountId, sessionNumber, new Date("2026-09-08T00:00:00.000Z"), start, end, hash, status, reviewDecision, reviewDecision === "pending" ? "確認待ち" : null],
      );
      const id = Number((result as any).insertId);
      await pool.query("INSERT INTO brand_day_performance_products (event_id,performance_id,product_name,gmv,brand_gmv,is_brand_product,selected,confidence_basis_points,source_system) VALUES (?,?,'KG Product',60000,60000,1,1,9900,'admin-review-test')", [eventId, id]);
      return id;
    };
    validPendingId = await insertPerformance(1, "reviewed", "pending", new Date("2026-09-08T01:00:00.000Z"), new Date("2026-09-08T02:00:00.000Z"), "1".repeat(64));
    outsidePendingId = await insertPerformance(2, "reviewed", "pending", new Date("2026-08-17T10:00:00.000Z"), new Date("2026-08-17T11:00:00.000Z"), "2".repeat(64));
    rejectedPendingId = await insertPerformance(3, "reviewed", "pending", new Date("2026-08-17T10:00:00.000Z"), new Date("2026-08-17T11:00:00.000Z"), "3".repeat(64));
    deleteTargetId = await insertPerformance(4, "reflected", null, new Date("2026-09-08T03:00:00.000Z"), new Date("2026-09-08T04:00:00.000Z"), "4".repeat(64));

    const imported = await import("./brandDayRouter");
    router = imported.brandDayRouter;
    publicRouter = (await import("./brandDayPublicRouter")).brandDayPublicRouter;
  });

  afterAll(async () => {
    if (pool) {
      await pool.query("DELETE FROM brand_day_events WHERE slug = ?", [slug]);
      await pool.query("DELETE FROM users WHERE email = ?", [adminEmail]);
      await pool.end();
    }
  });

  const adminCaller = () => router.createCaller({ user: { id: adminId, email: adminEmail, name: "Brand Day Review Admin", role: "admin" }, req: { protocol: "https", hostname: "localhost", headers: {} }, res: {} } as any);
  const publicCaller = () => publicRouter.createCaller({ user: null, req: { protocol: "https", hostname: "localhost", headers: {} }, res: {} } as any);

  it("keeps pending records off the leaderboard, approves valid time, and requires force approval for outside time", async () => {
    const before = await publicCaller().leaderboard({ slug, dayNumber: 0 });
    expect(before.sales).toHaveLength(1);
    expect(before.sales[0]).toMatchObject({ performanceCount: 1, brandGmv: 60_000, streamMinutes: 60 });

    const approved = await adminCaller().reviewPerformance({ eventId, performanceId: validPendingId, decision: "approve", products: [{ productName: "KG Product", gmv: 60_000, isBrandProduct: true, selected: true, confidenceBasisPoints: 9900 }] });
    expect(approved).toMatchObject({ outcome: "approved", approvedMinutes: 60, brandGmv: 60_000 });
    await expect(adminCaller().reviewPerformance({ eventId, performanceId: outsidePendingId, decision: "approve" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(adminCaller().reviewPerformance({ eventId, performanceId: outsidePendingId, decision: "force_approve" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const forced = await adminCaller().reviewPerformance({ eventId, performanceId: outsidePendingId, decision: "force_approve", reason: "原画像と配信証拠を確認済み", streamMinutes: 60 });
    expect(forced).toMatchObject({ outcome: "force_approved", approvedMinutes: 60 });

    const after = await publicCaller().leaderboard({ slug, dayNumber: 0 });
    expect(after.sales).toHaveLength(1);
    expect(after.sales[0]).toMatchObject({ performanceCount: 3, brandGmv: 180_000, streamMinutes: 180 });
  });

  it("rejects with a required reason, deletes only the selected performance, and preserves the creator account", async () => {
    await expect(adminCaller().reviewPerformance({ eventId, performanceId: rejectedPendingId, decision: "reject" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const rejected = await adminCaller().reviewPerformance({ eventId, performanceId: rejectedPendingId, decision: "reject", reason: "原画像の日時を再確認してください" });
    expect(rejected).toMatchObject({ outcome: "rejected" });

    const beforeAccount = await pool.query("SELECT COUNT(*) AS total FROM brand_day_creator_accounts WHERE id = ?", [accountId]);
    expect(Number((beforeAccount[0] as any[])[0].total)).toBe(1);
    await expect(router.createCaller({ user: null, req: {}, res: {} } as any).deletePerformance({ eventId, performanceId: deleteTargetId, reason: "test cleanup" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await adminCaller().deletePerformance({ eventId, performanceId: deleteTargetId, reason: "重複テストデータの削除" });
    const [performanceRows] = await pool.query("SELECT COUNT(*) AS total FROM brand_day_performances WHERE id = ?", [deleteTargetId]);
    const [productRows] = await pool.query("SELECT COUNT(*) AS total FROM brand_day_performance_products WHERE performance_id = ?", [deleteTargetId]);
    const [accountRows] = await pool.query("SELECT COUNT(*) AS total FROM brand_day_creator_accounts WHERE id = ?", [accountId]);
    const [auditRows] = await pool.query("SELECT action FROM brand_day_audit_logs WHERE event_id = ? AND action IN ('performance.approved','performance.force_approved','performance.rejected','performance.deleted')", [eventId]);
    expect(Number((performanceRows as any[])[0].total)).toBe(0);
    expect(Number((productRows as any[])[0].total)).toBe(0);
    expect(Number((accountRows as any[])[0].total)).toBe(1);
    expect(new Set((auditRows as any[]).map(row => row.action))).toEqual(new Set(["performance.approved", "performance.force_approved", "performance.rejected", "performance.deleted"]));
  });
});
