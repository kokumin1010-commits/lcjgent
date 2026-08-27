import bcrypt from "bcrypt";
import { jwtVerify, SignJWT } from "jose";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

export const FINANCE_ACCESS_COOKIE = "lcj_finance_access";
export const FINANCE_ACCESS_SESSION_HEADER = "x-lcj-finance-session";
export const FINANCE_ACCESS_TTL_SECONDS = 8 * 60 * 60;

// Only the bcrypt digest of the user-provided password is stored server-side.
// FINANCE_ACCESS_PASSWORD_HASH may replace it without a source-code change.
const INITIAL_FINANCE_PASSWORD_HASH = "$2b$12$VwNh1ajvkNVh6voU5TzdGONvCdeYD/O5pDmVdvFscwQY0L8KQW/zO";

const attempts = new Map<string, { failures: number; blockedUntil: number }>();
const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60 * 1000;

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((result, part) => {
    const index = part.indexOf("=");
    if (index < 0) return result;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
    return result;
  }, {});
}

function getClientIp(ctx: TrpcContext): string {
  const forwarded = ctx.req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
}

function getAttemptKey(ctx: TrpcContext): string {
  return `${ctx.user?.id || "anonymous"}:${getClientIp(ctx)}`;
}

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

function getFinanceSessionId(ctx: TrpcContext): string {
  const raw = ctx.req.headers[FINANCE_ACCESS_SESSION_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

export type FinanceAccessState = {
  unlocked: boolean;
  expiresAt: number | null;
};

export async function getFinanceAccessState(ctx: TrpcContext): Promise<FinanceAccessState> {
  if (!ctx.user) return { unlocked: false, expiresAt: null };
  const sessionId = getFinanceSessionId(ctx);
  const token = parseCookies(ctx.req.headers.cookie)[FINANCE_ACCESS_COOKIE];
  if (!sessionId || !token) return { unlocked: false, expiresAt: null };
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const unlocked = payload.scope === "finance"
      && Number(payload.userId) === Number(ctx.user.id)
      && payload.sessionId === sessionId;
    return {
      unlocked,
      expiresAt: unlocked && typeof payload.exp === "number" ? payload.exp * 1000 : null,
    };
  } catch {
    return { unlocked: false, expiresAt: null };
  }
}

export async function hasFinanceAccess(ctx: TrpcContext): Promise<boolean> {
  return (await getFinanceAccessState(ctx)).unlocked;
}

export async function verifyAndUnlockFinance(ctx: TrpcContext, password: string, sessionId: string) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const key = getAttemptKey(ctx);
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "密码错误次数过多，请15分钟后再试" });
  }

  const hash = process.env.FINANCE_ACCESS_PASSWORD_HASH || INITIAL_FINANCE_PASSWORD_HASH;
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    const failures = (attempt?.blockedUntil && attempt.blockedUntil <= now ? 0 : attempt?.failures || 0) + 1;
    attempts.set(key, {
      failures,
      blockedUntil: failures >= MAX_FAILURES ? now + BLOCK_MS : 0,
    });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "财务管理密码不正确" });
  }

  attempts.delete(key);
  const normalizedSessionId = sessionId.trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(normalizedSessionId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "财务页面会话无效，请刷新后重试" });
  }
  const expiresAt = now + FINANCE_ACCESS_TTL_SECONDS * 1000;
  const token = await new SignJWT({ scope: "finance", userId: ctx.user.id, sessionId: normalizedSessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${FINANCE_ACCESS_TTL_SECONDS}s`)
    .sign(getSecret());
  ctx.res.cookie(FINANCE_ACCESS_COOKIE, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: FINANCE_ACCESS_TTL_SECONDS * 1000,
  });
  return { unlocked: true as const, expiresInSeconds: FINANCE_ACCESS_TTL_SECONDS, expiresAt };
}

export function lockFinanceAccess(ctx: TrpcContext) {
  ctx.res.clearCookie(FINANCE_ACCESS_COOKIE, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: -1,
  });
  return { unlocked: false as const };
}

export async function requireFinanceAccess(ctx: TrpcContext) {
  if (!(await hasFinanceAccess(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "财务管理密码验证后才能访问" });
  }
}

export function resetFinanceAccessAttemptsForTests() {
  attempts.clear();
}
