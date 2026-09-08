import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AFTER_PARTY_BATCH_CONFIRMATION,
  AFTER_PARTY_IDENTITY_HASH_SALT,
  AFTER_PARTY_TARGET_IDENTITY_COUNT,
  AFTER_PARTY_TARGET_IDENTITY_HASHES,
  AFTER_PARTY_TARGET_MANIFEST_SHA256,
  hashAfterPartyIdentity,
} from "./festivalAfterPartyService";

const serviceSource = readFileSync("server/festivalAfterPartyService.ts", "utf8");
const admissionSource = readFileSync("server/festivalAdmissionService.ts", "utf8");
const routerSource = readFileSync("server/festivalRouter.ts", "utf8");
const adminSource = readFileSync("client/src/pages/LcfAdmin.tsx", "utf8");
const schemaSource = readFileSync("drizzle/festivalSchema.ts", "utf8");
const migrationSource = readFileSync("drizzle/0134_lcf_after_party_eligibility.sql", "utf8");
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

describe("LCF アフターパーティー参加資格", () => {
  it("keeps exactly 34 unique salted identity hashes with a stable manifest digest", () => {
    expect(AFTER_PARTY_TARGET_IDENTITY_COUNT).toBe(34);
    expect(AFTER_PARTY_TARGET_IDENTITY_HASHES).toHaveLength(34);
    expect(new Set(AFTER_PARTY_TARGET_IDENTITY_HASHES).size).toBe(34);
    expect(AFTER_PARTY_TARGET_IDENTITY_HASHES.every((value) => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    const digest = createHash("sha256").update(AFTER_PARTY_TARGET_IDENTITY_HASHES.join("\n"), "utf8").digest("hex");
    expect(digest).toBe(AFTER_PARTY_TARGET_MANIFEST_SHA256);
  });

  it("normalizes identity emails without exposing the raw value", () => {
    const normalized = hashAfterPartyIdentity("  Sample.Person@Example.com ");
    expect(normalized).toBe(hashAfterPartyIdentity("sample.person@example.com"));
    expect(normalized).not.toContain("sample.person");
    expect(AFTER_PARTY_IDENTITY_HASH_SALT).toContain("after-party-2026");
  });

  it("creates eligibility and immutable audit tables without destructive SQL", () => {
    expect(migrationSource).toContain("lcf_after_party_eligibilities");
    expect(migrationSource).toContain("lcf_after_party_audit_logs");
    expect(migrationSource).toContain("uk_lcf_after_party_audit_request");
    expect(migrationSource).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
    expect(schemaSource).toContain("lcfAfterPartyEligibilities");
    expect(schemaSource).toContain("lcfAfterPartyAuditLogs");
    expect(journal.entries.find((entry: any) => entry.tag === "0134_lcf_after_party_eligibility")?.idx).toBe(132);
  });

  it("requires explicit confirmation and records an idempotent batch audit", () => {
    expect(AFTER_PARTY_BATCH_CONFIRMATION).toBe("AFTER-PARTY-34");
    expect(serviceSource).toContain("確認文字が一致しません");
    expect(serviceSource).toContain("SELECT affectedCount FROM lcf_after_party_audit_logs WHERE requestId = ?");
    expect(serviceSource).toContain("ON DUPLICATE KEY UPDATE");
    expect(serviceSource).toContain("identityCount !== AFTER_PARTY_TARGET_IDENTITY_COUNT");
    expect(serviceSource).toContain("'batch_apply'");
  });

  it("never stores source names, emails, ticket IDs or QR values in the batch manifest", () => {
    expect(serviceSource).not.toContain("@gmail.com");
    expect(serviceSource).not.toContain("@icloud.com");
    expect(serviceSource).not.toMatch(/LCF-[A-Z0-9_-]{6,}/);
    expect(serviceSource).not.toContain("LCF2026:");
    expect(serviceSource).not.toContain("破天荒夫婦");
    expect(serviceSource).not.toContain("ナオ＆マイキー");
  });

  it("returns eligibility from both current ticket and legacy QR check-in paths", () => {
    expect(admissionSource).toContain("ensureFestivalAfterPartySchema(pool)");
    expect(admissionSource.match(/isTicketAfterPartyEligible\(connection, ticket\.ticketId\)/g)).toHaveLength(2);
    expect(admissionSource.match(/afterPartyEligible/g)?.length).toBeGreaterThanOrEqual(4);
    expect(adminSource).toContain("decodedText.startsWith('LCF-') || decodedText.startsWith('LCF2026:')");
  });

  it("exposes admin-only preview, batch, manual maintenance and ticket-list status", () => {
    expect(routerSource).toContain("getAfterPartyEligibilityPreview: festivalAdminProcedure");
    expect(routerSource).toContain("applyAfterPartyEligibilityBatch: festivalAdminProcedure");
    expect(routerSource).toContain("setAfterPartyEligibility: festivalAdminProcedure");
    expect(routerSource).toContain("AS afterPartyEligible");
    expect(routerSource).toContain("LEFT JOIN lcf_after_party_eligibilities");
  });

  it("shows the party message only after an eligible successful check-in", () => {
    expect(adminSource).toContain("afterPartyEligible: data.afterPartyEligible");
    expect(adminSource).toContain("lastResult.success && lastResult.afterPartyEligible");
    expect(adminSource).toContain("アフターパーティー参加");
    expect(adminSource).toContain("確認済み名簿を登録");
    expect(adminSource).toContain("AFTER-PARTY-34");
  });

  it("reports and refreshes live admission progress for active party tickets", () => {
    expect(serviceSource).toContain("checkedInTicketCount");
    expect(serviceSource).toContain("uncheckedInTicketCount");
    expect(serviceSource).toContain("admissionTotal");
    expect(serviceSource).toContain("LEFT JOIN lcf_tickets ticket ON ticket.ticketId = eligibility.ticketId");
    expect(adminSource).toContain("アフターパーティー資格者の受付進捗");
    expect(adminSource).toContain("受付済み資格票");
    expect(adminSource).toContain("未受付資格票");
    expect(adminSource).toContain("累計入場人数");
    expect(adminSource).toContain("refreshEligibilityProgress();");
  });
});
