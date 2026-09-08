import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  VIP_BATCH_CONFIRMATION,
  VIP_IDENTITY_HASH_SALT,
  VIP_TARGET_IDENTITY_COUNT,
  VIP_TARGET_IDENTITY_HASHES,
  VIP_TARGET_MANIFEST_SHA256,
  VIP_TARGET_TICKET_COUNT_AT_AUDIT,
  hashVipIdentity,
} from "./festivalVipService";

const serviceSource = readFileSync("server/festivalVipService.ts", "utf8");
const admissionSource = readFileSync("server/festivalAdmissionService.ts", "utf8");
const routerSource = readFileSync("server/festivalRouter.ts", "utf8");
const adminSource = readFileSync("client/src/pages/LcfAdmin.tsx", "utf8");
const schemaSource = readFileSync("drizzle/festivalSchema.ts", "utf8");
const migrationSource = readFileSync("drizzle/0135_lcf_vip_eligibility.sql", "utf8");
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

describe("LCF VIP重点対応資格", () => {
  it("keeps exactly 41 unique salted identity hashes and the audited 42-ticket scope", () => {
    expect(VIP_TARGET_IDENTITY_COUNT).toBe(41);
    expect(VIP_TARGET_TICKET_COUNT_AT_AUDIT).toBe(42);
    expect(VIP_TARGET_IDENTITY_HASHES).toHaveLength(41);
    expect(new Set(VIP_TARGET_IDENTITY_HASHES).size).toBe(41);
    expect(VIP_TARGET_IDENTITY_HASHES.every((value) => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    const digest = createHash("sha256").update(VIP_TARGET_IDENTITY_HASHES.join("\n"), "utf8").digest("hex");
    expect(digest).toBe(VIP_TARGET_MANIFEST_SHA256);
  });

  it("normalizes identity emails without exposing raw values", () => {
    const normalized = hashVipIdentity("  Sample.Person@Example.com ");
    expect(normalized).toBe(hashVipIdentity("sample.person@example.com"));
    expect(normalized).not.toContain("sample.person");
    expect(VIP_IDENTITY_HASH_SALT).toContain("vip-2026");
  });

  it("creates independent VIP eligibility and immutable audit tables", () => {
    expect(migrationSource).toContain("lcf_vip_eligibilities");
    expect(migrationSource).toContain("lcf_vip_audit_logs");
    expect(migrationSource).toContain("uk_lcf_vip_audit_request");
    expect(migrationSource).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
    expect(schemaSource).toContain("lcfVipEligibilities");
    expect(schemaSource).toContain("lcfVipAuditLogs");
    expect(journal.entries.find((entry: any) => entry.tag === "0135_lcf_vip_eligibility")?.idx).toBe(133);
  });

  it("requires explicit confirmation and records an idempotent batch audit", () => {
    expect(VIP_BATCH_CONFIRMATION).toBe("VIP-41");
    expect(serviceSource).toContain("確認文字が一致しません");
    expect(serviceSource).toContain("SELECT affectedCount FROM lcf_vip_audit_logs WHERE requestId = ?");
    expect(serviceSource).toContain("ON DUPLICATE KEY UPDATE");
    expect(serviceSource).toContain("identityCount !== VIP_TARGET_IDENTITY_COUNT");
    expect(serviceSource).toContain("'batch_apply'");
  });

  it("stores no source name, email, ticket ID, QR value or spreadsheet row", () => {
    expect(serviceSource).not.toContain("@gmail.com");
    expect(serviceSource).not.toContain("@icloud.com");
    expect(serviceSource).not.toMatch(/LCF-[A-Z0-9_-]{6,}/);
    expect(serviceSource).not.toContain("LCF2026:");
    expect(serviceSource).not.toContain("rawExcelId");
    expect(serviceSource).not.toContain(".xlsx");
    expect(serviceSource).not.toContain("ライコマチャンネル");
  });

  it("returns VIP and after-party independently from current and legacy QR paths", () => {
    expect(admissionSource).toContain("ensureFestivalVipSchema(pool)");
    expect(admissionSource.match(/isTicketVipEligible\(connection, ticket\.ticketId\)/g)).toHaveLength(2);
    expect(admissionSource.match(/vipEligible/g)?.length).toBeGreaterThanOrEqual(4);
    expect(admissionSource.match(/afterPartyEligible/g)?.length).toBeGreaterThanOrEqual(4);
    expect(adminSource).toContain("decodedText.startsWith('LCF-') || decodedText.startsWith('LCF2026:')");
  });

  it("exposes admin-only preview, batch, manual maintenance and ticket-list status", () => {
    expect(routerSource).toContain("getVipEligibilityPreview: festivalAdminProcedure");
    expect(routerSource).toContain("applyVipEligibilityBatch: festivalAdminProcedure");
    expect(routerSource).toContain("setVipEligibility: festivalAdminProcedure");
    expect(routerSource).toContain("AS vipEligible");
    expect(routerSource).toContain("LEFT JOIN lcf_vip_eligibilities");
  });

  it("shows a prominent VIP message only after an eligible successful check-in", () => {
    expect(adminSource.match(/vipEligible: data\.vipEligible/g)).toHaveLength(2);
    expect(adminSource).toContain("lastResult.success && lastResult.vipEligible");
    expect(adminSource).toContain("VIP重点対応資格");
    expect(adminSource).toContain("重点対応対象です。担当スタッフへお声がけください。");
    expect(adminSource).toContain("VIP-41");
  });

  it("keeps VIP and after-party indicators as independent simultaneous blocks", () => {
    expect(adminSource).toContain("lastResult.success && lastResult.vipEligible");
    expect(adminSource).toContain("lastResult.success && lastResult.afterPartyEligible");
    expect(routerSource).toContain("AS vipEligible");
    expect(routerSource).toContain("AS afterPartyEligible");
  });

  it("reports and refreshes live admission progress for active VIP tickets", () => {
    expect(serviceSource).toContain("checkedInTicketCount");
    expect(serviceSource).toContain("uncheckedInTicketCount");
    expect(serviceSource).toContain("admissionTotal");
    expect(serviceSource).toContain("LEFT JOIN lcf_tickets ticket ON ticket.ticketId = eligibility.ticketId");
    expect(adminSource).toContain("VIP重点対応資格者の受付進捗");
    expect(adminSource).toContain("受付済み資格票");
    expect(adminSource).toContain("未受付資格票");
    expect(adminSource).toContain("累計入場人数");
    expect(adminSource).toContain("refreshEligibilityProgress();");
  });
});
