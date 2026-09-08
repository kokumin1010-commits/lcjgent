import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCompanyReceiptTicketAlias } from "./festivalAdmissionService";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF company receipt ticket compatibility", () => {
  it("formats the visible company receipt number without exposing another ticket format", () => {
    expect(buildCompanyReceiptTicketAlias(1)).toBe("LCF-C-000001");
    expect(buildCompanyReceiptTicketAlias(42)).toBe("LCF-C-000042");
    expect(buildCompanyReceiptTicketAlias(999_999)).toBe("LCF-C-999999");
    expect(() => buildCompanyReceiptTicketAlias(0)).toThrow(RangeError);
    expect(() => buildCompanyReceiptTicketAlias(1_000_000)).toThrow(RangeError);
    expect(() => buildCompanyReceiptTicketAlias(1.5)).toThrow(RangeError);
  });

  it("backfills only company receipt aliases to the oldest canonical ticket idempotently", () => {
    const service = read("server/festivalAdmissionService.ts");
    expect(service).toContain("INSERT IGNORE INTO lcf_ticket_aliases (aliasTicketId, canonicalTicketId)");
    expect(service).toContain("CONCAT('LCF-C-', LPAD(ticket.applicationId, 6, '0'))");
    expect(service).toContain("SELECT applicationId, MIN(id) AS ticketRowId");
    expect(service).toContain("WHERE applicantType = 'company'");
    expect(service).toContain("AND applicationId BETWEEN 1 AND 999999");
    expect(service).toContain("LEFT JOIN lcf_tickets direct");
    expect(service).toContain("WHERE direct.id IS NULL");
    expect(service).not.toMatch(/(?:DELETE|REPLACE|ON DUPLICATE KEY UPDATE)\s+(?:FROM\s+)?lcf_ticket_aliases/i);
  });

  it("registers the alias for existing, newly inserted and raced company tickets", () => {
    const router = read("server/festivalRouter.ts");
    expect(router).toContain("ensureCompanyReceiptTicketAlias(pool");
    expect(router).toContain("if (existing?.length) return finalizeTicket(existing[0].ticketId as string)");
    expect(router).toContain("return finalizeTicket(ticketId)");
    expect(router).toContain("if (raced?.length) return finalizeTicket(raced[0].ticketId as string)");
  });

  it("keeps the official company QR on the canonical ticket while accepting the visible receipt alias", () => {
    const email = read("server/festivalApplicationEmail.ts");
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const router = read("server/festivalRouter.ts");
    expect(email).toContain("QRCode.toDataURL(input.ticketId");
    expect(email).toContain('return `LCF-C-${String(applicationId).padStart(6, "0")}`');
    expect(admin).toContain("decodedText.startsWith('LCF-')");
    expect(router).toContain("resolveTicketByScannedId(pool, input.ticketId)");
    expect(router).toContain("aliasUsed: resolved.aliasUsed");
  });
});
