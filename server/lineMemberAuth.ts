import { TRPCError } from "@trpc/server";
import { getLineUserById, getLineUserByLineId } from "./db";
import { verifyLineMemberSessionToken } from "./lineMemberSession";
import { getRequestCookie } from "./requestCookies";

type MemberRequest = {
  cookies?: { line_session?: string };
  headers: { authorization?: string; cookie?: string };
};

type MemberContext = { req: MemberRequest };

type VerifiedMemberSession = {
  lineUserId?: string;
  userId?: number;
  expiresAt?: number;
  issuedAt?: number;
};

/**
 * Return only a cryptographically verified LCJ member session.
 * Legacy unsigned JSON cookies and Authorization bearer fallbacks are deliberately
 * rejected. Member authentication is bound to the signed HttpOnly cookie.
 */
export async function getVerifiedLineMemberSession(
  ctx: MemberContext,
  options: { cookieOnly?: boolean; maxSessionAgeMs?: number } = {}
): Promise<VerifiedMemberSession | null> {
  const candidates = [getRequestCookie(ctx.req, "line_session")].filter(
    (value): value is string => Boolean(value)
  );

  for (const token of [...new Set(candidates)]) {
    const verified = await verifyLineMemberSessionToken(token);
    if (!verified) continue;
    if (options.maxSessionAgeMs) {
      if (
        !verified.issuedAt ||
        verified.issuedAt > Date.now() + 60_000 ||
        Date.now() - verified.issuedAt > options.maxSessionAgeMs
      ) {
        continue;
      }
    }
    return verified;
  }
  return null;
}

/**
 * Backwards-compatible representation used by the existing lineLogin router.
 * The payload has already passed JWT verification before being serialized.
 */
export async function getLineSession(
  ctx: MemberContext
): Promise<string | null> {
  const verified = await getVerifiedLineMemberSession(ctx);
  return verified ? JSON.stringify(verified) : null;
}

export async function getLineUserFromSession(
  ctx: MemberContext,
  options: { cookieOnly?: boolean; maxSessionAgeMs?: number } = {}
): Promise<{
  lineUser:
    | Awaited<ReturnType<typeof getLineUserByLineId>>
    | Awaited<ReturnType<typeof getLineUserById>>;
  session: VerifiedMemberSession;
} | null> {
  const session = await getVerifiedLineMemberSession(ctx, options);
  if (!session) return null;

  let lineUser = null;
  if (session.lineUserId && !session.lineUserId.startsWith("email_")) {
    lineUser = await getLineUserByLineId(session.lineUserId);
  } else if (session.userId) {
    lineUser = await getLineUserById(session.userId);
  } else if (session.lineUserId?.startsWith("email_")) {
    const parsedId = Number(session.lineUserId.slice("email_".length));
    if (Number.isSafeInteger(parsedId) && parsedId > 0) {
      lineUser = await getLineUserById(parsedId);
    }
  }

  return lineUser ? { lineUser, session } : null;
}

export async function requireLineMember(
  ctx: MemberContext,
  options: { cookieOnly?: boolean; maxSessionAgeMs?: number } = {}
) {
  const result = await getLineUserFromSession(ctx, options);
  if (!result?.lineUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "ログインが必要です",
    });
  }
  return result;
}
