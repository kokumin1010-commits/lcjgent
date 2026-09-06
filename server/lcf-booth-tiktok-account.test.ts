import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLcfBoothReservationsCsv } from "../client/src/lib/lcfBoothReservationCsv";

const routerSource = readFileSync(resolve(process.cwd(), "server/boothReservationRouter.ts"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/LcfAdmin.tsx"), "utf8");

describe("LCF booth reservation TikTok account display", () => {
  it("uses the reservation snapshot first and falls back to the latest active 2026 liver application by normalized email", () => {
    expect(routerSource).toContain("NULLIF(TRIM(r.tiktokId), '')");
    expect(routerSource).toContain("LOWER(la.email) = LOWER(r.email)");
    expect(routerSource).toContain("la.event_year = '2026'");
    expect(routerSource).toContain("la.status IN ('new', 'confirmed')");
    expect(routerSource).toContain("ORDER BY la.created_at DESC, la.id DESC");
    expect(routerSource).toContain(") AS tiktokAccount");
  });

  it("captures the active liver application's TikTok account on future reservation creation without making it required", () => {
    expect(routerSource).toContain("SELECT id, account_info");
    expect(routerSource).toContain("input.tiktokId || activeLiverApplications[0]?.account_info || \"\"");
    expect(routerSource).toContain(".trim().slice(0, 200) || null");
    expect(routerSource).toContain("reservationTiktokAccount,");
    expect(routerSource).toContain("tiktokId: z.string().trim().max(200).optional()");
  });

  it("shows a dedicated TikTok column with a Japanese empty value and keeps table spans aligned", () => {
    expect(adminSource).toContain('<th className="p-2 text-left">TikTok</th>');
    expect(adminSource).toContain('r.tiktokAccount || r.tiktokId || "未登録"');
    expect(adminSource).toContain("colSpan={12}");
  });

  it("exports TikTok in the current-view CSV and protects formula-like handles", () => {
    const result = buildLcfBoothReservationsCsv([
      {
        reservationId: "LB-TEST",
        tiktokAccount: "=HYPERLINK(\"https://example.invalid\")",
      },
      {
        reservationId: "LB-NONE",
      },
    ], {
      filter: "all",
      sort: "latest",
      now: new Date("2026-09-06T00:00:00Z"),
    });

    expect(result.csv).toContain('"TikTok"');
    expect(result.csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
    expect(result.csv).toContain('"未登録"');
    expect(result.rowCount).toBe(2);
  });

  it("does not add a database migration or a new write endpoint", () => {
    expect(routerSource).not.toContain("updateTikTokAccount:");
    expect(routerSource).not.toContain("backfillTikTokAccount:");
  });
});
