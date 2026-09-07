import { createHmac, timingSafeEqual } from "node:crypto";
import {
  assertCurrentPass2RulesetVersion,
  normalizePass2BatchSize,
  PASS2_RULESET_VERSION,
  type Pass2BatchSize,
} from "./receiptPass2V2Policy";

export const PASS2_PREVIEW_TOKEN_TTL_MS = 10 * 60 * 1000;

export type Pass2CandidateFingerprint = {
  id: number;
  status: "on_hold";
  updatedAtMs: number;
};

export type Pass2PreviewTokenPayload = {
  version: 2;
  rulesetVersion: typeof PASS2_RULESET_VERSION;
  adminUserId: number;
  batchSize: Pass2BatchSize;
  issuedAtMs: number;
  expiresAtMs: number;
  candidates: Pass2CandidateFingerprint[];
};

/**
 * Legacy Railway rows can contain a zero/invalid MySQL timestamp. Drizzle then
 * exposes an Invalid Date whose getTime() is NaN; JSON.stringify would silently
 * turn that NaN into null and create a token that can never pass verification.
 * Use a signed, deterministic sentinel for those unchanged legacy rows instead.
 */
export function normalizePass2CandidateUpdatedAtMs(value: unknown): number {
  let milliseconds = Number.NaN;
  if (value instanceof Date) {
    milliseconds = value.getTime();
  } else if (typeof value === "number") {
    milliseconds = value;
  } else if (typeof value === "string" && value.trim()) {
    milliseconds = new Date(value).getTime();
  }
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? Math.trunc(milliseconds)
    : 0;
}

/**
 * mysql2 can return integer columns as decimal strings when runtime connection
 * options preserve exact numeric values. Canonicalize that boundary before the
 * candidate is signed; the token payload itself always contains JSON numbers.
 */
export function normalizePass2CandidateId(value: unknown): number {
  const normalized = typeof value === "string" && /^[1-9]\d*$/.test(value.trim())
    ? Number(value.trim())
    : value;
  if (!Number.isSafeInteger(normalized) || Number(normalized) <= 0) {
    throw new Error("Pass 2 candidate fingerprint is invalid");
  }
  return Number(normalized);
}

function assertCandidateFingerprint(candidate: Pass2CandidateFingerprint): void {
  if (
    !Number.isInteger(candidate.id) ||
    candidate.id <= 0 ||
    candidate.status !== "on_hold" ||
    !Number.isSafeInteger(candidate.updatedAtMs) ||
    candidate.updatedAtMs < 0
  ) {
    throw new Error("Pass 2 candidate fingerprint is invalid");
  }
}

function tokenSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is required to sign Pass 2 previews");
  }
  return secret;
}

function encodePayload(payload: Pass2PreviewTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signEncodedPayload(encodedPayload: string): string {
  return createHmac("sha256", tokenSecret())
    .update(`pass2-v2.${encodedPayload}`)
    .digest("base64url");
}

export function createPass2PreviewToken(input: {
  adminUserId: number;
  batchSize: Pass2BatchSize;
  candidates: Pass2CandidateFingerprint[];
  nowMs?: number;
}): { token: string; payload: Pass2PreviewTokenPayload } {
  const nowMs = input.nowMs ?? Date.now();
  const batchSize = normalizePass2BatchSize(input.batchSize);
  if (input.candidates.length < 1 || input.candidates.length > batchSize) {
    throw new Error("Preview candidate count must be within the selected batch size");
  }
  const normalizedCandidates = input.candidates.map(candidate => ({
    id: normalizePass2CandidateId(candidate.id),
    status: candidate.status,
    updatedAtMs: candidate.updatedAtMs,
  }));
  normalizedCandidates.forEach(assertCandidateFingerprint);
  const uniqueIds = new Set(normalizedCandidates.map(candidate => candidate.id));
  if (uniqueIds.size !== normalizedCandidates.length) {
    throw new Error("Preview candidates must be unique");
  }

  const payload: Pass2PreviewTokenPayload = {
    version: 2,
    rulesetVersion: PASS2_RULESET_VERSION,
    adminUserId: input.adminUserId,
    batchSize,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + PASS2_PREVIEW_TOKEN_TTL_MS,
    candidates: normalizedCandidates.map(candidate => ({
      id: candidate.id,
      status: "on_hold",
      updatedAtMs: candidate.updatedAtMs,
    })),
  };
  const encoded = encodePayload(payload);
  const signature = signEncodedPayload(encoded);
  return { token: `p2v2.${encoded}.${signature}`, payload };
}

export function verifyPass2PreviewToken(input: {
  token: string;
  adminUserId: number;
  nowMs?: number;
}): Pass2PreviewTokenPayload {
  const parts = String(input.token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "p2v2") {
    throw new Error("Invalid Pass 2 preview token");
  }
  const [, encoded, providedSignature] = parts;
  const expectedSignature = signEncodedPayload(encoded);
  const provided = Buffer.from(providedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Pass 2 preview token signature is invalid");
  }

  let payload: Pass2PreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Pass 2 preview token payload is invalid");
  }

  const nowMs = input.nowMs ?? Date.now();
  if (payload.version !== 2) throw new Error("Pass 2 preview token version is invalid");
  assertCurrentPass2RulesetVersion(payload.rulesetVersion);
  if (payload.adminUserId !== input.adminUserId) {
    throw new Error("Pass 2 preview token belongs to another administrator");
  }
  normalizePass2BatchSize(payload.batchSize);
  if (!Number.isFinite(payload.issuedAtMs) || !Number.isFinite(payload.expiresAtMs)) {
    throw new Error("Pass 2 preview token timestamps are invalid");
  }
  if (payload.expiresAtMs <= nowMs || payload.issuedAtMs > nowMs + 30_000) {
    throw new Error("Pass 2 preview token has expired");
  }
  if (
    !Array.isArray(payload.candidates) ||
    payload.candidates.length < 1 ||
    payload.candidates.length > payload.batchSize
  ) {
    throw new Error("Pass 2 preview candidates are invalid");
  }
  const ids = new Set<number>();
  for (const candidate of payload.candidates) {
    assertCandidateFingerprint(candidate);
    if (ids.has(candidate.id)) throw new Error("Pass 2 candidates contain duplicates");
    ids.add(candidate.id);
  }
  return payload;
}
