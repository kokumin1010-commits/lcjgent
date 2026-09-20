import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeTrackedMenuPath } from "./userNavigationUsage";
import { TRACKABLE_ADMIN_MENU_PATHS } from "../shared/adminMenuPaths";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("per-account frequently used navigation", () => {
  it("accepts internal menu routes and rejects external or malformed paths", () => {
    expect(normalizeTrackedMenuPath("/master/finance")).toBe("/master/finance");
    expect(normalizeTrackedMenuPath("/staff-schedule")).toBe("/staff-schedule");
    expect(() => normalizeTrackedMenuPath("https://example.com")).toThrow(
      "INVALID_NAVIGATION_PATH"
    );
    expect(() => normalizeTrackedMenuPath("//example.com/path")).toThrow(
      "INVALID_NAVIGATION_PATH"
    );
    expect(() => normalizeTrackedMenuPath("/master/not-a-real-menu")).toThrow(
      "UNTRACKABLE_NAVIGATION_PATH"
    );
  });

  it("keeps the server allowlist synchronized with every configured sidebar item", () => {
    const menuConfig = read("../client/src/lib/adminMenuConfig.ts");
    const configuredPaths = [...menuConfig.matchAll(/path:\s*"([^"]+)"/g)].map(
      match => match[1]
    );
    expect(new Set(TRACKABLE_ADMIN_MENU_PATHS)).toEqual(
      new Set(configuredPaths)
    );
  });

  it("keys every counter and query to the authenticated account", () => {
    const service = read("./userNavigationUsage.ts");
    expect(service).toContain("PRIMARY KEY (userId, menuPath)");
    expect(service).toContain("WHERE userId=?");
    expect(service).toContain("[ctx.user.id]");
    expect(service).toContain("[ctx.user.id, path]");
    expect(service).toContain("ORDER BY clickCount DESC,lastClickedAt DESC");
  });

  it("shows only permission-filtered top five items and records every menu click", () => {
    const sidebar = read("../client/src/components/DepartmentSidebarMenu.tsx");
    expect(sidebar).toContain("我的常用 · 前5项");
    expect(sidebar).toContain("よく使う項目 · TOP 5");
    expect(sidebar).toContain("visibleItemMap.get(usage.path)");
    expect(sidebar).toContain(".slice(0, 5)");
    expect(sidebar).toContain("recordUsage.mutate({ path })");
    expect(sidebar).toContain("navigateAndRecord(item.path)");
  });

  it("creates storage before listen and exposes only aggregate readiness", () => {
    const index = read("./_core/index.ts");
    const migration = read("../drizzle/0144_user_navigation_usage.sql");
    const journal = read("../drizzle/meta/_journal.json");
    expect(index).toContain("await getNavigationUsageHealth()");
    expect(index).toContain("NAVIGATION_USAGE_STORAGE_UNAVAILABLE");
    expect(index).toContain("/api/health/navigation-usage");
    expect(index).toContain('{ ok: true, storage: "ready" }');
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS `user_navigation_usage`"
    );
    expect(journal).toContain('"tag": "0144_user_navigation_usage"');
  });
});
