import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BRAND_DAY_PAGE_KEY, validateBrandDayWindow } from "./brandDayRouter";
import { assertSchemaOnlyMigration } from "./brandDaySchemaUpgrade";

describe("brand day native foundation", () => {
  it("uses the LCJ page permission key and registers the router", () => {
    const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const menuSource = readFileSync(new URL("../client/src/lib/adminMenuConfig.ts", import.meta.url), "utf8");
    expect(BRAND_DAY_PAGE_KEY).toBe("/master/brand-days");
    expect(routerSource).toContain("brandDay: brandDayRouter");
    expect(menuSource).toContain('path: "/master/brand-days"');
  });

  it("rejects an event window whose end is not later than its start", () => {
    expect(() => validateBrandDayWindow({ eventStartAt: 2000, eventEndAt: 1000 })).toThrow(
      "終了日時は開始日時より後",
    );
  });

  it("accepts the KGDAY JST window stored as UTC timestamps", () => {
    expect(() => validateBrandDayWindow({
      eventStartAt: Date.parse("2026-09-08T00:00:00.000Z"),
      eventEndAt: Date.parse("2026-09-10T14:59:59.999Z"),
    })).not.toThrow();
  });

  it("defines every required native table in the migration", () => {
    const migration = readFileSync(new URL("../drizzle/0139_brand_day_native.sql", import.meta.url), "utf8");
    for (const table of [
      "brand_day_events",
      "brand_day_entries",
      "brand_day_creator_accounts",
      "brand_day_creator_sessions",
      "brand_day_performances",
      "brand_day_performance_products",
      "brand_day_audit_logs",
      "brand_day_migration_runs",
    ]) {
      expect(migration).toContain(`\`${table}\``);
    }
  });

  it("allows only CREATE-only startup schema migrations", () => {
    expect(() => assertSchemaOnlyMigration("CREATE TABLE IF NOT EXISTS safe_table (id INT);"))
      .not.toThrow();
    expect(() => assertSchemaOnlyMigration("DROP TABLE safe_table"))
      .toThrow("CREATE-only");
    expect(() => assertSchemaOnlyMigration("ALTER TABLE safe_table ADD COLUMN name TEXT"))
      .toThrow("CREATE-only");
    expect(() => assertSchemaOnlyMigration("CREATE TABLE IF NOT EXISTS safe_table (parent_id INT, updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE)"))
      .not.toThrow();
  });
});
