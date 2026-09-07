import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertCurrentPass2RulesetVersion,
  evaluatePass2CurrentRules,
  hasPass2HardRisk,
  normalizePass2BatchSize,
  PASS2_RULESET_VERSION,
} from "./receiptPass2V2Policy";
import {
  createPass2PreviewToken,
  normalizePass2CandidateId,
  normalizePass2CandidateUpdatedAtMs,
  verifyPass2PreviewToken,
  PASS2_PREVIEW_TOKEN_TTL_MS,
} from "./receiptPass2PreviewToken";
import type { ReceiptEvidence } from "./receiptEvidenceExtraction";

process.env.JWT_SECRET ||= "pass2-v2-test-jwt-secret-2026";

function evidence(overrides: Partial<ReceiptEvidence> = {}): ReceiptEvidence {
  return {
    isTikTokShop: true,
    isDelivered: true,
    orderNumber: "581900058582287971",
    allOrderNumbers: ["581900058582287971"],
    totalAmount: 10000,
    orderDate: null,
    shopName: "TikTok Shop",
    productName: null,
    orderNumberSource: "order detail",
    items: [],
    deliveryInfo: null,
    paymentInfo: null,
    confidence: 96,
    ...overrides,
  };
}

function decide(overrides: {
  imageCount?: number;
  evidence?: Partial<ReceiptEvidence>;
  technicalErrors?: string[];
  technicalAttemptsExhausted?: boolean;
  hardRisk?: boolean;
} = {}) {
  return evaluatePass2CurrentRules({
    imageCount: overrides.imageCount ?? 2,
    evidence: evidence(overrides.evidence),
    technicalErrors: overrides.technicalErrors ?? [],
    technicalAttemptsExhausted: overrides.technicalAttemptsExhausted ?? false,
    hardRisk: overrides.hardRisk ?? false,
  });
}

describe("Pass 2 V2 evidence policy", () => {
  it("allows only the fixed bounded batch sizes", () => {
    expect(normalizePass2BatchSize(10)).toBe(10);
    expect(normalizePass2BatchSize(25)).toBe(25);
    expect(normalizePass2BatchSize(50)).toBe(50);
    expect(normalizePass2BatchSize(100)).toBe(100);
    expect(() => normalizePass2BatchSize(0)).toThrow();
    expect(() => normalizePass2BatchSize(101)).toThrow();
  });

  it("rejects missing or broken images", () => {
    expect(decide({ imageCount: 0 })).toMatchObject({ action: "reject", reasonCode: "NO_IMAGE" });
  });

  it("rejects after both technical attempts fail instead of trusting legacy OCR", () => {
    expect(decide({
      technicalErrors: ["timeout", "empty response"],
      technicalAttemptsExhausted: true,
    })).toMatchObject({ action: "reject", reasonCode: "TECHNICAL_FAILURE" });
  });

  it("rejects non-TikTok and undelivered orders", () => {
    expect(decide({ evidence: { isTikTokShop: false } })).toMatchObject({ action: "reject", reasonCode: "NOT_TIKTOK_SHOP" });
    expect(decide({ evidence: { isDelivered: false } })).toMatchObject({ action: "reject", reasonCode: "NOT_DELIVERED" });
  });

  it("rejects missing order number and missing total after retry", () => {
    expect(decide({ evidence: { orderNumber: null } })).toMatchObject({ action: "reject", reasonCode: "MISSING_ORDER_NUMBER" });
    expect(decide({ evidence: { totalAmount: null } })).toMatchObject({ action: "reject", reasonCode: "MISSING_AMOUNT" });
  });

  it("keeps only hard risk manual with a 72-hour path", () => {
    expect(decide({ hardRisk: true })).toMatchObject({
      action: "manual",
      reasonCode: "HARD_RISK",
      reviewDeadlineHours: 72,
    });
    expect(hasPass2HardRisk(["same_image_reuse"], null)).toBe(true);
    expect(hasPass2HardRisk(["high_amount"], null)).toBe(false);
  });

  it("approves complete combined evidence without legacy user-rate gating", () => {
    expect(decide()).toMatchObject({ action: "approve", reasonCode: "EVIDENCE_COMPLETE" });
  });
});

describe("Pass 2 preview token", () => {
  const now = 1_800_000_000_000;
  const candidate = { id: 101, status: "on_hold" as const, updatedAtMs: now - 1000 };

  it("binds the administrator, batch size, fixed candidates, and expiry", () => {
    const { token, payload } = createPass2PreviewToken({
      adminUserId: 7,
      batchSize: 25,
      candidates: [candidate],
      nowMs: now,
    });
    expect(payload.expiresAtMs - payload.issuedAtMs).toBe(PASS2_PREVIEW_TOKEN_TTL_MS);
    expect(payload.rulesetVersion).toBe(PASS2_RULESET_VERSION);
    expect(verifyPass2PreviewToken({ token, adminUserId: 7, nowMs: now + 1 })).toEqual(payload);
  });

  it("rejects another administrator, tampering, and expiry", () => {
    const { token } = createPass2PreviewToken({
      adminUserId: 7,
      batchSize: 25,
      candidates: [candidate],
      nowMs: now,
    });
    expect(() => verifyPass2PreviewToken({ token, adminUserId: 8, nowMs: now + 1 })).toThrow(/another administrator/);
    expect(() => verifyPass2PreviewToken({ token: `${token}x`, adminUserId: 7, nowMs: now + 1 })).toThrow(/signature/);
    expect(() => verifyPass2PreviewToken({ token, adminUserId: 7, nowMs: now + PASS2_PREVIEW_TOKEN_TTL_MS + 1 })).toThrow(/expired/);
  });

  it("normalizes legacy invalid MySQL timestamps to a stable signed sentinel", () => {
    const invalidLegacyDate = new Date("0000-00-00 00:00:00");
    expect(Number.isNaN(invalidLegacyDate.getTime())).toBe(true);
    expect(normalizePass2CandidateUpdatedAtMs(invalidLegacyDate)).toBe(0);
    expect(normalizePass2CandidateUpdatedAtMs("0000-00-00 00:00:00")).toBe(0);
    expect(normalizePass2CandidateUpdatedAtMs(new Date(now - 1000))).toBe(now - 1000);

    const { token, payload } = createPass2PreviewToken({
      adminUserId: 7,
      batchSize: 25,
      candidates: [{ ...candidate, updatedAtMs: 0 }],
      nowMs: now,
    });
    expect(verifyPass2PreviewToken({ token, adminUserId: 7, nowMs: now + 1 })).toEqual(payload);
  });

  it("canonicalizes MySQL decimal-string candidate ids before signing", () => {
    expect(normalizePass2CandidateId("104582")).toBe(104582);
    const { token, payload } = createPass2PreviewToken({
      adminUserId: 7,
      batchSize: 25,
      candidates: [{ ...candidate, id: "104582" as unknown as number }],
      nowMs: now,
    });
    expect(payload.candidates[0].id).toBe(104582);
    expect(typeof payload.candidates[0].id).toBe("number");
    expect(verifyPass2PreviewToken({ token, adminUserId: 7, nowMs: now + 1 })).toEqual(payload);
  });

  it("rejects unsafe or non-integer candidate ids", () => {
    for (const id of ["", "0", "-1", "104582x", "1.5", Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => normalizePass2CandidateId(id)).toThrow(/fingerprint is invalid/);
    }
  });

  it("forces a new preview after any ruleset upgrade", () => {
    expect(() => assertCurrentPass2RulesetVersion("receipt-hold-review-v2.0.0")).toThrow(/规则已升级/);
    expect(() => assertCurrentPass2RulesetVersion(PASS2_RULESET_VERSION)).not.toThrow();

    const oldPayload = {
      version: 2,
      rulesetVersion: "receipt-hold-review-v2.0.0",
      adminUserId: 7,
      batchSize: 25,
      issuedAtMs: now,
      expiresAtMs: now + PASS2_PREVIEW_TOKEN_TTL_MS,
      candidates: [candidate],
    };
    const encoded = Buffer.from(JSON.stringify(oldPayload), "utf8").toString("base64url");
    const signature = createHmac("sha256", process.env.JWT_SECRET!)
      .update(`pass2-v2.${encoded}`)
      .digest("base64url");
    const signedOldToken = `p2v2.${encoded}.${signature}`;
    expect(() => verifyPass2PreviewToken({ token: signedOldToken, adminUserId: 7, nowMs: now + 1 })).toThrow(/规则已升级/);
  });

  it("rejects non-serializable candidate timestamps before signing", () => {
    expect(() => createPass2PreviewToken({
      adminUserId: 7,
      batchSize: 25,
      candidates: [{ ...candidate, updatedAtMs: Number.NaN }],
      nowMs: now,
    })).toThrow(/candidate fingerprint/);
  });
});

describe("Pass 2 V2 integration contracts", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const service = readFileSync(`${here}/services/aiPass2ManualQueueReview.ts`, "utf8");
  const preview = readFileSync(`${here}/receiptHoldPreview.ts`, "utf8");
  const router = readFileSync(`${here}/routers.ts`, "utf8");

  it("reuses one versioned current ruleset, V2 extraction, order guard, and approval service", () => {
    expect(service).toContain("extractReceiptEvidenceWithRetry(images)");
    expect(service).toContain("evaluatePass2CurrentRules({");
    expect(service).toContain("assertCurrentPass2RulesetVersion(config.rulesetVersion)");
    expect(preview).toContain("evaluatePass2CurrentRules({");
    expect(preview).toContain("ruleset: PASS2_RULESET");
    expect(service).toContain("claimReceiptOrderNumber({");
    expect(service).toContain("approveReceiptFromEvidence({");
    expect(service).not.toContain("invokeLLM");
    expect(service).not.toContain("userApprovalRate");
    expect(service).not.toContain("limitClause");
  });

  it("has a real stop signal checked inside the candidate loop", () => {
    expect(service).toContain("if (_pass2StopRequested)");
    expect(service).toContain("_pass2StopRequested = true");
    expect(service).toContain("withPass2GlobalLock");
  });

  it("previews only a bounded oldest batch and performs no write", () => {
    expect(preview).toContain(".limit(batchSize)");
    expect(preview).toContain("asc(lineReceipts.submittedAt), asc(lineReceipts.id)");
    expect(preview).toContain("wroteData: false as const");
    expect(preview).not.toMatch(/\.update\(|\.insert\(|\.delete\(/);
  });

  it("requires a signed preview and fixed candidates without a manual phrase", () => {
    const start = router.indexOf("startPass2:");
    const end = router.indexOf("getPass2Progress:", start);
    const contract = router.slice(start, end);
    expect(contract).toContain("confirmationToken");
    expect(contract).toContain("verifyPass2PreviewToken");
    expect(contract).toContain("normalizePass2CandidateUpdatedAtMs");
    expect(contract).toContain("rulesetVersion: preview.rulesetVersion");
    expect(contract).toContain('current.status !== "on_hold"');
    expect(contract).not.toContain("confirmationPhrase");
    expect(contract).not.toContain("EXECUTE_PASS2_V2_BATCH");
    expect(contract).not.toContain("approveThreshold");
    expect(contract).not.toContain("minUserApprovalRate");
    expect(contract).not.toContain("limit: input");
  });
});
