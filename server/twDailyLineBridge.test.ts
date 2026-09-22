import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __twDailyLineBridgeTestUtils,
  canonicalizeSalesDashTwDailyEnvelope,
  formatTwDailyLineMessage,
  verifySalesDashTwDailyRequest,
  type TwDailyLineBridgeEvent,
} from "./twDailyLineBridge";

const serverSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const bridgeSource = readFileSync(new URL("./twDailyLineBridge.ts", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../client/src/pages/LineManagement.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../drizzle/0161_tw_daily_line_bridge.sql", import.meta.url), "utf8");
const migrationRunnerSource = readFileSync(new URL("../run-migrations.mjs", import.meta.url), "utf8");
const startupMigrationSource = readFileSync(new URL("../run-required-startup-migrations.mjs", import.meta.url), "utf8");
const dockerfileSource = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

function digestEvent(): Extract<TwDailyLineBridgeEvent, { eventType: "daily_digest_ready" }> {
  return {
    version: 1,
    eventId: "tw-digest:2026-09-22",
    eventType: "daily_digest_ready",
    occurredAt: "2026-09-22T01:07:00.000Z",
    payload: {
      digestId: 7,
      digestDate: "2026-09-22",
      reportCount: 1,
      urgentCount: 1,
      executiveSummary: "完成出貨，需要確認庫存。",
      executiveSummaryTruncated: false,
      achievements: [{ text: "完成出貨", textTruncated: false }],
      risks: [{ text: "庫存偏低", textTruncated: false, severity: "high" }],
      nextActions: [{
        text: "確認補貨",
        textTruncated: false,
        owner: "孟孟",
        ownerTruncated: false,
        deadline: "今天",
        deadlineTruncated: false,
      }],
      supportRequests: [{ text: "請主管確認", textTruncated: false, urgency: "today" }],
      reports: [{
        reportId: 42,
        staffName: "測試員工",
        content: "完成出貨",
        findings: "庫存偏低",
        notes: "",
        contentTruncated: false,
        findingsTruncated: false,
        notesTruncated: false,
        salesdashUrl: "https://salesdash.buzzdrop.co.jp/tw-staff?reportId=42&reportDate=2026-09-22",
      }],
      salesdashUrl: "https://salesdash.buzzdrop.co.jp/tw-staff?reportDate=2026-09-22",
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  __twDailyLineBridgeTestUtils.resetPublicKeyCache();
});

describe("SalesDash daily report LINE receiver", () => {
  it("verifies a fresh Ed25519 signature and rejects mismatched or future envelopes", async () => {
    const keys = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const keyId = "0123456789abcdef01234567";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      algorithm: "Ed25519",
      keyId,
      publicKeyPem: keys.publicKey,
      canonicalization: "timestamp\\neventId\\nrawJsonBody",
      issuer: "salesdash.buzzdrop.co.jp",
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const event = digestEvent();
    const body = JSON.stringify(event);
    const timestamp = "1789990000000";
    const signature = sign(
      null,
      Buffer.from(canonicalizeSalesDashTwDailyEnvelope(timestamp, event.eventId, body)),
      keys.privateKey,
    ).toString("base64");
    const verified = await verifySalesDashTwDailyRequest({
      body, keyId, timestamp, eventId: event.eventId, signature, now: Number(timestamp),
    });
    expect(verified.eventType).toBe("daily_digest_ready");

    await expect(verifySalesDashTwDailyRequest({
      body, keyId, timestamp, eventId: "tw-digest:2026-09-23", signature, now: Number(timestamp),
    })).rejects.toThrow();
    await expect(verifySalesDashTwDailyRequest({
      body, keyId, timestamp, eventId: event.eventId, signature, now: Number(timestamp) - 61_000,
    })).rejects.toThrow("SALESDASH_SIGNATURE_EXPIRED");
  });

  it("formats a concise AI summary and bounded chunks for everyone's reports", () => {
    const message = formatTwDailyLineMessage(digestEvent());
    expect(message).toContain("AI每日重點");
    expect(message).toContain("今日完成");
    expect(message).toContain("問題與風險");
    expect(message).toContain("查看原文");
    expect(message.length).toBeLessThanOrEqual(5_000);

    const reports = Array.from({ length: 40 }, (_, index) => ({
      staff_name: `員工${index + 1}`,
      content: "完成訂單整理與客戶跟進".repeat(8).slice(0, 200),
      findings: "需要確認庫存".slice(0, 40),
      notes: "明日繼續",
      contentTruncated: true,
      findingsTruncated: false,
      notesTruncated: false,
      salesdashUrl: `https://salesdash.buzzdrop.co.jp/tw-staff?reportId=${index + 1}&reportDate=2026-09-22`,
    }));
    const chunks = __twDailyLineBridgeTestUtils.chunkDailyReports(
      reports,
      "2026-09-22",
      "https://salesdash.buzzdrop.co.jp/tw-staff",
    );
    expect(chunks.length).toBeLessThanOrEqual(4);
    expect(chunks.every(chunk => chunk.length <= 5_000)).toBe(true);
    expect(chunks.join("\n")).toContain("員工40");
    expect(chunks.join("\n")).not.toContain("另有");
    expect(chunks.at(-1)).toContain("完整原文");
  });

  it("keeps deterministic per-group audit ids", () => {
    const first = __twDailyLineBridgeTestUtils.getAuditMessageId("tw-digest:2026-09-22", "Cgroup111111");
    expect(__twDailyLineBridgeTestUtils.getAuditMessageId("tw-digest:2026-09-22", "Cgroup111111")).toBe(first);
    expect(__twDailyLineBridgeTestUtils.getAuditMessageId("tw-digest:2026-09-22", "Cgroup222222")).not.toBe(first);
    expect(`${first}:5`.length).toBeLessThanOrEqual(64);
  });

  it("allows only today's or yesterday's digest to reach the LINE group", () => {
    const now = new Date("2026-09-23T03:00:00.000Z");
    expect(__twDailyLineBridgeTestUtils.isDigestDateDeliverable("2026-09-23", now)).toBe(true);
    expect(__twDailyLineBridgeTestUtils.isDigestDateDeliverable("2026-09-22", now)).toBe(true);
    expect(__twDailyLineBridgeTestUtils.isDigestDateDeliverable("2026-09-21", now)).toBe(false);
    expect(__twDailyLineBridgeTestUtils.isDigestDateDeliverable("2026-09-24", now)).toBe(false);
  });

  it("stops ambiguous LINE retries before the provider retry key expires", () => {
    const firstAttempt = new Date("2026-09-22T00:00:00.000Z");
    expect(__twDailyLineBridgeTestUtils.isLineRetrySafetyWindowExpired(
      firstAttempt,
      firstAttempt.getTime() + 22 * 60 * 60_000,
    )).toBe(false);
    expect(__twDailyLineBridgeTestUtils.isLineRetrySafetyWindowExpired(
      firstAttempt,
      firstAttempt.getTime() + 23 * 60 * 60_000,
    )).toBe(true);
  });

  it("uses a signed 202-accepted endpoint and a single default-off target group", () => {
    expect(serverSource).toContain("/api/internal/salesdash/tw-daily-line");
    expect(serverSource).toContain("result.accepted ? 202");
    expect(serverSource).toContain("startTwDailyLineOutboxWorker");
    expect(migrationSource).toContain("`dailyReportEnabled` boolean NOT NULL DEFAULT false");
    expect(routerSource).toContain("dailyReportEnabled: z.boolean().optional()");
    expect(routerSource).toContain("WHERE lineGroupId <> ${input.lineGroupId}");
    expect(bridgeSource).toContain("BINARY groupName = BINARY ${targetGroupName}");
    expect(bridgeSource).toContain("groupIds.length !== 1");
    expect(bridgeSource).toContain("LINE_DAILY_TARGET_GROUP_CARDINALITY_INVALID");
    expect(uiSource).toContain("把SalesDash员工日报发到这个群");
    expect(uiSource).toContain("每天上午9:07");
  });

  it("persists a leased retryable outbox and complete per-object message history", () => {
    expect(bridgeSource).toContain("INSERT INTO tw_daily_line_outbox");
    expect(bridgeSource).toContain("lease_token = ${leaseToken}");
    expect(bridgeSource).toContain("lease_token = ${row.leaseToken}");
    expect(bridgeSource).toContain("setInterval(triggerTwDailyLineOutboxSoon");
    expect(bridgeSource).toContain("pushMessage(row.targetGroupId, row.messages, row.lineRetryKey)");
    expect(bridgeSource).toContain("messageId: `${baseId}:${index + 1}`");
    expect(bridgeSource).toContain("content: row.messages[index].text");
    expect(bridgeSource).toContain("reserveOutgoingMessageAudits(row)");
    expect(bridgeSource).toContain("finalizeOutgoingMessageAudits(row)");
    expect(bridgeSource).toContain("first_external_attempt_at = COALESCE(first_external_attempt_at, NOW())");
    expect(bridgeSource).toContain("status = 'manual_review'");
    expect(bridgeSource).toContain("LINE_DAILY_MONTHLY_QUOTA_INSUFFICIENT");
  });

  it("ships a versioned migration and keeps the runtime schema aligned", () => {
    expect(migrationSource).toContain("tw_daily_line_outbox");
    expect(migrationSource).toContain("tw_daily_line_inbox_staff_date_uq");
    expect(migrationSource).toContain("dailyReportEnabled");
    expect(migrationSource).toContain("first_external_attempt_at");
    expect(migrationRunnerSource).toContain("0161_tw_daily_line_bridge.sql");
    expect(migrationRunnerSource).toContain("GET_LOCK('lcjgent-required-0161-tw-daily-line'");
    expect(migrationRunnerSource).toContain("process.env.NODE_ENV !== 'production'");
    expect(startupMigrationSource).toContain("REQUIRED_MIGRATION_APPLIED 0161");
    expect(startupMigrationSource).toContain("SELECT GET_LOCK(?, 120) AS acquired");
    expect(startupMigrationSource).toContain("STARTUP_MIGRATION_PREREQUISITE_MISSING");
    expect(startupMigrationSource).toContain("INSERT INTO __drizzle_migrations (hash, created_at)");
    expect(startupMigrationSource).toContain("WHERE created_at = ? ORDER BY id");
    expect(startupMigrationSource).not.toContain("LIMIT 1\",\n    [descriptor.folderMillis]");
    expect(startupMigrationSource).not.toContain("from \"drizzle-orm/mysql2/migrator\"");
    expect(packageSource).toContain('"build:compile"');
    expect(dockerfileSource).toContain("RUN pnpm run build:compile");
    expect(dockerfileSource).not.toContain("RUN pnpm run build\n");
    expect(dockerfileSource).toContain("node run-required-startup-migrations.mjs && node dist/index.js");
    expect(bridgeSource).not.toContain("CREATE TABLE IF NOT EXISTS tw_daily_line_");
  });
});
