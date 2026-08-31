import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCompanyBulkResendCandidatePlan } from "./festivalCompanyBulkResend";
import type { ApplicationEmailStatusSummary } from "./festivalApplicationEmail";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

function status(value: "accepted" | "failed" | "pending"): ApplicationEmailStatusSummary {
  return {
    status: value,
    provider: null,
    errorCode: null,
    attemptCount: value === "accepted" ? 1 : 0,
    lastAttemptAt: null,
    acceptedAt: value === "accepted" ? new Date() : null,
  };
}

describe("Festival legacy company bulk resend candidate plan", () => {
  it("skips accepted, invalid, missing-ticket and duplicate recipients without exposing them", () => {
    const plan = buildCompanyBulkResendCandidatePlan({
      applications: [
        { id: 1, email: "accepted@registered-maker.co.jp", companyName: "A", contactName: "A" },
        { id: 2, email: "maker@valid-maker.co.jp", companyName: "B", contactName: "B" },
        { id: 3, email: "not-an-email", companyName: "C", contactName: "C" },
        { id: 4, email: " MAKER@valid-maker.co.jp ", companyName: "D", contactName: "D" },
        { id: 5, email: "missing-ticket@valid-maker.co.jp", companyName: "E", contactName: "E" },
        { id: 6, email: "retry@valid-maker.co.jp", companyName: "F", contactName: "F" },
      ],
      ticketsByApplicationId: new Map([
        [1, "LCF-A"],
        [2, "LCF-B"],
        [3, "LCF-C"],
        [4, "LCF-D"],
        [6, "LCF-F"],
      ]),
      deliveryStatuses: new Map([
        [1, status("accepted")],
        [6, status("failed")],
      ]),
    });

    expect(plan.summary).toEqual({
      totalApplications: 6,
      acceptedAlready: 1,
      failedExisting: 1,
      pendingExisting: 0,
      noDeliveryRecord: 4,
      invalidEmail: 1,
      missingTicket: 1,
      duplicateEmailSkipped: 1,
      eligibleToSend: 2,
    });
    expect(plan.eligible.map((item) => item.id)).toEqual([2, 6]);
    expect(plan.eligible[0].email).toBe("maker@valid-maker.co.jp");
  });

  it("requires an explicit one-time confirmation and returns aggregate results only", () => {
    const source = read("server/festivalCompanyBulkResend.ts");
    expect(source).toContain('z.literal(CONFIRMATION_TEXT)');
    expect(source).toContain('piiReturned: false');
    expect(source).toContain('sendAttempted: false');
    expect(source).toContain('SELECT GET_LOCK(?, 0) AS acquired');
    expect(source).toContain('source: "admin_retry"');
    expect(source).toContain('operation: "resend_all_legacy_company_application_receipts_2026"');
    const runReturn = source.split("const after = await loadCandidatePlan();")[1] || "";
    expect(runReturn).not.toContain("before.eligible,");
    expect(runReturn).not.toContain("application.email");
  });

  it("keeps the operation key out of version control and registers a temporary router only", () => {
    const source = read("server/festivalCompanyBulkResend.ts");
    const routers = read("server/routers.ts");
    expect(source).toContain('OPERATION_KEY_SHA256');
    expect(source).not.toMatch(/OPERATION_KEY\s*=\s*["'][a-f0-9]{64}["']/);
    expect(routers).toContain('festivalCompanyBulkResend: festivalCompanyBulkResendRouter');
  });
});
