import { createHmac, timingSafeEqual } from "node:crypto";
import {
  normalizePass2BatchSize,
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
  adminUserId: number;
  batchSize: Pass2BatchSize;
  issuedAtMs: number;
  expiresAtMs: number;
  candidates: Pass2CandidateFingerprint[];
};

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
  const uniqueIds = new Set(input.candidates.map(candidate => candidate.id));
  if (uniqueIds.size !== input.candidates.length) {
    throw new Error("Preview candidates must be unique");
  }

  const payload: Pass2PreviewTokenPayload = {
    version: 2,
    adminUserId: input.adminUserId,
    batchSize,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + PASS2_PREVIEW_TOKEN_TTL_MS,
    candidates: input.candidates.map(candidate => ({
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
    if (
      !Number.isInteger(candidate.id) ||
      candidate.id <= 0 ||
      candidate.status !== "on_hold" ||
      !Number.isFinite(candidate.updatedAtMs)
    ) {
      throw new Error("Pass 2 candidate fingerprint is invalid");
    }
    if (ids.has(candidate.id)) throw new Error("Pass 2 candidates contain duplicates");
    ids.add(candidate.id);
  }
  return payload;
}
