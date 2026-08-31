import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "lcjmall-tiktok-public-monitor";
const EXPECTED_REPOSITORY = "kokumin1010-commits/lcjgent";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF =
  "kokumin1010-commits/lcjgent/.github/workflows/tiktok-public-monitor.yml@refs/heads/main";
const GITHUB_JWKS = createRemoteJWKSet(
  new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`)
);

function forbidden(message: string) {
  const error = new Error(message);
  error.name = "ForbiddenError";
  return error;
}

export function validateTikTokScheduleClaims(payload: JWTPayload) {
  if (payload.repository !== EXPECTED_REPOSITORY) {
    throw forbidden("Unexpected schedule repository");
  }
  if (payload.ref !== EXPECTED_REF) {
    throw forbidden("Unexpected schedule ref");
  }
  if (payload.workflow_ref !== EXPECTED_WORKFLOW_REF) {
    throw forbidden("Unexpected schedule workflow");
  }
  const runId = String(payload.run_id || "").trim();
  if (!runId) throw forbidden("Schedule token missing run_id");
  return { runId, subject: String(payload.sub || "") };
}

export async function authenticateTikTokScheduleRequest(req: Request) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw forbidden("Missing schedule bearer token");
  }
  const token = authorization.slice(7).trim();
  if (!token) throw forbidden("Missing schedule bearer token");
  try {
    const { payload } = await jwtVerify(token, GITHUB_JWKS, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
    });
    return validateTikTokScheduleClaims(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "ForbiddenError") throw error;
    throw forbidden("Invalid schedule bearer token");
  }
}

export const TIKTOK_SCHEDULE_AUDIENCE = GITHUB_OIDC_AUDIENCE;
