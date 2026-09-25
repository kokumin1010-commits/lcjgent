import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCarrierTrackingUrl,
  normalizeHttpsUrl,
  SAMPLE_LOGISTICS_LABELS,
  SAMPLE_LOGISTICS_STATUSES,
} from "../shared/sampleLogistics";
import { getSampleLogisticsUpgradeHealth } from "./sampleLogisticsUpgrade";
import { sampleRequestRouter } from "./sampleRequestRouter";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("sample logistics shared contract", () => {
  it("keeps every supported state labelled for the liver UI", () => {
    expect(SAMPLE_LOGISTICS_STATUSES).toEqual([
      "preparing",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "delivery_exception",
      "returned",
    ]);
    for (const status of SAMPLE_LOGISTICS_STATUSES) {
      expect(SAMPLE_LOGISTICS_LABELS[status]).toBeTruthy();
    }
  });

  it("only accepts public https tracking URLs", () => {
    expect(normalizeHttpsUrl("https://toi.kuronekoyamato.co.jp/cgi-bin/tneko"))
      .toBe("https://toi.kuronekoyamato.co.jp/cgi-bin/tneko");
    expect(normalizeHttpsUrl("javascript:alert(1)" )).toBeNull();
    expect(normalizeHttpsUrl("http://example.com/track")).toBeNull();
    expect(normalizeHttpsUrl("https://localhost/track")).toBeNull();
    expect(normalizeHttpsUrl("https://127.0.0.1/track")).toBeNull();
    expect(normalizeHttpsUrl("https://10.0.0.1/track")).toBeNull();
    expect(normalizeHttpsUrl("https://[::]/track")).toBeNull();
    expect(normalizeHttpsUrl("https://[::ffff:127.0.0.1]/track")).toBeNull();
    expect(normalizeHttpsUrl("https://[::ffff:10.0.0.1]/track")).toBeNull();
    expect(normalizeHttpsUrl("https://192.0.2.10/track")).toBeNull();
  });

  it("builds only known-carrier tracking URLs and URL-encodes the number", () => {
    expect(buildCarrierTrackingUrl("ヤマト運輸", "AB 12/34")).toContain("AB%2012%2F34");
    expect(buildCarrierTrackingUrl("佐川急便", "1234")).toContain("okurijosearch");
    expect(buildCarrierTrackingUrl("日本郵便", "1234")).toContain("requestNo1=1234");
    expect(buildCarrierTrackingUrl("Unknown", "1234")).toBeNull();
  });
});

describe("sample logistics end-to-end source contract", () => {
  const router = read("server/sampleRequestRouter.ts");
  const admin = read("client/src/pages/SampleRequestsAdmin.tsx");
  const liver = read("client/src/pages/LiverSampleRequest.tsx");
  const schema = read("drizzle/schema.ts");
  const migrationRunner = read("run-migrations.mjs");
  const upgrade = read("server/sampleLogisticsUpgrade.ts");
  const index = read("server/_core/index.ts");

  it("requires admin authorization, row locking, optimistic conflict detection and an atomic event insert", () => {
    expect(router).toContain("assertSampleLogisticsAdmin(ctx)");
    for (const procedure of ["listAll", "approve", "reject", "updateLogistics", "markShipped", "fixNegativeCredits", "listCredits", "setCredit", "getLiverCreditHistory", "getLiverRequests"]) {
      expect(router).toContain(`${procedure}: adminProcedure`);
    }
    expect(router).toContain("WHERE id=? FOR UPDATE");
    expect(router).toContain("expectedRevision");
    expect(router).toContain("logistics_revision=logistics_revision+1");
    expect(router).toContain("sample_request_logistics_events");
    expect(router).toContain("await connection.beginTransaction()");
    expect(router).toContain("await connection.commit()");
    expect(router).toContain("await connection.rollback()");
    expect(router).toContain('!["approved", "shipped"].includes');
    expect(router).toContain("発送後の物流状態を発送準備中には戻せません");
    expect(router).toContain("配達完了・返送後の状態は変更できません");
    expect(router).toContain("最新の物流履歴より前にはできません");
  });

  it("requires carrier and tracking number after shipment and disables the legacy one-click ship mutation", () => {
    expect(router).toContain('input.logisticsStatus !== "preparing" && (!carrier || !trackingNumber)');
    expect(router).toContain("物流情報画面から配送会社と追跡番号を入力してください");
    expect(admin).not.toContain("shippedMutation.mutate");
    expect(admin).toContain("trpc.sampleRequest.updateLogistics.useMutation");
  });

  it("returns logistics history to the liver without internal recorder IDs", () => {
    expect(router).toContain("events.map(({ recordedBy: _recordedBy, ...event }");
    expect(router).toContain("logisticsUpdatedBy: _logisticsUpdatedBy, reviewedBy: _reviewedBy");
    expect(router).toContain("...liverRequest");
    expect(liver).toContain("配送会社で追跡する");
    expect(liver).toContain("配送履歴");
    expect(liver).toContain("normalizeHttpsUrl(selectedRequest.trackingUrl)");
  });

  it("lets administrators manually enter all required logistics fields and see history", () => {
    for (const token of [
      "logisticsStatus",
      "shippingCarrier",
      "trackingNumber",
      "trackingUrl",
      "estimatedDeliveryAt",
      "latestLocation",
      "logisticsNote",
      "物流履歴",
    ]) expect(admin).toContain(token);
  });

  it("declares the current snapshot and immutable history in schema", () => {
    expect(schema).toContain('mysqlTable("sample_request_logistics_events"');
    expect(schema).toContain('logisticsStatus: mysqlEnum("logistics_status"');
    expect(schema).toContain('timestamp("logistics_updated_at", { fsp: 3 })');
    expect(schema).toContain('logisticsRevision: int("logistics_revision").default(0).notNull()');
    expect(migrationRunner).not.toContain("Ensuring sample-request logistics storage");
  });

  it("runs the recoverable schema upgrade before listen and exposes no-store health", () => {
    expect(upgrade).toContain("runDatabaseBackup");
    expect(upgrade).toContain("dataRowsModified: 0");
    expect(upgrade).toContain("GET_LOCK");
    expect(upgrade).toContain("RELEASE_LOCK");
    expect(upgrade).toContain("if (preBackupVerified)");
    expect(upgrade).toContain("SAMPLE_LOGISTICS_EVENT_SCHEMA_DRIFT_NONEMPTY");
    expect(upgrade).toContain('DROP TABLE sample_request_logistics_events');
    expect(index).toContain("await runSampleLogisticsUpgradeSetup()");
    expect(index).toContain('/api/health/sample-logistics');
    expect(index).toContain('Cache-Control", "no-store, max-age=0');
  });

  it("denies every admin sample operation to an ordinary authenticated user before DB access", async () => {
    const caller = sampleRequestRouter.createCaller({ user: { id: 7, role: "user" } } as any);
    const calls = [
      () => caller.listAll({}),
      () => caller.approve({ id: 1 }),
      () => caller.reject({ id: 1, comment: "not allowed" }),
      () => caller.updateLogistics({ id: 1, logisticsStatus: "preparing", expectedRevision: 0 }),
      () => caller.markShipped({ id: 1 }),
      () => caller.fixNegativeCredits(),
      () => caller.listCredits({ month: "2026-09" }),
      () => caller.setCredit({ liverId: 1, month: "2026-09", streamingHours: 0, monthlySales: 0, isFirstMonth: false }),
      () => caller.getLiverCreditHistory({ liverId: 1 }),
      () => caller.getLiverRequests({ liverId: 1 }),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps dashboard totals independent from the selected local status filter", () => {
    expect(admin).toContain("trpc.sampleRequest.listAll.useQuery(\n    {},");
    expect(admin).toContain("if (statusFilter && r.status !== statusFilter) return false");
  });
});

describe("sample logistics upgrade health", () => {
  const requestColumns = [
    ["logistics_status", "enum('preparing','shipped','in_transit','out_for_delivery','delivered','delivery_exception','returned')"],
    ["shipping_carrier", "varchar(120)"], ["tracking_number", "varchar(160)"], ["tracking_url", "text"],
    ["estimated_delivery_at", "datetime"], ["latest_location", "varchar(255)"], ["logistics_note", "text"],
    ["delivered_at", "datetime"], ["logistics_updated_at", "timestamp(3)"], ["logistics_updated_by", "int(11)"],
  ].map(([name, columnType]) => ({ name, columnType, isNullable: "YES", columnDefault: null, extra: "" }));
  requestColumns.push({ name: "logistics_revision", columnType: "int(11)", isNullable: "NO", columnDefault: "0", extra: "" });
  const eventColumns = [
    ["id", "int(11)", "NO"], ["request_id", "int(11)", "NO"],
    ["logistics_status", "enum('preparing','shipped','in_transit','out_for_delivery','delivered','delivery_exception','returned')", "NO"],
    ["shipping_carrier", "varchar(120)", "YES"], ["tracking_number", "varchar(160)", "YES"], ["tracking_url", "text", "YES"],
    ["estimated_delivery_at", "datetime", "YES"], ["latest_location", "varchar(255)", "YES"], ["note", "text", "YES"],
    ["occurred_at", "datetime", "NO"], ["recorded_by", "int(11)", "NO"], ["created_at", "timestamp", "NO"],
  ].map(([name, columnType, isNullable]) => ({ name, columnType, isNullable, columnDefault: null, extra: name === "id" ? "auto_increment" : "" }));
  const eventIndexes = [
    { indexName: "PRIMARY", columnName: "id", sequenceNumber: 1, nonUnique: 0 },
    { indexName: "idx_sample_logistics_request_time", columnName: "request_id", sequenceNumber: 1, nonUnique: 1 },
    { indexName: "idx_sample_logistics_request_time", columnName: "occurred_at", sequenceNumber: 2, nonUnique: 1 },
  ];

  function poolWith(columns = requestColumns, events = eventColumns, indexes = eventIndexes) {
    return {
      query: async (statement: string, params: unknown[] = []) => {
        if (statement.includes("information_schema.TABLES")) return [[{ count: 1 }]];
        if (statement.includes("information_schema.COLUMNS") && params[0] === "sample_requests") return [columns];
        if (statement.includes("information_schema.COLUMNS") && params[0] === "sample_request_logistics_events") return [events];
        if (statement.includes("information_schema.STATISTICS")) return [indexes];
        if (statement.includes("SELECT status FROM sample_request_logistics_upgrade_runs")) return [[{ status: "success" }]];
        throw new Error(`unexpected query: ${statement}`);
      },
    } as any;
  }

  it("accepts the exact nullable schema including TiDB int display width", async () => {
    const health = await getSampleLogisticsUpgradeHealth(poolWith());
    expect(health.healthy).toBe(true);
    expect(health.mismatchedColumns).toEqual([]);
  });

  it("fails health when an existing logistics column drifts", async () => {
    const drifted = requestColumns.map(column => column.name === "tracking_number" ? { ...column, columnType: "varchar(40)" } : column);
    const health = await getSampleLogisticsUpgradeHealth(poolWith(drifted));
    expect(health.healthy).toBe(false);
    expect(health.mismatchedColumns).toContain("tracking_number");
  });

  it("fails health when the immutable event table type or audit index drifts", async () => {
    const driftedEvents = eventColumns.map(column => column.name === "recorded_by" ? { ...column, isNullable: "YES" } : column);
    const health = await getSampleLogisticsUpgradeHealth(poolWith(requestColumns, driftedEvents, eventIndexes.slice(0, 1)));
    expect(health.healthy).toBe(false);
    expect(health.mismatchedEventColumns).toContain("recorded_by");
    expect(health.missingEventIndexes).toContain("idx_sample_logistics_request_time");
  });
});
