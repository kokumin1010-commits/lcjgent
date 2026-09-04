import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createLcfAdmissionRequestId,
  getOrCreateLcfAdmissionDeviceId,
} from "../client/src/lib/lcfAdmissionClient";
import { buildLcfAdmissionCsv } from "../client/src/lib/lcfAdmissionCsv";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF cumulative admission", () => {
  it("keeps every existing QR payload format unchanged", () => {
    const router = read("server/festivalRouter.ts");
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const mypage = read("client/src/pages/LcfMypage.tsx");
    expect(router).toContain("return { token, qrData: `LCF2026:${input.type}:${input.applicationId}:${token}` }");
    expect(router).toContain("return `LCF-${nanoid(8).toUpperCase()}`");
    expect(mypage).toContain("<QRCodeSVG value={ticket.ticketId}");
    expect(admin).toContain("decodedText.startsWith('LCF2026:')");
    expect(admin).toContain("submitLegacyCheckIn(decodedText)");
    expect(admin).toContain('submitCheckIn(decodedText, "ticket_qr")');
    expect(admin).toContain('trimmedInput.startsWith("LCF2026:")');
    expect(router).not.toContain("このQRコードは1回のみ有効です");
  });

  it("creates stable device IDs and a new bounded request ID for every explicit action", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const first = getOrCreateLcfAdmissionDeviceId(storage, "first-device-token");
    const second = getOrCreateLcfAdmissionDeviceId(storage, "ignored-second-token");
    expect(first).toBe("device:first-device-token");
    expect(second).toBe(first);
    expect(createLcfAdmissionRequestId("entry", "scan-one")).toBe("entry:scan-one");
    expect(createLcfAdmissionRequestId("undo", "undo-one")).toBe("undo:undo-one");
    expect(createLcfAdmissionRequestId("entry", "x".repeat(100))).toHaveLength(80);
  });

  it("registers a safe migration marker and performs additive startup upgrade with deterministic legacy count=1 backfill", () => {
    const migration = read("drizzle/0132_lcf_cumulative_admissions.sql");
    const journal = JSON.parse(read("drizzle/meta/_journal.json"));
    const schema = read("drizzle/festivalSchema.ts");
    const service = read("server/festivalAdmissionService.ts");
    const router = read("server/festivalRouter.ts");
    expect(migration).toContain("lcf-cumulative-admissions-managed-by-idempotent-startup-upgrade");
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
    expect(service).toContain("CREATE TABLE IF NOT EXISTS lcf_admission_events");
    expect(service).toContain('ensureColumn(pool, tableName, "checked_in_at", "TIMESTAMP NULL")');
    expect(service).toContain("admissionCount INT NOT NULL DEFAULT 0");
    expect(service).toContain("CONCAT('legacy-ticket:', ticketId)");
    expect(service).toContain("INSERT IGNORE INTO lcf_admission_events");
    expect(service).not.toMatch(/DELETE FROM lcf_admission_events/i);
    expect(schema).toContain('export const lcfTickets = mysqlTable("lcf_tickets"');
    expect(schema).toContain('export const lcfAdmissionEvents = mysqlTable("lcf_admission_events"');
    expect(schema).toContain('admissionCount: int("admissionCount").notNull().default(0)');
    expect(schema).toContain('reversedDeviceId: varchar("reversedDeviceId"');
    expect(router).toContain("ensureFestivalAdmissionSchema(getPool())");
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 130,
      tag: "0132_lcf_cumulative_admissions",
    });
  });

  it("serializes concurrent scans and deduplicates network retries", () => {
    const service = read("server/festivalAdmissionService.ts");
    expect(service).toContain("await connection.beginTransaction()");
    expect(service).toContain("LIMIT 1 FOR UPDATE");
    expect(service).toContain("UNIQUE KEY uk_lcf_admission_request (requestId)");
    expect(service).toContain("UNIQUE KEY uk_lcf_admission_ticket_sequence (ticketId, sequenceNumber)");
    expect(service).toContain("WHERE requestId = ? LIMIT 1");
    expect(service).toContain("idempotent: true");
    expect(service).toContain("await connection.rollback().catch(() => {})");
  });

  it("applies the same cumulative service to all ticket and legacy application QR types", () => {
    const router = read("server/festivalRouter.ts");
    const service = read("server/festivalAdmissionService.ts");
    expect(router).toContain("return recordLegacyApplicationAdmission(pool");
    expect(router).toContain("return recordTicketAdmission(pool");
    expect(service).toContain('company: "festival_company_applications"');
    expect(service).toContain('liver: "festival_liver_applications"');
    expect(service).toContain('general: "festival_general_applications"');
    expect(router).not.toContain("既に受付済みです（");
  });

  it("requires an explicit next action after each camera read and only warns at ten", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    expect(admin).toContain("scanSubmittedRef.current = true");
    expect(admin).toContain("scanner.stop().catch(() => {})");
    expect(admin).toContain("同じQRで続けて1名受付");
    expect(admin).toContain("次の1名をスキャン");
    expect(admin).toContain("const admissionPending = checkInMut.isPending || legacyCheckInMut.isPending");
    expect(admin).toContain("10名以上の受付です。人数をご確認ください。");
    expect(admin).not.toContain("disabled={t.checkedIn");
  });

  it("keeps undo reversible, idempotent and audit-preserving", () => {
    const service = read("server/festivalAdmissionService.ts");
    const admin = read("client/src/pages/LcfAdmin.tsx");
    expect(service).toContain("ORDER BY sequenceNumber DESC");
    expect(service).toContain("reversedAt = CURRENT_TIMESTAMP(3)");
    expect(service).toContain("reversedDeviceId = ?");
    expect(service).toContain("reversalRequestId = ?");
    expect(service).not.toMatch(/DELETE FROM lcf_admission_events/i);
    expect(admin).toContain("直前1名取消");
    expect(admin).toContain("履歴は削除されず、取消操作として記録されます");
    expect(admin).toContain("取消を確定");
  });

  it("shows people, checked-in QR totals and first/last admission timestamps", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const legacyAdmin = read("client/src/pages/FestivalAdmin.tsx");
    const mypage = read("client/src/pages/LcfMypage.tsx");
    expect(admin).toContain("来場人数");
    expect(admin).toContain("受付済みQR");
    expect(admin).toContain("初回受付");
    expect(admin).toContain("最終受付");
    expect(legacyAdmin).toContain("今回で{scanResult.admissionCount}名目です");
    expect(mypage).toContain("同行者がいる場合も同じQRコードを1名ずつ受付で提示できます");
    expect(mypage).toContain("{Number(ticket.admissionCount || 0)}名受付済み");
  });

  it("exports only the visible admission columns with Excel-safe escaping", () => {
    const result = buildLcfAdmissionCsv([
      {
        ticketId: "LCF-TEST0001",
        applicantName: "=WEBSERVICE(\"bad\")",
        applicantType: "company",
        applicantEmail: "sample@example.invalid",
        admissionCount: 3,
        firstCheckedInAt: "2026-09-08T01:00:00.000Z",
        lastCheckedInAt: "2026-09-08T02:30:00.000Z",
      },
    ], new Date("2026-09-04T00:00:00.000Z"));
    expect(result.rowCount).toBe(1);
    expect(result.admissionTotal).toBe(3);
    expect(result.csv.startsWith("\uFEFF")).toBe(true);
    expect(result.csv).toContain("受付人数");
    expect(result.csv).toContain("初回受付");
    expect(result.csv).toContain("最終受付");
    expect(result.csv).toContain("'=WEBSERVICE");
    expect(result.csv).not.toContain("phone");
  });
});
