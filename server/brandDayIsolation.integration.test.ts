import { beforeAll, afterAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

const enabled = process.env.LCJ_BRAND_DAY_ISOLATION_E2E === "1";
const describeIsolation = enabled ? describe : describe.skip;
const databaseUrl = process.env.LCJ_BRAND_DAY_TEST_DATABASE_URL || "mysql://brandday_test:brandday_test@127.0.0.1:3306/lcj_brandday_test";

describeIsolation("Brand Day multi-event isolation", () => {
  let pool: mysql.Pool;
  let publicCaller: any;
  let adminCaller: any;
  const slugs = ["isolation-brand-a", "isolation-brand-b"];

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    pool = mysql.createPool(databaseUrl);
    await pool.query("CREATE TABLE IF NOT EXISTS brands (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NULL, nameJa VARCHAR(255) NULL, deletedAt DATETIME NULL)");
    for (const slug of slugs) await pool.query("DELETE FROM brand_day_events WHERE slug = ?", [slug]);
    const now = new Date();
    const { brandDayPublicRouter } = await import("./brandDayPublicRouter");
    const { brandDayRouter } = await import("./brandDayRouter");
    publicCaller = brandDayPublicRouter.createCaller({ user: null, req: { headers: {}, cookies: {} }, res: {} } as any);
    adminCaller = brandDayRouter.createCaller({ user: { id: 1, openId: "admin", email: "admin@example.com", name: "Admin", loginMethod: "test", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { headers: {}, cookies: {} }, res: {} } as any);

    for (let index = 0; index < slugs.length; index += 1) {
      const slug = slugs[index];
      const [eventResult] = await pool.query(
        "INSERT INTO brand_day_events (slug,title,short_name,timezone,event_start_at,event_end_at,minimum_stream_minutes,status,source_system,source_event_id) VALUES (?,?,?,'Asia/Tokyo',?,?,60,'active','isolation-test',?)",
        [slug, `Isolation Brand ${index + 1}`, `BRAND ${index + 1}`, new Date("2026-09-08T00:00:00.000Z"), new Date("2026-09-10T14:59:59.000Z"), slug],
      );
      const eventId = Number((eventResult as any).insertId);
      const [accountResult] = await pool.query(
        "INSERT INTO brand_day_creator_accounts (event_id,tiktok_id,tiktok_name,password_hash,status,source_system,source_account_id) VALUES (?,?,?,'hash','active','isolation-test',?)",
        [eventId, "@same-user", `Creator ${index + 1}`, index + 1],
      );
      const accountId = Number((accountResult as any).insertId);
      const [performanceResult] = await pool.query(
        "INSERT INTO brand_day_performances (event_id,creator_account_id,day_number,session_number,stream_date,started_at,ended_at,stream_minutes,total_gmv,brand_gmv,screenshot_hash,ai_status,status,source_system,source_performance_id) VALUES (?,?,1,1,?,?,?,60,?,?,?,'completed','reflected','isolation-test',?)",
        [eventId, accountId, new Date("2026-09-08T00:00:00.000Z"), new Date("2026-09-08T01:00:00.000Z"), new Date("2026-09-08T02:00:00.000Z"), (index + 1) * 100_000, (index + 1) * 60_000, "a".repeat(64), index + 1],
      );
      await pool.query("INSERT INTO brand_day_performance_products (event_id,performance_id,product_name,gmv,brand_gmv,is_brand_product,selected,source_system,source_product_id) VALUES (?,?,?, ?, ?,1,1,'isolation-test',?)", [eventId, Number((performanceResult as any).insertId), `Product ${index + 1}`, (index + 1) * 60_000, (index + 1) * 60_000, index + 1]);
    }
  });

  afterAll(async () => {
    if (pool) {
      for (const slug of slugs) await pool.query("DELETE FROM brand_day_events WHERE slug = ?", [slug]);
      await pool.end();
    }
  });

  it("isolates public leaderboard values by slug", async () => {
    const first = await publicCaller.leaderboard({ slug: slugs[0], dayNumber: 0 });
    const second = await publicCaller.leaderboard({ slug: slugs[1], dayNumber: 0 });
    expect(first.sales).toHaveLength(1);
    expect(second.sales).toHaveLength(1);
    expect(first.sales[0]).toMatchObject({ tiktokName: "Creator 1", brandGmv: 60_000, streamMinutes: 60 });
    expect(second.sales[0]).toMatchObject({ tiktokName: "Creator 2", brandGmv: 120_000, streamMinutes: 60 });
  });

  it("keeps admin aggregate counts independent per event", async () => {
    const rows = await adminCaller.listEvents({ search: "Isolation Brand" });
    expect(rows).toHaveLength(2);
    expect(rows.map((row: any) => ({ slug: row.slug, performances: row.performanceCount, gmv: row.reflectedBrandGmv }))).toEqual([
      { slug: slugs[1], performances: 1, gmv: 120_000 },
      { slug: slugs[0], performances: 1, gmv: 60_000 },
    ]);
  });

  it("allows the same image hash across brands but rejects it within one creator", async () => {
    const [rows] = await pool.query("SELECT event_id AS eventId, creator_account_id AS accountId FROM brand_day_performances WHERE source_system = 'isolation-test' ORDER BY event_id");
    expect((rows as any[])).toHaveLength(2);
    await expect(pool.query(
      "INSERT INTO brand_day_performances (event_id,creator_account_id,day_number,session_number,stream_date,screenshot_hash,ai_status,status,source_system,source_performance_id) VALUES (?,?,1,2,?,?,'completed','draft','isolation-test',99)",
      [Number((rows as any[])[0].eventId), Number((rows as any[])[0].accountId), new Date("2026-09-08T00:00:00.000Z"), "a".repeat(64)],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });
});
