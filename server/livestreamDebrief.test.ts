import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildLivestreamDebriefText,
  normalizeLivestreamDebriefContent,
  type LivestreamDebriefContent,
} from "../shared/livestreamDebrief";
import { resolveBrandLivestreamGmv, resolveLivestreamProductGmv } from "../shared/brandMetrics";
import { getLivestreamDebriefUpgradeHealth, isLivestreamDebriefUpgradeAuthorized, runLivestreamDebriefUpgradeSetup } from "./livestreamDebriefUpgrade";
import { hasLivestreamAllocationIssue, livestreamDebriefContentSchema, resolveLivestreamDebriefAccess, sourceRecorder } from "./livestreamDebriefRouter";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

function content(): LivestreamDebriefContent {
  return {
    version: 1,
    brands: [{ brandId: 2, brandName: " Test Brand ", salesAmount: 100000, orderCount: 20, mainProducts: " Set A ", performance: " Good " }],
    goodPoints: [" 话术清晰 ", "", "产品组合有效"],
    problems: ["库存不足", "", ""],
    salesDrivers: ["限时赠品", "", ""],
    salesBarriers: ["链接切换慢", "", ""],
    reusableLessons: ["开场先讲组合", "", ""],
    nextActions: ["下次开播前30分钟核对库存", "", ""],
    assistance: { issue: "补充库存", owner: "采购部", dueDate: "2026-09-27" },
  };
}

describe("livestream debrief content", () => {
  it("normalizes short fields and generates a group-ready review with recorder attribution", () => {
    const raw = content();
    raw.goodPoints.push("第四项被截断");
    const normalized = normalizeLivestreamDebriefContent(raw);
    expect(normalized.goodPoints).toEqual(["话术清晰", "产品组合有效", "第四项被截断"]);
    expect(normalized.brands[0]).toMatchObject({ brandName: "Test Brand", mainProducts: "Set A", performance: "Good" });
    const text = buildLivestreamDebriefText({
      metrics: {
        livestreamId: 99,
        livestreamDate: "2026-09-26T09:00:00.000Z",
        livestreamEndTime: "2026-09-26T12:00:00.000Z",
        streamerName: "测试主播",
        durationMinutes: 180,
        salesAmount: 100000,
        orderCount: 20,
      },
      content: normalized,
      recordedByName: "中控A",
      recordedAt: "2026-09-26T12:05:00.000Z",
    });
    expect(text).toContain("【今日达播复盘】");
    expect(text).toContain("达人/主播：测试主播");
    expect(text).toContain("复盘录入：中控A");
    expect(text).toContain("下一场具体改善方案");
  });

  it("requires one observation, one concrete next action, and complete assistance ownership", () => {
    expect(livestreamDebriefContentSchema.safeParse(content()).success).toBe(true);
    const missingAction = content();
    missingAction.nextActions = ["", "", ""];
    expect(livestreamDebriefContentSchema.safeParse(missingAction).success).toBe(false);
    const missingOwner = content();
    missingOwner.assistance.owner = "";
    expect(livestreamDebriefContentSchema.safeParse(missingOwner).success).toBe(false);
  });

  it("uses canonical positive-value precedence and exposes conflicting stream facts", () => {
    expect(resolveLivestreamProductGmv({ directGmv: 0, gmv: 250000, grossRevenue: 300000 })).toBe(250000);
    expect(resolveLivestreamProductGmv({ directGmv: 120000, gmv: 250000, grossRevenue: 300000 })).toBe(120000);
    expect(resolveBrandLivestreamGmv({ manualSalesAmount: 0, salesAmount: 500000, gmv: 500000 })).toMatchObject({ value: 500000, hasConflict: false });
    expect(resolveBrandLivestreamGmv({ manualSalesAmount: 600000, salesAmount: 500000, gmv: 500000 })).toMatchObject({ value: 600000, hasConflict: true });
  });

  it("keeps the authenticated creator visible for CSV and realtime provenance", () => {
    expect(sourceRecorder({ sourceRecorderName: "中控A" })).toEqual({ type: "manual", name: "中控A" });
    expect(sourceRecorder({ sourceRecorderName: "中控A", csvImported: "yes" })).toEqual({ type: "csv", name: "创建：中控A；数据来源：CSV" });
    expect(sourceRecorder({ sourceRecorderName: "中控A", productCsvImported: "yes" })).toEqual({ type: "csv", name: "创建：中控A；数据来源：CSV" });
    expect(sourceRecorder({ sourceRecorderName: "中控A", csvImported: "yes", realtimeRecorders: "AI,中控B" })).toEqual({ type: "csv_realtime", name: "创建：中控A；数据来源：CSV；实时记录：AI、中控B" });
    expect(sourceRecorder({ sourceRecorderName: "中控A", realtimeRecorders: "AI" })).toEqual({ type: "realtime", name: "创建：中控A；实时记录：AI" });
  });

  it("rejects incomplete or mismatched multi-brand allocations", () => {
    expect(hasLivestreamAllocationIssue([{ gmv: 0 }, { gmv: 0 }], 500000)).toBe(true);
    expect(hasLivestreamAllocationIssue([{ gmv: 0 }, { gmv: 0 }], 0)).toBe(false);
    expect(hasLivestreamAllocationIssue([{ gmv: null }, { gmv: 500000 }], 500000)).toBe(true);
    expect(hasLivestreamAllocationIssue([{ gmv: 200000 }, { gmv: 200000 }], 500000)).toBe(true);
    expect(hasLivestreamAllocationIssue([{ gmv: 200000 }, { gmv: 300000 }], 500000)).toBe(false);
  });
});

describe("livestream debrief access", () => {
  it("grants full access to admins without querying role tables", async () => {
    const query = vi.fn();
    await expect(resolveLivestreamDebriefAccess({ id: 1, role: "admin" }, { query } as any)).resolves.toEqual({ canView: true, canEdit: true });
    expect(query).not.toHaveBeenCalled();
  });

  it("inherits the existing livers-dashboard view/edit permission for staff", async () => {
    const viewQuery = vi.fn()
      .mockResolvedValueOnce([[{ roleId: 7 }], []])
      .mockResolvedValueOnce([[{ canView: 1, canEdit: 0 }], []]);
    await expect(resolveLivestreamDebriefAccess({ id: 2, role: "user" }, { query: viewQuery } as any)).resolves.toEqual({ canView: true, canEdit: false });
    expect(viewQuery.mock.calls[1][1]).toEqual([7, "/master/livers-dashboard"]);

    const editQuery = vi.fn()
      .mockResolvedValueOnce([[{ roleId: 8 }], []])
      .mockResolvedValueOnce([[{ canView: 0, canEdit: 1 }], []]);
    await expect(resolveLivestreamDebriefAccess({ id: 3, role: "user" }, { query: editQuery } as any)).resolves.toEqual({ canView: true, canEdit: true });
  });
});

function healthyPool(columnDrift = false) {
  const columns: Record<string, Array<Record<string, unknown>>> = {
    livestream_debriefs: [
      ["id", "int(11)", "NO", null, "auto_increment"], ["livestream_id", "int(11)", "NO", null, ""], ["review_json", "json", "NO", null, ""], ["review_text", "text", "NO", null, ""],
      ["revision", columnDrift ? "bigint" : "int(11)", "NO", "1", ""], ["created_by", "int(11)", "NO", null, ""], ["created_by_name", "varchar(255)", "NO", null, ""],
      ["updated_by", "int(11)", "NO", null, ""], ["updated_by_name", "varchar(255)", "NO", null, ""], ["created_at", "timestamp(3)", "NO", "CURRENT_TIMESTAMP(3)", ""], ["updated_at", "timestamp(3)", "NO", "CURRENT_TIMESTAMP(3)", "on update CURRENT_TIMESTAMP(3)"],
    ].map(([name, columnType, isNullable, columnDefault, extra]) => ({ name, columnType, isNullable, columnDefault, extra })),
    livestream_debrief_events: [
      ["id", "int(11)", "NO", null, "auto_increment"], ["debrief_id", "int(11)", "NO", null, ""], ["livestream_id", "int(11)", "NO", null, ""], ["revision", "int(11)", "NO", null, ""],
      ["review_json", "json", "NO", null, ""], ["review_text", "text", "NO", null, ""], ["recorded_by", "int(11)", "NO", null, ""], ["recorded_by_name", "varchar(255)", "NO", null, ""], ["recorded_at", "timestamp(3)", "NO", "CURRENT_TIMESTAMP(3)", ""],
    ].map(([name, columnType, isNullable, columnDefault, extra]) => ({ name, columnType, isNullable, columnDefault, extra })),
  };
  const indexes: Record<string, Array<Record<string, unknown>>> = {
    livestream_debriefs: [
      ["PRIMARY", "id", 1, 0], ["uk_livestream_debrief_livestream", "livestream_id", 1, 0], ["idx_livestream_debrief_updated", "updated_at", 1, 1],
    ].map(([indexName, columnName, sequenceNumber, nonUnique]) => ({ indexName, columnName, sequenceNumber, nonUnique })),
    livestream_debrief_events: [
      ["PRIMARY", "id", 1, 0], ["uk_livestream_debrief_event_revision", "debrief_id", 1, 0], ["uk_livestream_debrief_event_revision", "revision", 2, 0],
      ["idx_livestream_debrief_event_stream_time", "livestream_id", 1, 1], ["idx_livestream_debrief_event_stream_time", "recorded_at", 2, 1],
    ].map(([indexName, columnName, sequenceNumber, nonUnique]) => ({ indexName, columnName, sequenceNumber, nonUnique })),
  };
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("information_schema.TABLES")) return [[{ count: 1 }], []];
      if (sql.includes("information_schema.COLUMNS")) return [columns[String(params?.[0])] || [], []];
      if (sql.includes("information_schema.STATISTICS")) return [indexes[String(params?.[0])] || [], []];
      if (sql.includes("SELECT status FROM livestream_debrief_upgrade_runs")) return [[{ status: "success" }], []];
      throw new Error(`Unexpected query: ${sql}`);
    }),
    end: vi.fn(),
  };
}

describe("livestream debrief schema health", () => {
  it("authorizes DDL only for the Railway production environment", () => {
    expect(isLivestreamDebriefUpgradeAuthorized({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isLivestreamDebriefUpgradeAuthorized({ RAILWAY_ENVIRONMENT_NAME: "staging" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isLivestreamDebriefUpgradeAuthorized({ RAILWAY_ENVIRONMENT_NAME: "production" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("fails closed before database access when a non-production caller requests DDL", async () => {
    const previous = process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    try {
      await expect(runLivestreamDebriefUpgradeSetup()).rejects.toThrow("LIVESTREAM_DEBRIEF_UPGRADE_PRODUCTION_ONLY");
    } finally {
      if (previous === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
      else process.env.RAILWAY_ENVIRONMENT_NAME = previous;
    }
  });

  it("accepts the exact current and immutable-event schema", async () => {
    const health = await getLivestreamDebriefUpgradeHealth(healthyPool() as any);
    expect(health.healthy).toBe(true);
    expect(health.debriefTable.ready).toBe(true);
    expect(health.eventTable.ready).toBe(true);
  });

  it("fails health on a revision type drift", async () => {
    const health = await getLivestreamDebriefUpgradeHealth(healthyPool(true) as any);
    expect(health.healthy).toBe(false);
    expect(health.debriefTable.mismatchedColumns).toContain("revision");
  });
});

describe("livestream debrief source contracts", () => {
  it("saves with row locks, monotonic revision and immutable actor-attributed events", () => {
    const router = read("server/livestreamDebriefRouter.ts");
    const database = read("server/db.ts");
    expect(router).toContain("FROM brand_livestreams WHERE id=? AND deletedAt IS NULL FOR UPDATE");
    expect(router).toContain("SELECT id FROM livestream_brands WHERE livestreamId=? ORDER BY id FOR UPDATE");
    expect(router).toContain("SELECT id FROM livestream_products WHERE livestreamId=? ORDER BY id FOR UPDATE");
    expect(router).toContain("hasLivestreamAllocationIssue(associatedRows, resolvedGmv.value)");
    expect(router).toContain("SELECT id,revision FROM livestream_debriefs WHERE livestream_id=? FOR UPDATE");
    expect(router).toContain("currentRevision !== input.expectedRevision");
    expect(router).toContain("actorName(ctx.user)");
    expect(router).toContain("INSERT INTO livestream_debrief_events");
    expect(router).not.toContain("salesAmount: incoming");
    expect(router).not.toContain("orderCount: incoming");
    expect(router).toContain("resolveBrandLivestreamGmv");
    expect(router).toContain("resolveLivestreamProductGmv");
    expect(router).toContain("salesMetricConflict");
    expect(router).toContain("await connection.rollback()");
    expect(database).toContain("await tx.execute(sql`SELECT id FROM brand_livestreams WHERE id = ${livestreamId} FOR UPDATE`)");
    expect(database).toContain("await calculateAndSaveBrandGmvInTransaction(tx, livestreamId)");
    expect(database.indexOf("await calculateAndSaveBrandGmvInTransaction(tx, livestreamId)")).toBeLessThan(database.indexOf('.set({ productCsvImported: "yes" })'));
  });

  it("uses backup-gated startup DDL and exposes a no-store health endpoint before listen", () => {
    const upgrade = read("server/livestreamDebriefUpgrade.ts");
    const startup = read("server/_core/index.ts");
    expect(upgrade.indexOf("verifiedBackup(pool, LIVESTREAM_DEBRIEF_PRE_BACKUP_REASON)")).toBeLessThan(upgrade.indexOf("await ensureRunTable(pool)"));
    expect(upgrade.indexOf("if (!isLivestreamDebriefUpgradeAuthorized())")).toBeLessThan(upgrade.indexOf("verifiedBackup(pool, LIVESTREAM_DEBRIEF_PRE_BACKUP_REASON)"));
    expect(upgrade).toContain("SELECT GET_LOCK(?,120) AS acquired");
    expect(upgrade).toContain("LIVESTREAM_DEBRIEF_SCHEMA_DRIFT_NONEMPTY");
    expect(startup).toContain("await runLivestreamDebriefUpgradeSetup()");
    expect(startup).toContain("if (isLivestreamDebriefUpgradeAuthorized())");
    expect(startup).toContain("skipped outside Railway production; no DDL executed");
    expect(startup.indexOf("await runLivestreamDebriefUpgradeSetup()")).toBeLessThan(startup.lastIndexOf("server.listen(port"));
    expect(startup).toContain('app.get("/api/health/livestream-debrief"');
    expect(startup).toContain('res.setHeader("Cache-Control", "no-store, max-age=0")');
  });

  it("shows source recorder and debrief recorder while keeping the form short", () => {
    const page = read("client/src/pages/LivestreamDebriefConsole.tsx");
    const app = read("client/src/App.tsx");
    const menu = read("client/src/lib/adminMenuConfig.ts");
    expect(page).toContain("直播记录：");
    expect(page).toContain("复盘录入：");
    expect(page).toContain("每项只写一句");
    expect(page).toContain("复制群发内容");
    expect(page).toContain("销售数据待确认");
    expect(page).toContain("销售额待分配");
    expect(page).toContain("const canEdit = Boolean(detail.data?.access.canEdit)");
    expect(page).toContain("<fieldset disabled={!canEdit}");
    expect(app).toContain('/master/livers-dashboard/reviews');
    expect(menu).toContain('labelZh: "中控达播复盘"');
  });
});
