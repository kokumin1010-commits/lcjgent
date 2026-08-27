import bcrypt from "bcrypt";
import { jwtVerify, SignJWT } from "jose";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

export const PAYROLL_ACCESS_COOKIE = "lcj_payroll_access";
export const PAYROLL_ACCESS_TTL_SECONDS = 8 * 60 * 60;
export const PAYROLL_PROTECTED_ROW_SQL = "(payrollRecordKey IS NOT NULL OR payrollMonth IS NOT NULL OR payrollEmployee IS NOT NULL OR category = '給与・人件費')";

// Only the bcrypt digest of the user-selected initial password is stored server-side.
// PAYROLL_ACCESS_PASSWORD_HASH can replace it without a code change.
const INITIAL_PASSWORD_HASH = "$2b$12$zIrm7.6nk5I7tlZ3gpswMe9Pz.it6QSgrgjKfG7G1Yqe2IdgDR5HC";

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

export async function hasPayrollAccess(ctx: TrpcContext): Promise<boolean> {
  if (!ctx.user) return false;
  const token = parseCookies(ctx.req.headers.cookie)[PAYROLL_ACCESS_COOKIE];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload.scope === "payroll" && Number(payload.userId) === Number(ctx.user.id);
  } catch {
    return false;
  }
}

export async function verifyAndUnlockPayroll(ctx: TrpcContext, password: string) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const key = getAttemptKey(ctx);
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "密码错误次数过多，请15分钟后再试" });
  }

  const hash = process.env.PAYROLL_ACCESS_PASSWORD_HASH || INITIAL_PASSWORD_HASH;
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    const failures = (attempt?.blockedUntil && attempt.blockedUntil <= now ? 0 : attempt?.failures || 0) + 1;
    attempts.set(key, {
      failures,
      blockedUntil: failures >= MAX_FAILURES ? now + BLOCK_MS : 0,
    });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "給与明細密码不正确" });
  }

  attempts.delete(key);
  const token = await new SignJWT({ scope: "payroll", userId: ctx.user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PAYROLL_ACCESS_TTL_SECONDS}s`)
    .sign(getSecret());
  ctx.res.cookie(PAYROLL_ACCESS_COOKIE, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: PAYROLL_ACCESS_TTL_SECONDS * 1000,
  });
  return { unlocked: true as const, expiresInSeconds: PAYROLL_ACCESS_TTL_SECONDS };
}

export function lockPayrollAccess(ctx: TrpcContext) {
  ctx.res.clearCookie(PAYROLL_ACCESS_COOKIE, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: -1,
  });
  return { unlocked: false as const };
}

export async function requirePayrollAccess(ctx: TrpcContext) {
  if (!(await hasPayrollAccess(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "給与明細密码验证后才能访问" });
  }
}

export function isPayrollCategory(category: unknown) {
  return category === "給与・人件費";
}

export async function requirePayrollAccessForCashflowRow(pool: any, ctx: TrpcContext, id: number) {
  const [rows] = await pool.query(
    `SELECT id FROM company_cashflows WHERE id = ? AND ${PAYROLL_PROTECTED_ROW_SQL} LIMIT 1`,
    [id],
  );
  if (Array.isArray(rows) && rows.length > 0) await requirePayrollAccess(ctx);
}

export function resetPayrollAccessAttemptsForTests() {
  attempts.clear();
}
