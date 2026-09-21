import { SignJWT, jwtVerify } from "jose";

type LineMemberSession = {
  lineUserId?: string;
  userId?: number;
  expiresAt?: number;
  issuedAt?: number;
};

const SESSION_SCOPE = "lcj_member";
const SESSION_ALGORITHM = "HS256";
export const LINE_MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LINE_MEMBER_SESSION_TTL_SECONDS = LINE_MEMBER_SESSION_TTL_MS / 1000;
const SESSION_CLOCK_SKEW_SECONDS = 60;

function getSecret(): Uint8Array {
  const value = process.env.JWT_SECRET || "";
  if (value.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  return new TextEncoder().encode(value);
}

function normalizeSession(input: LineMemberSession): Required<Pick<LineMemberSession, "expiresAt">> & Omit<LineMemberSession, "expiresAt"> {
  const lineUserId = typeof input.lineUserId === "string" && input.lineUserId.trim()
    ? input.lineUserId.trim()
    : undefined;
  const userId = Number.isSafeInteger(input.userId) && Number(input.userId) > 0
    ? Number(input.userId)
    : undefined;
  const expiresAt = Number(input.expiresAt || 0);
  if (!lineUserId && !userId) throw new Error("LCJ member session identity is missing");
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("LCJ member session expiration is invalid");
  }
  return { lineUserId, userId, expiresAt };
}

export async function createLineMemberSessionToken(input: LineMemberSession): Promise<string> {
  const session = normalizeSession(input);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = Math.floor(session.expiresAt / 1000);
  if (expiresAtSeconds > nowSeconds + LINE_MEMBER_SESSION_TTL_SECONDS) {
    throw new Error("LCJ member session cannot exceed 30 days");
  }
  return await new SignJWT({
    scope: SESSION_SCOPE,
    lineUserId: session.lineUserId,
    userId: session.userId,
  })
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(getSecret());
}

export async function verifyLineMemberSessionToken(token: string): Promise<LineMemberSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [SESSION_ALGORITHM] });
    if (payload.scope !== SESSION_SCOPE) return null;
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) return null;
    if (payload.exp! <= payload.iat!) return null;
    if (payload.exp! - payload.iat! > LINE_MEMBER_SESSION_TTL_SECONDS) return null;
    if (payload.iat! > Math.floor(Date.now() / 1000) + SESSION_CLOCK_SKEW_SECONDS) return null;
    const expiresAt = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
    const session = normalizeSession({
      lineUserId: typeof payload.lineUserId === "string" ? payload.lineUserId : undefined,
      userId: typeof payload.userId === "number" ? payload.userId : undefined,
      expiresAt,
    });
    return {
      ...session,
      issuedAt: payload.iat! * 1000,
    };
  } catch {
    return null;
  }
}

export type { LineMemberSession };
