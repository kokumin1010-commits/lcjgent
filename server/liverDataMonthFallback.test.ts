import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getJSTMonthKey } from "./db";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const listSource = readFileSync(
  new URL("../client/src/pages/LiverList.tsx", import.meta.url),
  "utf8",
);

function functionSource(name: string, nextName: string): string {
  const start = dbSource.indexOf(`export async function ${name}`);
  const end = dbSource.indexOf(`export async function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return dbSource.slice(start, end);
}

describe("liver latest-data month safety", () => {
  it("resolves the current month using JST at the UTC month boundary", () => {
    expect(getJSTMonthKey(new Date("2026-08-31T14:59:59.000Z"))).toBe("2026-08");
    expect(getJSTMonthKey(new Date("2026-08-31T15:00:00.000Z"))).toBe("2026-09");
  });

  it("excludes future-dated records from the global latest month", () => {
    const source = functionSource(
      "getLatestLiverDataMonth",
      "getLatestLiverDataMonthByLiverId",
    );
    expect(source).toContain("getJSTMonthRange(getJSTMonthKey())");
    expect(source).toContain("lte(brandLivestreams.livestreamDate, currentMonthEnd)");
  });

  it("applies the same future-month boundary to individual liver pages", () => {
    const source = functionSource(
      "getLatestLiverDataMonthByLiverId",
      "getLiverMonthlySalesTrend",
    );
    expect(source).toContain("getJSTMonthRange(getJSTMonthKey())");
    expect(source).toContain("lte(brandLivestreams.livestreamDate, currentMonthEnd)");
  });

  it("treats any dated non-deleted livestream as registered data even when sales and duration are zero", () => {
    const globalSource = functionSource(
      "getLatestLiverDataMonth",
      "getLatestLiverDataMonthByLiverId",
    );
    const individualSource = functionSource(
      "getLatestLiverDataMonthByLiverId",
      "getLiverMonthlySalesTrend",
    );
    for (const source of [globalSource, individualSource]) {
      expect(source).toContain("isNull(brandLivestreams.deletedAt)");
      expect(source).toContain("isNotNull(brandLivestreams.livestreamDate)");
      expect(source).not.toContain("COALESCE(${brandLivestreams.manualSalesAmount}");
      expect(source).not.toContain("COALESCE(${brandLivestreams.duration}");
    }
  });

  it("keeps monthly goals on the user-selected month instead of the recovered performance month", () => {
    expect(listSource).toContain(
      "<GoalStatusSection selectedMonth={selectedMonth} agencyId={agencyId} />",
    );
    expect(listSource).not.toContain(
      "<GoalStatusSection selectedMonth={dataMonth} agencyId={agencyId} />",
    );
  });

  it("keeps the recovered-month fallback explicit and limited to the current-month selection", () => {
    expect(listSource).toContain("selectedMonth === currentMonthValue");
    expect(listSource).toContain("latestDataPeriod?.month !== selectedMonth");
    expect(listSource).toContain("usingLatestRecoveredPeriod ? latestDataPeriod!.month! : selectedMonth");
  });
});
